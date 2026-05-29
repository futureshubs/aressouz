export type DishResumeCountdownParts = {
  days: number;
  hours: number;
  mins: number;
  secs: number;
};

export function dishIsInactiveFlag(raw: unknown): boolean {
  if (raw === false) return true;
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'false' || s === '0';
}

/** Restoran bekor qilgandan keyin taom vaqtincha sotilmaydi (`isActive: false` + `autoResumeAt`). */
export function isDishTemporarilyStopped(dish: {
  isActive?: boolean;
  autoResumeAt?: string | null;
} | null | undefined): boolean {
  if (!dish || !dishIsInactiveFlag(dish.isActive)) return false;
  const resumeAt = String(dish.autoResumeAt || '').trim();
  if (!resumeAt) return true;
  const t = new Date(resumeAt).getTime();
  return Number.isFinite(t) && t > Date.now();
}

export function dishStopLabelUz(dish: { stopLabel?: string | null } | null | undefined): string {
  return String(dish?.stopLabel || '').trim() || 'Tugadi';
}

export function computeDishResumeCountdown(
  autoResumeAt: string | null | undefined,
  now = Date.now(),
): DishResumeCountdownParts | null {
  const resumeAt = String(autoResumeAt || '').trim();
  if (!resumeAt) return null;
  const target = new Date(resumeAt).getTime();
  if (!Number.isFinite(target) || target <= now) return null;
  const ms = target - now;
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    mins: Math.floor((ms % 3600000) / 60000),
    secs: Math.floor((ms % 60000) / 1000),
  };
}

export function formatDishResumeCountdownHms(parts: DishResumeCountdownParts): string {
  const { days, hours, mins, secs } = parts;
  const dayPart = days > 0 ? `${days} kun ` : '';
  return `${dayPart}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Mijoz UI: vaqt o‘tgan STOP taomlarni lokal ro‘yxatda qayta yoqish (server GET ham `resumeExpiredDishStops` qiladi). */
export function patchDishesResumeExpired<T extends Record<string, unknown>>(
  dishes: T[],
  now = Date.now(),
): T[] {
  return dishes.map((d) => {
    if (!dishIsInactiveFlag((d as { isActive?: unknown }).isActive)) return d;
    const resumeAt = String(d.autoResumeAt || '').trim();
    if (!resumeAt) return d;
    if (new Date(resumeAt).getTime() > now) return d;
    const next = { ...d, isActive: true };
    delete (next as { autoResumeAt?: string }).autoResumeAt;
    delete (next as { stopReason?: string }).stopReason;
    delete (next as { stopLabel?: string }).stopLabel;
    delete (next as { cancelSourceOrderId?: string }).cancelSourceOrderId;
    return next;
  });
}
