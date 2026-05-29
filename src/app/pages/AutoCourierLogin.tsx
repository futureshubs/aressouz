import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { KeyRound, User, Loader2 } from 'lucide-react';
import PanelLoginShell from '../components/brand/PanelLoginShell';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import {
  API_BASE_URL,
  DEV_API_BASE_URL,
  publicAnonKey,
} from '../../../utils/supabase/info';

export default function AutoCourierLogin() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [formData, setFormData] = useState({ login: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  useEffect(() => {
    try {
      const raw = localStorage.getItem('autoCourierSession');
      if (!raw) return;
      const s = JSON.parse(raw) as { token?: string; expiresAt?: number };
      const token = String(s?.token || '').trim();
      if (!token) return;
      if (typeof s.expiresAt === 'number' && Date.now() > s.expiresAt) {
        localStorage.removeItem('autoCourierSession');
        return;
      }
      navigate('/avtokuryer/dashboard', { replace: true });
    } catch {
      /* ignore */
    }
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.login.trim() || !formData.password.trim()) {
      toast.error('Login va parol majburiy');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${baseUrl}/auto-courier/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          login: formData.login.trim(),
          password: formData.password.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(result.error || 'Kirishda xatolik');
        return;
      }
      localStorage.setItem(
        'autoCourierSession',
        JSON.stringify({
          token: result.token,
          courier: result.courier,
          expiresAt: result.expiresAt,
        }),
      );
      navigate('/avtokuryer/dashboard');
    } catch (e) {
      console.error(e);
      toast.error('Serverga ulanishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PanelLoginShell
      variant="avtokuryer"
      isDark={isDark}
      accentColor={accentColor.color}
      subtitle="Katta yuk / ijara yetkazish paneli"
    >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Login</label>
              <div className="relative">
                <User
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                />
                <input
                  type="text"
                  autoComplete="username"
                  value={formData.login}
                  onChange={(e) => setFormData((p) => ({ ...p, login: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 rounded-2xl outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
                  }}
                  placeholder="Login"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Parol</label>
              <div className="relative">
                <KeyRound
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 rounded-2xl outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
                  }}
                  placeholder="Parol"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl font-semibold transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: accentColor.color, color: '#fff' }}
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
              {isLoading ? 'Kutilmoqda…' : 'Kirish'}
            </button>
          </form>
    </PanelLoginShell>
  );
}
