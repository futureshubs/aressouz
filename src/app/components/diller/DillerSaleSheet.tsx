import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Search,
  ShoppingCart,
  Store,
  Wallet,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useDillerUserLocation } from '../../hooks/useDillerUserLocation';
import type { DillerData, DillerPaymentType, DillerProduct, DillerSavedCard } from '../../utils/dillerData';
import {
  createDealerOrder,
  createSalesBatch,
  createSavedCard,
  DILLER_PRODUCT_UNITS,
  formatCardNumber,
  formatMoney,
  getWarehouseQty,
} from '../../utils/dillerData';
import { formatStoreDistance, getStoreDistanceKm } from '../../utils/dillerStoreStats';
import { resolveDillerImage } from '../../utils/dillerMedia';
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
  onClose: () => void;
  data: DillerData;
  onComplete: (next: DillerData) => void;
  initialStoreId?: string | null;
  mode?: 'sale' | 'order';
};

function unitLabel(u: string) {
  return DILLER_PRODUCT_UNITS.find((x) => x.value === u)?.label ?? u;
}

export function DillerSaleSheet({
  open,
  onClose,
  data,
  onComplete,
  initialStoreId = null,
  mode = 'sale',
}: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isOrder = mode === 'order';
  const { location } = useDillerUserLocation(open);

  const presetStore = initialStoreId ? data.stores.find((s) => s.id === initialStoreId) : undefined;
  const [step, setStep] = useState<1 | 2 | 3>(presetStore ? 2 : 1);
  const [storeId, setStoreId] = useState(presetStore?.id ?? '');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paymentType, setPaymentType] = useState<DillerPaymentType>('naqd');
  const [cardId, setCardId] = useState('');
  const [paidNow, setPaidNow] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [discount, setDiscount] = useState('');
  const [cardForm, setCardForm] = useState(false);
  const [newCard, setNewCard] = useState({ number: '', holderName: '', bank: 'Uzcard' });
  const [busy, setBusy] = useState(false);
  const [sendSms, setSendSms] = useState(true);

  useEffect(() => {
    if (!open) return;
    setStep(presetStore ? 2 : 1);
    setStoreId(presetStore?.id ?? '');
    setQuery('');
    setCart({});
    setPaymentType('naqd');
    setCardId(data.cards?.[0]?.id ?? '');
    setPaidNow('');
    setDebtDueDate('');
    setDiscount('');
    setCardForm(false);
    setBusy(false);
    setSendSms(Boolean(normalizeUzPhoneForSms(presetStore?.phone || '')));
  }, [open, initialStoreId, presetStore?.id, data.cards]);

  const store = data.stores.find((s) => s.id === storeId);
  const storePhoneOk = Boolean(normalizeUzPhoneForSms(store?.phone || ''));

  useEffect(() => {
    if (!open || isOrder) return;
    setSendSms(storePhoneOk);
  }, [open, storeId, storePhoneOk, isOrder]);

  const storesNear = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...data.stores]
      .map((s) => ({ s, km: getStoreDistanceKm(s, location) }))
      .filter(({ s }) => {
        if (!q) return true;
        return `${s.name} ${s.address} ${s.phone} ${s.contactName}`.toLowerCase().includes(q);
      })
      .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  }, [data.stores, location, query]);

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.products.filter((p) => {
      if (!q) return true;
      return `${p.name} ${p.sku}`.toLowerCase().includes(q);
    });
  }, [data.products, query]);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([productId, qty]) => ({ productId, qty })),
    [cart],
  );

  const cartTotal = useMemo(() => {
    let sub = 0;
    for (const line of lines) {
      const p = data.products.find((x) => x.id === line.productId);
      if (!p) continue;
      sub += p.unitPrice * line.qty;
    }
    const discountAmount = Math.min(sub, Math.max(0, Number(discount) || 0));
    return { sub, discountAmount, total: Math.max(0, sub - discountAmount) };
  }, [lines, data.products, discount]);

  const bump = (product: DillerProduct, delta: number) => {
    const stock = getWarehouseQty(data, product.id);
    const cap = isOrder ? Math.max(stock, 999) : stock;
    setCart((prev) => {
      const cur = prev[product.id] ?? 0;
      const next = Math.max(0, Math.min(cap, cur + delta));
      if (next === 0) {
        const { [product.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [product.id]: next };
    });
  };

  const submit = async () => {
    if (!store) {
      toast.error('Do‘kon tanlang');
      return;
    }
    if (lines.length === 0) {
      toast.error('Mahsulot tanlang');
      return;
    }
    setBusy(true);
    if (isOrder) {
      const result = createDealerOrder(data, { storeId: store.id, lines });
      setBusy(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onComplete(result.data);
      toast.success('Buyurtma yaratildi — topshirgach to‘lov ochiladi');
      onClose();
      return;
    }
    const result = createSalesBatch(data, {
      storeId: store.id,
      lines,
      paymentType,
      cardId: paymentType === 'karta' ? cardId : undefined,
      discountAmount: cartTotal.discountAmount,
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
    toast.success(purchaseSmsToast(sms, 'Sotuv saqlandi'));
    onClose();
  };

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

  if (!open) return null;
  const title = isOrder ? 'Buyurtma olish' : 'Yangi sotuv';

  return (
    <div className={dillerSheetShellClass} style={{ ...iosGlassPageSurface(isDark), zIndex: 116 }}>
      <header className="shrink-0 flex items-center gap-2 px-4 py-3" style={iosGlassBarStyle(isDark)}>
        {(step > 1 && !presetStore) || (step > 2 && presetStore) ? (
          <button
            type="button"
            onClick={() => setStep(step === 3 ? 2 : 1)}
            className="p-2.5 rounded-xl"
            style={iosGlassCardStyle(isDark)}
            aria-label="Orqaga"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black truncate">{title}</h2>
          <p className="text-[11px] opacity-50">
            {step === 1 ? 'Eng yaqin do‘konni tanlang' : step === 2 ? 'Mahsulot tanlang' : isOrder ? 'Tasdiqlang' : 'To‘lov'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-2.5 rounded-xl" style={iosGlassCardStyle(isDark)}>
          <X className="w-5 h-5" />
        </button>
      </header>

      {step === 1 ? (
        <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-2 max-w-lg mx-auto w-full`}>
          <div className="flex items-center gap-2 rounded-[16px] px-3 py-2.5" style={iosGlassInputStyle(isDark)}>
            <Search className="w-4 h-4 opacity-40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Do‘kon qidirish..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
          {storesNear.length === 0 ? (
            <p className="text-sm opacity-55 text-center py-10">Do‘kon yo‘q — avval qo‘shing</p>
          ) : (
            storesNear.map(({ s, km }) => {
              const img = resolveDillerImage(s.imageUrl);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStoreId(s.id);
                    setQuery('');
                    setStep(2);
                  }}
                  className="w-full text-left rounded-[20px] px-3.5 py-3 flex items-center gap-3 active:scale-[0.99]"
                  style={iosGlassCardStyle(isDark)}
                >
                  <div
                    className="w-12 h-12 rounded-[14px] overflow-hidden shrink-0 flex items-center justify-center"
                    style={{ background: `${accentColor.color}18`, color: accentColor.color }}
                  >
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Store className="w-6 h-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{s.name}</div>
                    <div className="text-[11px] opacity-50 truncate">{s.address || s.contactName}</div>
                  </div>
                  <span className="text-[11px] font-bold shrink-0" style={{ color: accentColor.color }}>
                    {formatStoreDistance(km) || <Navigation className="w-4 h-4 opacity-40" />}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <>
          <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-2 max-w-lg mx-auto w-full`}>
            {store ? (
              <div className="rounded-[16px] px-3 py-2.5 flex items-center gap-2" style={iosGlassCardStyle(isDark)}>
                <MapPin className="w-4 h-4" style={{ color: accentColor.color }} />
                <span className="text-sm font-bold truncate">{store.name}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2 rounded-[16px] px-3 py-2.5" style={iosGlassInputStyle(isDark)}>
              <Search className="w-4 h-4 opacity-40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mahsulot, shtrix kod..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
            {products.map((p) => {
              const stock = getWarehouseQty(data, p.id);
              const qty = cart[p.id] ?? 0;
              const img = resolveDillerImage(p.imageUrl);
              const low = stock > 0 && stock <= 5;
              return (
                <div key={p.id} className="rounded-[20px] px-3 py-3 flex items-center gap-3" style={iosGlassCardStyle(isDark)}>
                  <div
                    className="w-12 h-12 rounded-[14px] overflow-hidden shrink-0 flex items-center justify-center relative"
                    style={{ background: `${accentColor.color}18`, color: accentColor.color }}
                  >
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <ShoppingCart className="w-5 h-5" />}
                    <span
                      className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${
                        stock === 0 ? 'bg-rose-400' : low ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{p.name}</div>
                    <div className="text-[12px] font-bold" style={{ color: accentColor.color }}>
                      {formatMoney(p.unitPrice)}
                    </div>
                    <div className={`text-[10px] ${low ? 'text-amber-500' : 'opacity-45'}`}>
                      Qoldiq: {stock} {unitLabel(String(p.unit))}
                    </div>
                  </div>
                  {qty > 0 ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => bump(p, -1)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={iosGlassInputStyle(isDark)}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-5 text-center font-black">{qty}</span>
                      <button
                        type="button"
                        onClick={() => bump(p, 1)}
                        disabled={!isOrder && qty >= stock}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                        style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!isOrder && stock < 1}
                      onClick={() => bump(p, 1)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-30"
                      style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="shrink-0 px-4 py-3 max-w-lg mx-auto w-full" style={iosGlassBarStyle(isDark)}>
            <button
              type="button"
              disabled={lines.length === 0}
              onClick={() => setStep(3)}
              className="w-full py-3.5 rounded-2xl font-bold text-white disabled:opacity-40 flex items-center justify-between px-5"
              style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
            >
              <span>
                Savat · {lines.reduce((s, l) => s + l.qty, 0)}
              </span>
              <span>{formatMoney(cartTotal.total)}</span>
            </button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-4 max-w-lg mx-auto w-full`}>
            <div className="rounded-[20px] p-4 space-y-2" style={iosGlassCardStyle(isDark)}>
              {lines.map((line) => {
                const p = data.products.find((x) => x.id === line.productId);
                if (!p) return null;
                return (
                  <div key={line.productId} className="flex justify-between text-sm">
                    <span className="opacity-80 truncate mr-2">
                      {p.name} × {line.qty}
                    </span>
                    <span className="font-bold">{formatMoney(p.unitPrice * line.qty)}</span>
                  </div>
                );
              })}
              {!isOrder ? (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm opacity-60">Chegirma</span>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-28 px-3 py-2 rounded-xl text-sm text-right outline-none"
                    style={iosGlassInputStyle(isDark)}
                  />
                </div>
              ) : null}
              <div className="flex justify-between font-black pt-1">
                <span>Jami</span>
                <span style={{ color: accentColor.color }}>{formatMoney(cartTotal.total)}</span>
              </div>
            </div>

            {isOrder ? (
              <p className="text-xs opacity-55 leading-relaxed px-1">
                Buyurtma do‘konga birikadi. Yetkazib bergach «Topshirdim» — keyin to‘lov tanlanadi. Ombordan hozircha ayirilmaydi.
              </p>
            ) : (
              <>
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
                      Qolgan qarz:{' '}
                      {formatMoney(Math.max(0, cartTotal.total - (Number(paidNow) || 0)))}
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
              </>
            )}
          </div>
          <div className="shrink-0 px-4 py-3 max-w-lg mx-auto w-full" style={iosGlassBarStyle(isDark)}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="w-full py-3.5 rounded-2xl font-bold text-white disabled:opacity-40"
              style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
            >
              {isOrder ? 'Buyurtma yaratish' : `Yakunlash — ${formatMoney(cartTotal.total)}`}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
