import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { ServiceCategory } from '../data/services';

interface ServiceCategoryCardProps {
  category: ServiceCategory;
  onClick: () => void;
}

export const ServiceCategoryCard = React.memo(function ServiceCategoryCard({ category, onClick }: ServiceCategoryCardProps) {
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

      <div className="p-2.5 sm:p-3">
        <h3 
          className="text-sm sm:text-base font-semibold mb-1 text-left line-clamp-1"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {category.name}
        </h3>
        <p 
          className="text-xs mb-1.5 text-left line-clamp-2"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
        >
          {category.description}
        </p>
        <p 
          className="text-xs text-left font-medium"
          style={{ color: accentColor.color }}
        >
          {category.serviceCount} ta usta
        </p>
      </div>
    </button>
  );
});