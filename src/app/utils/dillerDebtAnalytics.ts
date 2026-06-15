import type { DillerData, DillerProduct, DillerSale } from './dillerData';

export type DebtStoreSummary = {
  storeId: string;
  storeName: string;
  openDebt: number;
  paidOnCredit: number;
  openCount: number;
  overdueCount: number;
};

export type DebtAnalytics = {
  openDebtTotal: number;
  paidOnCreditTotal: number;
  creditSalesTotal: number;
  openDebtCount: number;
  overdueCount: number;
  overdueTotal: number;
  dueSoonCount: number;
  naqdRevenue: number;
  totalRevenue: number;
  /** Qarzli sotuvlarda undirilgan ulush (0–100) */
  collectionRate: number;
  byStore: DebtStoreSummary[];
};

function parseDueDate(iso: string): Date | null {
  const s = iso.trim();
  if (!s) return null;
  const d = new Date(s.length <= 10 ? `${s}T12:00:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSaleDebtOpen(sale: DillerSale): boolean {
  return (sale.debtAmount ?? 0) > 0;
}

/** Qarzli sotuv to‘liq yopilgan (debtAmount = 0) */
export function isSaleDebtClosed(sale: DillerSale): boolean {
  return sale.paymentType === 'qarz' && !isSaleDebtOpen(sale);
}

export function isSaleOverdue(sale: DillerSale, now = startOfToday()): boolean {
  if (!isSaleDebtOpen(sale)) return false;
  const due = parseDueDate(sale.debtDueDate);
  if (!due) return false;
  due.setHours(0, 0, 0, 0);
  return due.getTime() < now.getTime();
}

export function isSaleDueSoon(sale: DillerSale, now = startOfToday(), withinDays = 7): boolean {
  if (!isSaleDebtOpen(sale)) return false;
  const due = parseDueDate(sale.debtDueDate);
  if (!due) return false;
  due.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + withinDays);
  return due.getTime() >= now.getTime() && due.getTime() <= end.getTime();
}

export function computeDebtAnalytics(data: DillerData, sales = data.sales): DebtAnalytics {
  const today = startOfToday();
  let openDebtTotal = 0;
  let paidOnCreditTotal = 0;
  let creditSalesTotal = 0;
  let openDebtCount = 0;
  let overdueCount = 0;
  let overdueTotal = 0;
  let dueSoonCount = 0;
  let naqdRevenue = 0;
  let totalRevenue = 0;

  const storeMap = new Map<string, DebtStoreSummary>();

  for (const sale of sales) {
    totalRevenue += sale.total;
    if (sale.paymentType === 'naqd') {
      naqdRevenue += sale.total;
    } else {
      creditSalesTotal += sale.total;
      paidOnCreditTotal += sale.paidAmount ?? 0;
    }

    const debt = sale.debtAmount ?? 0;
    if (debt > 0) {
      openDebtTotal += debt;
      openDebtCount += 1;
      if (isSaleOverdue(sale, today)) {
        overdueCount += 1;
        overdueTotal += debt;
      }
      if (isSaleDueSoon(sale, today)) dueSoonCount += 1;
    }

    const store = data.stores.find((s) => s.id === sale.storeId);
    const storeName = store?.name ?? 'Noma’lum do‘kon';
    let row = storeMap.get(sale.storeId);
    if (!row) {
      row = {
        storeId: sale.storeId,
        storeName,
        openDebt: 0,
        paidOnCredit: 0,
        openCount: 0,
        overdueCount: 0,
      };
      storeMap.set(sale.storeId, row);
    }
    if (sale.paymentType === 'qarz') {
      row.paidOnCredit += sale.paidAmount ?? 0;
    }
    if (debt > 0) {
      row.openDebt += debt;
      row.openCount += 1;
      if (isSaleOverdue(sale, today)) row.overdueCount += 1;
    }
  }

  const creditPaidPlusOpen = paidOnCreditTotal + openDebtTotal;
  const collectionRate =
    creditPaidPlusOpen > 0 ? Math.round((paidOnCreditTotal / creditPaidPlusOpen) * 1000) / 10 : 100;

  const byStore = [...storeMap.values()]
    .filter((s) => s.openDebt > 0 || s.paidOnCredit > 0)
    .sort((a, b) => b.openDebt - a.openDebt);

  return {
    openDebtTotal,
    paidOnCreditTotal,
    creditSalesTotal,
    openDebtCount,
    overdueCount,
    overdueTotal,
    dueSoonCount,
    naqdRevenue,
    totalRevenue,
    collectionRate,
    byStore,
  };
}

export type DebtFilter = 'all' | 'overdue' | 'soon' | 'open' | 'closed';

export function applyDebtFilterToCreditSales(
  creditSales: DillerSale[],
  filter: DebtFilter,
): DillerSale[] {
  const open = creditSales.filter(isSaleDebtOpen);
  const closed = creditSales.filter(isSaleDebtClosed);

  if (filter === 'closed') return closed;
  if (filter === 'all') return open;
  if (filter === 'open') return open;
  if (filter === 'overdue') return open.filter((s) => isSaleOverdue(s));
  if (filter === 'soon') return open.filter((s) => isSaleDueSoon(s));
  return open;
}

export function filterDebtSales(sales: DillerSale[], filter: DebtFilter): DillerSale[] {
  return applyDebtFilterToCreditSales(
    sales.filter((s) => s.paymentType === 'qarz'),
    filter,
  );
}

export type PeriodDebtSummary = {
  openDebtTotal: number;
  openDebtCount: number;
  overdueTotal: number;
  overdueCount: number;
  closedDebtTotal: number;
  closedDebtCount: number;
  dueSoonCount: number;
  collectedTotal: number;
  creditSalesTotal: number;
  creditSalesCount: number;
};

export function computePeriodDebtSummaryFromCreditSales(
  creditSales: DillerSale[],
  now = startOfToday(),
): PeriodDebtSummary {
  let openDebtTotal = 0;
  let openDebtCount = 0;
  let overdueTotal = 0;
  let overdueCount = 0;
  let closedDebtTotal = 0;
  let closedDebtCount = 0;
  let dueSoonCount = 0;
  let collectedTotal = 0;
  let creditSalesTotal = 0;

  for (const sale of creditSales) {
    creditSalesTotal += sale.total;
    collectedTotal += sale.paidAmount ?? 0;

    if (isSaleDebtClosed(sale)) {
      closedDebtCount += 1;
      closedDebtTotal += sale.total;
      continue;
    }

    const debt = sale.debtAmount ?? 0;
    if (debt <= 0) continue;

    openDebtTotal += debt;
    openDebtCount += 1;
    if (isSaleOverdue(sale, now)) {
      overdueCount += 1;
      overdueTotal += debt;
    }
    if (isSaleDueSoon(sale, now)) dueSoonCount += 1;
  }

  return {
    openDebtTotal,
    openDebtCount,
    overdueTotal,
    overdueCount,
    closedDebtTotal,
    closedDebtCount,
    dueSoonCount,
    collectedTotal,
    creditSalesTotal,
    creditSalesCount: creditSales.length,
  };
}

export function computePeriodDebtSummary(
  data: DillerData,
  period: HistoryPeriod,
  customRange?: HistoryDateRange,
): PeriodDebtSummary {
  const creditSales = filterSalesByPeriod(
    data.sales.filter((s) => s.paymentType === 'qarz'),
    period,
    customRange,
  );
  return computePeriodDebtSummaryFromCreditSales(creditSales);
}

export type HistoryPeriod =
  | 'all'
  | '1d'
  | '2d'
  | '1w'
  | '1m'
  | '3m'
  | '6m'
  | '1y'
  | '3y'
  | '5y'
  | 'custom';

export type HistoryDateRange = {
  from: string;
  to: string;
};

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function defaultCustomHistoryRange(): HistoryDateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function parseRangeBound(iso: string, endOfDay: boolean): number {
  const s = iso.trim();
  if (!s) return NaN;
  const d = new Date(s.length <= 10 ? `${s}T${endOfDay ? '23:59:59' : '00:00:00'}` : s);
  return d.getTime();
}

function periodWindow(
  period: HistoryPeriod,
  customRange?: HistoryDateRange,
): { start: number; end: number } | null {
  if (period === 'all') return null;
  if (period === 'custom') {
    if (!customRange?.from || !customRange?.to) return null;
    const start = parseRangeBound(customRange.from, false);
    const end = parseRangeBound(customRange.to, true);
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const rollingDays: Partial<Record<HistoryPeriod, number>> = {
    '1d': 1,
    '2d': 2,
    '1w': 7,
    '1m': 30,
    '3m': 90,
    '6m': 182,
  };
  const days = rollingDays[period];
  if (days != null) {
    return { start: Date.now() - days * dayMs, end: Date.now() };
  }
  const years = period === '1y' ? 1 : period === '3y' ? 3 : period === '5y' ? 5 : 0;
  if (years > 0) {
    return { start: Date.now() - years * 365.25 * dayMs, end: Date.now() };
  }
  return null;
}

export type SaleHistoryGroup = {
  key: string;
  label: string;
  total: number;
  count: number;
  sales: DillerSale[];
};

export type MonthlyStat = {
  key: string;
  label: string;
  total: number;
  count: number;
  naqd: number;
  qarz: number;
  cost: number;
  profit: number;
};

/** Sotuvdan yalpi foyda: chegirmadan keyin summa − (olib kelish × miqdor) */
export function computeSaleGrossProfit(sale: DillerSale, product?: DillerProduct): number {
  const buy = product?.buyPrice ?? 0;
  const cost = buy * sale.qty;
  return sale.total - cost;
}

export function sumSalesProfit(sales: DillerSale[], data: DillerData): number {
  return sales.reduce((sum, sale) => {
    const product = data.products.find((p) => p.id === sale.productId);
    return sum + computeSaleGrossProfit(sale, product);
  }, 0);
}

export type ExtendedDebtAnalytics = DebtAnalytics & {
  totalSalesCount: number;
  naqdSalesCount: number;
  qarzSalesCount: number;
  closedDebtCount: number;
  avgSaleAmount: number;
  /** Jami olib kelish xarajati (sotilgan miqdor bo‘yicha) */
  totalCost: number;
  /** Jami yalpi foyda */
  totalProfit: number;
  avgProfitPerSale: number;
  /** Foyda / aylanma (%) */
  profitMarginPercent: number;
  naqdProfit: number;
  qarzProfit: number;
  /** Naqd + qarzdan undirilgan — haqiqiy tushum */
  totalCashReceived: number;
  /** Aylanmadagi naqd ulushi (%) */
  naqdSharePercent: number;
  /** Aylanmadagi qarz ulushi (%) */
  qarzSharePercent: number;
  /** Qarzdan undirilgan ulush (qarz aylanmasi ichida, %) */
  creditCollectedSharePercent: number;
  monthly: MonthlyStat[];
  topStoresByRevenue: {
    storeId: string;
    storeName: string;
    total: number;
    profit: number;
    count: number;
  }[];
  topProductsByQty: {
    productId: string;
    productName: string;
    qty: number;
    total: number;
    profit: number;
  }[];
};

const MONTH_NAMES_UZ = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const name = MONTH_NAMES_UZ[(m ?? 1) - 1] ?? key;
  return `${name} ${y}`;
}

const PERIOD_LABELS: Record<HistoryPeriod, string> = {
  all: 'Barcha vaqt',
  '1d': '1 kun',
  '2d': '2 kun',
  '1w': '1 hafta',
  '1m': '1 oy',
  '3m': '3 oy',
  '6m': '6 oy',
  '1y': '1 yil',
  '3y': '3 yil',
  '5y': '5 yil',
  custom: 'Tanlangan davr',
};

export function getHistoryPeriodLabel(period: HistoryPeriod): string {
  return PERIOD_LABELS[period] ?? period;
}

export function filterSalesByPeriod(
  sales: DillerSale[],
  period: HistoryPeriod,
  customRange?: HistoryDateRange,
): DillerSale[] {
  const sorted = [...sales].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const window = periodWindow(period, customRange);
  if (!window) return sorted;
  return sorted.filter((s) => {
    const t = new Date(s.createdAt).getTime();
    return t >= window.start && t <= window.end;
  });
}

export function groupSalesByMonth(sales: DillerSale[]): SaleHistoryGroup[] {
  const map = new Map<string, DillerSale[]>();
  for (const sale of sales) {
    const d = new Date(sale.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const list = map.get(key) ?? [];
    list.push(sale);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => ({
      key,
      label: monthLabel(key),
      total: list.reduce((s, x) => s + x.total, 0),
      count: list.length,
      sales: list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    }));
}

export function computeExtendedAnalytics(
  data: DillerData,
  sales = data.sales,
): ExtendedDebtAnalytics {
  const base = computeDebtAnalytics(data, sales);

  let naqdSalesCount = 0;
  let qarzSalesCount = 0;
  let closedDebtCount = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let naqdProfit = 0;
  let qarzProfit = 0;
  const monthMap = new Map<string, MonthlyStat>();
  const storeRev = new Map<
    string,
    { storeId: string; storeName: string; total: number; profit: number; count: number }
  >();
  const productQty = new Map<
    string,
    { productId: string; productName: string; qty: number; total: number; profit: number }
  >();

  for (const sale of sales) {
    if (sale.paymentType === 'naqd') naqdSalesCount += 1;
    else qarzSalesCount += 1;
    if (sale.paymentType === 'qarz' && (sale.debtAmount ?? 0) <= 0) closedDebtCount += 1;

    const product = data.products.find((p) => p.id === sale.productId);
    const buy = product?.buyPrice ?? 0;
    const cost = buy * sale.qty;
    const profit = computeSaleGrossProfit(sale, product);
    totalCost += cost;
    totalProfit += profit;
    if (sale.paymentType === 'naqd') naqdProfit += profit;
    else qarzProfit += profit;

    const d = new Date(sale.createdAt);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let m = monthMap.get(mKey);
    if (!m) {
      m = { key: mKey, label: monthLabel(mKey), total: 0, count: 0, naqd: 0, qarz: 0, cost: 0, profit: 0 };
      monthMap.set(mKey, m);
    }
    m.total += sale.total;
    m.count += 1;
    m.cost += cost;
    m.profit += profit;
    if (sale.paymentType === 'naqd') m.naqd += sale.total;
    else m.qarz += sale.total;

    const store = data.stores.find((s) => s.id === sale.storeId);
    const sName = store?.name ?? '—';
    let sr = storeRev.get(sale.storeId);
    if (!sr) {
      sr = { storeId: sale.storeId, storeName: sName, total: 0, profit: 0, count: 0 };
      storeRev.set(sale.storeId, sr);
    }
    sr.total += sale.total;
    sr.profit += profit;
    sr.count += 1;

    const pName = product?.name ?? '—';
    let pr = productQty.get(sale.productId);
    if (!pr) {
      pr = { productId: sale.productId, productName: pName, qty: 0, total: 0, profit: 0 };
      productQty.set(sale.productId, pr);
    }
    pr.qty += sale.qty;
    pr.total += sale.total;
    pr.profit += profit;
  }

  const monthly = [...monthMap.values()].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 36);
  const profitMarginPercent =
    base.totalRevenue > 0 ? Math.round((totalProfit / base.totalRevenue) * 1000) / 10 : 0;
  const totalCashReceived = base.naqdRevenue + base.paidOnCreditTotal;
  const naqdSharePercent =
    base.totalRevenue > 0 ? Math.round((base.naqdRevenue / base.totalRevenue) * 1000) / 10 : 0;
  const qarzSharePercent =
    base.totalRevenue > 0 ? Math.round((base.creditSalesTotal / base.totalRevenue) * 1000) / 10 : 0;
  const creditCollectedSharePercent =
    base.creditSalesTotal > 0
      ? Math.round((base.paidOnCreditTotal / base.creditSalesTotal) * 1000) / 10
      : 0;

  return {
    ...base,
    totalSalesCount: sales.length,
    naqdSalesCount,
    qarzSalesCount,
    closedDebtCount,
    avgSaleAmount: sales.length ? Math.round(base.totalRevenue / sales.length) : 0,
    totalCost,
    totalProfit,
    avgProfitPerSale: sales.length ? Math.round(totalProfit / sales.length) : 0,
    profitMarginPercent,
    naqdProfit,
    qarzProfit,
    totalCashReceived,
    naqdSharePercent,
    qarzSharePercent,
    creditCollectedSharePercent,
    monthly,
    topStoresByRevenue: [...storeRev.values()].sort((a, b) => b.total - a.total).slice(0, 8),
    topProductsByQty: [...productQty.values()].sort((a, b) => b.qty - a.qty).slice(0, 8),
  };
}

export function computeExtendedAnalyticsForPeriod(
  data: DillerData,
  period: HistoryPeriod,
  customRange?: HistoryDateRange,
): ExtendedDebtAnalytics {
  const sales = filterSalesByPeriod(data.sales, period, customRange);
  return computeExtendedAnalytics(data, sales);
}

export function getMaxMonthlyTotal(monthly: MonthlyStat[]): number {
  return Math.max(1, ...monthly.map((m) => m.total));
}

export function getMaxMonthlyProfit(monthly: MonthlyStat[]): number {
  return Math.max(1, ...monthly.map((m) => Math.abs(m.profit)));
}

export type DebtSaleInsight = {
  saleId: string;
  storeId: string;
  storeName: string;
  productName: string;
  total: number;
  paidAmount: number;
  debtAmount: number;
  debtDueDate: string;
  createdAt: string;
  isOverdue: boolean;
  isClosed: boolean;
  isPartiallyPaid: boolean;
  daysOverdue: number;
  daysSinceSale: number;
};

export type DebtStoreCollectionRow = {
  storeId: string;
  storeName: string;
  collected: number;
  openRemaining: number;
  closedCount: number;
  openCount: number;
  overdueCount: number;
  creditTotal: number;
};

export type DebtCollectionAnalytics = {
  summary: PeriodDebtSummary;
  openDebts: DebtSaleInsight[];
  closedDebts: DebtSaleInsight[];
  partiallyPaidOpen: DebtSaleInsight[];
  overdueDebts: DebtSaleInsight[];
  oldOpenDebts: DebtSaleInsight[];
  byStore: DebtStoreCollectionRow[];
  collectionRate: number;
};

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function enrichCreditSale(sale: DillerSale, data: DillerData, now = startOfToday()): DebtSaleInsight {
  const store = data.stores.find((s) => s.id === sale.storeId);
  const product = data.products.find((p) => p.id === sale.productId);
  const isClosed = isSaleDebtClosed(sale);
  const isOverdue = !isClosed && isSaleOverdue(sale, now);
  const debtAmount = sale.debtAmount ?? 0;
  const paidAmount = sale.paidAmount ?? 0;
  let daysOverdue = 0;
  if (isOverdue && sale.debtDueDate) {
    const due = parseDueDate(sale.debtDueDate);
    if (due) {
      due.setHours(0, 0, 0, 0);
      daysOverdue = Math.max(0, daysBetween(due, now));
    }
  }
  const created = new Date(sale.createdAt);
  const daysSinceSale = Number.isNaN(created.getTime())
    ? 0
    : Math.max(0, daysBetween(created, new Date()));

  return {
    saleId: sale.id,
    storeId: sale.storeId,
    storeName: store?.name ?? 'Noma’lum do‘kon',
    productName: product?.name ?? 'Mahsulot',
    total: sale.total,
    paidAmount,
    debtAmount,
    debtDueDate: sale.debtDueDate,
    createdAt: sale.createdAt,
    isOverdue,
    isClosed,
    isPartiallyPaid: !isClosed && paidAmount > 0 && debtAmount > 0,
    daysOverdue,
    daysSinceSale,
  };
}

function sortOpenDebts(a: DebtSaleInsight, b: DebtSaleInsight): number {
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  if (a.isOverdue && b.isOverdue && b.daysOverdue !== a.daysOverdue) {
    return b.daysOverdue - a.daysOverdue;
  }
  if (b.daysSinceSale !== a.daysSinceSale) return b.daysSinceSale - a.daysSinceSale;
  return b.debtAmount - a.debtAmount;
}

function sortClosedDebts(a: DebtSaleInsight, b: DebtSaleInsight): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function computeDebtCollectionAnalytics(
  data: DillerData,
  creditSales: DillerSale[],
): DebtCollectionAnalytics {
  const now = startOfToday();
  const summary = computePeriodDebtSummaryFromCreditSales(creditSales, now);
  const insights = creditSales.map((s) => enrichCreditSale(s, data, now));

  const openDebts = insights.filter((r) => !r.isClosed && r.debtAmount > 0).sort(sortOpenDebts);
  const closedDebts = insights.filter((r) => r.isClosed).sort(sortClosedDebts);
  const partiallyPaidOpen = openDebts.filter((r) => r.isPartiallyPaid);
  const overdueDebts = openDebts.filter((r) => r.isOverdue);
  const oldOpenDebts = openDebts.filter((r) => r.daysSinceSale >= 14 || r.isOverdue);

  const storeMap = new Map<string, DebtStoreCollectionRow>();
  for (const row of insights) {
    let s = storeMap.get(row.storeId);
    if (!s) {
      s = {
        storeId: row.storeId,
        storeName: row.storeName,
        collected: 0,
        openRemaining: 0,
        closedCount: 0,
        openCount: 0,
        overdueCount: 0,
        creditTotal: 0,
      };
      storeMap.set(row.storeId, s);
    }
    s.creditTotal += row.total;
    s.collected += row.paidAmount;
    if (row.isClosed) {
      s.closedCount += 1;
    } else if (row.debtAmount > 0) {
      s.openCount += 1;
      s.openRemaining += row.debtAmount;
      if (row.isOverdue) s.overdueCount += 1;
    }
  }

  const creditPaidPlusOpen = summary.collectedTotal + summary.openDebtTotal;
  const collectionRate =
    creditPaidPlusOpen > 0
      ? Math.round((summary.collectedTotal / creditPaidPlusOpen) * 1000) / 10
      : summary.creditSalesTotal > 0
        ? 100
        : 0;

  return {
    summary,
    openDebts,
    closedDebts,
    partiallyPaidOpen,
    overdueDebts,
    oldOpenDebts,
    byStore: [...storeMap.values()]
      .filter((s) => s.creditTotal > 0)
      .sort((a, b) => b.openRemaining - a.openRemaining || b.collected - a.collected),
    collectionRate,
  };
}

export function computeDebtCollectionForPeriod(
  data: DillerData,
  period: HistoryPeriod,
  customRange?: HistoryDateRange,
): DebtCollectionAnalytics {
  const creditSales = filterSalesByPeriod(
    data.sales.filter((s) => s.paymentType === 'qarz'),
    period,
    customRange,
  );
  return computeDebtCollectionAnalytics(data, creditSales);
}

/** Hozirgi ochiq / eski qarzlar — davr filtrisiz */
export function computeCurrentDebtSnapshot(data: DillerData): DebtCollectionAnalytics {
  const openCreditSales = data.sales.filter(
    (s) => s.paymentType === 'qarz' && (s.debtAmount ?? 0) > 0,
  );
  return computeDebtCollectionAnalytics(data, openCreditSales);
}

export function formatDebtInsightDate(iso: string): string {
  if (!iso.trim()) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

export type PaymentFlowBreakdown = {
  naqd: { amount: number; count: number };
  /** Yangi berilgan qarz (sotuv paytida) */
  newDebt: { amount: number; count: number; downPaymentAtSale: number };
  /** Qarzdan undirilgan to‘lovlar (sotuvdagi paidAmount) */
  debtCollected: { amount: number; count: number };
  /** Haqiqiy kirim: naqd + qarzdan undirilgan (eski hisob) */
  totalCashIn: number;
};

export function computePaymentFlowBreakdown(
  data: DillerData,
  period: HistoryPeriod,
  customRange?: HistoryDateRange,
): PaymentFlowBreakdown {
  const salesInPeriod = filterSalesByPeriod(data.sales, period, customRange);
  const analytics = computeExtendedAnalytics(data, salesInPeriod);

  const qarzWithPayment = salesInPeriod.filter(
    (s) => s.paymentType === 'qarz' && (s.paidAmount ?? 0) > 0,
  );

  return {
    naqd: { amount: analytics.naqdRevenue, count: analytics.naqdSalesCount },
    newDebt: {
      amount: analytics.creditSalesTotal,
      count: analytics.qarzSalesCount,
      downPaymentAtSale: 0,
    },
    debtCollected: {
      amount: analytics.paidOnCreditTotal,
      count: qarzWithPayment.length,
    },
    totalCashIn: analytics.totalCashReceived,
  };
}
