/** E‘lon / uy obyektidan birinchi rasm URL */
export function firstListingImageUrl(row: {
  images?: unknown;
  image?: unknown;
  photos?: unknown;
  photoUrls?: unknown;
}): string {
  const arrays = [row.images, row.photos, row.photoUrls];
  for (const list of arrays) {
    if (Array.isArray(list)) {
      for (const x of list) {
        const s = String(x ?? '').trim();
        if (s) return s;
      }
    }
  }
  const legacy = row.image;
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim();
  return '';
}

import type { House } from '../data/houses';

/** GET /houses kartochkasi → ListingCard uchun bir xil model */
export function houseToListingCardModel(house: House) {
  const ext = house as House & { image?: string };
  return {
    id: house.id,
    type: 'house' as const,
    title: house.title,
    images: house.images,
    image: ext.image,
    district: house.district,
    region: house.region,
    rooms: house.rooms,
    bathrooms: house.bathrooms,
    area: house.area,
    price: house.price,
    currency: house.currency,
    categoryId: house.categoryId,
    mortgageAvailable: house.mortgageAvailable,
    hasHalalInstallment: house.hasHalalInstallment,
  };
}

/** Kichik badge matni — profil va katalog bir xil */
export function listingCategoryShortLabel(categoryId: string, type?: string): string {
  const id = String(categoryId || '').toLowerCase();
  const map: Record<string, string> = {
    kvartira: 'Kvartira',
    apartment: 'Kvartira',
    villa: 'Villa',
    house: 'Uy',
    hovli: 'Hovli',
    townhouse: 'Taun',
    penthouse: 'Pent',
    office: 'Ofis',
    sedan: 'Sedan',
    hatchback: 'Hatchback',
    suv: 'SUV',
    crossover: 'Crossover',
    coupe: 'Coupe',
    luxury: 'Hashamatli',
    sport: 'Sport',
    electric: 'Elektr',
    hybrid: 'Gibrid',
    minivan: 'Minivan',
    pickup: 'Pickup',
    van: 'Van',
    convertible: 'Kabriolet',
    wagon: 'Wagon',
  };
  if (map[id]) return map[id];
  if (String(type || '').toLowerCase() === 'house') return 'Uy';
  if (String(type || '').toLowerCase() === 'car') return 'Moshina';
  return id ? id.slice(0, 8) : 'Uy';
}
