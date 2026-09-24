import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getFeed } from '../api/photos';
import { getAllUsers } from '../api/users';
import { useAuth } from '../context/AuthContext';
import type { PhotoResponse } from '../types/api';
import '../styles/profile.css';

/**
 * TEMPORARY: We gather this user's photos by fetching the global feed across
 * multiple pages and filtering client-side by photo.userId === profileUserId.
 *
 * This should be replaced once a dedicated backend endpoint exists, e.g.:
 *   GET /api/photos/user/{userId}  → PhotoResponse[]
 *
 * The number of pages fetched (MAX_PAGES) is a best-effort heuristic; in a
 * large dataset some photos may not appear if they fall beyond page MAX_PAGES.
 */
const FEED_PAGE_SIZE = 20;
const MAX_PAGES = 5; // fetch up to 5 pages × 20 = 100 photos to filter from

type LoadState = 'loading' | 'ok' | 'not-found' | 'error';

export default function Profile() {
  const { id: profileUserId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me, logoutUser } = useAuth();

  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [username, setUsername] = useState<string>('');
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const isOwnProfile = me?.userId === profileUserId;

  const fetchProfile = useCallback(async () => {
    if (!profileUserId) {
      setLoadState('not-found');
      return;
    }
    setLoadState('loading');

    try {
      // ── Step 1: collect photos from feed, filtering by userId ──────────────
      // TEMPORARY client-side filter (see module comment above)
      const collected: PhotoResponse[] = [];
      let page = 0;
      let isLast = false;

      while (page < MAX_PAGES && !isLast) {
        const data = await getFeed(page, FEED_PAGE_SIZE);
        const matching = data.content.filter((p) => p.userId === profileUserId);
        collected.push(...matching);
        isLast = data.last;
        page++;
      }

      // ── Step 2: resolve username ───────────────────────────────────────────
      let resolvedUsername = collected[0]?.username ?? '';

      if (!resolvedUsername) {
        // Fallback: look up username via /api/users
        try {
          const allUsers = await getAllUsers();
          const found = allUsers.find((u) => u.id === profileUserId);
          resolvedUsername = found?.username ?? '';
        } catch {
          // silently ignore — we'll show "not found" below
        }
      }

      if (!resolvedUsername && collected.length === 0) {
        setLoadState('not-found');
        return;
      }

      setPhotos(collected);
      setUsername(resolvedUsername);
      setLoadState('ok');
    } catch {
      setLoadState('error');
    }
  }, [profileUserId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  function handleMessage() {
    navigate(`/messages/${profileUserId}`, {
      state: { partnerUsername: username },
    });
  }

  function handleLogout() {
    logoutUser();
    navigate('/login', { replace: true });
  }

  const avatarLetter = (username[0] ?? '?').toUpperCase();

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <div className="profile-page">
        <div className="profile-inner">
          <div className="profile-spinner-wrap" aria-label="Loading profile">
            <div className="profile-spinner" />
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (loadState === 'not-found') {
    return (
      <div className="profile-page">
        <div className="profile-inner">
          <div className="profile-not-found" role="alert">
            <div className="profile-not-found-icon" aria-hidden="true">🔍</div>
            <h2>User not found</h2>
            <p>This profile doesn't exist or has no activity yet.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (loadState === 'error') {
    return (
      <div className="profile-page">
        <div className="profile-inner">
          <div className="profile-not-found" role="alert">
            <div className="profile-not-found-icon" aria-hidden="true">⚠️</div>
            <h2>Something went wrong</h2>
            <p>
              <button
                id="profile-retry-btn"
                className="profile-msg-btn"
                onClick={fetchProfile}
                style={{ marginTop: 12 }}
              >
                Retry
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="profile-page">
      <div className="profile-inner">
        {/* ── Header card ── */}
        <div className="profile-header">
          <div className="profile-avatar" aria-hidden="true">
            {avatarLetter}
          </div>

          <div className="profile-header-info">
            <h1 className="profile-username">{username}</h1>
            <p className="profile-post-count">
              {photos.length} {photos.length === 1 ? 'post' : 'posts'}
            </p>

            <div className="profile-actions">
              {isOwnProfile ? (
                <button
                  id="profile-logout-btn"
                  className="profile-logout-btn"
                  onClick={handleLogout}
                >
                  <span aria-hidden="true">↩</span>
                  Log out
                </button>
              ) : (
                <button
                  id="profile-msg-btn"
                  className="profile-msg-btn"
                  onClick={handleMessage}
                  aria-label={`Message ${username}`}
                >
                  <span aria-hidden="true">💬</span>
                  Message
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Photo grid ── */}
        {photos.length === 0 ? (
          <div className="profile-empty">
            <div className="profile-empty-icon" aria-hidden="true">📷</div>
            <h2>No posts yet</h2>
            <p>
              {isOwnProfile
                ? 'Share your first photo from the Feed!'
                : `${username} hasn't posted anything yet.`}
            </p>
          </div>
        ) : (
          <>
            <p className="profile-grid-heading">Posts</p>
            <div
              className="profile-grid"
              role="list"
              aria-label={`${username}'s photos`}
            >
              {photos.map((photo) => (
                <Link
                  key={photo.id}
                  to={`/feed`}
                  className="profile-grid-item"
                  role="listitem"
                  aria-label={photo.caption || `Photo by ${username}`}
                  title={photo.caption || undefined}
                >
                  <img
                    src={photo.imageUrl}
                    alt={photo.caption || `Photo by ${username}`}
                    loading="lazy"
                  />
                  <div className="profile-grid-overlay" aria-hidden="true">
                    <span className="profile-grid-stat">
                      ❤️ {photo.likeCount}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
