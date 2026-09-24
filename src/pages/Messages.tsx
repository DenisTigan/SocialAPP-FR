import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInbox } from '../api/messages';
import type { ConversationResponse } from '../types/api';
import '../styles/messages.css';

const POLL_MS = 5000;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function truncate(s: string, max = 60): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export default function Messages() {
  const navigate = useNavigate();
  const [convos, setConvos] = useState<ConversationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInbox = useCallback(async () => {
    try {
      const data = await getInbox();
      setConvos(data);
    } catch {
      // silently fail on poll errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchInbox]);

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
            {convos.map((c) => (
              <li
                key={c.partnerId}
                className="inbox-row"
                role="listitem"
                onClick={() => handleOpen(c)}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleOpen(c)}
                aria-label={`Conversation with ${c.partnerUsername}`}
              >
                <div className="inbox-avatar" aria-hidden="true">
                  {c.partnerUsername[0].toUpperCase()}
                </div>
                <div className="inbox-row-body">
                  <div className="inbox-row-top">
                    <span className="inbox-username">{c.partnerUsername}</span>
                    <span className="inbox-time">{relativeTime(c.timestamp)}</span>
                  </div>
                  <div className="inbox-last-msg">{truncate(c.lastMessage)}</div>
                </div>
                <span className="inbox-chevron" aria-hidden="true">›</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
