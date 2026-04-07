import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Car, KeyRound, User } from 'lucide-react';
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
  const textColor = isDark ? '#ffffff' : '#111827';

  const [formData, setFormData] = useState({ login: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  useEffect(() => {
    localStorage.removeItem('autoCourierSession');
  }, []);

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
    <div
      className="min-h-screen flex items-center justify-center p-4 app-safe-pt"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
        color: textColor,
      }}
    >
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Ortga
        </button>

        <div
          className="rounded-3xl p-8 border"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            boxShadow: isDark
              ? '0 25px 50px rgba(0, 0, 0, 0.5)'
              : '0 25px 50px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="text-center mb-8">
            <div
              className="inline-flex p-5 rounded-3xl mb-4"
              style={{ background: `${accentColor.color}20` }}
            >
              <Car className="w-12 h-12" style={{ color: accentColor.color }} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Avto-kuryer</h1>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Katta yuk / ijara yetkazish paneli
            </p>
          </div>

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
              className="w-full py-3.5 rounded-2xl font-semibold transition-opacity disabled:opacity-50"
              style={{ background: accentColor.color, color: '#fff' }}
            >
              {isLoading ? 'Kutilmoqda…' : 'Kirish'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
