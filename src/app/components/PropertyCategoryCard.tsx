import { useTheme } from '../context/ThemeContext';
import { PropertyCategory } from '../data/properties';

interface PropertyCategoryCardProps {
  category: PropertyCategory;
  onClick: () => void;
}

export function PropertyCategoryCard({ category, onClick }: PropertyCategoryCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl transition-all duration-300 active:scale-95"
      style={{
        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 1)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
        boxShadow: isDark 
          ? '0 8px 32px rgba(0, 0, 0, 0.4)' 
          : '0 8px 32px rgba(0, 0, 0, 0.12)',
      }}
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3] overflow-hidden">
        <img 
          src={category.image} 
          alt={category.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${isDark ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.7)'}, transparent 60%)`,
          }}
        />
        
        {/* Icon */}
        <div 
          className="absolute top-3 left-3 size-14 rounded-2xl flex items-center justify-center text-3xl backdrop-blur-xl border"
          style={{
            background: `${accentColor.color}ee`,
            borderColor: 'rgba(255, 255, 255, 0.3)',
            boxShadow: `0 8px 24px ${accentColor.color}60`,
          }}
        >
          {category.icon}
        </div>

        {/* Count Badge */}
        <div 
          className="absolute top-3 right-3 px-4 py-2 rounded-xl backdrop-blur-xl border"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
          }}
        >
          <span className="text-sm font-bold text-white">{category.count} ta</span>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 
            className="text-xl font-black mb-1"
            style={{ color: '#ffffff' }}
          >
            {category.name}
          </h3>
          <p 
            className="text-sm font-medium"
            style={{ color: 'rgba(255, 255, 255, 0.8)' }}
          >
            {category.description}
          </p>
        </div>
      </div>
    </button>
  );
}
