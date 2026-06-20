import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ShoppingCart, Store, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerPaymentType, DillerShopOrder } from '../../utils/dillerData';
import {
  calcSaleTotals,
  confirmShopOrderSale,
  findStoresByPhone,
  formatMoney,
} from '../../utils/dillerData';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';

type Props = {
  open: boolean;
  order: DillerShopOrder | null;
  data: DillerData;
  onClose: () => void;
  onComplete: (next: DillerData) => void;
};

const inputCls = (isDark: boolean) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

export function DillerShopOrderSaleSheet({ open, order, data, onClose, onComplete }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [paymentType, setPaymentType] = useState<DillerPaymentType>('naqd');
  const [paidNow, setPaidNow] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [discountOn, setDiscountOn] = useState(false);
  const [discountMode, setDiscountMode] = useState<'percent' | 'amount'>('percent');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmountInput, setDiscountAmountInput] = useState('');

  const store = useMemo(() => {
    if (!order) return null;
    if (order.storeId) return data.stores.find((s) => s.id === order.storeId) ?? null;
    const matches = findStoresByPhone(data, order.customerPhone);
    if (order.storeName) {
      return matches.find((s) => s.name === order.storeName) ?? matches[0] ?? null;
    }
    return matches[0] ?? null;
  }, [order, data]);

  const subtotal = useMemo(
    () =>
      order?.items.reduce((s, it) => s + (it.lineTotal || it.unitPrice * it.qty), 0) ?? 0,
    [order],
  );

  const totals = useMemo(() => {
    if (!discountOn) {
      return {
        subtotal,
        discountAmount: 0,
        discountPercent: 0,
        total: subtotal,
      };
    }
    if (discountMode === 'amount') {
      const amt = Math.min(subtotal, Math.max(0, Math.round(Number(discountAmountInput) || 0)));
      return {
        subtotal,
        discountAmount: amt,
        discountPercent: subtotal > 0 ? Math.round((amt / subtotal) * 1000) / 10 : 0,
        total: Math.max(0, subtotal - amt),
      };
    }
    return calcSaleTotals(subtotal, 1, {
      discountPercent: Number(discountPercent) || 0,
    });
  }, [subtotal, discountOn, discountMode, discountPercent, discountAmountInput]);

  const finalTotal = totals.total;
  const orderId = order?.id ?? '';
  const initOrderRef = useRef('');

  useEffect(() => {
    if (!open || !orderId) {
      if (!open) initOrderRef.current = '';
      return;
    }
    if (initOrderRef.current === orderId) return;
    initOrderRef.current = orderId;
    setPaymentType('naqd');
    setPaidNow(String(order?.total ?? subtotal ?? 0));
    setDebtDueDate('');
    setNote(order?.note?.trim() ?? '');
    setSubmitting(false);
    setDiscountOn(false);
    setDiscountMode('percent');
    setDiscountPercent('');
    setDiscountAmountInput('');
  }, [open, orderId, order?.note, order?.total, subtotal]);

  useEffect(() => {
    if (paymentType === 'naqd') {
      setPaidNow(String(finalTotal));
    }
  }, [paymentType, finalTotal]);

  const selectPaymentType = (t: DillerPaymentType) => {
    setPaymentType(t);
    if (t === 'naqd') {
      setPaidNow(String(finalTotal));
    } else {
      setPaidNow('0');
    }
  };

  if (!open || !order) return null;

  const debtRemainder = Math.max(0, finalTotal - (Number(paidNow) || 0));

  const submit = () => {
    setSubmitting(true);
    const result = confirmShopOrderSale(data, order.id, {
      paymentType,
      paidAmount: paymentType === 'qarz' ? Number(paidNow) || 0 : finalTotal,
      debtDueDate: paymentType === 'qarz' ? debtDueDate : undefined,
      note,
      discountPercent: discountOn && discountMode === 'percent' ? Number(discountPercent) || 0 : undefined,
      discountAmount: discountOn && discountMode === 'amount' ? Number(discountAmountInput) || 0 : undefined,
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onComplete(result.data);
    toast.success('Sotuv tasdiqlandi — ombor va statistika yangilandi');
    onClose();
  };

  return (
    <div
      className={dillerSheetShellClass}
      style={{ background: isDark ? '#0a0a0a' : '#f1f5f9', zIndex: 120 }}
    >
      <header
        className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-bold truncate">Sotuvni tasdiqlash</h2>
          <p className="text-xs opacity-60">To‘lov va chegirma — keyin tasdiqlang</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-xl shrink-0"
          style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
          aria-label="Yopish"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-4 max-w-lg mx-auto w-full`}>
        <section
          className="rounded-2xl border p-4"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="text-xs font-bold uppercase tracking-wide opacity-45 mb-2">Buyurtma</div>
          <div className="font-bold text-sm mb-1">{order.customerName}</div>
          <div className="text-xs opacity-60 mb-3">{order.customerPhone}</div>
          <ul className="space-y-2 mb-3">
            {order.items.map((it) => (
              <li key={it.productId} className="flex justify-between gap-2 text-sm">
                <span className="truncate opacity-85">
                  {it.productName} × {it.qty}
                </span>
                <span className="font-bold shrink-0">{formatMoney(it.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 pt-2 border-t border-white/10 text-sm">
            <div className="flex justify-between opacity-70">
              <span>Jami (chegirmasiz)</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {totals.discountAmount > 0 ? (
              <div className="flex justify-between text-amber-500">
                <span>Chegirma</span>
                <span>−{formatMoney(totals.discountAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between items-center pt-1">
              <span className="font-bold">To‘lanadi</span>
              <span className="text-lg font-black text-emerald-500">{formatMoney(finalTotal)}</span>
            </div>
          </div>
        </section>

        {store ? (
          <section
            className="rounded-2xl border p-3 flex items-center gap-3"
            style={{
              background: isDark ? 'rgba(66,133,244,0.12)' : 'rgba(66,133,244,0.08)',
              borderColor: isDark ? 'rgba(66,133,244,0.25)' : 'rgba(66,133,244,0.2)',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#fff' }}
            >
              <Store className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-blue-400">Do‘kon</div>
              <div className="font-bold text-sm truncate">{store.name}</div>
              {store.address ? (
                <div className="text-[10px] opacity-60 truncate">{store.address}</div>
              ) : null}
            </div>
          </section>
        ) : (
          <p className="text-xs text-amber-500 font-medium px-1">
            Do‘kon topilmadi — avval «Do‘konlar» bo‘limida telefon raqamini qo‘shing.
          </p>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wide opacity-50">Chegirma</h3>
            <button
              type="button"
              onClick={() => setDiscountOn((v) => !v)}
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                discountOn ? 'bg-emerald-500/20 text-emerald-400' : 'opacity-50'
              }`}
            >
              {discountOn ? 'Yoqilgan' : 'O‘chiq'}
            </button>
          </div>
          {discountOn ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['percent', 'amount'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDiscountMode(m)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                      discountMode === m
                        ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                        : isDark
                          ? 'border-white/10 opacity-70'
                          : 'border-gray-200'
                    }`}
                  >
                    {m === 'percent' ? 'Foiz (%)' : 'So‘m'}
                  </button>
                ))}
              </div>
              {discountMode === 'percent' ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Masalan: 10"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className={inputCls(isDark)}
                  />
                  <span className="text-sm font-bold opacity-60 shrink-0">%</span>
                </div>
              ) : (
                <input
                  type="number"
                  min={0}
                  max={subtotal}
                  placeholder="Chegirma summasi (so‘m)"
                  value={discountAmountInput}
                  onChange={(e) => setDiscountAmountInput(e.target.value)}
                  className={inputCls(isDark)}
                />
              )}
            </div>
          ) : null}
        </section>

        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide opacity-50 mb-2">To‘lov</h3>
          <div className="flex gap-2 mb-3">
            {(['naqd', 'qarz'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => selectPaymentType(t)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold border ${
                  paymentType === t
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : isDark
                      ? 'border-white/10 opacity-70'
                      : 'border-gray-200'
                }`}
              >
                {t === 'naqd' ? 'Naqd / to‘liq' : 'Qarzga'}
              </button>
            ))}
          </div>

          {paymentType === 'qarz' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium opacity-80 mb-1">Oldindan olindi (so‘m)</label>
                <input
                  type="number"
                  min={0}
                  max={finalTotal}
                  value={paidNow}
                  onChange={(e) => setPaidNow(e.target.value)}
                  className={inputCls(isDark)}
                  placeholder="0"
                />
              </div>
              <div
                className="p-3 rounded-xl text-sm"
                style={{ background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.15)' }}
              >
                <span className="opacity-80">Qarz qoldig‘i: </span>
                <span className="font-bold text-amber-500">{formatMoney(debtRemainder)}</span>
              </div>
              <div>
                <label className="block text-xs font-medium opacity-80 mb-1">Qachon qaytaradi</label>
                <input
                  type="date"
                  value={debtDueDate}
                  onChange={(e) => setDebtDueDate(e.target.value)}
                  className={inputCls(isDark)}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-3">
            <label className="block text-xs font-medium opacity-80 mb-1">Izoh (ixtiyoriy)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputCls(isDark)}
              placeholder="Masalan: yetkazib berildi"
            />
          </div>
        </section>

        <p className="text-[10px] opacity-45 leading-relaxed px-1">
          Chegirma statistika va analitikada alohida ko‘rinadi. Ombor buyurtma qabul qilinganda kamaytirilgan.
        </p>
      </div>

      <footer
        className="shrink-0 p-4 border-t safe-area-pb max-w-lg mx-auto w-full"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !store}
          className="w-full py-4 rounded-2xl font-bold text-slate-900 disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: accentColor.gradient }}
        >
          <ShoppingCart className="w-5 h-5" />
          {submitting ? 'Saqlanmoqda…' : `Sotuvni tasdiqlash · ${formatMoney(finalTotal)}`}
        </button>
      </footer>
    </div>
  );
}
