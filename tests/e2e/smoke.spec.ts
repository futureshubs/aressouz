import { test, expect } from '@playwright/test';

const base = (process.env.PLAYWRIGHT_BASE_URL || '').trim();

test.skip(!base, 'PLAYWRIGHT_BASE_URL o‘rnatilmagan (staging yoki mahalliy URL)');

test.describe('smoke', () => {
  test('root yuklanadi va #root mavjud', async ({ page }) => {
    await page.goto(base.replace(/\/$/, '') + '/');
    await expect(page.locator('#root')).toBeVisible({ timeout: 30_000 });
  });
});
