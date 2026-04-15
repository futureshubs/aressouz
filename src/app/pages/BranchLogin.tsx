import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { Building2, User, Lock, Key, ChevronRight, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL, DEV_API_BASE_URL, publicAnonKey } from '../../../utils/supabase/info';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

const getBranchSessionUrl = () => {
  const baseUrl =
    (typeof window !== 'undefined' && window.location.hostname === 'localhost')
      ? DEV_API_BASE_URL
      : API_BASE_URL;
  return `${baseUrl}/branch/session`;
};

export default function BranchLogin() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [loading, setLoading] = useState(false);
  /** ISO: 2FA noto‘g‘ri urinishlar bloklanguncha */
  const [twoFactorLockedUntil, setTwoFactorLockedUntil] = useState<string | null>(null);

  useEffect(() => {
    if (!twoFactorLockedUntil) return;
    const until = new Date(twoFactorLockedUntil).getTime();
    if (!Number.isFinite(until)) return;
    const tick = () => {
      if (Date.now() >= until) setTwoFactorLockedUntil(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [twoFactorLockedUntil]);

  const redirectIfBranchSession = useCallback(() => {
    const session = localStorage.getItem('branchSession');
    if (session) {
      navigate('/filyal/dashboard', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    redirectIfBranchSession();
  }, [redirectIfBranchSession]);

  useVisibilityRefetch(() => {
    redirectIfBranchSession();
  });

  const completeBranchLogin = (branch: any, token: string) => {
    localStorage.setItem(
      'branchSession',
      JSON.stringify({
        id: branch.id,
        branchName: branch.name || branch.branchName,
        login: branch.login,
        region: branch.regionName || branch.region || '',
        district: branch.districtName || branch.district || '',
        phone: branch.phone || '',
        managerName: branch.managerName || 'Manager',
        coordinates: branch.coordinates || { lat: 0, lng: 0 },
        openDate: branch.openDate || branch.createdAt || '',
        token,
      }),
    );

    toast.success('Muvaffaqiyatli kirildi!');
    navigate('/filyal/dashboard');
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Legacy branch login (login/password) -> branch session token
      const response = await fetch(getBranchSessionUrl(), {
        method: 'POST',
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ login, password }),
      });

      const data = await response.json();

      if (data?.needsTwoFactor) {
        if (data.lockout && data.twoFactorLockedUntil) {
          setTwoFactorLockedUntil(String(data.twoFactorLockedUntil));
          toast.error(
            data.twoFactorLockoutMessage ||
              '2FA urinishlari bloklangan. Keyinroq qayta urinib ko‘ring.',
          );
          return;
        }
        setTwoFactorLockedUntil(null);
        setStep('2fa');
        toast.info('Google Authenticator kodini kiriting (6 raqam) yoki backup kod');
        return;
      }

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Login yoki parol noto‘g‘ri');
        return;
      }

      completeBranchLogin(data.branch, data.token);
    } catch (error) {
      console.error('Branch login error:', error);
      toast.error('Kirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(getBranchSessionUrl(), {
        method: 'POST',
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login,
          password,
          twoFactorToken: twoFactorCode,
        }),
      });

      const data = await response.json();

      if (response.status === 423 || (data.lockout && data.lockedUntil)) {
        setTwoFactorLockedUntil(String(data.lockedUntil));
        setStep('credentials');
        setTwoFactorCode('');
        toast.error(data.error || '2FA bloklangan');
        return;
      }

      if (!response.ok || !data.success) {
        const left =
          typeof data.attemptsRemaining === 'number' ? data.attemptsRemaining : null;
        const extra =
          left != null && left > 0
            ? ` Yana ${left} marta noto‘g‘ri kirsangiz vaqtincha bloklanasiz.`
            : '';
        toast.error((data.error || 'Kod noto‘g‘ri. Qaytadan urinib ko‘ring.') + extra);
        setTwoFactorCode('');
        if (data.lockout && data.lockedUntil) {
          setTwoFactorLockedUntil(String(data.lockedUntil));
          setStep('credentials');
        }
        return;
      }

      setTwoFactorLockedUntil(null);
      toast.success('2FA kod tasdiqlandi!');
      completeBranchLogin(data.branch, data.token);
    } catch (error) {
      console.error('Branch 2FA error:', error);
      toast.error('2FA tekshirishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 app-safe-pt"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)'
          : 'linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)',
      }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex p-4 rounded-3xl mb-4"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(20, 184, 166, 0.1), rgba(20, 184, 166, 0.05))'
                : 'linear-gradient(145deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.08))',
              boxShadow: isDark
                ? '0 8px 32px rgba(20, 184, 166, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                : '0 8px 32px rgba(20, 184, 166, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
            }}
          >
            {step === 'credentials' ? (
              <Building2 className="w-12 h-12" style={{ color: accentColor.color }} />
            ) : (
              <Shield className="w-12 h-12" style={{ color: accentColor.color }} />
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
            {step === 'credentials' ? 'Filial Panel' : '2FA Tasdiqlash'}
          </h1>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            {step === 'credentials' ? 'Filial hisobiga kirish' : 'Google Authenticator kodini kiriting'}
          </p>
        </div>

        <div
          className="rounded-3xl border p-8"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.08)',
          }}
        >
          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Login
                </label>
                <div className="relative">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: accentColor.color }}
                  />
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f9fafb',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="Filial logini"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Parol
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: accentColor.color }}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f9fafb',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {twoFactorLockedUntil && Date.now() < new Date(twoFactorLockedUntil).getTime() && (
                <p
                  className="text-sm rounded-2xl px-4 py-3 border"
                  style={{
                    color: isDark ? '#fca5a5' : '#b91c1c',
                    borderColor: isDark ? 'rgba(248,113,113,0.35)' : 'rgba(185,28,28,0.25)',
                    background: isDark ? 'rgba(127,29,29,0.25)' : 'rgba(254,226,226,0.9)',
                  }}
                >
                  2FA bloklangan. Qayta kirish:{' '}
                  {new Date(twoFactorLockedUntil).toLocaleString('uz-UZ', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  (!!twoFactorLockedUntil &&
                    Date.now() < new Date(twoFactorLockedUntil).getTime())
                }
                className="w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                }}
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                {loading ? 'Kutilmoqda...' : 'Kirish'}
                {!loading && <ChevronRight className="w-5 h-5 shrink-0" />}
              </button>
            </form>
          ) : (
            <form onSubmit={handle2FASubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Authenticator (6 raqam) yoki backup kod
                </label>
                <p className="text-xs mb-2" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                  Google Authenticator / Microsoft Authenticator. 3 marta noto‘g‘ri: 1 kun blok; keyin yana 3 marta: 1
                  hafta; yana: uzoq muddat.
                </p>
                <div className="relative">
                  <Key
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: accentColor.color }}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border outline-none transition-all tracking-widest"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f9fafb',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="000000"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setTwoFactorCode('');
                  }}
                  className="flex-1 py-4 rounded-2xl font-semibold border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                >
                  Orqaga
                </button>
                <button
                  type="submit"
                  disabled={
                    loading ||
                    (!!twoFactorLockedUntil &&
                      Date.now() < new Date(twoFactorLockedUntil).getTime())
                  }
                  className="flex-1 py-4 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    background: accentColor.gradient,
                    color: '#ffffff',
                  }}
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                  {loading ? 'Kutilmoqda...' : 'Tasdiqlash'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
