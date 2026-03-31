import { memo } from 'react';
import { CarCategory } from '../data/cars';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';

interface CarCategoryCardProps {
  category: CarCategory;
  platform: Platform;
  onClick: () => void;
}

export const CarCategoryCard = memo(function CarCategoryCard({ 
  category, 
  platform, 
  onClick 
}: CarCategoryCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isIOS = platform === 'ios';

  if (isIOS) {
    // iOS Neumorphic Style
    return (
      <button
        onClick={onClick}
        className="relative overflow-hidden rounded-2xl transition-all duration-300 active:scale-95"
        style={{
          background: isDark ? '#1a1a1a' : '#f0f0f0',
          boxShadow: isDark
            ? '8px 8px 16px #0d0d0d, -8px -8px 16px #272727'
            : '8px 8px 16px #d1d1d1, -8px -8px 16px #ffffff',
        }}
      >
        {/* Image */}
        <div className="relative h-32 sm:h-40 overflow-hidden">
          <img
            src={category.image}
            alt={category.name}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
          />
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)'}, transparent)`,
            }}
          />
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Emoji Icon */}
          <div className="text-3xl mb-2">{category.icon}</div>

          {/* Title */}
          <h3 
            className="text-base sm:text-lg font-bold mb-1"
            style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
          >
            {category.name}
          </h3>

          {/* Description */}
          <p 
            className="text-xs sm:text-sm mb-3 line-clamp-2"
            style={{ color: isDark ? '#888888' : '#666666' }}
          >
            {category.description}
          </p>

          {/* Count Badge */}
          <div 
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg"
            style={{
              background: isDark ? '#1a1a1a' : '#f0f0f0',
              boxShadow: isDark
                ? 'inset 3px 3px 6px #0d0d0d, inset -3px -3px 6px #272727'
                : 'inset 3px 3px 6px #d1d1d1, inset -3px -3px 6px #ffffff',
            }}
          >
            <span 
              className="text-xs font-bold"
              style={{ color: accentColor.color }}
            >
              {category.count} ta
            </span>
          </div>
        </div>
      </button>
    );
  }

  // Android Material Design
  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95"
      style={{
        background: isDark ? '#1e1e1e' : '#ffffff',
        boxShadow: isDark
          ? '0 4px 12px rgba(0, 0, 0, 0.5)'
          : '0 4px 12px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Image */}
      <div className="relative h-32 sm:h-40 overflow-hidden">
        <img
          src={category.image}
          alt={category.name}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
        />
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
          }}
        />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Emoji Icon */}
        <div className="text-3xl mb-2">{category.icon}</div>

        {/* Title */}
        <h3 
          className="text-base sm:text-lg font-bold mb-1"
          style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
        >
          {category.name}
        </h3>

        {/* Description */}
        <p 
          className="text-xs sm:text-sm text-gray-400 mb-3 line-clamp-2"
        >
          {category.description}
        </p>

        {/* Count Badge */}
        <div 
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg"
          style={{
            background: `${accentColor.color}20`,
          }}
        >
          <span 
            className="text-xs font-bold"
            style={{ color: accentColor.color }}
          >
            {category.count} ta
          </span>
        </div>
      </div>
    </button>
  );
});
