import { useState, useRef, useCallback, useEffect } from 'react';
import type { PhotoResponse } from '../types/api';
import { uploadPhoto } from '../api/photos';
import '../styles/feed.css';

interface UploadModalProps {
  onClose: () => void;
  onUploaded: (photo: PhotoResponse) => void;
}

export default function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Revoke preview URL when unmounted to avoid memory leaks
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError('');
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(selected));
  }, [preview]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await uploadPhoto(file, caption.trim() || undefined);
      onUploaded(uploaded);
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Upload failed. Please try again.';
      setError(message);
    } finally {
      setUploading(false);
    }
  }, [file, caption, uploading, onUploaded, onClose]);

  return (
    <div
      id="upload-modal-overlay"
      className="upload-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div className="upload-modal">
        {/* ── Header ── */}
        <div className="upload-modal-header">
          <h2 id="upload-modal-title" className="upload-modal-title">New post</h2>
          <button
            id="upload-modal-close"
            className="upload-modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={uploading}
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div className="upload-modal-body">
          {/* Image picker / preview */}
          <label className="upload-img-picker" htmlFor="upload-file-input">
            {preview ? (
              <img className="upload-preview" src={preview} alt="Preview of selected image" />
            ) : (
              <>
                <span className="upload-img-picker-icon" aria-hidden="true">🖼️</span>
                <span className="upload-img-picker-label">
                  <span>Click to choose</span> an image
                </span>
              </>
            )}
            <input
              id="upload-file-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>

          {/* Caption */}
          <div>
            <label className="upload-caption-label" htmlFor="upload-caption-input">
              Caption (optional)
            </label>
            <textarea
              id="upload-caption-input"
              className="upload-caption-input"
              placeholder="Write a caption…"
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={uploading}
            />
          </div>

          {/* Error */}
          {error && <div className="upload-error" role="alert">{error}</div>}

          {/* Submit */}
          <button
            id="upload-submit-btn"
            className="upload-submit-btn"
            onClick={handleSubmit}
            disabled={!file || uploading}
          >
            {uploading
              ? <><span className="feed-spinner-sm" aria-hidden="true" />Uploading…</>
              : 'Share post'}
          </button>
        </div>
      </div>
    </div>
  );
}
