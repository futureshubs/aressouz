import { defineConfig } from '@playwright/test';

/**
 * E2E: `PLAYWRIGHT_BASE_URL=https://staging...` qo‘yilganda ishlaydi.
 * Mahalliy: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_START_DEV=1 npm run test:e2e`
 */
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer:
    process.env.PLAYWRIGHT_START_DEV === '1'
      ? {
          command: 'npm run dev',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: !process.env.CI,
        }
      : undefined,
});
