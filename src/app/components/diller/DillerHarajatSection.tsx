import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Banknote,
  CreditCard,
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
} from '../../utils/dillerExpenseAnalytics';
import type { HistoryDateRange, HistoryPeriod } from '../../utils/dillerDebtAnalytics';
import { toIsoDate } from '../../utils/dillerDebtAnalytics';
import { DillerExpenseEditSheet } from './DillerExpenseEditSheet';
import { dillerListClass } from './dillerMobileLayout';

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

const inputCls = (isDark: boolean) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

const QUICK_PURPOSES = [
  'Yoqilg‘i',
  'Transport',
  'Ovqat',
  'Ofis',
  'Reklama',
  'Ish haqi',
  'Boshqa',
];

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

  const periodOptions: { id: HistoryPeriod; label: string }[] = [
    { id: '1d', label: '1 kun' },
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

  const summary = useMemo(() => computeExpenseSummary(filtered), [filtered]);
  const allSummary = useMemo(() => computeExpenseSummary(data.expenses), [data.expenses]);

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
            <div className="text-[10px] opacity-50">{summary.count} ta yozuv</div>
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
      </Card>

      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        className="w-full py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-2"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
          color: accentColor.color,
        }}
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
              />
            </div>
            <button
              type="button"
              onClick={add}
              className="w-full py-3 rounded-xl font-bold text-slate-900 flex items-center justify-center gap-2"
              style={{ background: accentColor.gradient }}
            >
              <Plus className="w-4 h-4" />
              Saqlash
            </button>
          </div>
        </Card>
      ) : null}

      <Card isDark={isDark}>
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {periodOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Xarajat qidirish..."
            className={`${inputCls(isDark)} pl-9`}
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card isDark={isDark}>
          <p className="text-sm opacity-60 text-center py-8">
            {data.expenses.length === 0
              ? 'Xarajat yo‘q — yuqorida qo‘shing'
              : 'Bu davrda xarajat topilmadi'}
          </p>
        </Card>
      ) : (
        <ul className={`${dillerListClass} pb-2`}>
          {filtered.map((e) => (
            <li
              key={e.id}
              className="flex gap-2 p-3 rounded-xl border"
              style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              }}
            >
              <button
                type="button"
                onClick={() => setEditExpense(e)}
                className="flex-1 min-w-0 text-left"
              >
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
                <div className="font-semibold text-sm mt-1">{e.purpose}</div>
                {e.note ? <div className="text-xs opacity-60 mt-0.5 line-clamp-2">{e.note}</div> : null}
                <div className="text-lg font-black text-red-400 mt-1.5">{formatMoney(e.amount)}</div>
              </button>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditExpense(e)}
                  className="p-2 rounded-lg"
                  style={{ color: accentColor.color }}
                  aria-label="Tahrirlash"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(e.id, e.purpose)}
                  className="p-2 text-red-400 rounded-lg"
                  aria-label="O‘chirish"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
