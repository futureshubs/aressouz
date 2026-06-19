import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Landmark,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type {
  DillerBalanceChannel,
  DillerBalanceEntry,
  DillerBalanceKind,
  DillerData,
} from '../../utils/dillerData';
import { deleteBalanceEntry, updateBalanceEntry } from '../../utils/dillerData';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';

type Props = {
  open: boolean;
  entry: DillerBalanceEntry | null;
  data: DillerData;
  onClose: () => void;
  onSave: (next: DillerData) => void;
};

const inputCls = (isDark: boolean) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

export function DillerBalanceEditSheet({ open, entry, data, onClose, onSave }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [kind, setKind] = useState<DillerBalanceKind>('kirim');
  const [channel, setChannel] = useState<DillerBalanceChannel>('naqd');
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (!open || !entry) return;
    setKind(entry.kind);
    setChannel(entry.channel);
    setPurpose(entry.purpose);
    setAmount(String(entry.amount));
    setNote(entry.note);
    const d = new Date(entry.createdAt);
    if (!Number.isNaN(d.getTime())) {
      setDate(d.toISOString().slice(0, 16));
    }
  }, [open, entry]);

  if (!open || !entry) return null;

  const save = () => {
    const createdAt = date ? new Date(date).toISOString() : entry.createdAt;
    const result = updateBalanceEntry(data, entry.id, {
      kind,
      channel,
      purpose,
      amount: Number(amount),
      note,
      createdAt,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onSave(result.data);
    toast.success('Yangilandi');
    onClose();
  };

  const remove = () => {
    if (!window.confirm('Bu yozuvni o‘chirishni xohlaysizmi?')) return;
    onSave(deleteBalanceEntry(data, entry.id));
    toast.success('O‘chirildi');
    onClose();
  };

  return (
    <div
      className={dillerSheetShellClass}
      style={{ background: isDark ? '#0a0a0a' : '#f1f5f9', zIndex: 115 }}
    >
      <header
        className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accentColor.color}22` }}
        >
          <Landmark className="w-5 h-5" style={{ color: accentColor.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-base truncate">
            {kind === 'kirim' ? 'Kirimni tahrirlash' : 'Chiqimni tahrirlash'}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl opacity-70" aria-label="Yopish">
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-3 max-w-lg mx-auto w-full pb-6`}>
        <div>
          <label className="block text-xs font-medium opacity-80 mb-2">Turi</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind('kirim')}
              className={`flex-1 py-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                kind === 'kirim'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : isDark
                    ? 'border-white/10 opacity-70'
                    : 'border-gray-200'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Kirim
            </button>
            <button
              type="button"
              onClick={() => setKind('chiqim')}
              className={`flex-1 py-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                kind === 'chiqim'
                  ? 'bg-red-500/15 border-red-400 text-red-400'
                  : isDark
                    ? 'border-white/10 opacity-70'
                    : 'border-gray-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Chiqim
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium opacity-80 mb-2">Kanal</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setChannel('naqd')}
              className={`flex-1 py-3 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 ${
                channel === 'naqd'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : isDark
                    ? 'border-white/10 opacity-70'
                    : 'border-gray-200'
              }`}
            >
              <Banknote className="w-5 h-5" />
              Naqd
            </button>
            <button
              type="button"
              onClick={() => setChannel('karta')}
              className={`flex-1 py-3 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 ${
                channel === 'karta'
                  ? 'bg-violet-500/20 border-violet-500 text-violet-400'
                  : isDark
                    ? 'border-white/10 opacity-70'
                    : 'border-gray-200'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              Karta
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium opacity-80 mb-1">Maqsad</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inputCls(isDark)} />
        </div>
        <div>
          <label className="block text-xs font-medium opacity-80 mb-1">Summa (so‘m)</label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls(isDark)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium opacity-80 mb-1">Sana va vaqt</label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputCls(isDark)} [color-scheme:${isDark ? 'dark' : 'light'}]`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium opacity-80 mb-1">Izoh (ixtiyoriy)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={`${inputCls(isDark)} resize-none`}
          />
        </div>
      </div>

      <div
        className="shrink-0 px-4 py-3 border-t max-w-lg mx-auto w-full space-y-2"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        <button
          type="button"
          onClick={save}
          className="w-full py-3.5 rounded-xl font-bold text-slate-900 flex items-center justify-center gap-2"
          style={{ background: accentColor.gradient }}
        >
          <Save className="w-4 h-4" />
          Saqlash
        </button>
        <button
          type="button"
          onClick={remove}
          className="w-full py-3 rounded-xl font-bold text-red-400 border border-red-400/30 flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          O‘chirish
        </button>
      </div>
    </div>
  );
}
