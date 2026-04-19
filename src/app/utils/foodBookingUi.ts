/** Taom / restoran joy bron UI: vaqt slotlari, tarkib normalizatsiyasi */

export type BookingUnavailableRange = { from: string; to: string };

export function diningRoomBookingUnavailableRanges(
  room: Record<string, unknown> | null | undefined,
): BookingUnavailableRange[] {
  const raw = room?.bookingUnavailableRanges;
  if (!Array.isArray(raw)) return [];
  const out: BookingUnavailableRange[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const from = normalizeBookingTimeClient(String((row as { from?: unknown }).from ?? ''));
    const to = normalizeBookingTimeClient(String((row as { to?: unknown }).to ?? ''));
    if (!from || !to) continue;
    const fa = parseInt(from.slice(0, 2), 10) * 60 + parseInt(from.slice(3, 5), 10);
    const ta = parseInt(to.slice(0, 2), 10) * 60 + parseInt(to.slice(3, 5), 10);
    if (!Number.isFinite(fa) || !Number.isFinite(ta) || fa >= ta) continue;
    out.push({ from, to });
  }
  return out;
}

export type PublicBookingSlot = {
  id: string;
  roomId: string;
  roomName: string;
  bookingDate: string;
  bookingTime: string;
  /** HH:mm — bron oralig‘ining tugashi (mavjud bo‘lmasa server 30 daqiqa deb qabul qiladi) */
  bookingEndTime?: string;
  partySize: number;
  status: string;
};

/** Eski yozuvlar va minimal tekshiruv — server bilan mos */
export const DEFAULT_LEGACY_BOOKING_MINUTES = 30;
export const MIN_BOOKING_DURATION_MINUTES = 30;

export function normalizeBookingTimeClient(t: string): string {
  const s = String(t ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s.slice(0, 8);
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function timeToMinutes(hhmm: string): number {
  const n = normalizeBookingTimeClient(hhmm);
  const [h, m] = n.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

export function bookingTimeToMinutes(hhmm: string): number {
  return timeToMinutes(normalizeBookingTimeClient(hhmm));
}

export function minutesToBookingHHMM(totalMinutes: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.floor(totalMinutes)));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Mavjud bron uchun [start,end) — end ixtiyoriy bo‘lmasa start+30 */
export function inferBookingEndTimeClient(b: PublicBookingSlot): string {
  const start = normalizeBookingTimeClient(b.bookingTime);
  const sm = timeToMinutes(start);
  if (sm < 0) return '';
  const rawEnd = b.bookingEndTime ? normalizeBookingTimeClient(b.bookingEndTime) : '';
  if (rawEnd) {
    const em = timeToMinutes(rawEnd);
    if (em > sm) return minutesToBookingHHMM(em);
  }
  return minutesToBookingHHMM(sm + DEFAULT_LEGACY_BOOKING_MINUTES);
}

export function formatBookingRangeLabel(b: PublicBookingSlot): string {
  const a = normalizeBookingTimeClient(b.bookingTime);
  const z = inferBookingEndTimeClient(b);
  if (!a) return '';
  if (!z || a === z) return a;
  return `${a}–${z}`;
}

function intervalOverlapsHalfOpen(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

export function bookingHHMMIntervalTouchesUnavailable(
  startHHMM: string,
  endHHMM: string,
  ranges: BookingUnavailableRange[],
): boolean {
  const sm = timeToMinutes(normalizeBookingTimeClient(startHHMM));
  const em = timeToMinutes(normalizeBookingTimeClient(endHHMM));
  if (sm < 0 || em <= sm) return true;
  return bookingIntervalOverlapsUnavailable(sm, em, ranges);
}

/** [startMin,endMin) yopiq restoran oralig‘i bilan kesishadimi */
export function bookingIntervalOverlapsUnavailable(
  startMin: number,
  endMin: number,
  ranges: BookingUnavailableRange[],
): boolean {
  for (const r of ranges) {
    const a = timeToMinutes(r.from);
    const b = timeToMinutes(r.to);
    if (a < 0 || b < 0 || a >= b) continue;
    if (intervalOverlapsHalfOpen(startMin, endMin, a, b)) return true;
  }
  return false;
}

export function listActiveBookingIntervalsMinutes(
  bookings: PublicBookingSlot[],
  roomId: string,
  date: string,
): { startMin: number; endMin: number }[] {
  const active = activePublicBookingsForRoomDate(bookings, roomId, date);
  const out: { startMin: number; endMin: number }[] = [];
  for (const b of active) {
    const sm = timeToMinutes(normalizeBookingTimeClient(b.bookingTime));
    if (sm < 0) continue;
    const em = timeToMinutes(inferBookingEndTimeClient(b));
    if (em <= sm) continue;
    out.push({ startMin: sm, endMin: em });
  }
  return out;
}

function firstAlignedEndMinute(startMin: number, minSpan: number, step: number): number {
  const minEnd = startMin + Math.max(15, minSpan);
  let e = minEnd;
  const rem = (e - startMin) % step;
  if (rem !== 0) e += step - rem;
  return e;
}

function intervalConflictsWithBookings(
  startMin: number,
  endMin: number,
  intervals: { startMin: number; endMin: number }[],
): boolean {
  for (const x of intervals) {
    if (intervalOverlapsHalfOpen(startMin, endMin, x.startMin, x.endMin)) return true;
  }
  return false;
}

/** Yangi [start,end) mavjud faol bronlar bilan kesishadimi */
export function newBookingOverlapsExisting(
  startHHMM: string,
  endHHMM: string,
  bookings: PublicBookingSlot[],
  roomId: string,
  date: string,
): boolean {
  const sm = timeToMinutes(normalizeBookingTimeClient(startHHMM));
  const em = timeToMinutes(normalizeBookingTimeClient(endHHMM));
  if (sm < 0 || em <= sm) return true;
  const ivs = listActiveBookingIntervalsMinutes(bookings, roomId, date);
  return intervalConflictsWithBookings(sm, em, ivs);
}

/** [from, to) — tushlik: 10:00–13:00 → 10:00 ≤ slot < 13:00 band */
export function isTimeInUnavailableRange(time: string, ranges: BookingUnavailableRange[]): boolean {
  const t = timeToMinutes(time);
  if (t < 0) return false;
  for (const r of ranges) {
    const a = timeToMinutes(r.from);
    const b = timeToMinutes(r.to);
    if (a < 0 || b < 0 || a >= b) continue;
    if (t >= a && t < b) return true;
  }
  return false;
}

export function normalizeDishIngredients(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[,;\n\r|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function activePublicBookingsForRoomDate(
  bookings: PublicBookingSlot[],
  roomId: string,
  date: string,
): PublicBookingSlot[] {
  const rid = String(roomId || '').trim();
  const d = String(date || '').trim();
  return bookings.filter((b) => {
    if (String(b.roomId) !== rid || String(b.bookingDate) !== d) return false;
    const st = String(b.status || '').toLowerCase();
    return st !== 'cancelled' && st !== 'rejected' && st !== 'canceled';
  });
}

/** Tugash vaqti — boshlanish va mavjud bronlar/yopiq vaqtlar bilan mos */
export function generateBookingEndSlotOptions(params: {
  bookingStart: string;
  stepMinutes: number;
  dayEndHour: number;
  unavailableRanges: BookingUnavailableRange[];
  existingBookings: PublicBookingSlot[];
  roomId: string;
  bookingDate: string;
  minBookingMinutes: number;
}): string[] {
  const step = Math.max(15, Math.min(120, Math.floor(params.stepMinutes) || 30));
  const dayEndMin = Math.max(0, Math.min(24, params.dayEndHour)) * 60;
  const startMin = timeToMinutes(normalizeBookingTimeClient(params.bookingStart));
  if (startMin < 0) return [];

  const booked = listActiveBookingIntervalsMinutes(
    params.existingBookings,
    params.roomId,
    params.bookingDate,
  );

  const out: string[] = [];
  let e = firstAlignedEndMinute(startMin, params.minBookingMinutes, step);
  for (; e <= dayEndMin; e += step) {
    if (bookingIntervalOverlapsUnavailable(startMin, e, params.unavailableRanges)) continue;
    if (intervalConflictsWithBookings(startMin, e, booked)) continue;
    out.push(minutesToBookingHHMM(e));
  }
  return out;
}

/** Boshlanish slotlari — kamida bitta ruxsat etilgan tugash vaqti mavjud bo‘lgan vaqtlar */
export function generateBookingTimeSlotOptions(params: {
  stepMinutes: number;
  dayStartHour: number;
  dayEndHour: number;
  unavailableRanges: BookingUnavailableRange[];
  existingBookings: PublicBookingSlot[];
  roomId: string;
  bookingDate: string;
  minBookingMinutes: number;
}): string[] {
  const { stepMinutes, dayStartHour, dayEndHour } = params;
  const step = Math.max(15, Math.min(120, Math.floor(stepMinutes) || 30));
  const start = Math.max(0, Math.min(23, dayStartHour)) * 60;
  const end = Math.max(start + step, Math.min(24, dayEndHour) * 60);
  const out: string[] = [];
  for (let m = start; m < end; m += step) {
    const slot = minutesToBookingHHMM(m);
    const ends = generateBookingEndSlotOptions({
      bookingStart: slot,
      stepMinutes: step,
      dayEndHour,
      unavailableRanges: params.unavailableRanges,
      existingBookings: params.existingBookings,
      roomId: params.roomId,
      bookingDate: params.bookingDate,
      minBookingMinutes: params.minBookingMinutes,
    });
    if (ends.length > 0) out.push(slot);
  }
  return out;
}
