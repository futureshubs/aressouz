import { Trash2, Edit3, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Place } from '../data/places';

interface PlaceActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  place: Place;
  onEdit: () => void;
  onDelete: () => void;
}

export function PlaceActionModal({ isOpen, onClose, place, onEdit, onDelete }: PlaceActionModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md overflow-hidden"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(25, 25, 25, 0.98), rgba(15, 15, 15, 0.98))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.98))',
          backdropFilter: 'blur(40px)',
          borderRadius: '32px 32px 0 0',
          boxShadow: isDark
            ? '0 -8px 48px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 -8px 48px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b" style={{
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 
                className="text-xl font-bold mb-1"
                style={{ color: isDark ? '#ffffff' : '#000000' }}
              >
                Amallar
              </h2>
              <p 
                className="text-sm line-clamp-1"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                {place.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl transition-all active:scale-90"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              }}
            >
              <X className="size-5" style={{ color: isDark ? '#ffffff' : '#000000' }} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 space-y-3">
          {/* Edit Button */}
          <button
            onClick={onEdit}
            className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <div 
              className="p-3 rounded-xl"
              style={{
                backgroundImage: accentColor.gradient,
              }}
            >
              <Edit3 className="size-6 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 text-left">
              <p 
                className="text-base font-bold mb-0.5"
                style={{ color: isDark ? '#ffffff' : '#000000' }}
              >
                Tahrirlash
              </p>
              <p 
                className="text-xs"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
              >
                Joyni tahrirlash
              </p>
            </div>
          </button>

          {/* Delete Button */}
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-95"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <div 
              className="p-3 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              }}
            >
              <Trash2 className="size-6 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-base font-bold mb-0.5 text-red-500">
                O'chirish
              </p>
              <p 
                className="text-xs"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
              >
                Joyni butunlay o'chirish
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
