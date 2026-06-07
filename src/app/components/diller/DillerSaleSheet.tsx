import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Minus, Plus, Search, ShoppingCart, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerPaymentType, DillerProduct, DillerStore } from '../../utils/dillerData';
import {
  calcSaleTotals,
  createSale,
  DILLER_PRODUCT_UNITS,
  formatMoney,
  formatStoreCoords,
  getWarehouseQty,
} from '../../utils/dillerData';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';

type Props = {
  open: boolean;
  onClose: () => void;
  data: DillerData;
  onComplete: (next: DillerData) => void;
  /** Do‘kondan sotuv — do‘kon avtomatik tanlanadi */
  initialStoreId?: string | null;
};

const inputCls = (isDark: boolean) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

function unitLabel(u: string) {
  return DILLER_PRODUCT_UNITS.find((x) => x.value === u)?.label ?? u;
}

export function DillerSaleSheet({ open, onClose, data, onComplete, initialStoreId = null }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [productId, setProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [storeId, setStoreId] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [qty, setQty] = useState(1);
  const [discountOn, setDiscountOn] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('');
  const [paymentType, setPaymentType] = useState<DillerPaymentType>('naqd');
  const [paidNow, setPaidNow] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [note, setNote] = useState('');

  const presetStore = initialStoreId
    ? data.stores.find((s) => s.id === initialStoreId)
    : undefined;

  const inStockProducts = useMemo(
    () =>
      data.products.filter((p) => getWarehouseQty(data, p.id) > 0).slice(0, 40),
    [data],
  );

  useEffect(() => {
    if (!open) return;
    setProductId('');
    setProductSearch('');
    setStoreId(presetStore?.id ?? '');
    setStoreSearch('');
    setQty(1);
    setDiscountOn(false);
    setDiscountPercent('');
    setPaymentType('naqd');
    setPaidNow('');
    setDebtDueDate('');
    setNote('');
  }, [open, data.products, data.stores, initialStoreId, presetStore?.id]);

  const product = data.products.find((p) => p.id === productId);
  const stock = product ? getWarehouseQty(data, product.id) : 0;

  const searchResults = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return data.products.filter((p) => {
      const hay = `${p.name} ${p.firmName} ${p.sku}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data.products, productSearch]);

  const selectProduct = (p: DillerProduct) => {
    const q = getWarehouseQty(data, p.id);
    if (q < 1) {
      toast.error('Omborda mahsulot yo‘q');
      return;
    }
    setProductId(p.id);
    setProductSearch('');
    setQty(1);
  };

  const clearProduct = () => {
    setProductId('');
    setQty(1);
  };

  const store = data.stores.find((s) => s.id === storeId);

  const storeSearchResults = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return [];
    return data.stores.filter((s) => {
      const hay = `${s.name} ${s.address} ${s.contactName} ${s.phone}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data.stores, storeSearch]);

  const selectStore = (s: DillerStore) => {
    setStoreId(s.id);
    setStoreSearch('');
  };

  const clearStore = () => {
    setStoreId('');
  };

  const totals = useMemo(() => {
    if (!product) return null;
    return calcSaleTotals(product.unitPrice, qty, {
      discountPercent: discountOn ? Number(discountPercent) || 0 : 0,
    });
  }, [product, qty, discountOn, discountPercent]);

  useEffect(() => {
    if (paymentType === 'naqd' && totals) {
      setPaidNow(String(totals.total));
    }
  }, [paymentType, totals?.total]);

  const bumpQty = (delta: number) => {
    setQty((prev) => {
      const max = stock || 9999;
      return Math.max(1, Math.min(max, prev + delta));
    });
  };

  const submit = () => {
    if (!productId || !storeId) {
      toast.error('Mahsulot va do‘konni tanlang');
      return;
    }
    const result = createSale(data, {
      storeId,
      productId,
      qty,
      discountPercent: discountOn ? Number(discountPercent) || 0 : 0,
      paymentType,
      paidAmount: paymentType === 'qarz' ? Number(paidNow) || 0 : undefined,
      debtDueDate: paymentType === 'qarz' ? debtDueDate : undefined,
      note,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onComplete(result.data);
    toast.success('Sotuv saqlandi');
    onClose();
  };

  if (!open) return null;

  const canSell = data.products.length > 0 && data.stores.length > 0;

  return (
    <div
      className={dillerSheetShellClass}
      style={{ background: isDark ? '#0a0a0a' : '#f1f5f9', zIndex: initialStoreId ? 116 : 110 }}
    >
      <header
        className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        <div>
          <h2 className="text-lg font-bold" style={{ color: isDark ? '#fff' : '#111' }}>
            {presetStore ? 'Do‘konga sotuv' : 'Yangi sotuv'}
          </h2>
          <p className="text-xs opacity-60">
            {presetStore
              ? `${presetStore.name} · mahsulot tanlang`
              : 'Mahsulot → miqdor → do‘kon → to‘lov'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-xl"
          style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
          aria-label="Yopish"
        >
          <X className="w-5 h-5" style={{ color: isDark ? '#fff' : '#333' }} />
        </button>
      </header>

      {!canSell ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-sm opacity-70 mb-4">
            {data.products.length === 0
              ? 'Avval «Mahsulot» tabida mahsulot qo‘shing.'
              : 'Avval «Do‘konlar» tabida do‘kon qo‘shing.'}
          </p>
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold bg-emerald-500 text-slate-900">
            Yopish
          </button>
        </div>
      ) : (
        <>
          <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-5 max-w-lg mx-auto w-full`}>
            {presetStore ? (
              <section>
                <div
                  className="p-3 rounded-2xl border flex items-center gap-3"
                  style={{
                    background: isDark ? 'rgba(66,133,244,0.12)' : 'rgba(66,133,244,0.08)',
                    borderColor: isDark ? 'rgba(66,133,244,0.25)' : 'rgba(66,133,244,0.2)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#fff' }}
                  >
                    🏪
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-blue-400">
                      Sotuv do‘koni
                    </div>
                    <div className="font-bold text-sm truncate">{presetStore.name}</div>
                    {presetStore.address ? (
                      <div className="text-[10px] opacity-60 truncate">{presetStore.address}</div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {/* Mahsulot */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide opacity-50 mb-2">Mahsulot</h3>

              {product ? (
                <div
                  className="p-3 rounded-2xl border ring-2 ring-emerald-500/50 mb-2"
                  style={{
                    background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{product.name}</div>
                      <div className="text-xs opacity-70 mt-0.5">{product.firmName}</div>
                      <div className="flex flex-wrap gap-x-2 mt-1.5 text-xs">
                        <span className="font-bold text-emerald-500">{formatMoney(product.unitPrice)}</span>
                        <span className={stock < 5 ? 'text-amber-500 font-bold' : 'opacity-60'}>
                          Ombor: {stock} {unitLabel(String(product.unit))}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearProduct}
                      className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg opacity-70 hover:opacity-100"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                    >
                      O‘zgartirish
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none"
                    />
                    <input
                      type="search"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Mahsulot nomi, firma yoki SKU..."
                      className={`${inputCls(isDark)} pl-9`}
                      autoComplete="off"
                    />
                  </div>

                  {productSearch.trim() ? (
                    <div className="space-y-2">
                      {searchResults.length === 0 ? (
                        <p className="text-sm opacity-60 text-center py-6">Mahsulot topilmadi</p>
                      ) : (
                        searchResults.map((p: DillerProduct) => {
                          const q = getWarehouseQty(data, p.id);
                          const out = q < 1;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={out}
                              onClick={() => selectProduct(p)}
                              className={`w-full text-left p-3 rounded-2xl border transition-all active:scale-[0.99] ${
                                out ? 'opacity-40' : ''
                              }`}
                              style={{
                                background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                              }}
                            >
                              <div className="font-semibold text-sm truncate">{p.name}</div>
                              <div className="text-xs opacity-70 mt-0.5">{p.firmName}</div>
                              {p.sku && p.sku !== '—' ? (
                                <div className="text-[10px] font-mono opacity-50 mt-0.5">{p.sku}</div>
                              ) : null}
                              <div className="flex justify-between items-center mt-1.5">
                                <span className="text-sm font-bold text-emerald-500">{formatMoney(p.unitPrice)}</span>
                                <span className={`text-xs ${q < 5 ? 'text-amber-500 font-bold' : 'opacity-60'}`}>
                                  {out ? 'Tugagan' : `Ombor: ${q}`}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <>
                      {presetStore && inStockProducts.length > 0 ? (
                        <div className="mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide opacity-45 mb-2">
                            Ombordagi mahsulotlar
                          </p>
                          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                            {inStockProducts.map((p) => {
                              const q = getWarehouseQty(data, p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => selectProduct(p)}
                                  className="w-full text-left p-3 rounded-2xl border transition-all active:scale-[0.99]"
                                  style={{
                                    background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                  }}
                                >
                                  <div className="font-semibold text-sm truncate">{p.name}</div>
                                  <div className="text-xs opacity-70">{p.firmName}</div>
                                  <div className="flex justify-between items-center mt-1">
                                    <span className="text-sm font-bold text-emerald-500">
                                      {formatMoney(p.unitPrice)}
                                    </span>
                                    <span className="text-xs opacity-60">Ombor: {q}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[10px] opacity-40 text-center mt-2">yoki qidiruv orqali toping</p>
                        </div>
                      ) : null}
                      <p className="text-xs opacity-50 text-center py-2 px-2">
                        Qidiruv yozing — mahsulot chiqadi, ustiga bosing va tanlang
                      </p>
                    </>
                  )}
                </>
              )}
            </section>

            {/* Miqdor */}
            {product ? (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide opacity-50 mb-2">Miqdor</h3>
                <div
                  className="flex items-center justify-between p-4 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => bumpQty(-1)}
                    disabled={qty <= 1}
                    className="w-12 h-12 rounded-xl flex items-center justify-center disabled:opacity-30"
                    style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <div className="text-center">
                    <div className="text-3xl font-black tabular-nums">{qty}</div>
                    <div className="text-xs opacity-60">{unitLabel(String(product.unit))}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => bumpQty(1)}
                    disabled={qty >= stock}
                    className="w-12 h-12 rounded-xl flex items-center justify-center disabled:opacity-30"
                    style={{ background: accentColor.gradient, color: '#0f172a' }}
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </section>
            ) : null}

            {/* Do'kon */}
            {!presetStore ? (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide opacity-50 mb-2">Do‘kon</h3>

              {store ? (
                <div
                  className="p-3 rounded-2xl border ring-2 ring-emerald-500/50"
                  style={{
                    background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{store.name}</div>
                      {store.address ? (
                        <div className="text-xs opacity-70 mt-0.5 truncate">{store.address}</div>
                      ) : null}
                      <div className="text-xs opacity-60 mt-1">
                        {store.contactName}
                        {store.phone ? ` · ${store.phone}` : ''}
                      </div>
                      {formatStoreCoords(store) ? (
                        <div className="text-[10px] font-mono opacity-50 mt-0.5">{formatStoreCoords(store)}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={clearStore}
                      className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg opacity-70 hover:opacity-100"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                    >
                      O‘zgartirish
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
                    <input
                      type="search"
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      placeholder="Do‘kon nomi, manzil, telefon..."
                      className={`${inputCls(isDark)} pl-9`}
                      autoComplete="off"
                    />
                  </div>

                  {storeSearch.trim() ? (
                    <div className="space-y-2">
                      {storeSearchResults.length === 0 ? (
                        <p className="text-sm opacity-60 text-center py-6">Do‘kon topilmadi</p>
                      ) : (
                        storeSearchResults.map((s: DillerStore) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => selectStore(s)}
                            className="w-full text-left p-3 rounded-2xl border transition-all active:scale-[0.99]"
                            style={{
                              background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                            }}
                          >
                            <div className="font-semibold text-sm truncate">{s.name}</div>
                            {s.address ? (
                              <div className="text-xs opacity-70 mt-0.5 truncate">{s.address}</div>
                            ) : null}
                            <div className="text-xs opacity-60 mt-1 truncate">
                              {s.contactName}
                              {s.phone ? ` · ${s.phone}` : ''}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  ) : (
                    <p className="text-xs opacity-50 text-center py-4 px-2">
                      Qidiruv yozing — do‘kon chiqadi, ustiga bosing va tanlang
                    </p>
                  )}
                </>
              )}
            </section>
            ) : null}

            {/* Chegirma */}
            {totals ? (
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
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Foiz"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      className={inputCls(isDark)}
                    />
                    <span className="text-sm font-bold opacity-60">%</span>
                  </div>
                ) : null}
                <div
                  className="mt-3 p-3 rounded-2xl text-sm space-y-1"
                  style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#fff' }}
                >
                  <div className="flex justify-between opacity-70">
                    <span>Jami (chegirmasiz)</span>
                    <span>{formatMoney(totals.subtotal)}</span>
                  </div>
                  {totals.discountAmount > 0 ? (
                    <div className="flex justify-between text-amber-500">
                      <span>Chegirma</span>
                      <span>−{formatMoney(totals.discountAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-white/10">
                    <span>To‘lanadi</span>
                    <span className="text-emerald-400">{formatMoney(totals.total)}</span>
                  </div>
                </div>
              </section>
            ) : null}

            {/* To'lov */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide opacity-50 mb-2">To‘lov</h3>
              <div className="flex gap-2 mb-3">
                {(['naqd', 'qarz'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPaymentType(t)}
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
              {paymentType === 'qarz' && totals ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium opacity-80 mb-1">Oldindan olindi (so‘m)</label>
                    <input
                      type="number"
                      min={0}
                      max={totals.total}
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
                    <span className="font-bold text-amber-500">
                      {formatMoney(Math.max(0, totals.total - (Number(paidNow) || 0)))}
                    </span>
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
                <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls(isDark)} placeholder="Masalan: yetkazib berildi" />
              </div>
            </section>
          </div>

          <footer
            className="shrink-0 p-4 border-t safe-area-pb max-w-lg mx-auto w-full"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
          >
            <button
              type="button"
              onClick={submit}
              disabled={!productId || !storeId || !totals}
              className="w-full py-4 rounded-2xl font-bold text-slate-900 disabled:opacity-40 flex items-center justify-center gap-2 text-base"
              style={{ background: accentColor.gradient }}
            >
              <ShoppingCart className="w-5 h-5" />
              Sotuvni tasdiqlash
              {totals ? ` · ${formatMoney(totals.total)}` : ''}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
