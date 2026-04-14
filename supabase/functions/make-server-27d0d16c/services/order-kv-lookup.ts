import * as kv from "../kv_store.tsx";
import { syncRelationalOrderFromLegacy } from "../../_shared/db/orders.ts";

export function getOrderKeys(orderId: string): string[] {
  const raw = String(orderId || "").trim();
  if (!raw) return [];

  if (raw.startsWith("order:market:")) {
    const stripped = raw.slice("order:market:".length);
    return [raw, `order:${stripped}`];
  }
  if (raw.startsWith("order:")) {
    const stripped = raw.slice("order:".length);
    return [raw, `order:market:${stripped}`];
  }
  return [`order:${raw}`, `order:market:${raw}`];
}

export async function getOrderRecord(
  orderId: string,
): Promise<{ key: string; order: unknown } | null> {
  for (const key of getOrderKeys(orderId)) {
    const order = await kv.get(key);
    if (order) {
      return { key, order };
    }
  }
  return null;
}

/** Payme check-receipt / Click COMPLETE: `order:` / `order:market:` yozuvida to‘lovni «paid» + v2 Postgres sinxron. */
export async function markKvOrderPaidFromGateway(
  orderId: string,
  extras: { paymeReceiptId?: string; clickTransId?: string | number },
): Promise<void> {
  const record = await getOrderRecord(orderId);
  if (!record) {
    console.warn("[gateway-paid] buyurtma KV da topilmadi:", orderId);
    return;
  }
  const o = record.order as Record<string, unknown>;
  const nowIso = new Date().toISOString();
  const legacyId = String(o.id ?? orderId);
  const prevPaid = ["paid", "completed", "success"].includes(
    String(o.paymentStatus || "").toLowerCase().trim(),
  );
  const statusHistory = Array.isArray(o.statusHistory) ? [...(o.statusHistory as unknown[])] : [];
  if (!prevPaid) {
    statusHistory.push({
      status: o.status,
      timestamp: nowIso,
      note: "Onlayn to‘lov tasdiqlandi (Payme/Click)",
    });
  }
  const updatedOrder = {
    ...record.order,
    paymentStatus: "paid",
    paymentCompletedAt: nowIso,
    paymentRequiresVerification: false,
    updatedAt: nowIso,
    ...(extras.paymeReceiptId ? { paymeReceiptId: extras.paymeReceiptId } : {}),
    ...(extras.clickTransId != null ? { clickTransId: extras.clickTransId } : {}),
    statusHistory,
  };
  await kv.set(record.key, updatedOrder);

  try {
    const txKey = `transaction:${legacyId}`;
    const tx = await kv.get(txKey);
    if (tx && typeof tx === "object") {
      await kv.set(txKey, { ...tx, status: "paid", paidAt: nowIso });
    }
  } catch (txErr: unknown) {
    console.warn("[gateway-paid] transaction KV:", txErr);
  }

  await syncRelationalOrderFromLegacy({
    legacyOrderId: legacyId,
    kvStatus: String(o.status ?? ""),
    kvPaymentStatus: "paid",
    paymentRequiresVerification: false,
  });
}
