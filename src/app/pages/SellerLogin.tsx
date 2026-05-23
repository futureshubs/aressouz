import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { Store, Lock, User, Loader2, ShoppingBag, Package, TrendingUp } from 'lucide-react';
import { API_BASE_URL, DEV_API_BASE_URL, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { readValidSellerSession } from '../utils/sellerSession';

const sellerLoginUrl = () => {
  const baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;
  return `${baseUrl}/seller/login`;
};

function scrollFieldIntoView(el: HTMLElement | null) {
  if (!el) return;
  requestAnimationFrame(() => {
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      el.scrollIntoView();
    }
  });
}

export default function SellerLogin() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const loginInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    login: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sessionCheckDone, setSessionCheckDone] = useState(false);
  const [kbInsetPx, setKbInsetPx] = useState(0);

  const keyboardOpen = kbInsetPx > 72;

  useEffect(() => {
    const saved = readValidSellerSession();
    if (saved) {
      navigate('/seller/dashboard', { replace: true });
      return;
    }
    setSessionCheckDone(true);
  }, [navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const vv = window.visualViewport;

    const readInset = () => {
      try {
        const raw = getComputedStyle(root).getPropertyValue('--kb-inset').trim();
        setKbInsetPx(Math.max(0, Math.round(parseFloat(raw) || 0)));
      } catch {
        setKbInsetPx(0);
      }
    };

    readInset();
    const onResize = () => readInset();
    if (vv) {
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('focusin', onResize);
    window.addEventListener('focusout', onResize);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      }
      window.removeEventListener('resize', onResize);
      window.removeEventListener('focusin', onResize);
      window.removeEventListener('focusout', onResize);
    };
  }, []);

  const handleFieldFocus = useCallback((el: HTMLElement | null) => {
    scrollFieldIntoView(el);
    window.setTimeout(() => scrollFieldIntoView(el), 280);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.login || !formData.password) {
      toast.error('Login va parol majburiy!');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(sellerLoginUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const sessionData = {
          token: data.session.token,
          shopId: data.session.shop.id,
          shopName: data.session.shop.name,
          branchId: data.session.shop.branchId,
          role: data.session.role === 'cashier' ? 'cashier' : 'owner',
          staffId: data.session.staffId,
          staffName: data.session.staffName,
          permissions: Array.isArray(data.session.permissions) ? data.session.permissions : undefined,
        };

        if (sessionData.token.includes('seller-shop-')) {
          toast.error('Server xatoligi: Eski token formati. Iltimos administrator bilan bog\'laning.');
          return;
        }

        localStorage.setItem('sellerSession', JSON.stringify(sessionData));
        toast.success(data.message);
        navigate('/seller/dashboard');
      } else {
        toast.error(data.error || 'Kirishda xatolik');
      }
    } catch {
      toast.error('Serverga ulanishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const shellStyle = {
    height: 'var(--app-viewport-height, 100dvh)',
    maxHeight: 'var(--app-viewport-height, 100dvh)',
    background: isDark
      ? 'linear-gradient(160deg, #000000 0%, #0a0a0a 45%, #111827 100%)'
      : 'linear-gradient(160deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
  } as const;

  if (!sessionCheckDone) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 app-safe-pl app-safe-pr app-safe-pb"
        style={{ ...shellStyle, paddingTop: 'var(--app-safe-top)' }}
      >
        <div
          className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${accentColor.color}55`, borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}>
          Tekshirilmoqda…
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden app-safe-pl app-safe-pr app-safe-pb"
      style={shellStyle}
    >
      {/* Tepa — faqat bitta safe-top (app-safe-pad ishlatilmaydi) */}
      <header
        className="relative z-30 flex shrink-0 items-center border-b px-3 py-2 sm:px-5 sm:py-2.5 lg:hidden"
        style={{
          paddingTop: 'max(0.5rem, var(--app-safe-top, 0px))',
          background: isDark ? 'rgba(10,10,10,0.92)' : 'rgba(255,255,255,0.92)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Store className="h-5 w-5 shrink-0" style={{ color: accentColor.color }} />
          <span className="truncate text-sm font-semibold" style={{ color: isDark ? '#fff' : '#111827' }}>
            Seller Panel
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Brand — faqat desktop */}
        <aside
          className="relative hidden min-h-0 flex-1 flex-col justify-between overflow-hidden lg:flex lg:w-[min(48%,520px)] lg:p-12 xl:p-14"
          style={{
            background: isDark
              ? `linear-gradient(145deg, ${accentColor.color}22 0%, ${accentColor.color}08 40%, rgba(0,0,0,0.4) 100%)`
              : `linear-gradient(145deg, ${accentColor.color}18 0%, ${accentColor.color}08 45%, #ffffff 100%)`,
            borderRight: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl opacity-40"
            style={{ background: accentColor.color }}
          />

          <div className="relative z-10">
            <div
              className="mb-5 inline-flex rounded-2xl p-5"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)',
                boxShadow: isDark
                  ? `0 12px 40px ${accentColor.color}25`
                  : `0 12px 40px ${accentColor.color}18`,
              }}
            >
              <Store className="h-12 w-12" style={{ color: accentColor.color }} strokeWidth={2} />
            </div>

            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
              Seller Panel
            </h1>
            <p
              className="mt-2 max-w-sm text-base leading-relaxed"
              style={{ color: isDark ? 'rgba(255,255,255,0.68)' : 'rgba(15,23,42,0.65)' }}
            >
              Do&apos;kon buyurtmalari, mahsulotlar va savdo statistikasi — bitta panelda.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3">
            {[
              { icon: ShoppingBag, label: 'Buyurtmalar' },
              { icon: Package, label: 'Mahsulotlar' },
              { icon: TrendingUp, label: 'Statistika' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-2xl px-3 py-3 text-center"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <Icon className="mx-auto mb-1.5 h-5 w-5" style={{ color: accentColor.color }} />
                <p className="text-xs font-semibold" style={{ color: isDark ? 'rgba(255,255,255,0.75)' : '#475569' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </aside>

        {/* Forma */}
        <main
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
          style={{
            paddingBottom: keyboardOpen ? 'calc(0.75rem + var(--kb-inset, 0px))' : undefined,
          }}
        >
          <div
            className={`mx-auto flex w-full max-w-lg flex-col px-4 sm:px-8 lg:max-w-md lg:px-10 lg:py-10 xl:px-14 ${
              keyboardOpen ? 'py-3' : 'py-4 sm:py-6 lg:justify-center lg:py-12'
            }`}
          >
            <div className={`mb-4 sm:mb-5 lg:mb-8 ${keyboardOpen ? 'hidden' : ''}`}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accentColor.color }}>
                Kirish
              </p>
              <h2 className="mt-0.5 text-lg font-bold sm:text-xl lg:text-2xl" style={{ color: isDark ? '#fff' : '#111827' }}>
                Do&apos;kon paneliga kirish
              </h2>
              <p className="mt-1 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                Login va parolni filialdan olishingiz mumkin
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Login
                </label>
                <div className="relative">
                  <User
                    className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                    style={{ color: accentColor.color }}
                  />
                  <input
                    ref={loginInputRef}
                    type="text"
                    value={formData.login}
                    onChange={(e) => setFormData((prev) => ({ ...prev, login: e.target.value }))}
                    onFocus={() => handleFieldFocus(loginInputRef.current)}
                    className="w-full rounded-2xl border py-3 pl-12 pr-4 outline-none transition-all focus:ring-2 sm:py-3.5"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="Loginingizni kiriting"
                    disabled={isLoading}
                    autoComplete="username"
                    enterKeyHint="next"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Parol
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                    style={{ color: accentColor.color }}
                  />
                  <input
                    ref={passwordInputRef}
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    onFocus={() => handleFieldFocus(passwordInputRef.current)}
                    className="w-full rounded-2xl border py-3 pl-12 pr-4 outline-none transition-all focus:ring-2 sm:py-3.5"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="Parolingizni kiriting"
                    disabled={isLoading}
                    autoComplete="current-password"
                    enterKeyHint="done"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 sm:py-4"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                  boxShadow: `0 12px 32px ${accentColor.color}45`,
                }}
              >
                {isLoading && <Loader2 className="h-6 w-6 shrink-0 animate-spin" />}
                {isLoading ? 'Kutilmoqda…' : 'Kirish'}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
