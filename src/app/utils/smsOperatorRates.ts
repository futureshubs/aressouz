export type SmsOperatorId =
  | 'mobiuz'
  | 'beeline'
  | 'ucell'
  | 'humans'
  | 'uzmobile'
  | 'perfectum'
  | 'unknown';

export type SmsOperatorRate = {
  id: SmsOperatorId;
  label: string;
  serviceTypeUzs: number;
};

export const SMS_OPERATOR_RATES: SmsOperatorRate[] = [
  { id: 'mobiuz', label: 'Mobiuz', serviceTypeUzs: 220 },
  { id: 'beeline', label: 'Beeline', serviceTypeUzs: 230 },
  { id: 'ucell', label: 'Ucell', serviceTypeUzs: 320 },
  { id: 'humans', label: 'Humans', serviceTypeUzs: 190 },
  { id: 'uzmobile', label: 'Uzmobile', serviceTypeUzs: 290 },
  { id: 'perfectum', label: 'Perfectum', serviceTypeUzs: 190 },
];

export function currentBillingMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatUzs(n: number) {
  return `${Math.max(0, Math.floor(n)).toLocaleString('uz-UZ')} so'm`;
}
