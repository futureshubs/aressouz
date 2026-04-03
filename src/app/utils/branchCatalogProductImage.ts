/**
 * Filial katalogi `localStorage.products` dan mahsulot rasmini topish
 * (buyurtma qatorlarida rasm saqlanmagan bo‘lsa).
 */

function normalizeBranchCatalogImageUrl(s: string): string | null {
  const t = String(s || '').trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('//')) return t;
  if (t.startsWith('/')) return t;
  if (t.startsWith('data:image')) return t;
  return null;
}

export function tryResolveImageFromBranchCatalog(args: {
  productId?: string | null;
  variantId?: string | null;
  productName?: string;
  variantName?: string;
}): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('products');
    if (!raw) return null;
    const arr = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(arr)) return null;

    const pid = args.productId ? String(args.productId).trim() : '';
    const vid = args.variantId ? String(args.variantId).trim() : '';
    const vName = args.variantName ? String(args.variantName).trim().toLowerCase() : '';
    const pName = args.productName ? String(args.productName).trim().toLowerCase() : '';

    const pickVariantImage = (variants: unknown, variantId: string, variantLabel: string) => {
      if (!Array.isArray(variants)) return null;
      if (variantId) {
        const v = variants.find((x: { id?: string }) => String(x?.id ?? '') === variantId);
        const u =
          normalizeBranchCatalogImageUrl(String((v as { image?: string })?.image || '')) ||
          (Array.isArray((v as { images?: string[] })?.images)
            ? normalizeBranchCatalogImageUrl(
                String((v as { images: string[] }).images[0] || ''),
              )
            : null);
        if (u) return u;
      }
      if (variantLabel) {
        const v = variants.find(
          (x: { name?: string }) =>
            String(x?.name || '')
              .trim()
              .toLowerCase() === variantLabel,
        );
        const u =
          normalizeBranchCatalogImageUrl(String((v as { image?: string })?.image || '')) ||
          (Array.isArray((v as { images?: string[] })?.images)
            ? normalizeBranchCatalogImageUrl(
                String((v as { images: string[] }).images[0] || ''),
              )
            : null);
        if (u) return u;
      }
      const v0 = variants[0] as Record<string, unknown> | undefined;
      if (v0) {
        const u =
          normalizeBranchCatalogImageUrl(String(v0.image || '')) ||
          (Array.isArray(v0.images)
            ? normalizeBranchCatalogImageUrl(String((v0.images as string[])[0] || ''))
            : null);
        if (u) return u;
      }
      return null;
    };

    if (pid) {
      for (const bp of arr) {
        if (!bp?.id || String(bp.id) !== pid) continue;
        const variants = bp.variants;
        const u =
          pickVariantImage(variants, vid, vName) ||
          normalizeBranchCatalogImageUrl(String(bp.image || ''));
        if (u) return u;
      }
    }

    if (pName) {
      for (const bp of arr) {
        const nm = String(bp?.name || '')
          .trim()
          .toLowerCase();
        if (nm !== pName) continue;
        const variants = bp.variants;
        const u =
          pickVariantImage(variants, vid, vName) ||
          normalizeBranchCatalogImageUrl(String(bp.image || ''));
        if (u) return u;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}
