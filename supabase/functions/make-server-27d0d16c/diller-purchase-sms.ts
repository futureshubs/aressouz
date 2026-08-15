/**
 * Eskiz informatsion SMS shablonlari (reklamasiz).
 * Frontend `src/app/utils/dillerPurchaseSms.ts` bilan bir xil.
 *
 *   purchase_info  — xarid rasmiylashtirildi
 *   debt_payment   — qisman to‘lov
 *   debt_closed    — qarz to‘liq yopildi
 *   debt_overdue   — muddat o‘tdi
 */

export type PurchaseSmsVars = {
  mijoz: string;
  dokon: string;
  mahsulot: string;
  miqdor: number | string;
  jami: number;
  tolov_turi: string;
  chegirma: number | string;
  sana: string;
  diller: string;
  telefon: string;
};

export type DebtPaymentSmsVars = {
  mijoz: string;
  tolov: number;
  qoldiq: number;
  diller: string;
  telefon: string;
};

export type DebtClosedSmsVars = {
  mijoz: string;
  sana: string;
  diller: string;
  telefon: string;
};

export type DebtOverdueSmsVars = {
  mijoz: string;
  qoldiq: number;
  muddat: string;
  diller: string;
  telefon: string;
};

export function formatSmsMoney(n: number): string {
  return Math.round(Math.max(0, n)).toLocaleString("uz-UZ").replace(/,/g, " ");
}

function cleanLine(s: string): string {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function formatChegirma(v: number | string): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  const n = Math.round(Number(v) || 0);
  return n > 0 ? formatSmsMoney(n) : "0";
}

export function buildPurchaseInfoSms(vars: PurchaseSmsVars): string {
  const body = `Hurmatli ${cleanLine(vars.mijoz) || "mijoz"}, xaridingiz rasmiylashtirildi.
Do'kon: ${cleanLine(vars.dokon) || "—"}
Mahsulot: ${cleanLine(vars.mahsulot) || "—"}
Miqdor: ${vars.miqdor} dona
Jami: ${formatSmsMoney(vars.jami)} so'm
To'lov turi: ${cleanLine(vars.tolov_turi) || "Naqd"}
Chegirma: ${formatChegirma(vars.chegirma)}
Sana: ${cleanLine(vars.sana) || "—"}
Mas'ul diller: ${cleanLine(vars.diller) || "—"}
Tel: ${cleanLine(vars.telefon) || "—"}`;
  return body.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildDebtPaymentSms(vars: DebtPaymentSmsVars): string {
  const diller = cleanLine(vars.diller) || "—";
  const tel = cleanLine(vars.telefon) || "";
  const body = `Hurmatli ${cleanLine(vars.mijoz) || "mijoz"}, to'lov qabul qilindi.
To'landi: ${formatSmsMoney(vars.tolov)} so'm
Qoldiq: ${formatSmsMoney(vars.qoldiq)} so'm
Diller: ${diller}${tel ? ` ${tel}` : ""}`;
  return body.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildDebtClosedSms(vars: DebtClosedSmsVars): string {
  const diller = cleanLine(vars.diller) || "—";
  const tel = cleanLine(vars.telefon) || "";
  const body = `Hurmatli ${cleanLine(vars.mijoz) || "mijoz"}, qarzingiz to'liq yopildi.
Sana: ${cleanLine(vars.sana) || "—"}
Diller: ${diller}${tel ? ` ${tel}` : ""}`;
  return body.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildDebtOverdueSms(vars: DebtOverdueSmsVars): string {
  const diller = cleanLine(vars.diller) || "—";
  const tel = cleanLine(vars.telefon) || "";
  const body = `Hurmatli ${cleanLine(vars.mijoz) || "mijoz"}, qarz to'lovi muddati o'tdi.
Qoldiq: ${formatSmsMoney(vars.qoldiq)} so'm
Muddat: ${cleanLine(vars.muddat) || "—"}
Diller: ${diller}${tel ? ` ${tel}` : ""}`;
  return body.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildSmsFromTemplateAndVars(
  template: string,
  vars: Record<string, unknown>,
): string {
  const t = String(template || "purchase_info").trim();
  if (t === "debt_payment") return buildDebtPaymentSms(vars as unknown as DebtPaymentSmsVars);
  if (t === "debt_closed") return buildDebtClosedSms(vars as unknown as DebtClosedSmsVars);
  if (t === "debt_overdue") return buildDebtOverdueSms(vars as unknown as DebtOverdueSmsVars);
  return buildPurchaseInfoSms(vars as unknown as PurchaseSmsVars);
}

export function normalizeUzSmsPhone(phone: string): string | null {
  const d = String(phone || "").replace(/\D/g, "");
  if (/^998\d{9}$/.test(d)) return d;
  if (/^9\d{8}$/.test(d)) return `998${d}`;
  if (d.length === 9 && d.startsWith("9")) return `998${d}`;
  return null;
}
