import { Check, X } from 'lucide-react';
import { Platform } from '../utils/platform';
import { accentColors } from '../context/ThemeContext';

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: Platform;
  selectedColorId: string;
  onColorSelect: (colorId: string) => void;
  theme: 'light' | 'dark';
}

export function ColorPickerModal({ isOpen, onClose, platform, selectedColorId, onColorSelect, theme }: ColorPickerModalProps) {
  const isIOS = platform === 'ios';
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  const handleColorSelect = (colorId: string) => {
    onColorSelect(colorId);
    setTimeout(() => onClose(), 300);
  };

  if (isIOS) {
    return (
      <div 
        className="fixed inset-0 app-safe-pad z-[70] flex items-end justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0"
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(10px)',
          }}
        />

        {/* Modal Content */}
        <div 
          className="relative w-full max-w-md rounded-t-3xl overflow-hidden flex flex-col"
          style={{
            background: isDark 
              ? 'linear-gradient(to bottom, rgba(20, 20, 20, 0.98), rgba(10, 10, 10, 0.98))'
              : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(249, 250, 251, 0.95))',
            maxHeight: '80vh',
            boxShadow: isDark 
              ? '0 -8px 32px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : '0 -8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            className="sticky top-0 z-10 px-4 py-4 flex items-center justify-between flex-shrink-0"
            style={{
              background: isDark 
                ? 'linear-gradient(to bottom, rgba(20, 20, 20, 0.98), rgba(15, 15, 15, 0.95))'
                : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(249, 250, 251, 0.95))',
              backdropFilter: 'blur(20px)',
              borderBottom: isDark 
                ? '0.5px solid rgba(255, 255, 255, 0.1)'
                : '0.5px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 
              className="text-xl font-bold"
              style={{ color: isDark ? '#ffffff' : '#1f2937' }}
            >
              Rang tanlash
            </h2>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl transition-all active:scale-90"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))'
                  : 'linear-gradient(145deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.04))',
                boxShadow: isDark 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                  : '0 4px 12px rgba(0, 0, 0, 0.1)',
                border: isDark 
                  ? '0.5px solid rgba(255, 255, 255, 0.15)'
                  : '0.5px solid rgba(0, 0, 0, 0.1)',
              }}
            >
              <X 
                className="size-5" 
                style={{ color: isDark ? '#ffffff' : '#1f2937' }}
                strokeWidth={2.5} 
              />
            </button>
          </div>

          {/* Color Grid with Scroll */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-4">
              {accentColors.map((color) => {
                const isSelected = color.id === selectedColorId;
                return (
                  <button
                    key={color.id}
                    onClick={() => handleColorSelect(color.id)}
                    className="relative group transition-all active:scale-95"
                  >
                    {/* Color Circle */}
                    <div 
                      className="w-full aspect-square rounded-3xl transition-all"
                      style={{
                        background: color.gradient,
                        boxShadow: isSelected 
                          ? `0 12px 32px ${color.color}80, 0 6px 16px ${color.color}40, inset 0 2px 0 rgba(255, 255, 255, 0.4)`
                          : `0 8px 24px ${color.color}40, 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
                        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                        border: isSelected 
                          ? `3px solid ${color.color}`
                          : isDark 
                            ? '0.5px solid rgba(255, 255, 255, 0.1)'
                            : '0.5px solid rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      {/* Checkmark */}
                      {isSelected && (
                        <div 
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            background: `${color.color}20`,
                            borderRadius: '1.5rem',
                          }}
                        >
                          <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center"
                            style={{
                              background: 'rgba(255, 255, 255, 0.95)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                            }}
                          >
                            <Check 
                              className="size-6" 
                              style={{ color: color.color }}
                              strokeWidth={3}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Color Name */}
                    <p 
                      className="text-sm font-semibold mt-2 text-center"
                      style={{ 
                        color: isDark ? '#ffffff' : '#1f2937',
                        textShadow: isDark ? '0 1px 2px rgba(0, 0, 0, 0.5)' : 'none'
                      }}
                    >
                      {color.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android Material Design
  return (
    <div 
      className="fixed inset-0 app-safe-pad z-[70] flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        style={{
          background: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
        }}
      />

      {/* Modal Content */}
      <div 
        className="relative w-full max-w-md rounded-t-2xl overflow-hidden flex flex-col"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, #1e1e1e, #121212)'
            : 'linear-gradient(135deg, #ffffff, #f5f5f5)',
          maxHeight: '80vh',
          boxShadow: isDark 
            ? '0 -4px 24px rgba(0, 0, 0, 0.8)'
            : '0 -4px 24px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 px-4 py-4 flex items-center justify-between flex-shrink-0"
          style={{
            background: isDark 
              ? 'linear-gradient(135deg, #1e1e1e, #161616)'
              : 'linear-gradient(135deg, #ffffff, #f9fafb)',
            borderBottom: isDark 
              ? '1px solid rgba(255, 255, 255, 0.08)'
              : '1px solid rgba(0, 0, 0, 0.08)',
          }}
        >
          <h2 
            className="text-xl font-bold"
            style={{ color: isDark ? '#ffffff' : '#1f2937' }}
          >
            Rang tanlash
          </h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl transition-all active:scale-90"
            style={{
              background: isDark 
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.05)',
              border: isDark 
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <X 
              className="size-5" 
              style={{ color: isDark ? '#ffffff' : '#1f2937' }}
              strokeWidth={2.5} 
            />
          </button>
        </div>

        {/* Color Grid with Scroll */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
            {accentColors.map((color) => {
              const isSelected = color.id === selectedColorId;
              return (
                <button
                  key={color.id}
                  onClick={() => handleColorSelect(color.id)}
                  className="relative group transition-all active:scale-95"
                >
                  {/* Color Circle */}
                  <div 
                    className="w-full aspect-square rounded-2xl transition-all"
                    style={{
                      background: color.gradient,
                      boxShadow: isSelected 
                        ? `0 8px 24px ${color.color}80, 0 4px 12px ${color.color}40, inset 0 1px 0 rgba(255, 255, 255, 0.3)`
                        : `0 6px 18px ${color.color}40, 0 3px 9px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      border: isSelected 
                        ? `3px solid ${color.color}`
                        : isDark 
                          ? '1px solid rgba(255, 255, 255, 0.08)'
                          : '1px solid rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    {/* Checkmark */}
                    {isSelected && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          background: `${color.color}20`,
                          borderRadius: '1rem',
                        }}
                      >
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{
                            background: 'rgba(255, 255, 255, 0.95)',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                          }}
                        >
                          <Check 
                            className="size-5" 
                            style={{ color: color.color }}
                            strokeWidth={3}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Color Name */}
                  <p 
                    className="text-xs font-bold mt-2 text-center"
                    style={{ color: isDark ? '#ffffff' : '#1f2937' }}
                  >
                    {color.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}