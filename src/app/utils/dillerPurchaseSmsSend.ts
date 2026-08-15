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
  paymentTypeSmsLabel,
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

/** Oddiy sotuv(lar)dan keyin do‘kon egasiga purchase_info SMS */
export async function maybeSendSalesBatchPurchaseSms(opts: {
  data: DillerData;
  sales: DillerSale[];
  send: boolean;
}): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  if (!opts.send) return { sent: false, skipped: 'off' };
  const sales = opts.sales.filter(Boolean);
  if (sales.length === 0) return { sent: false, skipped: 'no_sale' };

  const first = sales[0];
  const store = opts.data.stores.find((s) => s.id === first.storeId);
  const phoneOk = normalizeUzPhoneForSms(store?.phone || '');
  if (!phoneOk) return { sent: false, skipped: 'no_phone' };

  const names = sales.map((sale) => {
    const product = opts.data.products.find((p) => p.id === sale.productId);
    return product?.name || 'Mahsulot';
  });
  const uniqueNames = [...new Set(names)];
  const mahsulot =
    uniqueNames.length <= 2
      ? uniqueNames.join(', ')
      : `${uniqueNames[0]} va yana ${uniqueNames.length - 1} ta`;
  const miqdor = sales.reduce((s, row) => s + (row.qty || 0), 0);
  const jami = sales.reduce((s, row) => s + (row.total || 0), 0);
  const chegirma = sales.reduce((s, row) => s + (row.discountAmount || 0), 0);
  const { diller, telefon } = dealerContact(opts.data);

  const message = buildDillerPurchaseSms({
    mijoz: store?.contactName?.trim() || store?.name || 'mijoz',
    dokon: store?.name || '—',
    mahsulot,
    miqdor,
    jami,
    tolov_turi: paymentTypeSmsLabel(first.paymentType),
    chegirma,
    sana: formatSmsDate(first.createdAt || new Date().toISOString()),
    diller,
    telefon: telefon || '—',
  });

  return sendBuiltSms(phoneOk, message, 'purchase_info');
}

/** Bitta sotuvdan keyin */
export async function maybeSendSalePurchaseSms(opts: {
  data: DillerData;
  sale: DillerSale;
  send: boolean;
}): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  return maybeSendSalesBatchPurchaseSms({
    data: opts.data,
    sales: [opts.sale],
    send: opts.send,
  });
}

/** QR buyurtma sotuvidan keyin */
export async function maybeSendShopOrderPurchaseSms(opts: {
  data: DillerData;
  order: DillerShopOrder;
  total: number;
  discountAmount?: number;
  discountPercent?: number;
  paymentType?: string;
  send: boolean;
}): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  if (!opts.send) return { sent: false, skipped: 'off' };

  const store = opts.data.stores.find((s) => s.id === opts.order.storeId);
  const phoneOk =
    normalizeUzPhoneForSms(store?.phone || '') ||
    normalizeUzPhoneForSms(opts.order.customerPhone || '');
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
    store?.contactName?.trim() ||
    opts.order.customerName?.trim() ||
    storeName;

  const { diller, telefon } = dealerContact(opts.data);
  const chegirma =
    opts.discountAmount != null && opts.discountAmount > 0
      ? opts.discountAmount
      : opts.discountPercent
        ? `${Math.round(opts.discountPercent)}%`
        : 0;
  const message = buildDillerPurchaseSms({
    mijoz,
    dokon: storeName,
    mahsulot,
    miqdor,
    jami: opts.total,
    tolov_turi: paymentTypeSmsLabel(opts.paymentType || 'naqd'),
    chegirma,
    sana: formatSmsDate(new Date().toISOString()),
    diller,
    telefon: telefon || '—',
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
