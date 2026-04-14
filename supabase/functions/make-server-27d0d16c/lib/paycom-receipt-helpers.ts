import * as kv from "../kv_store.tsx";
import { paycomDefaultUseTest } from "../payme.tsx";

export async function paycomCallOptsForReceiptId(receiptId: string) {
  try {
    const meta = (await kv.get(`paycom_receipt:${receiptId}`)) as { useTest?: boolean } | null;
    return typeof meta?.useTest === "boolean" ? { useTest: meta.useTest } : undefined;
  } catch (e) {
    console.error("[paycom] paycom_receipt KV o‘qilmadi, PAYCOM_USE_TEST ishlatiladi:", e);
    return undefined;
  }
}

export async function paycomCallOptsForReceiptIdWithKv(receiptId: string) {
  const fromReceipt = await paycomCallOptsForReceiptId(receiptId);
  const useTest =
    typeof fromReceipt?.useTest === "boolean"
      ? fromReceipt.useTest
      : paycomDefaultUseTest();
  return { useTest };
}

export function paymeCheckoutOrderKvKey(orderId: string): string {
  return `payme_checkout_order:${String(orderId).trim()}`;
}

export function logPaymeHttp(tag: string, raw: Record<string, unknown>): void {
  console.log(`[payme/http] ${tag}`, {
    orderId: raw.orderId,
    amount: raw.amount,
    itemsCount: Array.isArray(raw.items) ? raw.items.length : 0,
    phone: raw.phone ? "[set]" : undefined,
    returnUrlPreview:
      typeof raw.returnUrl === "string" ? String(raw.returnUrl).slice(0, 80) : undefined,
  });
}
