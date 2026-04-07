import { ShoppingCart, Search, User, MapPin, ChevronDown, MessageCircle } from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import { LocationModal } from './LocationModal';
import { LocationPromptModal } from './LocationPromptModal';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import { regions } from '../data/regions';

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
  onProfileClick: () => void;
  onCommunityClick?: () => void;
  menuCloseRef?: React.MutableRefObject<(() => void) | null>;
}

export const Header = memo(function Header({
  cartCount,
  onCartClick,
  onProfileClick,
  onCommunityClick,
  menuCloseRef,
}: HeaderProps) {
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const { selectedRegion, selectedDistrict, setLocation, showLocationPrompt, dismissLocationPrompt, setLocationModalOpen } =
    useLocation();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const bgGradient = isDark
    ? 'linear-gradient(180deg, rgba(8,8,10,0.98) 0%, rgba(8,8,10,0.94) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.95) 100%)';

  const textPrimary = isDark ? '#ffffff' : '#111827';

  const regionObj = regions.find((r) => r.id === selectedRegion);
  const districtObj = regionObj?.districts.find((d) => d.id === selectedDistrict);

  const displayLocation =
    regionObj && districtObj
      ? `${districtObj.name}, ${regionObj.name}`
      : regionObj?.name || 'Hudud';

  useEffect(() => {
    if (isLocationOpen) {
      setLocationModalOpen(true);
      menuCloseRef?.current?.();
    } else {
      setLocationModalOpen(false);
    }
  }, [isLocationOpen, menuCloseRef, setLocationModalOpen]);

  const handleLocationOpen = () => {
    dismissLocationPrompt();
    menuCloseRef?.current?.();
    setIsLocationOpen(true);
  };

  const iconBtnBase = {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 14,
  } as const;

  return (
    <>
      <header
        className="sticky z-50 shrink-0"
        style={{
          top: 0,
          paddingTop: 'var(--app-safe-top)',
          background: bgGradient,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: isDark
            ? '0 4px 24px rgba(0,0,0,0.45)'
            : '0 2px 16px rgba(0,0,0,0.06)',
        }}
      >
        <div className="px-3 sm:px-4 max-w-[1600px] mx-auto pt-2 pb-2 space-y-2">
          {/* Hudud — kapsula */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleLocationOpen}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all active:scale-[0.98] max-w-full"
              style={{
                background: isDark ? `${accentColor.color}18` : `${accentColor.color}12`,
                border: `1px solid ${accentColor.color}40`,
                boxShadow: `0 0 20px ${accentColor.color}22, inset 0 1px 0 rgba(255,255,255,0.08)`,
              }}
            >
              <MapPin className="size-4 shrink-0" style={{ color: accentColor.color }} strokeWidth={2.5} />
              <span
                className="text-xs sm:text-sm font-semibold truncate"
                style={{ color: textPrimary }}
              >
                {displayLocation}
              </span>
              <ChevronDown className="size-3.5 shrink-0 opacity-80" style={{ color: accentColor.color }} strokeWidth={2.5} />
            </button>
          </div>

          {/* Qidiruv + chat / savat / profil */}
          <div className="flex items-center gap-2">
            <div
              className="relative flex-1 min-w-0 rounded-2xl overflow-hidden"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                boxShadow: isDark
                  ? 'inset 0 1px 0 rgba(255,255,255,0.05)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.8)',
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                  background: `radial-gradient(circle at 20% 30%, ${accentColor.color}22, transparent 55%)`,
                }}
              />
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
                style={{ color: `${accentColor.color}b3` }}
                strokeWidth={2.5}
              />
              <input
                type="search"
                enterKeyHint="search"
                placeholder="Qidirish..."
                className={`relative w-full pl-10 pr-3 py-2.5 bg-transparent focus:outline-none text-sm font-medium rounded-2xl ${
                  isDark ? 'placeholder:text-white/35' : 'placeholder:text-black/35'
                }`}
                style={{ color: textPrimary }}
              />
            </div>

            <button
              type="button"
              onClick={() => onCommunityClick?.()}
              className="flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-40"
              disabled={!onCommunityClick}
              style={{
                ...iconBtnBase,
                background: `${accentColor.color}22`,
                border: `1px solid ${accentColor.color}44`,
                boxShadow: `0 0 16px ${accentColor.color}33`,
              }}
              aria-label="Chat"
            >
              <MessageCircle
                className="size-5"
                style={{ color: isDark ? '#fff' : accentColor.color }}
                strokeWidth={2.5}
              />
            </button>

            <button
              type="button"
              onClick={onCartClick}
              className="relative flex items-center justify-center shrink-0 transition-all active:scale-90"
              style={{
                ...iconBtnBase,
                background: `${accentColor.color}22`,
                border: `1px solid ${accentColor.color}44`,
                boxShadow: `0 0 16px ${accentColor.color}33`,
              }}
              aria-label="Savat"
            >
              <ShoppingCart
                className="size-5"
                style={{ color: isDark ? '#fff' : accentColor.color }}
                strokeWidth={2.5}
              />
              {cartCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-white text-[10px] rounded-full font-bold"
                  style={{
                    background: '#22c55e',
                    boxShadow: '0 2px 8px rgba(34,197,94,0.55)',
                  }}
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onProfileClick}
              className="flex items-center justify-center shrink-0 transition-all active:scale-90"
              style={{
                ...iconBtnBase,
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
              }}
              aria-label="Profil"
            >
              <User
                className="size-5"
                style={{ color: isDark ? '#fff' : '#374151' }}
                strokeWidth={2.5}
              />
            </button>
          </div>
        </div>

        <div
          className="h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor.color}55, transparent)`,
          }}
        />
      </header>

      <LocationModal
        isOpen={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
        selectedRegion={selectedRegion}
        selectedDistrict={selectedDistrict}
        onLocationSelect={(region, district) => {
          setLocation(region, district);
        }}
      />

      <LocationPromptModal
        isOpen={showLocationPrompt}
        onSelectLocation={handleLocationOpen}
        onDismiss={dismissLocationPrompt}
      />
    </>
  );
});
