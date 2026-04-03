/** Sotuvchi paneli: buyurtmadan to‘lov / chek maydonlarini bir xil ko‘rinish */

export type SellerPaymentNorm = 'paid' | 'pending' | 'failed' | 'refunded' | 'unknown';

export function sellerOrderReceiptImageUrl(o: Record<string, unknown> | null | undefined): string {
  if (!o || typeof o !== 'object') return '';
  const keys = [
    'paymentReceiptImageUrl',
    'receiptUrl',
    'cashierReceiptUrl',
    'receiptImageUrl',
    'payment_receipt_image_url',
  ] as const;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function sellerOrderPaymentStatusNorm(o: Record<string, unknown> | null | undefined): SellerPaymentNorm {
  const ps = String((o as any)?.paymentStatus ?? (o as any)?.payment_status ?? '')
    .toLowerCase()
    .trim();
  if (ps === 'paid' || ps === 'completed' || ps === 'authorized' || ps === 'success') return 'paid';
  if (ps === 'failed' || ps === 'error') return 'failed';
  if (ps === 'refunded' || ps === 'partially_refunded') return 'refunded';
  if (ps === 'pending' || ps === 'unpaid' || ps === 'awaiting_payment' || !ps) {
    const src = String((o as any)?.sellerOrderSource ?? '').trim();
    const st = String((o as any)?.status ?? '')
      .toLowerCase()
      .trim();
    if (src === 'legacy_shop_order' && (st === 'completed' || st === 'delivered')) return 'paid';
    return 'pending';
  }
  return 'unknown';
}

export function sellerOrderPaymentMethodLabel(o: Record<string, unknown> | null | undefined): string {
  const raw = String(
    (o as any)?.paymentMethod ?? (o as any)?.payment?.method ?? (o as any)?.payment_method ?? '',
  )
    .toLowerCase()
    .trim();
  if (!raw) return '—';
  const map: Record<string, string> = {
    cash: 'Naqd',
    naqd: 'Naqd',
    card: 'Karta',
    karta: 'Karta',
    transfer: "O'tkazma",
    click: 'Click',
    payme: 'Payme',
    uzum: 'Uzum',
    humo: 'Humo',
    apelsin: 'Apelsin',
    atmos: 'ATTO / Atmos',
    qr: 'QR (kassa)',
    qrcode: 'QR (kassa)',
    online: 'Onlayn',
  };
  return map[raw] || raw;
}

export function sellerOrderNeedsCashierVerification(o: Record<string, unknown> | null | undefined): boolean {
  if (!o) return false;
  const pm = String((o as any)?.paymentMethod ?? '').toLowerCase().trim();
  const qrLike = pm === 'qr' || pm === 'qrcode';
  const flag = Boolean((o as any)?.paymentRequiresVerification);
  return flag || qrLike;
}

export function sellerOrderTotal(o: Record<string, unknown> | null | undefined): number {
  if (!o) return 0;
  const n = Number(
    (o as any)?.finalTotal ??
      (o as any)?.totalAmount ??
      (o as any)?.totalPrice ??
      (o as any)?.total ??
      0,
  );
  return Number.isFinite(n) ? n : 0;
}
