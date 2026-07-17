import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  History,
  PieChart,
  Search,
  Store,
  Wallet,
  CircleDollarSign,
  Receipt,
  Banknote,
  HandCoins,
  Navigation,
  Landmark,
  ClipboardList,
} from 'lucide-react';
import { useDillerUserLocation } from '../../hooks/useDillerUserLocation';
import { DillerBalansSection } from './DillerBalansSection';
import { DillerBuyurtmaSection } from './DillerBuyurtmaSection';
import { DillerHarajatSection } from './DillerHarajatSection';
import { computeExpenseSummary, filterExpensesByPeriod } from '../../utils/dillerExpenseAnalytics';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerSale } from '../../utils/dillerData';
import { formatMoney, recordDebtPayment, settleDebtFully } from '../../utils/dillerData';
import { normalizeUzPhoneForSms } from '../../utils/dillerPurchaseSms';
import {
  maybeSendDebtOverdueSms,
  maybeSendDebtPaymentSms,
  purchaseSmsToast,
} from '../../utils/dillerPurchaseSmsSend';
import { formatStoreDistance, getStoreDistanceKm, getStoreStats } from '../../utils/dillerStoreStats';
import { DillerSaleCard } from './DillerSaleCard';
import { DillerSaleReceiptModal } from './DillerSaleReceiptModal';
import {
  computeExtendedAnalyticsForPeriod,
  applyDebtFilterToCreditSales,
  computePeriodDebtSummaryFromCreditSales,
  computePaymentFlowBreakdown,
  computeDebtAnalytics,
  countSaleTransactions,
  defaultCustomHistoryRange,
  filterSalesByPeriod,
  toIsoDate,
  getMaxMonthlyProfit,
  getMaxMonthlyTotal,
  getHistoryPeriodLabel,
  groupSalesByMonth,
  sumSalesProfit,
  isSaleOverdue,
  isSaleDebtClosed,
  type DebtFilter,
  type HistoryDateRange,
  type HistoryPeriod,
} from '../../utils/dillerDebtAnalytics';
import { dillerListClass, dillerTabContentClass } from './dillerMobileLayout';

type Props = {
  data: DillerData;
  onDataChange: (next: DillerData) => void;
};

type QarzSection = 'qarz' | 'buyurtma' | 'statistika' | 'balans' | 'tarix' | 'xarajat';

function Card({
  children,
  isDark,
  className = '',
}: {
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${className}`.trim()}
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  color,
  isDark,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  isDark: boolean;
}) {
  return (
    <div
      className="rounded-xl p-3 min-w-0"
      style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}
    >
      <div className="text-[10px] opacity-60 truncate">{label}</div>
      <div className="text-sm font-bold mt-0.5 truncate" style={{ color }}>
        {value}
      </div>
      {sub ? <div className="text-[9px] opacity-50 mt-0.5">{sub}</div> : null}
    </div>
  );
}

export function DillerQarzTab({ data, onDataChange }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [section, setSection] = useState<QarzSection>('qarz');
  const [filter, setFilter] = useState<DebtFilter>('all');
  const [debtPeriod, setDebtPeriod] = useState<HistoryPeriod>('all');
  const [debtCustomRange, setDebtCustomRange] = useState<HistoryDateRange>(() =>
    defaultCustomHistoryRange(),
  );
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [sendDebtSms, setSendDebtSms] = useState(true);
  const [smsBusyId, setSmsBusyId] = useState<string | null>(null);
  const [statPeriod, setStatPeriod] = useState<HistoryPeriod>('all');
  const [statCustomRange, setStatCustomRange] = useState<HistoryDateRange>(() =>
    defaultCustomHistoryRange(),
  );
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('all');
  const [historyCustomRange, setHistoryCustomRange] = useState<HistoryDateRange>(() =>
    defaultCustomHistoryRange(),
  );
  const [historySearch, setHistorySearch] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [receiptSale, setReceiptSale] = useState<DillerSale | null>(null);

  const statAnalytics = useMemo(
    () =>
      computeExtendedAnalyticsForPeriod(
        data,
        statPeriod,
        statPeriod === 'custom' ? statCustomRange : undefined,
      ),
    [data, statPeriod, statCustomRange],
  );

  const statExpenses = useMemo(() => {
    const list = filterExpensesByPeriod(
      data.expenses,
      statPeriod,
      statPeriod === 'custom' ? statCustomRange : undefined,
    );
    return computeExpenseSummary(list);
  }, [data.expenses, statPeriod, statCustomRange]);

  const paymentFlow = useMemo(
    () =>
      computePaymentFlowBreakdown(
        data,
        statPeriod,
        statPeriod === 'custom' ? statCustomRange : undefined,
      ),
    [data, statPeriod, statCustomRange],
  );

  const currentDebt = useMemo(() => computeDebtAnalytics(data, data.sales), [data]);

  const maxStoreDebt = Math.max(1, ...currentDebt.byStore.map((s) => s.openDebt));
  const maxMonthTotal = getMaxMonthlyTotal(statAnalytics.monthly);
  const maxMonthProfit = getMaxMonthlyProfit(statAnalytics.monthly);

  const periodQarzSales = useMemo(
    () =>
      filterSalesByPeriod(
        data.sales.filter((s) => s.paymentType === 'qarz'),
        debtPeriod,
        debtPeriod === 'custom' ? debtCustomRange : undefined,
      ),
    [data.sales, debtPeriod, debtCustomRange],
  );

  const debtSummary = useMemo(
    () => computePeriodDebtSummaryFromCreditSales(periodQarzSales),
    [periodQarzSales],
  );

  const { location: userLoc } = useDillerUserLocation(section === 'qarz');

  const storeById = useMemo(
    () => new Map(data.stores.map((s) => [s.id, s])),
    [data.stores],
  );

  const storeDebtById = useMemo(() => {
    const map = new Map<string, { openDebt: number; openCount: number; totalPaid: number }>();
    for (const store of data.stores) {
      const stats = getStoreStats(data, store.id);
      if (stats.openDebt > 0) {
        map.set(store.id, {
          openDebt: stats.openDebt,
          openCount: stats.openDebtSaleCount,
          totalPaid: stats.totalPaid,
        });
      }
    }
    return map;
  }, [data]);

  const filteredSales = useMemo(() => {
    const list = applyDebtFilterToCreditSales(periodQarzSales, filter);
    if (filter === 'closed') {
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return list.sort((a, b) => {
      const distA = getStoreDistanceKm(storeById.get(a.storeId), userLoc) ?? Infinity;
      const distB = getStoreDistanceKm(storeById.get(b.storeId), userLoc) ?? Infinity;
      if (distA !== distB) return distA - distB;

      const aOver = isSaleOverdue(a) ? 1 : 0;
      const bOver = isSaleOverdue(b) ? 1 : 0;
      if (bOver !== aOver) return bOver - aOver;

      const saleDebtA = a.debtAmount ?? 0;
      const saleDebtB = b.debtAmount ?? 0;
      if (saleDebtA !== saleDebtB) return saleDebtA - saleDebtB;

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [periodQarzSales, filter, storeDebtById, storeById, userLoc]);

  const historySales = useMemo(() => {
    let list = filterSalesByPeriod(
      data.sales,
      historyPeriod,
      historyPeriod === 'custom' ? historyCustomRange : undefined,
    );
    const q = historySearch.trim().toLowerCase();
    if (q) {
      list = list.filter((sale) => {
        const store = data.stores.find((s) => s.id === sale.storeId);
        const product = data.products.find((p) => p.id === sale.productId);
        const hay = `${store?.name} ${product?.name} ${sale.note}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [data.sales, data.stores, data.products, historyPeriod, historyCustomRange, historySearch]);

  const historyGroups = useMemo(() => groupSalesByMonth(historySales), [historySales]);

  const historyTotals = useMemo(
    () => ({
      count: historySales.length,
      transactions: countSaleTransactions(historySales),
      sum: historySales.reduce((s, x) => s + x.total, 0),
      profit: sumSalesProfit(historySales, data),
      discount: historySales.reduce((s, x) => s + (x.discountAmount ?? 0), 0),
    }),
    [historySales, data],
  );

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submitPayment = async (saleId: string, full = false) => {
    const before = data.sales.find((s) => s.id === saleId);
    const result = full
      ? settleDebtFully(data, saleId)
      : recordDebtPayment(data, saleId, Number(payAmount) || 0);
    if (result.error || !result.sale) {
      toast.error(result.error || 'To‘lov saqlanmadi');
      return;
    }
    onDataChange(result.data);
    setPaySaleId(null);
    setPayAmount('');

    const storePhone = normalizeUzPhoneForSms(
      data.stores.find((s) => s.id === (before?.storeId || result.sale?.storeId))?.phone || '',
    );
    const sms = await maybeSendDebtPaymentSms({
      data: result.data,
      sale: result.sale,
      paidAmount: result.paidAmount ?? 0,
      remainingDebt: result.remainingDebt ?? 0,
      send: sendDebtSms && Boolean(storePhone),
    });
    toast.success(
      purchaseSmsToast(sms, full || (result.remainingDebt ?? 0) <= 0 ? 'Qarz yopildi' : 'To‘lov qayd etildi'),
    );
  };

  const sendOverdueSms = async (sale: DillerSale) => {
    if (smsBusyId) return;
    setSmsBusyId(sale.id);
    const sms = await maybeSendDebtOverdueSms({ data, sale });
    setSmsBusyId(null);
    if (sms.sent) toast.success('Muddat SMS yuborildi');
    else if (sms.error) toast.error(sms.error);
    else if (sms.skipped === 'no_phone') toast.error('Do‘konda telefon yo‘q');
    else toast.error('SMS yuborilmadi');
  };

  const debtFilters: { id: DebtFilter; label: string }[] = [
    { id: 'all', label: 'Hammasi' },
    { id: 'overdue', label: 'Muddati o‘tgan' },
    { id: 'soon', label: '7 kun ichida' },
    {
      id: 'closed',
      label:
        debtSummary.closedDebtCount > 0
          ? `Yakunlangan (${debtSummary.closedDebtCount})`
          : 'Yakunlangan',
    },
  ];

  const statPeriodOptions: { id: HistoryPeriod; label: string }[] = [
    { id: '1d', label: '1 kun' },
    { id: '2d', label: '2 kun' },
    { id: '1w', label: '1 hafta' },
    { id: '1m', label: '1 oy' },
    { id: '3m', label: '3 oy' },
    { id: '6m', label: '6 oy' },
    { id: 'all', label: 'Barcha' },
    { id: '1y', label: '1 yil' },
    { id: 'custom', label: 'Tanlash' },
  ];

  const debtPeriodOptions: { id: HistoryPeriod; label: string }[] = [
    { id: '1d', label: '1 kun' },
    { id: '2d', label: '2 kun' },
    { id: '1w', label: '1 hafta' },
    { id: '1m', label: '1 oy' },
    { id: '3m', label: '3 oy' },
    { id: '6m', label: '6 oy' },
    { id: 'all', label: 'Barcha' },
    { id: 'custom', label: 'Tanlash' },
  ];

  const periodOptions: { id: HistoryPeriod; label: string }[] = [
    { id: '1d', label: '1 kun' },
    { id: '2d', label: '2 kun' },
    { id: '1w', label: '1 hafta' },
    { id: '1m', label: '1 oy' },
    { id: '3m', label: '3 oy' },
    { id: '6m', label: '6 oy' },
    { id: 'all', label: 'Barcha' },
    { id: '1y', label: '1 yil' },
    { id: '3y', label: '3 yil' },
    { id: '5y', label: '5 yil' },
    { id: 'custom', label: 'Tanlash' },
  ];

  const sections: { id: QarzSection; label: string; icon: typeof Wallet }[] = [
    { id: 'qarz', label: 'Qarz', icon: Wallet },
    { id: 'buyurtma', label: 'Buyurtma', icon: ClipboardList },
    { id: 'statistika', label: 'Statistika', icon: BarChart3 },
    { id: 'balans', label: 'Balans', icon: Landmark },
    { id: 'tarix', label: 'Tarix', icon: History },
    { id: 'xarajat', label: 'Xarajat', icon: Receipt },
  ];

  return (
    <div className={dillerTabContentClass}>
      <DillerSaleReceiptModal
        open={!!receiptSale}
        onClose={() => setReceiptSale(null)}
        sale={receiptSale}
        data={data}
        onDataChange={onDataChange}
      />

      <div
        className="flex gap-1 p-1 rounded-2xl overflow-x-auto [-webkit-overflow-scrolling:touch]"
        style={{
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        }}
      >
        {sections.map((s) => {
          const active = section === s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`flex-1 min-w-[4.25rem] flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-[10px] sm:text-xs font-bold transition-all shrink-0 ${
                active ? 'shadow-sm' : 'opacity-60'
              }`}
              style={
                active
                  ? {
                      background: isDark ? 'rgba(255,255,255,0.1)' : '#fff',
                      color: accentColor.color,
                    }
                  : undefined
              }
            >
              <Icon className="w-4 h-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {section === 'qarz' ? (
        <>
          <Card isDark={isDark}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Wallet className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm">Qarz hulosasi</h3>
                  <p className="text-[10px] opacity-55 truncate">
                    {getHistoryPeriodLabel(debtPeriod)}
                    {debtPeriod !== 'all' ? ` · ${debtSummary.creditSalesCount} ta qarzli sotuv` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-1.5 mb-2 flex-wrap">
              {debtPeriodOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDebtPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    debtPeriod === p.id
                      ? 'bg-amber-500/20 text-amber-400'
                      : isDark
                        ? 'bg-white/5 opacity-70'
                        : 'bg-gray-100 opacity-80'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {debtPeriod === 'custom' ? (
              <div
                className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-xl"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}
              >
                <div>
                  <label className="block text-[10px] opacity-60 mb-1">Dan (boshlanish)</label>
                  <input
                    type="date"
                    value={debtCustomRange.from}
                    max={debtCustomRange.to}
                    onChange={(e) =>
                      setDebtCustomRange((r) => ({ ...r, from: e.target.value }))
                    }
                    className={`w-full px-2 py-2 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]'
                        : 'bg-white border-gray-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] opacity-60 mb-1">Gacha (tugash)</label>
                  <input
                    type="date"
                    value={debtCustomRange.to}
                    min={debtCustomRange.from}
                    max={toIsoDate(new Date())}
                    onChange={(e) =>
                      setDebtCustomRange((r) => ({ ...r, to: e.target.value }))
                    }
                    className={`w-full px-2 py-2 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]'
                        : 'bg-white border-gray-200'
                    }`}
                  />
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Ochiq qarz"
                value={formatMoney(debtSummary.openDebtTotal)}
                sub={`${debtSummary.openDebtCount} ta`}
                color="#f59e0b"
                isDark={isDark}
              />
              <StatTile
                label="Muddati o‘tgan"
                value={formatMoney(debtSummary.overdueTotal)}
                sub={`${debtSummary.overdueCount} ta`}
                color="#ef4444"
                isDark={isDark}
              />
              <StatTile
                label="Yakunlangan"
                value={formatMoney(debtSummary.closedDebtTotal)}
                sub={`${debtSummary.closedDebtCount} ta`}
                color="#10b981"
                isDark={isDark}
              />
              <StatTile
                label="Undirilgan"
                value={formatMoney(debtSummary.collectedTotal)}
                sub={
                  debtSummary.creditSalesTotal > 0
                    ? `${Math.round((debtSummary.collectedTotal / debtSummary.creditSalesTotal) * 100)}%`
                    : '0%'
                }
                color={accentColor.color}
                isDark={isDark}
              />
            </div>
            {debtSummary.dueSoonCount > 0 ? (
              <div
                className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-xl"
                style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.1)' }}
              >
                <CalendarClock className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong>{debtSummary.dueSoonCount}</strong> ta qarz 7 kun ichida
                </span>
              </div>
            ) : null}
          </Card>

          <Card isDark={isDark}>
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm">
                {filter === 'closed' ? 'Yakunlangan qarzlar' : 'Ochiq qarzlar'}
              </h3>
            </div>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {debtFilters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setFilter(f.id);
                    setPaySaleId(null);
                    setPayAmount('');
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    filter === f.id
                      ? f.id === 'closed'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                      : isDark
                        ? 'bg-white/5 opacity-70'
                        : 'bg-gray-100 opacity-80'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredSales.length === 0 ? (
              <p className="text-sm opacity-60 py-6 text-center">
                {filter === 'closed'
                  ? debtPeriod === 'all'
                    ? 'Yakunlangan qarz yo‘q'
                    : 'Tanlangan davrda yakunlangan qarz yo‘q'
                  : debtSummary.openDebtCount === 0
                    ? debtPeriod === 'all'
                      ? 'Ochiq qarz yo‘q'
                      : 'Tanlangan davrda ochiq qarz yo‘q'
                    : 'Filtr bo‘yicha topilmadi'}
              </p>
            ) : (
              <ul className={dillerListClass}>
                {filteredSales.map((sale) => {
                  const store = data.stores.find((s) => s.id === sale.storeId);
                  const product = data.products.find((p) => p.id === sale.productId);
                  const storeDebt = storeDebtById.get(sale.storeId);
                  const distanceLabel = formatStoreDistance(
                    getStoreDistanceKm(store, userLoc),
                  );
                  const overdue = filter !== 'closed' && isSaleOverdue(sale);
                  const closed = isSaleDebtClosed(sale);
                  const paying = paySaleId === sale.id;
                  const salePaid = sale.paidAmount ?? 0;
                  const saleDebt = sale.debtAmount ?? 0;
                  const saleSettledPercent =
                    sale.total > 0 ? Math.min(100, Math.round((salePaid / sale.total) * 100)) : 0;
                  const storePhoneOk = Boolean(normalizeUzPhoneForSms(store?.phone || ''));

                  return (
                    <li
                      key={sale.id}
                      className="p-3 rounded-xl border"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                        borderColor: closed
                          ? 'rgba(16,185,129,0.35)'
                          : overdue
                            ? 'rgba(239,68,68,0.35)'
                            : isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.06)',
                      }}
                    >
                      {!closed && storeDebt ? (
                        <div
                          className="mb-3 rounded-xl px-3 py-2.5"
                          style={{
                            background: isDark
                              ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(217,119,6,0.06))'
                              : 'linear-gradient(135deg, rgba(245,158,11,0.12), #fffbeb)',
                            border: isDark
                              ? '1px solid rgba(245,158,11,0.22)'
                              : '1px solid rgba(245,158,11,0.18)',
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold opacity-65 uppercase tracking-wide">
                                Do‘konda qoldiq
                              </div>
                              <div className="text-base font-black text-amber-500 truncate">
                                {formatMoney(storeDebt.openDebt)}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {distanceLabel ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-blue-500/15 text-blue-400">
                                  <Navigation className="w-3 h-3" />
                                  {distanceLabel}
                                </span>
                              ) : null}
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/15 text-amber-500">
                                {storeDebt.openCount} ta ochiq
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{store?.name ?? '—'}</div>
                          <div className="text-xs opacity-70 truncate">
                            {product?.name} × {sale.qty}
                          </div>
                        </div>
                        {closed ? (
                          <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Yakunlandi
                          </span>
                        ) : overdue ? (
                          <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            Kechikkan
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        {closed ? (
                          <>
                            <div>
                              <span className="opacity-50">Jami to‘langan</span>
                              <div className="font-bold text-emerald-500">{formatMoney(sale.total)}</div>
                            </div>
                            <div>
                              <span className="opacity-50">Sana</span>
                              <div className="font-semibold opacity-80">
                                {new Date(sale.createdAt).toLocaleDateString('uz-UZ')}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="opacity-50">Bu sotuv qarzi</span>
                              <div className="font-bold text-amber-500">{formatMoney(saleDebt)}</div>
                            </div>
                            <div>
                              <span className="opacity-50">Oldin olingan</span>
                              <div className="font-semibold text-emerald-500/90">
                                {formatMoney(salePaid)}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      {!closed ? (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] opacity-55 mb-1">
                            <span>To‘langan {saleSettledPercent}%</span>
                            <span>{formatMoney(salePaid)} / {formatMoney(sale.total)}</span>
                          </div>
                          <div
                            className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
                          >
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${saleSettledPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                      {!closed && sale.debtDueDate ? (
                        <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" />
                          Qaytarish: {new Date(sale.debtDueDate).toLocaleDateString('uz-UZ')}
                        </div>
                      ) : null}

                      {closed ? (
                        <button
                          type="button"
                          onClick={() => setReceiptSale(sale)}
                          className="mt-3 w-full py-2 rounded-xl text-xs font-bold border"
                          style={{
                            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                            color: accentColor.color,
                          }}
                        >
                          Chekni ko‘rish
                        </button>
                      ) : paying ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={1}
                              max={sale.debtAmount}
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className={`flex-1 px-3 py-2 rounded-xl border text-sm ${
                                isDark
                                  ? 'bg-white/5 border-white/10 text-white'
                                  : 'bg-white border-gray-200'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => void submitPayment(sale.id)}
                              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-900"
                            >
                              OK
                            </button>
                          </div>
                          <label
                            className={`flex items-start gap-2 text-[11px] ${
                              !storePhoneOk ? 'opacity-50' : 'opacity-80'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={sendDebtSms && storePhoneOk}
                              disabled={!storePhoneOk}
                              onChange={(e) => setSendDebtSms(e.target.checked)}
                            />
                            <span>
                              SMS yuborish
                              {!storePhoneOk ? ' (telefon yo‘q)' : ''}
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPaySaleId(sale.id);
                                setPayAmount(String(sale.debtAmount));
                                setSendDebtSms(storePhoneOk);
                              }}
                              className="flex-1 py-2 rounded-xl text-xs font-bold border"
                              style={{
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                              }}
                            >
                              To‘lov
                            </button>
                            <button
                              type="button"
                              onClick={() => void submitPayment(sale.id, true)}
                              className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-900 flex items-center justify-center gap-1"
                              style={{ background: accentColor.gradient }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Yopildi
                            </button>
                          </div>
                          {overdue ? (
                            <button
                              type="button"
                              disabled={!storePhoneOk || smsBusyId === sale.id}
                              onClick={() => void sendOverdueSms(sale)}
                              className="w-full py-2 rounded-xl text-xs font-bold border text-red-500 disabled:opacity-40"
                              style={{
                                borderColor: 'rgba(239,68,68,0.35)',
                                background: isDark
                                  ? 'rgba(239,68,68,0.08)'
                                  : 'rgba(239,68,68,0.06)',
                              }}
                            >
                              {smsBusyId === sale.id
                                ? 'SMS yuborilmoqda…'
                                : storePhoneOk
                                  ? 'Muddat o‘tdi — SMS'
                                  : 'Muddat SMS (telefon yo‘q)'}
                            </button>
                          ) : null}
                          {storePhoneOk ? (
                            <label className="flex items-start gap-2 text-[11px] opacity-80">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={sendDebtSms}
                                onChange={(e) => setSendDebtSms(e.target.checked)}
                              />
                              <span>«Yopildi» / to‘lovda SMS</span>
                            </label>
                          ) : null}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      ) : null}

      {section === 'statistika' ? (
        <>
          <Card isDark={isDark}>
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="w-5 h-5 shrink-0" style={{ color: accentColor.color }} />
              <div className="min-w-0">
                <h3 className="font-bold text-base">Umumiy ko‘rsatkichlar</h3>
                <p className="text-[10px] opacity-55 truncate">
                  {getHistoryPeriodLabel(statPeriod)}
                  {statPeriod !== 'all'
                    ? ` · ${statAnalytics.transactionCount} tranzaksiya`
                    : ''}
                </p>
              </div>
            </div>

            <p className="text-xs opacity-60 mb-3">
              Vaqt oralig‘ini tanlang yoki «Tanlash» orqali aniq sanani belgilang.
            </p>

            <div className="flex gap-1.5 mb-2 flex-wrap">
              {statPeriodOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setStatPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    statPeriod === p.id
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isDark
                        ? 'bg-white/5 opacity-70'
                        : 'bg-gray-100 opacity-80'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {statPeriod === 'custom' ? (
              <div
                className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-xl"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}
              >
                <div>
                  <label className="block text-[10px] opacity-60 mb-1">Dan (boshlanish)</label>
                  <input
                    type="date"
                    value={statCustomRange.from}
                    max={statCustomRange.to}
                    onChange={(e) =>
                      setStatCustomRange((r) => ({ ...r, from: e.target.value }))
                    }
                    className={`w-full px-2 py-2 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]'
                        : 'bg-white border-gray-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] opacity-60 mb-1">Gacha (tugash)</label>
                  <input
                    type="date"
                    value={statCustomRange.to}
                    min={statCustomRange.from}
                    max={toIsoDate(new Date())}
                    onChange={(e) =>
                      setStatCustomRange((r) => ({ ...r, to: e.target.value }))
                    }
                    className={`w-full px-2 py-2 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]'
                        : 'bg-white border-gray-200'
                    }`}
                  />
                </div>
              </div>
            ) : null}

            <div
              className="rounded-xl p-4 mb-3"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.08))'
                  : 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(236,253,245,1))',
                border: isDark ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(16,185,129,0.2)',
              }}
            >
              <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                <CircleDollarSign className="w-4 h-4 text-emerald-500" />
                Jami foyda (yalpi)
              </div>
              <div
                className={`text-2xl font-black ${statAnalytics.totalProfit < 0 ? 'text-red-400' : 'text-emerald-500'}`}
              >
                {formatMoney(statAnalytics.totalProfit)}
              </div>
              <div className="text-[10px] opacity-55 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                <span>
                  Xarajat: <strong>{formatMoney(statAnalytics.totalCost)}</strong>
                </span>
                <span>
                  Marja: <strong>{statAnalytics.profitMarginPercent}%</strong>
                </span>
                <span>
                  O‘rtacha: <strong>{formatMoney(statAnalytics.avgProfitPerSale)}</strong>/sotuv
                </span>
              </div>
            </div>

            {/* Naqd, yangi qarz, eski qarz undiruvi — alohida */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 shrink-0" style={{ color: accentColor.color }} />
                <div>
                  <h4 className="font-bold text-sm">Pul oqimi — alohida</h4>
                  <p className="text-[10px] opacity-55">
                    Naqd, yangi qarz va eski qarz undiruvi bir-biriga aralashmaydi
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.08))'
                      : 'linear-gradient(135deg, rgba(16,185,129,0.14), #ecfdf5)',
                    border: isDark ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(16,185,129,0.2)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold opacity-80 mb-1">
                        <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />
                        Naqd sotuv
                      </div>
                      <div className="text-[10px] opacity-55">
                        To‘liq naqd pul bilan sotilgan mahsulotlar
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-black text-emerald-500">
                        {formatMoney(paymentFlow.naqd.amount)}
                      </div>
                      <div className="text-[10px] opacity-60 mt-0.5">
                        {paymentFlow.naqd.count} ta tranzaksiya
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-xl p-4"
                  style={{
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(217,119,6,0.08))'
                      : 'linear-gradient(135deg, rgba(245,158,11,0.14), #fffbeb)',
                    border: isDark ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(245,158,11,0.2)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold opacity-80 mb-1">
                        <HandCoins className="w-4 h-4 text-amber-500 shrink-0" />
                        Yangi qarz berilgan
                      </div>
                      <div className="text-[10px] opacity-55">
                        Sotuv paytida yangi ochilgan qarz summasi
                      </div>
                      {paymentFlow.newDebt.downPaymentAtSale > 0 ? (
                        <div className="text-[10px] text-emerald-500/90 mt-1">
                          Sotuvda oldindan olingan:{' '}
                          {formatMoney(paymentFlow.newDebt.downPaymentAtSale)}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-black text-amber-500">
                        {formatMoney(paymentFlow.newDebt.amount)}
                      </div>
                      <div className="text-[10px] opacity-60 mt-0.5">
                        {paymentFlow.newDebt.count} ta tranzaksiya
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-xl p-4"
                  style={{
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(79,70,229,0.08))'
                      : 'linear-gradient(135deg, rgba(99,102,241,0.12), #eef2ff)',
                    border: isDark ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(99,102,241,0.2)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold opacity-80 mb-1">
                        <Receipt className="w-4 h-4 shrink-0" style={{ color: accentColor.color }} />
                        Eski qarz undirildi
                      </div>
                      <div className="text-[10px] opacity-55">
                        Oldingi qarzlardan olingan to‘lovlar (yopilgan yoki qisman)
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-black" style={{ color: accentColor.color }}>
                        {formatMoney(paymentFlow.debtCollected.amount)}
                      </div>
                      <div className="text-[10px] opacity-60 mt-0.5">
                        {paymentFlow.debtCollected.count} ta to‘lov
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded-xl px-4 py-3 flex items-center justify-between gap-2"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                }}
              >
                <div className="min-w-0">
                  <div className="text-[10px] opacity-65">Jami kirim (naqd + undirilgan + oldindan)</div>
                  <div className="text-lg font-black truncate text-emerald-500">
                    {formatMoney(paymentFlow.totalCashIn)}
                  </div>
                </div>
                <div className="text-right shrink-0 text-[10px] opacity-55">
                  <div>Aylanma</div>
                  <div className="font-bold">{formatMoney(statAnalytics.totalRevenue)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Jami aylanma"
                value={formatMoney(statAnalytics.totalRevenue)}
                sub={`${statAnalytics.transactionCount} tranzaksiya · ${statAnalytics.totalSalesCount} qator`}
                color={accentColor.color}
                isDark={isDark}
              />
              <StatTile
                label="Jami foyda"
                value={formatMoney(statAnalytics.totalProfit)}
                sub={`Marja ${statAnalytics.profitMarginPercent}%`}
                color={statAnalytics.totalProfit >= 0 ? '#10b981' : '#ef4444'}
                isDark={isDark}
              />
              <StatTile
                label="Jami kirim"
                value={formatMoney(paymentFlow.totalCashIn)}
                sub={`Naqd ${formatMoney(paymentFlow.naqd.amount)} · Undirilgan ${formatMoney(paymentFlow.debtCollected.amount)}`}
                color="#6366f1"
                isDark={isDark}
              />
              <StatTile
                label="Yangi qarz berilgan"
                value={formatMoney(paymentFlow.newDebt.amount)}
                sub={`${paymentFlow.newDebt.count} ta tranzaksiya`}
                color="#f59e0b"
                isDark={isDark}
              />
              <StatTile
                label="Qarz qoldig‘i"
                value={formatMoney(currentDebt.openDebtTotal)}
                sub={`${currentDebt.openDebtCount} ta ochiq · hozirgi holat`}
                color="#f59e0b"
                isDark={isDark}
              />
              <StatTile
                label="Chegirma berilgan"
                value={formatMoney(statAnalytics.totalDiscount)}
                sub={
                  statAnalytics.totalRevenue > 0
                    ? `${Math.round((statAnalytics.totalDiscount / (statAnalytics.totalRevenue + statAnalytics.totalDiscount)) * 1000) / 10}%`
                    : undefined
                }
                color="#f43f5e"
                isDark={isDark}
              />
              <StatTile
                label="QR buyurtma"
                value={formatMoney(statAnalytics.shopOrderRevenue)}
                sub={`${statAnalytics.shopOrderTransactionCount} ta buyurtma`}
                color="#0ea5e9"
                isDark={isDark}
              />
              <StatTile
                label="O‘rtacha sotuv"
                value={formatMoney(statAnalytics.avgSaleAmount)}
                sub={`Foyda ${formatMoney(statAnalytics.avgProfitPerSale)}`}
                isDark={isDark}
                color={isDark ? '#fff' : '#111'}
              />
              <StatTile
                label="Eski qarz undirildi"
                value={formatMoney(paymentFlow.debtCollected.amount)}
                sub={`${paymentFlow.debtCollected.count} ta to‘lov`}
                color="#10b981"
                isDark={isDark}
              />
              <StatTile
                label="Operatsion xarajat"
                value={formatMoney(statExpenses.total)}
                sub={`Naqd ${formatMoney(statExpenses.naqdTotal)} · Karta ${formatMoney(statExpenses.kartaTotal)}`}
                color="#f87171"
                isDark={isDark}
              />
              <StatTile
                label="Sof foyda (taxminiy)"
                value={formatMoney(statAnalytics.totalProfit - statExpenses.total)}
                sub="Foyda − xarajatlar"
                color={
                  statAnalytics.totalProfit - statExpenses.total >= 0 ? '#10b981' : '#ef4444'
                }
                isDark={isDark}
              />
            </div>

            {statAnalytics.totalRevenue > 0 ? (
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="opacity-70">Aylanma vs foyda</span>
                  <span className="font-mono text-[10px] opacity-60">
                    Foyda {statAnalytics.profitMarginPercent}%
                  </span>
                </div>
                <div
                  className="h-3 rounded-full overflow-hidden flex"
                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
                >
                  <div
                    className="h-full bg-slate-500/60"
                    style={{
                      width: `${Math.min(100, (statAnalytics.totalCost / statAnalytics.totalRevenue) * 100)}%`,
                    }}
                    title="Xarajat"
                  />
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, (statAnalytics.totalProfit / statAnalytics.totalRevenue) * 100))}%`,
                    }}
                    title="Foyda"
                  />
                </div>
                <div className="flex justify-between text-[10px] opacity-50 mt-1">
                  <span>Xarajat {formatMoney(statAnalytics.totalCost)}</span>
                  <span className="text-emerald-500/90">Foyda {formatMoney(statAnalytics.totalProfit)}</span>
                </div>
              </div>
            ) : statPeriod !== 'all' ? (
              <p className="text-sm opacity-60 text-center py-4 mt-2">
                Tanlangan davrda sotuv topilmadi
              </p>
            ) : null}
          </Card>

          {statAnalytics.monthly.length > 0 ? (
            <Card isDark={isDark}>
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: accentColor.color }} />
                Oylik aylanma va foyda
                {statPeriod !== 'all' ? (
                  <span className="text-[10px] font-normal opacity-50">
                    ({getHistoryPeriodLabel(statPeriod)})
                  </span>
                ) : null}
              </h3>
              <ul className={dillerListClass}>
                {statAnalytics.monthly.map((m) => (
                  <li key={m.key}>
                    <div className="flex justify-between text-xs mb-1 gap-2">
                      <span className="font-semibold">{m.label}</span>
                      <div className="text-right shrink-0">
                        <div className="text-emerald-400 font-bold">{formatMoney(m.total)}</div>
                        <div
                          className={`text-[10px] font-bold ${m.profit >= 0 ? 'text-emerald-500/80' : 'text-red-400'}`}
                        >
                          {formatMoney(m.profit)} foyda
                        </div>
                      </div>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden mb-1"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(m.total / maxMonthTotal) * 100}%`,
                          background: accentColor.gradient,
                        }}
                      />
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}
                    >
                      <div
                        className="h-full rounded-full bg-emerald-500/80"
                        style={{
                          width: `${(Math.abs(m.profit) / maxMonthProfit) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] opacity-50 mt-0.5">
                      {m.count} sotuv · Naqd {formatMoney(m.naqd)} · Qarz {formatMoney(m.qarz)}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {currentDebt.byStore.length > 0 ? (
            <Card isDark={isDark}>
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-400" />
                Do‘konlar bo‘yicha ochiq qarz
                <span className="text-[10px] font-normal opacity-50">(hozirgi holat)</span>
              </h3>
              <ul className="space-y-3">
                {currentDebt.byStore.slice(0, 10).map((row) => (
                  <li key={row.storeId}>
                    <div className="flex justify-between text-xs mb-1 gap-2">
                      <span className="font-semibold truncate">{row.storeName}</span>
                      <span className="text-amber-500 font-bold shrink-0">
                        {formatMoney(row.openDebt)}
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600"
                        style={{ width: `${(row.openDebt / maxStoreDebt) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {statAnalytics.topStoresByRevenue.length > 0 ? (
            <Card isDark={isDark}>
              <h3 className="font-bold text-sm mb-3">
                Top do‘konlar (sotuv)
                {statPeriod !== 'all' ? (
                  <span className="text-[10px] font-normal opacity-50 ml-1">
                    ({getHistoryPeriodLabel(statPeriod)})
                  </span>
                ) : null}
              </h3>
              <ul className="space-y-2">
                {statAnalytics.topStoresByRevenue.map((row, i) => (
                  <li
                    key={row.storeId}
                    className="flex justify-between text-sm py-2 border-b last:border-0"
                    style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
                  >
                    <span className="opacity-80 truncate pr-2">
                      {i + 1}. {row.storeName}
                    </span>
                    <div className="shrink-0 text-right">
                      <div className="font-bold text-emerald-400">{formatMoney(row.total)}</div>
                      <div className="text-[10px] text-emerald-500/70">{formatMoney(row.profit)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {statAnalytics.topProductsByQty.length > 0 ? (
            <Card isDark={isDark}>
              <h3 className="font-bold text-sm mb-3">
                Top mahsulotlar
                {statPeriod !== 'all' ? (
                  <span className="text-[10px] font-normal opacity-50 ml-1">
                    ({getHistoryPeriodLabel(statPeriod)})
                  </span>
                ) : null}
              </h3>
              <ul className="space-y-2">
                {statAnalytics.topProductsByQty.map((row, i) => (
                  <li
                    key={row.productId}
                    className="flex justify-between text-sm py-2 border-b last:border-0 gap-2"
                    style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
                  >
                    <span className="opacity-80 truncate">
                      {i + 1}. {row.productName}
                    </span>
                    <div className="shrink-0 text-right">
                      <div className="font-bold">{row.qty} dona</div>
                      <div className="text-[10px] text-emerald-500/80">{formatMoney(row.profit)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}

      {section === 'buyurtma' ? (
        <DillerBuyurtmaSection data={data} onDataChange={onDataChange} isDark={isDark} />
      ) : null}

      {section === 'xarajat' ? (
        <DillerHarajatSection data={data} onDataChange={onDataChange} isDark={isDark} />
      ) : null}

      {section === 'balans' ? (
        <DillerBalansSection data={data} onDataChange={onDataChange} isDark={isDark} />
      ) : null}

      {section === 'tarix' ? (
        <>
          <Card isDark={isDark}>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-5 h-5" style={{ color: accentColor.color }} />
              <h3 className="font-bold text-base">Sotuvlar tarixi</h3>
            </div>
            <p className="text-xs opacity-60 mb-3">
              Vaqt oralig‘ini tanlang yoki «Tanlash» orqali aniq sanani belgilang.
            </p>

            <div className="flex gap-1.5 mb-2 flex-wrap">
              {periodOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setHistoryPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    historyPeriod === p.id
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isDark
                        ? 'bg-white/5 opacity-70'
                        : 'bg-gray-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {historyPeriod === 'custom' ? (
              <div
                className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-xl"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}
              >
                <div>
                  <label className="block text-[10px] opacity-60 mb-1">Dan (boshlanish)</label>
                  <input
                    type="date"
                    value={historyCustomRange.from}
                    max={historyCustomRange.to}
                    onChange={(e) =>
                      setHistoryCustomRange((r) => ({ ...r, from: e.target.value }))
                    }
                    className={`w-full px-2 py-2 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]'
                        : 'bg-white border-gray-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] opacity-60 mb-1">Gacha (tugash)</label>
                  <input
                    type="date"
                    value={historyCustomRange.to}
                    min={historyCustomRange.from}
                    max={toIsoDate(new Date())}
                    onChange={(e) =>
                      setHistoryCustomRange((r) => ({ ...r, to: e.target.value }))
                    }
                    className={`w-full px-2 py-2 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]'
                        : 'bg-white border-gray-200'
                    }`}
                  />
                </div>
              </div>
            ) : null}

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Do‘kon yoki mahsulot qidirish..."
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
                    : 'bg-white border-gray-200'
                }`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Ko‘rsatilmoqda"
                value={String(historyTotals.transactions)}
                sub={`${historyTotals.count} qator`}
                color={accentColor.color}
                isDark={isDark}
              />
              <StatTile
                label="Jami summa"
                value={formatMoney(historyTotals.sum)}
                isDark={isDark}
                color="#10b981"
              />
              <StatTile
                label="Jami foyda"
                value={formatMoney(historyTotals.profit)}
                sub={
                  historyTotals.sum > 0
                    ? `Marja ${Math.round((historyTotals.profit / historyTotals.sum) * 1000) / 10}%`
                    : undefined
                }
                color={historyTotals.profit >= 0 ? '#10b981' : '#ef4444'}
                isDark={isDark}
              />
              <StatTile
                label="Chegirma"
                value={formatMoney(historyTotals.discount)}
                isDark={isDark}
                color="#f43f5e"
              />
            </div>
          </Card>

          {historyGroups.length === 0 ? (
            <Card isDark={isDark}>
              <p className="text-sm opacity-60 text-center py-8">
                {data.sales.length === 0
                  ? 'Hali sotuv yo‘q — «Sotuv» tabida qayd eting'
                  : 'Bu davrda sotuv topilmadi'}
              </p>
            </Card>
          ) : (
            <ul className="space-y-2 pb-4">
              {historyGroups.map((group) => {
                const expanded = expandedMonths.has(group.key) || historyGroups.length <= 3;
                return (
                  <li key={group.key}>
                    <button
                      type="button"
                      onClick={() => toggleMonth(group.key)}
                      className="w-full flex items-center gap-2 p-3 rounded-2xl border text-left"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      }}
                    >
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0 opacity-60" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{group.label}</div>
                        <div className="text-xs opacity-60">
                          {group.count} sotuv · {formatMoney(group.total)}
                        </div>
                      </div>
                    </button>
                    {expanded ? (
                      <ul className="mt-2 space-y-2 pl-1">
                        {group.sales.map((sale) => (
                          <li key={sale.id}>
                            <DillerSaleCard
                              sale={sale}
                              data={data}
                              isDark={isDark}
                              onOpenChek={() => setReceiptSale(sale)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
