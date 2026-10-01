import { useEffect, useRef, useCallback } from 'react';
import '../styles/confirm-dialog.css';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Set to true while the confirmed async action is in flight */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation dialog modal.
 * Closes on Escape and on backdrop click.
 * The confirm button is styled in --danger red; cancel is a ghost button.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, loading]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current && !loading) onCancel();
    },
    [onCancel, loading]
  );

  return (
    <div
      className="cd-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cd-title"
      aria-describedby="cd-message"
    >
      <div className="cd-card">
        <h2 id="cd-title" className="cd-title">{title}</h2>
        <p id="cd-message" className="cd-message">{message}</p>
        <div className="cd-actions">
          <button
            id="cd-cancel-btn"
            className="cd-cancel-btn"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            id="cd-confirm-btn"
            className="cd-confirm-btn"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="cd-spinner" aria-hidden="true" />
                Deleting…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
