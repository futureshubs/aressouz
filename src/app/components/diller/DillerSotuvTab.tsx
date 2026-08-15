import { useMemo, useState } from 'react';
import {
  Banknote,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerSale } from '../../utils/dillerData';
import { formatMoney } from '../../utils/dillerData';
import { sumSalesProfit } from '../../utils/dillerDebtAnalytics';
import {
  dillerCalendarDate,
  formatDillerDate,
  isDillerToday,
  isDillerYesterday,
} from '../../utils/dillerTime';
import { DillerSaleSheet } from './DillerSaleSheet';
import { DillerSaleCard } from './DillerSaleCard';
import { DillerSaleReceiptModal } from './DillerSaleReceiptModal';
import { dillerTabContentClass } from './dillerMobileLayout';
import { iosAccentFillStyle, iosGlassCardStyle } from './dillerIosGlass';

type Props = {
  data: DillerData;
  onDataChange: (next: DillerData) => void;
};

type SaleFilter = 'all' | 'today' | 'naqd' | 'karta' | 'qarz';

function dayTitle(iso: string) {
  if (isDillerToday(iso)) return 'Bugun';
  if (isDillerYesterday(iso)) return 'Kecha';
  return formatDillerDate(iso, { weekday: 'short', day: 'numeric', month: 'long', year: undefined });
}

export function DillerSotuvTab({ data, onDataChange }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [saleOpen, setSaleOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<DillerSale | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SaleFilter>('all');

  const liveSales = useMemo(
    () => data.sales.filter((s) => !s.cancelled),
    [data.sales],
  );

  const todaySales = useMemo(
    () => liveSales.filter((s) => isDillerToday(s.createdAt)),
    [liveSales],
  );

  const todayStats = useMemo(() => {
    let total = 0;
    let naqd = 0;
    let karta = 0;
    let qarz = 0;
    for (const s of todaySales) {
      total += s.total;
      if (s.paymentType === 'qarz') qarz += s.debtAmount ?? 0;
      else if (s.paymentType === 'karta') karta += s.total;
      else naqd += s.total;
    }
    const profit = sumSalesProfit(todaySales, data);
    return { count: todaySales.length, total, naqd, karta, qarz, profit };
  }, [todaySales, data]);

  const openDebtTotal = useMemo(
    () =>
      liveSales.reduce((sum, s) => sum + (s.paymentType === 'qarz' ? s.debtAmount ?? 0 : 0), 0),
    [liveSales],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return liveSales.filter((sale) => {
      if (filter === 'today' && !isDillerToday(sale.createdAt)) return false;
      if (filter === 'naqd' && sale.paymentType !== 'naqd') return false;
      if (filter === 'karta' && sale.paymentType !== 'karta') return false;
      if (filter === 'qarz' && sale.paymentType !== 'qarz') return false;
      if (!q) return true;
      const store = data.stores.find((s) => s.id === sale.storeId);
      const product = data.products.find((p) => p.id === sale.productId);
      const hay = `${store?.name ?? ''} ${product?.name ?? ''} ${sale.note ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [liveSales, filter, query, data.stores, data.products]);

  const grouped = useMemo(() => {
    const map = new Map<string, DillerSale[]>();
    for (const sale of filtered) {
      const key = dillerCalendarDate(sale.createdAt) || '—';
      const list = map.get(key) ?? [];
      list.push(sale);
      map.set(key, list);
    }
    return [...map.entries()].map(([, sales]) => ({
      title: dayTitle(sales[0].createdAt),
      total: sales.reduce((s, x) => s + x.total, 0),
      sales,
    }));
  }, [filtered]);

  const filters: { id: SaleFilter; label: string }[] = [
    { id: 'all', label: 'Barchasi' },
    { id: 'today', label: 'Bugun' },
    { id: 'naqd', label: 'Naqd' },
    { id: 'karta', label: 'Karta' },
    { id: 'qarz', label: 'Qarz' },
  ];

  return (
    <div className={dillerTabContentClass}>
      <DillerSaleSheet
        open={saleOpen}
        onClose={() => setSaleOpen(false)}
        data={data}
        onComplete={onDataChange}
      />
      <DillerSaleReceiptModal
        open={!!receiptSale}
        onClose={() => setReceiptSale(null)}
        sale={receiptSale}
        data={data}
        onDataChange={onDataChange}
      />

      <button
        type="button"
        onClick={() => setSaleOpen(true)}
        className="relative w-full overflow-hidden rounded-[26px] px-5 py-4 text-left active:scale-[0.985] transition-transform touch-manipulation"
        style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
          background:
            'radial-gradient(120% 80% at 100% -10%, rgba(255,255,255,0.55), transparent 55%)',
        }} />
        <div className="relative flex items-center gap-3">
          <span
            className="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.28)', color: '#fff' }}
          >
            <Plus className="w-6 h-6" strokeWidth={2.6} />
          </span>
          <span className="min-w-0 text-white">
            <span className="block text-[17px] font-black leading-tight">Yangi sotuv</span>
            <span className="block text-[12px] font-medium opacity-75 mt-0.5">
              Do‘kon · mahsulot · to‘lov
            </span>
          </span>
          <ShoppingCart className="w-6 h-6 ml-auto text-white/70" />
        </div>
      </button>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[20px] px-3 py-3" style={iosGlassCardStyle(isDark)}>
          <div className="text-[10px] font-semibold uppercase tracking-wide opacity-45">Bugun</div>
          <div className="text-[15px] font-black mt-1 tabular-nums leading-tight" style={{ color: accentColor.color }}>
            {formatMoney(todayStats.total)}
          </div>
          <div className="text-[10px] opacity-50 mt-0.5">{todayStats.count} ta sotuv</div>
        </div>
        <div className="rounded-[20px] px-3 py-3" style={iosGlassCardStyle(isDark)}>
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-45">
            <TrendingUp className="w-3 h-3" />
            Foyda
          </div>
          <div
            className={`text-[15px] font-black mt-1 tabular-nums leading-tight ${
              todayStats.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {todayStats.profit > 0 ? '+' : ''}
            {formatMoney(todayStats.profit)}
          </div>
          <div className="text-[10px] opacity-50 mt-0.5">bugungi</div>
        </div>
        <div className="rounded-[20px] px-3 py-3" style={iosGlassCardStyle(isDark)}>
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-45">
            <Banknote className="w-3 h-3" />
            Naqd
          </div>
          <div className="text-[15px] font-black mt-1 tabular-nums leading-tight text-emerald-400">
            {formatMoney(todayStats.naqd)}
          </div>
          <div className="text-[10px] opacity-50 mt-0.5">bugungi</div>
        </div>
        <div className="rounded-[20px] px-3 py-3" style={iosGlassCardStyle(isDark)}>
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-45">
            <Wallet className="w-3 h-3" />
            Qarz
          </div>
          <div className="text-[15px] font-black mt-1 tabular-nums leading-tight text-amber-400">
            {formatMoney(openDebtTotal)}
          </div>
          <div className="text-[10px] opacity-50 mt-0.5">ochiq qoldiq</div>
        </div>
      </div>
      <p className="text-[10px] opacity-35 px-1 -mt-1">O‘zbekiston vaqti · UTC+05:00</p>

      <div
        className="flex items-center gap-2 rounded-[18px] px-3 py-2.5"
        style={iosGlassCardStyle(isDark)}
      >
        <Search className="w-4 h-4 opacity-40 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Do‘kon, mahsulot..."
          className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:opacity-40"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch] pb-0.5">
        {filters.map((f) => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-bold active:scale-[0.96]"
              style={
                on
                  ? iosAccentFillStyle(accentColor.gradient, accentColor.color)
                  : iosGlassCardStyle(isDark)
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[24px] px-5 py-12 text-center" style={iosGlassCardStyle(isDark)}>
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" style={{ color: accentColor.color }} />
          <p className="font-bold text-sm">
            {liveSales.length === 0 ? 'Hali sotuv yo‘q' : 'Mos sotuv topilmadi'}
          </p>
          <p className="text-xs opacity-55 mt-1">
            {liveSales.length === 0
              ? '«Yangi sotuv» ni bosing — ombor avtomatik yangilanadi'
              : 'Qidiruv yoki filterni o‘zgartiring'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.title}>
              <div className="flex items-end justify-between px-1 mb-2">
                <h3 className="text-[13px] font-bold tracking-tight opacity-80">{group.title}</h3>
                <span className="text-[11px] font-semibold tabular-nums opacity-45">
                  {group.sales.length} ta · {formatMoney(group.total)}
                </span>
              </div>
              <ul className="space-y-2.5">
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
