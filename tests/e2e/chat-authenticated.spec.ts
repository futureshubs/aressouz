import { test, expect } from '@playwright/test';
import { edgeFetch, SUPPORT_BRANCH_ID } from './helpers/edgeApi';

const userToken = (process.env.E2E_USER_ACCESS_TOKEN || '').trim();
const branchToken = (process.env.E2E_BRANCH_TOKEN || process.env.E2E_STAFF_BRANCH_TOKEN || '').trim();

test.describe('chat E2E (autentifikatsiya)', () => {
  test.skip(!userToken, 'E2E_USER_ACCESS_TOKEN kerak (.env.local)');

  test('mijoz support chat ro‘yxati va xabar yuborish', async () => {
    const listRes = await edgeFetch('/user/chats', { accessToken: userToken });
    expect(listRes.ok).toBeTruthy();
    const list = await listRes.json();
    expect(list.success).toBe(true);
    const support = (list.chats || []).find(
      (c: { branchId?: string }) => String(c.branchId || '') === SUPPORT_BRANCH_ID,
    );
    expect(support?.id).toBeTruthy();
    const chatId = String(support.id);

    const probe = `e2e-${Date.now()}`;
    const sendRes = await edgeFetch(`/user/chats/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      accessToken: userToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: probe, type: 'text' }),
    });
    expect(sendRes.ok).toBeTruthy();

    const msgRes = await edgeFetch(`/chats/${encodeURIComponent(chatId)}/messages`, {
      branchToken: branchToken || undefined,
    });
    const msgData = await msgRes.json();
    const found = (msgData.messages || []).some((m: { content?: string }) =>
      String(m.content || '').includes(probe),
    );
    expect(found).toBe(true);
  });
});
