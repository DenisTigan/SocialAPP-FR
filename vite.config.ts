import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Luminary',
        short_name: 'Luminary',
        description: 'A social media app to share photos and connect with others',
        theme_color: '#0F0F1A',
        background_color: '#0F0F1A',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache all static assets (JS, CSS, HTML, fonts) — default behaviour
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff,woff2}'],
        runtimeCaching: [
          {
            // NetworkFirst for API calls: always try network, fall back to cache
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxAgeSeconds: 5 * 60, // 5 minutes
                maxEntries: 50,
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // CacheFirst for images (avatars, photo uploads): photos don't change
            urlPattern: /\.(?:png|jpg|jpeg|gif|webp|avif|svg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                maxEntries: 200,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})

