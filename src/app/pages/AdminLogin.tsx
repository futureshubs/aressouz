import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { Shield, Lock, ChevronRight, Copy, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '../../../utils/supabase/info';
import { buildAdminLoginHeaders } from '../utils/requestAuth';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

export default function AdminLogin() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [step, setStep] = useState<'credentials' | 'setup' | 'otp'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secondaryCode, setSecondaryCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [otp, setOtp] = useState('');
  const [secretBase32, setSecretBase32] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('adminSession');
      if (!raw) return;
      const s = JSON.parse(raw) as { sessionToken?: string; role?: string };
      if (s?.role === 'admin' && s?.sessionToken) {
        navigate('/admin/dashboard');
        return;
      }
      if (s?.role === 'admin' && !s?.sessionToken) {
        localStorage.removeItem('adminSession');
      }
    } catch {
      localStorage.removeItem('adminSession');
    }
  }, [navigate]);

  useVisibilityRefetch(() => {
    try {
      const raw = localStorage.getItem('adminSession');
      if (!raw) return;
      const s = JSON.parse(raw) as { sessionToken?: string; role?: string };
      if (s?.role === 'admin' && s?.sessionToken) {
        navigate('/admin/dashboard');
      }
    } catch {
      /* ignore */
    }
  });

  const loginHeaders = () => buildAdminLoginHeaders({ 'Content-Type': 'application/json' });
  const tempHeaders = () =>
    buildAdminLoginHeaders({
      'Content-Type': 'application/json',
      'X-Admin-Login-Token': tempToken,
    });

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSecretBase32('');
    setOtpauthUrl('');
    setOtp('');

    try {
      const resp = await fetch(`${baseUrl}/admin/auth/credentials`, {
        method: 'POST',
        headers: loginHeaders(),
        body: JSON.stringify({
          username: username.trim(),
          password,
          secondaryCode: secondaryCode.trim(),
        }),
      });
      const data = await resp.json().catch(() => ({}));

      if (resp.status === 429) {
        const until = data?.blockedUntil
          ? new Date(data.blockedUntil).toLocaleString('uz-UZ')
          : '';
        setError(until ? `Bloklangan. Qayta urinish: ${until}` : (data?.error || 'Bloklangan'));
        return;
      }

      if (!resp.ok || !data?.success) {
        setError(data?.error || 'Kirish maʼlumotlari noto‘g‘ri');
        return;
      }

      const t = String(data.tempToken || '');
      setTempToken(t);
      if (data.twoFaEnabled) {
        setStep('otp');
      } else {
        const setupResp = await fetch(`${baseUrl}/admin/2fa/setup`, {
          method: 'POST',
          headers: buildAdminLoginHeaders({
            'Content-Type': 'application/json',
            'X-Admin-Login-Token': t,
          }),
        });
        const setupData = await setupResp.json().catch(() => ({}));
        if (!setupResp.ok || !setupData?.success) {
          setError(setupData?.error || '2FA sozlash xatoligi');
          setTempToken('');
          return;
        }
        setSecretBase32(String(setupData.secretBase32 || ''));
        setOtpauthUrl(String(setupData.otpauthUrl || ''));
        setStep('setup');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await fetch(`${baseUrl}/admin/2fa/enable`, {
        method: 'POST',
        headers: tempHeaders(),
        body: JSON.stringify({ token: otp.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        setError(data?.error || '2FA yoqilmadi');
        return;
      }
      toast.success('2FA yoqildi. Endi kod bilan kirasiz.');
      setOtp('');
      setStep('otp');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await fetch(`${baseUrl}/admin/auth/finish`, {
        method: 'POST',
        headers: loginHeaders(),
        body: JSON.stringify({
          tempToken,
          token: otp.trim(),
        }),
      });
      const data = await resp.json().catch(() => ({}));

      if (resp.status === 429) {
        const until = data?.blockedUntil
          ? new Date(data.blockedUntil).toLocaleString('uz-UZ')
          : '';
        setError(until ? `Bloklangan. ${until}` : (data?.error || 'Bloklangan'));
        return;
      }

      if (!resp.ok || !data?.success) {
        setError(data?.error || 'Kod noto‘g‘ri');
        return;
      }

      localStorage.setItem(
        'adminSession',
        JSON.stringify({
          role: 'admin',
          sessionToken: String(data.sessionToken || ''),
          loginTime: new Date().toISOString(),
        }),
      );
      navigate('/admin/dashboard');
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
            <Shield className="w-12 h-12" style={{ color: accentColor.color }} />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
            Admin Panel
          </h1>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            {step === 'credentials'
              ? 'Login, parol va maxfiy kod'
              : step === 'setup'
                ? '2FA sozlash'
                : 'Authenticator kodi'}
          </p>
        </div>

        <div
          className="rounded-3xl p-8 border"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            boxShadow: isDark
              ? '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : '0 20px 60px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
        >
          {step === 'credentials' ? (
            <form onSubmit={handleCredentials} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#fff' : '#111' }}>
                  Login
                </label>
                <div className="relative">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}
                  />
                  <input
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ali"
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      color: isDark ? '#fff' : '#111',
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#fff' : '#111' }}>
                  Parol
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}
                  />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••"
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      color: isDark ? '#fff' : '#111',
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#fff' : '#111' }}>
                  Maxfiy kod (panel)
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    value={secondaryCode}
                    onChange={(e) => setSecondaryCode(e.target.value)}
                    placeholder="Boshlang‘ich: 0099"
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      color: isDark ? '#fff' : '#111',
                    }}
                  />
                </div>
                <p className="text-xs mt-2" style={{ opacity: 0.55 }}>
                  Login va parol o‘zgarmaydi. Maxfiy kodni panelda «Xavfsizlik» bo‘limidan almashtirasiz.
                </p>
              </div>

              {error ? (
                <div
                  className="p-4 rounded-2xl border"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                  }}
                >
                  <p className="text-sm">{error}</p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                  boxShadow: `0 8px 24px ${accentColor.color}40`,
                }}
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                {loading ? 'Tekshirilmoqda...' : 'Davom etish'}
                {!loading && <ChevronRight className="w-5 h-5 shrink-0" />}
              </button>
            </form>
          ) : step === 'setup' ? (
            <form onSubmit={handleEnable2fa} className="space-y-6">
              <div className="space-y-2">
                <div className="text-sm" style={{ opacity: 0.75 }}>
                  Authenticator ilovaga secret qo‘shing.
                </div>
                <div
                  className="p-4 rounded-2xl border flex items-center justify-between gap-3"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }}
                >
                  <div className="text-xs break-all" style={{ opacity: 0.85 }}>
                    {secretBase32}
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded-xl border"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    }}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(secretBase32);
                        toast.success('Secret nusxalandi');
                      } catch {
                        toast.error('Nusxalab bo‘lmadi');
                      }
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {otpauthUrl ? (
                  <div className="text-xs break-all" style={{ opacity: 0.6 }}>
                    {otpauthUrl}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#fff' : '#111' }}>
                  2FA kod (6 raqam)
                </label>
                <input
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full px-4 py-3.5 rounded-2xl border outline-none transition-all"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    color: isDark ? '#fff' : '#111',
                  }}
                />
              </div>

              {error ? (
                <div
                  className="p-4 rounded-2xl border"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                  }}
                >
                  <p className="text-sm">{error}</p>
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setTempToken('');
                  }}
                  className="flex-1 py-3.5 rounded-2xl font-semibold border transition-all active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    color: isDark ? '#fff' : '#111',
                  }}
                >
                  Orqaga
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: accentColor.gradient,
                    color: '#fff',
                    boxShadow: `0 8px 24px ${accentColor.color}40`,
                  }}
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                  {loading ? '' : '2FA yoqish'}
                  {!loading && <ChevronRight className="w-5 h-5 shrink-0" />}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleFinish} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#fff' : '#111' }}>
                  Authenticator kodi (6 raqam)
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}
                  />
                  <input
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      color: isDark ? '#fff' : '#111',
                    }}
                  />
                </div>
              </div>

              {error ? (
                <div
                  className="p-4 rounded-2xl border"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                  }}
                >
                  <p className="text-sm">{error}</p>
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setTempToken('');
                    setOtp('');
                  }}
                  className="flex-1 py-3.5 rounded-2xl font-semibold border transition-all active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    color: isDark ? '#fff' : '#111',
                  }}
                >
                  Orqaga
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: accentColor.gradient,
                    color: '#fff',
                    boxShadow: `0 8px 24px ${accentColor.color}40`,
                  }}
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                  {loading ? 'Tekshirilmoqda...' : 'Kirish'}
                  {!loading && <ChevronRight className="w-5 h-5 shrink-0" />}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="flex justify-center gap-2 mt-6">
          <div
            className="h-2 w-16 rounded-full transition-all"
            style={{
              background:
                step === 'credentials'
                  ? accentColor.gradient
                  : isDark
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.1)',
            }}
          />
          <div
            className="h-2 w-16 rounded-full transition-all"
            style={{
              background:
                step !== 'credentials'
                  ? accentColor.gradient
                  : isDark
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.1)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
