import type { Hono } from "npm:hono";
import {
  createMarketplaceOrder,
  linkLegacyOrderKeysToRelational,
} from "../../_shared/db/orders.ts";
import { resolveV2IdentityFromRequest } from "../relational-auth.ts";
import { resyncKvOrderById } from "../services/order-kv-lookup.ts";

export type KvSyncRouteDeps = {
  validateAccessToken: (
    c: any,
  ) => Promise<{ success: boolean; userId?: string; error?: string }>;
  validateAdminSession?: (
    c: any,
  ) => Promise<{ success: boolean; error?: string }>;
};

let deps: KvSyncRouteDeps | null = null;

const cronSecretOk = (c: any): boolean => {
  const expected = String(Deno.env.get("KV_SYNC_CRON_SECRET") || "").trim();
  if (!expected) return false;
  const got = c.req.header("X-KV-Sync-Secret") || c.req.header("x-kv-sync-secret") ||
    "";
  return got === expected;
};

/**
 * Checkout dan keyin: KV buyurtma id bilan relational buyurtma yaratish + legacy_kv_map.
 * Frontend `syncMarketplaceV2Order` bilan bir xil maqsad, serverda ishonchli.
 */
export function registerKvSyncRoutes(app: Hono, routeDeps: KvSyncRouteDeps) {
  deps = routeDeps;

  app.post("/make-server-27d0d16c/sync/marketplace-v2-order", async (c) => {
    try {
      if (!deps) return c.json({ error: "KV sync not initialized" }, 500);

      const auth = await deps.validateAccessToken(c);
      if (!auth.success || !auth.userId) {
        return c.json({ success: false, error: auth.error }, 401);
      }

      const body = await c.req.json().catch(() => ({}));
      const legacyOrderId = String(
        body?.legacy_order_id || body?.legacyOrderId || "",
      ).trim();
      if (!legacyOrderId) {
        return c.json({ success: false, error: "legacy_order_id kerak" }, 400);
      }

      const identity = await resolveV2IdentityFromRequest(c.req.raw);
      const relationalOrderId = await createMarketplaceOrder({
        ...identity,
        currency_code: body?.currency_code,
        source_channel: body?.source_channel || "kv_bridge",
        promo_code: body?.promo_code,
        bonus_used_amount: body?.bonus_used_amount,
        buyer_note: body?.buyer_note,
        payment_requires_verification: body?.payment_requires_verification,
        shipping_address: body?.shipping_address,
        billing_address: body?.billing_address,
        groups: Array.isArray(body?.groups) ? body.groups : [],
        payment: body?.payment || null,
      });

      const primaryKvKey = String(body?.legacy_kv_key || body?.kv_key || "")
        .trim() ||
        (legacyOrderId.startsWith("order:") ? legacyOrderId : `order:${legacyOrderId}`);

      await linkLegacyOrderKeysToRelational({
        legacyOrderId,
        relationalOrderId: String(relationalOrderId),
        primaryKvKey,
        payload: body?.kv_snapshot || null,
      });

      return c.json({
        success: true,
        relationalOrderId,
        legacyOrderId,
        linked: true,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn("[sync/marketplace-v2-order]", msg);
      return c.json({ success: false, error: msg }, 400);
    }
  });

  app.post("/make-server-27d0d16c/sync/kv-order/:orderId", async (c) => {
    try {
      if (!deps) return c.json({ error: "KV sync not initialized" }, 500);

      const orderId = decodeURIComponent(c.req.param("orderId") || "").trim();
      if (!orderId) return c.json({ success: false, error: "orderId kerak" }, 400);

      const cronOk = cronSecretOk(c);
      if (!cronOk) {
        const auth = await deps.validateAccessToken(c);
        const admin = deps.validateAdminSession
          ? await deps.validateAdminSession(c)
          : { success: false };
        if (!auth.success && !admin.success) {
          return c.json({ success: false, error: "Unauthorized" }, 401);
        }
      }

      const result = await resyncKvOrderById(orderId);
      if (!result.found) {
        return c.json({ success: false, error: "KV buyurtma topilmadi" }, 404);
      }

      return c.json({
        success: true,
        orderId,
        synced: result.sync.synced,
        relationalOrderId: result.sync.relationalOrderId,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.post("/make-server-27d0d16c/sync/kv-orders-batch", async (c) => {
    try {
      if (!cronSecretOk(c)) {
        return c.json({ success: false, error: "Forbidden" }, 403);
      }

      const body = await c.req.json().catch(() => ({}));
      const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);
      const prefix = String(body?.prefix || "order:");

      const { getByPrefixWithKeys } = await import("../kv_store.tsx");
      const rows = await getByPrefixWithKeys(prefix);
      const slice = rows.slice(0, limit);

      const results: Array<{
        key: string;
        synced: boolean;
        relationalOrderId: string | null;
      }> = [];

      for (const { key, value } of slice) {
        const oid = String((value as { id?: string })?.id || key).trim();
        const r = await resyncKvOrderById(oid);
        results.push({
          key,
          synced: r.sync.synced,
          relationalOrderId: r.sync.relationalOrderId,
        });
      }

      return c.json({
        success: true,
        processed: results.length,
        syncedCount: results.filter((r) => r.synced).length,
        results,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: msg }, 500);
    }
  });
}
