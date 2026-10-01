import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { PhotoResponse, CommentResponse } from '../types/api';
import {
  toggleLike,
  getComments,
  addComment,
  updatePhotoCaption,
  deletePhoto,
  updateComment,
  deleteComment,
} from '../api/photos';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import ConfirmDialog from './ConfirmDialog';
import '../styles/feed.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ── Three-dot menu (shared by photo and comment rows) ──────────────────────

interface DotMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
}

function DotMenu({ onEdit, onDelete, editLabel = 'Edit', deleteLabel = 'Delete' }: DotMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="pc-dot-menu" ref={ref}>
      <button
        className="pc-dot-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="pc-dot-dropdown" role="menu">
          <button
            className="pc-dot-item"
            role="menuitem"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            {editLabel}
          </button>
          <button
            className="pc-dot-item pc-dot-item--danger"
            role="menuitem"
            onClick={() => { setOpen(false); onDelete(); }}
          >
            {deleteLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PhotoCardProps {
  photo: PhotoResponse;
  /** Callback so the feed/profile can update its list after a like toggle */
  onLikeToggle: (photoId: string, liked: boolean, newCount: number) => void;
  /** Callback so the feed/profile can remove this card after deletion */
  onDeleted?: (photoId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PhotoCard({ photo, onLikeToggle, onDeleted }: PhotoCardProps) {
  const { user: me } = useAuth();
  const isOwnPost = me?.userId === photo.userId;

  // ── Like state (optimistic) ────────────────────────────────────────────────
  const [liked, setLiked] = useState(photo.isLikedByCurrentUser);
  const [likeCount, setLikeCount] = useState(photo.likeCount);
  const [likeLoading, setLikeLoading] = useState(false);

  // ── Caption local state ────────────────────────────────────────────────────
  const [caption, setCaption] = useState(photo.caption);
  const [editingCaption, setEditingCaption] = useState(false);
  const [editCaptionText, setEditCaptionText] = useState(photo.caption);
  const [captionSaving, setCaptionSaving] = useState(false);
  const [captionError, setCaptionError] = useState('');

  // ── Delete post dialog ─────────────────────────────────────────────────────
  const [deletePhotoOpen, setDeletePhotoOpen] = useState(false);
  const [photoDeleting, setPhotoDeleting] = useState(false);

  // ── Comments section ───────────────────────────────────────────────────────
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsFetched, setCommentsFetched] = useState(false);

  // New comment input
  const [commentText, setCommentText] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);

  // Per-comment edit state  (commentId -> draft text)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [commentSavingId, setCommentSavingId] = useState<string | null>(null);
  const [commentEditError, setCommentEditError] = useState('');

  // Per-comment delete dialog
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [commentDeleting, setCommentDeleting] = useState(false);

  // ── Like toggle ────────────────────────────────────────────────────────────
  const handleLike = useCallback(async () => {
    if (likeLoading) return;
    const prevLiked = liked;
    const prevCount = likeCount;
    const nextLiked = !liked;
    const nextCount = liked ? likeCount - 1 : likeCount + 1;
    setLiked(nextLiked);
    setLikeCount(nextCount);
    setLikeLoading(true);
    try {
      await toggleLike(photo.id);
      onLikeToggle(photo.id, nextLiked, nextCount);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLikeLoading(false);
    }
  }, [liked, likeCount, likeLoading, photo.id, onLikeToggle]);

  // ── Comments toggle ────────────────────────────────────────────────────────
  const handleToggleComments = useCallback(async () => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && !commentsFetched) {
      setCommentsLoading(true);
      try {
        const fetched = await getComments(photo.id);
        setComments(fetched);
        setCommentsFetched(true);
      } catch {
        // silently fail; user can try again
      } finally {
        setCommentsLoading(false);
      }
    }
  }, [commentsOpen, commentsFetched, photo.id]);

  // ── Post comment ───────────────────────────────────────────────────────────
  const handlePostComment = useCallback(async () => {
    const text = commentText.trim();
    if (!text || commentPosting) return;
    setCommentPosting(true);
    try {
      const newComment = await addComment(photo.id, { text });
      setComments((prev) => [...prev, newComment]);
      setCommentText('');
    } catch {
      // silently fail
    } finally {
      setCommentPosting(false);
    }
  }, [commentText, commentPosting, photo.id]);

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handlePostComment();
  };

  // ── Edit caption ───────────────────────────────────────────────────────────
  function startEditCaption() {
    setEditCaptionText(caption);
    setCaptionError('');
    setEditingCaption(true);
  }

  async function saveCaption() {
    if (captionSaving) return;
    setCaptionSaving(true);
    setCaptionError('');
    try {
      const updated = await updatePhotoCaption(photo.id, editCaptionText.trim());
      setCaption(updated.caption);
      setEditingCaption(false);
    } catch {
      setCaptionError('Failed to save. Please try again.');
    } finally {
      setCaptionSaving(false);
    }
  }

  // ── Delete photo ───────────────────────────────────────────────────────────
  async function confirmDeletePhoto() {
    if (photoDeleting) return;
    setPhotoDeleting(true);
    try {
      await deletePhoto(photo.id);
      setDeletePhotoOpen(false);
      onDeleted?.(photo.id);
    } catch {
      // Keep dialog open; user can retry
    } finally {
      setPhotoDeleting(false);
    }
  }

  // ── Edit comment ───────────────────────────────────────────────────────────
  function startEditComment(comment: CommentResponse) {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
    setCommentEditError('');
  }

  async function saveComment(commentId: string) {
    if (commentSavingId) return;
    setCommentSavingId(commentId);
    setCommentEditError('');
    try {
      const updated = await updateComment(commentId, editCommentText.trim());
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingCommentId(null);
    } catch {
      setCommentEditError('Failed to save. Try again.');
    } finally {
      setCommentSavingId(null);
    }
  }

  // ── Delete comment ─────────────────────────────────────────────────────────
  async function confirmDeleteComment() {
    if (!deleteCommentId || commentDeleting) return;
    setCommentDeleting(true);
    try {
      await deleteComment(deleteCommentId);
      setComments((prev) => prev.filter((c) => c.id !== deleteCommentId));
      setDeleteCommentId(null);
    } catch {
      // Keep dialog open
    } finally {
      setCommentDeleting(false);
    }
  }

  const commentCount = commentsFetched ? comments.length : undefined;

  return (
    <>
      <article className="photo-card">
        {/* ── Header ── */}
        <div className="photo-card-header">
          <Avatar avatarUrl={photo.avatarUrl} username={photo.username} size="sm" />
          <div className="photo-card-meta">
            <Link
              to={`/profile/${photo.userId}`}
              className="photo-card-username photo-card-username-link"
            >
              {photo.username}
            </Link>
            <div className="photo-card-time">{relativeTime(photo.createdAt)}</div>
          </div>

          {/* Three-dot menu — own posts only */}
          {isOwnPost && (
            <DotMenu
              onEdit={startEditCaption}
              onDelete={() => setDeletePhotoOpen(true)}
              editLabel="Edit caption"
              deleteLabel="Delete post"
            />
          )}
        </div>

        {/* ── Image ── */}
        <div className="photo-card-img-wrap">
          <img
            className="photo-card-img"
            src={photo.imageUrl}
            alt={caption || `Photo by ${photo.username}`}
            loading="lazy"
          />
        </div>

        {/* ── Action row ── */}
        <div className="photo-card-actions">
          <button
            id={`like-btn-${photo.id}`}
            className={`photo-card-like-btn${liked ? ' liked' : ''}`}
            onClick={handleLike}
            disabled={likeLoading}
            aria-label={liked ? 'Unlike' : 'Like'}
            aria-pressed={liked}
          >
            <span className="photo-card-heart" aria-hidden="true">
              {liked ? '❤️' : '🤍'}
            </span>
            <span className="photo-card-like-count">{likeCount}</span>
          </button>
        </div>

        {/* ── Caption (or inline edit) ── */}
        {editingCaption ? (
          <div className="pc-caption-edit">
            <input
              id={`caption-edit-${photo.id}`}
              className="pc-caption-input"
              type="text"
              value={editCaptionText}
              onChange={(e) => setEditCaptionText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveCaption();
                if (e.key === 'Escape') setEditingCaption(false);
              }}
              disabled={captionSaving}
              autoFocus
              placeholder="Write a caption…"
            />
            <div className="pc-caption-edit-row">
              {captionError && <span className="pc-inline-error">{captionError}</span>}
              <div className="pc-caption-edit-btns">
                <button
                  className="pc-edit-cancel-btn"
                  onClick={() => setEditingCaption(false)}
                  disabled={captionSaving}
                >
                  Cancel
                </button>
                <button
                  className="pc-edit-save-btn"
                  onClick={saveCaption}
                  disabled={captionSaving || !editCaptionText.trim()}
                >
                  {captionSaving
                    ? <span className="feed-spinner-sm" aria-hidden="true" />
                    : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          caption && (
            <p className="photo-card-caption">
              <strong>{photo.username}</strong>
              {caption}
            </p>
          )
        )}

        {/* ── Comments toggle ── */}
        <button
          id={`comments-toggle-${photo.id}`}
          className="photo-card-comments-toggle"
          onClick={handleToggleComments}
        >
          {commentsOpen
            ? 'Hide comments'
            : commentCount !== undefined
            ? `View all ${commentCount} comment${commentCount !== 1 ? 's' : ''}`
            : 'View comments'}
        </button>

        {/* ── Comments section ── */}
        {commentsOpen && (
          <div className="photo-card-comments">
            {commentsLoading ? (
              <div className="photo-card-comments-loading">
                <span className="feed-spinner-sm" aria-label="Loading comments" />
              </div>
            ) : comments.length === 0 ? (
              <p className="photo-card-comments-empty">No comments yet. Be the first!</p>
            ) : (
              comments.map((c) => {
                const isMyComment = me?.userId === c.userId;
                const isEditing = editingCommentId === c.id;

                return (
                  <div key={c.id} className="photo-card-comment-item">
                    <Avatar avatarUrl={c.avatarUrl} username={c.username} size="sm" />

                    {isEditing ? (
                      /* ── Inline comment edit ── */
                      <div className="pc-comment-edit-wrap">
                        <input
                          id={`comment-edit-${c.id}`}
                          className="pc-comment-edit-input"
                          type="text"
                          value={editCommentText}
                          onChange={(e) => setEditCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveComment(c.id);
                            if (e.key === 'Escape') setEditingCommentId(null);
                          }}
                          disabled={commentSavingId === c.id}
                          autoFocus
                        />
                        <div className="pc-comment-edit-row">
                          {commentEditError && (
                            <span className="pc-inline-error">{commentEditError}</span>
                          )}
                          <button
                            className="pc-edit-cancel-btn"
                            onClick={() => setEditingCommentId(null)}
                            disabled={commentSavingId === c.id}
                          >
                            Cancel
                          </button>
                          <button
                            className="pc-edit-save-btn"
                            onClick={() => saveComment(c.id)}
                            disabled={commentSavingId === c.id || !editCommentText.trim()}
                          >
                            {commentSavingId === c.id
                              ? <span className="feed-spinner-sm" aria-hidden="true" />
                              : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Normal comment display ── */
                      <div className="pc-comment-body">
                        <span className="pc-comment-content">
                          <Link
                            to={`/profile/${c.userId}`}
                            className="photo-card-comment-username-link"
                          >
                            {c.username}
                          </Link>
                          {c.text}
                        </span>

                        {/* Options affordance — own comments only */}
                        {isMyComment && (
                          <span className="pc-comment-actions">
                            <button
                              className="pc-comment-action-btn"
                              onClick={() => startEditComment(c)}
                              aria-label="Edit comment"
                            >
                              Edit
                            </button>
                            <span className="pc-comment-action-sep" aria-hidden="true">·</span>
                            <button
                              className="pc-comment-action-btn pc-comment-action-btn--danger"
                              onClick={() => setDeleteCommentId(c.id)}
                              aria-label="Delete comment"
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* New comment input */}
            <div className="photo-card-comment-form">
              <input
                id={`comment-input-${photo.id}`}
                className="photo-card-comment-input"
                type="text"
                placeholder="Add a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={handleCommentKeyDown}
                disabled={commentPosting}
              />
              <button
                id={`comment-post-${photo.id}`}
                className="photo-card-comment-post-btn"
                onClick={handlePostComment}
                disabled={!commentText.trim() || commentPosting}
              >
                {commentPosting ? <span className="feed-spinner-sm" aria-hidden="true" /> : 'Post'}
              </button>
            </div>
          </div>
        )}
      </article>

      {/* ── Delete post confirmation ── */}
      {deletePhotoOpen && (
        <ConfirmDialog
          title="Delete this post?"
          message="This can't be undone. The photo and all its comments will be permanently removed."
          confirmLabel="Delete"
          loading={photoDeleting}
          onConfirm={confirmDeletePhoto}
          onCancel={() => !photoDeleting && setDeletePhotoOpen(false)}
        />
      )}

      {/* ── Delete comment confirmation ── */}
      {deleteCommentId && (
        <ConfirmDialog
          title="Delete this comment?"
          message="This action cannot be undone."
          confirmLabel="Delete"
          loading={commentDeleting}
          onConfirm={confirmDeleteComment}
          onCancel={() => !commentDeleting && setDeleteCommentId(null)}
        />
      )}
    </>
  );
}
