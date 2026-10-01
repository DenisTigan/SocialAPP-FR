import { useState, useRef, useCallback, useEffect } from 'react';
import type { UserProfileResponse } from '../types/api';
import { updateBio, updateAvatar } from '../api/users';
import { invalidateNavbarAvatarCache } from './Navbar';
import Avatar from './Avatar';
import '../styles/edit-profile.css';

const MAX_BIO_LENGTH = 150;

interface EditProfileModalProps {
  profile: UserProfileResponse;
  onClose: () => void;
  /** Called with the updated profile after a successful save. */
  onSaved: (updated: UserProfileResponse) => void;
}

export default function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: EditProfileModalProps) {
  // ── Local state ────────────────────────────────────────────────────────────
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(
    profile.avatarUrl
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Revoke object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (avatarFile && avatarPreview && avatarPreview !== profile.avatarUrl) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarFile, avatarPreview, profile.avatarUrl]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Revoke previous preview if it was a blob
      if (avatarFile && avatarPreview && avatarPreview !== profile.avatarUrl) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError('');
    },
    [avatarFile, avatarPreview, profile.avatarUrl]
  );

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      // Run avatar upload and bio update independently or together
      let latest: UserProfileResponse = profile;

      if (avatarFile) {
        latest = await updateAvatar(avatarFile);
      }

      // Always save bio (even if unchanged — idempotent PUT)
      latest = await updateBio({ bio: bio.trim() });

      // Bust the navbar/bottom-nav avatar cache with the new URL
      invalidateNavbarAvatarCache(latest.avatarUrl);

      onSaved(latest);
    } catch {
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [saving, avatarFile, bio, profile, onSaved]);

  const bioCharsLeft = MAX_BIO_LENGTH - bio.length;
  const isBioOver = bioCharsLeft < 0;

  return (
    <div
      id="edit-profile-overlay"
      className="ep-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ep-modal-title"
    >
      <div className="ep-modal">
        {/* ── Header ── */}
        <div className="ep-header">
          <h2 id="ep-modal-title" className="ep-title">
            Edit profile
          </h2>
          <button
            id="ep-close-btn"
            className="ep-close-btn"
            onClick={onClose}
            aria-label="Close"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div className="ep-body">
          {/* ── Avatar section ── */}
          <div className="ep-avatar-section">
            <div className="ep-avatar-wrap">
              <Avatar
                avatarUrl={avatarPreview}
                username={profile.username}
                size="lg"
              />
              {/* Camera overlay button */}
              <button
                id="ep-change-photo-btn"
                className="ep-avatar-overlay-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change profile photo"
                disabled={saving}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
            </div>
            <button
              className="ep-change-photo-text-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              Change photo
            </button>
            <input
              ref={fileInputRef}
              id="ep-file-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {/* Preview label when a new file is selected */}
            {avatarFile && (
              <span className="ep-preview-label">Preview — not saved yet</span>
            )}
          </div>

          {/* ── Bio section ── */}
          <div className="ep-field">
            <label className="ep-label" htmlFor="ep-bio-input">
              Bio
            </label>
            <textarea
              id="ep-bio-input"
              className={`ep-textarea${isBioOver ? ' ep-textarea--over' : ''}`}
              rows={4}
              placeholder="Tell people a little about yourself…"
              value={bio}
              maxLength={MAX_BIO_LENGTH + 10} /* soft cap via counter */
              onChange={(e) => setBio(e.target.value)}
              disabled={saving}
            />
            <div className={`ep-char-counter${isBioOver ? ' ep-char-counter--over' : ''}`}>
              {bioCharsLeft} characters left
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="ep-error" role="alert">
              {error}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="ep-actions">
            <button
              id="ep-cancel-btn"
              className="ep-cancel-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              id="ep-save-btn"
              className="ep-save-btn"
              onClick={handleSave}
              disabled={saving || isBioOver}
            >
              {saving ? (
                <>
                  <span className="ep-spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
