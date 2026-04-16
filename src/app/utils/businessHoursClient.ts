/**
 * Server `businessHours.ts` bilan bir xil mantiq — mijoz UI.
 * Soat: do‘kon/restoran `region` / `timeZone` bo‘yicha (Toshkent doimiy emas).
 * Do‘kon/restoran `workingHours` / `workTime` / `openingHours` / `contact.workHours` maydonlari.
 */

import { timeZoneFromMerchantRecord } from './merchantRegionTimeZone';

export type ParsedDayRange = { startMin: number; endMin: number };

const FALLBACK_WALL_CLOCK_TZ = 'Asia/Samarkand';

export function getWallClockHMS(timeZone: string, d = new Date()): { h: number; m: number; s: number } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = f.formatToParts(d);
  const num = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  return { h: num('hour'), m: num('minute'), s: num('second') };
}

/** Orqaga moslik — faqat Toshkent zonasi kerak bo‘lsa */
export function getTashkentHMS(d = new Date()): { h: number; m: number; s: number } {
  return getWallClockHMS('Asia/Tashkent', d);
}

export function parseHoursRange(input: string | null | undefined): ParsedDayRange | null {
  if (!input || typeof input !== 'string') return null;
  const s = input.replace(/\u2013|\u2014/g, '-').trim();
  const m = s.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const sh = clampHour(Number(m[1]));
  const sm = clampMin(Number(m[2]));
  const eh = clampHour(Number(m[3]));
  const em = clampMin(Number(m[4]));
  return { startMin: sh * 60 + sm, endMin: eh * 60 + em };
}

function clampHour(h: number): number {
  if (!Number.isFinite(h)) return 0;
  return Math.min(23, Math.max(0, Math.floor(h)));
}

function clampMin(m: number): number {
  if (!Number.isFinite(m)) return 0;
  return Math.min(59, Math.max(0, Math.floor(m)));
}

function isOpenForRange(r: ParsedDayRange, nowSecFromMidnight: number): boolean {
  const S0 = r.startMin * 60;
  const S1 = r.endMin * 60;
  if (r.startMin < r.endMin) {
    return nowSecFromMidnight >= S0 && nowSecFromMidnight < S1;
  }
  if (r.startMin > r.endMin) {
    return nowSecFromMidnight >= S0 || nowSecFromMidnight < S1;
  }
  return true;
}

function secondsUntilOpenAfterClose(r: ParsedDayRange, nowSecFromMidnight: number): number {
  const S0 = r.startMin * 60;
  const S1 = r.endMin * 60;
  if (r.startMin < r.endMin) {
    if (nowSecFromMidnight >= S0 && nowSecFromMidnight < S1) return 0;
    if (nowSecFromMidnight < S0) return S0 - nowSecFromMidnight;
    return 86400 - nowSecFromMidnight + S0;
  }
  if (r.startMin > r.endMin) {
    if (nowSecFromMidnight >= S0 || nowSecFromMidnight < S1) return 0;
    return S0 - nowSecFromMidnight;
  }
  return 0;
}

export function collectHourStringsFromRecord(rec: Record<string, unknown> | null | undefined): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
  };
  if (!rec) return out;
  push(rec.workingHours);
  push(rec.workTime);
  push(rec.openingHours);
  const c = rec.contact;
  if (c && typeof c === 'object') push((c as Record<string, unknown>).workHours);
  return out;
}

export function firstParseableRange(strings: string[]): ParsedDayRange | null {
  for (const s of strings) {
    const r = parseHoursRange(s);
    if (r) return r;
  }
  return null;
}

export type EvaluateHoursResult = {
  allowed: boolean;
  alwaysOn: boolean;
  range: ParsedDayRange | null;
  nextOpenIso: string | null;
  label: string | null;
};

function formatRangeLabel(r: ParsedDayRange): string {
  const fmt = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  return `${fmt(r.startMin)}–${fmt(r.endMin)}`;
}

export function evaluateHourStrings(
  strings: string[],
  ref = new Date(),
  timeZone: string = FALLBACK_WALL_CLOCK_TZ,
): EvaluateHoursResult {
  const range = firstParseableRange(strings);
  if (!range || range.startMin === range.endMin) {
    return { allowed: true, alwaysOn: true, range: null, nextOpenIso: null, label: null };
  }
  const { h, m, s } = getWallClockHMS(timeZone, ref);
  const nowSec = h * 3600 + m * 60 + s;
  if (isOpenForRange(range, nowSec)) {
    return { allowed: true, alwaysOn: false, range, nextOpenIso: null, label: formatRangeLabel(range) };
  }
  const wait = secondsUntilOpenAfterClose(range, nowSec);
  const nextOpenIso = new Date(ref.getTime() + wait * 1000).toISOString();
  return {
    allowed: false,
    alwaysOn: false,
    range,
    nextOpenIso,
    label: formatRangeLabel(range),
  };
}

/** Yozuvdagi ish vaqti + viloyat/tuman bo‘yicha mahalliy soat */
export function evaluateMerchantHours(
  rec: Record<string, unknown> | null | undefined,
  ref = new Date(),
): EvaluateHoursResult {
  const tz = timeZoneFromMerchantRecord(rec);
  return evaluateHourStrings(collectHourStringsFromRecord(rec), ref, tz);
}

export function isMerchantHoursOpen(rec: Record<string, unknown> | null | undefined, ref = new Date()): boolean {
  return evaluateMerchantHours(rec, ref).allowed;
}

export { timeZoneFromMerchantRecord } from './merchantRegionTimeZone';
