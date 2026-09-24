import { useState, useEffect, useCallback, useRef } from 'react';
import type { PhotoResponse } from '../types/api';
import { getFeed } from '../api/photos';
import { useAuth } from '../context/AuthContext';
import PhotoCard from '../components/PhotoCard';
import UploadModal from '../components/UploadModal';
import '../styles/feed.css';

const PAGE_SIZE = 10;

type LoadState = 'idle' | 'loading' | 'error';

export default function Feed() {
  const { user } = useAuth();

  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [page, setPage] = useState(0);
  const [isLast, setIsLast] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [pageLoadState, setPageLoadState] = useState<LoadState>('idle'); // next-page loading
  const [uploadOpen, setUploadOpen] = useState(false);

  // Sentinel ref for IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false); // prevent double-fetch

  // ── Initial load ───────────────────────────────────────────────────────────
  const fetchInitial = useCallback(async () => {
    setLoadState('loading');
    try {
      const data = await getFeed(0, PAGE_SIZE);
      setPhotos(data.content);
      setPage(0);
      setIsLast(data.last);
      setLoadState('idle');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // ── Fetch next page ────────────────────────────────────────────────────────
  const fetchNextPage = useCallback(async () => {
    if (isFetchingRef.current || isLast) return;
    isFetchingRef.current = true;
    setPageLoadState('loading');
    try {
      const nextPage = page + 1;
      const data = await getFeed(nextPage, PAGE_SIZE);
      setPhotos((prev) => {
        // Deduplicate by id in case of concurrent triggers
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = data.content.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newItems];
      });
      setPage(nextPage);
      setIsLast(data.last);
      setPageLoadState('idle');
    } catch {
      setPageLoadState('error');
    } finally {
      isFetchingRef.current = false;
    }
  }, [page, isLast]);

  // ── IntersectionObserver for infinite scroll ───────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLast && loadState === 'idle') {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, isLast, loadState]);

  // ── Like toggle callback (keeps photos list in sync) ─────────────────────
  const handleLikeToggle = useCallback(
    (photoId: string, liked: boolean, newCount: number) => {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? { ...p, isLikedByCurrentUser: liked, likeCount: newCount }
            : p
        )
      );
    },
    []
  );

  // ── Upload success: prepend new photo ─────────────────────────────────────
  const handleUploaded = useCallback((photo: PhotoResponse) => {
    setPhotos((prev) => [photo, ...prev]);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="feed-page">
      {/* Sub-header: New post action only (Navbar handles brand + logout) */}
      <div className="feed-subheader">
        {user && (
          <button
            id="new-post-btn"
            className="feed-new-post-btn"
            onClick={() => setUploadOpen(true)}
          >
            <span aria-hidden="true">＋</span>
            New post
          </button>
        )}
      </div>

      {/* Feed column */}
      <main className="feed-column">
        {/* ── Initial loading ── */}
        {loadState === 'loading' && (
          <div className="feed-spinner-wrap" aria-label="Loading feed">
            <div className="feed-spinner" />
          </div>
        )}

        {/* ── Initial error ── */}
        {loadState === 'error' && (
          <div className="feed-error-state" role="alert">
            <p>Failed to load the feed. Check your connection and try again.</p>
            <button id="feed-retry-btn" className="feed-retry-btn" onClick={fetchInitial}>
              Retry
            </button>
          </div>
        )}

        {/* ── Empty state ── */}
        {loadState === 'idle' && photos.length === 0 && (
          <div className="feed-empty-state">
            <div className="feed-empty-icon" aria-hidden="true">📸</div>
            <h2>No posts yet</h2>
            <p>Be the first to share a moment!</p>
          </div>
        )}

        {/* ── Photo list ── */}
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onLikeToggle={handleLikeToggle}
          />
        ))}

        {/* ── Infinite scroll sentinel & next-page spinner ── */}
        {loadState === 'idle' && (
          <>
            {pageLoadState === 'loading' && (
              <div className="feed-load-more-spinner">
                <div className="feed-spinner" aria-label="Loading more posts" />
              </div>
            )}
            {isLast && photos.length > 0 && (
              <p className="feed-end-label">· You're all caught up ·</p>
            )}
            <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
          </>
        )}
      </main>

      {/* Upload modal */}
      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}
