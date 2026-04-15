import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { KeyRound, Lock, User, ArrowLeft, Loader2 } from 'lucide-react';
import {
  API_BASE_URL,
  DEV_API_BASE_URL,
  publicAnonKey,
} from '../../../utils/supabase/info';
import { toast } from 'sonner';

export default function RentalProviderLogin() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('rentalProviderSession');
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as { token?: string; branchId?: string };
      if (p?.token && p?.branchId) {
        navigate('/ijara-panel/dashboard', { replace: true });
      }
    } catch {
      /* ignore */
    }
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      toast.error('Login va parol majburiy');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/rentals/provider/login`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ login: login.trim(), password }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.token) {
        localStorage.setItem(
          'rentalProviderSession',
          JSON.stringify({
            token: data.token,
            branchId: data.branchId,
            providerId: data.provider?.id,
            displayName: data.provider?.displayName,
            login: data.provider?.login,
          }),
        );
        toast.success('Xush kelibsiz!');
        navigate('/ijara-panel/dashboard');
      } else {
        toast.error(data.error || 'Kirishda xatolik');
      }
    } catch {
      toast.error('Serverga ulanishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 app-safe-pt"
      style={{ background: isDark ? '#000000' : '#f9fafb' }}
    >
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-sm opacity-70 hover:opacity-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Bosh sahifa
        </button>

        <div
          className="rounded-3xl p-8 border"
          style={{
            background: isDark ? '#141414' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: `${accentColor.color}25` }}
            >
              <KeyRound className="w-8 h-8" style={{ color: accentColor.color }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-1">Ijara beruvchi paneli</h1>
          <p
            className="text-sm text-center mb-8"
            style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}
          >
            Filial bergan login va parol bilan kiring
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Login</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl outline-none"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  }}
                  placeholder="Login"
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Parol</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl outline-none"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  }}
                  placeholder="Parol"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: accentColor.color }}
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
              {loading ? 'Kirilmoqda…' : 'Kirish'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
