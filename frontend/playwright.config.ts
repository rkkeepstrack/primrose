import { defineConfig, devices } from '@playwright/test';

// Runs against the production build so the screenshots match what ships.
// Meant to run inside mcr.microsoft.com/playwright (see the Makefile): fonts
// and the browser build are pinned there, which is what makes pixels
// comparable between a laptop and the pipeline.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
  expect: {
    // the default per-pixel tolerance (0.2) waves through subtle tints like
    // the heatmap or a dirty Save button; a tight one makes colour changes count
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', threshold: 0.02, maxDiffPixelRatio: 0.001 },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
