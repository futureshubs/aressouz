const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;
const MS_MIN = 60_000;

export type PaymentCountdownTone = 'ok' | 'soon' | 'overdue';

export function computePaymentCountdown(
  nextPaymentDueIso: string | null | undefined,
  nowMs: number = Date.now(),
): {
  dueDate: Date;
  overdue: boolean;
  tone: PaymentCountdownTone;
  days: number;
  hours: number;
  mins: number;
} | null {
  if (!nextPaymentDueIso) return null;
  const due = new Date(nextPaymentDueIso);
  const t = due.getTime();
  if (Number.isNaN(t)) return null;
  const diff = t - nowMs;
  const threeDays = 3 * MS_DAY;
  let tone: PaymentCountdownTone = 'ok';
  if (diff <= 0) tone = 'overdue';
  else if (diff < threeDays) tone = 'soon';

  const overdue = diff <= 0;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / MS_DAY);
  const hours = Math.floor((abs % MS_DAY) / MS_HOUR);
  const mins = Math.floor((abs % MS_HOUR) / MS_MIN);

  return { dueDate: due, overdue, tone, days, hours, mins };
}

export function formatDueDateTimeUz(d: Date): string {
  return d.toLocaleString('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' });
}

export function nextInstallmentAmountUz(
  pricePerPeriod: number | undefined,
  quantity: number | undefined,
): string | null {
  const p = Number(pricePerPeriod);
  const q = Math.max(1, Number(quantity) || 1);
  if (!Number.isFinite(p) || p <= 0) return null;
  return `${Math.round(p * q).toLocaleString('uz-UZ')} so'm`;
}
