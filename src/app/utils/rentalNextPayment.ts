const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;
const MS_MIN = 60_000;

export type PaymentCountdownTone = 'ok' | 'soon' | 'overdue';

export function computePaymentCountdown(
  nextPaymentDueIso: string | null | undefined,
  nowMs: number = Date.now(),
): {
  dueDate: Date;
  remainingUz: string;
  overdue: boolean;
  tone: PaymentCountdownTone;
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

  let remainingUz: string;
  if (overdue) {
    if (days > 0) remainingUz = `Kechikkan: ${days} kun ${hours} soat`;
    else if (hours > 0) remainingUz = `Kechikkan: ${hours} soat ${mins} daqiqa`;
    else remainingUz = `Kechikkan: ${mins} daqiqa`;
  } else {
    if (days > 0) remainingUz = `Qoldi: ${days} kun ${hours} soat`;
    else if (hours > 0) remainingUz = `Qoldi: ${hours} soat ${mins} daqiqa`;
    else remainingUz = `Qoldi: ${mins} daqiqa`;
  }

  return { dueDate: due, remainingUz, overdue, tone };
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
