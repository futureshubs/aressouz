import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, CreditCard, Wallet, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerDealerOrder, DillerPaymentType, DillerSavedCard } from '../../utils/dillerData';
import {
  completeDealerOrder,
  createSavedCard,
  formatCardNumber,
  formatMoney,
} from '../../utils/dillerData';
import { normalizeUzPhoneForSms } from '../../utils/dillerPurchaseSms';
import {
  maybeSendSalesBatchPurchaseSms,
  purchaseSmsToast,
} from '../../utils/dillerPurchaseSmsSend';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';
import {
  iosAccentFillStyle,
  iosGlassBarStyle,
  iosGlassCardStyle,
  iosGlassInputStyle,
  iosGlassPageSurface,
} from './dillerIosGlass';

type Props = {
  open: boolean;
  order: DillerDealerOrder | null;
  data: DillerData;
  onClose: () => void;
  onComplete: (next: DillerData) => void;
};

export function DillerDealerOrderPaySheet({ open, order, data, onClose, onComplete }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [paymentType, setPaymentType] = useState<DillerPaymentType>('naqd');
  const [cardId, setCardId] = useState('');
  const [paidNow, setPaidNow] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [cardForm, setCardForm] = useState(false);
  const [newCard, setNewCard] = useState({ number: '', holderName: '', bank: 'Uzcard' });
  const [busy, setBusy] = useState(false);
  const [sendSms, setSendSms] = useState(true);

  useEffect(() => {
    if (!open) return;
    setPaymentType('naqd');
    setCardId(data.cards?.[0]?.id ?? '');
    setPaidNow('');
    setDebtDueDate('');
    setCardForm(false);
    setBusy(false);
    const storePhone = data.stores.find((s) => s.id === order?.storeId)?.phone || '';
    setSendSms(Boolean(normalizeUzPhoneForSms(storePhone)));
  }, [open, order?.id, data.cards]);

  if (!open || !order) return null;

  const store = data.stores.find((s) => s.id === order.storeId);
  const storePhoneOk = Boolean(normalizeUzPhoneForSms(store?.phone || ''));
  const remaining = Math.max(0, order.total - (Number(paidNow) || 0));

  const addCard = () => {
    const result = createSavedCard(data, newCard);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onComplete(result.data);
    if (result.card) setCardId(result.card.id);
    setCardForm(false);
    setNewCard({ number: '', holderName: '', bank: 'Uzcard' });
    toast.success('Karta saqlandi');
  };

  const submit = async () => {
    setBusy(true);
    const result = completeDealerOrder(data, order.id, {
      paymentType,
      cardId: paymentType === 'karta' ? cardId : undefined,
      paidAmount: paymentType === 'qarz' ? Number(paidNow) || 0 : undefined,
      debtDueDate: paymentType === 'qarz' ? debtDueDate : undefined,
    });
    if (result.error) {
      setBusy(false);
      toast.error(result.error);
      return;
    }
    onComplete(result.data);
    const sms = await maybeSendSalesBatchPurchaseSms({
      data: result.data,
      sales: result.sales ?? [],
      send: sendSms && storePhoneOk,
    });
    setBusy(false);
    toast.success(purchaseSmsToast(sms, 'Buyurtma topshirildi — sotuv yozildi'));
    onClose();
  };

  return (
    <div className={dillerSheetShellClass} style={{ ...iosGlassPageSurface(isDark), zIndex: 118 }}>
      <header className="shrink-0 flex items-center gap-2 px-4 py-3" style={iosGlassBarStyle(isDark)}>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black">Topshirdim</h2>
          <p className="text-[11px] opacity-50 truncate">{store?.name ?? 'Do‘kon'} · to‘lov</p>
        </div>
        <button type="button" onClick={onClose} className="p-2.5 rounded-xl" style={iosGlassCardStyle(isDark)}>
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-4 max-w-lg mx-auto w-full`}>
        <div className="rounded-[20px] p-4 space-y-2" style={iosGlassCardStyle(isDark)}>
          {order.items.map((it) => (
            <div key={`${it.productId}-${it.productName}`} className="flex justify-between text-sm gap-2">
              <span className="opacity-80 truncate">
                {it.productName} × {it.qty}
              </span>
              <span className="font-bold shrink-0">{formatMoney(it.lineTotal)}</span>
            </div>
          ))}
          <div className="flex justify-between font-black pt-1">
            <span>Jami</span>
            <span style={{ color: accentColor.color }}>{formatMoney(order.total)}</span>
          </div>
        </div>

        <div className="text-[11px] font-bold uppercase tracking-wide opacity-45">To‘lov turi</div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'naqd' as const, label: 'Naqt', Icon: Banknote },
              { id: 'karta' as const, label: 'Karta', Icon: CreditCard },
              { id: 'qarz' as const, label: 'Qarz', Icon: Wallet },
            ]
          ).map((t) => {
            const on = paymentType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPaymentType(t.id)}
                className="rounded-[16px] py-3 flex flex-col items-center gap-1 active:scale-[0.97]"
                style={on ? iosAccentFillStyle(accentColor.gradient, accentColor.color) : iosGlassCardStyle(isDark)}
              >
                <t.Icon className="w-5 h-5" />
                <span className="text-[12px] font-bold">{t.label}</span>
              </button>
            );
          })}
        </div>

        {paymentType === 'karta' ? (
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide opacity-45">Karta tanlang</div>
            {(data.cards ?? []).length === 0 || cardForm ? (
              <div className="rounded-[20px] p-4 space-y-2" style={iosGlassCardStyle(isDark)}>
                <input
                  placeholder="8600 0000 0000 0000"
                  value={newCard.number}
                  onChange={(e) => setNewCard((c) => ({ ...c, number: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={iosGlassInputStyle(isDark)}
                />
                <input
                  placeholder="Ism familiya"
                  value={newCard.holderName}
                  onChange={(e) => setNewCard((c) => ({ ...c, holderName: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={iosGlassInputStyle(isDark)}
                />
                <input
                  placeholder="Bank"
                  value={newCard.bank}
                  onChange={(e) => setNewCard((c) => ({ ...c, bank: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={iosGlassInputStyle(isDark)}
                />
                <button
                  type="button"
                  onClick={addCard}
                  className="w-full py-2.5 rounded-xl font-bold text-white"
                  style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
                >
                  Qo‘shish
                </button>
              </div>
            ) : (
              <>
                {(data.cards ?? []).map((c: DillerSavedCard) => {
                  const on = cardId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCardId(c.id)}
                      className="w-full text-left rounded-[16px] px-3.5 py-3"
                      style={on ? iosAccentFillStyle(accentColor.gradient, accentColor.color) : iosGlassCardStyle(isDark)}
                    >
                      <div className="font-bold">{formatCardNumber(c.number)}</div>
                      <div className={`text-[11px] ${on ? 'opacity-80' : 'opacity-50'}`}>
                        {c.holderName} · {c.bank}
                      </div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCardForm(true)}
                  className="text-sm font-bold"
                  style={{ color: accentColor.color }}
                >
                  + Karta qo‘shish
                </button>
              </>
            )}
          </div>
        ) : null}

        {paymentType === 'qarz' ? (
          <div className="space-y-2">
            <label className="block text-[11px] font-bold opacity-45 uppercase">Hozir to‘langan</label>
            <input
              type="number"
              min={0}
              value={paidNow}
              onChange={(e) => setPaidNow(e.target.value)}
              className="w-full px-3 py-3 rounded-xl text-sm outline-none"
              style={iosGlassInputStyle(isDark)}
            />
            <label className="block text-[11px] font-bold opacity-45 uppercase">Qaytarish kuni</label>
            <input
              type="date"
              value={debtDueDate}
              onChange={(e) => setDebtDueDate(e.target.value)}
              className="w-full px-3 py-3 rounded-xl text-sm outline-none"
              style={iosGlassInputStyle(isDark)}
            />
            <div className="rounded-xl px-3 py-2.5 text-amber-500 bg-amber-500/10 text-sm font-bold">
              Qolgan qarz: {formatMoney(remaining)}
            </div>
          </div>
        ) : null}

        <label
          className={`flex items-start gap-3 rounded-[16px] px-3 py-3 text-sm ${
            !storePhoneOk ? 'opacity-50' : ''
          }`}
          style={iosGlassCardStyle(isDark)}
        >
          <input
            type="checkbox"
            className="mt-0.5"
            checked={sendSms && storePhoneOk}
            disabled={!storePhoneOk}
            onChange={(e) => setSendSms(e.target.checked)}
          />
          <span>
            <span className="font-medium">Xarid SMS yuborish</span>
            <span className="block text-xs opacity-60 mt-0.5">
              {storePhoneOk
                ? 'Do‘kon egasi telefoniga: xarid rasmiylashtirildi'
                : 'Do‘konda telefon yo‘q — SMS yuborib bo‘lmaydi'}
            </span>
          </span>
        </label>
      </div>

      <div className="shrink-0 px-4 py-3 max-w-lg mx-auto w-full" style={iosGlassBarStyle(isDark)}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="w-full py-3.5 rounded-2xl font-bold text-white disabled:opacity-40"
          style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
        >
          Yakunlash — {formatMoney(order.total)}
        </button>
      </div>
    </div>
  );
}
