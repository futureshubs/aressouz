/**
 * KV (kv_store_27d0d16c) ↔ relational marketplace (orders, users, …) birlashtirish.
 * Har bir buyurtma KV yozuvidan keyin Postgres holati yangilanadi.
 */

import * as kv from "../kv_store.tsx";
import {
  getOrderKeys,
  getOrderRecord,
} from "./order-kv-lookup.ts";
import {
  linkLegacyOrderKeysToRelational,
  syncRelationalOrderFromLegacy,
} from "../../_shared/db/orders.ts";

export type KvOrderLike = Record<string, unknown>;

function orderLegacyId(order: KvOrderLike, fallbackKey?: string): string {
  const id = String(order?.id ?? "").trim();
  if (id) return id;
  const key = String(fallbackKey || "").trim();
  if (!key) return "";
  return key
    .replace(/^order:market:/, "")
    .replace(/^order:/, "")
    .replace(/^shop_order:/, "");
}

/**
 * Barcha mos KV kalitlarga yozadi va Postgres bilan sinxronlaydi.
 */
export async function persistKvOrder(
  order: KvOrderLike,
  primaryKey?: string,
): Promise<{ keys: string[]; sync: { synced: boolean; relationalOrderId: string | null } }> {
  const legacyId = orderLegacyId(order, primaryKey);
  const keysToWrite = new Set<string>();

  if (primaryKey) keysToWrite.add(primaryKey);
  if (legacyId) {
    for (const k of getOrderKeys(legacyId)) keysToWrite.add(k);
  }

  const mirror = String((order as { foodOrderMirrorKey?: string }).foodOrderMirrorKey || "")
    .trim();
  if (mirror) keysToWrite.add(mirror);

  const keys = Array.from(keysToWrite).filter(Boolean);
  for (const key of keys) {
    await kv.set(key, order);
  }

  const sync = legacyId
    ? await syncRelationalOrderFromLegacy({
      legacyOrderId: legacyId,
      kvStatus: String(order.status ?? ""),
      kvPaymentStatus: String(order.paymentStatus ?? "pending"),
      paymentRequiresVerification: order.paymentStatus === "paid"
        ? false
        : Boolean(order.paymentRequiresVerification),
      kvKey: primaryKey || keys[0] || null,
      kvPayload: order,
    })
    : { synced: false, relationalOrderId: null };

  return { keys, sync };
}

/** Mavjud KV buyurtmani Postgres ga qayta sinxronlash (admin / cron) */
export async function resyncKvOrderById(orderId: string): Promise<{
  found: boolean;
  sync: { synced: boolean; relationalOrderId: string | null };
}> {
  const record = await getOrderRecord(orderId);
  if (!record?.order || typeof record.order !== "object") {
    return { found: false, sync: { synced: false, relationalOrderId: null } };
  }

  const order = record.order as KvOrderLike;
  const legacyId = orderLegacyId(order, record.key);
  const sync = await syncRelationalOrderFromLegacy({
    legacyOrderId: legacyId || orderId,
    kvStatus: String(order.status ?? ""),
    kvPaymentStatus: String(order.paymentStatus ?? "pending"),
    paymentRequiresVerification: order.paymentStatus === "paid"
      ? false
      : Boolean(order.paymentRequiresVerification),
    kvKey: record.key,
    kvPayload: order,
  });

  return { found: true, sync };
}

export { linkLegacyOrderKeysToRelational };
