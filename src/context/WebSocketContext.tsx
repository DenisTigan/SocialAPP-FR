/**
 * WebSocketContext — single shared STOMP-over-SockJS connection for the app.
 *
 * Subscribes to:
 *   /topic/presence          — online/offline presence events
 *   /user/queue/messages     — incoming new messages
 *   /user/queue/typing       — typing indicator events
 *   /user/queue/messages-read — read receipt notifications for senders
 *
 * NOTE: raw payloads are console.log'd for every channel during development
 * so the backend contract can be verified. Remove logs once confirmed.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from './AuthContext';
import { sendTypingRest } from '../api/messages';
import type { MessageResponse } from '../types/api';

// ── Payload shape guesses (defensive — backend contract not 100% confirmed) ──

/** Best-guess shape for /topic/presence */
interface PresencePayload {
  userId?: string;
  online?: boolean;
  // Alternative field names the backend might use
  id?: string;
  status?: string;
}

/** Best-guess shape for /user/queue/typing */
interface TypingPayload {
  senderId?: string;
  typing?: boolean;
  // Alternative field names
  userId?: string;
  isTyping?: boolean;
}

/** Best-guess shape for /user/queue/messages-read */
export interface ReadReceiptPayload {
  readerId?: string;
  readAt?: string;
  // Other possible shapes
  partnerId?: string;
  messageIds?: string[];
}

// ── Context value ─────────────────────────────────────────────────────────────

interface WebSocketContextValue {
  isConnected: boolean;
  /** Set of user IDs that are currently online (merged REST + WS) */
  onlineUserIds: Set<string>;
  /** Latest message received via WS (replaces polling) */
  latestMessage: MessageResponse | null;
  /** Latest typing event from partner */
  typingEvent: { senderId: string; typing: boolean } | null;
  /** Latest read-receipt event */
  readEvent: ReadReceiptPayload | null;
  /**
   * Send typing indicator to a partner.
   * Tries STOMP first, falls back to REST if unavailable.
   */
  sendTyping: (receiverId: string, typing: boolean) => void;
  /** Merge additional user IDs into the online set (from initial REST fetch) */
  mergeOnlineIds: (ids: string[]) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();

  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [latestMessage, setLatestMessage] = useState<MessageResponse | null>(null);
  const [typingEvent, setTypingEvent] = useState<{ senderId: string; typing: boolean } | null>(null);
  const [readEvent, setReadEvent] = useState<ReadReceiptPayload | null>(null);

  const clientRef = useRef<Client | null>(null);

  // ── Merge REST-fetched online IDs (WS updates override these) ────────────
  const mergeOnlineIds = useCallback((ids: string[]) => {
    setOnlineUserIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // ── Connect / disconnect when auth changes ────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !token) {
      // Deactivate any existing client on logout
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
        setIsConnected(false);
        setOnlineUserIds(new Set());
        setLatestMessage(null);
        setTypingEvent(null);
        setReadEvent(null);
      }
      return;
    }

    const wsUrl = `${import.meta.env.VITE_API_URL ?? ''}/ws`;

    const client = new Client({
      // SockJS transport factory
      webSocketFactory: () => new SockJS(wsUrl) as unknown as WebSocket,

      // JWT auth in STOMP CONNECT headers (not as query param)
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },

      // Auto-reconnect on drop (important for mobile networks)
      reconnectDelay: 5000,

      onConnect: () => {
        console.log('[WS] STOMP connected');
        setIsConnected(true);

        // ── /topic/presence ─────────────────────────────────────────────────
        client.subscribe('/topic/presence', (frame: IMessage) => {
          console.log('[WS] /topic/presence raw payload:', frame.body);
          try {
            const payload = JSON.parse(frame.body) as PresencePayload;
            // Defensive: check multiple possible field names
            const userId = payload.userId ?? payload.id;
            // online could be a boolean or a string like "ONLINE"/"OFFLINE"
            const online =
              typeof payload.online === 'boolean'
                ? payload.online
                : typeof payload.status === 'string'
                ? payload.status.toUpperCase() === 'ONLINE'
                : undefined;

            if (userId && online !== undefined) {
              setOnlineUserIds((prev) => {
                const next = new Set(prev);
                if (online) {
                  next.add(userId);
                } else {
                  next.delete(userId);
                }
                return next;
              });
            }
          } catch (err) {
            console.warn('[WS] Failed to parse /topic/presence payload:', err);
          }
        });

        // ── /user/queue/messages ─────────────────────────────────────────────
        client.subscribe('/user/queue/messages', (frame: IMessage) => {
          console.log('[WS] /user/queue/messages raw payload:', frame.body);
          try {
            const msg = JSON.parse(frame.body) as MessageResponse;
            setLatestMessage({ ...msg });
          } catch (err) {
            console.warn('[WS] Failed to parse /user/queue/messages payload:', err);
          }
        });

        // ── /user/queue/typing ───────────────────────────────────────────────
        client.subscribe('/user/queue/typing', (frame: IMessage) => {
          console.log('[WS] /user/queue/typing raw payload:', frame.body);
          try {
            const payload = JSON.parse(frame.body) as TypingPayload;
            // Defensive: check alternate field names
            const senderId = payload.senderId ?? payload.userId;
            const typing =
              typeof payload.typing === 'boolean'
                ? payload.typing
                : typeof payload.isTyping === 'boolean'
                ? payload.isTyping
                : false;

            if (senderId) {
              setTypingEvent({ senderId, typing });
            }
          } catch (err) {
            console.warn('[WS] Failed to parse /user/queue/typing payload:', err);
          }
        });

        // ── /user/queue/messages-read ────────────────────────────────────────
        client.subscribe('/user/queue/messages-read', (frame: IMessage) => {
          console.log('[WS] /user/queue/messages-read raw payload:', frame.body);
          try {
            const payload = JSON.parse(frame.body) as ReadReceiptPayload;
            setReadEvent({ ...payload });
          } catch (err) {
            console.warn('[WS] Failed to parse /user/queue/messages-read payload:', err);
          }
        });
      },

      onDisconnect: () => {
        console.log('[WS] STOMP disconnected');
        setIsConnected(false);
      },

      onStompError: (frame) => {
        console.error('[WS] STOMP error:', frame);
      },

      onWebSocketError: (event) => {
        console.error('[WS] WebSocket error:', event);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, token]);

  // ── sendTyping: STOMP first, REST fallback ────────────────────────────────
  const sendTyping = useCallback((receiverId: string, typing: boolean) => {
    const client = clientRef.current;
    if (client && client.connected) {
      try {
        client.publish({
          destination: '/app/chat.typing',
          body: JSON.stringify({ receiverId, typing }),
        });
        return;
      } catch (err) {
        console.warn('[WS] STOMP sendTyping failed, falling back to REST:', err);
      }
    }
    // REST fallback
    sendTypingRest(receiverId, typing).catch((err) =>
      console.warn('[WS] REST typing fallback also failed:', err)
    );
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        onlineUserIds,
        latestMessage,
        typingEvent,
        readEvent,
        sendTyping,
        mergeOnlineIds,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket must be used within a WebSocketProvider');
  return ctx;
}
