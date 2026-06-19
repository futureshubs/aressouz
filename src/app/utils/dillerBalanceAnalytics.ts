import type { DillerBalanceEntry, DillerData } from './dillerData';
import { filterSalesByPeriod, type HistoryDateRange, type HistoryPeriod } from './dillerDebtAnalytics';

export type BalanceChannel = 'naqd' | 'karta';

export type BalanceChannelSummary = {
  kirim: number;
  chiqim: number;
  balance: number;
  kirimCount: number;
  chiqimCount: number;
};

export type BalanceLineItem = {
  id: string;
  kind: 'kirim' | 'chiqim';
  channel: BalanceChannel;
  amount: number;
  label: string;
  sub?: string;
  createdAt: string;
};

export type BalanceBreakdown = {
  naqd: BalanceChannelSummary;
  karta: BalanceChannelSummary;
  total: BalanceChannelSummary;
  kirimLines: BalanceLineItem[];
  chiqimLines: BalanceLineItem[];
};

function summarize(
  kirim: number,
  chiqim: number,
  kirimCount: number,
  chiqimCount: number,
): BalanceChannelSummary {
  return {
    kirim,
    chiqim,
    balance: kirim - chiqim,
    kirimCount,
    chiqimCount,
  };
}

function emptyBreakdown(): BalanceBreakdown {
  const zero = summarize(0, 0, 0, 0);
  return { naqd: zero, karta: { ...zero }, total: { ...zero }, kirimLines: [], chiqimLines: [] };
}

function filterBalanceEntriesByPeriod(
  entries: DillerBalanceEntry[],
  period: HistoryPeriod,
  customRange?: HistoryDateRange,
): DillerBalanceEntry[] {
  const proxy = entries.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    storeId: '',
    productId: '',
    qty: 1,
    listUnitPrice: e.amount,
    unitPrice: e.amount,
    discountPercent: 0,
    discountAmount: 0,
    subtotal: e.amount,
    total: e.amount,
    paymentType: 'naqd' as const,
    paidAmount: e.amount,
    debtAmount: 0,
    debtDueDate: '',
    note: '',
  }));
  const filtered = filterSalesByPeriod(proxy, period, customRange);
  const ids = new Set(filtered.map((s) => s.id));
  return entries.filter((e) => ids.has(e.id));
}

function entryToLine(entry: DillerBalanceEntry): BalanceLineItem {
  return {
    id: entry.id,
    kind: entry.kind,
    channel: entry.channel,
    amount: entry.amount,
    label: entry.purpose || (entry.kind === 'kirim' ? 'Kirim' : 'Chiqim'),
    sub: entry.note.trim() || undefined,
    createdAt: entry.createdAt,
  };
}

function buildFromEntries(entries: DillerBalanceEntry[]): BalanceBreakdown {
  if (entries.length === 0) return emptyBreakdown();

  const kirimLines: BalanceLineItem[] = [];
  const chiqimLines: BalanceLineItem[] = [];

  let naqdKirim = 0;
  let naqdChiqim = 0;
  let naqdKirimCount = 0;
  let naqdChiqimCount = 0;
  let kartaKirim = 0;
  let kartaChiqim = 0;
  let kartaKirimCount = 0;
  let kartaChiqimCount = 0;

  for (const entry of entries) {
    const line = entryToLine(entry);
    if (entry.kind === 'kirim') {
      kirimLines.push(line);
      if (entry.channel === 'karta') {
        kartaKirim += entry.amount;
        kartaKirimCount += 1;
      } else {
        naqdKirim += entry.amount;
        naqdKirimCount += 1;
      }
    } else {
      chiqimLines.push(line);
      if (entry.channel === 'karta') {
        kartaChiqim += entry.amount;
        kartaChiqimCount += 1;
      } else {
        naqdChiqim += entry.amount;
        naqdChiqimCount += 1;
      }
    }
  }

  kirimLines.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  chiqimLines.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const naqd = summarize(naqdKirim, naqdChiqim, naqdKirimCount, naqdChiqimCount);
  const karta = summarize(kartaKirim, kartaChiqim, kartaKirimCount, kartaChiqimCount);
  const total = summarize(
    naqd.kirim + karta.kirim,
    naqd.chiqim + karta.chiqim,
    naqd.kirimCount + karta.kirimCount,
    naqd.chiqimCount + karta.chiqimCount,
  );

  return { naqd, karta, total, kirimLines, chiqimLines };
}

/** Joriy qoldiq — barcha qo‘lda kiritilgan yozuvlar */
export function computeBalanceTotals(data: DillerData): BalanceBreakdown {
  return buildFromEntries(data.balanceEntries ?? []);
}

/** Davr bo‘yicha kirim/chiqim ro‘yxati */
export function computeBalanceBreakdown(
  data: DillerData,
  period: HistoryPeriod,
  customRange?: HistoryDateRange,
): BalanceBreakdown {
  const entries = data.balanceEntries ?? [];
  if (period === 'all') return buildFromEntries(entries);
  return buildFromEntries(filterBalanceEntriesByPeriod(entries, period, customRange));
}

export function formatBalanceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('uz-UZ', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
