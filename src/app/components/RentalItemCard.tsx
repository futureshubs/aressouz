import { useTheme } from '../context/ThemeContext';
import { RentalItem } from '../data/rentals';
import { MapPin, Star, Calendar, TrendingUp } from 'lucide-react';

interface RentalItemCardProps {
  item: RentalItem;
  onClick: () => void;
}

export function RentalItemCard({ item, onClick }: RentalItemCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl sm:rounded-3xl transition-all duration-300 active:scale-95 text-left w-full"
      style={{
        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 1)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
        boxShadow: isDark 
          ? '0 4px 16px rgba(0, 0, 0, 0.3)' 
          : '0 4px 16px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* Image Section */}
      <div className="relative h-36 sm:h-44 md:h-48 lg:h-52 overflow-hidden">
        <img 
          src={item.image} 
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Gradient Overlay */}
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)'}, transparent 60%)`,
          }}
        />
        
        {/* Available Badge */}
        {item.available && (
          <div 
            className="absolute top-3 right-3 px-3 py-1.5 rounded-full backdrop-blur-xl border font-medium"
            style={{
              background: `${accentColor.color}22`,
              borderColor: `${accentColor.color}88`,
              color: accentColor.color,
              boxShadow: `0 4px 12px ${accentColor.color}44`,
            }}
          >
            <div className="flex items-center gap-1.5">
              <div 
                className="size-1.5 rounded-full animate-pulse"
                style={{ background: accentColor.color }}
              />
              <span className="text-xs">Mavjud</span>
            </div>
          </div>
        )}
        
        {/* Rating Badge */}
        <div 
          className="absolute bottom-3 left-3 px-2.5 py-1.5 rounded-xl backdrop-blur-xl border"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <Star className="size-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-white font-semibold">{item.rating}</span>
            <span className="text-xs text-white/60">({item.reviews})</span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Title */}
        <h3 
          className="font-semibold mb-2 line-clamp-2 leading-snug"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {item.name}
        </h3>
        
        {/* Location */}
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin 
            className="size-3.5 flex-shrink-0" 
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} 
          />
          <span 
            className="text-xs line-clamp-1"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            {item.location}
          </span>
        </div>

        {/* Divider */}
        <div 
          className="h-px mb-3"
          style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
        />

        {/* Price Section */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1 mb-0.5">
              <span 
                className="text-xl font-bold leading-none"
                style={{ color: accentColor.color }}
              >
                {item.price.toLocaleString()}
              </span>
              <span 
                className="text-xs leading-none font-medium"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
              >
                so'm
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar 
                className="size-3" 
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} 
              />
              <span 
                className="text-[11px] font-medium"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
              >
                kunlik
              </span>
            </div>
          </div>

          {/* Action Button */}
          <div 
            className="size-10 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
            style={{
              background: `${accentColor.color}15`,
              border: `1.5px solid ${accentColor.color}40`,
            }}
          >
            <TrendingUp 
              className="size-4" 
              style={{ color: accentColor.color }} 
            />
          </div>
        </div>
      </div>
    </button>
  );
}