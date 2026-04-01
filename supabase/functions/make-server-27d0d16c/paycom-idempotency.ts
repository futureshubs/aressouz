/**
 * Paycom Subscribe: bir xil orderId uchun takroriy receipts.create ni kamaytirish
 * (React Strict Mode / qayta mount / foydalanuvchi «yangilash»).
 */
import * as kv from "./kv_store.tsx";
import {
  checkReceipt,
  paycomDefaultUseTest,
  sumItemsTiyinForPaycom,
  type PaycomCallOpts,
  type PaymeReceiptItem,
} from "./payme.tsx";

export type PaycomOrderPendingRecord = {
  receiptId: string;
  checkoutUrl: string;
  amountTiyin: number;
  useTest: boolean;
  createdAt: string;
  orderId: string;
};

const KEY = (orderId: string) => `paycom_order_pending:${String(orderId).trim()}`;

export type PaycomIdempotencyResult =
  | { action: "create" }
  | {
      action: "reuse";
      record: PaycomOrderPendingRecord;
    }
  | { action: "already_paid"; receiptId: string };

export async function resolvePaycomCreateIdempotency(
  orderId: string,
  items: PaymeReceiptItem[],
  paycomOpts: PaycomCallOpts,
): Promise<PaycomIdempotencyResult> {
  const oid = String(orderId || "").trim();
  if (!oid) return { action: "create" };

  const amountTiyin = sumItemsTiyinForPaycom(items);
  if (!Number.isFinite(amountTiyin) || amountTiyin <= 0) return { action: "create" };

  /** createReceipt bilan bir xil: undefined → env PAYCOM_USE_TEST */
  const useTest =
    paycomOpts.useTest !== undefined ? paycomOpts.useTest : paycomDefaultUseTest();
  const raw = (await kv.get(KEY(oid))) as PaycomOrderPendingRecord | null;
  if (!raw || !raw.receiptId || !raw.checkoutUrl) return { action: "create" };

  if (raw.amountTiyin !== amountTiyin) return { action: "create" };
  if (raw.useTest !== useTest) return { action: "create" };

  const chk = await checkReceipt(raw.receiptId, paycomOpts);
  if (!chk.success) {
    console.warn("[paycom idempotency] receipts.check xato, yangi chek yaratiladi", {
      orderId: oid,
      receiptId: raw.receiptId,
      error: chk.error,
    });
    await kv.del(KEY(oid));
    return { action: "create" };
  }

  if (chk.isPaid) {
    return { action: "already_paid", receiptId: raw.receiptId };
  }
  if (chk.isCancelled) {
    await kv.del(KEY(oid));
    return { action: "create" };
  }

  return { action: "reuse", record: raw };
}

export async function savePaycomOrderPending(record: PaycomOrderPendingRecord): Promise<void> {
  await kv.set(KEY(record.orderId), record);
}

export async function clearPaycomOrderPending(orderId: string): Promise<void> {
  const oid = String(orderId || "").trim();
  if (oid) await kv.del(KEY(oid));
}
