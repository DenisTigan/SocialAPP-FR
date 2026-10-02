import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getChatHistory, sendMessage, markAsRead } from '../api/messages';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import type { MessageResponse } from '../types/api';
import Avatar from '../components/Avatar';
import { formatMessageTime, formatMessageDate } from '../utils/formatDate';
import '../styles/messages.css';

// Safety-net poll interval — WS is primary, this is a last-resort fallback
const SAFETY_POLL_MS = 60_000;

// Typing debounce: send "is typing" at most once per this interval
const TYPING_DEBOUNCE_MS = 2000;
// Send "stopped typing" this long after last keystroke
const TYPING_STOP_DELAY_MS = 3000;
// Auto-hide typing indicator if no update for this long
const TYPING_INDICATOR_TIMEOUT_MS = 5000;

/** Returns a "YYYY-MM-DD" key in local time, used to detect date changes between messages. */
function localDateKey(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function Chat() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { onlineUserIds, latestMessage, typingEvent, readEvent, sendTyping } = useWebSocket();

  // partnerUsername / avatarUrl come from router state (set by Users/Messages pages)
  const locationState = location.state as {
    partnerUsername?: string;
    partnerAvatarUrl?: string;
    partnerOnline?: boolean;
  } | null;

  const partnerUsername = locationState?.partnerUsername ?? partnerId ?? 'Chat';
  const partnerAvatarUrl = locationState?.partnerAvatarUrl;

  // Online: WS set takes precedence over initial REST snapshot from router state
  const isPartnerOnline =
    onlineUserIds.has(partnerId ?? '') || (locationState?.partnerOnline ?? false);

  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);

  // Ref for auto-scroll
  const bottomRef = useRef<HTMLDivElement>(null);

  // Typing indicator refs
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingSentRef = useRef(false);

  // ── Merge helper: deduplicate by id, keep order ────────────────────────────
  function mergeMessages(
    existing: MessageResponse[],
    incoming: MessageResponse[]
  ): MessageResponse[] {
    const map = new Map(existing.map((m) => [m.id, m]));
    for (const m of incoming) {
      // Update existing messages (isRead may have changed), add new ones
      map.set(m.id, m);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  // ── Initial fetch + mark as read ─────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!partnerId) return;
    try {
      const data = await getChatHistory(partnerId);
      setMessages(data);
      setLoadState('ok');
    } catch {
      setLoadState('error');
    }
  }, [partnerId]);

  // ── Mark as read when chat opens or regains focus ─────────────────────────
  const doMarkAsRead = useCallback(async () => {
    if (!partnerId) return;
    try {
      await markAsRead(partnerId);
    } catch {
      // Non-critical — silently ignore
    }
  }, [partnerId]);

  useEffect(() => {
    fetchHistory();
    doMarkAsRead();
  }, [fetchHistory, doMarkAsRead]);

  // ── Focus: re-mark as read when window regains focus ─────────────────────
  useEffect(() => {
    function handleFocus() {
      doMarkAsRead();
    }
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [doMarkAsRead]);

  // ── Safety-net poll (WebSocket is primary) ─────────────────────────────────
  useEffect(() => {
    if (loadState !== 'ok') return;
    const poll = async () => {
      if (!partnerId) return;
      try {
        const data = await getChatHistory(partnerId);
        setMessages((prev) => mergeMessages(prev, data));
      } catch {
        // Silently ignore poll errors
      }
    };
    const interval = setInterval(poll, SAFETY_POLL_MS);
    return () => clearInterval(interval);
  }, [loadState, partnerId]);

  // ── New messages via WebSocket ─────────────────────────────────────────────
  useEffect(() => {
    if (!latestMessage || !me || !partnerId) return;
    const isFromPartner =
      latestMessage.senderId === partnerId && latestMessage.receiverId === me.userId;
    const isFromMe =
      latestMessage.senderId === me.userId && latestMessage.receiverId === partnerId;

    if (isFromPartner || isFromMe) {
      setMessages((prev) => mergeMessages(prev, [latestMessage]));
      // Mark as read when new message arrives in this chat
      if (isFromPartner) {
        doMarkAsRead();
      }
    }
  }, [latestMessage, me, partnerId, doMarkAsRead]);

  // ── Read receipts via WebSocket ────────────────────────────────────────────
  useEffect(() => {
    if (!readEvent || !me) return;
    // When we receive a read-receipt event, mark our sent messages as read
    // The readerId is the person who read our messages (our chat partner)
    const readerId = readEvent.readerId ?? readEvent.partnerId;
    if (readerId === partnerId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === me.userId && !m.isRead
            ? { ...m, isRead: true, readAt: readEvent.readAt ?? new Date().toISOString() }
            : m
        )
      );
    }
  }, [readEvent, me, partnerId]);

  // ── Typing indicator from partner ─────────────────────────────────────────
  useEffect(() => {
    if (!typingEvent || typingEvent.senderId !== partnerId) return;

    setPartnerIsTyping(typingEvent.typing);

    // Auto-hide after timeout in case "stopped" event is missed
    if (typingIndicatorTimeoutRef.current) {
      clearTimeout(typingIndicatorTimeoutRef.current);
    }
    if (typingEvent.typing) {
      typingIndicatorTimeoutRef.current = setTimeout(() => {
        setPartnerIsTyping(false);
      }, TYPING_INDICATOR_TIMEOUT_MS);
    }
  }, [typingEvent, partnerId]);

  // Cleanup typing timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
      if (typingIndicatorTimeoutRef.current) clearTimeout(typingIndicatorTimeoutRef.current);
      // Send stop-typing on unmount
      if (partnerId && isTypingSentRef.current) {
        sendTyping(partnerId, false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  // ── Auto-scroll to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerIsTyping]);

  // ── Typing handler ────────────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputText(e.target.value);
    if (!partnerId) return;

    // Debounce: send "typing: true" at most once per TYPING_DEBOUNCE_MS
    if (!isTypingSentRef.current) {
      sendTyping(partnerId, true);
      isTypingSentRef.current = true;
      typingDebounceRef.current = setTimeout(() => {
        isTypingSentRef.current = false;
      }, TYPING_DEBOUNCE_MS);
    }

    // Reset the "stop typing" timer on every keystroke
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => {
      sendTyping(partnerId, false);
      isTypingSentRef.current = false;
    }, TYPING_STOP_DELAY_MS);
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    const content = inputText.trim();
    if (!content || sending || !partnerId || !me) return;

    // Clear typing state immediately on send
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    if (isTypingSentRef.current) {
      sendTyping(partnerId, false);
      isTypingSentRef.current = false;
    }

    // Optimistic: create a temporary message with a fake id
    const tempId = `temp-${Date.now()}`;
    const optimistic: MessageResponse = {
      id: tempId,
      senderId: me.userId,
      receiverId: partnerId,
      content,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInputText('');
    setSending(true);

    try {
      const confirmed = await sendMessage(partnerId, { content });
      // Replace the temp message with the real one from the server
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? confirmed : m))
      );
    } catch {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(content); // restore input
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) handleSend();
  }

  // ── Read receipt checkmarks ───────────────────────────────────────────────
  function ReadStatus({ msg }: { msg: MessageResponse }) {
    if (msg.senderId !== me?.userId) return null;
    if (msg.id.startsWith('temp-')) return null; // skip optimistic messages

    return (
      <span
        className={`chat-read-status${msg.isRead ? ' chat-read-status--seen' : ''}`}
        aria-label={msg.isRead ? 'Seen' : 'Sent'}
        title={msg.isRead ? `Seen${msg.readAt ? ' at ' + formatMessageTime(msg.readAt) : ''}` : 'Sent'}
      >
        {msg.isRead ? '✓✓' : '✓'}
      </span>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="chat-page">
      {/* Header */}
      <header className="chat-header">
        <button
          id="chat-back-btn"
          className="chat-back-btn"
          onClick={() => navigate('/messages')}
          aria-label="Back to messages"
        >
          ‹
        </button>
        <Avatar
          avatarUrl={partnerAvatarUrl}
          username={partnerUsername}
          size="sm"
          online={isPartnerOnline}
        />
        <span className="chat-header-name">{partnerUsername}</span>
      </header>

      {/* Messages area */}
      {loadState === 'loading' && (
        <div className="chat-state-wrap" aria-label="Loading messages">
          <div className="chat-spinner" />
        </div>
      )}

      {loadState === 'error' && (
        <div className="chat-state-wrap" role="alert">
          <span className="chat-error-msg">Failed to load messages.</span>
          <button
            id="chat-retry-btn"
            className="chat-retry-btn"
            onClick={fetchHistory}
          >
            Retry
          </button>
        </div>
      )}

      {loadState === 'ok' && (
        <div className="chat-messages-wrap" role="log" aria-live="polite" aria-label="Chat messages">
          {messages.length === 0 && (
            <div className="chat-state-wrap">
              <span className="chat-empty-icon" aria-hidden="true">👋</span>
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                Say hello to {partnerUsername}!
              </span>
            </div>
          )}

          {messages.map((m, i) => {
            const isMine = m.senderId === me?.userId;

            // ── Date separator: show when date changes vs previous message ──
            const prevKey = i > 0 ? localDateKey(messages[i - 1].createdAt) : null;
            const thisKey = localDateKey(m.createdAt);
            const showDateSep = prevKey !== thisKey;

            return (
              <div key={m.id}>
                {/* Date separator */}
                {showDateSep && (
                  <div className="chat-date-sep" aria-label={formatMessageDate(m.createdAt)}>
                    <span className="chat-date-sep-label">
                      {formatMessageDate(m.createdAt)}
                    </span>
                  </div>
                )}

                {/* Bubble row */}
                <div className={`chat-bubble-row ${isMine ? 'mine' : 'theirs'}`}>
                  <div className="chat-bubble-wrap">
                    <div className="chat-bubble">{m.content}</div>
                    <div className="chat-bubble-meta">
                      <time
                        className="chat-bubble-time"
                        dateTime={m.createdAt}
                        aria-label={`Sent at ${formatMessageTime(m.createdAt)}`}
                      >
                        {formatMessageTime(m.createdAt)}
                      </time>
                      <ReadStatus msg={m} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {partnerIsTyping && (
            <div className="chat-bubble-row theirs chat-typing-row" aria-live="polite">
              <div className="chat-bubble-wrap">
                <div className="chat-typing-indicator" aria-label={`${partnerUsername} is typing`}>
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      )}

      {/* Input bar — always visible */}
      <div className="chat-input-bar">
        <input
          id="chat-input"
          className="chat-input"
          type="text"
          placeholder={`Message ${partnerUsername}…`}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={loadState !== 'ok'}
          autoComplete="off"
        />
        <button
          id="chat-send-btn"
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!inputText.trim() || sending || loadState !== 'ok'}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
