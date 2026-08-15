import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Banknote,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FolderOpen,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerExpense, DillerExpensePayment } from '../../utils/dillerData';
import { createExpense, deleteExpense, formatMoney } from '../../utils/dillerData';
import {
  computeExpenseSummary,
  defaultCustomHistoryRange,
  filterExpensesByPeriod,
  formatExpenseDate,
  getMaxExpenseCategoryTotal,
  groupExpensesByPurpose,
  normalizeExpensePurposeKey,
} from '../../utils/dillerExpenseAnalytics';
import type { HistoryDateRange, HistoryPeriod } from '../../utils/dillerDebtAnalytics';
import { getHistoryPeriodLabel, toIsoDate } from '../../utils/dillerDebtAnalytics';
import { DillerExpenseEditSheet } from './DillerExpenseEditSheet';
import { dillerListClass } from './dillerMobileLayout';
import { iosAccentFillStyle, iosGlassCardStyle, iosGlassInputStyle } from './dillerIosGlass';

type Props = {
  data: DillerData;
  onDataChange: (next: DillerData) => void;
  isDark: boolean;
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

const inputCls = (isDark: boolean) =>
  `w-full px-3.5 py-3 rounded-[14px] text-sm outline-none ${
    isDark ? 'text-white placeholder:text-white/35' : 'text-gray-900 placeholder:text-gray-400'
  }`;

const QUICK_PURPOSES = [
  'Yoqilg‘i',
  'Transport',
  'Ovqat',
  'Moyka',
  'Yo‘l haqi',
  'Ofis',
  'Reklama',
  'Ish haqi',
  'Boshqa',
];

type ViewMode = 'catalog' | 'list';

function ExpenseRow({
  e,
  isDark,
  accentColor,
  onEdit,
  onRemove,
  compact = false,
}: {
  e: DillerExpense;
  isDark: boolean;
  accentColor: { color: string };
  onEdit: (e: DillerExpense) => void;
  onRemove: (id: string, label: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex gap-2 rounded-[20px] ${compact ? 'p-2.5' : 'p-3'} active:scale-[0.985] transition-transform`}
      style={iosGlassCardStyle(isDark)}
    >
      <button type="button" onClick={() => onEdit(e)} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              e.paymentMethod === 'karta'
                ? 'bg-violet-500/20 text-violet-400'
                : 'bg-emerald-500/15 text-emerald-400'
            }`}
          >
            {e.paymentMethod === 'karta' ? (
              <CreditCard className="w-3 h-3" />
            ) : (
              <Banknote className="w-3 h-3" />
            )}
            {e.paymentMethod === 'karta' ? 'Karta' : 'Naqd'}
          </span>
          <span className="text-[10px] opacity-45">{formatExpenseDate(e.createdAt)}</span>
        </div>
        {!compact ? <div className="font-semibold text-sm mt-1">{e.purpose}</div> : null}
        {e.note ? (
          <div className="text-xs opacity-60 mt-0.5 line-clamp-2">{e.note}</div>
        ) : null}
        <div className={`font-black text-red-400 ${compact ? 'text-sm mt-1' : 'text-lg mt-1.5'}`}>
          {formatMoney(e.amount)}
        </div>
      </button>
      <div className="flex flex-col gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(e)}
          className="p-2 rounded-lg"
          style={{ color: accentColor.color }}
          aria-label="Tahrirlash"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(e.id, e.purpose)}
          className="p-2 text-red-400 rounded-lg"
          aria-label="O‘chirish"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function DillerHarajatSection({ data, onDataChange, isDark }: Props) {
  const { accentColor } = useTheme();
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<DillerExpensePayment>('naqd');
  const [note, setNote] = useState('');
  const [period, setPeriod] = useState<HistoryPeriod>('1m');
  const [customRange, setCustomRange] = useState<HistoryDateRange>(() => defaultCustomHistoryRange());
  const [search, setSearch] = useState('');
  const [editExpense, setEditExpense] = useState<DillerExpense | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('catalog');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const periodOptions: { id: HistoryPeriod; label: string }[] = [
    { id: '1d', label: '1 kun' },
    { id: '2d', label: '2 kun' },
    { id: '1w', label: '1 hafta' },
    { id: '1m', label: '1 oy' },
    { id: '3m', label: '3 oy' },
    { id: '6m', label: '6 oy' },
    { id: 'all', label: 'Barcha' },
    { id: 'custom', label: 'Tanlash' },
  ];

  const filtered = useMemo(() => {
    let list = filterExpensesByPeriod(
      data.expenses,
      period,
      period === 'custom' ? customRange : undefined,
    );
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const hay = `${e.purpose} ${e.note} ${e.paymentMethod}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data.expenses, period, customRange, search]);

  const catalog = useMemo(() => groupExpensesByPurpose(filtered), [filtered]);
  const maxCategoryTotal = getMaxExpenseCategoryTotal(catalog);

  const displayCatalog = useMemo(
    () => (categoryFilter ? catalog.filter((c) => c.key === categoryFilter) : catalog),
    [catalog, categoryFilter],
  );

  const listItems = useMemo(() => {
    if (!categoryFilter) return filtered;
    return filtered.filter((e) => normalizeExpensePurposeKey(e.purpose) === categoryFilter);
  }, [filtered, categoryFilter]);

  const summary = useMemo(() => computeExpenseSummary(filtered), [filtered]);
  const allSummary = useMemo(() => computeExpenseSummary(data.expenses), [data.expenses]);

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleEdit = (e: DillerExpense) => setEditExpense(e);

  const add = () => {
    const result = createExpense(data, {
      purpose,
      amount: Number(amount),
      paymentMethod,
      note,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onDataChange(result.data);
    setPurpose('');
    setAmount('');
    setNote('');
    toast.success('Xarajat saqlandi');
  };

  const remove = (id: string, label: string) => {
    if (!window.confirm(`«${label}» xarajatini o‘chirasizmi?`)) return;
    onDataChange(deleteExpense(data, id));
    toast.success('O‘chirildi');
  };

  return (
    <>
      <DillerExpenseEditSheet
        open={!!editExpense}
        expense={editExpense}
        data={data}
        onClose={() => setEditExpense(null)}
        onSave={onDataChange}
      />

      <Card isDark={isDark}>
        <div className="grid grid-cols-3 gap-2">
          <div
            className="rounded-xl p-3 col-span-3"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.06))'
                : 'linear-gradient(135deg, rgba(239,68,68,0.08), #fff)',
              border: isDark ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(239,68,68,0.15)',
            }}
          >
            <div className="text-[10px] opacity-60 flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5" />
              Tanlangan davr
            </div>
            <div className="text-xl font-black text-red-400 mt-0.5">{formatMoney(summary.total)}</div>
            <div className="text-[10px] opacity-50">
              {summary.count} ta yozuv · {catalog.length} ta tur
            </div>
          </div>
          <div
            className="rounded-xl p-2.5"
            style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}
          >
            <div className="text-[9px] opacity-50 flex items-center gap-0.5">
              <Banknote className="w-3 h-3" />
              Naqd
            </div>
            <div className="text-xs font-bold text-emerald-400 mt-0.5">{formatMoney(summary.naqdTotal)}</div>
            <div className="text-[9px] opacity-40">{summary.naqdCount} ta</div>
          </div>
          <div
            className="rounded-xl p-2.5"
            style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}
          >
            <div className="text-[9px] opacity-50 flex items-center gap-0.5">
              <CreditCard className="w-3 h-3" />
              Karta
            </div>
            <div className="text-xs font-bold text-violet-400 mt-0.5">{formatMoney(summary.kartaTotal)}</div>
            <div className="text-[9px] opacity-40">{summary.kartaCount} ta</div>
          </div>
          <div
            className="rounded-xl p-2.5"
            style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}
          >
            <div className="text-[9px] opacity-50">Jami (barcha)</div>
            <div className="text-xs font-bold mt-0.5">{formatMoney(allSummary.total)}</div>
          </div>
        </div>
        {catalog.length > 0 ? (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
            <div className="text-[10px] font-bold opacity-60 mb-2">Nima uchun sarflangan</div>
            <ul className="space-y-2">
              {catalog.slice(0, 5).map((cat) => (
                <li key={cat.key}>
                  <div className="flex justify-between text-xs gap-2 mb-1">
                    <span className="font-semibold truncate">{cat.label}</span>
                    <span className="text-red-400 font-bold shrink-0">{formatMoney(cat.total)}</span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500/90 to-orange-400/90"
                      style={{ width: `${(cat.total / maxCategoryTotal) * 100}%` }}
                    />
                  </div>
                  <div className="text-[9px] opacity-45 mt-0.5">
                    {cat.count} ta · {cat.sharePercent}%
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        className="w-full py-2.5 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
        style={{ ...iosGlassCardStyle(isDark), color: accentColor.color }}
      >
        <Plus className="w-4 h-4" />
        {showForm ? 'Formani yashirish' : 'Yangi xarajat qo‘shish'}
      </button>

      {showForm ? (
        <Card isDark={isDark}>
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4" style={{ color: accentColor.color }} />
            Yangi xarajat
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_PURPOSES.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setPurpose(label)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  purpose === label
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isDark
                      ? 'bg-white/5 opacity-70'
                      : 'bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium opacity-80 mb-1">Nima uchun</label>
              <input
                placeholder="Masalan: Benzin, ofis jihozlari..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium opacity-80 mb-1">Summa (so‘m)</label>
              <input
                type="number"
                min={1}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium opacity-80 mb-2">To‘lov usuli</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('naqd')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'naqd'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : isDark
                        ? 'border-white/10 opacity-70'
                        : 'border-gray-200'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  Naqd
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('karta')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'karta'
                      ? 'bg-violet-500/20 border-violet-500 text-violet-400'
                      : isDark
                        ? 'border-white/10 opacity-70'
                        : 'border-gray-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Karta
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium opacity-80 mb-1">Izoh (ixtiyoriy)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />
            </div>
            <button
              type="button"
              onClick={add}
              className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2"
              style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
            >
              <Plus className="w-4 h-4" />
              Saqlash
            </button>
          </div>
        </Card>
      ) : null}

      <Card isDark={isDark}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <FolderOpen className="w-4 h-4" style={{ color: accentColor.color }} />
              Xarajat katalogi
            </h3>
            <p className="text-[10px] opacity-55 mt-0.5">{getHistoryPeriodLabel(period)}</p>
          </div>
          <div
            className="flex gap-0.5 p-0.5 rounded-xl shrink-0"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
          >
            <button
              type="button"
              onClick={() => setViewMode('catalog')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                viewMode === 'catalog' ? 'shadow-sm' : 'opacity-60'
              }`}
              style={
                viewMode === 'catalog'
                  ? {
                      background: isDark ? 'rgba(255,255,255,0.1)' : '#fff',
                      color: accentColor.color,
                    }
                  : undefined
              }
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Katalog
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                viewMode === 'list' ? 'shadow-sm' : 'opacity-60'
              }`}
              style={
                viewMode === 'list'
                  ? {
                      background: isDark ? 'rgba(255,255,255,0.1)' : '#fff',
                      color: accentColor.color,
                    }
                  : undefined
              }
            >
              <List className="w-3.5 h-3.5" />
              Ro‘yxat
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 mb-2 flex-wrap">
          {periodOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPeriod(p.id);
                setCategoryFilter(null);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                period === p.id
                  ? 'bg-red-500/20 text-red-400'
                  : isDark
                    ? 'bg-white/5 opacity-70'
                    : 'bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' ? (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input
              type="date"
              value={customRange.from}
              max={customRange.to}
              onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))}
              className={`px-2 py-2 rounded-lg border text-sm ${
                isDark ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]' : 'bg-white border-gray-200'
              }`}
            />
            <input
              type="date"
              value={customRange.to}
              min={customRange.from}
              max={toIsoDate(new Date())}
              onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))}
              className={`px-2 py-2 rounded-lg border text-sm ${
                isDark ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]' : 'bg-white border-gray-200'
              }`}
            />
          </div>
        ) : null}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Xarajat qidirish..."
            className={`${inputCls(isDark)} pl-9`}
          />
        </div>

        {catalog.length > 0 ? (
          <div className="flex gap-1.5 flex-wrap mb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                categoryFilter === null
                  ? 'bg-red-500/20 text-red-400'
                  : isDark
                    ? 'bg-white/5 opacity-70'
                    : 'bg-gray-100'
              }`}
            >
              Hammasi
            </button>
            {catalog.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setCategoryFilter((prev) => (prev === cat.key ? null : cat.key));
                  if (viewMode === 'catalog') {
                    setExpandedCategories((prev) => new Set(prev).add(cat.key));
                  }
                }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold max-w-full truncate ${
                  categoryFilter === cat.key
                    ? 'bg-red-500/20 text-red-400'
                    : isDark
                      ? 'bg-white/5 opacity-70'
                      : 'bg-gray-100'
                }`}
              >
                {cat.label} · {formatMoney(cat.total)}
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      {filtered.length === 0 ? (
        <Card isDark={isDark}>
          <p className="text-sm opacity-60 text-center py-8">
            {data.expenses.length === 0
              ? 'Xarajat yo‘q — yuqorida qo‘shing'
              : 'Bu davrda xarajat topilmadi'}
          </p>
        </Card>
      ) : viewMode === 'catalog' ? (
        <div className="space-y-3 pb-2">
          {displayCatalog.map((cat) => {
            const expanded = expandedCategories.has(cat.key) || categoryFilter === cat.key;
            return (
              <Card key={cat.key} isDark={isDark} className="!p-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.key)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{cat.label}</div>
                        <div className="text-[10px] opacity-55 mt-0.5 flex flex-wrap gap-x-2">
                          <span>{cat.count} ta yozuv</span>
                          <span>{cat.sharePercent}% ulush</span>
                          {cat.naqdTotal > 0 ? (
                            <span className="text-emerald-500/80">Naqd {formatMoney(cat.naqdTotal)}</span>
                          ) : null}
                          {cat.kartaTotal > 0 ? (
                            <span className="text-violet-400/80">Karta {formatMoney(cat.kartaTotal)}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-red-400">{formatMoney(cat.total)}</div>
                      <div className="text-[9px] opacity-45">o‘rt. {formatMoney(Math.round(cat.total / cat.count))}</div>
                    </div>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden mt-3"
                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400"
                      style={{ width: `${(cat.total / maxCategoryTotal) * 100}%` }}
                    />
                  </div>
                </button>
                {expanded ? (
                  <ul className="px-3 pb-3 space-y-2">
                    {cat.expenses.map((e) => (
                      <li key={e.id}>
                        <ExpenseRow
                          e={e}
                          isDark={isDark}
                          accentColor={accentColor}
                          onEdit={handleEdit}
                          onRemove={remove}
                          compact
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <ul className={`${dillerListClass} pb-2`}>
          {listItems.map((e) => (
            <li key={e.id}>
              <ExpenseRow
                e={e}
                isDark={isDark}
                accentColor={accentColor}
                onEdit={handleEdit}
                onRemove={remove}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
