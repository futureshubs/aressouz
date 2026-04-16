/**
 * `src/app/utils/merchantRegionTimeZone.ts` bilan bir xil mantiq (Edge — `regions.ts` import qilinmaydi).
 * API odatda `region` / `regionId` sifatida `regions.ts` dagi `id` yuboradi.
 */

const UZ_DEFAULT_IANA = 'Asia/Samarkand';
const UZ_TOSHKENT_AREA_IANA = 'Asia/Tashkent';

const UZ_REGION_IDS = new Set([
  'tashkent-city',
  'tashkent',
  'andijon',
  'buxoro',
  'jizzax',
  'qashqadaryo',
  'navoiy',
  'namangan',
  'samarqand',
  'surxondaryo',
  'sirdaryo',
  'fargona',
  'xorazm',
  'qoraqalpogiston',
]);

function pickStr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function isValidIanaTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format();
    return true;
  } catch {
    return false;
  }
}

function regionIdFromMerchant(rec: Record<string, unknown>): string | undefined {
  const candidates = [
    pickStr(rec.regionId),
    pickStr(rec.region_id),
    pickStr(rec.region),
  ].filter(Boolean) as string[];
  for (const raw of candidates) {
    if (UZ_REGION_IDS.has(raw)) return raw;
  }
  return undefined;
}

export function timeZoneFromMerchantRecord(rec: Record<string, unknown> | null | undefined): string {
  if (!rec) return UZ_DEFAULT_IANA;
  const explicit =
    pickStr(rec.timeZone) ?? pickStr(rec.timezone) ?? pickStr(rec.ianaTimeZone) ?? pickStr(rec.iana_timezone);
  if (explicit && isValidIanaTimeZone(explicit)) return explicit;

  const rid = regionIdFromMerchant(rec);
  if (rid === 'tashkent-city' || rid === 'tashkent') return UZ_TOSHKENT_AREA_IANA;
  if (rid && UZ_REGION_IDS.has(rid)) return UZ_DEFAULT_IANA;

  return UZ_DEFAULT_IANA;
}
