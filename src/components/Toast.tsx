import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './toast.css';

export interface ToastData {
  id: string;
  message: string;
  /** In-app path to navigate to when the toast is clicked */
  navigateTo?: string;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const TOAST_DURATION_MS = 4000;

/**
 * Toast — a single auto-dismissing notification at the top of the screen.
 *
 * NOTE: Later this should be driven by the STOMP WebSocket subscription
 * that the backend already supports (/user/queue/messages, MessageResponse shape).
 */
export default function Toast({ toast, onDismiss }: ToastProps) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, TOAST_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, onDismiss]);

  function handleClick() {
    onDismiss(toast.id);
    if (toast.navigateTo) {
      navigate(toast.navigateTo);
    }
  }

  return (
    <div
      className="toast"
      role="alert"
      aria-live="polite"
      onClick={handleClick}
      style={{ cursor: toast.navigateTo ? 'pointer' : 'default' }}
    >
      <span className="toast__icon" aria-hidden="true">💬</span>
      <span className="toast__message">{toast.message}</span>
      <button
        className="toast__close"
        aria-label="Dismiss notification"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
      >
        ✕
      </button>
    </div>
  );
}
