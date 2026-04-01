import { ShoppingCart, Search, User, MapPin, ChevronDown, MessageCircle } from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import { LocationModal } from './LocationModal';
import { LocationPromptModal } from './LocationPromptModal';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { regions } from '../data/regions';

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
  onProfileClick: () => void;
  onCommunityClick?: () => void;
  onAuthClick?: () => void;
  menuCloseRef?: React.MutableRefObject<(() => void) | null>;
}

export const Header = memo(function Header({
  cartCount,
  onCartClick,
  onProfileClick,
  onCommunityClick,
  onAuthClick,
  menuCloseRef,
}: HeaderProps) {
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const { selectedRegion, selectedDistrict, setLocation, showLocationPrompt, dismissLocationPrompt, setLocationModalOpen } = useLocation();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const bgGradient = isDark 
    ? 'linear-gradient(180deg, rgba(0, 0, 0, 0.98) 0%, rgba(0, 0, 0, 0.95) 50%, rgba(0, 0, 0, 0.9) 100%)'
    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.95) 50%, rgba(243, 244, 246, 0.9) 100%)';
    
  const textPrimary = isDark ? '#ffffff' : '#111827';
  const textSecondary = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

  // Get region and district names from IDs
  const regionObj = regions.find(r => r.id === selectedRegion);
  const districtObj = regionObj?.districts.find(d => d.id === selectedDistrict);
  
  const displayLocation = regionObj && districtObj 
    ? `${districtObj.name}, ${regionObj.name}`
    : regionObj?.name || 'Hudud';

  // Close menu when location modal opens
  useEffect(() => {
    console.log('🔵 Header: isLocationOpen changed:', isLocationOpen);
    if (isLocationOpen) {
      console.log('🔵 Header: Location modal is opening, closing menu...');
      setLocationModalOpen(true);
      if (menuCloseRef?.current) {
        console.log('✅ Header: Calling menuCloseRef.current()');
        menuCloseRef.current();
      } else {
        console.log('❌ Header: menuCloseRef.current is null');
      }
    } else {
      setLocationModalOpen(false);
    }
  }, [isLocationOpen, menuCloseRef, setLocationModalOpen]);

  // Handle location selection - close menu if open
  const handleLocationOpen = () => {
    console.log('🔵 handleLocationOpen called');
    console.log('🔵 menuCloseRef:', menuCloseRef);
    console.log('🔵 menuCloseRef.current:', menuCloseRef?.current);
    
    // "Hudud tanlang" prompt modal orqada qolib ketmasligi uchun avval dismiss qilamiz
    dismissLocationPrompt();
    
    if (menuCloseRef?.current) {
      console.log('✅ Closing menu...');
      menuCloseRef.current();
    } else {
      console.log('❌ menuCloseRef.current is null or undefined');
    }
    
    setIsLocationOpen(true);
  };
  
  // Android Material Design Header - Premium 3D
  return (
    <>
      <header 
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          background: bgGradient,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8), 0 4px 16px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-[1600px] mx-auto">
          {/* Material Top Bar - 3D */}
          <div 
            className="flex items-center justify-between py-1.5 border-b"
            style={{
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <button 
              onClick={handleLocationOpen}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
              style={{
                background: `linear-gradient(145deg, ${accentColor.color}1f, ${accentColor.color}0f)`,
                boxShadow: isDark 
                  ? `0 4px 12px ${accentColor.color}40, inset 0 1px 0 rgba(255, 255, 255, 0.15)`
                  : `0 2px 6px ${accentColor.color}26, inset 0 1px 0 rgba(255, 255, 255, 0.5)`,
                border: `0.5px solid ${accentColor.color}33`,
              }}
            >
              <MapPin className="size-4 drop-shadow-lg" style={{ color: accentColor.color }} strokeWidth={2.5} />
              <span className="text-xs sm:text-sm font-semibold drop-shadow-md line-clamp-1 max-w-[120px] sm:max-w-none" style={{ color: textPrimary }}>
                {displayLocation}
              </span>
              <ChevronDown className="size-3 drop-shadow" style={{ color: `${accentColor.color}b3` }} strokeWidth={2.5} />
            </button>
          </div>

          {/* Material Search Bar - 3D Glass */}
          <div className="flex items-center gap-2 py-2">
            <div 
              className="relative flex-1 rounded-lg overflow-hidden"
              style={{
                background: isDark ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.8), rgba(20, 20, 20, 0.9))' : 'linear-gradient(145deg, rgba(240, 240, 240, 0.95), rgba(250, 250, 250, 0.9))',
                boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)' : '0 4px 16px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
              }}
            >
              {/* Gradient shine effect */}
              <div 
                className="absolute inset-0 opacity-50 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${accentColor.color}26, transparent 60%)`,
                }}
              />
              
              <Search 
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 drop-shadow-lg" 
                style={{ color: `${accentColor.color}b3` }}
                strokeWidth={2.5}
              />
              <input
                type="text"
                placeholder="Qidirish..."
                className={`relative w-full pl-10 pr-3 py-2.5 bg-transparent focus:outline-none text-sm font-medium ${isDark ? 'placeholder:text-white/40' : 'placeholder:text-black/40'}`}
                style={{
                  textShadow: isDark ? '0 1px 2px rgba(0, 0, 0, 0.5)' : 'none',
                  color: textPrimary,
                }}
              />
            </div>

            {/* Community Button - 3D Floating */}
            <button
              onClick={onCommunityClick}
              className="p-2 rounded-lg transition-all active:scale-90 group"
              style={{
                background: `linear-gradient(145deg, ${accentColor.color}33, ${accentColor.color}1a)`,
                boxShadow: isDark
                  ? `0 6px 20px ${accentColor.color}66, 0 3px 10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                  : `0 4px 16px ${accentColor.color}4d, 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
                border: `1px solid ${accentColor.color}4d`,
              }}
              aria-label="Community"
            >
              <MessageCircle
                className="size-5 group-active:scale-90 transition-transform"
                style={{
                  color: isDark ? '#ffffff' : accentColor.color,
                  filter: isDark ? 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.6))' : 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3))',
                }}
                strokeWidth={2.5}
              />
            </button>

            {/* Cart Button */}
            <button
              type="button"
              onClick={onCartClick}
              className="relative p-2 rounded-lg transition-all active:scale-90 group"
              style={{
                background: `linear-gradient(145deg, ${accentColor.color}33, ${accentColor.color}1a)`,
                boxShadow: isDark 
                  ? `0 6px 20px ${accentColor.color}66, 0 3px 10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                  : `0 4px 16px ${accentColor.color}4d, 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
                border: `1px solid ${accentColor.color}4d`,
              }}
              aria-label="Savat"
            >
              <ShoppingCart 
                className="size-5 group-active:scale-90 transition-transform" 
                style={{ 
                  color: isDark ? '#ffffff' : accentColor.color,
                  filter: isDark ? 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.6))' : 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3))',
                }}
                strokeWidth={2.5}
              />
              {cartCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-white text-[10px] rounded-full font-bold"
                  style={{
                    backgroundImage: accentColor.gradient,
                    boxShadow: isDark 
                      ? `0 4px 12px ${accentColor.color}99, 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4)`
                      : `0 3px 10px ${accentColor.color}80, 0 1px 4px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5)`,
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  {cartCount}
                </span>
              )}
            </button>

            {/* User Button - 3D Glass */}
            <button 
              onClick={onProfileClick}
              className="p-2 rounded-lg transition-all active:scale-90 group"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))'
                  : 'linear-gradient(145deg, rgba(240, 240, 240, 0.95), rgba(250, 250, 250, 0.9))',
                boxShadow: isDark 
                  ? '0 4px 12px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  : '0 3px 10px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
              }}
            >
              <User 
                className="size-5 group-active:scale-90 transition-transform" 
                style={{ 
                  color: isDark ? '#ffffff' : '#374151',
                  filter: isDark ? 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.6))' : 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2))',
                }}
                strokeWidth={2.5}
              />
            </button>
          </div>
        </div>
        
        {/* Bottom glow effect */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor.color}66 50%, transparent)`,
            boxShadow: `0 0 20px ${accentColor.color}4d`,
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