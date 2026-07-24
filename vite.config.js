import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        navigateFallback: 'index.html',
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'ClassLedger',
        short_name: 'ClassLedger',
        description: 'Classroom Finance Tracker',
        theme_color: '#1E3A5F',
        background_color: '#f1f5f9',
        display: 'standalone',
        scope: '/classledger/',
        start_url: '/classledger/',
        icons: [
          {
            src: 'web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  base: '/classledger/',
});