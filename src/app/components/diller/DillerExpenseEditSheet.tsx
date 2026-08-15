import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, CreditCard, Receipt, Save, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerExpense, DillerExpensePayment } from '../../utils/dillerData';
import { updateExpense } from '../../utils/dillerData';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';
import {
  iosAccentFillStyle,
  iosGlassBarStyle,
  iosGlassCardStyle,
  iosGlassInputStyle,
  iosGlassPageStyle,
} from './dillerIosGlass';

type Props = {
  open: boolean;
  expense: DillerExpense | null;
  data: DillerData;
  onClose: () => void;
  onSave: (next: DillerData) => void;
};

const inputCls = (isDark: boolean) =>
  `w-full px-3.5 py-3 rounded-[14px] text-sm outline-none ${
    isDark ? 'text-white placeholder:text-white/35' : 'text-gray-900 placeholder:text-gray-400'
  }`;

export function DillerExpenseEditSheet({ open, expense, data, onClose, onSave }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<DillerExpensePayment>('naqd');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (!open || !expense) return;
    setPurpose(expense.purpose);
    setAmount(String(expense.amount));
    setPaymentMethod(expense.paymentMethod);
    setNote(expense.note);
    const d = new Date(expense.createdAt);
    if (!Number.isNaN(d.getTime())) {
      setDate(d.toISOString().slice(0, 16));
    }
  }, [open, expense]);

  if (!open || !expense) return null;

  const save = () => {
    const createdAt = date ? new Date(date).toISOString() : expense.createdAt;
    const result = updateExpense(data, expense.id, {
      purpose,
      amount: Number(amount),
      paymentMethod,
      note,
      createdAt,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onSave(result.data);
    toast.success('Xarajat yangilandi');
    onClose();
  };

  return (
    <div
      className={`${dillerSheetShellClass} animate-in fade-in slide-in-from-bottom-8 duration-300`}
      style={{ ...iosGlassPageStyle(isDark), zIndex: 115 }}
    >
      <header className="shrink-0 px-4 pt-2 pb-3" style={{ ...iosGlassBarStyle(isDark), borderTop: 'none' }}>
        <div className="flex justify-center pb-2">
          <span className="w-10 h-1 rounded-full bg-white/25" />
        </div>
        <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0"
          style={{ background: `${accentColor.color}22` }}
        >
          <Receipt className="w-5 h-5" style={{ color: accentColor.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-black text-[17px] truncate tracking-tight">Xarajatni tahrirlash</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
          style={iosGlassCardStyle(isDark)}
          aria-label="Yopish"
        >
          <X className="w-5 h-5" />
        </button>
        </div>
      </header>

      <div className={`${dillerSheetScrollClass} px-4 py-4 max-w-lg mx-auto w-full pb-6`}>
        <div className="rounded-[24px] p-4 space-y-3.5" style={iosGlassCardStyle(isDark)}>
        <div>
          <label className="block text-[11px] font-semibold opacity-60 mb-1.5">Nima uchun</label>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className={inputCls(isDark)}
            style={iosGlassInputStyle(isDark)}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold opacity-60 mb-1.5">Summa (so‘m)</label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls(isDark)}
            style={iosGlassInputStyle(isDark)}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold opacity-60 mb-2">To‘lov usuli</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('naqd')}
              className="flex-1 py-3 rounded-[16px] text-xs font-bold flex flex-col items-center gap-1"
              style={
                paymentMethod === 'naqd'
                  ? { background: 'linear-gradient(135deg,#34d399,#10b981)', color: '#fff' }
                  : iosGlassCardStyle(isDark)
              }
            >
              <Banknote className="w-5 h-5" />
              Naqd
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('karta')}
              className="flex-1 py-3 rounded-[16px] text-xs font-bold flex flex-col items-center gap-1"
              style={
                paymentMethod === 'karta'
                  ? { background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff' }
                  : iosGlassCardStyle(isDark)
              }
            >
              <CreditCard className="w-5 h-5" />
              Karta
            </button>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold opacity-60 mb-1.5">Sana va vaqt</label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputCls(isDark)} [color-scheme:${isDark ? 'dark' : 'light'}]`}
            style={iosGlassInputStyle(isDark)}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold opacity-60 mb-1.5">Izoh (ixtiyoriy)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={`${inputCls(isDark)} resize-none`}
            style={iosGlassInputStyle(isDark)}
          />
        </div>
        </div>
      </div>

      <div
        className="shrink-0 px-4 py-3 max-w-lg mx-auto w-full"
        style={{ ...iosGlassBarStyle(isDark), borderBottom: 'none' }}
      >
        <button
          type="button"
          onClick={save}
          className="w-full py-3.5 rounded-[16px] font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98]"
          style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
        >
          <Save className="w-4 h-4" />
          Saqlash
        </button>
      </div>
    </div>
  );
}
