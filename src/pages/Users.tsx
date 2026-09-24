import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAllUsers } from '../api/users';
import { useAuth } from '../context/AuthContext';
import type { UserResponse } from '../types/api';
import '../styles/users.css';

export default function Users() {
  const { user: me } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    getAllUsers()
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch(() => {
        // silently fail — no retry needed for a simple list
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Filter out current user and apply search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.id !== me?.userId &&
        (q === '' || u.username.toLowerCase().includes(q))
    );
  }, [users, me?.userId, search]);

  function handleMessage(u: UserResponse) {
    navigate(`/messages/${u.id}`, { state: { partnerUsername: u.username } });
  }

  return (
    <div className="users-page">
      <div className="users-inner">
        <h1 className="users-heading">People</h1>

        {/* Search */}
        <div className="users-search-wrap">
          <span className="users-search-icon" aria-hidden="true">🔍</span>
          <input
            id="users-search"
            className="users-search-input"
            type="text"
            placeholder="Search by username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="users-spinner-wrap" aria-label="Loading users">
            <div className="users-spinner" />
          </div>
        )}

        {/* Empty (no users at all after load) */}
        {!loading && users.filter((u) => u.id !== me?.userId).length === 0 && (
          <div className="users-empty">
            <div className="users-empty-icon" aria-hidden="true">👥</div>
            <h2>No other users yet</h2>
            <p>Invite your friends to join Luminary!</p>
          </div>
        )}

        {/* No search results */}
        {!loading && users.filter((u) => u.id !== me?.userId).length > 0 && filtered.length === 0 && (
          <p className="users-no-results">No users match &ldquo;{search}&rdquo;</p>
        )}

        {/* User list */}
        {!loading && filtered.length > 0 && (
          <ul className="users-list" role="list" aria-label="User list">
            {filtered.map((u) => (
              <li key={u.id} className="users-row" role="listitem">
                <div
                  className="users-row-avatar"
                  aria-hidden="true"
                >
                  {u.username[0].toUpperCase()}
                </div>
                <div className="users-row-info">
                  <Link
                    to={`/profile/${u.id}`}
                    className="users-row-username users-row-username-link"
                    aria-label={`View ${u.username}'s profile`}
                  >
                    {u.username}
                  </Link>
                </div>
                <button
                  id={`msg-btn-${u.id}`}
                  className="users-message-btn"
                  onClick={() => handleMessage(u)}
                  aria-label={`Message ${u.username}`}
                >
                  <span aria-hidden="true">💬</span>
                  Message
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
