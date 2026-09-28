/// <reference lib="webworker" />

/**
 * sw.ts — Custom Service Worker using injectManifest strategy.
 *
 * Compiled by vite-plugin-pwa with strategies: 'injectManifest'.
 * This replaces the auto-generated SW and adds push notification support.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { createHandlerBoundToURL } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// ── 1. Precaching ────────────────────────────────────────────────────────────
// self.__WB_MANIFEST is injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation fallback — serve index.html for any navigation request
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  // Exclude API calls and notification endpoints from the navigation fallback
  denylist: [/^\/api\//],
});
registerRoute(navigationRoute);

// ── 2. Runtime caching ────────────────────────────────────────────────────────

// NetworkFirst for /api/* with 10s timeout and 5-minute cache.
// NEVER cache /api/notifications/* and never cache non-GET requests.
registerRoute(
  ({ url, request }) => {
    // Never cache notification endpoints
    if (url.pathname.startsWith('/api/notifications/')) return false;
    // Only cache GET requests to /api/*
    if (request.method !== 'GET') return false;
    return url.pathname.startsWith('/api/');
  },
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 5 * 60, // 5 minutes
        maxEntries: 50,
      }),
    ],
  })
);

// CacheFirst for images (7-day expiry, max 200 entries)
registerRoute(
  ({ url, request }) => {
    if (request.method !== 'GET') return false;
    // Match image file extensions
    return /\.(?:png|jpg|jpeg|gif|webp|avif|svg)$/i.test(url.pathname);
  },
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        maxEntries: 200,
      }),
    ],
  })
);

// ── 3. Push event ─────────────────────────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  const { title, body, url } = event.data.json() as {
    title: string;
    body: string;
    url: string;
  };

  const showNotification = async () => {
    // Check if the app is already open and focused — if so, skip the notification
    // so the user sees the message live (via polling / future WebSocket).
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    const appIsVisible = clients.some(
      (c) => (c as WindowClient).visibilityState === 'visible' && c.focused
    );

    if (appIsVisible) return;

    await self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
      // Use url as tag so repeated messages from the same person collapse
      tag: url,
    });
  };

  event.waitUntil(showNotification());
});

// ── 4. Notification click event ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl: string = (event.notification.data as { url: string }).url;

  const focusOrOpen = async () => {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    // If an app window is already open, focus it and navigate
    if (clients.length > 0) {
      const client = clients[0] as WindowClient;
      await client.focus();
      await client.navigate(targetUrl);
      return;
    }

    // No window open — open a new one
    await self.clients.openWindow(targetUrl);
  };

  event.waitUntil(focusOrOpen());
});
