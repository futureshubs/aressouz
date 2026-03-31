import { Star, Clock, MapPin, ChevronRight, CheckCircle, TrendingUp, Award } from 'lucide-react';
import { memo } from 'react';
import { Restaurant } from '../data/restaurants';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';

interface RestaurantCardProps {
  restaurant: Restaurant;
  onRestaurantClick: (restaurant: Restaurant) => void;
  platform: Platform;
}

export const RestaurantCard = memo(function RestaurantCard({ restaurant, onRestaurantClick, platform }: RestaurantCardProps) {
  const { theme, accentColor } = useTheme();
  const isIOS = platform === 'ios';
  const isDark = theme === 'dark';

  if (isIOS) {
    // iOS Style - Magazine Layout (Vertical with large image) - FULLY RESPONSIVE
    return (
      <div
        onClick={() => onRestaurantClick(restaurant)}
        className="group cursor-pointer"
      >
        <div
          className="relative overflow-hidden transition-all duration-300"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(32, 32, 32, 0.7), rgba(22, 22, 22, 0.9))'
              : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(252, 252, 252, 0.95))',
            backdropFilter: 'blur(30px)',
            border: isDark 
              ? '0.5px solid rgba(255, 255, 255, 0.12)' 
              : '0.5px solid rgba(0, 0, 0, 0.1)',
            boxShadow: isDark
              ? '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
              : '0 8px 32px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 1)',
            borderRadius: '24px',
            transform: 'translateY(0) scale(1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.01)';
            e.currentTarget.style.boxShadow = isDark
              ? `0 20px 50px ${accentColor.color}50, inset 0 1px 0 rgba(255, 255, 255, 0.08)`
              : `0 20px 50px ${accentColor.color}40, inset 0 1px 0 rgba(255, 255, 255, 1)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = isDark
              ? '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
              : '0 8px 32px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 1)';
          }}
        >
          {/* Large Image Top - Magazine Style - Responsive Height */}
          <div className="relative h-40 sm:h-48 md:h-52 overflow-hidden">
            <img 
              src={restaurant.image} 
              alt={restaurant.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            
            {/* Gradient Overlay */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 100%)',
              }}
            />

            {/* Logo Badge - Floating Top Right - Responsive */}
            <div 
              className="absolute top-3 right-3 sm:top-4 sm:right-4 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl overflow-hidden"
              style={{
                border: '3px solid rgba(255, 255, 255, 0.95)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              }}
            >
              <img 
                src={restaurant.logo} 
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Status Badge - Top Left - Responsive */}
            <div 
              className="absolute top-3 left-3 sm:top-4 sm:left-4 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5"
              style={{
                background: restaurant.isOpen 
                  ? 'rgba(34, 197, 94, 0.95)'
                  : 'rgba(239, 68, 68, 0.95)',
                backdropFilter: 'blur(10px)',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              }}
            >
              {restaurant.isOpen && <CheckCircle className="size-2.5 sm:size-3.5" strokeWidth={3} />}
              {restaurant.isOpen ? 'OCHIQ' : 'YOPIQ'}
            </div>

            {/* Bottom Info Overlay - Responsive */}
            <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div 
                  className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl"
                  style={{
                    background: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <Star className="size-3 sm:size-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {restaurant.rating}
                  </span>
                  <span className="text-[10px] sm:text-xs text-white/70">
                    ({restaurant.reviews})
                  </span>
                </div>

                <div 
                  className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl"
                  style={{
                    background: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <Clock className="size-3 sm:size-4 text-white/90" />
                  <span className="text-[10px] sm:text-xs font-semibold text-white/90">
                    {restaurant.deliveryTime}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Content Section - Responsive Padding */}
          <div className="p-3 sm:p-4 md:p-5">
            {/* Restaurant Name & Arrow - Responsive */}
            <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
              <h3 
                className="font-bold text-base sm:text-lg md:text-lg leading-tight"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {restaurant.name}
              </h3>
              <div 
                className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center transition-all"
                style={{
                  backgroundImage: accentColor.gradient,
                  boxShadow: `0 6px 16px ${accentColor.color}66`,
                }}
              >
                <ChevronRight className="size-4 sm:size-4 md:size-5 text-white" strokeWidth={2.5} />
              </div>
            </div>

            {/* Description - Responsive */}
            <p 
              className="text-[10px] sm:text-xs leading-relaxed mb-2 sm:mb-3 line-clamp-2"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              {restaurant.description}
            </p>

            {/* Cuisine Tags - Responsive */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              {restaurant.cuisine.map((item, index) => (
                <span
                  key={index}
                  className="inline-flex px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: `${accentColor.color}1a`,
                    color: accentColor.color,
                    border: `1px solid ${accentColor.color}33`,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>

            {/* Location - Responsive */}
            <div className="flex items-start gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <MapPin 
                className="size-3 sm:size-4 mt-0.5 flex-shrink-0" 
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} 
              />
              <p 
                className="text-[10px] sm:text-xs leading-snug line-clamp-1"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                {restaurant.address}
              </p>
            </div>

            {/* Feature Tags - Responsive */}
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {restaurant.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-sm sm:rounded-md text-[8px] sm:text-[9px] font-semibold"
                  style={{
                    background: isDark 
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.05)',
                    color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android Style - Bento Grid Layout (Split design) - FULLY RESPONSIVE
  return (
    <div
      onClick={() => onRestaurantClick(restaurant)}
      className="group cursor-pointer"
    >
      <div
        className="relative overflow-hidden transition-all duration-200"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, #1f1f1f, #171717)'
            : 'linear-gradient(135deg, #ffffff, #fafafa)',
          border: isDark 
            ? '1px solid rgba(255, 255, 255, 0.1)' 
            : '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: isDark
            ? '0 4px 20px rgba(0, 0, 0, 0.5)'
            : '0 4px 20px rgba(0, 0, 0, 0.1)',
          borderRadius: '20px',
        }}
      >
        {/* Split Layout - Image Left, Content Right - Responsive */}
        <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr] md:grid-cols-[140px_1fr] gap-0">
          {/* Left: Image Section - Responsive Width */}
          <div className="relative">
            <div className="h-full min-h-[160px] sm:min-h-[180px] md:min-h-[200px] relative overflow-hidden">
              <img 
                src={restaurant.image} 
                alt={restaurant.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              
              {/* Vertical Gradient */}
              <div 
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7))',
                }}
              />

              {/* Logo Badge - Center - Responsive */}
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl overflow-hidden"
                style={{
                  border: '3px solid rgba(255, 255, 255, 1)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                }}
              >
                <img 
                  src={restaurant.logo} 
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Status - Bottom - Responsive */}
              <div 
                className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg text-[8px] sm:text-[9px] font-black flex items-center gap-0.5 sm:gap-1 uppercase tracking-wider"
                style={{
                  background: restaurant.isOpen 
                    ? '#22c55e'
                    : '#ef4444',
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                }}
              >
                {restaurant.isOpen ? 'OPEN' : 'CLOSED'}
              </div>
            </div>
          </div>

          {/* Right: Content Section - Responsive Padding */}
          <div className="p-2.5 sm:p-3 md:p-4 flex flex-col justify-between min-w-0">
            {/* Top Section */}
            <div>
              {/* Name & Rating - Responsive */}
              <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <h3 
                  className="font-black text-sm sm:text-base md:text-base leading-tight tracking-tight"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {restaurant.name}
                </h3>
                <div 
                  className="flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg flex-shrink-0"
                  style={{
                    background: `${accentColor.color}26`,
                    border: `1.5px solid ${accentColor.color}`,
                  }}
                >
                  <Star className="size-2.5 sm:size-3 fill-current" style={{ color: accentColor.color }} />
                  <span 
                    className="text-[10px] sm:text-xs font-black"
                    style={{ color: accentColor.color }}
                  >
                    {restaurant.rating}
                  </span>
                </div>
              </div>

              {/* Category - Responsive */}
              <div 
                className="inline-flex px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-sm sm:rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider mb-1.5 sm:mb-2"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                  color: isDark ? '#ffffff' : '#111827',
                }}
              >
                {restaurant.category}
              </div>

              {/* Cuisine Pills - Responsive */}
              <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-2 sm:mb-3">
                {restaurant.cuisine.slice(0, 3).map((item, index) => (
                  <span
                    key={index}
                    className="px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded text-[8px] sm:text-[9px] font-bold"
                    style={{
                      background: `${accentColor.color}1a`,
                      color: accentColor.color,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>

              {/* Stats Bar - Responsive */}
              <div 
                className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-md sm:rounded-lg mb-2 sm:mb-3"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                }}
              >
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <TrendingUp className="size-3 sm:size-3.5" style={{ color: accentColor.color }} />
                  <span 
                    className="text-[9px] sm:text-[10px] font-bold"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
                  >
                    {restaurant.reviews}
                  </span>
                </div>

                <div 
                  className="w-px h-2.5 sm:h-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                  }}
                />

                <div className="flex items-center gap-0.5 sm:gap-1">
                  <Clock className="size-3 sm:size-3.5" style={{ color: accentColor.color }} />
                  <span 
                    className="text-[9px] sm:text-[10px] font-bold"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
                  >
                    {restaurant.deliveryTime}
                  </span>
                </div>
              </div>

              {/* Tags - Responsive */}
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {restaurant.tags.slice(0, 2).map((tag, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded text-[8px] sm:text-[9px] font-bold"
                    style={{
                      background: isDark 
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                      color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                    }}
                  >
                    <Award className="size-2.5 sm:size-3" />
                    {tag}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom: Action Button - Responsive */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestaurantClick(restaurant);
              }}
              className="mt-2 sm:mt-3 w-full py-2 sm:py-2.5 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-wide transition-all active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2"
              style={{
                backgroundImage: accentColor.gradient,
                color: '#ffffff',
                boxShadow: `0 4px 16px ${accentColor.color}66`,
              }}
            >
              OCHISH
              <ChevronRight className="size-3.5 sm:size-4" strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
