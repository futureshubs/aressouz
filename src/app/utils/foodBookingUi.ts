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
  partySize: number;
  status: string;
};

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

export function generateBookingTimeSlotOptions(params: {
  stepMinutes: number;
  dayStartHour: number;
  dayEndHour: number;
  unavailableRanges: BookingUnavailableRange[];
  bookedNormalizedTimes: Set<string>;
}): string[] {
  const { stepMinutes, dayStartHour, dayEndHour, unavailableRanges, bookedNormalizedTimes } = params;
  const step = Math.max(15, Math.min(120, Math.floor(stepMinutes) || 30));
  const start = Math.max(0, Math.min(23, dayStartHour)) * 60;
  const end = Math.max(start + step, Math.min(24, dayEndHour) * 60);
  const out: string[] = [];
  for (let m = start; m < end; m += step) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const slot = `${hh}:${mm}`;
    if (isTimeInUnavailableRange(slot, unavailableRanges)) continue;
    if (bookedNormalizedTimes.has(normalizeBookingTimeClient(slot))) continue;
    out.push(slot);
  }
  return out;
}
