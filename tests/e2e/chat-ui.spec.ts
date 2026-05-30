import { test, expect } from '@playwright/test';

const base =
  (process.env.PLAYWRIGHT_BASE_URL || 'https://aresso.app').trim();

test.describe('chat UI smoke', () => {

  test('support panel: chat tab DOM (login sahifasidan keyin)', async ({ page }) => {
    await page.goto(`${base.replace(/\/$/, '')}/support`);
    await expect(page.locator('#root')).toBeVisible({ timeout: 30_000 });
    const hasLogin =
      (await page.getByRole('button', { name: /kirish|login/i }).count()) > 0 ||
      (await page.locator('input[type="password"]').count()) > 0;
    expect(hasLogin).toBeTruthy();
  });

  test('filial panel: root yuklanadi', async ({ page }) => {
    await page.goto(`${base.replace(/\/$/, '')}/filyal`);
    await expect(page.locator('#root')).toBeVisible({ timeout: 30_000 });
  });
});
