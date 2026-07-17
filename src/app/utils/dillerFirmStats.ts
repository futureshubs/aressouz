import type { DillerData, DillerFirm, DillerProduct, DillerSale } from './dillerData';
import { getWarehouseQty } from './dillerData';
import { formatDillerDate, formatDillerDateTime } from './dillerStoreStats';
import { googleMapsUrlForAddressQuery, phoneToTelHref } from './restaurantContactLinks';

export type DillerFirmProductRow = {
  product: DillerProduct;
  warehouseQty: number;
  warehouseValue: number;
  saleCount: number;
  soldQty: number;
  revenue: number;
};

export type DillerFirmStats = {
  productCount: number;
  warehouseQty: number;
  warehouseValue: number;
  saleCount: number;
  totalRevenue: number;
  totalSoldQty: number;
  lastSaleAt: string | null;
  products: DillerFirmProductRow[];
};

export function getFirmProducts(data: DillerData, firm: DillerFirm): DillerProduct[] {
  const name = firm.name.trim();
  return data.products.filter(
    (p) => p.firmId === firm.id || (name && p.firmName.trim() === name),
  );
}

export function getFirmSales(data: DillerData, firm: DillerFirm): DillerSale[] {
  const productIds = new Set(getFirmProducts(data, firm).map((p) => p.id));
  return data.sales
    .filter((s) => !s.cancelled && productIds.has(s.productId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getFirmStats(data: DillerData, firmId: string): DillerFirmStats | null {
  const firm = data.firms.find((f) => f.id === firmId);
  if (!firm) return null;

  const products = getFirmProducts(data, firm);
  const sales = getFirmSales(data, firm);

  const saleByProduct = new Map<string, { count: number; qty: number; revenue: number }>();
  for (const s of sales) {
    const row = saleByProduct.get(s.productId) ?? { count: 0, qty: 0, revenue: 0 };
    row.count += 1;
    row.qty += s.qty;
    row.revenue += s.total;
    saleByProduct.set(s.productId, row);
  }

  let warehouseQty = 0;
  let warehouseValue = 0;
  const productRows: DillerFirmProductRow[] = products.map((product) => {
    const warehouseQtyP = getWarehouseQty(data, product.id);
    const warehouseValueP = warehouseQtyP * (product.buyPrice ?? 0);
    warehouseQty += warehouseQtyP;
    warehouseValue += warehouseValueP;
    const saleRow = saleByProduct.get(product.id);
    return {
      product,
      warehouseQty: warehouseQtyP,
      warehouseValue: warehouseValueP,
      saleCount: saleRow?.count ?? 0,
      soldQty: saleRow?.qty ?? 0,
      revenue: saleRow?.revenue ?? 0,
    };
  });

  productRows.sort((a, b) => b.revenue - a.revenue || b.warehouseQty - a.warehouseQty);

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalSoldQty = sales.reduce((sum, s) => sum + s.qty, 0);

  return {
    productCount: products.length,
    warehouseQty,
    warehouseValue,
    saleCount: sales.length,
    totalRevenue,
    totalSoldQty,
    lastSaleAt: sales[0]?.createdAt ?? null,
    products: productRows,
  };
}

export function getFirmTelHref(firm: DillerFirm): string {
  return phoneToTelHref(firm.phone);
}

export function getFirmMapUrl(firm: DillerFirm): string | null {
  const addr = firm.address.trim();
  if (!addr) return null;
  return googleMapsUrlForAddressQuery(addr);
}

export { formatDillerDate, formatDillerDateTime };
