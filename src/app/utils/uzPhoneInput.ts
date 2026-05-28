/** 9 ta mahalliy raqam (998 siz) */
export function uzPhoneLocalDigits(raw: string): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 9);
}

/** API / SMS uchun: 998XXXXXXXXX yoki bo'sh */
export function uzPhoneTo998(raw: string): string {
  const d = uzPhoneLocalDigits(raw);
  return d.length > 0 ? `998${d}` : '';
}

export function formatUzPhoneLocal(digits9: string): string {
  const d = uzPhoneLocalDigits(digits9);
  if (!d) return '';
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
  if (d.length <= 7) return `${d.slice(0, 2)} ${d.slice(2, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 5)}-${d.slice(5, 7)}-${d.slice(7, 9)}`;
}

export function formatUzPhoneDisplay(stored998: string): string {
  const d = uzPhoneLocalDigits(stored998);
  if (!d) return '';
  return `+998 ${formatUzPhoneLocal(d)}`;
}
