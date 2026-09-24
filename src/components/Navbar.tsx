import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/navbar.css';

export default function Navbar() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logoutUser();
    navigate('/login', { replace: true });
  }

  const avatarLetter = (user?.username?.[0] ?? '?').toUpperCase();

  return (
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
          aria-label="Messages"
        >
          <span className="navbar-link-icon" aria-hidden="true">💬</span>
          <span className="navbar-link-label">Messages</span>
        </NavLink>
      </div>

      {/* Right side: avatar + logout */}
      <div className="navbar-right">
        {user && (
          <div
            className="navbar-avatar"
            title={user.username}
            aria-label={`Logged in as ${user.username}`}
          >
            {avatarLetter}
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
  );
}
