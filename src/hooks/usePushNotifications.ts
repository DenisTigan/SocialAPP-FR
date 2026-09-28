import { useState, useEffect, useCallback } from 'react';
import { getVapidPublicKey, subscribePush, unsubscribePush } from '../api/notifications';

// ── Helper: base64url → Uint8Array ────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── iOS detection ─────────────────────────────────────────────────────────────
function isIOS(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports as "MacIntel" with touch
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isInStandaloneMode(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
}

export interface UsePushNotificationsResult {
  /** Browser supports service worker, PushManager, and Notification API */
  isSupported: boolean;
  /** iOS device that has NOT been added to the Home Screen yet */
  needsInstall: boolean;
  /** Current Notification.permission value */
  permission: NotificationPermission;
  /** True if this device currently has an active push subscription */
  isSubscribed: boolean;
  loading: boolean;
  error: string | null;
  /** Call from a user click to enable push. Requests permission, subscribes to push, sends sub to backend. */
  enable: () => Promise<void>;
  /** Unsubscribes from push on backend and in the browser. */
  disable: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const ios = isIOS();
  const standalone = isInStandaloneMode();

  // On iOS, push only works in standalone (Home Screen) mode
  const needsInstall = ios && !standalone;

  // Full support check: service worker + PushManager + Notification + not iOS-without-install
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !needsInstall;

  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Check existing subscription on mount ──────────────────────────────────
  useEffect(() => {
    if (!isSupported) return;

    async function checkSubscription() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(sub !== null);
      } catch {
        // Silently ignore — not subscribed
        setIsSubscribed(false);
      }
    }

    checkSubscription();
  }, [isSupported]);

  // ── Enable push ────────────────────────────────────────────────────────────
  const enable = useCallback(async () => {
    if (!isSupported) return;
    setLoading(true);
    setError(null);

    try {
      // Step 1: Request notification permission if not already granted
      let currentPermission = Notification.permission;
      if (currentPermission === 'default') {
        currentPermission = await Notification.requestPermission();
      }
      setPermission(currentPermission);

      if (currentPermission !== 'granted') {
        setLoading(false);
        return;
      }

      // Step 2: Get VAPID public key and subscribe to push
      const reg = await navigator.serviceWorker.ready;
      const vapidPublicKey = await getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Step 3: Send subscription to backend
      const subJson = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      try {
        await subscribePush({
          endpoint: subJson.endpoint,
          keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
        });
        setIsSubscribed(true);
      } catch (backendErr) {
        // If backend registration fails, unsubscribe the browser subscription too
        // so states stay consistent
        await subscription.unsubscribe();
        throw backendErr;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enable push notifications';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  // ── Disable push ───────────────────────────────────────────────────────────
  const disable = useCallback(async () => {
    if (!isSupported) return;
    setLoading(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      await unsubscribePush(subscription.endpoint);
      await subscription.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disable push notifications';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    needsInstall,
    permission,
    isSubscribed,
    loading,
    error,
    enable,
    disable,
  };
}
