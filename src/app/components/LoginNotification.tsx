import { useEffect } from 'react';
import { X, LogIn } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface LoginNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  message?: string;
}

export function LoginNotification({ isOpen, onClose, onLogin, message }: LoginNotificationProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Auto close after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] transition-opacity"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Notification Card */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[101] w-[90%] max-w-md animate-slide-down">
        <div
          className="rounded-3xl p-6 shadow-2xl"
          style={{
            background: isDark 
              ? 'linear-gradient(135deg, rgba(30, 30, 30, 0.98) 0%, rgba(20, 20, 20, 0.98) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 245, 245, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
            boxShadow: isDark
              ? '0 20px 60px rgba(0, 0, 0, 0.5)'
              : '0 20px 60px rgba(0, 0, 0, 0.15)',
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
            }}
          >
            <X 
              className="size-5" 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
            />
          </button>

          {/* Icon */}
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{
              background: `${accentColor.color}20`,
            }}
          >
            <LogIn 
              className="size-8" 
              style={{ color: accentColor.color }}
              strokeWidth={2}
            />
          </div>

          {/* Message */}
          <h3
            className="text-xl font-black text-center mb-2"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Tizimga kirish kerak
          </h3>
          <p
            className="text-center mb-6 text-sm"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            {message || "E'lon qo'shish uchun avval tizimga kirishingiz kerak"}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-bold transition-all active:scale-95"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
              }}
            >
              Keyinroq
            </button>
            <button
              onClick={() => {
                onLogin();
                onClose();
              }}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{
                background: accentColor.color,
                boxShadow: `0 8px 24px ${accentColor.color}66`,
              }}
            >
              <LogIn className="size-5" strokeWidth={2.5} />
              <span>Kirish</span>
            </button>
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
