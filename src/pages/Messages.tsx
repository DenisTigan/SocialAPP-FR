import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInbox } from '../api/messages';
import { useWebSocket } from '../context/WebSocketContext';
import type { ConversationResponse } from '../types/api';
import Avatar from '../components/Avatar';
import { formatInboxTimestamp } from '../utils/formatDate';
import '../styles/messages.css';

// Safety-net poll interval (WebSocket is the primary update mechanism now)
const SAFETY_POLL_MS = 60_000;

function truncate(s: string, max = 60): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export default function Messages() {
  const navigate = useNavigate();
  const { latestMessage, onlineUserIds } = useWebSocket();

  const [convos, setConvos] = useState<ConversationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  // Track if first fetch completed (to avoid showing stale optimistic state)
  const initialFetchDone = useRef(false);

  const fetchInbox = useCallback(async () => {
    try {
      const data = await getInbox();
      setConvos(data);
      initialFetchDone.current = true;
    } catch {
      // silently fail on poll errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Safety-net poll: 60s interval (WS handles real-time, this is a fallback)
  useEffect(() => {
    const interval = setInterval(fetchInbox, SAFETY_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchInbox]);

  // When a new message arrives via WebSocket, refresh the inbox
  useEffect(() => {
    if (latestMessage && initialFetchDone.current) {
      fetchInbox();
    }
  }, [latestMessage, fetchInbox]);

  function handleOpen(c: ConversationResponse) {
    navigate(`/messages/${c.partnerId}`, {
      state: { partnerUsername: c.partnerUsername },
    });
  }

  return (
    <div className="messages-page">
      <div className="inbox-inner">
        <h1 className="inbox-heading">Messages</h1>

        {/* Loading */}
        {loading && (
          <div className="inbox-spinner-wrap" aria-label="Loading inbox">
            <div className="inbox-spinner" />
          </div>
        )}

        {/* Empty state */}
        {!loading && convos.length === 0 && (
          <div className="inbox-empty">
            <div className="inbox-empty-icon" aria-hidden="true">💬</div>
            <h2>No conversations yet</h2>
            <p>Start one from the People page!</p>
          </div>
        )}

        {/* Conversation list */}
        {!loading && convos.length > 0 && (
          <ul className="inbox-list" role="list" aria-label="Conversations">
            {convos.map((c) => {
              // Merge online status: WS set (live) overrides REST snapshot
              const isOnline = onlineUserIds.has(c.partnerId) || (c.partnerOnline ?? false);
              const hasUnread = (c.unreadCount ?? 0) > 0;

              return (
                <li
                  key={c.partnerId}
                  className={`inbox-row${hasUnread ? ' inbox-row--unread' : ''}`}
                  role="listitem"
                  onClick={() => handleOpen(c)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleOpen(c)}
                  aria-label={`Conversation with ${c.partnerUsername}${hasUnread ? `, ${c.unreadCount} unread` : ''}`}
                >
                  <Avatar
                    avatarUrl={c.partnerAvatarUrl}
                    username={c.partnerUsername}
                    size="md"
                    online={isOnline}
                  />
                  <div className="inbox-row-body">
                    <div className="inbox-row-top">
                      <span className="inbox-username">{c.partnerUsername}</span>
                      <time className="inbox-time" dateTime={c.timestamp}>
                        {formatInboxTimestamp(c.timestamp)}
                      </time>
                    </div>
                    <div className="inbox-last-msg">{truncate(c.lastMessage)}</div>
                  </div>
                  {/* Unread badge */}
                  {hasUnread && (
                    <span className="inbox-unread-badge" aria-hidden="true">
                      {(c.unreadCount ?? 0) > 99 ? '99+' : c.unreadCount}
                    </span>
                  )}
                  <span className="inbox-chevron" aria-hidden="true">›</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
