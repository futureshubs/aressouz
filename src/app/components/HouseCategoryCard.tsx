import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { HouseCategory } from '../data/houses';

interface HouseCategoryCardProps {
  category: HouseCategory;
  onClick: () => void;
}

export const HouseCategoryCard = React.memo(function HouseCategoryCard({ category, onClick }: HouseCategoryCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl sm:rounded-3xl transition-all duration-300 active:scale-95"
      style={{
        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 1)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
        boxShadow: isDark 
          ? '0 4px 16px rgba(0, 0, 0, 0.3)' 
          : '0 4px 16px rgba(0, 0, 0, 0.08)',
      }}
    >
      <div className="relative h-32 sm:h-36 overflow-hidden">
        <img 
          src={category.image} 
          alt={category.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${isDark ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.7)'}, transparent)`,
          }}
        />
        
        <div className="absolute top-2 left-2">
          <div 
            className="size-10 sm:size-12 rounded-xl flex items-center justify-center backdrop-blur-xl border"
            style={{
              background: `${accentColor.color}33`,
              borderColor: `${accentColor.color}66`,
            }}
          >
            <span className="text-xl sm:text-2xl">{category.icon}</span>
          </div>
        </div>
      </div>

      <div className="p-2 sm:p-2.5">
        <h3 
          className="text-xs sm:text-sm font-semibold mb-0.5 text-left line-clamp-1"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {category.name}
        </h3>
        <p 
          className="text-[10px] sm:text-xs text-left font-medium line-clamp-1"
          style={{ color: accentColor.color }}
        >
          {category.count} ta uy
        </p>
      </div>
    </button>
  );
});
