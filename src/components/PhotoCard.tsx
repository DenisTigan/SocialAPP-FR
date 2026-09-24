import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { PhotoResponse, CommentResponse } from '../types/api';
import { toggleLike, getComments, addComment } from '../api/photos';
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

function avatarLetter(username: string): string {
  return (username?.[0] ?? '?').toUpperCase();
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PhotoCardProps {
  photo: PhotoResponse;
  /** Callback so the feed can update its list after a like toggle */
  onLikeToggle: (photoId: string, liked: boolean, newCount: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PhotoCard({ photo, onLikeToggle }: PhotoCardProps) {
  // Like state — kept locally for optimistic updates
  const [liked, setLiked] = useState(photo.isLikedByCurrentUser);
  const [likeCount, setLikeCount] = useState(photo.likeCount);
  const [likeLoading, setLikeLoading] = useState(false);

  // Comments section
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsFetched, setCommentsFetched] = useState(false);

  // New comment input
  const [commentText, setCommentText] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);

  // ── Like toggle ────────────────────────────────────────────────────────────
  const handleLike = useCallback(async () => {
    if (likeLoading) return;
    // Optimistic update
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
      // Revert on failure
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

  // ── Post comment ──────────────────────────────────────────────────────────
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

  const commentCount = commentsFetched ? comments.length : undefined;

  return (
    <article className="photo-card">
      {/* ── Header ── */}
      <div className="photo-card-header">
        <div className="photo-card-avatar" aria-hidden="true">
          {avatarLetter(photo.username)}
        </div>
        <div className="photo-card-meta">
          <Link
            to={`/profile/${photo.userId}`}
            className="photo-card-username photo-card-username-link"
          >
            {photo.username}
          </Link>
          <div className="photo-card-time">{relativeTime(photo.createdAt)}</div>
        </div>
      </div>

      {/* ── Image ── */}
      <div className="photo-card-img-wrap">
        <img
          className="photo-card-img"
          src={photo.imageUrl}
          alt={photo.caption || `Photo by ${photo.username}`}
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

      {/* ── Caption ── */}
      {photo.caption && (
        <p className="photo-card-caption">
          <strong>{photo.username}</strong>
          {photo.caption}
        </p>
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
            comments.map((c) => (
              <div key={c.id} className="photo-card-comment-item">
                <Link
                  to={`/profile/${c.userId}`}
                  className="photo-card-comment-username-link"
                >
                  {c.username}
                </Link>
                {c.text}
              </div>
            ))
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
  );
}
