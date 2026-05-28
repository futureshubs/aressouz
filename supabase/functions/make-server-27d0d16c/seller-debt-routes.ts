import type { Hono } from "npm:hono";
import * as eskiz from "./eskiz-sms.tsx";
import {
  appendDebtPurchase,
  applyDebtPayment,
  computeDebtStatus,
  debtSmsNew,
  debtSmsPaid,
  debtSmsReminder,
  findOpenDebtByPhone,
  hydrateDebtRecord,
  makeDebtId,
  merchantDebtKey,
  merchantDebtPrefix,
  normalizeMerchantDebtPhone,
  sendDebtSms,
  type MerchantDebtPurchaseEntry,
  type DebtSmsBillingCtx,
  type MerchantDebtRecord,
} from "./merchant-debt.ts";

function shopSmsBilling(deps: Deps, shopId: string, shopName: string, smsKind: string): DebtSmsBillingCtx {
  return {
    kv: deps.kv,
    merchantKind: "shop",
    merchantId: shopId,
    merchantName: shopName,
    smsKind,
  };
}

type Deps = {
  kv: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: unknown) => Promise<void>;
    getByPrefix: (prefix: string) => Promise<any[]>;
  };
  validateSellerSession: (c: any) => Promise<any>;
  sellerShopIdsMatchFn: (a: unknown, b: unknown) => boolean;
};

function normalizeDebtRow(raw: any, shopName: string): MerchantDebtRecord | null {
  return hydrateDebtRecord(raw, {
    merchantKind: "shop",
    merchantName: shopName || "Do'kon",
  });
}

async function listShopDebts(kv: Deps["kv"], shopId: string, shopName: string) {
  const prefix = merchantDebtPrefix("shop", shopId);
  const rows = await kv.getByPrefix(prefix);
  const out: MerchantDebtRecord[] = [];
  for (const raw of Array.isArray(rows) ? rows : []) {
    const rec = normalizeDebtRow(raw, shopName);
    if (!rec) continue;
    const status = computeDebtStatus(rec);
    if (status !== rec.status) {
      rec.status = status;
      await kv.set(merchantDebtKey("shop", shopId, rec.id), rec);
    }
    out.push(rec);
  }
  out.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return out;
}

async function buildSaleItemsSummary(
  kv: Deps["kv"],
  shopId: string,
  items: unknown[],
): Promise<string> {
  const parts: string[] = [];
  for (const raw of Array.isArray(items) ? items : []) {
    const productId = String((raw as any)?.productId ?? "").trim();
    const qty = Math.max(1, Math.floor(Number((raw as any)?.qty) || 1));
    const priceUzs = Math.max(0, Math.floor(Number((raw as any)?.priceUzs) || 0));
    const variantLabel = String((raw as any)?.variantLabel || "").trim();
    let name = productId.slice(0, 12);
    if (productId) {
      const productKey = productId.startsWith("shop_product:") ? productId : `shop_product:${productId}`;
      const product = await kv.get(productKey);
      if (product?.name) name = String(product.name);
    }
    const label = variantLabel ? `${name} (${variantLabel})` : name;
    parts.push(`${label} ×${qty}${priceUzs > 0 ? ` — ${priceUzs.toLocaleString("en-US")} so'm` : ""}`);
  }
  return parts.length > 0 ? parts.join("; ") : "Savdo";
}

export async function createShopDebtFromSale(
  deps: Deps,
  opts: {
    shopId: string;
    shopName: string;
    saleId: string;
    customerName: string;
    customerPhone: string;
    remainingUzs: number;
    paidUzs: number;
    totalUzs?: number;
    dueDate?: string | null;
    items?: unknown[];
    itemsSummary?: string;
  },
): Promise<{ debt: MerchantDebtRecord | null; smsError?: string; merged?: boolean }> {
  const remainingUzs = Math.max(0, Math.floor(Number(opts.remainingUzs) || 0));
  if (remainingUzs <= 0) return { debt: null };

  const phone = normalizeMerchantDebtPhone(opts.customerPhone);
  if (!phone) return { debt: null, smsError: "Telefon noto'g'ri" };

  const name = String(opts.customerName || "").trim();
  if (!name) return { debt: null, smsError: "Mijoz ismi kerak" };

  const paidAtSale = Math.max(0, Math.floor(Number(opts.paidUzs) || 0));
  const totalSale = Math.max(
    remainingUzs + paidAtSale,
    Math.floor(Number(opts.totalUzs) || 0),
  );
  const dueDate = opts.dueDate ? String(opts.dueDate) : null;
  const itemsSummary = opts.itemsSummary ||
    await buildSaleItemsSummary(deps.kv, opts.shopId, opts.items || []);
  const now = new Date().toISOString();

  const purchaseEntry: MerchantDebtPurchaseEntry = {
    saleId: opts.saleId || null,
    at: now,
    totalUzs: totalSale,
    paidAtSaleUzs: paidAtSale,
    debtAddedUzs: remainingUzs,
    itemsSummary,
  };

  const existingDebts = await listShopDebts(deps.kv, opts.shopId, opts.shopName);
  const openExisting = findOpenDebtByPhone(existingDebts, phone);

  if (openExisting) {
    const key = merchantDebtKey("shop", opts.shopId, openExisting.id);
    const merged = appendDebtPurchase(openExisting, purchaseEntry, { dueDate, customerName: name });
    await deps.kv.set(key, merged);
    const sms = await sendDebtSms(phone, debtSmsNew({
      shop: opts.shopName,
      amountUzs: merged.remainingUzs,
      dueDate: merged.dueDate,
      kind: "shop",
    }), shopSmsBilling(deps, opts.shopId, opts.shopName, "debt_new"));
    if (sms.ok) {
      merged.smsLog = { ...merged.smsLog, createdAt: new Date().toISOString() };
      await deps.kv.set(key, merged);
    }
    return { debt: merged, smsError: sms.ok ? undefined : sms.error, merged: true };
  }

  const debtId = makeDebtId();
  const rec: MerchantDebtRecord = {
    id: debtId,
    merchantKind: "shop",
    merchantId: opts.shopId,
    merchantName: opts.shopName,
    customerName: name,
    customerPhone: phone,
    amountUzs: totalSale,
    paidUzs: paidAtSale,
    remainingUzs,
    dueDate,
    saleId: opts.saleId || null,
    saleIds: opts.saleId ? [opts.saleId] : [],
    purchases: [purchaseEntry],
    payments: [],
    status: "open",
    createdAt: now,
    updatedAt: now,
    smsLog: {},
  };
  rec.status = computeDebtStatus(rec);

  await deps.kv.set(merchantDebtKey("shop", opts.shopId, debtId), rec);

  const sms = await sendDebtSms(phone, debtSmsNew({
    shop: opts.shopName,
    amountUzs: remainingUzs,
    dueDate,
    kind: "shop",
  }), shopSmsBilling(deps, opts.shopId, opts.shopName, "debt_new"));
  if (sms.ok) {
    rec.smsLog = { ...rec.smsLog, createdAt: new Date().toISOString() };
    await deps.kv.set(merchantDebtKey("shop", opts.shopId, debtId), rec);
  }

  return { debt: rec, smsError: sms.ok ? undefined : sms.error, merged: false };
}

export async function createShopDebtManual(
  deps: Deps,
  opts: {
    shopId: string;
    shopName: string;
    customerName: string;
    customerPhone: string;
    amountUzs: number;
    paidUzs: number;
    dueDate?: string | null;
    saleId?: string;
    note?: string;
  },
): Promise<{ debt: MerchantDebtRecord | null; smsError?: string; merged?: boolean }> {
  const amountUzs = Math.max(0, Math.floor(Number(opts.amountUzs) || 0));
  const paidUzs = Math.max(0, Math.floor(Number(opts.paidUzs) || 0));
  const remainingUzs = Math.max(0, amountUzs - paidUzs);
  return createShopDebtFromSale(deps, {
    shopId: opts.shopId,
    shopName: opts.shopName,
    saleId: opts.saleId || "",
    customerName: opts.customerName,
    customerPhone: opts.customerPhone,
    remainingUzs,
    paidUzs,
    totalUzs: amountUzs,
    dueDate: opts.dueDate,
    itemsSummary: opts.note || "Qo'lda qo'shilgan qarz",
  });
}

export function registerSellerDebtRoutes(app: Hono, deps: Deps) {
  const { kv, validateSellerSession, sellerShopIdsMatchFn } = deps;

  app.get("/make-server-27d0d16c/seller/debts", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      if (!auth.success) return c.json({ success: false, error: auth.error }, 401);

      const shopName = String(auth.shopName || "Do'kon");
      const debts = await listShopDebts(kv, auth.shopId, shopName);
      const summary = {
        total: debts.length,
        open: debts.filter((d) => d.status === "open" || d.status === "overdue").length,
        overdue: debts.filter((d) => d.status === "overdue").length,
        paid: debts.filter((d) => d.status === "paid").length,
        remainingUzs: debts
          .filter((d) => d.status !== "paid")
          .reduce((s, d) => s + d.remainingUzs, 0),
      };
      return c.json({ success: true, debts, summary, smsConfigured: eskiz.isEskizConfigured() });
    } catch (e: any) {
      console.error("[seller/debts] list", e);
      return c.json({ success: false, error: "Qarzlarni yuklashda xatolik" }, 500);
    }
  });

  app.post("/make-server-27d0d16c/seller/debts", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      if (!auth.success) return c.json({ success: false, error: auth.error }, 401);

      const body = await c.req.json().catch(() => ({}));
      const customerName = String(body?.customerName || "").trim();
      const phone = normalizeMerchantDebtPhone(body?.customerPhone);
      const amountUzs = Math.max(0, Math.floor(Number(body?.amountUzs) || 0));
      const paidUzs = Math.max(0, Math.floor(Number(body?.paidUzs) || 0));
      const dueDate = body?.dueDate ? String(body.dueDate) : null;

      if (!customerName) return c.json({ success: false, error: "Mijoz ismi kerak" }, 400);
      if (!phone) return c.json({ success: false, error: "Telefon 998XXXXXXXXX formatida bo'lsin" }, 400);
      if (amountUzs <= 0) return c.json({ success: false, error: "Qarz summasi 0 dan katta bo'lsin" }, 400);

      const remainingUzs = Math.max(0, amountUzs - paidUzs);
      if (remainingUzs <= 0) {
        return c.json({ success: false, error: "Qolgan qarz 0 dan katta bo'lishi kerak" }, 400);
      }

      const shopName = String(auth.shopName || "Do'kon");
      const { debt, smsError, merged } = await createShopDebtManual(deps, {
        shopId: auth.shopId,
        shopName,
        customerName,
        customerPhone: phone,
        amountUzs,
        paidUzs,
        dueDate,
        saleId: String(body?.saleId || "").trim() || undefined,
        note: body?.note ? String(body.note) : undefined,
      });

      return c.json({ success: true, debt, smsError: smsError || null, merged: merged === true });
    } catch (e: any) {
      console.error("[seller/debts] create", e);
      return c.json({ success: false, error: "Qarz qo'shishda xatolik" }, 500);
    }
  });

  app.post("/make-server-27d0d16c/seller/debts/:debtId/pay", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      if (!auth.success) return c.json({ success: false, error: auth.error }, 401);

      const debtId = String(c.req.param("debtId") || "").trim();
      const body = await c.req.json().catch(() => ({}));
      const payUzs = Math.max(0, Math.floor(Number(body?.amountUzs) || 0));

      const key = merchantDebtKey("shop", auth.shopId, debtId);
      const raw = await kv.get(key);
      const rec = normalizeDebtRow(raw, String(auth.shopName || "Do'kon"));
      if (!rec || !sellerShopIdsMatchFn(rec.merchantId, auth.shopId)) {
        return c.json({ success: false, error: "Qarz topilmadi" }, 404);
      }
      if (rec.status === "paid") {
        return c.json({ success: true, debt: rec, alreadyPaid: true });
      }

      const appliedAmount = payUzs > 0 ? payUzs : rec.remainingUzs;
      const { rec: updated, applied, fullyPaid } = applyDebtPayment(rec, appliedAmount);

      let smsError: string | undefined;
      if (fullyPaid) {
        const sms = await sendDebtSms(
          updated.customerPhone,
          debtSmsPaid({ shop: updated.merchantName, kind: "shop" }),
          shopSmsBilling(deps, auth.shopId, String(auth.shopName || "Do'kon"), "debt_paid"),
        );
        if (sms.ok) {
          updated.smsLog = { ...updated.smsLog, paidAt: new Date().toISOString() };
        } else {
          smsError = sms.error;
        }
      }

      await kv.set(key, updated);
      return c.json({
        success: true,
        debt: updated,
        appliedUzs: applied,
        fullyPaid,
        smsError: smsError || null,
      });
    } catch (e: any) {
      console.error("[seller/debts] pay", e);
      return c.json({ success: false, error: "To'lovni qayd etishda xatolik" }, 500);
    }
  });

  app.post("/make-server-27d0d16c/seller/debts/:debtId/remind", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      if (!auth.success) return c.json({ success: false, error: auth.error }, 401);

      const debtId = String(c.req.param("debtId") || "").trim();
      const key = merchantDebtKey("shop", auth.shopId, debtId);
      const raw = await kv.get(key);
      const rec = normalizeDebtRow(raw, String(auth.shopName || "Do'kon"));
      if (!rec || !sellerShopIdsMatchFn(rec.merchantId, auth.shopId)) {
        return c.json({ success: false, error: "Qarz topilmadi" }, 404);
      }
      if (rec.status === "paid") {
        return c.json({ success: false, error: "Qarz allaqachon yopilgan" }, 400);
      }

      rec.status = computeDebtStatus(rec);
      const sms = await sendDebtSms(
        rec.customerPhone,
        debtSmsReminder({
          shop: rec.merchantName,
          amountUzs: rec.remainingUzs,
          dueDate: rec.dueDate,
          kind: "shop",
        }),
        shopSmsBilling(deps, auth.shopId, String(auth.shopName || "Do'kon"), "debt_reminder"),
      );
      if (!sms.ok) return c.json({ success: false, error: sms.error || "SMS yuborilmadi" }, 500);

      rec.smsLog = { ...rec.smsLog, reminderAt: new Date().toISOString() };
      rec.updatedAt = new Date().toISOString();
      await kv.set(key, rec);
      return c.json({ success: true, debt: rec });
    } catch (e: any) {
      console.error("[seller/debts] remind", e);
      return c.json({ success: false, error: "Eslatma yuborishda xatolik" }, 500);
    }
  });
}
