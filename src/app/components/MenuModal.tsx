import { Gavel, Home, Car, Wrench, MapPin } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface MenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMenuSelect?: (menuId: string) => void;
  activeTab?: string;
  shellStyle?: React.CSSProperties;
  accentColor?: string;
  isDark?: boolean;
}

export function MenuModal({
  isOpen,
  onClose,
  onMenuSelect,
  activeTab = '',
  shellStyle,
  accentColor: accentColorProp,
  isDark: isDarkProp,
}: MenuModalProps) {
  const { theme, accentColor: themeAccent } = useTheme();
  const isDark = isDarkProp ?? theme === 'dark';
  const accentColor = accentColorProp ?? themeAccent.color;

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
    return null;
  }

  const panelStyle =
    shellStyle ??
    ({
      background: isDark ? 'rgba(28, 28, 30, 0.78)' : 'rgba(255, 255, 255, 0.78)',
      backdropFilter: 'blur(44px) saturate(190%)',
      WebkitBackdropFilter: 'blur(44px) saturate(190%)',
      border: isDark ? '0.5px solid rgba(255,255,255,0.14)' : '0.5px solid rgba(255,255,255,0.85)',
      boxShadow: isDark
        ? '0 12px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.1)'
        : '0 12px 48px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06), inset 0 0.5px 0 rgba(255,255,255,0.95)',
      borderRadius: 28,
    } as const);

  return (
    <div
      className="relative overflow-hidden px-2 py-2.5 sm:px-3"
      style={{
        ...panelStyle,
        animation: 'navMenuReveal 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        transformOrigin: 'bottom center',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}55, transparent)`,
        }}
      />

      <div className="grid grid-cols-5 gap-1">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className="relative flex flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-2 transition-all duration-200 active:scale-[0.94] touch-manipulation"
              style={{
                animation: `navMenuItemRise 0.34s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.04}s backwards`,
              }}
              onClick={() => handleMenuItemClick(item.id)}
            >
              {isActive ? (
                <span
                  className="absolute inset-0 rounded-[18px]"
                  style={{
                    background: isDark ? `${accentColor}24` : `${accentColor}18`,
                    boxShadow: `inset 0 0.5px 0 rgba(255,255,255,${isDark ? '0.12' : '0.6'})`,
                  }}
                />
              ) : null}

              <span
                className="relative flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  background: isActive
                    ? isDark
                      ? `${accentColor}30`
                      : `${accentColor}22`
                    : isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                }}
              >
                <Icon
                  style={{
                    width: 20,
                    height: 20,
                    color: isActive ? accentColor : isDark ? '#d4d4d8' : '#52525b',
                    strokeWidth: isActive ? 2.5 : 2,
                  }}
                />
              </span>

              <span
                className="relative max-w-full truncate text-[9px] font-semibold leading-tight sm:text-[10px]"
                style={{
                  color: isActive ? accentColor : isDark ? '#d4d4d8' : '#52525b',
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes navMenuReveal {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes navMenuItemRise {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
