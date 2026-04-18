import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'TerraWatch',
        short_name: 'TerraWatch',
        description: 'Environmental intelligence for where you are and where you are going.',
        theme_color: '#10B981',
        background_color: '#0B1220',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/earthquake\.usgs\.gov\/.*$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'usgs', expiration: { maxAgeSeconds: 60 * 15 } },
          },
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'open-meteo', expiration: { maxAgeSeconds: 60 * 30 } },
          },
          {
            urlPattern: /^https:\/\/services\.swpc\.noaa\.gov\/.*$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'noaa-swpc', expiration: { maxAgeSeconds: 60 * 15 } },
          },
          {
            urlPattern: /^https:\/\/api\.tidesandcurrents\.noaa\.gov\/.*$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'noaa-coops', expiration: { maxAgeSeconds: 60 * 60 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.spec.ts', 'src/**/*.spec.ts'],
  },
})
