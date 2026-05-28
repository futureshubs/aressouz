import {
  currentBillingMonth,
  SMS_OPERATOR_RATES,
  smsCostForPhone,
  type SmsOperatorId,
} from "../_shared/smsOperatorRates.ts";

export type SmsBillingMerchantKind = "shop" | "restaurant";

export type SmsUsageEntry = {
  id: string;
  at: string;
  phone: string;
  operator: SmsOperatorId;
  costUzs: number;
  smsKind: string;
  success: boolean;
};

export type SmsMonthlyBilling = {
  month: string;
  merchantKind: SmsBillingMerchantKind;
  merchantId: string;
  merchantName?: string;
  totalCount: number;
  totalCostUzs: number;
  successCount: number;
  byOperator: Record<
    string,
    { count: number; costUzs: number; rateUzs: number; label: string }
  >;
  entries: SmsUsageEntry[];
  paid: boolean;
  paidAt: string | null;
  updatedAt: string;
};

type Kv = {
  get: (key: string) => Promise<any>;
  set: (key: string, value: unknown) => Promise<void>;
  getByPrefix: (prefix: string) => Promise<any[]>;
};

export function smsBillingKey(
  kind: SmsBillingMerchantKind,
  merchantId: string,
  month: string,
): string {
  return `sms_billing:${kind}:${merchantId}:${month}`;
}

function emptyByOperator() {
  const out: SmsMonthlyBilling["byOperator"] = {};
  for (const r of SMS_OPERATOR_RATES) {
    out[r.id] = { count: 0, costUzs: 0, rateUzs: r.serviceTypeUzs, label: r.label };
  }
  out.unknown = { count: 0, costUzs: 0, rateUzs: 250, label: "Nomaʼlum" };
  return out;
}

function normalizeBilling(raw: any, defaults: Partial<SmsMonthlyBilling>): SmsMonthlyBilling {
  const month = String(raw?.month || defaults.month || currentBillingMonth());
  const byOperator = emptyByOperator();
  if (raw?.byOperator && typeof raw.byOperator === "object") {
    for (const [k, v] of Object.entries(raw.byOperator)) {
      if (byOperator[k]) {
        byOperator[k] = {
          ...byOperator[k],
          count: Math.max(0, Math.floor(Number((v as any)?.count) || 0)),
          costUzs: Math.max(0, Math.floor(Number((v as any)?.costUzs) || 0)),
        };
      }
    }
  }
  return {
    month,
    merchantKind: defaults.merchantKind || "shop",
    merchantId: String(raw?.merchantId || defaults.merchantId || ""),
    merchantName: raw?.merchantName ? String(raw.merchantName) : defaults.merchantName,
    totalCount: Math.max(0, Math.floor(Number(raw?.totalCount) || 0)),
    totalCostUzs: Math.max(0, Math.floor(Number(raw?.totalCostUzs) || 0)),
    successCount: Math.max(0, Math.floor(Number(raw?.successCount) || 0)),
    byOperator,
    entries: Array.isArray(raw?.entries) ? raw.entries.slice(-300) : [],
    paid: raw?.paid === true,
    paidAt: raw?.paidAt ? String(raw.paidAt) : null,
    updatedAt: String(raw?.updatedAt || new Date().toISOString()),
  };
}

export async function getSmsMonthlyBilling(
  kv: Kv,
  kind: SmsBillingMerchantKind,
  merchantId: string,
  month: string,
  merchantName?: string,
): Promise<SmsMonthlyBilling> {
  const key = smsBillingKey(kind, merchantId, month);
  const raw = await kv.get(key);
  if (!raw) {
    return normalizeBilling({}, { merchantKind: kind, merchantId, month, merchantName });
  }
  return normalizeBilling(raw, { merchantKind: kind, merchantId, month, merchantName });
}

export async function logSmsUsage(
  kv: Kv,
  opts: {
    merchantKind: SmsBillingMerchantKind;
    merchantId: string;
    merchantName?: string;
    phone: string;
    smsKind: string;
    success: boolean;
    month?: string;
  },
): Promise<SmsMonthlyBilling> {
  const month = opts.month || currentBillingMonth();
  const { operator, costUzs } = smsCostForPhone(opts.phone);
  const key = smsBillingKey(opts.merchantKind, opts.merchantId, month);
  const rec = await getSmsMonthlyBilling(kv, opts.merchantKind, opts.merchantId, month, opts.merchantName);

  const entry: SmsUsageEntry = {
    id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    phone: String(opts.phone).replace(/\D/g, ""),
    operator,
    costUzs: opts.success ? costUzs : 0,
    smsKind: opts.smsKind,
    success: opts.success,
  };

  rec.entries = [...rec.entries, entry].slice(-300);
  if (opts.success) {
    rec.totalCount += 1;
    rec.successCount += 1;
    rec.totalCostUzs += costUzs;
    if (rec.byOperator[operator]) {
      rec.byOperator[operator].count += 1;
      rec.byOperator[operator].costUzs += costUzs;
    }
  }
  rec.updatedAt = new Date().toISOString();
  if (opts.merchantName) rec.merchantName = opts.merchantName;

  await kv.set(key, rec);
  return rec;
}

export async function setSmsBillingPaid(
  kv: Kv,
  kind: SmsBillingMerchantKind,
  merchantId: string,
  month: string,
  paid: boolean,
): Promise<SmsMonthlyBilling> {
  const rec = await getSmsMonthlyBilling(kv, kind, merchantId, month);
  rec.paid = paid;
  rec.paidAt = paid ? new Date().toISOString() : null;
  rec.updatedAt = new Date().toISOString();
  await kv.set(smsBillingKey(kind, merchantId, month), rec);
  return rec;
}

export function billingSummaryForApi(rec: SmsMonthlyBilling) {
  return {
    month: rec.month,
    merchantKind: rec.merchantKind,
    merchantId: rec.merchantId,
    merchantName: rec.merchantName,
    totalCount: rec.totalCount,
    successCount: rec.successCount,
    totalCostUzs: rec.totalCostUzs,
    paid: rec.paid,
    paidAt: rec.paidAt,
    byOperator: rec.byOperator,
    entries: [...rec.entries].reverse(),
    recentEntries: rec.entries.slice(-30).reverse(),
  };
}
