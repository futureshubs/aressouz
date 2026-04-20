import { regions } from '../data/regions';

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Filial yetkazib berish zonalaridan joriy viloyat/tumanga mos aktiv zonani tanlaydi.
 * Admin paneldagi `region` / `district` maydonlari `regions` id yoki nomi bilan kelishi mumkin.
 */
export function pickDeliveryZoneForLocation(
  zones: Array<Record<string, unknown>> | null | undefined,
  regionId: string | null | undefined,
  districtId: string | null | undefined,
): Record<string, unknown> | null {
  if (!zones?.length) return null;

  const active = zones.filter((z) => z && (z as { isActive?: boolean }).isActive !== false);
  const list = active.length ? active : zones;

  const rid = String(regionId ?? '').trim();
  const did = String(districtId ?? '').trim();
  if (!rid || !did) return null;

  const regionMeta = regions.find((r) => r.id === rid);
  const regionName = regionMeta?.name;
  const districtName = regionMeta?.districts.find((d) => d.id === did)?.name;

  const matches = (zone: Record<string, unknown>): boolean => {
    const zr = [zone.region, zone.regionId, (zone as { regionName?: unknown }).regionName]
      .map(norm)
      .filter((x) => x.length > 0);
    const zd = [zone.district, zone.districtId, (zone as { districtName?: unknown }).districtName]
      .map(norm)
      .filter((x) => x.length > 0);

    const rOk =
      zr.some((z) => z === norm(rid)) ||
      (regionName && zr.some((z) => z === norm(regionName))) ||
      zr.some((z) => z.includes(norm(rid)) || norm(rid).includes(z));

    const dOk =
      zd.some((z) => z === norm(did)) ||
      (districtName && zd.some((z) => z === norm(districtName))) ||
      zd.some((z) => z.includes(norm(did)) || norm(did).includes(z));

    return rOk && dOk;
  };

  const hit = list.find(matches);
  return (hit as Record<string, unknown>) ?? null;
}
