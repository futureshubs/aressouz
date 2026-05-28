export type SmsOperatorId =
  | "mobiuz"
  | "beeline"
  | "ucell"
  | "humans"
  | "uzmobile"
  | "perfectum"
  | "unknown";

export type SmsOperatorRate = {
  id: SmsOperatorId;
  label: string;
  serviceTypeUzs: number;
};

/** Servis turdagi SMS — operator bo‘yicha (so‘m) */
export const SMS_OPERATOR_RATES: SmsOperatorRate[] = [
  { id: "mobiuz", label: "Mobiuz", serviceTypeUzs: 220 },
  { id: "beeline", label: "Beeline", serviceTypeUzs: 230 },
  { id: "ucell", label: "Ucell", serviceTypeUzs: 320 },
  { id: "humans", label: "Humans", serviceTypeUzs: 190 },
  { id: "uzmobile", label: "Uzmobile", serviceTypeUzs: 290 },
  { id: "perfectum", label: "Perfectum", serviceTypeUzs: 190 },
];

const RATE_MAP = Object.fromEntries(
  SMS_OPERATOR_RATES.map((r) => [r.id, r.serviceTypeUzs]),
) as Record<SmsOperatorId, number>;

/** 998XXXXXXXXX */
export function detectSmsOperator(phone: string): SmsOperatorId {
  const d = String(phone || "").replace(/\D/g, "");
  const local = d.startsWith("998") ? d.slice(3, 5) : d.slice(0, 2);
  if (local === "90" || local === "91") return "beeline";
  if (local === "93" || local === "94") return "ucell";
  if (local === "97") return "mobiuz";
  if (local === "33") return "humans";
  if (local === "95") return "uzmobile";
  if (local === "98") return "perfectum";
  return "unknown";
}

export function smsCostForPhone(phone: string): { operator: SmsOperatorId; costUzs: number } {
  const operator = detectSmsOperator(phone);
  const costUzs = operator === "unknown" ? 250 : (RATE_MAP[operator] ?? 250);
  return { operator, costUzs };
}

export function currentBillingMonth(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
