import { regions } from '../data/regions';

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Masofa, km */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Viloyat markazlari — `regions.ts` id bilan mos */
const REGION_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'tashkent-city': { lat: 41.2995, lng: 69.2401 },
  'tashkent': { lat: 41.25, lng: 69.75 },
  andijon: { lat: 40.7821, lng: 72.3442 },
  buxoro: { lat: 39.7747, lng: 64.4286 },
  jizzax: { lat: 40.1158, lng: 67.8422 },
  qashqadaryo: { lat: 38.8606, lng: 65.7897 },
  navoiy: { lat: 40.0844, lng: 65.3792 },
  namangan: { lat: 40.9983, lng: 71.6726 },
  samarqand: { lat: 39.627, lng: 66.975 },
  surxondaryo: { lat: 37.9403, lng: 67.5781 },
  sirdaryo: { lat: 40.3833, lng: 68.7167 },
  fargona: { lat: 40.3864, lng: 71.7864 },
  xorazm: { lat: 41.3775, lng: 60.3647 },
  qoraqalpogiston: { lat: 43.8041, lng: 59.4453 },
};

function normText(s: string) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[''`ʻʼ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nominatim `state` / `province` qatoridan viloyat id */
export function matchRegionIdFromNominatimState(stateFromAPI: string): string | null {
  const s = normText(stateFromAPI);
  if (!s) return null;

  for (const r of regions) {
    const name = normText(r.name);
    if (!name) continue;
    if (s.includes(name) || name.includes(s)) return r.id;
  }

  if (s.includes('toshkent')) {
    if (s.includes('shahri') || s.includes('city') || s.includes('город')) return 'tashkent-city';
    if (s.includes('viloyat') || s.includes('region') || s.includes('област')) return 'tashkent';
  }

  const idHints: [string, string][] = [
    ['farg', 'fargona'],
    ['qoraqalp', 'qoraqalpogiston'],
    ['navoi', 'navoiy'],
    ['samarkand', 'samarqand'],
    ['bukhara', 'buxoro'],
    ['jizzakh', 'jizzax'],
    ['khorezm', 'xorazm'],
    ['namangan', 'namangan'],
    ['andijan', 'andijon'],
    ['kashkadary', 'qashqadaryo'],
    ['surkhandary', 'surxondaryo'],
    ['syrdary', 'sirdaryo'],
  ];
  for (const [hint, id] of idHints) {
    if (s.includes(hint)) return id;
  }

  return null;
}

/** Eng yaqin viloyat id (Haversine) */
export function findNearestRegionId(lat: number, lng: number): string {
  let bestId = 'tashkent-city';
  let minD = Infinity;
  for (const [id, c] of Object.entries(REGION_CENTROIDS)) {
    const d = haversineKm(lat, lng, c.lat, c.lng);
    if (d < minD) {
      minD = d;
      bestId = id;
    }
  }
  return bestId;
}

function matchDistrictId(
  regionId: string,
  districtFromAPI: string,
): string | null {
  const ro = regions.find((r) => r.id === regionId);
  if (!ro || !districtFromAPI) return null;
  const dl = normText(districtFromAPI);
  if (!dl) return null;

  for (const d of ro.districts) {
    const nameL = normText(d.name);
    const idL = normText(d.id.replace(/-/g, ' '));
    if (
      nameL.includes(dl) ||
      dl.includes(nameL) ||
      idL.includes(dl) ||
      dl.includes(idL)
    ) {
      return d.id;
    }
  }
  return null;
}

export type ResolvedPlace = { regionId: string; districtId: string };

/**
 * GPS + Nominatim: viloyat va tuman (bizning `regions` ro‘yxatiga mos).
 * Xatolikda — eng yaqin viloyat + birinchi tuman.
 */
export async function resolveRegionDistrictFromCoords(
  lat: number,
  lng: number,
): Promise<ResolvedPlace> {
  const fallbackRegion = findNearestRegionId(lat, lng);
  const fallbackRegionObj = regions.find((r) => r.id === fallbackRegion);
  const fallbackDistrict = fallbackRegionObj?.districts[0]?.id ?? '';

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&accept-language=uz,ru,en`,
      {
        headers: {
          'User-Agent': 'AresSouz/1.0 (marketplace)',
        },
      },
    );
    if (!response.ok) throw new Error('nominatim http');
    const data = await response.json();
    const address = data.address || {};

    const stateFromAPI = String(
      address.state || address.province || address.region || '',
    );
    const districtFromAPI = String(
      address.county ||
        address.city_district ||
        address.suburb ||
        address.city ||
        address.town ||
        address.village ||
        '',
    );

    let regionId = matchRegionIdFromNominatimState(stateFromAPI) || fallbackRegion;
    if (!regions.some((r) => r.id === regionId)) regionId = fallbackRegion;

    const ro = regions.find((r) => r.id === regionId);
    if (!ro) return { regionId: fallbackRegion, districtId: fallbackDistrict };

    let districtId = matchDistrictId(regionId, districtFromAPI) || '';
    if (!districtId) districtId = ro.districts[0]?.id ?? '';

    return { regionId, districtId };
  } catch {
    return { regionId: fallbackRegion, districtId: fallbackDistrict };
  }
}

const nominatimHeaders = {
  'User-Agent': 'AresSouz/1.0 (marketplace)',
} as const;

/**
 * GPS nuqtasi uchun matnli manzil (ko‘cha, mahalla, aholi punkti) — checkout / Telegram.
 * Kordinata o‘rniga Nominatim `address` yoki `display_name`.
 */
export async function reverseGeocodeDisplayLine(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json` +
      `&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}` +
      `&accept-language=uz,ru,en&addressdetails=1`;
    const response = await fetch(url, { headers: nominatimHeaders });
    if (!response.ok) return null;
    const data = await response.json();
    const a = data.address || {};

    const houseRoad = [String(a.house_number || '').trim(), String(a.road || '').trim()]
      .filter(Boolean)
      .join(' ')
      .trim();

    const parts: string[] = [];
    if (houseRoad) parts.push(houseRoad);

    const localityKeys = [
      'neighbourhood',
      'suburb',
      'quarter',
      'city_block',
      'city_district',
      'hamlet',
      'village',
      'town',
      'city',
      'municipality',
    ] as const;
    const seen = new Set(parts.map((p) => p.toLowerCase()));
    for (const k of localityKeys) {
      const v = String(a[k] || '').trim();
      if (!v) continue;
      const low = v.toLowerCase();
      if (seen.has(low)) continue;
      if ([...seen].some((s) => s.includes(low) || low.includes(s))) continue;
      parts.push(v);
      seen.add(low);
    }

    const state = String(a.state || a.province || a.region || '').trim();
    if (state) {
      const low = state.toLowerCase();
      if (![...seen].some((s) => s.includes(low) || low.includes(s))) {
        parts.push(state);
      }
    }

    const composed = parts.join(', ').trim();
    if (composed.length >= 6) return composed;

    const display = String(data.display_name || '').trim();
    if (display.length >= 6) return display;
    return null;
  } catch {
    return null;
  }
}
