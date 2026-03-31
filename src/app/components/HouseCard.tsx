import React from 'react';
import { MapPin, Maximize2, BedDouble, Bath } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { House, formatCurrency } from '../data/houses';

interface HouseCardProps {
  house: House;
  onClick: () => void;
}

export const HouseCard = React.memo(function HouseCard({ house, onClick }: HouseCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      onClick={onClick}
      className="rounded-2xl sm:rounded-3xl overflow-hidden group cursor-pointer transition-transform active:scale-98"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))'
          : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
        boxShadow: isDark
          ? '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
          : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'}`
      }}
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3] overflow-hidden">
        <img 
          src={house.images[0]} 
          alt={house.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)'}, transparent)`,
          }}
        />
        
        {/* Condition Badge */}
        <div 
          className="absolute top-2 left-2 px-3 py-1.5 rounded-xl backdrop-blur-xl text-xs font-bold"
          style={{
            background: accentColor.color,
            color: '#ffffff',
          }}
        >
          {house.condition === 'yangi' ? 'Yangi qurilish' : house.condition === 'ta\'mirlangan' ? 'Ta\'mirlangan' : house.categoryId === 'kvartira' ? 'Kvartira' : 'Villa'}
        </div>

        {/* Mortgage Badge */}
        {house.mortgageAvailable && (
          <div 
            className="absolute bottom-2 left-2 px-2.5 py-1.5 rounded-xl backdrop-blur-xl text-xs font-bold flex items-center gap-1"
            style={{
              background: 'rgba(59, 130, 246, 0.95)',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
          >
            <span>🏦</span>
            <span>Ipoteka</span>
          </div>
        )}

        {/* Halal Installment Badge */}
        {house.hasHalalInstallment && (
          <div 
            className="absolute top-2 right-2 px-2.5 py-1.5 rounded-xl backdrop-blur-xl text-xs font-bold flex items-center gap-1"
            style={{
              background: accentColor.color,
              color: '#ffffff',
              boxShadow: `0 4px 12px ${accentColor.color}50`
            }}
          >
            <span>✓</span>
            <span>Xalol Nasiya</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 lg:p-5">
        {/* Title */}
        <h3 
          className="text-sm sm:text-base lg:text-lg font-bold mb-2 sm:mb-3 line-clamp-1"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {house.title}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1.5 mb-2 sm:mb-3">
          <MapPin 
            className="size-3.5 sm:size-4 flex-shrink-0" 
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
            strokeWidth={2}
          />
          <p 
            className="text-xs sm:text-sm font-medium line-clamp-1"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            {house.district}, {house.region}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4">
          <div className="flex items-center gap-1">
            <BedDouble 
              className="size-3.5 sm:size-4 lg:size-5" 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
              strokeWidth={2}
            />
            <span 
              className="text-xs sm:text-sm font-medium"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              {house.rooms}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Bath 
              className="size-3.5 sm:size-4 lg:size-5" 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
              strokeWidth={2}
            />
            <span 
              className="text-xs sm:text-sm font-medium"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              {house.bathrooms}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Maximize2 
              className="size-3.5 sm:size-4 lg:size-5" 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
              strokeWidth={2}
            />
            <span 
              className="text-xs sm:text-sm font-medium"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              {house.area} m²
            </span>
          </div>
        </div>

        {/* Price */}
        <div>
          <p 
            className="text-xs sm:text-sm font-medium mb-0.5 sm:mb-1"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
          >
            Narxi
          </p>
          <p 
            className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black"
            style={{ color: accentColor.color }}
          >
            {formatCurrency(house.price, house.currency)} {house.currency}
          </p>
        </div>
      </div>
    </div>
  );
});