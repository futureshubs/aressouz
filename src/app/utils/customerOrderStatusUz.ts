/**
 * Buyurtma holatini mijozga tushunarli o‘zbekcha matnga aylantirish (texnik inglizcha kalitlar).
 */

const STATUS_UZ: Record<string, string> = {
  new: 'Yangi buyurtma',
  pending: 'Tasdiqlanmoqda',
  confirmed: 'Qabul qilindi',
  accepted: 'Qabul qilindi',
  preparing: 'Tayyorlanyapti',
  ready: 'Kuryerga berishga tayyor',
  with_courier: "Yo'lda",
  delivering: "Yo'lda",
  delivered: 'Yetkazildi',
  completed: 'Yakunlandi',
  awaiting_receipt: 'Yetkazildi — tasdiqlang',
  cancelled: 'Bekor qilindi',
  canceled: 'Bekor qilindi',
  rejected: 'Rad etildi',
  refunded: "To'lov qaytarildi",
  processing: 'Jarayonda',
  paid: "To'langan",
  unpaid: "To'lanmagan",
  failed: 'Xatolik yuz berdi',
};

export function customerOrderStatusUz(raw: unknown): string {
  const rawStr = String(raw ?? '').trim();
  if (!rawStr) return 'Jarayonda';
  const key = rawStr.toLowerCase().replace(/[\s-]+/g, '_');
  if (STATUS_UZ[key]) return STATUS_UZ[key];
  return rawStr;
}

export function customerOrderStatusFromOrder(order: {
  status?: unknown;
  operationalStatus?: unknown;
  awaitingCustomerReceipt?: boolean;
  orderStatus?: 'active' | 'completed' | 'cancelled';
}): string {
  if (order.awaitingCustomerReceipt) {
    return STATUS_UZ.awaiting_receipt;
  }
  const raw = String(order.status ?? order.operationalStatus ?? '').trim();
  if (raw) {
    const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
    if (STATUS_UZ[key]) return STATUS_UZ[key];
    return raw;
  }
  if (order.orderStatus === 'completed') return STATUS_UZ.completed;
  if (order.orderStatus === 'cancelled') return STATUS_UZ.cancelled;
  return 'Jarayonda';
}
