import type { Hono } from "npm:hono";
import * as eskiz from "./eskiz-sms.tsx";
import { SMS_OPERATOR_RATES, currentBillingMonth } from "../_shared/smsOperatorRates.ts";
import {
  billingSummaryForApi,
  getSmsMonthlyBilling,
  setSmsBillingPaid,
} from "./sms-billing.ts";

type Deps = {
  kv: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: unknown) => Promise<void>;
    getByPrefix: (prefix: string) => Promise<any[]>;
  };
  validateSellerSession?: (c: any) => Promise<any>;
  resolveRestaurantForDebt?: (id: string) => Promise<{ id: string; record: Record<string, unknown> } | null>;
  validateBranchSession?: (c: any, branchId: string) => Promise<{ ok: boolean; error?: string }>;
  listBranchShops?: (branchId: string) => Promise<Array<{ id: string; name: string }>>;
};

function parseMonth(raw: string | undefined): string {
  const m = String(raw || "").trim();
  if (/^\d{4}-\d{2}$/.test(m)) return m;
  return currentBillingMonth();
}

export function registerSmsBillingRoutes(app: Hono, deps: Deps) {
  const { kv, validateSellerSession, resolveRestaurantForDebt, validateBranchSession, listBranchShops } = deps;

  app.get("/make-server-27d0d16c/seller/sms-billing", async (c) => {
    try {
      if (!validateSellerSession) return c.json({ success: false, error: "Auth yo'q" }, 500);
      const auth = await validateSellerSession(c);
      if (!auth.success) return c.json({ success: false, error: auth.error }, 401);
      const month = parseMonth(c.req.query("month"));
      const rec = await getSmsMonthlyBilling(kv, "shop", auth.shopId, month, auth.shopName);
      return c.json({
        success: true,
        rates: SMS_OPERATOR_RATES,
        billing: billingSummaryForApi(rec),
        smsConfigured: eskiz.isEskizConfigured(),
      });
    } catch (e: any) {
      console.error("[seller/sms-billing]", e);
      return c.json({ success: false, error: "SMS hisob yuklanmadi" }, 500);
    }
  });

  app.post("/make-server-27d0d16c/seller/sms-billing/pay", async (c) => {
    try {
      if (!validateSellerSession) return c.json({ success: false, error: "Auth yo'q" }, 500);
      const auth = await validateSellerSession(c);
      if (!auth.success) return c.json({ success: false, error: auth.error }, 401);
      const body = await c.req.json().catch(() => ({}));
      const month = parseMonth(body?.month);
      const paid = body?.paid !== false;
      const rec = await setSmsBillingPaid(kv, "shop", auth.shopId, month, paid);
      return c.json({ success: true, billing: billingSummaryForApi(rec) });
    } catch (e: any) {
      console.error("[seller/sms-billing/pay]", e);
      return c.json({ success: false, error: "Saqlanmadi" }, 500);
    }
  });

  app.get("/make-server-27d0d16c/branch/:branchId/sms-billing", async (c) => {
    try {
      const branchId = String(c.req.param("branchId") || "").trim();
      if (validateBranchSession) {
        const gate = await validateBranchSession(c, branchId);
        if (!gate.ok) return c.json({ success: false, error: gate.error || "Ruxsat yo'q" }, 403);
      }
      const month = parseMonth(c.req.query("month"));
      const shops = listBranchShops ? await listBranchShops(branchId) : [];
      const shopBillings = [];
      let totalCostUzs = 0;
      let totalCount = 0;
      let allPaid = shops.length > 0;
      for (const shop of shops) {
        const rec = await getSmsMonthlyBilling(kv, "shop", shop.id, month, shop.name);
        const summary = billingSummaryForApi(rec);
        shopBillings.push({ shopId: shop.id, shopName: shop.name, billing: summary });
        totalCostUzs += summary.totalCostUzs;
        totalCount += summary.totalCount;
        if (!summary.paid) allPaid = false;
      }
      return c.json({
        success: true,
        month,
        rates: SMS_OPERATOR_RATES,
        shops: shopBillings,
        branchTotal: { totalCount, totalCostUzs, allPaid },
        smsConfigured: eskiz.isEskizConfigured(),
      });
    } catch (e: any) {
      console.error("[branch/sms-billing]", e);
      return c.json({ success: false, error: "SMS hisob yuklanmadi" }, 500);
    }
  });

  app.post("/make-server-27d0d16c/branch/:branchId/sms-billing/pay", async (c) => {
    try {
      const branchId = String(c.req.param("branchId") || "").trim();
      if (validateBranchSession) {
        const gate = await validateBranchSession(c, branchId);
        if (!gate.ok) return c.json({ success: false, error: gate.error || "Ruxsat yo'q" }, 403);
      }
      const body = await c.req.json().catch(() => ({}));
      const month = parseMonth(body?.month);
      const paid = body?.paid !== false;
      const shopId = String(body?.shopId || "").trim();
      if (!shopId) return c.json({ success: false, error: "shopId kerak" }, 400);
      const rec = await setSmsBillingPaid(kv, "shop", shopId, month, paid);
      return c.json({ success: true, billing: billingSummaryForApi(rec) });
    } catch (e: any) {
      console.error("[branch/sms-billing/pay]", e);
      return c.json({ success: false, error: "Saqlanmadi" }, 500);
    }
  });
}

export function registerRestaurantSmsBillingRoutes(
  app: Hono,
  deps: { kv: Deps["kv"]; resolveRestaurantForDebt: Deps["resolveRestaurantForDebt"] },
) {
  const { kv, resolveRestaurantForDebt } = deps;
  if (!resolveRestaurantForDebt) return;

  app.get("/restaurants/:restaurantId/sms-billing", async (c) => {
    try {
      const hit = await resolveRestaurantForDebt(c.req.param("restaurantId"));
      if (!hit) return c.json({ success: false, error: "Restoran topilmadi" }, 404);
      const month = parseMonth(c.req.query("month"));
      const name = String((hit.record as any)?.name || "Restoran");
      const rec = await getSmsMonthlyBilling(kv, "restaurant", hit.id, month, name);
      return c.json({
        success: true,
        rates: SMS_OPERATOR_RATES,
        billing: billingSummaryForApi(rec),
        smsConfigured: eskiz.isEskizConfigured(),
      });
    } catch (e: any) {
      console.error("[restaurant/sms-billing]", e);
      return c.json({ success: false, error: "SMS hisob yuklanmadi" }, 500);
    }
  });

  app.post("/restaurants/:restaurantId/sms-billing/pay", async (c) => {
    try {
      const hit = await resolveRestaurantForDebt(c.req.param("restaurantId"));
      if (!hit) return c.json({ success: false, error: "Restoran topilmadi" }, 404);
      const body = await c.req.json().catch(() => ({}));
      const month = parseMonth(body?.month);
      const paid = body?.paid !== false;
      const rec = await setSmsBillingPaid(kv, "restaurant", hit.id, month, paid);
      return c.json({ success: true, billing: billingSummaryForApi(rec) });
    } catch (e: any) {
      console.error("[restaurant/sms-billing/pay]", e);
      return c.json({ success: false, error: "Saqlanmadi" }, 500);
    }
  });
}
