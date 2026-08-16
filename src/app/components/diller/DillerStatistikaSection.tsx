import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Box,
  LineChart,
  Receipt,
  ShoppingBag,
  Store,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData } from '../../utils/dillerData';
import { formatMoney, getWarehouseQty } from '../../utils/dillerData';
import {
  computeDebtAnalytics,
  computeExtendedAnalyticsForPeriod,
  computePaymentFlowBreakdown,
  defaultCustomHistoryRange,
  filterSalesByPeriod,
  type HistoryDateRange,
  type HistoryPeriod,
} from '../../utils/dillerDebtAnalytics';
import { computePeriodPnl, type DillerPeriodPnl } from '../../utils/dillerExpenseAnalytics';
import { dillerTodayDate } from '../../utils/dillerTime';
import { iosAccentFillStyle, iosGlassCardStyle, iosGlassInputStyle } from './dillerIosGlass';

type Mode = 'statistika' | 'analitika';

type Props = {
  mode: Mode;
  data: DillerData;
  onGoHome?: () => void;
};

const PERIODS: { id: HistoryPeriod; label: string; word: string }[] = [
  { id: '1d', label: 'Kun', word: 'kun' },
  { id: '1w', label: 'Hafta', word: 'hafta' },
  { id: '1m', label: 'Oy', word: 'oy' },
  { id: '1y', label: 'Yil', word: 'yil' },
  { id: 'custom', label: 'Davr', word: 'davr' },
];

function periodWord(id: HistoryPeriod) {
  return PERIODS.find((p) => p.id === id)?.word ?? 'davr';
}

function warehouseSnapshot(data: DillerData) {
  let value = 0;
  let potential = 0;
  let units = 0;
  let types = 0;
  let low = 0;
  for (const p of data.products) {
    const q = getWarehouseQty(data, p.id);
    if (q <= 0) continue;
    types += 1;
    units += q;
    value += q * (p.buyPrice ?? 0);
    potential += q * Math.max(0, (p.unitPrice ?? 0) - (p.buyPrice ?? 0));
    if (q <= 5) low += 1;
  }
  return { value, potential, units, types, low };
}

function KpiCard({
  isDark,
  Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
  valueColor,
}: {
  isDark: boolean;
  Icon: typeof Wallet;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-[22px] p-3.5 min-w-0" style={iosGlassCardStyle(isDark)}>
      <div
        className="w-9 h-9 rounded-[12px] flex items-center justify-center mb-2.5"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={2.2} />
      </div>
      <div className="text-[11px] font-semibold opacity-45 truncate">{label}</div>
      <div
        className="text-[15px] font-black tabular-nums tracking-tight mt-0.5 leading-snug break-words"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      {sub ? <div className="text-[11px] opacity-40 mt-0.5 truncate">{sub}</div> : null}
    </div>
  );
}

function ProfitExpenseBlock({
  isDark,
  word,
  pnl,
}: {
  isDark: boolean;
  word: string;
  pnl: DillerPeriodPnl;
}) {
  const inProfit = pnl.net >= 0;
  const resultColor = inProfit ? '#10b981' : '#f87171';
  const resultLabel = inProfit ? 'Jami foyda' : 'Ziyon';
  const resultValue = inProfit ? pnl.jamiFoyda : pnl.ziyon;
  const maxCat = Math.max(1, ...pnl.categories.map((c) => c.total));

  return (
    <div className="space-y-2.5">
      <div className="relative overflow-hidden rounded-[22px] p-4" style={iosGlassCardStyle(isDark)}>
        <span
          className="absolute left-0 top-0 bottom-0 w-[4px]"
          style={{ background: resultColor }}
        />
        <div className="pl-1">
          <div className="text-[12px] font-bold" style={{ color: resultColor }}>
            Bu {word} — {inProfit ? 'sof natija' : 'zarar'}
          </div>
          <div
            className="text-[26px] font-black tabular-nums leading-tight tracking-tight mt-0.5"
            style={{ color: resultColor }}
          >
            {inProfit ? '+' : '−'}
            {formatMoney(resultValue)}
          </div>
          <div className="text-[11px] opacity-45 mt-1">
            {resultLabel}: sotuv foydasi − xarajat
          </div>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5 text-center">
          <div className="min-w-0 rounded-[14px] px-2 py-2" style={iosGlassInputStyle(isDark)}>
            <div className="text-[10px] opacity-45 truncate">Sof foyda</div>
            <div className="text-[12px] font-black tabular-nums text-emerald-400 truncate">
              {formatMoney(pnl.grossProfit)}
            </div>
          </div>
          <span className="text-sm font-black opacity-30">−</span>
          <div className="min-w-0 rounded-[14px] px-2 py-2" style={iosGlassInputStyle(isDark)}>
            <div className="text-[10px] opacity-45 truncate">Xarajat</div>
            <div className="text-[12px] font-black tabular-nums text-rose-400 truncate">
              {formatMoney(pnl.expenseTotal)}
            </div>
          </div>
          <span className="text-sm font-black opacity-30">=</span>
          <div className="min-w-0 rounded-[14px] px-2 py-2" style={iosGlassInputStyle(isDark)}>
            <div className="text-[10px] opacity-45 truncate">{resultLabel}</div>
            <div className="text-[12px] font-black tabular-nums truncate" style={{ color: resultColor }}>
              {formatMoney(resultValue)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <KpiCard
          isDark={isDark}
          Icon={TrendingUp}
          iconBg="rgba(16,185,129,0.16)"
          iconColor="#10b981"
          label="Sof foyda"
          value={formatMoney(pnl.grossProfit)}
          valueColor="#10b981"
          sub="Sotuv − tannarx"
        />
        <KpiCard
          isDark={isDark}
          Icon={Receipt}
          iconBg="rgba(244,63,94,0.16)"
          iconColor="#f43f5e"
          label="Xarajat"
          value={formatMoney(pnl.expenseTotal)}
          valueColor="#f43f5e"
          sub={pnl.expenseCount > 0 ? `${pnl.expenseCount} ta yozuv` : 'Bu davrda yo‘q'}
        />
        <KpiCard
          isDark={isDark}
          Icon={Wallet}
          iconBg="rgba(16,185,129,0.16)"
          iconColor="#10b981"
          label="Jami foyda"
          value={formatMoney(pnl.jamiFoyda)}
          valueColor={pnl.jamiFoyda > 0 ? '#10b981' : undefined}
          sub="Sof foyda − xarajat"
        />
        <KpiCard
          isDark={isDark}
          Icon={TrendingDown}
          iconBg="rgba(248,113,113,0.16)"
          iconColor="#f87171"
          label="Ziyon"
          value={formatMoney(pnl.ziyon)}
          valueColor={pnl.ziyon > 0 ? '#f87171' : undefined}
          sub={pnl.ziyon > 0 ? 'Xarajat foydadan oshdi' : 'Zarar yo‘q'}
        />
      </div>

      <div className="rounded-[22px] p-4" style={iosGlassCardStyle(isDark)}>
        <div className="text-[11px] font-semibold opacity-45 mb-2">Topilgan pul (tushum)</div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[13px] font-bold tabular-nums opacity-70">
              {formatMoney(pnl.cashIn)}
              <span className="opacity-40 font-semibold"> − </span>
              <span className="text-rose-400">{formatMoney(pnl.expenseTotal)}</span>
            </div>
            <div className="text-[10px] opacity-40 mt-0.5">Kirim − xarajat</div>
          </div>
          <div
            className={`text-[18px] font-black tabular-nums ${
              pnl.cashAfterExpenses >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatMoney(pnl.cashAfterExpenses)}
          </div>
        </div>
        {pnl.categories.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {pnl.categories.map((cat) => (
              <li key={cat.key}>
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate opacity-75">{cat.label}</span>
                  <span className="shrink-0 font-bold tabular-nums">{formatMoney(cat.total)}</span>
                </div>
                <div
                  className="h-1.5 rounded-full mt-1 overflow-hidden"
                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                >
                  <div
                    className="h-full rounded-full bg-rose-400/80"
                    style={{ width: `${Math.round((cat.total / maxCat) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function OpenDebtBanner({
  isDark,
  amount,
  shopCount,
}: {
  isDark: boolean;
  amount: number;
  shopCount: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-[22px] p-4" style={iosGlassCardStyle(isDark)}>
      <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-amber-400" />
      <div className="flex items-center gap-3 pl-1">
        <div
          className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0"
          style={{ background: 'rgba(245,158,11,0.18)', color: '#f59e0b' }}
        >
          <Wallet className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold text-amber-500">Ochiq qarzdorlik</div>
          <div className="text-[22px] font-black tabular-nums text-amber-500 leading-tight tracking-tight">
            {formatMoney(amount)}
          </div>
          <div className="text-[11px] opacity-45 mt-0.5">
            {shopCount} ta do‘konda qarz qolgan
          </div>
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'rgba(245,158,11,0.16)', color: '#f59e0b' }}
        >
          <AlertCircle className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export function DillerStatistikaSection({ mode, data, onGoHome }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isAnalitika = mode === 'analitika';
  const [period, setPeriod] = useState<HistoryPeriod>(isAnalitika ? '1m' : '1w');
  const [customRange, setCustomRange] = useState<HistoryDateRange>(() => defaultCustomHistoryRange());
  const custom = period === 'custom' ? customRange : undefined;
  const word = periodWord(period);
  const wordUpper = word.toUpperCase();

  const analytics = useMemo(
    () => computeExtendedAnalyticsForPeriod(data, period, custom),
    [data, period, customRange],
  );
  const flow = useMemo(
    () => computePaymentFlowBreakdown(data, period, custom),
    [data, period, customRange],
  );
  const currentDebt = useMemo(() => computeDebtAnalytics(data, data.sales), [data]);
  const ombor = useMemo(() => warehouseSnapshot(data), [data]);
  const soldQty = useMemo(() => {
    const sales = filterSalesByPeriod(data.sales, period, custom);
    return sales.reduce((s, row) => s + (row.qty || 0), 0);
  }, [data.sales, period, customRange]);

  const debtorStores = currentDebt.byStore.filter((s) => s.openDebt > 0);
  const pnl = useMemo(
    () =>
      computePeriodPnl({
        data,
        grossProfit: analytics.totalProfit,
        cashIn: flow.totalCashIn,
        period,
        customRange: custom,
      }),
    [data, analytics.totalProfit, flow.totalCashIn, period, customRange],
  );

  return (
    <div className="space-y-4 min-w-0">
      {onGoHome ? (
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold active:scale-[0.97]"
          style={iosGlassCardStyle(isDark)}
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2.4} />
          Bosh sahifa
        </button>
      ) : null}

      <div>
        <h1 className="text-[26px] font-black tracking-tight leading-none">
          {isAnalitika ? 'Data analitika' : 'Statistika'}
        </h1>
        <p className="text-[12px] opacity-45 mt-1.5">UTC+05:00 • Bu {word}</p>
        <p className="text-[11px] text-amber-500/90 mt-1.5 leading-snug">
          {isAnalitika
            ? 'Qarz tushumi undirilganda, mahsulot soni sotuvda. Xarajat sof foydadan ayiriladi.'
            : 'Qarzga sotuv: soni darhol, tushum/foyda/tannarx undirilganda. Xarajat foydadan ayiriladi.'}
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {PERIODS.map((p) => {
          const on = period === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-bold active:scale-[0.96]"
              style={
                on
                  ? iosAccentFillStyle(accentColor.gradient, accentColor.color)
                  : iosGlassCardStyle(isDark)
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {period === 'custom' ? (
        <div className="grid grid-cols-2 gap-2 p-3 rounded-[18px]" style={iosGlassCardStyle(isDark)}>
          <label className="min-w-0">
            <span className="block text-[10px] opacity-50 mb-1">Dan</span>
            <input
              type="date"
              value={customRange.from}
              max={customRange.to}
              onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))}
              className={`w-full bg-transparent outline-none text-sm ${isDark ? '[color-scheme:dark]' : ''}`}
            />
          </label>
          <label className="min-w-0">
            <span className="block text-[10px] opacity-50 mb-1">Gacha</span>
            <input
              type="date"
              value={customRange.to}
              min={customRange.from}
              max={dillerTodayDate()}
              onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))}
              className={`w-full bg-transparent outline-none text-sm ${isDark ? '[color-scheme:dark]' : ''}`}
            />
          </label>
        </div>
      ) : null}

      {isAnalitika ? (
        <div className="grid grid-cols-2 gap-2.5">
          <KpiCard
            isDark={isDark}
            Icon={Box}
            iconBg={`${accentColor.color}18`}
            iconColor={accentColor.color}
            label="Ombor qiymati"
            value={formatMoney(ombor.value)}
            sub={`${ombor.units} dona · ${ombor.types} tur`}
          />
          <KpiCard
            isDark={isDark}
            Icon={TrendingUp}
            iconBg="rgba(16,185,129,0.16)"
            iconColor="#10b981"
            label="Potensial foyda (ombor)"
            value={formatMoney(ombor.potential)}
            valueColor="#10b981"
            sub={ombor.low > 0 ? `⚠ ${ombor.low} ta kam` : 'Zaxira yetarli'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <KpiCard
            isDark={isDark}
            Icon={LineChart}
            iconBg={`${accentColor.color}18`}
            iconColor={accentColor.color}
            label="Jami sotuv"
            value={formatMoney(analytics.totalRevenue)}
          />
          <KpiCard
            isDark={isDark}
            Icon={Wallet}
            iconBg={pnl.net >= 0 ? 'rgba(16,185,129,0.16)' : 'rgba(248,113,113,0.16)'}
            iconColor={pnl.net >= 0 ? '#10b981' : '#f87171'}
            label="Jami foyda"
            value={formatMoney(pnl.net)}
            valueColor={pnl.net >= 0 ? '#10b981' : '#ef4444'}
            sub={`Xarajat ${formatMoney(pnl.expenseTotal)}`}
          />
          <KpiCard
            isDark={isDark}
            Icon={Receipt}
            iconBg="rgba(139,92,246,0.16)"
            iconColor="#8b5cf6"
            label="Cheklar"
            value={String(analytics.transactionCount)}
            sub={`${analytics.totalSalesCount} qator`}
          />
          <KpiCard
            isDark={isDark}
            Icon={ShoppingBag}
            iconBg="rgba(249,115,22,0.16)"
            iconColor="#f97316"
            label="O‘rtacha chek"
            value={formatMoney(analytics.avgSaleAmount)}
          />
        </div>
      )}

      <ProfitExpenseBlock isDark={isDark} word={word} pnl={pnl} />

      {isAnalitika ? (
        <div className="rounded-[22px] p-4" style={iosGlassCardStyle(isDark)}>
          <h3 className="font-bold text-[14px] mb-3">Bu {word} — sotuv analitikasi</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
            <div className="min-w-0">
              <div className="text-[11px] opacity-45">Hisobga olingan tushum</div>
              <div className="text-[15px] font-black tabular-nums mt-0.5" style={{ color: accentColor.color }}>
                {formatMoney(flow.totalCashIn)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] opacity-45">Sof foyda (sotuv)</div>
              <div className="text-[15px] font-black tabular-nums mt-0.5 text-emerald-500">
                {formatMoney(analytics.totalProfit)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] opacity-45">Xarajat</div>
              <div className="text-[15px] font-black tabular-nums mt-0.5 text-rose-400">
                {formatMoney(pnl.expenseTotal)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] opacity-45">
                {pnl.net >= 0 ? 'Jami foyda' : 'Ziyon'}
              </div>
              <div
                className={`text-[15px] font-black tabular-nums mt-0.5 ${
                  pnl.net >= 0 ? 'text-emerald-500' : 'text-rose-400'
                }`}
              >
                {formatMoney(pnl.net >= 0 ? pnl.jamiFoyda : pnl.ziyon)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] opacity-45">Sotilgan (dona)</div>
              <div className="text-[15px] font-black tabular-nums mt-0.5">{soldQty}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] opacity-45">Ochiq qarz</div>
              <div className="text-[15px] font-black tabular-nums mt-0.5 text-amber-500">
                {formatMoney(currentDebt.openDebtTotal)}
              </div>
              <div className="text-[10px] opacity-40">{debtorStores.length} do‘kon</div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] opacity-45">Qarzga berilgan</div>
              <div className="text-[15px] font-black tabular-nums mt-0.5 text-amber-500">
                {formatMoney(flow.newDebt.amount)}
              </div>
              <div className="text-[10px] opacity-40">Kutilmoqda</div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] opacity-45">Undirilgan (davr)</div>
              <div className="text-[15px] font-black tabular-nums mt-0.5 text-emerald-500">
                {formatMoney(flow.debtCollected.amount)}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <OpenDebtBanner
        isDark={isDark}
        amount={currentDebt.openDebtTotal}
        shopCount={debtorStores.length}
      />

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[22px] p-3.5 min-w-0" style={iosGlassCardStyle(isDark)}>
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide opacity-40">
            <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
            BU {wordUpper} · OCHILGAN
          </div>
          <div className="text-[16px] font-black tabular-nums text-red-400 mt-1.5 leading-tight">
            +{formatMoney(flow.newDebt.amount)}
          </div>
        </div>
        <div className="rounded-[22px] p-3.5 min-w-0" style={iosGlassCardStyle(isDark)}>
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide opacity-40">
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
            BU {wordUpper} · UNDIRILGAN
          </div>
          <div className="text-[16px] font-black tabular-nums text-emerald-600 mt-1.5 leading-tight">
            −{formatMoney(flow.debtCollected.amount)}
          </div>
        </div>
      </div>

      {!isAnalitika ? (
        <div>
          <div className="flex items-center gap-2 mb-2.5 px-0.5">
            <Store className="w-4 h-4" style={{ color: '#a16207' }} />
            <h3 className="font-bold text-[15px]">Qarzdor do‘konlar</h3>
          </div>
          {debtorStores.length === 0 ? (
            <div className="rounded-[22px] px-4 py-8 text-center text-sm opacity-50" style={iosGlassCardStyle(isDark)}>
              Ochiq qarz yo‘q
            </div>
          ) : (
            <ul className="space-y-2">
              {debtorStores.map((row) => (
                <li
                  key={row.storeId}
                  className="rounded-[20px] px-3.5 py-3 flex items-center justify-between gap-3"
                  style={iosGlassCardStyle(isDark)}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[14px] truncate">{row.storeName}</div>
                    <div className="text-[11px] opacity-40">{row.openCount} ta ochiq qarz</div>
                  </div>
                  <div className="font-black tabular-nums text-amber-500 shrink-0">
                    {formatMoney(row.openDebt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : ombor.low > 0 ? (
        <div
          className="flex items-center gap-2 rounded-[18px] px-3.5 py-3 text-[12px] text-amber-600"
          style={iosGlassInputStyle(isDark)}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Omborda {ombor.low} ta mahsulot kam qoldi
        </div>
      ) : null}
    </div>
  );
}
