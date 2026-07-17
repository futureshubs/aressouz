/**
 * Eskiz informatsion SMS shablon: purchase_info
 *
 * Eskiz panelida (my.eskiz.uz) shablon sifatida tasdiqlatish uchun matn:
 *
 * Hurmatli {{mijoz}}, xaridingiz rasmiylashtirildi.
 *
 * Do'kon: {{dokon}}
 * Mahsulot: {{mahsulot}}
 * Miqdor: {{miqdor}} dona
 * Jami: {{jami}} so'm
 * Chegirma: {{chegirma}}%
 * {{qarz_qatori}}
 * Sana: {{sana}}
 *
 * Mas'ul diller: {{diller}}
 * Tel: {{telefon}}
 *
 * Qarz bo‘lsa {{qarz_qatori}}:
 * Qarz: {{qarz}} so'm
 * To'lov muddati: {{muddat}}
 *
 * Qarz bo‘lmasa: {{qarz_qatori}} bo‘sh qator.
 * Reklama / aksiya iboralarini qo‘shmang — faqat tranzaksion matn.
 */

export type DillerPurchaseSmsVars = {
  mijoz: string;
  dokon: string;
  mahsulot: string;
  miqdor: number | string;
  jami: number;
  chegirma: number;
  sana: string;
  diller: string;
  telefon: string;
  /** 0 yoki yo‘q = qarz qatori chiqmaydi */
  qarz?: number;
  muddat?: string;
};

export const ESKIZ_PURCHASE_INFO_TEMPLATE_NAME = 'purchase_info';

/** Eskiz kabinetiga nusxa qilish uchun shablon matni (o‘zgaruvchilar bilan) */
export const ESKIZ_PURCHASE_INFO_TEMPLATE = `Hurmatli {{mijoz}}, xaridingiz rasmiylashtirildi.

Do'kon: {{dokon}}
Mahsulot: {{mahsulot}}
Miqdor: {{miqdor}} dona
Jami: {{jami}} so'm
Chegirma: {{chegirma}}%
{{qarz_qatori}}Sana: {{sana}}

Mas'ul diller: {{diller}}
Tel: {{telefon}}`;

export function formatSmsMoney(n: number): string {
  return Math.round(Math.max(0, n)).toLocaleString('uz-UZ').replace(/,/g, ' ');
}

export function formatSmsDate(isoOrDate: string): string {
  const d = new Date(isoOrDate);
  if (!Number.isFinite(d.getTime())) return String(isoOrDate || '').trim();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function cleanLine(s: string): string {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Yuboriladigan tayyor SMS matni (o‘zgaruvchilar to‘ldirilgan) */
export function buildDillerPurchaseSms(vars: DillerPurchaseSmsVars): string {
  const qarz = Math.max(0, Math.round(Number(vars.qarz) || 0));
  const muddat = cleanLine(vars.muddat || '');
  const qarzQatori =
    qarz > 0
      ? `Qarz: ${formatSmsMoney(qarz)} so'm\nTo'lov muddati: ${muddat || '—'}\n`
      : '';

  const body = `Hurmatli ${cleanLine(vars.mijoz) || 'mijoz'}, xaridingiz rasmiylashtirildi.

Do'kon: ${cleanLine(vars.dokon) || '—'}
Mahsulot: ${cleanLine(vars.mahsulot) || '—'}
Miqdor: ${vars.miqdor} dona
Jami: ${formatSmsMoney(vars.jami)} so'm
Chegirma: ${Math.max(0, Math.round(Number(vars.chegirma) || 0))}%
${qarzQatori}Sana: ${cleanLine(vars.sana) || '—'}

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

Diller: {{diller}}
{{telefon}}`;

export const ESKIZ_DEBT_CLOSED_TEMPLATE = `Hurmatli {{mijoz}}, qarzingiz to'liq yopildi.

Sana: {{sana}}

Diller: {{diller}}
{{telefon}}`;

export const ESKIZ_DEBT_OVERDUE_TEMPLATE = `Hurmatli {{mijoz}}, qarz to'lovi muddati o'tdi.

Qoldiq: {{qoldiq}} so'm
Muddat: {{muddat}}

Diller: {{diller}}
{{telefon}}`;

/** Qisman to‘lov qabul qilindi */
export function buildDillerDebtPaymentSms(vars: DillerDebtPaymentSmsVars): string {
  const body = `Hurmatli ${cleanLine(vars.mijoz) || 'mijoz'}, to'lov qabul qilindi.

To'landi: ${formatSmsMoney(vars.tolov)} so'm
Qoldiq: ${formatSmsMoney(vars.qoldiq)} so'm

Diller: ${cleanLine(vars.diller) || '—'}
${cleanLine(vars.telefon) || '—'}`;
  return body.replace(/\n{3,}/g, '\n\n').trim();
}

/** Qarz to‘liq yopildi */
export function buildDillerDebtClosedSms(vars: DillerDebtClosedSmsVars): string {
  const body = `Hurmatli ${cleanLine(vars.mijoz) || 'mijoz'}, qarzingiz to'liq yopildi.

Sana: ${cleanLine(vars.sana) || '—'}

Diller: ${cleanLine(vars.diller) || '—'}
${cleanLine(vars.telefon) || '—'}`;
  return body.replace(/\n{3,}/g, '\n\n').trim();
}

/** Qarz to‘lovi muddati o‘tdi */
export function buildDillerDebtOverdueSms(vars: DillerDebtOverdueSmsVars): string {
  const body = `Hurmatli ${cleanLine(vars.mijoz) || 'mijoz'}, qarz to'lovi muddati o'tdi.

Qoldiq: ${formatSmsMoney(vars.qoldiq)} so'm
Muddat: ${cleanLine(vars.muddat) || '—'}

Diller: ${cleanLine(vars.diller) || '—'}
${cleanLine(vars.telefon) || '—'}`;
  return body.replace(/\n{3,}/g, '\n\n').trim();
}
