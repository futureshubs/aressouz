/**
 * Staff / kuryer panellarida buyurtmalar: yangi tushganlar tepada (createdAt bo‘yicha kamayish).
 */

function orderCreatedAtMs(order: unknown): number {
  if (order == null || typeof order !== 'object') return 0;
  const o = order as Record<string, unknown>;
  const candidates = [o.createdAt, o.created_at, o.createdAtMs, o.placedAt, o.placed_at];
  for (const raw of candidates) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return raw < 1e12 ? raw * 1000 : raw;
    }
    if (typeof raw === 'string' && raw.trim()) {
      const t = new Date(raw).getTime();
      if (Number.isFinite(t) && t > 0) return t;
    }
  }
  return 0;
}

function orderIdTieBreak(order: unknown): string {
  if (order == null || typeof order !== 'object') return '';
  const o = order as Record<string, unknown>;
  return String(o.id ?? o.orderId ?? o.orderNumber ?? o.order_id ?? '').trim();
}

export function sortOrdersNewestFirst<T>(orders: readonly T[]): T[] {
  return [...orders].sort((a, b) => {
    const diff = orderCreatedAtMs(b) - orderCreatedAtMs(a);
    if (diff !== 0) return diff;
    return orderIdTieBreak(b).localeCompare(orderIdTieBreak(a));
  });
}
