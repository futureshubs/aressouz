/**
 * Do‘kon/restoran joylashgan viloyat/tuman (yoki API dagi `timeZone`) bo‘yicha
 * ish vaqti uchun IANA vaqt zonasi — doimiy "Toshkent" o‘rniga mahalliy hisob.
 */

import { regions } from '../data/regions';

/** O‘zbekiston rasmiy bitta vaqti (UTC+5); IANA nomi respublika bo‘yicha */
const UZ_DEFAULT_IANA = 'Asia/Samarkand';
/** Toshkent shahri va viloyati — xuddi shu offset, lekin hudud nomi bilan */
const UZ_TOSHKENT_AREA_IANA = 'Asia/Tashkent';

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
    if (regions.some((r) => r.id === raw)) return raw;
    const byName = regions.find(
      (r) => r.name === raw || r.name.toLowerCase() === raw.toLowerCase(),
    );
    if (byName) return byName.id;
  }
  return undefined;
}

/**
 * KV / API yozuvidan IANA zona.
 * 1) `timeZone` | `timezone` | `ianaTimeZone` (to‘g‘ridan-to‘g‘ri)
 * 2) `region` / `regionId` — ro‘yxatdagi viloyat
 * 3) noma’lum — `Asia/Samarkand` (O‘zbekiston markaziy vaqti)
 */
export function timeZoneFromMerchantRecord(rec: Record<string, unknown> | null | undefined): string {
  if (!rec) return UZ_DEFAULT_IANA;
  const explicit =
    pickStr(rec.timeZone) ?? pickStr(rec.timezone) ?? pickStr(rec.ianaTimeZone) ?? pickStr(rec.iana_timezone);
  if (explicit && isValidIanaTimeZone(explicit)) return explicit;

  const rid = regionIdFromMerchant(rec);
  if (rid === 'tashkent-city' || rid === 'tashkent') return UZ_TOSHKENT_AREA_IANA;
  if (rid && regions.some((r) => r.id === rid)) return UZ_DEFAULT_IANA;

  return UZ_DEFAULT_IANA;
}
