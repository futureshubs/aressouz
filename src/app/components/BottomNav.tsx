import { Home, ShoppingBag, Menu as MenuIcon, UtensilsCrossed, Building2 } from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import { MenuModal } from './MenuModal';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAddProductClick?: () => void;
  menuCloseRef?: React.MutableRefObject<(() => void) | null>;
}

export const BottomNav = memo(function BottomNav({
  activeTab,
  onTabChange,
  menuCloseRef,
}: BottomNavProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, accentColor } = useTheme();
  const { locationModalOpen } = useLocation();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (locationModalOpen && isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [locationModalOpen, isMenuOpen]);

  useEffect(() => {
    if (menuCloseRef) {
      menuCloseRef.current = () => setIsMenuOpen(false);
    }
  }, [menuCloseRef]);

  const tabs = [
    { id: 'market', label: 'Market', icon: Home },
    { id: 'dokon', label: "Do'kon", icon: ShoppingBag },
    { id: 'menu', label: 'Menu', icon: MenuIcon },
    { id: 'taomlar', label: 'Taomlar', icon: UtensilsCrossed },
    { id: 'ijara', label: 'Ijara', icon: Building2 },
  ];

  const handleTabClick = (tabId: string) => {
    if (tabId === 'menu') {
      setIsMenuOpen((prev) => !prev);
    } else {
      setIsMenuOpen(false);
      onTabChange(tabId);
    }
  };

  /** Menu orqali ochilgan bo‘limlar — pastki «Menu» tabi faol ko‘rinsin */
  const menuRouteTabs = new Set([
    'auksion',
    'moshina',
    'community',
    'atrof',
    'xizmatlar',
    'mening-uyim',
    'mashinalar',
    'xonalar',
  ]);

  const handleMenuSelect = (menuId: string) => {
    if (menuId === 'auksion') {
      onTabChange('auksion');
    } else if (menuId === 'moshina') {
      onTabChange('moshina');
    } else if (menuId === 'community') {
      onTabChange('community');
    } else if (menuId === 'atrof') {
      onTabChange('atrof');
    } else if (menuId === 'xizmatlar') {
      onTabChange('xizmatlar');
    } else if (menuId === 'mening-uyim') {
      onTabChange('mening-uyim');
    }
  };

  const barBg = isDark
    ? 'linear-gradient(180deg, rgba(22,22,24,0.98) 0%, rgba(12,12,14,0.99) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.99) 100%)';

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t"
        style={{
          background: barBg,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          boxShadow: isDark
            ? `0 -8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)`
            : `0 -8px 28px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)`,
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor.color}55, transparent)`,
          }}
        />
        <div className="flex items-stretch justify-between gap-0 px-1 pt-1 min-h-[58px] max-w-[1600px] mx-auto sm:px-4">
          {tabs.map((tab) => {
            const isActive =
              activeTab === tab.id ||
              (tab.id === 'menu' && (isMenuOpen || menuRouteTabs.has(activeTab)));
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 min-w-0 transition-transform active:scale-95 touch-manipulation"
              >
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    background: isActive
                      ? isDark
                        ? `${accentColor.color}28`
                        : `${accentColor.color}20`
                      : 'transparent',
                    boxShadow: isActive
                      ? `0 0 20px ${accentColor.color}45, inset 0 1px 0 rgba(255,255,255,0.12)`
                      : 'none',
                  }}
                >
                  <Icon
                    style={{
                      width: 22,
                      height: 22,
                      color: isActive ? accentColor.color : isDark ? '#9ca3af' : '#6b7280',
                      strokeWidth: isActive ? 2.5 : 2,
                      filter: isActive ? `drop-shadow(0 0 6px ${accentColor.color}88)` : undefined,
                    }}
                  />
                </div>
                <span
                  className="text-[9px] sm:text-[10px] font-semibold truncate max-w-full px-0.5"
                  style={{
                    color: isActive ? accentColor.color : isDark ? '#9ca3af' : '#6b7280',
                  }}
                >
                  {tab.label}
                </span>
                {isActive ? (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{
                      background: accentColor.color,
                      boxShadow: `0 0 8px ${accentColor.color}`,
                    }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      <MenuModal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        platform="ios"
        onMenuSelect={handleMenuSelect}
      />
    </>
  );
});
