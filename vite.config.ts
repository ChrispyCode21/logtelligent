import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Cloudflare Pages serves the app from /. Set BASE_PATH only to host it under a sub-path.
const base = process.env.BASE_PATH ?? '/'

/** The "/*" block of public/_headers, so `vite preview` runs under the production policy. */
function productionHeaders(): Record<string, string> {
  const block =
    readFileSync('public/_headers', 'utf8')
      .split(/^\/\*\s*$/m)[1]
      ?.split(/^\S/m)[0] ?? ''
  const headers = Object.fromEntries(
    block
      .split('\n')
      .map((line) => line.trim().match(/^([\w-]+):\s*(.+)$/))
      .filter((m) => m !== null)
      .map((m) => [m[1], m[2]]),
  )
  // HSTS on localhost would pin the browser to https for every local port.
  delete headers['Strict-Transport-Security']
  return headers
}

// https://vite.dev/config/
export default defineConfig({
  base,
  preview: { headers: productionHeaders() },
  plugins: [
    react(),
    // Installable + offline (SPEC §2): a web app manifest, and a service worker that
    // precaches the built app so it opens with no signal. Data is in IndexedDB, not the cache.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'Logtelligent',
        short_name: 'Logtelligent',
        description: 'A lifting log that suggests your next weights and reps from your own history.',
        theme_color: '#2f6fde',
        background_color: '#141414',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
