import { test, expect } from '@playwright/test';
import { edgeFetch, SUPPORT_BRANCH_ID } from './helpers/edgeApi';

test.describe('chat API (deployed edge)', () => {
  test('health / test-deployment javob beradi', async () => {
    const res = await edgeFetch('/test-deployment');
    expect(res.status).toBeLessThan(500);
    const data = await res.json().catch(() => ({}));
    expect(data.success ?? data.message).toBeTruthy();
  });

  test('filial chat ro‘yxati: branchId bo‘lmasa 400', async () => {
    const res = await edgeFetch('/chats');
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(String(data.error || '')).toMatch(/branchId/i);
  });

  test('support filial chat ro‘yxati: success + chats massivi', async () => {
    const res = await edgeFetch(`/chats?branchId=${encodeURIComponent(SUPPORT_BRANCH_ID)}`);
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.chats)).toBe(true);
  });

  test('support chat xabarlari: content maydoni bor (birinchi suhbat)', async () => {
    const listRes = await edgeFetch(`/chats?branchId=${encodeURIComponent(SUPPORT_BRANCH_ID)}`);
    const list = await listRes.json();
    const chatId = list?.chats?.[0]?.id;
    test.skip(!chatId, 'Support chat yo‘q — KV da suhbat yo‘q');

    const msgRes = await edgeFetch(`/chats/${encodeURIComponent(chatId)}/messages`);
    expect(msgRes.ok).toBeTruthy();
    const msgData = await msgRes.json();
    expect(msgData.success).toBe(true);
    expect(Array.isArray(msgData.messages)).toBe(true);
    if (msgData.messages.length > 0) {
      const first = msgData.messages[0];
      const text = String(first.content ?? first.text ?? first.message ?? '').trim();
      const hasBody =
        text.length > 0 ||
        String(first.type || '') === 'image' ||
        Boolean(first.imageUrl || first.mediaUrl);
      expect(hasBody).toBe(true);
    }
  });

  test('mijoz /user/chats: tokensiz 401', async () => {
    const res = await edgeFetch('/user/chats');
    expect(res.status).toBe(401);
  });
});
