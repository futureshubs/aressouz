import { memo } from 'react';
import { PlaceCategory } from '../data/places';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';

interface CategoryCardProps {
  category: PlaceCategory;
  onCategoryClick: (categoryId: string) => void;
  platform: Platform;
}

export const CategoryCard = memo(function CategoryCard({ category, onCategoryClick, platform }: CategoryCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isIOS = platform === 'ios';

  return (
    <button
      onClick={() => onCategoryClick(category.id)}
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
      <div 
        className="relative overflow-hidden" 
        style={{ 
          borderRadius: isIOS ? '24px 24px 0 0' : '16px 16px 0 0', 
          height: '120px' 
        }}
      >
        <img
          src={category.image}
          alt={category.name}
          className="w-full h-full object-cover"
        />
        
        {/* Gradient Overlay */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)',
          }}
        />

        {/* Icon */}
        <div className="absolute bottom-3 left-3">
          <span className="text-3xl">{category.icon}</span>
        </div>

        {/* Count Badge */}
        <div 
          className="absolute top-3 right-3 px-2.5 py-1 rounded-full backdrop-blur-md"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
          }}
        >
          <span className="text-xs font-bold text-white">{category.count} ta</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 
          className="text-base font-bold text-center"
          style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
        >
          {category.name}
        </h3>
      </div>
    </button>
  );
});
