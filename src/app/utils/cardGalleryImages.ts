/** Mahsulot / API obyektidan kartochka galereyasi uchun noyob rasm URL-lari */
export function collectProductGalleryImages(product: {
  image?: unknown;
  images?: unknown;
  variants?: Array<{ image?: unknown; images?: unknown }>;
}): string[] {
  const out: string[] = [];
  const add = (u: unknown) => {
    const s = String(u ?? '').trim();
    if (s && !out.includes(s)) out.push(s);
  };
  if (Array.isArray(product?.images)) {
    for (const u of product.images) add(u);
  }
  add(product?.image);
  if (Array.isArray(product?.variants)) {
    for (const v of product.variants) {
      if (Array.isArray(v?.images)) {
        for (const u of v.images) add(u);
      }
      add(v?.image);
    }
  }
  return out;
}

/** E'lon / uy / avto kartochkalari — bir nechta maydon */
export function collectListingGalleryImages(row: {
  image?: unknown;
  images?: unknown;
  photos?: unknown;
  photoUrls?: unknown;
}): string[] {
  const out: string[] = [];
  const add = (u: unknown) => {
    const s = String(u ?? '').trim();
    if (s && !out.includes(s)) out.push(s);
  };
  for (const key of ['images', 'photos', 'photoUrls'] as const) {
    if (Array.isArray(row?.[key])) {
      for (const u of row[key] as unknown[]) add(u);
    }
  }
  add(row?.image);
  return out;
}
