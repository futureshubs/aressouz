import { useTheme } from '../context/ThemeContext';
import { RentalCategory } from '../data/rentals';

interface RentalCategoryCardProps {
  category: RentalCategory;
  onClick: () => void;
}

export function RentalCategoryCard({ category, onClick }: RentalCategoryCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl transition-all duration-300 active:scale-95"
      style={{
        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.9)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
      }}
    >
      {/* Image Background */}
      <div className="relative h-32 overflow-hidden">
        <img 
          src={category.image} 
          alt={category.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${isDark ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.7)'}, transparent)`,
          }}
        />
        
        {/* Icon */}
        <div className="absolute top-3 left-3">
          <div 
            className="size-10 rounded-xl flex items-center justify-center backdrop-blur-xl border"
            style={{
              background: `${accentColor.color}33`,
              borderColor: `${accentColor.color}66`,
            }}
          >
            <span className="text-xl">{category.icon}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 
          className="font-medium mb-1 text-left"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {category.name}
        </h3>
        <p 
          className="text-sm text-left"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
        >
          {category.itemCount} ta mahsulot
        </p>
      </div>
    </button>
  );
}
