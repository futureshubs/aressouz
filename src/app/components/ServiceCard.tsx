import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Service } from '../data/services';
import { Star, MapPin, Briefcase, Check } from 'lucide-react';

interface ServiceCardProps {
  service: Service;
  onClick: () => void;
}

export const ServiceCard = React.memo(function ServiceCard({ service, onClick }: ServiceCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl transition-all duration-300 active:scale-95 text-left"
      style={{
        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 1)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
        boxShadow: isDark 
          ? '0 4px 16px rgba(0, 0, 0, 0.3)' 
          : '0 4px 16px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* Image */}
      <div className="relative w-full aspect-[3/2] overflow-hidden">
        <img 
          src={service.image} 
          alt={service.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${isDark ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.6)'}, transparent)`,
          }}
        />
        
        {/* Verified Badge */}
        {service.verified && (
          <div 
            className="absolute top-2 right-2 size-7 sm:size-8 rounded-full flex items-center justify-center backdrop-blur-xl border"
            style={{
              background: `${accentColor.color}ee`,
              borderColor: '#ffffff66',
            }}
          >
            <Check className="size-4 text-white" strokeWidth={3} />
          </div>
        )}

        {/* Rating */}
        <div 
          className="absolute top-2 left-2 px-2.5 py-1.5 rounded-xl backdrop-blur-xl border flex items-center gap-1.5"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
          }}
        >
          <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
          <span className="text-xs font-bold text-white">{service.rating}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-2">
        <h3 
          className="text-xs font-bold mb-0.5 line-clamp-1"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {service.name}
        </h3>
        <p 
          className="text-[10px] font-semibold mb-1.5 line-clamp-1"
          style={{ color: accentColor.color }}
        >
          {service.profession}
        </p>

        {/* Info */}
        <div className="space-y-1 mb-1.5">
          <div className="flex items-center gap-1">
            <Briefcase 
              className="size-3 flex-shrink-0" 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
            />
            <span 
              className="text-[10px] font-medium line-clamp-1"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              {service.experience}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin 
              className="size-3 flex-shrink-0" 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
            />
            <span 
              className="text-[10px] font-medium line-clamp-1"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              {service.location}
            </span>
          </div>
        </div>

        {/* Price */}
        <div 
          className="text-[10px] font-black mb-1"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {service.priceFrom.toLocaleString()} - {service.priceTo.toLocaleString()} {service.priceUnit}
        </div>

        {/* Reviews */}
        <div 
          className="text-[9px] font-medium mb-2"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
        >
          {service.reviewCount} ta sharh
        </div>

        {/* Contact Button */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `tel:${service.phone}`;
          }}
          className="w-full px-2 py-1.5 rounded-lg font-bold text-[10px] text-white text-center"
          style={{
            background: accentColor.color,
            boxShadow: `0 2px 8px ${accentColor.color}40`,
          }}
        >
          Bog'lanish
        </div>
      </div>
    </button>
  );
});