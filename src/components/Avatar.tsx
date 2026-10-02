import '../styles/avatar.css';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  avatarUrl?: string;
  username: string;
  size?: AvatarSize;
  /** When true, renders a green online-presence dot anchored to bottom-right */
  online?: boolean;
}

/**
 * Reusable Avatar component.
 * - If avatarUrl is present: renders a circular <img> (object-fit: cover).
 * - Otherwise: renders a gradient circle with the first letter of username.
 * - If online is true: shows a small green presence dot at bottom-right.
 *
 * Sizes: sm=32px, md=44px, lg=96px
 */
export default function Avatar({ avatarUrl, username, size = 'md', online }: AvatarProps) {
  const initial = (username?.[0] ?? '?').toUpperCase();

  return (
    <div className={`avatar-wrap avatar-wrap--${size}`}>
      <div className={`avatar avatar--${size}`} aria-hidden="true">
        {avatarUrl ? (
          <img src={avatarUrl} alt={`${username}'s avatar`} />
        ) : (
          initial
        )}
      </div>
      {online && <span className="avatar-online-dot" aria-label="Online" />}
    </div>
  );
}
