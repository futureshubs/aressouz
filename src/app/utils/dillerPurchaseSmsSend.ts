import { dillerApiSendPurchaseSms } from './dillerApi';
import type { DillerData, DillerSale, DillerShopOrder } from './dillerData';
import { getDillerBrandLabel } from './dillerData';
import {
  buildDillerDebtClosedSms,
  buildDillerDebtOverdueSms,
  buildDillerDebtPaymentSms,
  buildDillerPurchaseSms,
  formatSmsDate,
  normalizeUzPhoneForSms,
} from './dillerPurchaseSms';
import { readDillerSession } from './dillerSession';

function dealerContact(data: DillerData): { diller: string; telefon: string } {
  const sess = readDillerSession();
  const diller =
    sess?.displayName?.trim() ||
    data.profile.directorName?.trim() ||
    getDillerBrandLabel(data.profile.companyName) ||
    'Diller';
  const telefon =
    data.profile.orderPhone?.trim() ||
    data.profile.phone?.trim() ||
    '';
  return { diller, telefon };
}

function storePhoneAndName(
  data: DillerData,
  storeId: string,
): { phone: string | null; mijoz: string } {
  const store = data.stores.find((s) => s.id === storeId);
  return {
    phone: normalizeUzPhoneForSms(store?.phone || ''),
    mijoz: store?.contactName?.trim() || store?.name || 'mijoz',
  };
}

async function sendBuiltSms(
  phone: string,
  message: string,
  template?: string,
): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  const sess = readDillerSession();
  if (!sess?.token) return { sent: false, error: 'Sessiya yo‘q' };
  const res = await dillerApiSendPurchaseSms(sess.token, { phone, message, template });
  if (!res.ok) return { sent: false, error: res.error };
  return { sent: true };
}

/** Oddiy sotuvdan keyin do‘kon telefoniga purchase_info SMS */
export async function maybeSendSalePurchaseSms(opts: {
  data: DillerData;
  sale: DillerSale;
  send: boolean;
}): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  if (!opts.send) return { sent: false, skipped: 'off' };

  const store = opts.data.stores.find((s) => s.id === opts.sale.storeId);
  const product = opts.data.products.find((p) => p.id === opts.sale.productId);
  const phoneOk = normalizeUzPhoneForSms(store?.phone || '');
  if (!phoneOk) return { sent: false, skipped: 'no_phone' };

  const { diller, telefon } = dealerContact(opts.data);
  const qarz = opts.sale.debtAmount ?? 0;
  const message = buildDillerPurchaseSms({
    mijoz: store?.contactName?.trim() || store?.name || 'mijoz',
    dokon: store?.name || '—',
    mahsulot: product?.name || '—',
    miqdor: opts.sale.qty,
    jami: opts.sale.total,
    chegirma: opts.sale.discountPercent ?? 0,
    sana: formatSmsDate(opts.sale.createdAt),
    diller,
    telefon: telefon || '—',
    qarz,
    muddat: qarz > 0 ? formatSmsDate(opts.sale.debtDueDate || '') : undefined,
  });

  return sendBuiltSms(phoneOk, message, 'purchase_info');
}

/** QR buyurtma sotuvidan keyin */
export async function maybeSendShopOrderPurchaseSms(opts: {
  data: DillerData;
  order: DillerShopOrder;
  total: number;
  discountPercent: number;
  debtAmount: number;
  debtDueDate?: string;
  send: boolean;
}): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  if (!opts.send) return { sent: false, skipped: 'off' };

  const store = opts.data.stores.find((s) => s.id === opts.order.storeId);
  const phoneOk =
    normalizeUzPhoneForSms(opts.order.customerPhone || '') ||
    normalizeUzPhoneForSms(store?.phone || '');
  if (!phoneOk) return { sent: false, skipped: 'no_phone' };

  const items = opts.order.items || [];
  const mahsulot =
    items.length === 0
      ? '—'
      : items.length === 1
        ? items[0].productName
        : `${items[0].productName} va yana ${items.length - 1} ta`;
  const miqdor = items.reduce((s, it) => s + (it.qty || 0), 0) || 1;
  const storeName = opts.order.storeName?.trim() || store?.name || '—';
  const mijoz =
    opts.order.customerName?.trim() ||
    store?.contactName?.trim() ||
    storeName;

  const { diller, telefon } = dealerContact(opts.data);
  const message = buildDillerPurchaseSms({
    mijoz,
    dokon: storeName,
    mahsulot,
    miqdor,
    jami: opts.total,
    chegirma: opts.discountPercent,
    sana: formatSmsDate(new Date().toISOString()),
    diller,
    telefon: telefon || '—',
    qarz: opts.debtAmount,
    muddat: opts.debtAmount > 0 ? formatSmsDate(opts.debtDueDate || '') : undefined,
  });

  return sendBuiltSms(phoneOk, message, 'purchase_info');
}

/**
 * Qarz to‘lovi SMS:
 * — qoldiq > 0 → debt_payment
 * — qoldiq = 0 → debt_closed
 */
export async function maybeSendDebtPaymentSms(opts: {
  data: DillerData;
  sale: DillerSale;
  paidAmount: number;
  remainingDebt: number;
  send: boolean;
}): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  if (!opts.send) return { sent: false, skipped: 'off' };

  const { phone, mijoz } = storePhoneAndName(opts.data, opts.sale.storeId);
  if (!phone) return { sent: false, skipped: 'no_phone' };

  const { diller, telefon } = dealerContact(opts.data);
  const closed = opts.remainingDebt <= 0;

  const message = closed
    ? buildDillerDebtClosedSms({
        mijoz,
        sana: formatSmsDate(new Date().toISOString()),
        diller,
        telefon: telefon || '—',
      })
    : buildDillerDebtPaymentSms({
        mijoz,
        tolov: opts.paidAmount,
        qoldiq: opts.remainingDebt,
        diller,
        telefon: telefon || '—',
      });

  return sendBuiltSms(phone, message, closed ? 'debt_closed' : 'debt_payment');
}

/** Muddat o‘tgan qarz eslatmasi */
export async function maybeSendDebtOverdueSms(opts: {
  data: DillerData;
  sale: DillerSale;
  send?: boolean;
}): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  if (opts.send === false) return { sent: false, skipped: 'off' };

  const qoldiq = opts.sale.debtAmount ?? 0;
  if (qoldiq <= 0) return { sent: false, skipped: 'no_debt' };

  const { phone, mijoz } = storePhoneAndName(opts.data, opts.sale.storeId);
  if (!phone) return { sent: false, skipped: 'no_phone' };

  const { diller, telefon } = dealerContact(opts.data);
  const message = buildDillerDebtOverdueSms({
    mijoz,
    qoldiq,
    muddat: formatSmsDate(opts.sale.debtDueDate || ''),
    diller,
    telefon: telefon || '—',
  });

  return sendBuiltSms(phone, message, 'debt_overdue');
}

export function purchaseSmsToast(
  result: { sent: boolean; skipped?: string; error?: string },
  baseSuccess: string,
): string {
  if (result.sent) return `${baseSuccess}. SMS yuborildi`;
  if (result.error) return `${baseSuccess}. SMS: ${result.error}`;
  return baseSuccess;
}
