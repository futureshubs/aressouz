import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { Utensils, Lock, User, Loader2 } from 'lucide-react';
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
      toast.error('Barcha maydonlarni to\'ldiring!');
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
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ login, password })
        }
      );

      const result = await response.json();
      
      if (result.success) {
        localStorage.setItem('restaurantSession', JSON.stringify(result.data));
        toast.success('Muvaffaqiyatli kirdingiz! 🎉');
        
        // Navigate based on current path
        const targetPath = location.pathname.includes('/taom') 
          ? '/taom/panel' 
          : '/restaurant/panel';
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
    <div 
      className="min-h-screen flex items-center justify-center p-4 app-safe-pt"
      style={{ background: isDark ? '#000000' : '#f9fafb' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div 
            className="inline-flex p-6 rounded-3xl mb-4"
            style={{ background: `${accentColor.color}20` }}
          >
            <Utensils className="w-12 h-12" style={{ color: accentColor.color }} />
          </div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Restoran Paneli
          </h1>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Tizimga kirish
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div
            className="p-8 rounded-3xl"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
            }}
          >
            <div className="space-y-4">
              {/* Login */}
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
                  className={`w-full px-4 py-3 rounded-xl ${
                    isDark
                      ? 'text-white placeholder:text-white/55'
                      : 'text-gray-900 placeholder:text-gray-500'
                  }`}
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="Loginingizni kiriting"
                  required
                />
              </div>

              {/* Password */}
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
                  className={`w-full px-4 py-3 rounded-xl ${
                    isDark
                      ? 'text-white placeholder:text-white/55'
                      : 'text-gray-900 placeholder:text-gray-500'
                  }`}
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="Parolingizni kiriting"
                  required
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: accentColor.color, color: '#ffffff' }}
          >
            {isLoading && <Loader2 className="w-6 h-6 animate-spin shrink-0" />}
            {isLoading ? '' : 'Kirish'}
          </button>

          {/* Back to Home */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-xl font-medium"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            Bosh sahifaga qaytish
          </button>
        </form>
      </div>
    </div>
  );
}