import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { Lock, User, Loader2 } from 'lucide-react';
import PanelLoginShell from '../components/brand/PanelLoginShell';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

export default function RestaurantLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('restaurantSession');
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { id?: string };
      if (data?.id) {
        const targetPath = location.pathname.includes('/taom') ? '/taom/panel' : '/restaurant/panel';
        navigate(targetPath, { replace: true });
      }
    } catch {
      /* ignore */
    }
  }, [navigate, location.pathname]);

  useVisibilityRefetch(() => {
    const session = localStorage.getItem('restaurantSession');
    if (session) {
      const targetPath = location.pathname.includes('/taom') ? '/taom/panel' : '/restaurant/panel';
      navigate(targetPath);
    }
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!login || !password) {
      toast.error("Barcha maydonlarni to'ldiring!");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ login, password }),
        },
      );

      const result = await response.json();

      if (result.success) {
        localStorage.setItem('restaurantSession', JSON.stringify(result.data));
        toast.success('Muvaffaqiyatli kirdingiz!');

        const targetPath = location.pathname.includes('/taom') ? '/taom/panel' : '/restaurant/panel';
        navigate(targetPath);
      } else {
        toast.error(result.error || 'Login yoki parol xato!');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Xatolik yuz berdi!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PanelLoginShell
      variant="taom"
      isDark={isDark}
      accentColor={accentColor.color}
      subtitle="Tizimga kirish"
      keyboardSafe
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label
            className="flex text-sm font-bold mb-2 items-center gap-2"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            <User className="w-4 h-4 shrink-0" />
            Login
          </label>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl outline-none ${
              isDark
                ? 'text-white placeholder:text-white/55'
                : 'text-gray-900 placeholder:text-gray-500'
            }`}
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            }}
            placeholder="Loginingizni kiriting"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            className="flex text-sm font-bold mb-2 items-center gap-2"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            <Lock className="w-4 h-4 shrink-0" />
            Parol
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl outline-none ${
              isDark
                ? 'text-white placeholder:text-white/55'
                : 'text-gray-900 placeholder:text-gray-500'
            }`}
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            }}
            placeholder="Parolingizni kiriting"
            required
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          style={{ background: accentColor.color, color: '#ffffff' }}
        >
          {isLoading && <Loader2 className="w-6 h-6 animate-spin shrink-0" />}
          {isLoading ? 'Kutilmoqda...' : 'Kirish'}
        </button>
      </form>
    </PanelLoginShell>
  );
}
