import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getChatHistory, sendMessage } from '../api/messages';
import { useAuth } from '../context/AuthContext';
import type { MessageResponse } from '../types/api';
import Avatar from '../components/Avatar';
import { formatMessageTime, formatMessageDate } from '../utils/formatDate';
import '../styles/messages.css';

const POLL_MS = 5000;

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

  // partnerUsername comes from router state (set by Users/Messages pages)
  const partnerUsername =
    (location.state as { partnerUsername?: string } | null)?.partnerUsername ??
    partnerId ??
    'Chat';

  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // Ref for auto-scroll
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Merge helper: deduplicate by id, keep order ────────────────────────────
  function mergeMessages(
    existing: MessageResponse[],
    incoming: MessageResponse[]
  ): MessageResponse[] {
    const ids = new Set(existing.map((m) => m.id));
    const novel = incoming.filter((m) => !ids.has(m.id));
    if (novel.length === 0) return existing;
    return [...existing, ...novel].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  // ── Initial fetch ─────────────────────────────────────────────────────────
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

  // ── Poll ──────────────────────────────────────────────────────────────────
  const pollHistory = useCallback(async () => {
    if (!partnerId) return;
    try {
      const data = await getChatHistory(partnerId);
      setMessages((prev) => mergeMessages(prev, data));
    } catch {
      // silently ignore poll errors
    }
  }, [partnerId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (loadState !== 'ok') return;
    const interval = setInterval(pollHistory, POLL_MS);
    return () => clearInterval(interval);
  }, [loadState, pollHistory]);

  // ── Auto-scroll to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    const content = inputText.trim();
    if (!content || sending || !partnerId || !me) return;

    // Optimistic: create a temporary message with a fake id
    const tempId = `temp-${Date.now()}`;
    const optimistic: MessageResponse = {
      id: tempId,
      senderId: me.userId,
      receiverId: partnerId,
      content,
      createdAt: new Date().toISOString(),
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
        <Avatar avatarUrl={undefined} username={partnerUsername} size="sm" />
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
                    <time
                      className="chat-bubble-time"
                      dateTime={m.createdAt}
                      aria-label={`Sent at ${formatMessageTime(m.createdAt)}`}
                    >
                      {formatMessageTime(m.createdAt)}
                    </time>
                  </div>
                </div>
              </div>
            );
          })}

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
          onChange={(e) => setInputText(e.target.value)}
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
