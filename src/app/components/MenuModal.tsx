import { Gavel, Home, Car, Wrench, MapPin } from 'lucide-react';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';

interface MenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: Platform;
  onMenuSelect?: (menuId: string) => void;
}

export function MenuModal({ isOpen, onClose, platform, onMenuSelect }: MenuModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isIOS = platform === 'ios';
  
  console.log('🔴 MenuModal: isOpen prop =', isOpen);
  
  const menuItems = [
    { id: 'xizmatlar', label: 'Xizmatlar', icon: Wrench },
    { id: 'atrof', label: 'Atrof', icon: MapPin },
    { id: 'mening-uyim', label: 'Mening uy', icon: Home },
    { id: 'auksion', label: 'Auksion', icon: Gavel },
    { id: 'moshina', label: 'Moshina', icon: Car },
  ];

  const handleMenuItemClick = (menuId: string) => {
    onMenuSelect?.(menuId);
    onClose();
  };

  if (!isOpen) {
    console.log('🔴 MenuModal: Returning null because isOpen is false');
    return null;
  }
  
  console.log('🔴 MenuModal: Rendering modal...');
  
  // Quick menu row - rendered directly above the bottom nav
  return (
    <>
      <div 
        className="fixed bottom-24 left-4 right-4 z-40 sm:bottom-[7.25rem] sm:left-1/2 sm:w-auto sm:max-w-lg sm:-translate-x-1/2 md:max-w-xl lg:max-w-2xl"
        style={{
          animation: isOpen ? 'menuRowReveal 0.24s ease-out' : 'none',
        }}
      >
        <div
          className="rounded-[24px] px-2 py-2 sm:px-4 sm:py-3"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.98))'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.98))',
            backdropFilter: 'blur(30px)',
            borderRadius: '24px',
            border: isDark ? '0.5px solid rgba(255, 255, 255, 0.1)' : '0.5px solid rgba(0, 0, 0, 0.08)',
            boxShadow: isDark
              ? `0 20px 60px rgba(0, 0, 0, 0.9), 0 8px 24px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 0 1px ${accentColor.color}18`
              : `0 20px 60px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 0 0 1px ${accentColor.color}12`,
            paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="flex items-center justify-around h-16 sm:h-18 md:h-20 px-1 sm:px-2 md:px-4">
            {menuItems.map((item, index) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  className="relative flex flex-1 flex-col items-center justify-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 md:px-3 py-2 transition-all duration-300 active:scale-95 touch-manipulation"
                  style={{
                    maxWidth: '84px',
                    minWidth: '52px',
                    animation: `menuItemRise 0.28s ease-out ${index * 0.03}s backwards`,
                  }}
                  onClick={() => handleMenuItemClick(item.id)}
                >
                  <div
                    className="relative flex items-center justify-center transition-all duration-300"
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      background: isDark
                        ? `linear-gradient(135deg, ${accentColor.color}30, ${accentColor.color}20)`
                        : `linear-gradient(135deg, ${accentColor.color}25, ${accentColor.color}15)`,
                      boxShadow: isIOS
                        ? isDark
                          ? `0 8px 24px ${accentColor.color}30, inset 0 1px 0 rgba(255, 255, 255, 0.08)`
                          : `0 8px 24px ${accentColor.color}20, inset 0 1px 0 rgba(255, 255, 255, 0.5)`
                        : 'none',
                      transform: 'translateY(-4px) scale(1.05)',
                    }}
                  >
                    <Icon
                      className="transition-all duration-300"
                      style={{
                        width: '22px',
                        height: '22px',
                        color: accentColor.color,
                        strokeWidth: 2.5,
                        filter: `drop-shadow(0 2px 8px ${accentColor.color}50)`,
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] sm:text-xs font-semibold transition-all duration-300 line-clamp-1"
                    style={{
                      color: accentColor.color,
                      textShadow: `0 2px 8px ${accentColor.color}30`,
                    }}
                  >
                    {item.label}
                  </span>

                  <div
                    className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                    style={{
                      background: accentColor.color,
                      boxShadow: `0 0 12px ${accentColor.color}`,
                      opacity: 0.9,
                    }}
                  />
                </button>
              );
            })}
          </div>

          <div 
            className="absolute top-0 left-0 right-0 h-px rounded-t-3xl"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor.color}40 50%, transparent)`,
              boxShadow: `0 0 16px ${accentColor.color}24`,
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes menuRowReveal {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes menuItemRise {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}