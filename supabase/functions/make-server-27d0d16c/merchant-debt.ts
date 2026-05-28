import * as eskiz from "./eskiz-sms.tsx";

export type MerchantDebtStatus = "open" | "overdue" | "paid";

export type MerchantDebtPurchaseEntry = {
  saleId?: string | null;
  at: string;
  totalUzs: number;
  paidAtSaleUzs: number;
  debtAddedUzs: number;
  itemsSummary?: string;
  note?: string;
};

export type MerchantDebtPaymentEntry = {
  at: string;
  amountUzs: number;
  remainingAfterUzs: number;
};

export type MerchantDebtRecord = {
  id: string;
  merchantKind: "shop" | "restaurant";
  merchantId: string;
  merchantName: string;
  customerName: string;
  customerPhone: string;
  amountUzs: number;
  paidUzs: number;
  remainingUzs: number;
  dueDate: string | null;
  saleId?: string | null;
  saleIds?: string[];
  purchases?: MerchantDebtPurchaseEntry[];
  payments?: MerchantDebtPaymentEntry[];
  status: MerchantDebtStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  smsLog?: {
    createdAt?: string;
    reminderAt?: string;
    paidAt?: string;
  };
};

export function normalizeMerchantDebtPhone(raw: unknown): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (/^998\d{9}$/.test(d)) return d;
  if (/^9\d{8}$/.test(d)) return `998${d}`;
  return null;
}

export function formatDebtAmountUzs(n: unknown): string {
  const x = Math.max(0, Math.floor(Number(n) || 0));
  return `${x.toLocaleString("en-US").replace(/,/g, " ")}`;
}

export function formatDebtDueDateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(String(iso)).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function merchantFromLabel(name: string, kind: "shop" | "restaurant"): string {
  const n = String(name || (kind === "restaurant" ? "Restoran" : "Do'kon")).trim();
  return kind === "restaurant" ? `${n} restoranidan` : `${n} do'konidan`;
}

function merchantAtLabel(name: string, kind: "shop" | "restaurant"): string {
  const n = String(name || (kind === "restaurant" ? "Restoran" : "Do'kon")).trim();
  return kind === "restaurant" ? `${n} restoranidagi` : `${n} do'konidagi`;
}

export function debtSmsNew(params: {
  shop: string;
  amountUzs: number;
  dueDate: string | null;
  kind?: "shop" | "restaurant";
}): string {
  const kind = params.kind === "restaurant" ? "restaurant" : "shop";
  const from = merchantFromLabel(params.shop, kind);
  const amount = formatDebtAmountUzs(params.amountUzs);
  const date = formatDebtDueDateLabel(params.dueDate);
  return `Hurmatli mijoz, sizda ${from} ${amount} so'm qarzdorlik mavjud. To'lov muddati: ${date}.`;
}

export function debtSmsReminder(params: {
  shop: string;
  amountUzs: number;
  dueDate: string | null;
  kind?: "shop" | "restaurant";
}): string {
  const kind = params.kind === "restaurant" ? "restaurant" : "shop";
  const at = merchantAtLabel(params.shop, kind);
  const amount = formatDebtAmountUzs(params.amountUzs);
  const date = formatDebtDueDateLabel(params.dueDate);
  return `Eslatma: ${at} ${amount} so'mlik qarzingizning muddati ${date} gacha.`;
}

export function debtSmsPaid(params: { shop: string; kind?: "shop" | "restaurant" }): string {
  const kind = params.kind === "restaurant" ? "restaurant" : "shop";
  const at = merchantAtLabel(params.shop, kind);
  return `To'lov qabul qilindi. ${at} qarzingiz yopildi.`;
}

export function merchantDebtKey(
  kind: "shop" | "restaurant",
  merchantId: string,
  debtId: string,
): string {
  const mid = String(merchantId || "").trim();
  const did = String(debtId || "").trim();
  return kind === "restaurant"
    ? `restaurant_debt:${mid}:${did}`
    : `shop_debt:${mid}:${did}`;
}

export function merchantDebtPrefix(kind: "shop" | "restaurant", merchantId: string): string {
  const mid = String(merchantId || "").trim();
  return kind === "restaurant" ? `restaurant_debt:${mid}:` : `shop_debt:${mid}:`;
}

export function computeDebtStatus(
  rec: MerchantDebtRecord,
  now = Date.now(),
): MerchantDebtStatus {
  if (rec.status === "paid" || rec.remainingUzs <= 0) return "paid";
  if (rec.dueDate) {
    const dueEnd = new Date(String(rec.dueDate));
    dueEnd.setHours(23, 59, 59, 999);
    if (Number.isFinite(dueEnd.getTime()) && now > dueEnd.getTime()) return "overdue";
  }
  return "open";
}

export type DebtSmsBillingCtx = {
  kv: { get: (k: string) => Promise<any>; set: (k: string, v: unknown) => Promise<void> };
  merchantKind: "shop" | "restaurant";
  merchantId: string;
  merchantName?: string;
  smsKind: string;
};

export async function sendDebtSms(
  phone: string,
  message: string,
  billing?: DebtSmsBillingCtx,
): Promise<{ ok: boolean; error?: string }> {
  if (!eskiz.isEskizConfigured()) {
    return { ok: false, error: "SMS xizmati sozlanmagan" };
  }
  const res = await eskiz.sendCustomSMS(phone, message);
  const ok = !!res.success;
  if (billing?.kv && billing.merchantId) {
    try {
      const { logSmsUsage } = await import("./sms-billing.ts");
      await logSmsUsage(billing.kv, {
        merchantKind: billing.merchantKind,
        merchantId: billing.merchantId,
        merchantName: billing.merchantName,
        phone,
        smsKind: billing.smsKind,
        success: ok,
      });
    } catch (e) {
      console.error("[sms-billing] log", e);
    }
  }
  if (!ok) return { ok: false, error: res.error || "SMS yuborilmadi" };
  return { ok: true };
}

export function makeDebtId(): string {
  return `debt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePurchases(raw: any, rec: MerchantDebtRecord): MerchantDebtPurchaseEntry[] {
  if (Array.isArray(raw?.purchases) && raw.purchases.length > 0) {
    return raw.purchases.map((p: any) => ({
      saleId: p?.saleId ? String(p.saleId) : null,
      at: String(p?.at || rec.createdAt),
      totalUzs: Math.max(0, Math.floor(Number(p?.totalUzs) || 0)),
      paidAtSaleUzs: Math.max(0, Math.floor(Number(p?.paidAtSaleUzs) || 0)),
      debtAddedUzs: Math.max(0, Math.floor(Number(p?.debtAddedUzs) || 0)),
      itemsSummary: p?.itemsSummary ? String(p.itemsSummary) : undefined,
      note: p?.note ? String(p.note) : undefined,
    }));
  }
  if (rec.saleId || rec.amountUzs > 0) {
    return [{
      saleId: rec.saleId || null,
      at: rec.createdAt,
      totalUzs: rec.amountUzs,
      paidAtSaleUzs: rec.paidUzs,
      debtAddedUzs: rec.remainingUzs > 0 ? rec.remainingUzs : Math.max(0, rec.amountUzs - rec.paidUzs),
      note: "Dastlabki yozuv",
    }];
  }
  return [];
}

function normalizePayments(raw: any): MerchantDebtPaymentEntry[] {
  if (!Array.isArray(raw?.payments)) return [];
  return raw.payments.map((p: any) => ({
    at: String(p?.at || new Date().toISOString()),
    amountUzs: Math.max(0, Math.floor(Number(p?.amountUzs) || 0)),
    remainingAfterUzs: Math.max(0, Math.floor(Number(p?.remainingAfterUzs) || 0)),
  }));
}

export function hydrateDebtRecord(raw: any, defaults: Partial<MerchantDebtRecord>): MerchantDebtRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const remainingUzs = Math.max(
    0,
    Math.floor(Number(raw.remainingUzs ?? (Number(raw.amountUzs) || 0) - (Number(raw.paidUzs) || 0)) || 0),
  );
  const rec: MerchantDebtRecord = {
    id: String(raw.id || defaults.id || ""),
    merchantKind: defaults.merchantKind || "shop",
    merchantId: String(raw.merchantId || raw.shopId || raw.restaurantId || defaults.merchantId || ""),
    merchantName: String(raw.merchantName || defaults.merchantName || "Do'kon"),
    customerName: String(raw.customerName || defaults.customerName || "").trim(),
    customerPhone: String(raw.customerPhone || defaults.customerPhone || ""),
    amountUzs: Math.max(0, Math.floor(Number(raw.amountUzs) || 0)),
    paidUzs: Math.max(0, Math.floor(Number(raw.paidUzs) || 0)),
    remainingUzs,
    dueDate: raw.dueDate ? String(raw.dueDate) : null,
    saleId: raw.saleId ? String(raw.saleId) : null,
    saleIds: Array.isArray(raw.saleIds) ? raw.saleIds.map(String) : undefined,
    status: raw.status === "paid" ? "paid" : raw.status === "overdue" ? "overdue" : "open",
    note: raw.note ? String(raw.note) : undefined,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
    paidAt: raw.paidAt ? String(raw.paidAt) : null,
    smsLog: raw.smsLog && typeof raw.smsLog === "object" ? raw.smsLog : {},
    purchases: [],
    payments: [],
  };
  rec.purchases = normalizePurchases(raw, rec);
  rec.payments = normalizePayments(raw);
  const saleIds = new Set<string>();
  for (const sid of rec.saleIds || []) saleIds.add(sid);
  if (rec.saleId) saleIds.add(rec.saleId);
  for (const p of rec.purchases) if (p.saleId) saleIds.add(p.saleId);
  rec.saleIds = [...saleIds];
  rec.status = computeDebtStatus(rec);
  return rec;
}

export function findOpenDebtByPhone(
  debts: MerchantDebtRecord[],
  phone: string,
): MerchantDebtRecord | null {
  const norm = normalizeMerchantDebtPhone(phone);
  if (!norm) return null;
  for (const d of debts) {
    if (d.customerPhone === norm && d.status !== "paid" && d.remainingUzs > 0) {
      return d;
    }
  }
  return null;
}

export function appendDebtPurchase(
  rec: MerchantDebtRecord,
  entry: MerchantDebtPurchaseEntry,
  opts?: { dueDate?: string | null; customerName?: string },
): MerchantDebtRecord {
  const debtAdded = Math.max(0, Math.floor(Number(entry.debtAddedUzs) || 0));
  const paidAtSale = Math.max(0, Math.floor(Number(entry.paidAtSaleUzs) || 0));
  const totalSale = Math.max(0, Math.floor(Number(entry.totalUzs) || 0));
  rec.purchases = [...(rec.purchases || []), entry];
  rec.amountUzs += debtAdded + paidAtSale;
  rec.paidUzs += paidAtSale;
  rec.remainingUzs += debtAdded;
  if (opts?.customerName) rec.customerName = opts.customerName;
  if (opts?.dueDate) rec.dueDate = opts.dueDate;
  if (entry.saleId) {
    const ids = new Set(rec.saleIds || []);
    ids.add(entry.saleId);
    rec.saleIds = [...ids];
    rec.saleId = entry.saleId;
  }
  rec.updatedAt = new Date().toISOString();
  rec.status = computeDebtStatus(rec);
  return rec;
}

export function applyDebtPayment(
  rec: MerchantDebtRecord,
  payUzs: number,
): { rec: MerchantDebtRecord; applied: number; fullyPaid: boolean } {
  const applied = Math.max(0, Math.min(rec.remainingUzs, Math.floor(Number(payUzs) || 0)));
  if (applied <= 0) return { rec, applied: 0, fullyPaid: rec.remainingUzs <= 0 };
  rec.paidUzs = Math.min(rec.amountUzs, rec.paidUzs + applied);
  rec.remainingUzs = Math.max(0, rec.amountUzs - rec.paidUzs);
  rec.payments = [
    ...(rec.payments || []),
    { at: new Date().toISOString(), amountUzs: applied, remainingAfterUzs: rec.remainingUzs },
  ];
  rec.updatedAt = new Date().toISOString();
  const fullyPaid = rec.remainingUzs <= 0;
  if (fullyPaid) {
    rec.status = "paid";
    rec.paidAt = new Date().toISOString();
  } else {
    rec.status = computeDebtStatus(rec);
  }
  return { rec, applied, fullyPaid };
}
