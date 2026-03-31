import { memo } from 'react';
import { Star, Calendar, Users } from 'lucide-react';
import { Car } from '../data/cars';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';

interface CarItemCardProps {
  car: Car;
  platform: Platform;
  onClick: () => void;
  onAddToCart?: () => void;
}

export const CarItemCard = memo(function CarItemCard({ 
  car, 
  platform, 
  onClick,
  onAddToCart 
}: CarItemCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isIOS = platform === 'ios';

  const handleCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart();
    }
  };

  if (isIOS) {
    // iOS Neumorphic 3D Style
    return (
      <div
        onClick={onClick}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl transition-all duration-300 active:scale-95 cursor-pointer group"
        style={{
          background: isDark ? '#1a1a1a' : '#f0f0f0',
          boxShadow: isDark
            ? '8px 8px 16px #0d0d0d, -8px -8px 16px #272727'
            : '8px 8px 16px #d1d1d1, -8px -8px 16px #ffffff',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = isDark
            ? '12px 12px 24px #0a0a0a, -12px -12px 24px #2a2a2a'
            : '12px 12px 24px #c8c8c8, -12px -12px 24px #ffffff';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = isDark
            ? '8px 8px 16px #0d0d0d, -8px -8px 16px #272727'
            : '8px 8px 16px #d1d1d1, -8px -8px 16px #ffffff';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Image Container with Inset Shadow */}
        <div 
          className="relative aspect-[4/3] overflow-hidden rounded-t-2xl sm:rounded-t-3xl"
          style={{
            boxShadow: isDark
              ? 'inset 4px 4px 8px #0d0d0d, inset -4px -4px 8px #272727'
              : 'inset 4px 4px 8px #d1d1d1, inset -4px -4px 8px #ffffff',
          }}
        >
          <img
            src={car.image}
            alt={car.name}
            className="w-full h-full object-cover"
          />

          {/* Top Corner Info - Neumorphic */}
          <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 flex items-start justify-between">
            {/* Condition Badge - 3D */}
            <div 
              className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] transition-all duration-300"
              style={{
                background: car.condition === 'Yangi'
                  ? isDark ? '#166534' : '#22c55e'
                  : isDark ? '#1e40af' : '#3b82f6',
                color: '#ffffff',
                boxShadow: car.condition === 'Yangi'
                  ? '3px 3px 6px rgba(34, 197, 94, 0.3), -2px -2px 4px rgba(34, 197, 94, 0.1)'
                  : '3px 3px 6px rgba(59, 130, 246, 0.3), -2px -2px 4px rgba(59, 130, 246, 0.1)',
              }}
            >
              {car.condition}
            </div>

            {/* Rating - 3D */}
            <div 
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl transition-all duration-300"
              style={{
                background: isDark ? '#1a1a1a' : '#f0f0f0',
                boxShadow: isDark
                  ? '3px 3px 6px #0d0d0d, -2px -2px 4px #272727'
                  : '3px 3px 6px #d1d1d1, -2px -2px 4px #ffffff',
              }}
            >
              <Star className="size-2.5 sm:size-3 fill-yellow-400 text-yellow-400" strokeWidth={2.5} />
              <span className="text-[9px] sm:text-[10px] font-black" style={{ color: isDark ? '#ffffff' : '#111111' }}>
                {car.rating}
              </span>
            </div>
          </div>
        </div>

        {/* Content with 3D Elements */}
        <div className="p-2 sm:p-3">
          {/* Brand & Year - Neumorphic Line */}
          <div 
            className="flex items-center justify-between mb-1.5 sm:mb-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl"
            style={{
              background: isDark ? '#1a1a1a' : '#f0f0f0',
              boxShadow: isDark
                ? 'inset 2px 2px 4px #0d0d0d, inset -2px -2px 4px #272727'
                : 'inset 2px 2px 4px #d1d1d1, inset -2px -2px 4px #ffffff',
            }}
          >
            <span 
              className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest"
              style={{ color: accentColor.color }}
            >
              {car.brand}
            </span>
            <div className="flex items-center gap-0.5 sm:gap-1">
              <Calendar className="size-2.5 sm:size-3" style={{ color: isDark ? '#888' : '#666' }} strokeWidth={2.5} />
              <span className="text-[9px] sm:text-[10px] font-bold" style={{ color: isDark ? '#888' : '#666' }}>
                {car.year}
              </span>
            </div>
          </div>

          {/* Name */}
          <h3 
            className="text-xs sm:text-sm font-black leading-tight mb-1.5 sm:mb-2 line-clamp-2 px-0.5 sm:px-1"
            style={{ 
              color: isDark ? '#ffffff' : '#111111',
              minHeight: '2em',
              textShadow: isDark 
                ? '2px 2px 4px rgba(0,0,0,0.5)'
                : '1px 1px 2px rgba(255,255,255,0.8)',
            }}
          >
            {car.name}
          </h3>

          {/* Quick Info Row - 3D Pills */}
          <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
            <div 
              className="flex-1 flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-md sm:rounded-lg"
              style={{
                background: isDark ? '#1a1a1a' : '#f0f0f0',
                boxShadow: isDark
                  ? '2px 2px 4px #0d0d0d, -2px -2px 4px #272727'
                  : '2px 2px 4px #d1d1d1, -2px -2px 4px #ffffff',
              }}
            >
              <div 
                className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full"
                style={{ 
                  background: accentColor.color,
                  boxShadow: `0 0 4px ${accentColor.color}80`,
                }}
              />
              <span className="text-[8px] sm:text-[10px] font-bold" style={{ color: isDark ? '#cccccc' : '#555555' }}>
                {car.fuelType}
              </span>
            </div>

            <div 
              className="flex-1 flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-md sm:rounded-lg"
              style={{
                background: isDark ? '#1a1a1a' : '#f0f0f0',
                boxShadow: isDark
                  ? '2px 2px 4px #0d0d0d, -2px -2px 4px #272727'
                  : '2px 2px 4px #d1d1d1, -2px -2px 4px #ffffff',
              }}
            >
              <div 
                className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full"
                style={{ 
                  background: accentColor.color,
                  boxShadow: `0 0 4px ${accentColor.color}80`,
                }}
              />
              <span className="text-[8px] sm:text-[10px] font-bold" style={{ color: isDark ? '#cccccc' : '#555555' }}>
                {car.transmission}
              </span>
            </div>

            <div 
              className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-md sm:rounded-lg"
              style={{
                background: isDark ? '#1a1a1a' : '#f0f0f0',
                boxShadow: isDark
                  ? '2px 2px 4px #0d0d0d, -2px -2px 4px #272727'
                  : '2px 2px 4px #d1d1d1, -2px -2px 4px #ffffff',
              }}
            >
              <Users className="size-2.5 sm:size-3" style={{ color: accentColor.color }} strokeWidth={2.5} />
              <span className="text-[8px] sm:text-[10px] font-bold" style={{ color: isDark ? '#cccccc' : '#555555' }}>
                {car.seats}
              </span>
            </div>
          </div>

          {/* Price - 3D Inset */}
          <div 
            className="mb-1.5 sm:mb-2 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl"
            style={{
              background: isDark ? '#1a1a1a' : '#f0f0f0',
              boxShadow: isDark
                ? 'inset 4px 4px 8px #0d0d0d, inset -4px -4px 8px #272727'
                : 'inset 4px 4px 8px #d1d1d1, inset -4px -4px 8px #ffffff',
            }}
          >
            {car.oldPrice && (
              <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                <span className="text-[9px] sm:text-[10px] line-through" style={{ color: isDark ? '#555' : '#999' }}>
                  ${car.oldPrice.toLocaleString('en-US')}
                </span>
                <span 
                  className="text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.5 rounded"
                  style={{
                    background: '#ef4444',
                    color: '#ffffff',
                    boxShadow: '2px 2px 4px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  -{Math.round((1 - car.price / car.oldPrice) * 100)}%
                </span>
              </div>
            )}
            <div className="flex items-baseline gap-0.5 sm:gap-1">
              <span 
                className="text-[8px] sm:text-[9px] font-bold"
                style={{ 
                  color: isDark ? accentColor.color : accentColor.color,
                  textShadow: isDark 
                    ? `0 0 8px ${accentColor.color}60`
                    : `2px 2px 4px ${accentColor.color}40`,
                }}
              >
                $
              </span>
              <span 
                className="text-base sm:text-lg font-black"
                style={{ 
                  color: isDark ? accentColor.color : accentColor.color,
                  textShadow: isDark 
                    ? `0 0 8px ${accentColor.color}60`
                    : `2px 2px 4px ${accentColor.color}40`,
                }}
              >
                {car.price.toLocaleString('en-US')}
              </span>
            </div>
          </div>

          {/* Buy Button - 3D Raised */}
          <button
            onClick={handleCartClick}
            className="w-full py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs transition-all duration-300"
            style={{
              background: accentColor.gradient,
              color: '#ffffff',
              boxShadow: `4px 4px 8px ${accentColor.color}40, -2px -2px 4px ${accentColor.color}20`,
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `6px 6px 12px ${accentColor.color}50, -3px -3px 6px ${accentColor.color}30`;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `4px 4px 8px ${accentColor.color}40, -2px -2px 4px ${accentColor.color}20`;
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Xarid qilish
          </button>
        </div>
      </div>
    );
  }

  // Android Material Style with 3D
  return (
    <div
      onClick={onClick}
      className="relative overflow-hidden rounded-xl sm:rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer"
      style={{
        background: isDark ? '#1e1e1e' : '#f5f5f5',
        boxShadow: isDark
          ? '0 8px 24px rgba(0, 0, 0, 0.7), 0 1px 0 rgba(255,255,255,0.05)'
          : '0 8px 24px rgba(0, 0, 0, 0.12), 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        <img
          src={car.image}
          alt={car.name}
          className="w-full h-full object-cover"
        />

        {/* Top Corner Info */}
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 flex items-start justify-between">
          {/* Condition Badge */}
          <div 
            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-[9px] sm:text-[10px]"
            style={{
              background: car.condition === 'Yangi'
                ? isDark ? '#166534' : '#22c55e'
                : isDark ? '#1e40af' : '#3b82f6',
              color: '#ffffff',
              boxShadow: '0 3px 10px rgba(0, 0, 0, 0.3)',
            }}
          >
            {car.condition}
          </div>

          {/* Rating */}
          <div 
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl"
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              boxShadow: '0 3px 10px rgba(0, 0, 0, 0.3)',
            }}
          >
            <Star className="size-2.5 sm:size-3 fill-yellow-400 text-yellow-400" strokeWidth={2} />
            <span className="text-[9px] sm:text-[10px] font-bold text-white">{car.rating}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-2 sm:p-3">
        {/* Brand & Year */}
        <div 
          className="flex items-center justify-between mb-1.5 sm:mb-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg"
          style={{
            background: isDark ? '#2a2a2a' : '#e8e8e8',
          }}
        >
          <span 
            className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider"
            style={{ color: accentColor.color }}
          >
            {car.brand}
          </span>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Calendar className="size-2.5 sm:size-3" style={{ color: isDark ? '#888' : '#666' }} strokeWidth={2} />
            <span className="text-[9px] sm:text-[10px] font-medium" style={{ color: isDark ? '#888' : '#666' }}>
              {car.year}
            </span>
          </div>
        </div>

        {/* Name */}
        <h3 
          className="text-xs sm:text-sm font-bold leading-tight mb-1.5 sm:mb-2 line-clamp-2 px-0.5 sm:px-1"
          style={{ 
            color: isDark ? '#ffffff' : '#111111',
            minHeight: '2em',
          }}
        >
          {car.name}
        </h3>

        {/* Quick Info Row */}
        <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
          <div 
            className="flex-1 flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-md sm:rounded-lg"
            style={{
              background: `${accentColor.color}15`,
            }}
          >
            <div 
              className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full"
              style={{ background: accentColor.color }}
            />
            <span className="text-[8px] sm:text-[10px] font-medium" style={{ color: isDark ? '#cccccc' : '#555555' }}>
              {car.fuelType}
            </span>
          </div>

          <div 
            className="flex-1 flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-md sm:rounded-lg"
            style={{
              background: `${accentColor.color}15`,
            }}
          >
            <div 
              className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full"
              style={{ background: accentColor.color }}
            />
            <span className="text-[8px] sm:text-[10px] font-medium" style={{ color: isDark ? '#cccccc' : '#555555' }}>
              {car.transmission}
            </span>
          </div>

          <div 
            className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-md sm:rounded-lg"
            style={{
              background: `${accentColor.color}15`,
            }}
          >
            <Users className="size-2.5 sm:size-3" style={{ color: accentColor.color }} strokeWidth={2} />
            <span className="text-[8px] sm:text-[10px] font-medium" style={{ color: isDark ? '#cccccc' : '#555555' }}>
              {car.seats}
            </span>
          </div>
        </div>

        {/* Price */}
        <div 
          className="mb-1.5 sm:mb-2 p-2 sm:p-2.5 rounded-lg sm:rounded-xl"
          style={{
            background: isDark ? '#2a2a2a' : '#e8e8e8',
          }}
        >
          {car.oldPrice && (
            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
              <span className="text-[9px] sm:text-[10px] line-through" style={{ color: isDark ? '#555' : '#999' }}>
                ${car.oldPrice.toLocaleString('en-US')}
              </span>
              <span 
                className="text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.5 rounded"
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                }}
              >
                -{Math.round((1 - car.price / car.oldPrice) * 100)}%
              </span>
            </div>
          )}
          <div className="flex items-baseline gap-0.5 sm:gap-1">
            <span 
              className="text-[8px] sm:text-[9px] font-medium"
              style={{ color: isDark ? accentColor.color : accentColor.color }}
            >
              $
            </span>
            <span 
              className="text-base sm:text-lg font-bold"
              style={{ color: isDark ? accentColor.color : accentColor.color }}
            >
              {car.price.toLocaleString('en-US')}
            </span>
          </div>
        </div>

        {/* Buy Button */}
        <button
          onClick={handleCartClick}
          className="w-full py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs transition-all active:scale-95"
          style={{
            background: accentColor.color,
            color: '#ffffff',
            boxShadow: `0 4px 16px ${accentColor.color}40`,
          }}
        >
          Xarid qilish
        </button>
      </div>
    </div>
  );
});