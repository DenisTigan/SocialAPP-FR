import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/bottom-nav.css';

/**
 * BottomNav — Mobile-only fixed bottom tab bar.
 * Visible only at max-width: 768px via CSS.
 * Icons: Feed, People, Messages, Profile.
 */
export default function BottomNav() {
  const { user } = useAuth();
  const avatarLetter = (user?.username?.[0] ?? '?').toUpperCase();
  const profileId = user?.userId ?? '';

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Mobile navigation">
      <NavLink
        id="bnav-feed"
        to="/feed"
        className={({ isActive }) => `bnav-item${isActive ? ' active' : ''}`}
        aria-label="Feed"
      >
        <span className="bnav-icon" aria-hidden="true">
          {/* Home / Feed icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </span>
        <span className="bnav-label">Feed</span>
      </NavLink>

      <NavLink
        id="bnav-users"
        to="/users"
        className={({ isActive }) => `bnav-item${isActive ? ' active' : ''}`}
        aria-label="People"
      >
        <span className="bnav-icon" aria-hidden="true">
          {/* People icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
        <span className="bnav-label">People</span>
      </NavLink>

      <NavLink
        id="bnav-messages"
        to="/messages"
        className={({ isActive }) => `bnav-item${isActive ? ' active' : ''}`}
        aria-label="Messages"
      >
        <span className="bnav-icon" aria-hidden="true">
          {/* Chat icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <span className="bnav-label">Messages</span>
      </NavLink>

      <NavLink
        id="bnav-profile"
        to={`/profile/${profileId}`}
        className={({ isActive }) => `bnav-item${isActive ? ' active' : ''}`}
        aria-label="My profile"
      >
        <span className="bnav-icon bnav-avatar-icon" aria-hidden="true">
          {avatarLetter}
        </span>
        <span className="bnav-label">Profile</span>
      </NavLink>
    </nav>
  );
}
