import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Lock, User, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import PanelLoginShell from '../components/brand/PanelLoginShell';
import {
  DILLER_DEMO_LOGIN,
  DILLER_DEMO_PASSWORD,
  readDillerSession,
  saveDillerSession,
  validateDillerCredentials,
} from '../utils/dillerSession';

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
    setReady(true);
  }, [navigate]);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!login.trim() || !password) {
        toast.error('Login va parol kiriting');
        return;
      }
      setLoading(true);
      window.setTimeout(() => {
        if (!validateDillerCredentials(login.trim(), password)) {
          toast.error('Login yoki parol noto‘g‘ri');
          setLoading(false);
          return;
        }
        saveDillerSession({
          token: `diller_${Date.now()}`,
          login: login.trim(),
          displayName: login.trim(),
          loggedInAt: new Date().toISOString(),
        });
        toast.success('Xush kelibsiz!');
        navigate('/diller/dashboard', { replace: true });
        setLoading(false);
      }, 400);
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
      subtitle="Diller panel — firmadan do‘konlarga tarqatish"
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
              placeholder="Admin"
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

        <p
          className="text-xs rounded-xl px-3 py-2"
          style={{
            background: isDark ? 'rgba(45,212,191,0.1)' : 'rgba(16,185,129,0.08)',
            color: isDark ? 'rgba(167,243,208,0.9)' : '#047857',
          }}
        >
          Demo: login <strong>{DILLER_DEMO_LOGIN}</strong>, parol <strong>{DILLER_DEMO_PASSWORD}</strong>
        </p>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-slate-900 flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: accentColor.gradient }}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Kirish
        </button>
      </form>
    </PanelLoginShell>
  );
}
