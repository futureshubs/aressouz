/**
 * Uzum Nasiya ochilish sanasi (teskari sanoq tugashi).
 * Sanani o‘zgartirish: shu fayldagi `UZUM_NASIYA_LAUNCH_AT` ni yangilang.
 */
/** Ochilgan — `VITE_UZUM_NASIYA_DISABLED=1` bo‘lsa checkoutda yashiriladi */
export const UZUM_NASIYA_LAUNCH_AT = new Date('2026-01-01T00:00:00+05:00');

export function isUzumNasiyaAvailable(nowMs: number = Date.now()): boolean {
  if (import.meta.env.VITE_UZUM_NASIYA_DISABLED === '1') return false;
  return nowMs >= UZUM_NASIYA_LAUNCH_AT.getTime();
}

export function getUzumNasiyaCountdown(nowMs: number = Date.now()) {
  const end = UZUM_NASIYA_LAUNCH_AT.getTime();
  const ms = Math.max(0, end - nowMs);
  const totalSec = Math.floor(ms / 1000);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600) % 24;
  const day = Math.floor(totalSec / 86400);
  return { day, hr, min, sec, ms, ended: ms <= 0 };
}
