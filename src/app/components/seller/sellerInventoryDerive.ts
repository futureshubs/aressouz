import type { SellerInventoryLine, SellerInventorySummary } from './SellerWarehousePanel';

const LOW = 5;

/** Server javobi bo‘lmasa yoki eski format bo‘lsa — mahsulotlar ro‘yxatidan ombor qatorlarini qurish */
export function deriveInventoryLinesFromProducts(products: any[]): {
  items: SellerInventoryLine[];
  summary: SellerInventorySummary;
} {
  const items: SellerInventoryLine[] = [];
  for (const p of products || []) {
    if (!p || p.deleted) continue;
    const vars = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : null;
    if (vars) {
      vars.forEach((v: any, i: number) => {
        const st = Number(v?.stock ?? v?.stockQuantity ?? 0);
        items.push({
          productId: String(p.id || ''),
          productName: String(p.name || 'Mahsulot'),
          variantId: v?.id != null && String(v.id) !== '' ? String(v.id) : '',
          variantIndex: i,
          variantLabel: String(v?.name || '').trim() || `Variant ${i + 1}`,
          stock: Number.isFinite(st) ? Math.max(0, Math.floor(st)) : 0,
          price: Number(v?.price) || 0,
          image: (Array.isArray(v?.images) && v.images[0]) || p.image || null,
          barcode: String(v?.barcode || ''),
        });
      });
    } else {
      const st = Number(p.stock ?? p.stockQuantity ?? 0);
      items.push({
        productId: String(p.id || ''),
        productName: String(p.name || 'Mahsulot'),
        variantId: '',
        variantIndex: 0,
        variantLabel: 'Asosiy',
        stock: Number.isFinite(st) ? Math.max(0, Math.floor(st)) : 0,
        price: Number(p.price) || 0,
        image: p.image || null,
        barcode: '',
      });
    }
  }

  const totalUnits = items.reduce((s, it) => s + (it.stock || 0), 0);
  const summary: SellerInventorySummary = {
    totalLines: items.length,
    totalUnits,
    lowStockLines: items.filter((it) => it.stock > 0 && it.stock <= LOW).length,
    outOfStockLines: items.filter((it) => it.stock <= 0).length,
    lowStockThreshold: LOW,
  };

  return { items, summary };
}
