/**
 * Bir nechta buyurtma bitta onlayn to‘lov (Payme/Click) bilan bog‘lanishi:
 * `checkoutBatchId` (masalan chk_*) — to‘lov provayderidagi merchant_trans_id / Payme orderId.
 */
import * as kv from './kv_store.tsx';

export type PaymentCheckoutBatchRecord = {
  orderIds: string[];
  userId: string;
  createdAt: string;
};

export const paymentCheckoutBatchKvKey = (batchId: string) =>
  `payment_checkout_batch:${String(batchId || '').trim()}`;

export async function appendOrderToPaymentCheckoutBatch(
  batchId: string,
  orderId: string,
  userId: string,
): Promise<void> {
  const bid = String(batchId || '').trim();
  const oid = String(orderId || '').trim();
  const uid = String(userId || '').trim();
  if (!bid || !oid) return;
  const key = paymentCheckoutBatchKvKey(bid);
  const prev = (await kv.get(key)) as PaymentCheckoutBatchRecord | null;
  const orderIds = Array.isArray(prev?.orderIds) ? [...prev.orderIds] : [];
  if (!orderIds.includes(oid)) orderIds.push(oid);
  await kv.set(key, {
    orderIds,
    userId: prev?.userId || uid || 'unknown',
    createdAt: prev?.createdAt || new Date().toISOString(),
  });
}

export async function getPaymentCheckoutBatch(
  batchId: string,
): Promise<PaymentCheckoutBatchRecord | null> {
  const bid = String(batchId || '').trim();
  if (!bid) return null;
  const raw = (await kv.get(paymentCheckoutBatchKvKey(bid))) as PaymentCheckoutBatchRecord | null;
  if (!raw || !Array.isArray(raw.orderIds) || raw.orderIds.length === 0) return null;
  return raw;
}
