import type { DillerData, DillerExpense } from './dillerData';
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
  try {
    return new Date(iso).toLocaleString('uz-UZ', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export { defaultCustomHistoryRange };
