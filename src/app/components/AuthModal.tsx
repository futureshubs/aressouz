import { X, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: Platform;
  initialMode?: 'signin' | 'signup';
}

export function AuthModal({ isOpen, onClose, platform, initialMode = 'signin' }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { theme, accentColor } = useTheme();
  const { signin, signup } = useAuth();
  const isIOS = platform === 'ios';
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        await signin(email, password);
      } else {
        if (!name.trim()) {
          setError('Ism kiritilishi shart');
          setIsLoading(false);
          return;
        }
        await signup(email, password, name);
      }
      onClose();
      // Reset form
      setEmail('');
      setPassword('');
      setName('');
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        style={{
          background: isDark 
            ? 'rgba(0, 0, 0, 0.85)' 
            : 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
        }}
      />

      {/* Modal */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.98), rgba(10, 10, 10, 0.98))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
          backdropFilter: 'blur(20px)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark
            ? '0 20px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 20px 60px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        }}
      >
        {/* Header */}
        <div 
          className="relative p-6 pb-4"
          style={{
            borderBottom: isDark 
              ? '1px solid rgba(255, 255, 255, 0.1)' 
              : '1px solid rgba(0, 0, 0, 0.08)',
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl transition-all active:scale-90"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <X className="size-5" style={{ color: isDark ? '#ffffff' : '#111827' }} />
          </button>

          <h2 
            className="text-2xl font-bold"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            {mode === 'signin' ? 'Kirish' : 'Ro\'yxatdan o\'tish'}
          </h2>
          <p 
            className="text-sm mt-1"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            {mode === 'signin' 
              ? 'Hisobingizga kiring' 
              : 'Yangi hisob yarating'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div 
              className="p-4 rounded-xl text-sm"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
              }}
            >
              {error}
            </div>
          )}

          {/* Name Input (only for signup) */}
          {mode === 'signup' && (
            <div>
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                Ism
              </label>
              <div 
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                }}
              >
                <User className="size-5" style={{ color: accentColor.color }} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ismingizni kiriting"
                  required={mode === 'signup'}
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                />
              </div>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Email
            </label>
            <div 
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
              }}
            >
              <Mail className="size-5" style={{ color: accentColor.color }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email manzilingiz"
                required
                className="flex-1 bg-transparent outline-none"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Parol
            </label>
            <div 
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
              }}
            >
              <Lock className="size-5" style={{ color: accentColor.color }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Parolingiz"
                required
                minLength={6}
                className="flex-1 bg-transparent outline-none"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 rounded-lg transition-all active:scale-90"
              >
                {showPassword ? (
                  <EyeOff className="size-5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                ) : (
                  <Eye className="size-5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-xl font-bold text-white transition-all active:scale-98 disabled:opacity-50"
            style={{
              background: accentColor.gradient,
              boxShadow: `0 8px 24px ${accentColor.color}40`,
            }}
          >
            {isLoading 
              ? '' 
              : mode === 'signin' 
                ? 'Kirish' 
                : 'Ro\'yxatdan o\'tish'}
          </button>

          {/* Mode Toggle */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError('');
              }}
              className="text-sm transition-all"
              style={{ color: accentColor.color }}
            >
              {mode === 'signin' 
                ? 'Hisob yo\'qmi? Ro\'yxatdan o\'tish' 
                : 'Hisobingiz bormi? Kirish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
