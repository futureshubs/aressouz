import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  History,
  Search,
  Wallet,
  Receipt,
} from 'lucide-react';
import { useDillerUserLocation } from '../../hooks/useDillerUserLocation';
import { DillerBalansSection } from './DillerBalansSection';
import { DillerBuyurtmaSection } from './DillerBuyurtmaSection';
import { DillerHarajatSection } from './DillerHarajatSection';
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
import {
  dillerAddCalendarDays,
  dillerAddCalendarMonths,
  dillerCalendarDate,
  dillerCalendarDaysBetween,
  dillerTodayDate,
  formatDillerDate,
} from '../../utils/dillerTime';
import { DillerSaleCard } from './DillerSaleCard';
import { DillerSaleReceiptModal } from './DillerSaleReceiptModal';
import {
  applyDebtFilterToCreditSales,
  computePeriodDebtSummaryFromCreditSales,
  countSaleTransactions,
  defaultCustomHistoryRange,
  filterSalesByPeriod,
  getHistoryPeriodLabel,
  groupSalesByMonth,
  sumSalesProfit,
  isSaleOverdue,
  type DebtFilter,
  type HistoryDateRange,
  type HistoryPeriod,
} from '../../utils/dillerDebtAnalytics';
import { dillerTabContentClass } from './dillerMobileLayout';
import { iosAccentFillStyle, iosGlassCardStyle, iosGlassInputStyle } from './dillerIosGlass';
import { DillerDebtListCard, DillerDebtPaySheet } from './DillerDebtPaySheet';
import { DillerStatistikaSection } from './DillerStatistikaSection';

type QarzSection = 'qarz' | 'buyurtma' | 'statistika' | 'analitika' | 'balans' | 'tarix' | 'xarajat';

type Props = {
  data: DillerData;
  onDataChange: (next: DillerData) => void;
  /** Menu orqali ochilganda faqat shu bo‘lim */
  forcedSection?: QarzSection;
  onGoHome?: () => void;
};

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
    <div className={`rounded-[22px] p-4 ${className}`.trim()} style={iosGlassCardStyle(isDark)}>
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
    <div className="rounded-[18px] p-3 min-w-0" style={iosGlassCardStyle(isDark)}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-45 truncate">{label}</div>
      <div className="text-sm font-black mt-0.5 truncate tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub ? <div className="text-[10px] opacity-45 mt-0.5">{sub}</div> : null}
    </div>
  );
}

function formatIsoDay(iso: string): string {
  return formatDillerDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysInclusive(from: string, to: string): number {
  return Math.max(1, Math.abs(dillerCalendarDaysBetween(from, to)) + 1);
}

function rangeFromDebtPreset(id: HistoryPeriod, earliest: string): { from: string; to: string } {
  const to = dillerTodayDate();
  if (id === '1d') return { from: to, to };
  if (id === '1w') return { from: dillerAddCalendarDays(to, -6), to };
  if (id === '1m') return { from: dillerAddCalendarMonths(to, -1), to };
  return { from: earliest || to, to };
}

function PeriodChip({
  label,
  active,
  isDark,
  onClick,
  tone = 'accent',
  fillWidth = false,
}: {
  label: string;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
  tone?: 'accent' | 'amber' | 'emerald';
  fillWidth?: boolean;
}) {
  const { accentColor } = useTheme();
  const fill =
    tone === 'amber'
      ? iosAccentFillStyle('linear-gradient(135deg,#fbbf24,#d97706)', '#d97706')
      : tone === 'emerald'
        ? iosAccentFillStyle('linear-gradient(135deg,#34d399,#10b981)', '#10b981')
        : iosAccentFillStyle(accentColor.gradient, accentColor.color);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${fillWidth ? 'w-full min-w-0 px-1' : 'shrink-0 px-3.5'} py-2 rounded-[14px] text-[11px] sm:text-[12px] font-bold active:scale-[0.96]`}
      style={active ? fill : iosGlassCardStyle(isDark)}
    >
      {label}
    </button>
  );
}

export function DillerQarzTab({ data, onDataChange, forcedSection, onGoHome }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [filter, setFilter] = useState<DebtFilter>('all');
  const [debtPeriod, setDebtPeriod] = useState<HistoryPeriod>('all');
  const [debtCustomRange, setDebtCustomRange] = useState<HistoryDateRange>(() =>
    defaultCustomHistoryRange(),
  );
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [sendDebtSms, setSendDebtSms] = useState(true);
  const [smsBusyId, setSmsBusyId] = useState<string | null>(null);
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('all');
  const [historyCustomRange, setHistoryCustomRange] = useState<HistoryDateRange>(() =>
    defaultCustomHistoryRange(),
  );
  const [historySearch, setHistorySearch] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [receiptSale, setReceiptSale] = useState<DillerSale | null>(null);
  const activeSection = forcedSection ?? 'qarz';

  const earliestQarzDay = useMemo(() => {
    let min = dillerTodayDate();
    for (const sale of data.sales) {
      if (sale.paymentType !== 'qarz' || sale.cancelled) continue;
      const day = dillerCalendarDate(sale.createdAt);
      if (day && day < min) min = day;
    }
    return min;
  }, [data.sales]);

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

  const { location: userLoc } = useDillerUserLocation(activeSection === 'qarz');

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
    if (full || (result.remainingDebt ?? 0) <= 0) setDetailSaleId(null);
    setPayAmount(full || (result.remainingDebt ?? 0) <= 0 ? '' : String(result.remainingDebt ?? ''));

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

  const debtPeriodOptions: { id: HistoryPeriod; label: string }[] = [
    { id: '1d', label: 'Bugun' },
    { id: '1w', label: '7 kun' },
    { id: '1m', label: '1 oy' },
    { id: 'all', label: 'Barchasi' },
  ];

  const applyDebtPeriod = (id: HistoryPeriod) => {
    setDebtPeriod(id);
    setDebtCustomRange(rangeFromDebtPreset(id, earliestQarzDay));
  };

  const setCustomBound = (key: 'from' | 'to', value: string) => {
    if (!value) return;
    const base =
      debtPeriod === 'custom'
        ? debtCustomRange
        : rangeFromDebtPreset(debtPeriod, earliestQarzDay);
    const next = { ...base, [key]: value };
    if (next.from && next.to && next.from > next.to) {
      next.from = value;
      next.to = value;
    }
    setDebtPeriod('custom');
    setDebtCustomRange(next);
  };

  const hulosaDates =
    debtPeriod === 'custom'
      ? debtCustomRange
      : rangeFromDebtPreset(debtPeriod, earliestQarzDay);

  const hulosaRangeLabel =
    debtPeriod === 'custom'
      ? `${formatIsoDay(hulosaDates.from)} — ${formatIsoDay(hulosaDates.to)} · ${daysInclusive(hulosaDates.from, hulosaDates.to)} kun`
      : getHistoryPeriodLabel(debtPeriod);

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

  const detailSale = detailSaleId
    ? data.sales.find((s) => s.id === detailSaleId) ?? null
    : null;

  const openDebtDetail = (sale: DillerSale) => {
    const store = data.stores.find((s) => s.id === sale.storeId);
    setDetailSaleId(sale.id);
    setPayAmount(String(sale.debtAmount ?? 0));
    setSendDebtSms(Boolean(normalizeUzPhoneForSms(store?.phone || '')));
  };

  return (
    <div className={dillerTabContentClass}>
      <DillerSaleReceiptModal
        open={!!receiptSale}
        onClose={() => setReceiptSale(null)}
        sale={receiptSale}
        data={data}
        onDataChange={onDataChange}
      />

      {detailSale ? (
        <DillerDebtPaySheet
          open
          sale={detailSale}
          data={data}
          distanceLabel={formatStoreDistance(
            getStoreDistanceKm(storeById.get(detailSale.storeId), userLoc),
          )}
          storeDebt={storeDebtById.get(detailSale.storeId) ?? null}
          sendDebtSms={sendDebtSms}
          onSendDebtSmsChange={setSendDebtSms}
          smsBusy={smsBusyId === detailSale.id}
          payAmount={payAmount}
          onPayAmountChange={setPayAmount}
          onClose={() => {
            setDetailSaleId(null);
            setPayAmount('');
          }}
          onPartialPay={() => void submitPayment(detailSale.id)}
          onSettle={() => void submitPayment(detailSale.id, true)}
          onOverdueSms={() => void sendOverdueSms(detailSale)}
          onOpenChek={() => setReceiptSale(detailSale)}
        />
      ) : null}

      {activeSection === 'qarz' ? (
        <>
          <div className="relative overflow-hidden rounded-[26px] p-4" style={iosGlassCardStyle(isDark)}>
            <div
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                background:
                  'radial-gradient(120% 90% at 100% -10%, rgba(251,191,36,0.28), transparent 55%)',
              }}
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                      style={{ background: 'rgba(245,158,11,0.22)', color: '#fbbf24' }}
                    >
                      <Wallet className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-black text-[15px] tracking-tight leading-tight">Qarz hulosasi</h3>
                      <p className="text-[11px] opacity-50 truncate">
                        {hulosaRangeLabel}
                        {` · ${debtSummary.creditSalesCount} ta sotuv`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-amber-400/80">
                    Ochiq qarz
                  </div>
                  <div className="text-[28px] font-black tabular-nums leading-tight tracking-tight text-amber-400">
                    {formatMoney(debtSummary.openDebtTotal)}
                  </div>
                  <div className="text-[12px] opacity-50 mt-0.5">
                    {debtSummary.openDebtCount} ta ochiq ·{' '}
                    {debtSummary.overdueCount > 0
                      ? `${debtSummary.overdueCount} ta kechikkan`
                      : 'muddati o‘tgan yo‘q'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5 mt-4">
                {debtPeriodOptions.map((p) => (
                  <PeriodChip
                    key={p.id}
                    label={p.label}
                    active={debtPeriod === p.id}
                    isDark={isDark}
                    tone="amber"
                    fillWidth
                    onClick={() => applyDebtPeriod(p.id)}
                  />
                ))}
              </div>

              <div
                className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-[16px]"
                style={{
                  ...iosGlassInputStyle(isDark),
                  border:
                    debtPeriod === 'custom'
                      ? '0.5px solid rgba(251,191,36,0.45)'
                      : iosGlassInputStyle(isDark).border,
                }}
              >
                <label className="min-w-0">
                  <span className="flex items-center gap-1 text-[10px] font-semibold opacity-55 mb-1">
                    <Calendar className="w-3 h-3" />
                    Dan
                  </span>
                  <input
                    type="date"
                    value={hulosaDates.from}
                    min={earliestQarzDay}
                    max={dillerTodayDate()}
                    onChange={(e) => setCustomBound('from', e.target.value)}
                    className={`w-full min-w-0 bg-transparent outline-none text-[13px] font-semibold tabular-nums ${
                      isDark ? '[color-scheme:dark] text-white' : 'text-gray-900'
                    }`}
                  />
                </label>
                <label className="min-w-0">
                  <span className="flex items-center gap-1 text-[10px] font-semibold opacity-55 mb-1">
                    <Calendar className="w-3 h-3" />
                    Gacha
                  </span>
                  <input
                    type="date"
                    value={hulosaDates.to}
                    min={hulosaDates.from || earliestQarzDay}
                    max={dillerTodayDate()}
                    onChange={(e) => setCustomBound('to', e.target.value)}
                    className={`w-full min-w-0 bg-transparent outline-none text-[13px] font-semibold tabular-nums ${
                      isDark ? '[color-scheme:dark] text-white' : 'text-gray-900'
                    }`}
                  />
                </label>
              </div>
              {debtPeriod === 'custom' ? (
                <p className="text-[10px] opacity-45 mt-2 px-0.5">
                  Tanlangan oraliq bo‘yicha hisoblandi
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatTile
              label="Kechikkan"
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
              className="flex items-center gap-2 text-xs px-3.5 py-3 rounded-[18px]"
              style={{
                background: isDark ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.1)',
                border: '0.5px solid rgba(59,130,246,0.28)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <CalendarClock className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                <strong>{debtSummary.dueSoonCount}</strong> ta qarz 7 kun ichida
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="font-black text-[15px] tracking-tight">
              {filter === 'closed' ? 'Yakunlangan qarzlar' : 'Ochiq qarzlar'}
            </h3>
            <span className="text-[11px] opacity-45 tabular-nums">{filteredSales.length} ta</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {debtFilters.map((f) => (
              <PeriodChip
                key={f.id}
                label={f.label}
                active={filter === f.id}
                isDark={isDark}
                tone={f.id === 'closed' ? 'emerald' : 'amber'}
                onClick={() => {
                  setFilter(f.id);
                  setDetailSaleId(null);
                  setPayAmount('');
                }}
              />
            ))}
          </div>

            {filteredSales.length === 0 ? (
              <div className="rounded-[22px] px-5 py-10 text-center" style={iosGlassCardStyle(isDark)}>
                <Wallet className="w-8 h-8 mx-auto mb-3 opacity-40 text-amber-400" />
                <p className="text-sm font-bold">
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
              </div>
            ) : (
              <ul className="space-y-2.5">
                {filteredSales.map((sale) => (
                  <li key={sale.id}>
                    <DillerDebtListCard
                      sale={sale}
                      data={data}
                      isDark={isDark}
                      distanceLabel={formatStoreDistance(
                        getStoreDistanceKm(storeById.get(sale.storeId), userLoc),
                      )}
                      storeDebt={storeDebtById.get(sale.storeId)}
                      onOpen={() => openDebtDetail(sale)}
                    />
                  </li>
                ))}
              </ul>
            )}
        </>
      ) : null}

      {activeSection === 'statistika' || activeSection === 'analitika' ? (
        <DillerStatistikaSection
          mode={activeSection === 'analitika' ? 'analitika' : 'statistika'}
          data={data}
          onGoHome={onGoHome}
        />
      ) : null}


      {activeSection === 'buyurtma' ? (
        <DillerBuyurtmaSection data={data} onDataChange={onDataChange} isDark={isDark} />
      ) : null}

      {activeSection === 'xarajat' ? (
        <DillerHarajatSection data={data} onDataChange={onDataChange} isDark={isDark} />
      ) : null}

      {activeSection === 'balans' ? (
        <DillerBalansSection data={data} onDataChange={onDataChange} isDark={isDark} />
      ) : null}

      {activeSection === 'tarix' ? (
        <>
          <Card isDark={isDark}>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-5 h-5" style={{ color: accentColor.color }} />
              <h3 className="font-bold text-base">Sotuvlar tarixi</h3>
            </div>
            <p className="text-xs opacity-60 mb-3">
              Vaqt oralig‘ini tanlang yoki «Tanlash» orqali aniq sanani belgilang.
            </p>

            <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {periodOptions.map((p) => (
                <PeriodChip
                  key={p.id}
                  label={p.label}
                  active={historyPeriod === p.id}
                  isDark={isDark}
                  tone="emerald"
                  onClick={() => setHistoryPeriod(p.id)}
                />
              ))}
            </div>

            {historyPeriod === 'custom' ? (
              <div className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-[16px]" style={iosGlassInputStyle(isDark)}>
                <div>
                  <label className="block text-[10px] opacity-60 mb-1">Dan</label>
                  <input
                    type="date"
                    value={historyCustomRange.from}
                    max={historyCustomRange.to}
                    onChange={(e) =>
                      setHistoryCustomRange((r) => ({ ...r, from: e.target.value }))
                    }
                    className={`w-full px-2 py-2 rounded-lg bg-transparent outline-none text-sm ${
                      isDark ? '[color-scheme:dark]' : ''
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] opacity-60 mb-1">Gacha</label>
                  <input
                    type="date"
                    value={historyCustomRange.to}
                    min={historyCustomRange.from}
                    max={dillerTodayDate()}
                    onChange={(e) =>
                      setHistoryCustomRange((r) => ({ ...r, to: e.target.value }))
                    }
                    className={`w-full px-2 py-2 rounded-lg bg-transparent outline-none text-sm ${
                      isDark ? '[color-scheme:dark]' : ''
                    }`}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-[16px] px-3 py-2.5 mb-3" style={iosGlassInputStyle(isDark)}>
              <Search className="w-4 h-4 opacity-40 shrink-0" />
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Do‘kon yoki mahsulot qidirish..."
                className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:opacity-40"
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
                      className="w-full flex items-center gap-2 p-3.5 rounded-[20px] text-left active:scale-[0.985] transition-transform"
                      style={iosGlassCardStyle(isDark)}
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
