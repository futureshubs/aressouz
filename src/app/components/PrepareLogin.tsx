// Preparer Login Page
// Tayyorlovchi kirish sahifasi

import { useState } from 'react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { User, Lock, LogIn } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface PrepareLoginProps {
  onLogin: (token: string, preparer: any) => void;
}

export default function PrepareLogin({ onLogin }: PrepareLoginProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111827';
  const mutedTextColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!login || !password) {
      toast.error('Login va parolni kiriting');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/preparers/login`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ login, password }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Xush kelibsiz, ${data.preparer.name}!`);
        onLogin(data.token, data.preparer);
      } else {
        toast.error(data.error || 'Login yoki parol noto\'g\'ri');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Kirishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 app-safe-pt"
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)'
          : 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)',
        color: textColor,
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-8 border"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(20px)',
          color: textColor,
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center"
            style={{
              background: accentColor.gradient,
            }}
          >
            <User className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Tayyorlovchi Paneli</h1>
          <p style={{ color: mutedTextColor }}>
            Tizimga kirish uchun ma'lumotlarni kiriting
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Login */}
          <div>
            <label className="block text-sm font-medium mb-2">Login</label>
            <div className="relative">
              <User 
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" 
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} 
              />
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Loginingizni kiriting"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: textColor,
                }}
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-2">Parol</label>
            <div className="relative">
              <Lock 
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" 
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} 
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Parolingizni kiriting"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: textColor,
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            style={{
              background: accentColor.gradient,
              color: '#ffffff',
            }}
          >
            <div className="flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Tekshirilmoqda...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Kirish</span>
                </>
              )}
            </div>
          </button>
        </form>

        {/* Info */}
        <div
          className="mt-6 p-4 rounded-2xl text-sm text-center"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <p style={{ color: mutedTextColor }}>
            Login va parol uchun admin bilan bog'laning
          </p>
        </div>
      </div>
    </div>
  );
}
