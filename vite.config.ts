import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Switch to injectManifest so we can write our own service worker (src/sw.ts)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
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
      // injectManifest mode: configuration for the manifest injection
      injectManifest: {
        // Precache all static assets (JS, CSS, HTML, fonts, icons)
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff,woff2}'],
        // Exclude notification-related API paths from precache
        // (runtime caching in sw.ts handles API with NetworkFirst)
        globIgnores: ['**/node_modules/**'],
      },
    }),
  ],
  // Polyfill Node.js globals that sockjs-client expects but browsers don't have.
  // 'global' → 'globalThis' is the standard fix for the Vite + sockjs-client blank-screen issue.
  define: {
    global: 'globalThis',
    'process.env': {},
  },
})
