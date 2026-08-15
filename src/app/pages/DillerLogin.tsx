import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Lock, User, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import PanelLoginShell from '../components/brand/PanelLoginShell';
import { dillerApiLogin } from '../utils/dillerApi';
import { clearLegacyDillerLocalData } from '../utils/dillerData';
import { saveDillerCloudCreds } from '../utils/dillerSyncMeta';
import { readDillerSession, saveDillerSession } from '../utils/dillerSession';
import { iosAccentFillStyle } from '../components/diller/dillerIosGlass';

export default function DillerLogin() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (readDillerSession()) {
      navigate('/diller/dashboard', { replace: true });
      return;
    }
    clearLegacyDillerLocalData();
    setReady(true);
  }, [navigate]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!login.trim() || !password) {
        toast.error('Login va parol kiriting');
        return;
      }

      setLoading(true);
      const result = await dillerApiLogin(login.trim(), password);
      setLoading(false);

      if (!result.ok) {
        toast.error(
          result.error === 'NETWORK_ERROR'
            ? 'Internet yo‘q — keyinroq urinib ko‘ring'
            : result.error || 'Login yoki parol noto‘g‘ri',
        );
        return;
      }

      if (!result.dealerId) {
        toast.error('Server javobi noto‘g‘ri — admin bilan bog‘laning');
        return;
      }

      saveDillerCloudCreds({ login: login.trim(), password });
      saveDillerSession({
        token: result.token,
        dealerId: result.dealerId,
        login: result.login,
        displayName: result.displayName,
        loggedInAt: new Date().toISOString(),
      });

      toast.success('Xush kelibsiz — net bo‘lsa Yuklash / Yuborish ishlaydi');
      navigate('/diller/dashboard', { replace: true });
    },
    [login, password, navigate],
  );

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
      </div>
    );
  }

  return (
    <PanelLoginShell
      variant="seller"
      subtitle="Diller panel — admin tomonidan berilgan login bilan kiring"
      backTo="/"
      isDark={isDark}
      accentColor={accentColor.color}
      keyboardSafe
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 opacity-80">Login</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
            <input
              type="text"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Admin bergan login"
              className="w-full pl-10 pr-4 py-3 rounded-xl border outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
                color: isDark ? '#fff' : '#111',
              }}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 opacity-80">Parol</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-3 rounded-xl border outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
                color: isDark ? '#fff' : '#111',
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Kirish
        </button>
      </form>
    </PanelLoginShell>
  );
}
