import * as kv from "../kv_store.tsx";
import { persistKvOrder } from "./kv-postgres-bridge.ts";

export { persistKvOrder, resyncKvOrderById } from "./kv-postgres-bridge.ts";

export function getOrderKeys(orderId: string): string[] {
  const raw = String(orderId || "").trim();
  if (!raw) return [];

  const keys = new Set<string>();

  if (raw.startsWith("order:market:")) {
    const stripped = raw.slice("order:market:".length);
    keys.add(raw);
    keys.add(`order:${stripped}`);
  } else if (raw.startsWith("order:")) {
    const stripped = raw.slice("order:".length);
    keys.add(raw);
    keys.add(`order:market:${stripped}`);
    /** Eski taom/market: `kv.set(\`order:${order.id}\`, ...)` — id allaqachon `order:...` */
    keys.add(`order:${raw}`);
  } else {
    keys.add(`order:${raw}`);
    keys.add(`order:market:${raw}`);
  }

  return Array.from(keys).filter(Boolean);
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

  const keysToWrite = new Set<string>([...getOrderKeys(legacyId), String(record.key)]);
  const mirror = String((o as { foodOrderMirrorKey?: string }).foodOrderMirrorKey || "").trim();
  if (mirror) keysToWrite.add(mirror);

  const mergedOrders: Record<string, unknown>[] = [];

  for (const key of keysToWrite) {
    const existingRaw = await kv.get(key);
    if (!existingRaw || typeof existingRaw !== "object") continue;
    const eo = existingRaw as Record<string, unknown>;
    const eoPrevPaid = ["paid", "completed", "success"].includes(
      String(eo.paymentStatus || "").toLowerCase().trim(),
    );
    const sh = Array.isArray(eo.statusHistory) ? [...(eo.statusHistory as unknown[])] : [];
    if (!eoPrevPaid) {
      sh.push({
        status: eo.status,
        timestamp: nowIso,
        note: "Onlayn to‘lov tasdiqlandi (Payme/Click)",
      });
    }
    const merged = {
      ...eo,
      paymentStatus: "paid",
      paymentCompletedAt: nowIso,
      paymentRequiresVerification: false,
      updatedAt: nowIso,
      ...(extras.paymeReceiptId ? { paymeReceiptId: extras.paymeReceiptId } : {}),
      ...(extras.clickTransId != null ? { clickTransId: extras.clickTransId } : {}),
      statusHistory: sh,
    };
    mergedOrders.push(merged);
  }

  const primary = mergedOrders[0] ||
    ({
      ...o,
      paymentStatus: "paid",
      paymentCompletedAt: nowIso,
      paymentRequiresVerification: false,
      updatedAt: nowIso,
    } as Record<string, unknown>);

  await persistKvOrder(primary, record.key);

  try {
    const txKey = `transaction:${legacyId}`;
    const tx = await kv.get(txKey);
    if (tx && typeof tx === "object") {
      await kv.set(txKey, { ...tx, status: "paid", paidAt: nowIso });
    }
  } catch (txErr: unknown) {
    console.warn("[gateway-paid] transaction KV:", txErr);
  }
}
