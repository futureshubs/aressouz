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

export const BottomNav = memo(function BottomNav({ activeTab, onTabChange, onAddProductClick, menuCloseRef }: BottomNavProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, accentColor } = useTheme();
  const { locationModalOpen } = useLocation();
  const isDark = theme === 'dark';

  // Debug: Log isMenuOpen state changes
  useEffect(() => {
    console.log('🟡 BottomNav: isMenuOpen state changed:', isMenuOpen);
  }, [isMenuOpen]);

  // Close menu when location modal opens
  useEffect(() => {
    console.log('🟣 BottomNav: locationModalOpen changed:', locationModalOpen);
    if (locationModalOpen && isMenuOpen) {
      console.log('🟣 BottomNav: Closing menu because location modal opened');
      console.log('🟣 BottomNav: isMenuOpen BEFORE setIsMenuOpen(false):', isMenuOpen);
      setIsMenuOpen(false);
      console.log('🟣 BottomNav: setIsMenuOpen(false) called');
    }
  }, [locationModalOpen, isMenuOpen]);

  // Expose close function via ref
  useEffect(() => {
    if (menuCloseRef) {
      console.log('🟢 BottomNav: Setting menuCloseRef.current');
      menuCloseRef.current = () => {
        console.log('🟢 BottomNav: menuCloseRef.current() called - closing menu');
        setIsMenuOpen(prev => {
          console.log('🟢 BottomNav: isMenuOpen PREVIOUS VALUE:', prev);
          console.log('🟢 BottomNav: Setting to FALSE');
          return false;
        });
      };
    } else {
      console.log('🔴 BottomNav: menuCloseRef is undefined');
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
      setIsMenuOpen(prev => !prev);
    } else {
      setIsMenuOpen(false);
      onTabChange(tabId);
    }
  };

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

  return (
    <>
      <nav
        className="fixed bottom-4 left-4 right-4 z-40 transition-all duration-300 
                   sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:w-auto sm:max-w-lg
                   md:max-w-xl lg:max-w-2xl"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.98))'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.98))',
          backdropFilter: 'blur(30px)',
          boxShadow: isDark
            ? `0 20px 60px rgba(0, 0, 0, 0.9), 0 8px 24px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 0 1px ${accentColor.color}20`
            : `0 20px 60px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 0 0 1px ${accentColor.color}15`,
          borderRadius: '24px',
          border: isDark ? '0.5px solid rgba(255, 255, 255, 0.1)' : '0.5px solid rgba(0, 0, 0, 0.08)',
          // Mobile: Add safe area padding
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* iOS Style Tabs */}
        <div className="flex items-center justify-around h-16 sm:h-18 md:h-20 px-2 sm:px-4 md:px-6">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id || (tab.id === 'menu' && isMenuOpen);
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className="relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 md:px-3 py-2 transition-all duration-300 active:scale-95 touch-manipulation"
                style={{
                  flex: '1',
                  maxWidth: '90px',
                  minWidth: '56px',
                  animation: isActive ? 'none' : 'none',
                }}
              >
                {/* Icon container with glassmorphic effect */}
                <div
                  className="relative flex items-center justify-center transition-all duration-300"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: isActive
                      ? isDark
                        ? `linear-gradient(135deg, ${accentColor.color}30, ${accentColor.color}20)`
                        : `linear-gradient(135deg, ${accentColor.color}25, ${accentColor.color}15)`
                      : 'transparent',
                    boxShadow: isActive
                      ? isDark
                        ? `0 8px 24px ${accentColor.color}40, inset 0 1px 0 rgba(255, 255, 255, 0.1)`
                        : `0 8px 24px ${accentColor.color}30, inset 0 1px 0 rgba(255, 255, 255, 0.5)`
                      : 'none',
                    transform: isActive ? 'translateY(-4px) scale(1.05)' : 'translateY(0)',
                  }}
                >
                  <Icon
                    className="transition-all duration-300"
                    style={{
                      width: '22px',
                      height: '22px',
                      color: isActive ? accentColor.color : isDark ? '#9ca3af' : '#6b7280',
                      strokeWidth: isActive ? 2.5 : 2,
                      filter: isActive ? `drop-shadow(0 2px 8px ${accentColor.color}60)` : 'none',
                    }}
                  />
                </div>

                {/* Label */}
                <span
                  className="text-[10px] sm:text-xs font-semibold transition-all duration-300 line-clamp-1"
                  style={{
                    color: isActive ? accentColor.color : isDark ? '#9ca3af' : '#6b7280',
                    textShadow: isActive ? `0 2px 8px ${accentColor.color}40` : 'none',
                  }}
                >
                  {tab.label}
                </span>

                {/* Active indicator dot */}
                {isActive && (
                  <div
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{
                      background: accentColor.color,
                      boxShadow: `0 0 12px ${accentColor.color}`,
                      animation: 'pulse 2s ease-in-out infinite',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
        
        {/* Glow effect at top */}
        <div 
          className="absolute top-0 left-0 right-0 h-px rounded-t-3xl"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor.color}40 50%, transparent)`,
            boxShadow: `0 0 16px ${accentColor.color}30`,
          }}
        />
      </nav>

      {/* Menu Modal */}
      <MenuModal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        platform="ios"
        onMenuSelect={handleMenuSelect}
      />
    </>
  );
});