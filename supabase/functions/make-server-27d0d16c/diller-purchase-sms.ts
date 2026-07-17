/**
 * Eskiz informatsion SMS: purchase_info (tranzaksion, reklamasiz)
 *
 * Eskiz panelida tasdiqlash uchun shablon matni — frontend `dillerPurchaseSms.ts` bilan bir xil.
 */

export type PurchaseSmsVars = {
  mijoz: string;
  dokon: string;
  mahsulot: string;
  miqdor: number | string;
  jami: number;
  chegirma: number;
  sana: string;
  diller: string;
  telefon: string;
  qarz?: number;
  muddat?: string;
};

export function formatSmsMoney(n: number): string {
  return Math.round(Math.max(0, n)).toLocaleString("uz-UZ").replace(/,/g, " ");
}

function cleanLine(s: string): string {
  return String(s || "").replace(/\s+/g, " ").trim();
}

export function buildPurchaseInfoSms(vars: PurchaseSmsVars): string {
  const qarz = Math.max(0, Math.round(Number(vars.qarz) || 0));
  const muddat = cleanLine(vars.muddat || "");
  const qarzQatori =
    qarz > 0
      ? `Qarz: ${formatSmsMoney(qarz)} so'm\nTo'lov muddati: ${muddat || "—"}\n`
      : "";

  const body = `Hurmatli ${cleanLine(vars.mijoz) || "mijoz"}, xaridingiz rasmiylashtirildi.

Do'kon: ${cleanLine(vars.dokon) || "—"}
Mahsulot: ${cleanLine(vars.mahsulot) || "—"}
Miqdor: ${vars.miqdor} dona
Jami: ${formatSmsMoney(vars.jami)} so'm
Chegirma: ${Math.max(0, Math.round(Number(vars.chegirma) || 0))}%
${qarzQatori}Sana: ${cleanLine(vars.sana) || "—"}

Mas'ul diller: ${cleanLine(vars.diller) || "—"}
Tel: ${cleanLine(vars.telefon) || "—"}`;

  return body.replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeUzSmsPhone(phone: string): string | null {
  const d = String(phone || "").replace(/\D/g, "");
  if (/^998\d{9}$/.test(d)) return d;
  if (/^9\d{8}$/.test(d)) return `998${d}`;
  if (d.length === 9 && d.startsWith("9")) return `998${d}`;
  return null;
}
