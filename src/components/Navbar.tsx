import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUnread } from '../context/UnreadContext';
import { getMyProfile } from '../api/users';
import Avatar from './Avatar';
import Toast from './Toast';
import '../styles/navbar.css';

// ── Module-level cache so getMyProfile() is called at most once per session ──
let profileCache: { avatarUrl?: string } | null = null;
let profilePromise: Promise<{ avatarUrl?: string }> | null = null;

function fetchMyAvatarOnce(): Promise<{ avatarUrl?: string }> {
  if (profileCache) return Promise.resolve(profileCache);
  if (!profilePromise) {
    profilePromise = getMyProfile()
      .then((p) => {
        profileCache = { avatarUrl: p.avatarUrl };
        return profileCache;
      })
      .catch(() => {
        profilePromise = null; // allow retry on next mount if it failed
        return {};
      });
  }
  return profilePromise;
}

/** Call this from outside (e.g. EditProfileModal) to bust the cache after an avatar update. */
export function invalidateNavbarAvatarCache(newAvatarUrl?: string) {
  if (newAvatarUrl !== undefined) {
    profileCache = { avatarUrl: newAvatarUrl };
  } else {
    profileCache = null;
    profilePromise = null;
  }
}

export default function Navbar() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const { unreadCount, toasts, dismissToast } = useUnread();
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | undefined>(
    profileCache?.avatarUrl
  );

  // Fetch my avatar once on mount (uses cache after first load)
  useEffect(() => {
    if (!user) return;
    fetchMyAvatarOnce().then((p) => {
      setMyAvatarUrl(p.avatarUrl);
    });
  }, [user]);

  function handleLogout() {
    // Clear cache on logout so next user starts fresh
    profileCache = null;
    profilePromise = null;
    logoutUser();
    navigate('/login', { replace: true });
  }

  return (
    <>
      {/* Toast notifications — rendered above everything */}
      <div className="toast-container" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>

      <nav className="navbar" role="navigation" aria-label="Main navigation">
        {/* Brand */}
        <NavLink to="/feed" className="navbar-brand" aria-label="Go to feed">
          <div className="navbar-brand-icon" aria-hidden="true">✦</div>
          <span className="navbar-brand-name">Luminary</span>
        </NavLink>

        {/* Centre nav links */}
        <div className="navbar-links">
          <NavLink
            id="nav-feed"
            to="/feed"
            className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
            aria-label="Feed"
          >
            <span className="navbar-link-icon" aria-hidden="true">🏠</span>
            <span className="navbar-link-label">Feed</span>
          </NavLink>

          <NavLink
            id="nav-users"
            to="/users"
            className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
            aria-label="People"
          >
            <span className="navbar-link-icon" aria-hidden="true">👥</span>
            <span className="navbar-link-label">People</span>
          </NavLink>

          <NavLink
            id="nav-messages"
            to="/messages"
            className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
            aria-label={`Messages${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <span className="navbar-link-icon navbar-link-icon--badged" aria-hidden="true">
              💬
              {unreadCount > 0 && (
                <span className="nav-badge" aria-hidden="true">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            <span className="navbar-link-label">Messages</span>
          </NavLink>
        </div>

        {/* Right side: gear icon + avatar + logout */}
        <div className="navbar-right">
          {/* Settings gear icon */}
          <NavLink
            id="nav-settings"
            to="/settings"
            className={({ isActive }) => `navbar-settings-btn${isActive ? ' active' : ''}`}
            aria-label="Settings"
            title="Settings"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </NavLink>

          {user && (
            <div
              className="navbar-avatar-wrap"
              title={user.username}
              aria-label={`Logged in as ${user.username}`}
            >
              <Avatar avatarUrl={myAvatarUrl} username={user.username} size="sm" />
            </div>
          )}
          <button
            id="navbar-logout-btn"
            className="navbar-logout-btn"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
