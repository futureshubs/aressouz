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
  Instagram,
  Clock,
  X,
  Navigation,
  MessageCircle,
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
import { readBrowserGeoPreferAccurate } from '../utils/browserGeolocation';
import { reverseGeocodeDisplayLine } from '../utils/geolocationDetect';

type Step = 'products' | 'checkout' | 'confirm_store' | 'done';
type CartLine = { product: QrcodeCatalogProduct; qty: number };

const SHELL =
  'flex flex-col h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden app-safe-pad touch-manipulation';
const SCROLL =
  'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y';

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

  const [step, setStep] = useState<Step>('products');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [matchedStores, setMatchedStores] = useState<QrcodeMatchedStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState('');

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
  const hasGeo = lat != null && lng != null;

  const pageBg = isDark
    ? { background: 'radial-gradient(120% 80% at 10% -10%, #123d36 0%, #070707 42%, #05080c 100%)' }
    : { background: 'radial-gradient(120% 80% at 10% -10%, #d1fae5 0%, #f8fafc 46%, #eef2ff 100%)' };
  const glass = isDark
    ? { background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 18px 40px rgba(0,0,0,0.28)' }
    : { background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(15,23,42,0.06)', boxShadow: '0 16px 32px rgba(15,23,42,0.08)' };
  const inputCls = `w-full min-h-[54px] px-4 py-3 rounded-2xl text-base outline-none ${
    isDark
      ? 'bg-white/[0.06] text-white placeholder:text-white/35'
      : 'bg-white text-slate-900 placeholder:text-slate-400'
  }`;

  const locateNow = async () => {
    setLocBusy(true);
    setError('');
    const pos = await readBrowserGeoPreferAccurate({ timeoutMs: 16_000 });
    setLocBusy(false);
    if (!pos) {
      setError('Joylashuv olinmadi — brauzerda GPS ruxsatini yoqing');
      return;
    }
    setLat(pos.latitude);
    setLng(pos.longitude);
    const line = await reverseGeocodeDisplayLine(pos.latitude, pos.longitude);
    if (line) setAddress(line);
  };

  const submitOrder = async (storeId?: string) => {
    if (!token || cartLines.length === 0) return;
    setSubmitting(true);
    setError('');
    const res = await dillerApiSubmitQrcodeOrder(token, {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      note: '',
      storeId,
      customerAddress: address.trim() || undefined,
      customerLat: lat ?? undefined,
      customerLng: lng ?? undefined,
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
    if (!hasGeo) {
      setError('Avval «Joriy joyni aniqlash» ni bosing');
      return;
    }
    setSubmitting(true);
    setError('');
    const lookup = await dillerApiLookupQrcodeStore(token, customerPhone.trim());
    setSubmitting(false);
    if (!lookup.ok) {
      setError(lookup.error);
      return;
    }
    if (lookup.stores.length > 1) {
      setMatchedStores(lookup.stores);
      setSelectedStoreId(null);
      setStep('confirm_store');
      return;
    }
    await submitOrder(lookup.stores[0]?.id);
  };

  const goBack = () => {
    if (step === 'checkout') setStep('products');
    else if (step === 'confirm_store') {
      setMatchedStores([]);
      setSelectedStoreId(null);
      setStep('checkout');
    }
  };

  if (loading) {
    return (
      <div className={`${SHELL} items-center justify-center gap-3 text-white`} style={pageBg}>
        <Loader2 className="w-11 h-11 animate-spin text-emerald-400" />
        <p className="text-sm opacity-60">Katalog yuklanmoqda...</p>
      </div>
    );
  }

  if (error && step !== 'done' && step !== 'confirm_store' && step !== 'checkout' && products.length === 0) {
    return (
      <div className={`${SHELL} items-center justify-center px-6`} style={pageBg}>
        <div className="max-w-sm text-center text-white">
          <ShoppingBag className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
          <h1 className="text-lg font-bold mb-2">Buyurtma paneli</h1>
          <p className="opacity-60 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className={`${SHELL} items-center justify-center px-6 text-center text-white`} style={pageBg}>
        <div
          className="w-24 h-24 rounded-[32px] flex items-center justify-center mb-5"
          style={{
            background: 'linear-gradient(145deg, #34d399, #059669)',
            boxShadow: '0 22px 40px rgba(16,185,129,0.35)',
          }}
        >
          <CheckCircle2 className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-2xl font-black mb-2">Buyurtma yuborildi</h1>
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl mb-4 bg-emerald-500/15 text-emerald-300">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-semibold">30–60 daqiqada yetkaziladi</span>
        </div>
        <p className="opacity-50 text-sm max-w-xs mx-auto">{brandLabel} tez orada bog‘lanadi</p>
      </div>
    );
  }

  const showBottomBar = step === 'products' && cartLines.length > 0;

  return (
    <div className={`${SHELL} ${isDark ? 'text-white' : 'text-slate-900'}`} style={pageBg}>
      <header className="shrink-0 px-4 pt-3 pb-2">
        {step !== 'products' ? (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 text-sm font-semibold opacity-70 active:opacity-100 min-h-[40px] mb-1"
          >
            <ArrowLeft className="w-5 h-5" />
            Orqaga
          </button>
        ) : null}
        <div className="rounded-[26px] p-4 overflow-hidden" style={glass}>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-[18px] flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(145deg, #34d399, #059669)',
                boxShadow: '0 10px 22px rgba(16,185,129,0.35)',
              }}
            >
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[17px] font-black leading-tight truncate">{brandLabel}</h1>
              <p className="text-[11px] opacity-55">Mahsulot tanlang — keyin do‘kon va joy</p>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
            {contactPhone ? (
              <a
                href={`tel:${contactPhone}`}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold ${
                  isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-500/15 text-emerald-700'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                {contactPhone}
              </a>
            ) : null}
            {tgHandle ? (
              <a
                href={`https://t.me/${tgHandle}`}
                target="_blank"
                rel="noreferrer"
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold ${
                  isDark ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-500/15 text-sky-700'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                @{tgHandle}
              </a>
            ) : null}
            {igHandle ? (
              <a
                href={`https://instagram.com/${igHandle}`}
                target="_blank"
                rel="noreferrer"
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold ${
                  isDark ? 'bg-pink-500/15 text-pink-300' : 'bg-pink-500/15 text-pink-700'
                }`}
              >
                <Instagram className="w-3.5 h-3.5" />
                @{igHandle}
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex gap-1.5 mt-3 px-1">
          {['Mahsulot', 'Do‘kon / joy'].map((label, i) => {
            const on = step === 'products' ? i === 0 : i <= 1;
            return (
              <div key={label} className="flex-1">
                <div className={`h-1 rounded-full ${on ? 'bg-emerald-400' : isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                <div className={`text-[9px] font-bold mt-1 text-center ${on ? 'text-emerald-400' : 'opacity-40'}`}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </header>

      <div
        className={SCROLL}
        style={{
          paddingBottom:
            showBottomBar || step === 'checkout' || step === 'confirm_store'
              ? 'calc(8rem + var(--app-safe-bottom, 0px))'
              : 'calc(1rem + var(--app-safe-bottom, 0px))',
        }}
      >
        {step === 'products' ? (
          <div className="px-4 space-y-3 py-3">
            {products.length === 0 ? (
              <div className="rounded-[24px] p-10 text-center" style={glass}>
                <p className="text-sm opacity-50">Hozircha omborda mahsulot yo‘q</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {products.map((p) => {
                  const qty = cart[p.id] ?? 0;
                  const selected = qty > 0;
                  return (
                    <li
                      key={p.id}
                      className="rounded-[24px] p-3.5"
                      style={{
                        ...glass,
                        outline: selected ? '2px solid rgba(52,211,153,0.55)' : undefined,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => p.imageUrl && setFullscreenImage(p.imageUrl)}
                          className="w-[72px] h-[72px] rounded-[18px] overflow-hidden shrink-0"
                          style={{
                            background: 'linear-gradient(145deg, rgba(52,211,153,0.25), rgba(8,20,18,0.6))',
                          }}
                        >
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🧊</div>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-[15px] leading-snug">{p.name}</div>
                          <div className="text-sm font-black text-emerald-400 mt-0.5">
                            {formatMoney(p.unitPrice)}
                          </div>
                          <div className="text-[11px] opacity-50 mt-0.5">
                            Omborda {p.stock} {p.unit}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            aria-label="Kamaytirish"
                            onClick={() => setQty(p.id, qty - 1, p.stock)}
                            disabled={qty <= 0}
                            className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-30"
                            style={glass}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-7 text-center font-black tabular-nums">{qty}</span>
                          <button
                            type="button"
                            aria-label="Ko‘paytirish"
                            onClick={() => setQty(p.id, qty + 1, p.stock)}
                            disabled={qty >= p.stock}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-30"
                            style={{ background: 'linear-gradient(145deg, #34d399, #059669)' }}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {step === 'checkout' ? (
          <div className="px-4 space-y-3 py-3">
            <div className="rounded-[24px] p-4" style={glass}>
              <h2 className="font-black text-base mb-1">Do‘kon ma’lumoti</h2>
              <p className="text-xs opacity-50 mb-4">
                {totalQty} ta mahsulot · {formatMoney(total)}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold opacity-50 mb-1.5 block">Do‘kon nomi</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Masalan: Ulugbek Oripov"
                    autoComplete="organization"
                    className={inputCls}
                    style={glass}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold opacity-50 mb-1.5 block">Telefon raqam</label>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={inputCls}
                    style={glass}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void locateNow()}
                  disabled={locBusy}
                  className="w-full min-h-[56px] rounded-[18px] px-4 py-3 text-left active:scale-[0.99] transition-transform"
                  style={
                    hasGeo
                      ? { background: 'linear-gradient(145deg, rgba(52,211,153,0.22), rgba(8,20,18,0.5))', border: '1px solid rgba(52,211,153,0.4)' }
                      : glass
                  }
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white"
                      style={{ background: 'linear-gradient(145deg, #8b5cf6, #6d28d9)' }}
                    >
                      {locBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
                    </span>
                    <div className="min-w-0">
                      <div className="font-black text-sm">
                        {locBusy ? 'Aniqlanmoqda…' : hasGeo ? 'Joylashuv olindi' : 'Joriy joyni aniqlash'}
                      </div>
                      <div className="text-[11px] opacity-60 mt-0.5 leading-snug">
                        {hasGeo
                          ? address || `${lat!.toFixed(5)}, ${lng!.toFixed(5)}`
                          : 'GPS orqali koordinatalar avtomatik olinadi'}
                      </div>
                    </div>
                  </div>
                </button>
                {hasGeo && address ? (
                  <div className="flex items-start gap-2 text-xs opacity-70 px-1">
                    <MapPin className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    <span>{address}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-[24px] p-4" style={glass}>
              <h3 className="text-[11px] font-bold uppercase tracking-wide opacity-45 mb-3">Savat</h3>
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
          <div className="px-4 py-3">
            <div className="rounded-[24px] p-5" style={glass}>
              <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center mb-4">
                <Store className="w-7 h-7 text-violet-400" />
              </div>
              <h2 className="font-black text-lg mb-1">Do‘kon tanlang</h2>
              <p className="text-sm opacity-75 leading-relaxed mb-4">
                Shu raqamga {matchedStores.length} ta do‘kon bog‘langan
              </p>
              <ul className="space-y-2.5">
                {matchedStores.map((store) => {
                  const selected = selectedStoreId === store.id;
                  return (
                    <li key={store.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedStoreId(store.id)}
                        className="w-full text-left p-4 rounded-2xl"
                        style={
                          selected
                            ? { background: 'rgba(139,92,246,0.18)', outline: '2px solid rgba(139,92,246,0.55)' }
                            : glass
                        }
                      >
                        <div className="font-bold text-[15px] mb-1">{store.name}</div>
                        {store.address ? (
                          <div className="flex items-start gap-2 text-sm opacity-70">
                            <MapPin className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                            <span className="leading-snug">{store.address}</span>
                          </div>
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

      {showBottomBar ? (
        <div
          className="shrink-0 fixed bottom-0 left-0 right-0 z-20 px-4 pt-3 pb-[max(14px,var(--app-safe-bottom))]"
          style={{ ...glass, background: isDark ? 'rgba(7,7,7,0.92)' : 'rgba(255,255,255,0.94)', backdropFilter: 'blur(18px)' }}
        >
          <div className="max-w-lg mx-auto">
            <div className="flex justify-between items-end mb-2.5">
              <div className="text-[11px] opacity-50">{totalQty} ta tanlandi</div>
              <div className="text-xl font-black text-emerald-400">{formatMoney(total)}</div>
            </div>
            <button
              type="button"
              onClick={() => setStep('checkout')}
              className="w-full min-h-[52px] rounded-2xl font-black text-white"
              style={{ background: 'linear-gradient(135deg, #34d399, #059669)' }}
            >
              Davom etish
            </button>
          </div>
        </div>
      ) : null}

      {step === 'checkout' ? (
        <div
          className="shrink-0 fixed bottom-0 left-0 right-0 z-20 px-4 pt-3 pb-[max(14px,var(--app-safe-bottom))]"
          style={{ ...glass, background: isDark ? 'rgba(7,7,7,0.92)' : 'rgba(255,255,255,0.94)', backdropFilter: 'blur(18px)' }}
        >
          <div className="max-w-lg mx-auto">
            {error ? <p className="text-xs text-red-400 mb-2 text-center">{error}</p> : null}
            <button
              type="button"
              disabled={
                submitting ||
                !customerName.trim() ||
                customerPhone.replace(/\D/g, '').length < 9 ||
                !hasGeo
              }
              onClick={() => void proceedCheckout()}
              className="w-full min-h-[52px] rounded-2xl font-black text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Send className="w-5 h-5" />
                  Buyurtmani rasmiylashtirish
                </span>
              )}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'confirm_store' && matchedStores.length > 0 ? (
        <div
          className="shrink-0 fixed bottom-0 left-0 right-0 z-20 px-4 pt-3 pb-[max(14px,var(--app-safe-bottom))]"
          style={{ ...glass, background: isDark ? 'rgba(7,7,7,0.92)' : 'rgba(255,255,255,0.94)', backdropFilter: 'blur(18px)' }}
        >
          <div className="max-w-lg mx-auto">
            <button
              type="button"
              disabled={submitting || !selectedStoreId}
              onClick={() => selectedStoreId && void submitOrder(selectedStoreId)}
              className="w-full min-h-[52px] rounded-2xl font-black text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
            >
              {selectedStore ? `${selectedStore.name} — yuborish` : 'Do‘konni tanlang'}
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
            className="absolute top-[max(12px,var(--app-safe-top))] right-4 z-10 w-11 h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white"
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
