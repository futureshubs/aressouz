import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import {
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  CheckCircle2,
  Phone,
  Send,
  Store,
  MapPin,
  ArrowLeft,
  Package,
  MessageCircle,
  Instagram,
  Clock,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  dillerApiFetchQrcodeCatalog,
  dillerApiLookupQrcodeStore,
  dillerApiSubmitQrcodeOrder,
  type QrcodeCatalogProduct,
  type QrcodeMatchedStore,
} from '../utils/dillerApi';
import { formatMoney, getDillerBrandLabel } from '../utils/dillerData';

type Step = 'home' | 'products' | 'checkout' | 'confirm_store' | 'done';
type CartLine = { product: QrcodeCatalogProduct; qty: number };

const SHELL =
  'flex flex-col h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden app-safe-pad touch-manipulation';
const SCROLL =
  'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y';
const BTN_PRIMARY =
  'w-full min-h-[52px] py-3.5 rounded-2xl font-bold text-[15px] text-slate-900 bg-emerald-500 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100';
const BTN_ICON =
  'shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30';

function stepIndex(step: Step): number {
  if (step === 'home') return 0;
  if (step === 'products') return 1;
  if (step === 'checkout' || step === 'confirm_store') return 2;
  return 3;
}

function StepProgress({ step, isDark }: { step: Step; isDark: boolean }) {
  const current = stepIndex(step);
  const labels = ['Boshlash', 'Mahsulot', 'Tasdiq'];
  return (
    <div className="px-4 pt-2 pb-3">
      <div className="flex items-center gap-1.5 mb-2">
        {labels.map((label, i) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div
              className={`h-1 w-full rounded-full transition-colors ${
                i <= current ? 'bg-emerald-500' : isDark ? 'bg-white/10' : 'bg-slate-200'
              }`}
            />
            <span
              className={`text-[9px] font-semibold truncate w-full text-center ${
                i <= current ? 'text-emerald-500' : 'opacity-40'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DillerQrcodeOrderPage() {
  const { token } = useParams<{ token: string }>();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [instagram, setInstagram] = useState('');
  const [products, setProducts] = useState<QrcodeCatalogProduct[]>([]);

  const [step, setStep] = useState<Step>('home');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [matchedStores, setMatchedStores] = useState<QrcodeMatchedStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setError('Havola noto‘g‘ri');
        setLoading(false);
        return;
      }
      const res = await dillerApiFetchQrcodeCatalog(token);
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setCompanyName(res.catalog.companyName);
      setContactPhone(res.catalog.phone);
      setTelegram(res.catalog.telegram);
      setInstagram(res.catalog.instagram);
      setProducts(res.catalog.products);
      setLoading(false);
    };
    void run();
  }, [token]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const cartLines = useMemo(() => {
    const lines: CartLine[] = [];
    for (const p of products) {
      const qty = cart[p.id] ?? 0;
      if (qty > 0) lines.push({ product: p, qty });
    }
    return lines;
  }, [products, cart]);

  const totalQty = cartLines.reduce((s, l) => s + l.qty, 0);
  const total = cartLines.reduce((s, l) => s + l.product.unitPrice * l.qty, 0);

  const setQty = (productId: string, qty: number, max: number) => {
    setCart((prev) => {
      const next = { ...prev };
      const q = Math.max(0, Math.min(max, qty));
      if (q <= 0) delete next[productId];
      else next[productId] = q;
      return next;
    });
  };

  const selectedStore = matchedStores.find((s) => s.id === selectedStoreId) ?? null;
  const brandLabel = getDillerBrandLabel(companyName);
  const tgHandle = telegram.replace(/^@/, '');
  const igHandle = instagram.replace(/^@/, '');

  const bgCls = isDark ? 'bg-[#070707] text-white' : 'bg-slate-100 text-slate-900';
  const cardCls = isDark
    ? 'rounded-2xl border border-white/10 bg-white/[0.04]'
    : 'rounded-2xl border border-black/[0.06] bg-white shadow-sm';
  const inputCls = `w-full min-h-[52px] px-4 py-3 rounded-2xl border text-base outline-none focus:ring-2 focus:ring-emerald-500/50 ${
    isDark
      ? 'bg-white/[0.06] border-white/10 text-white placeholder:text-white/35'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  const submitOrder = async (storeId?: string) => {
    if (!token || cartLines.length === 0) return;
    setSubmitting(true);
    setError('');
    const res = await dillerApiSubmitQrcodeOrder(token, {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      note: note.trim(),
      storeId,
      items: cartLines.map((l) => ({ productId: l.product.id, qty: l.qty })),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStep('done');
  };

  const proceedCheckout = async () => {
    if (!token) return;
    if (!customerName.trim() || customerPhone.replace(/\D/g, '').length < 9) return;
    setSubmitting(true);
    setError('');
    const lookup = await dillerApiLookupQrcodeStore(token, customerPhone.trim());
    setSubmitting(false);
    if (!lookup.ok) {
      setError(lookup.error);
      return;
    }
    if (lookup.stores.length > 0) {
      setMatchedStores(lookup.stores);
      setSelectedStoreId(lookup.stores.length === 1 ? lookup.stores[0].id : null);
      setStep('confirm_store');
      return;
    }
    await submitOrder();
  };

  const goBack = () => {
    if (step === 'products') setStep('home');
    else if (step === 'checkout') setStep('products');
    else if (step === 'confirm_store') {
      setMatchedStores([]);
      setSelectedStoreId(null);
      setStep('checkout');
    }
  };

  const contactLinks = (
    <div className="grid gap-2">
      {contactPhone ? (
        <a
          href={`tel:${contactPhone}`}
          className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-2xl active:scale-[0.99] transition-transform ${
            isDark ? 'bg-emerald-500/12 border border-emerald-500/25' : 'bg-emerald-50 border border-emerald-100'
          }`}
        >
          <span className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
            <Phone className="w-5 h-5 text-white" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide opacity-50 font-semibold">Telefon</div>
            <div className="font-bold text-sm truncate">{contactPhone}</div>
          </div>
        </a>
      ) : null}
      {tgHandle ? (
        <a
          href={`https://t.me/${tgHandle}`}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-2xl active:scale-[0.99] transition-transform ${
            isDark ? 'bg-blue-500/12 border border-blue-500/25' : 'bg-blue-50 border border-blue-100'
          }`}
        >
          <span className="w-10 h-10 rounded-xl bg-[#229ED9] flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-white" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide opacity-50 font-semibold">Telegram</div>
            <div className="font-bold text-sm truncate">@{tgHandle}</div>
          </div>
        </a>
      ) : null}
      {igHandle ? (
        <a
          href={`https://instagram.com/${igHandle}`}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-2xl active:scale-[0.99] transition-transform ${
            isDark ? 'bg-pink-500/12 border border-pink-500/25' : 'bg-pink-50 border border-pink-100'
          }`}
        >
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center shrink-0">
            <Instagram className="w-5 h-5 text-white" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide opacity-50 font-semibold">Instagram</div>
            <div className="font-bold text-sm truncate">@{igHandle}</div>
          </div>
        </a>
      ) : null}
    </div>
  );

  const headerBlock = (
    <div
      className={`${cardCls} p-4 mx-4 mt-3`}
      style={
        isDark
          ? { background: 'linear-gradient(145deg, rgba(16,185,129,0.14), rgba(255,255,255,0.03))' }
          : undefined
      }
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/25">
          <ShoppingBag className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-black leading-tight truncate">{brandLabel}</h1>
          <p className="text-[11px] opacity-55">Onlayn buyurtma</p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`${SHELL} ${bgCls} items-center justify-center gap-3`}>
        <Loader2 className="w-11 h-11 animate-spin text-emerald-500" />
        <p className="text-sm opacity-60">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error && step !== 'done' && step !== 'confirm_store' && step !== 'checkout') {
    return (
      <div className={`${SHELL} ${bgCls} items-center justify-center px-6`}>
        <div className="max-w-sm text-center">
          <ShoppingBag className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
          <h1 className="text-lg font-bold mb-2">Buyurtma paneli</h1>
          <p className="opacity-60 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className={`${SHELL} ${bgCls} items-center justify-center px-6 text-center`}>
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-black mb-3">Buyurtma qabul qilindi!</h1>
        <div
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl mb-4 ${
            isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-500">30–60 daqiqada yetkaziladi</span>
        </div>
        <p className="opacity-50 text-sm max-w-xs mx-auto">{brandLabel} tez orada bog‘lanishi mumkin</p>
      </div>
    );
  }

  const showProgress = step !== 'home';
  const showBack = step === 'products' || step === 'checkout' || step === 'confirm_store';
  const showBottomBar = step === 'products' && cartLines.length > 0;
  const showCheckoutBar = step === 'checkout' || step === 'confirm_store';

  return (
    <div className={`${SHELL} ${bgCls}`}>
      {/* Yuqori navigatsiya */}
      <div className="shrink-0 border-b border-white/5">
        {showBack ? (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 px-4 py-3 text-sm font-semibold opacity-70 active:opacity-100 min-h-[48px]"
          >
            <ArrowLeft className="w-5 h-5" />
            Orqaga
          </button>
        ) : (
          <div className="h-2" />
        )}
        {showProgress ? <StepProgress step={step} isDark={isDark} /> : null}
      </div>

      <div
        className={SCROLL}
        style={{
          paddingBottom: showBottomBar || showCheckoutBar
            ? 'calc(7.5rem + var(--app-safe-bottom, 0px))'
            : 'calc(1rem + var(--app-safe-bottom, 0px))',
        }}
      >
        {step === 'home' ? (
          <div className="px-4 space-y-4 pb-4">
            {headerBlock}
            <div className={`${cardCls} p-4`}>
              <h2 className="text-xs font-bold uppercase tracking-wide opacity-50 mb-3">Aloqa</h2>
              {contactLinks}
            </div>
            <div className={`${cardCls} p-4`}>
              <p className="text-sm opacity-70 mb-4 leading-relaxed">
                Mahsulot tanlang va buyurtma bering. Ombordagi miqdordan ortiq tanlab bo‘lmaydi.
              </p>
              <button type="button" onClick={() => setStep('products')} className={BTN_PRIMARY}>
                <span className="flex items-center justify-center gap-2">
                  <Package className="w-5 h-5" />
                  Buyurtma berish
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {step === 'products' ? (
          <div className="px-4 space-y-3 pb-4">
            <div className={`${cardCls} p-4`}>
              <h2 className="font-bold text-sm mb-1">Mahsulot tanlang</h2>
              <p className="text-xs opacity-50 mb-4">{products.length} ta mavjud</p>
              {products.length === 0 ? (
                <p className="text-sm opacity-50 text-center py-10">Hozircha omborda mahsulot yo‘q</p>
              ) : (
                <ul className="space-y-2.5">
                  {products.map((p) => {
                    const qty = cart[p.id] ?? 0;
                    const selected = qty > 0;
                    return (
                      <li
                        key={p.id}
                        className={`p-3.5 rounded-2xl border transition-colors ${
                          selected
                            ? isDark
                              ? 'border-emerald-500/40 bg-emerald-500/10'
                              : 'border-emerald-200 bg-emerald-50/80'
                            : isDark
                              ? 'border-white/6 bg-white/[0.02]'
                              : 'border-slate-100 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {p.imageUrl ? (
                            <button
                              type="button"
                              aria-label={`${p.name} rasmi`}
                              onClick={() => setFullscreenImage(p.imageUrl!)}
                              className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border active:scale-95 transition-transform"
                              style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
                            >
                              <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                            </button>
                          ) : null}
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-[15px] leading-snug">{p.name}</div>
                            <div className="text-sm font-black text-emerald-500 mt-1">{formatMoney(p.unitPrice)}</div>
                            <div className="text-[11px] opacity-50 mt-1">
                              Omborda:{' '}
                              <span className="font-bold text-emerald-500/90">
                                {p.stock} {p.unit}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              aria-label="Kamaytirish"
                              onClick={() => setQty(p.id, qty - 1, p.stock)}
                              disabled={qty <= 0}
                              className={`${BTN_ICON} ${isDark ? 'border-white/10' : 'border-slate-200'}`}
                            >
                              <Minus className="w-5 h-5" />
                            </button>
                            <span className="w-8 text-center font-black text-base tabular-nums">{qty}</span>
                            <button
                              type="button"
                              aria-label="Ko‘paytirish"
                              onClick={() => setQty(p.id, qty + 1, p.stock)}
                              disabled={qty >= p.stock}
                              className={`${BTN_ICON} border-emerald-500/40 text-emerald-500 bg-emerald-500/10`}
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {step === 'checkout' ? (
          <div className="px-4 space-y-4 pb-4">
            <div className={`${cardCls} p-4`}>
              <h2 className="font-bold text-sm mb-1">Ma’lumotlaringiz</h2>
              <p className="text-xs opacity-50 mb-4">
                {totalQty} ta mahsulot · {formatMoney(total)}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold opacity-50 mb-1.5 block px-1">Ism / do‘kon</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ismingiz yoki do‘kon nomi"
                    autoComplete="name"
                    enterKeyHint="next"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold opacity-50 mb-1.5 block px-1">Telefon</label>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    enterKeyHint="done"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold opacity-50 mb-1.5 block px-1">Izoh</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Qo‘shimcha izoh (ixtiyoriy)"
                    rows={3}
                    className={`${inputCls} min-h-[88px] resize-none`}
                  />
                </div>
              </div>
            </div>
            <div className={`${cardCls} p-4`}>
              <h3 className="text-xs font-bold uppercase tracking-wide opacity-50 mb-3">Buyurtma</h3>
              <ul className="space-y-2 text-sm">
                {cartLines.map((l) => (
                  <li key={l.product.id} className="flex justify-between gap-2">
                    <span className="opacity-80 truncate">
                      {l.product.name} × {l.qty}
                    </span>
                    <span className="font-bold shrink-0">{formatMoney(l.product.unitPrice * l.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {step === 'confirm_store' && matchedStores.length > 0 ? (
          <div className="px-4 pb-4">
            <div className={`${cardCls} p-5`}>
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-4">
                <Store className="w-7 h-7 text-emerald-500" />
              </div>
              <h2 className="font-black text-lg mb-1">Do‘kon topildi</h2>
              <p className="text-sm opacity-75 leading-relaxed mb-4">
                {matchedStores.length === 1
                  ? 'Shu telefon raqamiga bog‘langan do‘kon — buyurtma berasizmi?'
                  : `Shu telefon raqamiga ${matchedStores.length} ta do‘kon bog‘langan — qaysi biridan buyurtma berasiz?`}
              </p>
              <ul className="space-y-2.5">
                {matchedStores.map((store) => {
                  const selected = selectedStoreId === store.id;
                  return (
                    <li key={store.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedStoreId(store.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-colors active:scale-[0.99] ${
                          selected
                            ? isDark
                              ? 'border-emerald-500/50 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                              : 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-500/20'
                            : isDark
                              ? 'border-white/8 bg-white/[0.03]'
                              : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-[15px] mb-1">{store.name}</div>
                        {store.address ? (
                          <div className="flex items-start gap-2 text-sm opacity-70">
                            <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="leading-snug">{store.address}</span>
                          </div>
                        ) : null}
                        {store.contactName ? (
                          <div className="text-xs opacity-50 mt-1.5">{store.contactName}</div>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {error ? <p className="text-xs text-red-400 mt-3">{error}</p> : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Pastki fixed panel — mahsulot */}
      {showBottomBar ? (
        <div
          className={`shrink-0 fixed bottom-0 left-0 right-0 z-20 border-t px-4 pt-3 pb-[max(12px,var(--app-safe-bottom))] ${
            isDark ? 'bg-[#0a0a0a]/95 border-white/10' : 'bg-white/95 border-slate-200'
          }`}
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <div className="max-w-lg mx-auto">
            <div className="flex justify-between items-end mb-2.5">
              <div>
                <div className="text-[11px] opacity-50">{totalQty} ta tanlandi</div>
                <div className="text-xl font-black text-emerald-500">{formatMoney(total)}</div>
              </div>
            </div>
            <button type="button" onClick={() => setStep('checkout')} className={BTN_PRIMARY}>
              Rasmiyalashtirish
            </button>
          </div>
        </div>
      ) : null}

      {/* Pastki fixed — checkout / confirm */}
      {step === 'checkout' ? (
        <div
          className={`shrink-0 fixed bottom-0 left-0 right-0 z-20 border-t px-4 pt-3 pb-[max(12px,var(--app-safe-bottom))] ${
            isDark ? 'bg-[#0a0a0a]/95 border-white/10' : 'bg-white/95 border-slate-200'
          }`}
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <div className="max-w-lg mx-auto">
            {error ? <p className="text-xs text-red-400 mb-2 text-center">{error}</p> : null}
            <button
              type="button"
              disabled={submitting || !customerName.trim() || customerPhone.replace(/\D/g, '').length < 9}
              onClick={() => void proceedCheckout()}
              className={BTN_PRIMARY}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Send className="w-5 h-5" />
                  Buyurtma yuborish
                </span>
              )}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'confirm_store' && matchedStores.length > 0 ? (
        <div
          className={`shrink-0 fixed bottom-0 left-0 right-0 z-20 border-t px-4 pt-3 pb-[max(12px,var(--app-safe-bottom))] ${
            isDark ? 'bg-[#0a0a0a]/95 border-white/10' : 'bg-white/95 border-slate-200'
          }`}
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <div className="max-w-lg mx-auto grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={submitting || !selectedStoreId}
              onClick={() => selectedStoreId && void submitOrder(selectedStoreId)}
              className={`${BTN_PRIMARY} !min-h-[48px] !text-sm disabled:opacity-40`}
            >
              {selectedStore ? `Ha, ${selectedStore.name}` : 'Do‘konni tanlang'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitOrder()}
              className={`min-h-[48px] py-3 rounded-2xl font-bold text-sm border active:scale-[0.98] transition-transform disabled:opacity-40 ${
                isDark ? 'border-white/15 bg-white/5' : 'border-slate-200 bg-white'
              }`}
            >
              Yo‘q, boshqa
            </button>
          </div>
        </div>
      ) : null}

      {fullscreenImage ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 app-safe-pad"
          role="dialog"
          aria-modal="true"
          aria-label="Rasm"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            type="button"
            aria-label="Yopish"
            onClick={() => setFullscreenImage(null)}
            className="absolute top-[max(12px,var(--app-safe-top))] right-4 z-10 w-11 h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={fullscreenImage}
            alt=""
            className="max-w-full max-h-full object-contain px-4"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
