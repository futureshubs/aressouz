import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { Shield, Lock, ChevronRight, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '../../../utils/supabase/info';
import { buildPublicHeaders } from '../utils/requestAuth';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [step, setStep] = useState<'code' | 'setup' | 'otp'>('code');
  const [adminCode, setAdminCode] = useState('');
  const [otp, setOtp] = useState('');
  const [secretBase32, setSecretBase32] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('adminSession');
    if (session) {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  useVisibilityRefetch(() => {
    const session = localStorage.getItem('adminSession');
    if (session) {
      navigate('/admin/dashboard');
    }
  });

  const statusEndpoint = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/admin/2fa/status`;
  const setupEndpoint = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/admin/2fa/setup`;
  const enableEndpoint = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/admin/2fa/enable`;
  const verifyEndpoint = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/admin/2fa/verify`;

  const handleAdminCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSecretBase32('');
    setOtpauthUrl('');
    setOtp('');

    try {
      const code = adminCode.trim();
      if (!code) {
        setError('Admin code kiriting');
        return;
      }

      const resp = await fetch(statusEndpoint, {
        headers: buildPublicHeaders({
          'Content-Type': 'application/json',
          'X-Admin-Code': code,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        setError(data?.error || 'Admin code noto‘g‘ri');
        return;
      }

      if (data.enabled) {
        setStep('otp');
      } else {
        const setupResp = await fetch(setupEndpoint, {
          method: 'POST',
          headers: buildPublicHeaders({
            'Content-Type': 'application/json',
            'X-Admin-Code': code,
          }),
        });
        const setupData = await setupResp.json().catch(() => ({}));
        if (!setupResp.ok || !setupData?.success) {
          setError(setupData?.error || '2FA setup xatoligi');
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
      const code = adminCode.trim();
      const token = otp.trim();
      const resp = await fetch(enableEndpoint, {
        method: 'POST',
        headers: buildPublicHeaders({
          'Content-Type': 'application/json',
          'X-Admin-Code': code,
        }),
        body: JSON.stringify({ token }),
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const code = adminCode.trim();
      const token = otp.trim();
      const resp = await fetch(verifyEndpoint, {
        method: 'POST',
        headers: buildPublicHeaders({
          'Content-Type': 'application/json',
          'X-Admin-Code': code,
        }),
        body: JSON.stringify({ token }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        setError(data?.error || 'Kod noto‘g‘ri');
        return;
      }

      localStorage.setItem(
        'adminSession',
        JSON.stringify({
          role: 'admin',
          code,
          loginTime: new Date().toISOString(),
        })
      );
      navigate('/admin/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ 
        background: isDark 
          ? 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)'
          : 'linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)'
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo & Title */}
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
          <h1 
            className="text-3xl font-bold mb-2"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Admin Panel
          </h1>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            {step === 'code' ? 'Admin code bilan kirish' : step === 'setup' ? '2FA sozlash' : '2FA kod'}
          </p>
        </div>

        {/* Login Form */}
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
          {step === 'code' ? (
            <form onSubmit={handleAdminCode} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Admin code
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                  />
                  <input
                    type="password"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    placeholder="••••"
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                </div>
              </div>

              {error && (
                <div 
                  className="p-4 rounded-2xl border"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#ef4444'
                  }}
                >
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                  boxShadow: `0 8px 24px ${accentColor.color}40`,
                }}
              >
                {loading ? 'Tekshirilmoqda...' : 'Davom etish'}
                {!loading && <ChevronRight className="w-5 h-5" />}
              </button>
            </form>
          ) : step === 'setup' ? (
            <form onSubmit={handleEnable2fa} className="space-y-6">
              <div className="space-y-2">
                <div className="text-sm" style={{ opacity: 0.75 }}>
                  Authenticator ilovaga secret ni qo‘shing (manual).
                </div>
                <div
                  className="p-4 rounded-2xl border flex items-center justify-between gap-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div className="text-xs break-all" style={{ opacity: 0.85 }}>
                    {secretBase32}
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded-xl border"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#fff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.1)',
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
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  2FA kod (6 raqam)
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                  />
                  <input
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                </div>
              </div>

              {error && (
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
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('code')}
                  className="flex-1 py-3.5 rounded-2xl font-semibold border transition-all active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
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
                    color: '#ffffff',
                    boxShadow: `0 8px 24px ${accentColor.color}40`,
                  }}
                >
                  {loading ? 'Yuklanmoqda...' : '2FA yoqish'}
                  {!loading && <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  2FA kod (6 raqam)
                </label>
                <div className="relative">
                  <Lock 
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                  />
                  <input
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                </div>
              </div>

              {error && (
                <div 
                  className="p-4 rounded-2xl border"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#ef4444'
                  }}
                >
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('code')}
                  className="flex-1 py-3.5 rounded-2xl font-semibold border transition-all active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
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
                    color: '#ffffff',
                    boxShadow: `0 8px 24px ${accentColor.color}40`,
                  }}
                >
                  {loading ? 'Tekshirilmoqda...' : 'Kirish'}
                  {!loading && <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Steps Indicator */}
        <div className="flex justify-center gap-2 mt-6">
          <div 
            className="h-2 w-16 rounded-full transition-all"
            style={{ 
              background: step === 'code' ? accentColor.gradient : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
            }}
          />
          <div 
            className="h-2 w-16 rounded-full transition-all"
            style={{ 
              background: step !== 'code' ? accentColor.gradient : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
            }}
          />
        </div>
      </div>
    </div>
  );
}
