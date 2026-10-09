import { defineConfig, devices } from '@playwright/test'

// Browser checks of the built app (TESTING.md, "Playwright"): sideways scrolling and clipped labels on
// every screen at phone widths, and smoke tests of the main flows. WebKit stands in for the iPhone.
const PORT = 4173

const phones = [
  { name: '375', viewport: { width: 375, height: 812 } },
  { name: '320', viewport: { width: 320, height: 640 } },
]
const browsers = [
  { name: 'webkit', use: devices['Desktop Safari'] },
  { name: 'chromium', use: devices['Desktop Chrome'] },
]

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a flaky test is a race to fix, not to hide.
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The service worker would cache the app between tests; each test starts from a fresh page.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: browsers.flatMap((browser) =>
    phones.map((phone) => ({
      name: `${browser.name}-${phone.name}`,
      use: { ...browser.use, viewport: phone.viewport },
    })),
  ),
  // The production build under the production headers (vite.config.ts applies public/_headers).
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Always a fresh build, never an older preview left running on the port.
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
