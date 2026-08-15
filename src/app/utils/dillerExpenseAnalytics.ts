import type { DillerData, DillerExpense } from './dillerData';
import { formatDillerDateTime } from './dillerTime';
import {
  defaultCustomHistoryRange,
  filterSalesByPeriod,
  type HistoryDateRange,
  type HistoryPeriod,
} from './dillerDebtAnalytics';

export type ExpenseSummary = {
  total: number;
  count: number;
  naqdTotal: number;
  kartaTotal: number;
  naqdCount: number;
  kartaCount: number;
};

export type ExpenseCategorySummary = {
  key: string;
  label: string;
  total: number;
  count: number;
  naqdTotal: number;
  kartaTotal: number;
  sharePercent: number;
  expenses: DillerExpense[];
};

export function normalizeExpensePurposeKey(purpose: string): string {
  return purpose.trim().toLowerCase().replace(/\s+/g, ' ') || 'boshqa';
}

function pickCategoryLabel(expenses: DillerExpense[]): string {
  const counts = new Map<string, number>();
  for (const e of expenses) {
    const label = e.purpose.trim() || 'Boshqa';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Boshqa';
}

export function groupExpensesByPurpose(expenses: DillerExpense[]): ExpenseCategorySummary[] {
  const map = new Map<string, DillerExpense[]>();
  for (const e of expenses) {
    const key = normalizeExpensePurposeKey(e.purpose);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return [...map.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      let total = 0;
      let naqdTotal = 0;
      let kartaTotal = 0;
      for (const e of sorted) {
        total += e.amount;
        if (e.paymentMethod === 'karta') kartaTotal += e.amount;
        else naqdTotal += e.amount;
      }
      return {
        key,
        label: pickCategoryLabel(sorted),
        total,
        count: sorted.length,
        naqdTotal,
        kartaTotal,
        sharePercent: grandTotal > 0 ? Math.round((total / grandTotal) * 1000) / 10 : 0,
        expenses: sorted,
      };
    })
    .sort((a, b) => b.total - a.total || b.count - a.count);
}

export function getMaxExpenseCategoryTotal(categories: ExpenseCategorySummary[]): number {
  return Math.max(1, ...categories.map((c) => c.total));
}

export function filterExpensesByPeriod(
  expenses: DillerExpense[],
  period: HistoryPeriod,
  customRange?: HistoryDateRange,
): DillerExpense[] {
  const salesProxy = expenses.map((e) => ({
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
  const filtered = filterSalesByPeriod(salesProxy, period, customRange);
  const ids = new Set(filtered.map((s) => s.id));
  return expenses.filter((e) => ids.has(e.id));
}

export function computeExpenseSummary(expenses: DillerExpense[]): ExpenseSummary {
  let total = 0;
  let naqdTotal = 0;
  let kartaTotal = 0;
  let naqdCount = 0;
  let kartaCount = 0;
  for (const e of expenses) {
    total += e.amount;
    if (e.paymentMethod === 'karta') {
      kartaTotal += e.amount;
      kartaCount += 1;
    } else {
      naqdTotal += e.amount;
      naqdCount += 1;
    }
  }
  return { total, count: expenses.length, naqdTotal, kartaTotal, naqdCount, kartaCount };
}

export function computeAllExpenseSummary(data: DillerData): ExpenseSummary {
  return computeExpenseSummary(data.expenses);
}

export function formatExpenseDate(iso: string): string {
  return formatDillerDateTime(iso, { year: 'numeric' });
}

export { defaultCustomHistoryRange };
