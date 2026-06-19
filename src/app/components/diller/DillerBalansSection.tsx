import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Landmark,
  Plus,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerBalanceEntry, DillerBalanceKind, DillerData } from '../../utils/dillerData';
import { createBalanceEntry, deleteBalanceEntry, formatMoney } from '../../utils/dillerData';
import { DillerBalanceEditSheet } from './DillerBalanceEditSheet';
import {
  computeBalanceBreakdown,
  computeBalanceTotals,
  formatBalanceDate,
  type BalanceChannel,
  type BalanceChannelSummary,
  type BalanceLineItem,
} from '../../utils/dillerBalanceAnalytics';
import {
  defaultCustomHistoryRange,
  getHistoryPeriodLabel,
  toIsoDate,
  type HistoryDateRange,
  type HistoryPeriod,
} from '../../utils/dillerDebtAnalytics';
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

function ChannelBalanceHero({
  channel,
  summary,
  isDark,
}: {
  channel: BalanceChannel;
  summary: BalanceChannelSummary;
  isDark: boolean;
}) {
  const isNaqd = channel === 'naqd';
  const positive = summary.balance >= 0;
  const Icon = isNaqd ? Banknote : CreditCard;

  return (
    <div
      className="rounded-2xl p-4 mb-3"
      style={{
        background: isDark
          ? isNaqd
            ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.08))'
            : 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(79,70,229,0.08))'
          : isNaqd
            ? 'linear-gradient(135deg, rgba(16,185,129,0.14), #ecfdf5)'
            : 'linear-gradient(135deg, rgba(99,102,241,0.12), #eef2ff)',
        border: isDark
          ? isNaqd
            ? '1px solid rgba(16,185,129,0.25)'
            : '1px solid rgba(99,102,241,0.25)'
          : isNaqd
            ? '1px solid rgba(16,185,129,0.2)'
            : '1px solid rgba(99,102,241,0.2)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${isNaqd ? 'text-emerald-500' : 'text-indigo-500'}`} />
        <span className="text-sm font-bold opacity-80">{isNaqd ? 'Naqd qoldiq' : 'Karta qoldiq'}</span>
      </div>
      <div className={`text-2xl font-black ${positive ? 'text-emerald-500' : 'text-red-400'}`}>
        {formatMoney(summary.balance)}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div
          className="rounded-xl px-3 py-2"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)' }}
        >
          <div className="flex items-center gap-1 text-emerald-500 mb-0.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Kirim
          </div>
          <div className="font-bold">{formatMoney(summary.kirim)}</div>
          <div className="text-[10px] opacity-50">{summary.kirimCount} ta</div>
        </div>
        <div
          className="rounded-xl px-3 py-2"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)' }}
        >
          <div className="flex items-center gap-1 text-red-400 mb-0.5">
            <TrendingDown className="w-3.5 h-3.5" />
            Chiqim
          </div>
          <div className="font-bold">{formatMoney(summary.chiqim)}</div>
          <div className="text-[10px] opacity-50">{summary.chiqimCount} ta</div>
        </div>
      </div>
    </div>
  );
}

function FlowLine({
  line,
  isDark,
  onEdit,
  onDelete,
}: {
  line: BalanceLineItem;
  isDark: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const kirim = line.kind === 'kirim';
  return (
    <li
      className="flex items-start gap-3 p-3 rounded-xl border active:scale-[0.99] transition-transform"
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <button type="button" onClick={onEdit} className="flex items-start gap-3 flex-1 min-w-0 text-left">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            kirim ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-400'
          }`}
        >
          {kirim ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{line.label}</div>
          {line.sub ? <div className="text-[10px] opacity-55 truncate mt-0.5">{line.sub}</div> : null}
          <div className="text-[10px] opacity-45 mt-1">{formatBalanceDate(line.createdAt)}</div>
        </div>
      </button>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className={`text-sm font-bold ${kirim ? 'text-emerald-500' : 'text-red-400'}`}>
          {kirim ? '+' : '−'}
          {formatMoney(line.amount)}
        </div>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 active:scale-95"
            style={{ color: isDark ? '#fff' : '#334155' }}
            aria-label="Tahrirlash"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-red-400 opacity-60 hover:opacity-100 active:scale-95"
            aria-label="O‘chirish"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

export function DillerBalansSection({ data, onDataChange, isDark }: Props) {
  const { accentColor } = useTheme();
  const [channel, setChannel] = useState<BalanceChannel>('naqd');
  const [period, setPeriod] = useState<HistoryPeriod>('all');
  const [customRange, setCustomRange] = useState<HistoryDateRange>(() => defaultCustomHistoryRange());
  const [addKind, setAddKind] = useState<DillerBalanceKind>('kirim');
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [editEntry, setEditEntry] = useState<DillerBalanceEntry | null>(null);

  const totals = useMemo(() => computeBalanceTotals(data), [data]);

  const periodView = useMemo(
    () => computeBalanceBreakdown(data, period, period === 'custom' ? customRange : undefined),
    [data, period, customRange],
  );

  const channelTotals = channel === 'naqd' ? totals.naqd : totals.karta;
  const channelKirim = periodView.kirimLines.filter((l) => l.channel === channel);
  const channelChiqim = periodView.chiqimLines.filter((l) => l.channel === channel);

  const submitEntry = () => {
    const result = createBalanceEntry(data, {
      kind: addKind,
      channel,
      purpose,
      amount: Number(amount) || 0,
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
    toast.success(addKind === 'kirim' ? 'Kirim qo‘shildi' : 'Chiqim qo‘shildi');
  };

  const removeEntry = (id: string) => {
    if (!window.confirm('Bu yozuvni o‘chirishni xohlaysizmi?')) return;
    onDataChange(deleteBalanceEntry(data, id));
    toast.success('O‘chirildi');
  };

  const openEdit = (id: string) => {
    const entry = (data.balanceEntries ?? []).find((e) => e.id === id);
    if (entry) setEditEntry(entry);
  };

  return (
    <>
      <DillerBalanceEditSheet
        open={editEntry != null}
        entry={editEntry}
        data={data}
        onClose={() => setEditEntry(null)}
        onSave={(next) => {
          onDataChange(next);
          setEditEntry(null);
        }}
      />
      <Card isDark={isDark}>
        <div className="flex items-center gap-2 mb-2">
          <Landmark className="w-5 h-5 shrink-0" style={{ color: accentColor.color }} />
          <div className="min-w-0">
            <h3 className="font-bold text-base">Balans</h3>
            <p className="text-[10px] opacity-55">
              Qo‘lda kirim va chiqim — sotuvlardan mustaqil
            </p>
          </div>
        </div>

        <div
          className="rounded-xl p-4 mb-3"
          style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
            <Wallet className="w-4 h-4" style={{ color: accentColor.color }} />
            Jami qoldiq
          </div>
          <div
            className={`text-xl font-black ${
              totals.total.balance >= 0 ? 'text-emerald-500' : 'text-red-400'
            }`}
          >
            {formatMoney(totals.total.balance)}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] opacity-55 mt-2">
            <span>Naqd {formatMoney(totals.naqd.balance)}</span>
            <span>Karta {formatMoney(totals.karta.balance)}</span>
          </div>
        </div>

        <div
          className="flex gap-1 p-1 rounded-xl mb-3"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
        >
          {(
            [
              { id: 'naqd' as const, label: 'Naqd', icon: Banknote },
              { id: 'karta' as const, label: 'Karta', icon: CreditCard },
            ] as const
          ).map((tab) => {
            const active = channel === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChannel(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  active ? 'shadow-sm' : 'opacity-60'
                }`}
                style={
                  active
                    ? {
                        background: isDark ? 'rgba(255,255,255,0.1)' : '#fff',
                        color: tab.id === 'naqd' ? '#10b981' : '#6366f1',
                      }
                    : undefined
                }
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          className="rounded-xl p-3 mb-1"
          style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}
        >
          <p className="text-xs font-bold mb-2">
            {channel === 'naqd' ? 'Naqd' : 'Karta'} — {addKind === 'kirim' ? 'kirim' : 'chiqim'} qo‘shish
          </p>
          <div className="flex gap-1.5 mb-2">
            {(
              [
                { id: 'kirim' as const, label: 'Kirim' },
                { id: 'chiqim' as const, label: 'Chiqim' },
              ] as const
            ).map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setAddKind(k.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold ${
                  addKind === k.id
                    ? k.id === 'kirim'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/15 text-red-400'
                    : isDark
                      ? 'bg-white/5 opacity-60'
                      : 'bg-gray-100 opacity-70'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Maqsad (masalan: Do‘kondan tushum)"
            className={`${inputCls(isDark)} mb-2`}
          />
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Summa"
            className={`${inputCls(isDark)} mb-2`}
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Izoh (ixtiyoriy)"
            className={`${inputCls(isDark)} mb-2`}
          />
          <button
            type="button"
            onClick={submitEntry}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-900 flex items-center justify-center gap-1.5"
            style={{ background: accentColor.gradient }}
          >
            <Plus className="w-4 h-4" />
            Qo‘shish
          </button>
        </div>
      </Card>

      <Card isDark={isDark}>
        <ChannelBalanceHero channel={channel} summary={channelTotals} isDark={isDark} />

        <p className="text-[10px] opacity-50 mb-3 text-center">
          Ro‘yxat: {getHistoryPeriodLabel(period)}
        </p>

        <div className="flex gap-1.5 mb-3 flex-wrap">
          {periodOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                period === p.id
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

        {period === 'custom' ? (
          <div
            className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-xl"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}
          >
            <div>
              <label className="block text-[10px] opacity-60 mb-1">Dan</label>
              <input
                type="date"
                value={customRange.from}
                max={customRange.to}
                onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))}
                className={`w-full px-2 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]'
                    : 'bg-white border-gray-200'
                }`}
              />
            </div>
            <div>
              <label className="block text-[10px] opacity-60 mb-1">Gacha</label>
              <input
                type="date"
                value={customRange.to}
                min={customRange.from}
                max={toIsoDate(new Date())}
                onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))}
                className={`w-full px-2 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white [color-scheme:dark]'
                    : 'bg-white border-gray-200'
                }`}
              />
            </div>
          </div>
        ) : null}

        <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5 text-emerald-500">
          <ArrowDownLeft className="w-3.5 h-3.5" />
          Kirim ({channelKirim.length})
        </h4>
        {channelKirim.length === 0 ? (
          <p className="text-sm opacity-50 text-center py-4 mb-4">Kirim yo‘q</p>
        ) : (
          <ul className={`${dillerListClass} mb-4 max-h-56 overflow-y-auto`}>
            {channelKirim.map((line) => (
              <FlowLine
                key={line.id}
                line={line}
                isDark={isDark}
                onEdit={() => openEdit(line.id)}
                onDelete={() => removeEntry(line.id)}
              />
            ))}
          </ul>
        )}

        <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5 text-red-400">
          <ArrowUpRight className="w-3.5 h-3.5" />
          Chiqim ({channelChiqim.length})
        </h4>
        {channelChiqim.length === 0 ? (
          <p className="text-sm opacity-50 text-center py-4">Chiqim yo‘q</p>
        ) : (
          <ul className={`${dillerListClass} max-h-56 overflow-y-auto`}>
            {channelChiqim.map((line) => (
              <FlowLine
                key={line.id}
                line={line}
                isDark={isDark}
                onEdit={() => openEdit(line.id)}
                onDelete={() => removeEntry(line.id)}
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
