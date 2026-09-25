import { useState, useEffect } from 'react';

/**
 * useOnlineStatus — tracks the browser's network connectivity in real time.
 * Subscribes to the 'online' and 'offline' window events and reflects the
 * current state of navigator.onLine.
 *
 * @returns {boolean} true when the browser has network access, false otherwise.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
