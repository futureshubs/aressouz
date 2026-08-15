/**
 * Butun /diller panel kalendar vaqti: O‘zbekiston, UTC+05:00 (DST yo‘q).
 * Saqlash ISO (UTC) qoladi; kun, muddat, filtrlash va ko‘rsatish shu zonada.
 */

export const DILLER_TIME_ZONE = 'Asia/Tashkent';
export const DILLER_UTC_OFFSET = '+05:00';

function asDate(at: Date | string = new Date()): Date {
  return typeof at === 'string' ? new Date(at) : at;
}

function part(
  d: Date,
  type: Intl.DateTimeFormatPartTypes,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const found = new Intl.DateTimeFormat('en-GB', {
    timeZone: DILLER_TIME_ZONE,
    hour12: false,
    ...opts,
  })
    .formatToParts(d)
    .find((p) => p.type === type);
  return found?.value ?? '';
}

/** YYYY-MM-DD — Toshkent kalendar kuni */
export function dillerCalendarDate(at: Date | string = new Date()): string {
  const d = asDate(at);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: DILLER_TIME_ZONE });
}

export function dillerTodayDate(): string {
  return dillerCalendarDate(new Date());
}

export function dillerYesterdayDate(): string {
  return dillerAddCalendarDays(dillerTodayDate(), -1);
}

export function dillerMonthKey(at: Date | string): string {
  const key = dillerCalendarDate(at);
  return key ? key.slice(0, 7) : '';
}

export function dillerDayStartMs(yyyyMmDd: string): number {
  const t = Date.parse(`${yyyyMmDd}T00:00:00${DILLER_UTC_OFFSET}`);
  return Number.isFinite(t) ? t : NaN;
}

export function dillerDayEndMs(yyyyMmDd: string): number {
  const t = Date.parse(`${yyyyMmDd}T23:59:59.999${DILLER_UTC_OFFSET}`);
  return Number.isFinite(t) ? t : NaN;
}

export function dillerStartOfTodayMs(): number {
  return dillerDayStartMs(dillerTodayDate());
}

export function dillerAddCalendarDays(yyyyMmDd: string, delta: number): string {
  const start = dillerDayStartMs(yyyyMmDd);
  if (!Number.isFinite(start)) return yyyyMmDd;
  return dillerCalendarDate(new Date(start + delta * 86_400_000));
}

export function dillerAddCalendarMonths(yyyyMmDd: string, deltaMonths: number): string {
  const [y, m, day] = yyyyMmDd.split('-').map(Number);
  if (!y || !m || !day) return yyyyMmDd;
  const utc = new Date(Date.UTC(y, m - 1 + deltaMonths, day));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(
    utc.getUTCDate(),
  ).padStart(2, '0')}`;
}

export function dillerCalendarDaysBetween(fromYmd: string, toYmd: string): number {
  const a = dillerDayStartMs(fromYmd);
  const b = dillerDayStartMs(toYmd);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function isDillerToday(iso: string): boolean {
  return dillerCalendarDate(iso) === dillerTodayDate();
}

export function isDillerYesterday(iso: string): boolean {
  return dillerCalendarDate(iso) === dillerYesterdayDate();
}

/** type="date" / davr filtri uchun Toshkent YYYY-MM-DD */
export function toDillerIsoDate(d: Date = new Date()): string {
  return dillerCalendarDate(d);
}

/** YYYY-MM-DD muddat (yoki ISO) — Toshkent kalendar kuni */
export function dillerDueDateKey(iso: string | undefined | null): string {
  const s = String(iso || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return dillerCalendarDate(s);
}

export function formatDillerDate(
  iso: string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return '—';
  const keyIfDay = /^\d{4}-\d{2}-\d{2}$/.test(iso.trim()) ? iso.trim() : '';
  const d = keyIfDay
    ? new Date(`${keyIfDay}T12:00:00${DILLER_UTC_OFFSET}`)
    : new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('uz-UZ', {
    timeZone: DILLER_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...opts,
  });
}

export function formatDillerDateTime(
  iso: string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('uz-UZ', {
    timeZone: DILLER_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  });
}

export function formatDillerTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString('uz-UZ', {
    timeZone: DILLER_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Chek / SMS uchun: 15.08.2026 */
export function formatDillerDayDot(isoOrDate: string): string {
  const s = String(isoOrDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  }
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  const ymd = dillerCalendarDate(d);
  if (!ymd) return s;
  const [y, m, day] = ymd.split('-');
  return `${day}.${m}.${y}`;
}

/** datetime-local input (Toshkent devori) */
export function dillerToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const y = part(d, 'year', { year: 'numeric' });
  const m = part(d, 'month', { month: '2-digit' });
  const day = part(d, 'day', { day: '2-digit' });
  let h = part(d, 'hour', { hour: '2-digit' });
  const min = part(d, 'minute', { minute: '2-digit' });
  if (!y || !m || !day) return '';
  if (h === '24') h = '00';
  return `${y}-${m}-${day}T${h.padStart(2, '0')}:${min.padStart(2, '0')}`;
}

export function dillerDatetimeLocalToIso(local: string): string {
  const s = String(local || '').trim();
  if (!s) return new Date().toISOString();
  const stamp = s.length === 16 ? `${s}:00` : s;
  const t = Date.parse(`${stamp}${DILLER_UTC_OFFSET}`);
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}
