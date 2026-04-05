/** Ijara: naqd bo‘lsa kuryer kassaga `jami − yetkazish` topshiradi (server bilan bir xil qoida). */
export function rentalPaymentIsCashLike(paymentMethod: string | undefined | null): boolean {
  const raw = String(paymentMethod || '').toLowerCase().trim();
  if (raw === 'cash') return true;
  if (raw.includes('naqd') || raw.includes('naqt') || raw.includes('cash')) return true;
  if (!raw) return true;
  return false;
}

export function computeRentalCourierHandoffUzs(order: {
  totalPrice?: unknown;
  deliveryPrice?: unknown;
  deliveryFee?: unknown;
  paymentMethod?: unknown;
}): { toCashierUzs: number; isCashLike: boolean; totalUzs: number; deliveryKeptUzs: number } {
  const totalUzs = Math.max(0, Math.round(Number(order.totalPrice) || 0));
  const deliveryKeptUzs = Math.max(
    0,
    Math.round(Number(order.deliveryPrice ?? order.deliveryFee ?? 0) || 0),
  );
  const isCashLike = rentalPaymentIsCashLike(order.paymentMethod as string);
  const toCashierUzs = isCashLike ? Math.max(0, totalUzs - deliveryKeptUzs) : 0;
  return { toCashierUzs, isCashLike, totalUzs, deliveryKeptUzs };
}
