import { useTheme } from '../context/ThemeContext';
import { Property } from '../data/properties';
import { MapPin, Home, Bath, Maximize2, Heart, Building2, HomeIcon } from 'lucide-react';
import { useState } from 'react';

interface PropertyCardProps {
  property: Property;
  onClick: () => void;
}

export function PropertyCard({ property, onClick }: PropertyCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [isLiked, setIsLiked] = useState(false);

  const getCategoryLabel = (categoryId: string) => {
    const labels: Record<string, string> = {
      apartment: 'Kvartira',
      house: 'Uy',
      cottage: 'Kottej',
      townhouse: 'Taunxaus',
      commercial: 'Tijorat',
      land: 'Yer',
    };
    return labels[categoryId] || 'Boshqa';
  };

  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'apartment':
        return <Building2 className="size-4 mr-1" />;
      case 'house':
        return <HomeIcon className="size-4 mr-1" />;
      case 'cottage':
        return <Home className="size-4 mr-1" />;
      default:
        return <Building2 className="size-4 mr-1" />;
    }
  };

  return (
    <div
      className="relative group w-full overflow-hidden rounded-3xl transition-all duration-300 active:scale-95"
      style={{
        background: isDark ? '#1a1a1a' : '#ffffff',
        boxShadow: isDark 
          ? '0 4px 24px rgba(0, 0, 0, 0.4)' 
          : '0 4px 24px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3] overflow-hidden" onClick={onClick}>
        <img 
          src={property.images[0]} 
          alt={property.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Category Badge */}
        <div 
          className="absolute top-3 left-3 px-3 py-1.5 rounded-xl font-bold text-sm backdrop-blur-xl flex items-center"
          style={{
            background: `${accentColor.color}`,
            color: '#ffffff',
          }}
        >
          {getCategoryIcon(property.categoryId)}
          {getCategoryLabel(property.categoryId)}
        </div>

        {/* Like Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsLiked(!isLiked);
          }}
          className="absolute top-3 right-3 size-10 rounded-xl backdrop-blur-xl flex items-center justify-center transition-all duration-300 active:scale-90"
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <Heart 
            className="size-5" 
            style={{ 
              color: isLiked ? '#ff4444' : '#ffffff',
              fill: isLiked ? '#ff4444' : 'none',
            }}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-4" onClick={onClick}>
        {/* Title */}
        <h3 
          className="text-base font-bold mb-2 line-clamp-2"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {property.title}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin 
            className="size-4 flex-shrink-0" 
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
          />
          <span 
            className="text-xs font-medium line-clamp-1"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            {property.district}
          </span>
        </div>

        {/* Info Icons */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <Home 
              className="size-4" 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
            />
            <span 
              className="text-sm font-bold"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              {property.rooms}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath 
              className="size-4" 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
            />
            <span 
              className="text-sm font-bold"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              {Math.max(1, Math.floor(property.rooms / 2))}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Maximize2 
              className="size-4" 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
            />
            <span 
              className="text-sm font-bold"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              {property.area} m²
            </span>
          </div>
        </div>

        {/* Price */}
        <div>
          <span 
            className="text-xs font-medium block mb-0.5"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
          >
            Narx
          </span>
          <div className="flex items-baseline gap-1">
            <span 
              className="text-xl font-black"
              style={{ color: accentColor.color }}
            >
              {property.price.toLocaleString()}
            </span>
            <span 
              className="text-sm font-bold"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
            >
              USD
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}