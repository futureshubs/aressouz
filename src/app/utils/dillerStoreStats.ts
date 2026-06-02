import type { DillerData, DillerSale, DillerStore } from './dillerData';
import {
  googleMapsUrlForAddressQuery,
  googleMapsUrlForCoordinates,
  phoneToTelHref,
  yandexMapsUrlForCoordinates,
} from './restaurantContactLinks';

export type DillerStoreMapLinks = {
  google: string;
  yandex: string;
};

export type DillerStoreProductRow = {
  productId: string;
  productName: string;
  qty: number;
  total: number;
  saleCount: number;
};

export type DillerStoreStats = {
  saleCount: number;
  totalRevenue: number;
  totalPaid: number;
  openDebt: number;
  closedDebtSales: number;
  lastSaleAt: string | null;
  firstSaleAt: string | null;
  products: DillerStoreProductRow[];
};

export function formatDillerDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('uz-UZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDillerDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function getStoreSales(data: DillerData, storeId: string): DillerSale[] {
  return data.sales
    .filter((s) => s.storeId === storeId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getStoreStats(data: DillerData, storeId: string): DillerStoreStats {
  const sales = getStoreSales(data, storeId);
  let totalRevenue = 0;
  let totalPaid = 0;
  let openDebt = 0;
  let closedDebtSales = 0;
  const byProduct = new Map<string, DillerStoreProductRow>();

  for (const s of sales) {
    totalRevenue += s.total;
    totalPaid += s.paidAmount ?? 0;
    const debt = s.debtAmount ?? 0;
    if (debt > 0) openDebt += debt;
    else if (s.paymentType === 'qarz') closedDebtSales += 1;

    const product = data.products.find((p) => p.id === s.productId);
    const name = product?.name ?? 'Mahsulot';
    const row = byProduct.get(s.productId) ?? {
      productId: s.productId,
      productName: name,
      qty: 0,
      total: 0,
      saleCount: 0,
    };
    row.qty += s.qty;
    row.total += s.total;
    row.saleCount += 1;
    byProduct.set(s.productId, row);
  }

  const products = [...byProduct.values()].sort((a, b) => b.total - a.total);

  return {
    saleCount: sales.length,
    totalRevenue,
    totalPaid,
    openDebt,
    closedDebtSales,
    lastSaleAt: sales[0]?.createdAt ?? null,
    firstSaleAt: sales.length > 0 ? sales[sales.length - 1].createdAt : null,
    products,
  };
}

export function getStoreMapLinks(store: DillerStore): DillerStoreMapLinks | null {
  const lat = store.lat;
  const lng = store.lng;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return {
      google: googleMapsUrlForCoordinates(lat, lng),
      yandex: yandexMapsUrlForCoordinates(lat, lng),
    };
  }
  const addr = store.address.trim();
  if (addr) {
    return {
      google: googleMapsUrlForAddressQuery(addr),
      yandex: `https://yandex.com/maps/?text=${encodeURIComponent(addr)}`,
    };
  }
  return null;
}

export function getStoreTelHref(store: DillerStore): string {
  return phoneToTelHref(store.phone);
}
