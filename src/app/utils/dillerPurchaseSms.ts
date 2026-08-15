/**
 * Eskiz informatsion SMS shablonlari (reklamasiz).
 *
 * Tasdiqlash uchun my.eskiz.uz — har biri alohida:
 *   purchase_info  — xarid rasmiylashtirildi
 *   debt_payment   — qisman to‘lov
 *   debt_closed    — qarz to‘liq yopildi
 *   debt_overdue   — muddat o‘tdi
 */

import { formatDillerDayDot } from './dillerTime';

export type DillerPurchaseSmsVars = {
  mijoz: string;
  dokon: string;
  mahsulot: string;
  miqdor: number | string;
  jami: number;
  /** Naqd / Qarz / Karta */
  tolov_turi: string;
  chegirma: number | string;
  sana: string;
  diller: string;
  telefon: string;
};

export const ESKIZ_PURCHASE_INFO_TEMPLATE_NAME = 'purchase_info';

export const ESKIZ_PURCHASE_INFO_TEMPLATE = `Hurmatli {{mijoz}}, xaridingiz rasmiylashtirildi.
Do'kon: {{dokon}}
Mahsulot: {{mahsulot}}
Miqdor: {{miqdor}} dona
Jami: {{jami}} so'm
To'lov turi: {{tolov_turi}}
Chegirma: {{chegirma}}
Sana: {{sana}}
Mas'ul diller: {{diller}}
Tel: {{telefon}}`;

export function formatSmsMoney(n: number): string {
  return Math.round(Math.max(0, n)).toLocaleString('uz-UZ').replace(/,/g, ' ');
}

export function formatSmsDate(isoOrDate: string): string {
  return formatDillerDayDot(isoOrDate);
}

export function paymentTypeSmsLabel(type: string): string {
  const t = String(type || '').toLowerCase();
  if (t === 'qarz') return 'Qarz';
  if (t === 'karta') return 'Karta';
  return 'Naqd';
}

function cleanLine(s: string): string {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatChegirma(v: number | string): string {
  if (typeof v === 'string' && v.trim()) return v.trim();
  const n = Math.round(Number(v) || 0);
  return n > 0 ? formatSmsMoney(n) : '0';
}

/** Sotuv / xarid rasmiylashtirildi */
export function buildDillerPurchaseSms(vars: DillerPurchaseSmsVars): string {
  const body = `Hurmatli ${cleanLine(vars.mijoz) || 'mijoz'}, xaridingiz rasmiylashtirildi.
Do'kon: ${cleanLine(vars.dokon) || '—'}
Mahsulot: ${cleanLine(vars.mahsulot) || '—'}
Miqdor: ${vars.miqdor} dona
Jami: ${formatSmsMoney(vars.jami)} so'm
To'lov turi: ${cleanLine(vars.tolov_turi) || 'Naqd'}
Chegirma: ${formatChegirma(vars.chegirma)}
Sana: ${cleanLine(vars.sana) || '—'}
Mas'ul diller: ${cleanLine(vars.diller) || '—'}
Tel: ${cleanLine(vars.telefon) || '—'}`;
  return body.replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizeUzPhoneForSms(phone: string): string | null {
  const d = String(phone || '').replace(/\D/g, '');
  if (/^998\d{9}$/.test(d)) return d;
  if (/^9\d{8}$/.test(d)) return `998${d}`;
  if (d.length === 9 && d.startsWith('9')) return `998${d}`;
  return null;
}

/* ——— Qarz SMS (Eskiz: debt_payment / debt_closed / debt_overdue) ——— */

export type DillerDebtPaymentSmsVars = {
  mijoz: string;
  tolov: number;
  qoldiq: number;
  diller: string;
  telefon: string;
};

export type DillerDebtClosedSmsVars = {
  mijoz: string;
  sana: string;
  diller: string;
  telefon: string;
};

export type DillerDebtOverdueSmsVars = {
  mijoz: string;
  qoldiq: number;
  muddat: string;
  diller: string;
  telefon: string;
};

export const ESKIZ_DEBT_PAYMENT_TEMPLATE_NAME = 'debt_payment';
export const ESKIZ_DEBT_CLOSED_TEMPLATE_NAME = 'debt_closed';
export const ESKIZ_DEBT_OVERDUE_TEMPLATE_NAME = 'debt_overdue';

export const ESKIZ_DEBT_PAYMENT_TEMPLATE = `Hurmatli {{mijoz}}, to'lov qabul qilindi.
To'landi: {{tolov}} so'm
Qoldiq: {{qoldiq}} so'm
Diller: {{diller}} {{telefon}}`;

export const ESKIZ_DEBT_CLOSED_TEMPLATE = `Hurmatli {{mijoz}}, qarzingiz to'liq yopildi.
Sana: {{sana}}
Diller: {{diller}} {{telefon}}`;

export const ESKIZ_DEBT_OVERDUE_TEMPLATE = `Hurmatli {{mijoz}}, qarz to'lovi muddati o'tdi.
Qoldiq: {{qoldiq}} so'm
Muddat: {{muddat}}
Diller: {{diller}} {{telefon}}`;

/** Qisman to‘lov qabul qilindi */
export function buildDillerDebtPaymentSms(vars: DillerDebtPaymentSmsVars): string {
  const diller = cleanLine(vars.diller) || '—';
  const tel = cleanLine(vars.telefon) || '';
  const body = `Hurmatli ${cleanLine(vars.mijoz) || 'mijoz'}, to'lov qabul qilindi.
To'landi: ${formatSmsMoney(vars.tolov)} so'm
Qoldiq: ${formatSmsMoney(vars.qoldiq)} so'm
Diller: ${diller}${tel ? ` ${tel}` : ''}`;
  return body.replace(/\n{3,}/g, '\n\n').trim();
}

/** Qarz to‘liq yopildi */
export function buildDillerDebtClosedSms(vars: DillerDebtClosedSmsVars): string {
  const diller = cleanLine(vars.diller) || '—';
  const tel = cleanLine(vars.telefon) || '';
  const body = `Hurmatli ${cleanLine(vars.mijoz) || 'mijoz'}, qarzingiz to'liq yopildi.
Sana: ${cleanLine(vars.sana) || '—'}
Diller: ${diller}${tel ? ` ${tel}` : ''}`;
  return body.replace(/\n{3,}/g, '\n\n').trim();
}

/** Qarz to‘lovi muddati o‘tdi */
export function buildDillerDebtOverdueSms(vars: DillerDebtOverdueSmsVars): string {
  const diller = cleanLine(vars.diller) || '—';
  const tel = cleanLine(vars.telefon) || '';
  const body = `Hurmatli ${cleanLine(vars.mijoz) || 'mijoz'}, qarz to'lovi muddati o'tdi.
Qoldiq: ${formatSmsMoney(vars.qoldiq)} so'm
Muddat: ${cleanLine(vars.muddat) || '—'}
Diller: ${diller}${tel ? ` ${tel}` : ''}`;
  return body.replace(/\n{3,}/g, '\n\n').trim();
}
