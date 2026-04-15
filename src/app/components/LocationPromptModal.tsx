import { MapPin, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface LocationPromptModalProps {
  isOpen: boolean;
  onSelectLocation: () => void;
  onDismiss: () => void;
}

export function LocationPromptModal({ isOpen, onSelectLocation, onDismiss }: LocationPromptModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  const handleSelectLocation = () => {
    console.log('🟣 LocationPromptModal: "Hududni tanlash" bosildi');
    onSelectLocation();
  };

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-[100] flex items-center justify-center p-4"
      style={{
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div 
        className="relative w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.98), rgba(20, 20, 20, 0.95))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(249, 250, 251, 0.95))',
          boxShadow: isDark
            ? `0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1), 0 0 100px ${accentColor.color}40`
            : `0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 0 60px ${accentColor.color}20`,
        }}
      >
        {/* Header with glow */}
        <div 
          className="relative px-6 py-5 border-b"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            background: `linear-gradient(135deg, ${accentColor.color}15, transparent)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="p-2.5 rounded-xl"
                style={{
                  background: `linear-gradient(145deg, ${accentColor.color}33, ${accentColor.color}1a)`,
                  boxShadow: `0 4px 12px ${accentColor.color}40`,
                }}
              >
                <MapPin 
                  className="size-6"
                  style={{ color: accentColor.color }}
                  strokeWidth={2.5}
                />
              </div>
              <h2 
                className="text-xl font-bold"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                Hudud tanlang
              </h2>
            </div>
            <button
              onClick={onDismiss}
              className="p-2 rounded-lg transition-all active:scale-90"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              }}
            >
              <X className="size-5" style={{ color: isDark ? '#ffffff' : '#374151' }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
              style={{
                background: `linear-gradient(145deg, ${accentColor.color}26, ${accentColor.color}13)`,
                boxShadow: `0 8px 24px ${accentColor.color}40, inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              }}
            >
              <MapPin 
                className="size-10"
                style={{ color: accentColor.color }}
                strokeWidth={2}
              />
            </div>
            <p 
              className="text-base font-medium mb-2"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Sizning hududingizni aniqlay olmadik
            </p>
            <p 
              className="text-sm"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
            >
              Yaqin atrofdagi xizmatlarni ko'rsatish uchun hududingizni tanlang
            </p>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSelectLocation}
              className="w-full py-3.5 px-4 rounded-xl font-semibold text-white transition-all active:scale-98"
              style={{
                backgroundImage: accentColor.gradient,
                boxShadow: isDark
                  ? `0 8px 24px ${accentColor.color}66, 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                  : `0 6px 20px ${accentColor.color}4d, 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
              }}
            >
              Hududni tanlash
            </button>

            <button
              onClick={onDismiss}
              className="w-full py-3.5 px-4 rounded-xl font-semibold transition-all active:scale-98"
              style={{
                background: isDark 
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'rgba(0, 0, 0, 0.05)',
                color: isDark ? '#ffffff' : '#374151',
                boxShadow: isDark
                  ? '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  : '0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              }}
            >
              Keyinroq
            </button>
          </div>

          <p 
            className="text-xs text-center mt-4"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
          >
            Keyinroq header'dan ham o'zgartirishingiz mumkin
          </p>
        </div>
      </div>
    </div>
  );
}