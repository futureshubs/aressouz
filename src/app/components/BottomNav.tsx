import { Home, ShoppingBag, Menu as MenuIcon, UtensilsCrossed, Building2, X } from 'lucide-react';
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

function floatingShellStyle(isDark: boolean) {
  return {
    background: isDark ? 'rgba(28, 28, 30, 0.78)' : 'rgba(255, 255, 255, 0.78)',
    backdropFilter: 'blur(44px) saturate(190%)',
    WebkitBackdropFilter: 'blur(44px) saturate(190%)',
    border: isDark ? '0.5px solid rgba(255,255,255,0.14)' : '0.5px solid rgba(255,255,255,0.85)',
    boxShadow: isDark
      ? '0 12px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.1)'
      : '0 12px 48px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06), inset 0 0.5px 0 rgba(255,255,255,0.95)',
    borderRadius: 28,
  } as const;
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

  const shellStyle = floatingShellStyle(isDark);

  return (
    <>
      {isMenuOpen ? (
        <button
          type="button"
          aria-label="Menyuni yopish"
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300"
          style={{ animation: 'navBackdropIn 0.28s ease-out' }}
          onClick={() => setIsMenuOpen(false)}
        />
      ) : null}

      <div
        className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
        style={{
          paddingBottom: 'max(12px, calc(8px + var(--app-safe-bottom, env(safe-area-inset-bottom, 0px))))',
        }}
      >
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2.5 px-4 pointer-events-auto sm:max-w-xl">
          {isMenuOpen ? (
            <MenuModal
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              onMenuSelect={handleMenuSelect}
              activeTab={activeTab}
              shellStyle={shellStyle}
              accentColor={accentColor.color}
              isDark={isDark}
            />
          ) : null}

          <nav
            className="relative overflow-hidden px-1.5 py-1.5"
            style={shellStyle}
          >
            <div
              className="pointer-events-none absolute inset-x-6 top-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${accentColor.color}55, transparent)`,
              }}
            />

            <div className="flex items-center justify-between gap-0.5">
              {tabs.map((tab) => {
                const isMenuTab = tab.id === 'menu';
                const isActive =
                  activeTab === tab.id ||
                  (isMenuTab && (isMenuOpen || menuRouteTabs.has(activeTab)));
                const Icon = isMenuTab && isMenuOpen ? X : tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabClick(tab.id)}
                    className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] py-1.5 transition-all duration-200 active:scale-[0.94] touch-manipulation"
                  >
                    {isActive ? (
                      <span
                        className="absolute inset-x-0.5 inset-y-0 rounded-[20px]"
                        style={{
                          background: isDark
                            ? `${accentColor.color}24`
                            : `${accentColor.color}18`,
                          boxShadow: isMenuTab && isMenuOpen
                            ? `0 0 0 1px ${accentColor.color}35, 0 4px 16px ${accentColor.color}28`
                            : `inset 0 0.5px 0 rgba(255,255,255,${isDark ? '0.12' : '0.6'})`,
                        }}
                      />
                    ) : null}

                    <span
                      className="relative flex items-center justify-center"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 14,
                      }}
                    >
                      <Icon
                        style={{
                          width: isMenuTab && isMenuOpen ? 20 : 22,
                          height: isMenuTab && isMenuOpen ? 20 : 22,
                          color: isActive ? accentColor.color : isDark ? '#a1a1aa' : '#71717a',
                          strokeWidth: isActive ? 2.5 : 2,
                          transition: 'transform 0.22s ease, color 0.22s ease',
                          transform: isMenuTab && isMenuOpen ? 'rotate(90deg)' : 'none',
                        }}
                      />
                    </span>

                    <span
                      className="relative text-[9px] font-semibold truncate max-w-full px-0.5 sm:text-[10px]"
                      style={{
                        color: isActive ? accentColor.color : isDark ? '#a1a1aa' : '#71717a',
                      }}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      <style>{`
        @keyframes navBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
});
