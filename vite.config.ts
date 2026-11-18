import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
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
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
      },
    }),
  ],
})
