import { useOnlineStatus } from '../hooks/useOnlineStatus';
import './OfflineBanner.css';

/**
 * OfflineBanner — a slim fixed banner shown below the Navbar when the user
 * loses their network connection. Uses the theme's --danger color as the
 * background accent so it's unmissable but not jarring.
 *
 * Render this inside AppLayout so it persists across all protected pages.
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <svg
        className="offline-banner__icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span>You're offline — some features may not work</span>
    </div>
  );
}
