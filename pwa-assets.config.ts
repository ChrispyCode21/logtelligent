import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the PWA icons from public/logo.svg: `npx pwa-assets-generator`.
// Apple and maskable icons are full-bleed brand blue; the OS applies its own mask.
const fullBleed = { padding: 0, resizeOptions: { background: '#2f6fde' } }

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { ...minimal2023Preset.apple, ...fullBleed },
    maskable: { ...minimal2023Preset.maskable, ...fullBleed },
  },
  images: ['public/logo.svg'],
})
