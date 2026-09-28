/**
 * UnreadContext — tracks unread message conversations via polling.
 *
 * NOTE: This polling approach is intentionally lightweight. It should be
 * replaced later by the STOMP WebSocket subscription that the backend already
 * supports: connect to /user/queue/messages (MessageResponse shape) and update
 * unreadCount reactively instead of polling getInbox() every 10 seconds.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { getInbox } from '../api/messages';
import { useAuth } from './AuthContext';
import type { ToastData } from '../components/Toast';

const POLL_INTERVAL_MS = 10_000;
const LS_LAST_SEEN_PREFIX = 'lastSeen:';

interface UnreadContextValue {
  unreadCount: number;
  markAsRead: (partnerId: string) => void;
  toasts: ToastData[];
  dismissToast: (id: string) => void;
}

const UnreadContext = createContext<UnreadContextValue | undefined>(undefined);

function getLastSeen(partnerId: string): string | null {
  return localStorage.getItem(`${LS_LAST_SEEN_PREFIX}${partnerId}`);
}

function setLastSeen(partnerId: string, timestamp: string) {
  localStorage.setItem(`${LS_LAST_SEEN_PREFIX}${partnerId}`, timestamp);
}

export function UnreadProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // Track previous inbox snapshot to detect newly appearing unread conversations
  const prevInboxRef = useRef<Map<string, string>>(new Map());
  // Track if provider is mounted
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Mark conversation as read when user opens it ───────────────────────────
  const markAsRead = useCallback((partnerId: string) => {
    setLastSeen(partnerId, new Date().toISOString());
    // Immediately re-compute count: remove this partner from unread
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // ── Dismiss a toast ───────────────────────────────────────────────────────
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Poll inbox ────────────────────────────────────────────────────────────
  const pollInbox = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const inbox = await getInbox();
      if (!mountedRef.current) return;

      let newUnreadCount = 0;
      const newToasts: ToastData[] = [];

      for (const conv of inbox) {
        const lastSeen = getLastSeen(conv.partnerId);
        const convTime = new Date(conv.timestamp).getTime();
        const lastSeenTime = lastSeen ? new Date(lastSeen).getTime() : 0;

        const isUnread = convTime > lastSeenTime;

        if (isUnread) {
          newUnreadCount++;

          // Detect newly appeared unread conversation (not in previous snapshot
          // or timestamp changed) — show toast if not currently on that chat page
          const prevTimestamp = prevInboxRef.current.get(conv.partnerId);
          const isNew = !prevTimestamp || conv.timestamp !== prevTimestamp;
          const isOnThisChat = location.pathname === `/messages/${conv.partnerId}`;

          if (isNew && !isOnThisChat) {
            const toastId = `toast-${conv.partnerId}-${conv.timestamp}`;
            // Avoid duplicate toasts
            setToasts((prev) => {
              if (prev.some((t) => t.id === toastId)) return prev;
              return [
                ...prev,
                {
                  id: toastId,
                  message: `New message from ${conv.partnerUsername}`,
                  navigateTo: `/messages/${conv.partnerId}`,
                },
              ];
            });
            newToasts.push({ id: toastId, message: '' });
          }
        }

        // Update snapshot
        prevInboxRef.current.set(conv.partnerId, conv.timestamp);
      }

      setUnreadCount(newUnreadCount);
    } catch {
      // Silently ignore poll errors — not critical
    }
  }, [isAuthenticated, location.pathname]);

  // ── Auto-mark as read when user is on a chat page ─────────────────────────
  useEffect(() => {
    const match = location.pathname.match(/^\/messages\/(.+)$/);
    if (match) {
      const partnerId = match[1];
      setLastSeen(partnerId, new Date().toISOString());
      setUnreadCount(0);
    }
  }, [location.pathname]);

  // ── Set up polling ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    // Poll immediately on mount / auth change
    pollInbox();
    const interval = setInterval(pollInbox, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, pollInbox]);

  return (
    <UnreadContext.Provider value={{ unreadCount, markAsRead, toasts, dismissToast }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread(): UnreadContextValue {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error('useUnread must be used within an UnreadProvider');
  return ctx;
}
