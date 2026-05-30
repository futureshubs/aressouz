import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

function loadDotEnvLocal() {
  const path = join(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnvLocal();

/**
 * E2E: `PLAYWRIGHT_BASE_URL=https://staging...` qo‘yilganda ishlaydi.
 * Mahalliy: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_START_DEV=1 npm run test:e2e`
 */
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://aresso.app',
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
