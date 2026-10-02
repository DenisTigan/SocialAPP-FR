/**
 * UnreadContext — tracks total unread message count across all conversations.
 *
 * Strategy:
 *  - Primary: sum of ConversationResponse.unreadCount from the latest getInbox() call.
 *  - Real-time refresh: triggered by latestMessage from WebSocketContext (new message event).
 *  - Safety-net: 60s poll in case WebSocket is down.
 *  - Optimistic zeroing: when user opens a chat, immediately zero that conversation's
 *    unread count locally without waiting for a refetch.
 *
 * The old localStorage-based "lastSeen" approximation has been removed.
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
import { useWebSocket } from './WebSocketContext';
import type { ConversationResponse } from '../types/api';
import type { ToastData } from '../components/Toast';

// Safety-net poll only — WebSocket drives real-time updates
const SAFETY_POLL_MS = 60_000;

interface UnreadContextValue {
  unreadCount: number;
  /** Call when user opens a chat — optimistically zeros that conversation's unread */
  markConversationRead: (partnerId: string) => void;
  toasts: ToastData[];
  dismissToast: (id: string) => void;
}

const UnreadContext = createContext<UnreadContextValue | undefined>(undefined);

export function UnreadProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const { latestMessage } = useWebSocket();

  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // Local snapshot of conversations for optimistic updates
  const convosRef = useRef<ConversationResponse[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Dismiss a toast ───────────────────────────────────────────────────────
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Refresh inbox + recompute unread ──────────────────────────────────────
  const refreshInbox = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const inbox = await getInbox();
      if (!mountedRef.current) return;

      convosRef.current = inbox;

      // Total unread = sum of backend-provided unreadCount
      const total = inbox.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
      setUnreadCount(total);

      // Toast for newly arrived messages in conversations not currently open
      for (const conv of inbox) {
        if ((conv.unreadCount ?? 0) === 0) continue;
        const isOnThisChat = location.pathname === `/messages/${conv.partnerId}`;
        if (isOnThisChat) continue;

        const toastId = `toast-${conv.partnerId}-${conv.timestamp}`;
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
      }
    } catch {
      // Silently ignore errors — not critical
    }
  }, [isAuthenticated, location.pathname]);

  // ── Optimistically zero a conversation's unread count ─────────────────────
  const markConversationRead = useCallback((partnerId: string) => {
    convosRef.current = convosRef.current.map((c) =>
      c.partnerId === partnerId ? { ...c, unreadCount: 0 } : c
    );
    const total = convosRef.current.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
    setUnreadCount(total);
  }, []);

  // ── Auto-mark when user navigates to a chat page ──────────────────────────
  useEffect(() => {
    const match = location.pathname.match(/^\/messages\/(.+)$/);
    if (match) {
      const partnerId = match[1];
      markConversationRead(partnerId);
    }
  }, [location.pathname, markConversationRead]);

  // ── Initial fetch + safety-net polling ────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    refreshInbox();
    const interval = setInterval(refreshInbox, SAFETY_POLL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshInbox]);

  // ── Refresh inbox when a new WS message arrives ───────────────────────────
  useEffect(() => {
    if (latestMessage) {
      refreshInbox();
    }
  }, [latestMessage, refreshInbox]);

  return (
    <UnreadContext.Provider value={{ unreadCount, markConversationRead, toasts, dismissToast }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread(): UnreadContextValue {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error('useUnread must be used within an UnreadProvider');
  return ctx;
}
