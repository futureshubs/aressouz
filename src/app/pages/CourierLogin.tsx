import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Bike, KeyRound, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../utils/supabase/info';
import { getStoredCourierToken } from '../utils/requestAuth';

export default function CourierLogin() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111827';

  const [formData, setFormData] = useState({
    login: '',
    pin: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (getStoredCourierToken()) {
      navigate('/kuryer/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.login.trim() || !formData.pin.trim()) {
      toast.error('Login va PIN majburiy');
      return;
    }

    setIsLoading(true);

    try {
      const form = new URLSearchParams();
      form.set('login', formData.login);
      form.set('pin', formData.pin);

      const baseUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
        ? DEV_API_BASE_URL
        : API_BASE_URL;
      const response = await fetch(
        `${baseUrl}/courier/login`,
        {
          method: 'POST',
          // Avoid CORS preflight: don't send custom headers / JSON content-type
          body: form,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error || 'Kirishda xatolik');
        return;
      }

      localStorage.setItem('courierSession', JSON.stringify(result.session));
      navigate('/kuryer/dashboard');
    } catch (error) {
      console.error('Courier login error:', error);
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
              <Bike className="w-12 h-12" style={{ color: accentColor.color }} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Kuryer Panel</h1>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Kuryer hisobiga kirish
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
                  value={formData.login}
                  onChange={(e) => setFormData((prev) => ({ ...prev, login: e.target.value }))}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: textColor,
                  }}
                  placeholder="kuryer_login"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">PIN</label>
              <div className="relative">
                <KeyRound
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                />
                <input
                  type="password"
                  inputMode="numeric"
                  value={formData.pin}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pin: e.target.value }))}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: textColor,
                  }}
                  placeholder="1234"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl font-semibold transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                background: accentColor.gradient,
                color: '#ffffff',
              }}
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
              {isLoading ? 'Kirilmoqda...' : 'Kirish'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
