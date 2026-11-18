import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  // Aperçu privé : chemins relatifs, pas de service worker
  base: mode === 'demo' ? './' : '/',
  build: mode === 'demo' ? { outDir: 'dist-demo' } : undefined,
  plugins: [
    react(),
    mode !== 'demo' && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'NIGORA — Sécurité et assistance des voyageurs',
        short_name: 'NIGORA',
        description: 'Préparer ses trajets, alerter en cas d’urgence, partager son profil médical — même hors connexion.',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#050505',
        theme_color: '#050505',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Fonds de carte : servis depuis le cache une fois consultés ou téléchargés → carte hors ligne
            urlPattern: ({ url }) => /(tiles\.openfreemap\.org|arcgisonline\.com|tile\.opentopomap\.org)$/.test(url.hostname) && !url.pathname.endsWith('/planet') && !url.pathname.startsWith('/styles'),
            handler: 'CacheFirst',
            options: { cacheName: 'nigora-tuiles', expiration: { maxEntries: 6000, maxAgeSeconds: 60 * 60 * 24 * 60 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // Styles et TileJSON : réseau d'abord, cache si hors ligne
            urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org' && (url.pathname.endsWith('/planet') || url.pathname.startsWith('/styles')),
            handler: 'NetworkFirst',
            options: { cacheName: 'nigora-styles', networkTimeoutSeconds: 4, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'router.project-osrm.org' || url.hostname === 'nominatim.openstreetmap.org',
            handler: 'NetworkFirst',
            options: { cacheName: 'nigora-itineraires', networkTimeoutSeconds: 6, expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
}))
