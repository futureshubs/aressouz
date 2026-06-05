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
  TrendingUp,
  Wallet,
  CircleDollarSign,
  Receipt,
} from 'lucide-react';
import { DillerHarajatSection } from './DillerHarajatSection';
import { computeAllExpenseSummary } from '../../utils/dillerExpenseAnalytics';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerSale } from '../../utils/dillerData';
import { formatMoney, recordDebtPayment, settleDebtFully } from '../../utils/dillerData';
import { DillerSaleCard } from './DillerSaleCard';
import { DillerSaleReceiptModal } from './DillerSaleReceiptModal';
import {
  computeExtendedAnalytics,
  filterDebtSales,
  defaultCustomHistoryRange,
  filterSalesByPeriod,
  toIsoDate,
  getMaxMonthlyProfit,
  getMaxMonthlyTotal,
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

type QarzSection = 'qarz' | 'statistika' | 'tarix' | 'xarajat';

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
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('all');
  const [historyCustomRange, setHistoryCustomRange] = useState<HistoryDateRange>(() =>
    defaultCustomHistoryRange(),
  );
  const [historySearch, setHistorySearch] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [receiptSale, setReceiptSale] = useState<DillerSale | null>(null);

  const analytics = useMemo(() => computeExtendedAnalytics(data), [data]);
  const expenseAll = useMemo(() => computeAllExpenseSummary(data), [data]);
  const maxStoreDebt = Math.max(1, ...analytics.byStore.map((s) => s.openDebt));
  const maxMonthTotal = getMaxMonthlyTotal(analytics.monthly);
  const maxMonthProfit = getMaxMonthlyProfit(analytics.monthly);

  const filteredSales = useMemo(() => {
    const list = filterDebtSales(data.sales, filter);
    if (filter === 'closed') {
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return list.sort((a, b) => {
      const aOver = isSaleOverdue(a) ? 1 : 0;
      const bOver = isSaleOverdue(b) ? 1 : 0;
      if (bOver !== aOver) return bOver - aOver;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data.sales, filter]);

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
      sum: historySales.reduce((s, x) => s + x.total, 0),
      profit: sumSalesProfit(historySales, data),
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

  const submitPayment = (saleId: string, full = false) => {
    const result = full
      ? settleDebtFully(data, saleId)
      : recordDebtPayment(data, saleId, Number(payAmount) || 0);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onDataChange(result.data);
    setPaySaleId(null);
    setPayAmount('');
    toast.success(full ? 'Qarz yopildi' : 'To‘lov qayd etildi');
  };

  const debtFilters: { id: DebtFilter; label: string }[] = [
    { id: 'all', label: 'Hammasi' },
    { id: 'overdue', label: 'Muddati o‘tgan' },
    { id: 'soon', label: '7 kun ichida' },
    {
      id: 'closed',
      label:
        analytics.closedDebtCount > 0
          ? `Yakunlangan (${analytics.closedDebtCount})`
          : 'Yakunlangan',
    },
  ];

  const periodOptions: { id: HistoryPeriod; label: string }[] = [
    { id: '1d', label: '1 kun' },
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
    { id: 'statistika', label: 'Statistika', icon: BarChart3 },
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
      />

      <div
        className="flex gap-1 p-1 rounded-2xl"
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
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all min-w-0 ${
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
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Ochiq qarz"
                value={formatMoney(analytics.openDebtTotal)}
                sub={`${analytics.openDebtCount} ta`}
                color="#f59e0b"
                isDark={isDark}
              />
              <StatTile
                label="Muddati o‘tgan"
                value={formatMoney(analytics.overdueTotal)}
                sub={`${analytics.overdueCount} ta`}
                color="#ef4444"
                isDark={isDark}
              />
            </div>
            {analytics.dueSoonCount > 0 ? (
              <div
                className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-xl"
                style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.1)' }}
              >
                <CalendarClock className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong>{analytics.dueSoonCount}</strong> ta qarz 7 kun ichida
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
                  ? 'Yakunlangan qarz yo‘q'
                  : analytics.openDebtCount === 0
                    ? 'Ochiq qarz yo‘q'
                    : 'Filtr bo‘yicha topilmadi'}
              </p>
            ) : (
              <ul className={dillerListClass}>
                {filteredSales.map((sale) => {
                  const store = data.stores.find((s) => s.id === sale.storeId);
                  const product = data.products.find((p) => p.id === sale.productId);
                  const overdue = filter !== 'closed' && isSaleOverdue(sale);
                  const closed = isSaleDebtClosed(sale);
                  const paying = paySaleId === sale.id;

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
                              <span className="opacity-50">Qarz</span>
                              <div className="font-bold text-amber-500">
                                {formatMoney(sale.debtAmount)}
                              </div>
                            </div>
                            <div>
                              <span className="opacity-50">Oldin olingan</span>
                              <div className="font-semibold text-emerald-500/90">
                                {formatMoney(sale.paidAmount)}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
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
                        <div className="mt-3 flex gap-2">
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
                            onClick={() => submitPayment(sale.id)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-900"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPaySaleId(sale.id);
                              setPayAmount(String(sale.debtAmount));
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
                            onClick={() => submitPayment(sale.id, true)}
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-900 flex items-center justify-center gap-1"
                            style={{ background: accentColor.gradient }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Yopildi
                          </button>
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
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="w-5 h-5" style={{ color: accentColor.color }} />
              <h3 className="font-bold text-base">Umumiy ko‘rsatkichlar</h3>
            </div>
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
                className={`text-2xl font-black ${analytics.totalProfit < 0 ? 'text-red-400' : 'text-emerald-500'}`}
              >
                {formatMoney(analytics.totalProfit)}
              </div>
              <div className="text-[10px] opacity-55 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                <span>
                  Xarajat: <strong>{formatMoney(analytics.totalCost)}</strong>
                </span>
                <span>
                  Marja: <strong>{analytics.profitMarginPercent}%</strong>
                </span>
                <span>
                  O‘rtacha: <strong>{formatMoney(analytics.avgProfitPerSale)}</strong>/sotuv
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Jami aylanma"
                value={formatMoney(analytics.totalRevenue)}
                sub={`${analytics.totalSalesCount} ta sotuv`}
                color={accentColor.color}
                isDark={isDark}
              />
              <StatTile
                label="Jami foyda"
                value={formatMoney(analytics.totalProfit)}
                sub={`Marja ${analytics.profitMarginPercent}%`}
                color={analytics.totalProfit >= 0 ? '#10b981' : '#ef4444'}
                isDark={isDark}
              />
              <StatTile
                label="O‘rtacha sotuv"
                value={formatMoney(analytics.avgSaleAmount)}
                sub={`Foyda ${formatMoney(analytics.avgProfitPerSale)}`}
                isDark={isDark}
                color={isDark ? '#fff' : '#111'}
              />
              <StatTile
                label="Foyda (naqd / qarz)"
                value={formatMoney(analytics.naqdProfit)}
                sub={`Qarzli ${formatMoney(analytics.qarzProfit)}`}
                color="#22d3ee"
                isDark={isDark}
              />
              <StatTile
                label="Undirilgan (kredit)"
                value={formatMoney(analytics.paidOnCreditTotal)}
                sub={`Undirish ${analytics.collectionRate}%`}
                color="#10b981"
                isDark={isDark}
              />
              <StatTile
                label="Yopilgan qarzlar"
                value={String(analytics.closedDebtCount)}
                sub={`Naqd ${analytics.naqdSalesCount} · Qarz ${analytics.qarzSalesCount}`}
                color="#6366f1"
                isDark={isDark}
              />
              <StatTile
                label="Operatsion xarajat"
                value={formatMoney(expenseAll.total)}
                sub={`Naqd ${formatMoney(expenseAll.naqdTotal)} · Karta ${formatMoney(expenseAll.kartaTotal)}`}
                color="#f87171"
                isDark={isDark}
              />
              <StatTile
                label="Sof foyda (taxminiy)"
                value={formatMoney(analytics.totalProfit - expenseAll.total)}
                sub="Foyda − xarajatlar"
                color={
                  analytics.totalProfit - expenseAll.total >= 0 ? '#10b981' : '#ef4444'
                }
                isDark={isDark}
              />
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="opacity-70 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Naqd vs qarzli
                </span>
                <span className="font-mono text-[10px] opacity-60">
                  {analytics.totalRevenue > 0
                    ? `${Math.round((analytics.naqdRevenue / analytics.totalRevenue) * 100)}% naqd`
                    : '—'}
                </span>
              </div>
              <div
                className="h-3 rounded-full overflow-hidden flex"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
              >
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: analytics.totalRevenue
                      ? `${(analytics.naqdRevenue / analytics.totalRevenue) * 100}%`
                      : '0%',
                  }}
                />
                <div
                  className="h-full bg-amber-500"
                  style={{
                    width: analytics.totalRevenue
                      ? `${(analytics.creditSalesTotal / analytics.totalRevenue) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>

            {analytics.totalRevenue > 0 ? (
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="opacity-70">Aylanma vs foyda</span>
                  <span className="font-mono text-[10px] opacity-60">
                    Foyda {analytics.profitMarginPercent}%
                  </span>
                </div>
                <div
                  className="h-3 rounded-full overflow-hidden flex"
                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
                >
                  <div
                    className="h-full bg-slate-500/60"
                    style={{
                      width: `${Math.min(100, (analytics.totalCost / analytics.totalRevenue) * 100)}%`,
                    }}
                    title="Xarajat"
                  />
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, (analytics.totalProfit / analytics.totalRevenue) * 100))}%`,
                    }}
                    title="Foyda"
                  />
                </div>
                <div className="flex justify-between text-[10px] opacity-50 mt-1">
                  <span>Xarajat {formatMoney(analytics.totalCost)}</span>
                  <span className="text-emerald-500/90">Foyda {formatMoney(analytics.totalProfit)}</span>
                </div>
              </div>
            ) : null}
          </Card>

          {analytics.monthly.length > 0 ? (
            <Card isDark={isDark}>
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: accentColor.color }} />
                Oylik aylanma va foyda
              </h3>
              <ul className={dillerListClass}>
                {analytics.monthly.map((m) => (
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
                      {m.count} sotuv · Xarajat {formatMoney(m.cost)} · Naqd {formatMoney(m.naqd)}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {analytics.byStore.length > 0 ? (
            <Card isDark={isDark}>
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-400" />
                Do‘konlar bo‘yicha ochiq qarz
              </h3>
              <ul className="space-y-3">
                {analytics.byStore.slice(0, 10).map((row) => (
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

          {analytics.topStoresByRevenue.length > 0 ? (
            <Card isDark={isDark}>
              <h3 className="font-bold text-sm mb-3">Top do‘konlar (sotuv)</h3>
              <ul className="space-y-2">
                {analytics.topStoresByRevenue.map((row, i) => (
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

          {analytics.topProductsByQty.length > 0 ? (
            <Card isDark={isDark}>
              <h3 className="font-bold text-sm mb-3">Top mahsulotlar</h3>
              <ul className="space-y-2">
                {analytics.topProductsByQty.map((row, i) => (
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

      {section === 'xarajat' ? (
        <DillerHarajatSection data={data} onDataChange={onDataChange} isDark={isDark} />
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
                value={String(historyTotals.count)}
                sub="ta sotuv"
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
                label="O‘rtacha foyda"
                value={formatMoney(
                  historyTotals.count ? Math.round(historyTotals.profit / historyTotals.count) : 0,
                )}
                isDark={isDark}
                color={isDark ? '#fff' : '#111'}
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
