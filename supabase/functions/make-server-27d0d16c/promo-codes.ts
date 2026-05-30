import * as kv from "./kv_store.tsx";

export type PromoValidateResult =
  | { success: true; code: string; discount: number; percent: number; message: string }
  | { success: false; error: string };

const BUILTIN: Record<
  string,
  { percent: number; maxDiscount: number; minOrder: number; active?: boolean }
> = {
  ARESSE10: { percent: 10, maxDiscount: 100_000, minOrder: 50_000 },
  WELCOME5: { percent: 5, maxDiscount: 50_000, minOrder: 0 },
};

function normalizePromo(raw: unknown): {
  percent: number;
  maxDiscount: number;
  minOrder: number;
  active: boolean;
  expiresAt?: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const percent = Number(o.percent ?? o.discountPercent ?? 0);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return null;
  return {
    percent,
    maxDiscount: Math.max(0, Number(o.maxDiscount ?? o.max_discount ?? 0) || 0),
    minOrder: Math.max(0, Number(o.minOrder ?? o.min_order ?? 0) || 0),
    active: o.active !== false,
    expiresAt: o.expiresAt != null ? String(o.expiresAt) : undefined,
  };
}

export async function validatePromoCode(
  codeRaw: string,
  orderSubtotal: number,
): Promise<PromoValidateResult> {
  const code = String(codeRaw || "").trim().toUpperCase();
  if (!code || code.length < 3 || code.length > 32) {
    return { success: false, error: "Promo kod noto‘g‘ri" };
  }

  const subtotal = Math.max(0, Number(orderSubtotal) || 0);
  let rule = normalizePromo(await kv.get(`promo:${code}`));
  if (!rule) rule = normalizePromo(BUILTIN[code] ?? null);
  if (!rule || !rule.active) {
    return { success: false, error: "Promo kod topilmadi yoki muddati tugagan" };
  }

  if (rule.expiresAt && new Date(rule.expiresAt).getTime() < Date.now()) {
    return { success: false, error: "Promo kod muddati tugagan" };
  }

  if (subtotal < rule.minOrder) {
    return {
      success: false,
      error: `Minimal buyurtma: ${rule.minOrder.toLocaleString("uz-UZ")} so‘m`,
    };
  }

  let discount = Math.round((subtotal * rule.percent) / 100);
  if (rule.maxDiscount > 0) discount = Math.min(discount, rule.maxDiscount);
  discount = Math.min(discount, subtotal);
  if (discount <= 0) {
    return { success: false, error: "Ushbu promo kod uchun chegirma qo‘llanmaydi" };
  }

  return {
    success: true,
    code,
    discount,
    percent: rule.percent,
    message: `${rule.percent}% chegirma (−${discount.toLocaleString("uz-UZ")} so‘m)`,
  };
}
