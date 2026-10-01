import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getUserProfile, getUserPhotos } from '../api/users';
import { useAuth } from '../context/AuthContext';
import type { UserProfileResponse, PhotoResponse } from '../types/api';
import Avatar from '../components/Avatar';
import EditProfileModal from '../components/EditProfileModal';
import '../styles/profile.css';

type LoadState = 'loading' | 'ok' | 'not-found' | 'error';

export default function Profile() {
  const { id: profileUserId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me, logoutUser } = useAuth();

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [editModalOpen, setEditModalOpen] = useState(false);

  const isOwnProfile = me?.userId === profileUserId;

  // Remove a deleted photo from local list without refetching
  const handlePhotoDeleted = useCallback((photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!profileUserId) {
      setLoadState('not-found');
      return;
    }
    setLoadState('loading');
    try {
      // Fetch profile and photos in parallel
      const [profileData, photosData] = await Promise.all([
        getUserProfile(profileUserId),
        getUserPhotos(profileUserId),
      ]);
      setProfile(profileData);
      setPhotos(photosData);
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
      state: { partnerUsername: profile?.username },
    });
  }

  function handleLogout() {
    logoutUser();
    navigate('/login', { replace: true });
  }

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
            <p>This profile doesn't exist or has been removed.</p>
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

  const username = profile!.username;
  const bio = profile!.bio;
  const postsCount = profile!.postsCount;
  const totalLikes = profile!.totalLikesReceived;

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="profile-page">
      <div className="profile-inner">
        {/* ── Header card ── */}
        <div className="profile-header">
          {/* Avatar — large */}
          <div className="profile-avatar-wrap">
            <Avatar avatarUrl={profile!.avatarUrl} username={username} size="lg" />
          </div>

          <div className="profile-header-info">
            <h1 className="profile-username">{username}</h1>

            {/* Bio */}
            <p className="profile-bio">
              {bio || <span className="profile-bio-placeholder">No bio yet.</span>}
            </p>

            {/* Stats row */}
            <div className="profile-stats-row">
              <span className="profile-stat">
                <span className="profile-stat-value">{postsCount}</span>
                <span className="profile-stat-label">{postsCount === 1 ? 'post' : 'posts'}</span>
              </span>
              <span className="profile-stat-divider" aria-hidden="true">·</span>
              <span className="profile-stat">
                <span className="profile-stat-value">{totalLikes}</span>
                <span className="profile-stat-label">{totalLikes === 1 ? 'like' : 'likes'}</span>
              </span>
            </div>

            {/* Actions */}
            <div className="profile-actions">
              {isOwnProfile ? (
                <>
                  <button
                    id="profile-edit-btn"
                    className="profile-msg-btn"
                    onClick={() => setEditModalOpen(true)}
                    aria-label="Edit profile"
                  >
                    <span aria-hidden="true">✏️</span>
                    Edit profile
                  </button>
                  <Link
                    to="/settings"
                    id="profile-settings-link"
                    className="profile-logout-btn"
                    aria-label="Go to settings"
                  >
                    <span aria-hidden="true">⚙️</span>
                    Settings
                  </Link>
                  <button
                    id="profile-logout-btn"
                    className="profile-logout-btn"
                    onClick={handleLogout}
                  >
                    <span aria-hidden="true">↩</span>
                    Log out
                  </button>
                </>
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
                  to="/feed"
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

      {/* ── Edit profile modal — lazy import to keep bundle small ── */}
      {editModalOpen && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditModalOpen(false)}
          onSaved={(updated) => {
            setProfile(updated);
            setEditModalOpen(false);
          }}
        />
      )}
    </div>
  );
}


