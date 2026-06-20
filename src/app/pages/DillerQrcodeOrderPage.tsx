import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Loader2, Minus, Plus, ShoppingBag, CheckCircle2, Phone, Send } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  dillerApiFetchQrcodeCatalog,
  dillerApiSubmitQrcodeOrder,
  type QrcodeCatalogProduct,
} from '../utils/dillerApi';
import { formatMoney } from '../utils/dillerData';

type CartLine = { product: QrcodeCatalogProduct; qty: number };

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

  const [step, setStep] = useState<'info' | 'products' | 'done'>('info');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

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

  const cartLines = useMemo(() => {
    const lines: CartLine[] = [];
    for (const p of products) {
      const qty = cart[p.id] ?? 0;
      if (qty > 0) lines.push({ product: p, qty });
    }
    return lines;
  }, [products, cart]);

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

  const submitOrder = async () => {
    if (!token) return;
    if (cartLines.length === 0) return;
    setSubmitting(true);
    const res = await dillerApiSubmitQrcodeOrder(token, {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      note: note.trim(),
      items: cartLines.map((l) => ({ productId: l.product.id, qty: l.qty })),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStep('done');
  };

  const inputCls = `w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center gap-3 app-safe-pt ${isDark ? 'bg-[#0a0a0a]' : 'bg-slate-50'}`}
      >
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
        <p className="text-sm opacity-60">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error && step !== 'done') {
    return (
      <div
        className={`min-h-screen flex items-center justify-center px-6 app-safe-pt ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-slate-50'}`}
      >
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Buyurtma paneli</h1>
          <p className="opacity-60">{error}</p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center px-6 app-safe-pt ${isDark ? 'bg-[#0a0a0a]' : 'bg-slate-50'}`}
      >
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
        <h1 className="text-2xl font-black mb-2">Buyurtma qabul qilindi!</h1>
        <p className="text-center opacity-60 max-w-sm">
          {companyName} tez orada siz bilan bog‘lanadi.
        </p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen app-safe-pt pb-8 ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div
          className="rounded-2xl p-5 mb-4 border"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(99,102,241,0.08))'
              : 'linear-gradient(135deg, #ecfdf5, #eef2ff)',
            borderColor: isDark ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.2)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-black">{companyName || 'Buyurtma'}</h1>
          </div>
          <p className="text-xs opacity-60 mb-3">Onlayn buyurtma paneli</p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {contactPhone ? (
              <a
                href={`tel:${contactPhone}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold"
              >
                <Phone className="w-3 h-3" />
                {contactPhone}
              </a>
            ) : null}
            {telegram ? (
              <span className="px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-500 font-semibold">
                TG @{telegram.replace(/^@/, '')}
              </span>
            ) : null}
            {instagram ? (
              <span className="px-2.5 py-1 rounded-full bg-pink-500/15 text-pink-500 font-semibold">
                IG @{instagram.replace(/^@/, '')}
              </span>
            ) : null}
          </div>
        </div>

        {step === 'info' ? (
          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <h2 className="font-bold text-sm">1-qadam — ma’lumotlaringiz</h2>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ism / do‘kon nomi"
              className={inputCls}
            />
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Telefon (+998...)"
              type="tel"
              className={inputCls}
            />
            <button
              type="button"
              disabled={!customerName.trim() || customerPhone.replace(/\D/g, '').length < 9}
              onClick={() => setStep('products')}
              className="w-full py-3.5 rounded-xl font-bold text-slate-900 bg-emerald-500 disabled:opacity-40"
            >
              Keyingi — mahsulot tanlash
            </button>
          </div>
        ) : null}

        {step === 'products' ? (
          <>
            <div
              className="rounded-2xl border p-4 mb-3"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <h2 className="font-bold text-sm mb-1">2-qadam — mahsulotlar</h2>
              <p className="text-xs opacity-55 mb-3">
                {customerName} · {customerPhone}
              </p>
              {products.length === 0 ? (
                <p className="text-sm opacity-50 text-center py-6">Hozircha mahsulot yo‘q</p>
              ) : (
                <ul className="space-y-2">
                  {products.map((p) => {
                    const qty = cart[p.id] ?? 0;
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 p-3 rounded-xl border"
                        style={{
                          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                          background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{p.name}</div>
                          <div className="text-xs opacity-55">
                            {formatMoney(p.unitPrice)} · {p.stock} {p.unit}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setQty(p.id, qty - 1, p.stock)}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center opacity-70"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center font-bold text-sm">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setQty(p.id, qty + 1, p.stock)}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center text-emerald-500"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Izoh (ixtiyoriy)"
                rows={2}
                className={`${inputCls} mt-3 resize-none`}
              />
            </div>

            <div
              className="rounded-2xl border p-4 sticky bottom-4"
              style={{
                background: isDark ? 'rgba(15,15,15,0.95)' : 'rgba(255,255,255,0.95)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm opacity-70">Jami</span>
                <span className="text-lg font-black text-emerald-500">{formatMoney(total)}</span>
              </div>
              <button
                type="button"
                disabled={cartLines.length === 0 || submitting}
                onClick={() => void submitOrder()}
                className="w-full py-3.5 rounded-xl font-bold text-slate-900 bg-emerald-500 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Buyurtma berish
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setStep('info')}
                className="w-full mt-2 py-2 text-xs opacity-60"
              >
                Orqaga
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
