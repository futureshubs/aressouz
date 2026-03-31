import { memo } from 'react';
import { MapPin, Star, Phone, Fuel } from 'lucide-react';
import { GasStation } from '../data/gasStations';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';

interface GasStationCardProps {
  station: GasStation;
  onStationClick: (station: GasStation) => void;
  platform: Platform;
}

export const GasStationCard = memo(function GasStationCard({ station, onStationClick, platform }: GasStationCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isIOS = platform === 'ios';

  return (
    <button
      onClick={() => onStationClick(station)}
      className="w-full text-left transition-all active:scale-95 duration-200"
      style={{
        background: isDark
          ? (isIOS ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))' : 'linear-gradient(135deg, #1a1a1a, #141414)')
          : (isIOS ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))' : 'linear-gradient(135deg, #ffffff, #fafafa)'),
        backdropFilter: isIOS ? 'blur(20px)' : undefined,
        border: isDark
          ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.08)')
          : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)'),
        boxShadow: isDark
          ? (isIOS ? '0 8px 32px rgba(0, 0, 0, 0.4)' : '6px 6px 16px #0d0d0d, -6px -6px 16px #272727')
          : (isIOS ? '0 8px 32px rgba(0, 0, 0, 0.12)' : '6px 6px 16px #d1d1d1, -6px -6px 16px #ffffff'),
        borderRadius: isIOS ? '24px' : '16px',
      }}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ borderRadius: isIOS ? '24px 24px 0 0' : '16px 16px 0 0', height: '140px' }}>
        <img
          src={station.image}
          alt={station.name}
          className="w-full h-full object-cover"
        />
        
        {/* Status Badge */}
        <div 
          className="absolute top-3 right-3 px-3 py-1.5 rounded-full backdrop-blur-md"
          style={{
            background: station.isOpen ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
          }}
        >
          <span className="text-[10px] font-black text-white">
            {station.isOpen ? '● OCHIQ' : '● YOPIQ'}
          </span>
        </div>

        {/* Distance Badge */}
        <div 
          className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full backdrop-blur-md"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
          }}
        >
          <span className="text-xs font-bold text-white">📍 {station.distance}</span>
        </div>

        {/* Brand Badge */}
        <div 
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full backdrop-blur-md"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
          }}
        >
          <span className="text-xs font-black text-white">{station.brand}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Name */}
        <h3 
          className="text-base font-bold mb-3 line-clamp-1"
          style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
        >
          {station.name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1">
            <Star className="size-3 fill-yellow-400 text-yellow-400" strokeWidth={2.5} />
            <span 
              className="text-xs font-bold"
              style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
            >
              {station.rating}
            </span>
          </div>
          <span 
            className="text-xs"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
          >
            ({station.reviews})
          </span>
        </div>

        {/* Fuel Types */}
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-2">
            <Fuel 
              className="size-3.5" 
              style={{ color: accentColor.color }}
              strokeWidth={2.5}
            />
            <span 
              className="text-xs font-bold"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              Yoqilg'i turlari:
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {station.fuelTypes.slice(0, 3).map((fuel, index) => (
              <div
                key={index}
                className="px-2 py-1 rounded-lg"
                style={{
                  background: fuel.available 
                    ? (isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)')
                    : (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'),
                }}
              >
                <span 
                  className="text-[10px] font-bold"
                  style={{ 
                    color: fuel.available 
                      ? (isDark ? '#22c55e' : '#16a34a')
                      : (isDark ? '#ef4444' : '#dc2626')
                  }}
                >
                  {fuel.name}
                </span>
              </div>
            ))}
            {station.fuelTypes.length > 3 && (
              <div
                className="px-2 py-1 rounded-lg"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                <span 
                  className="text-[10px] font-bold"
                  style={{ color: accentColor.color }}
                >
                  +{station.fuelTypes.length - 3}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2">
          <MapPin 
            className="size-3.5 flex-shrink-0 mt-0.5" 
            style={{ color: accentColor.color }}
            strokeWidth={2.5}
          />
          <span 
            className="text-xs line-clamp-1"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            {station.address}
          </span>
        </div>
      </div>
    </button>
  );
});
