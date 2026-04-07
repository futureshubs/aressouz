import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Category } from '../data/categories';
import { useTheme } from '../context/ThemeContext';
import { useHeaderSearchOptional } from '../context/HeaderSearchContext';
import { matchesHeaderSearch, normalizeHeaderSearch } from '../utils/headerSearchMatch';

interface CategoryListProps {
  catalogName: string;
  categories: Category[];
  onCategorySelect: (categoryId: string) => void;
  onBack: () => void;
}

export function CategoryList({ catalogName, categories, onCategorySelect, onBack }: CategoryListProps) {
  const { theme, accentColor } = useTheme();
  const { query: headerSearch } = useHeaderSearchOptional();
  const isDark = theme === 'dark';

  const visibleCategories = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return categories;
    return categories.filter((c) => matchesHeaderSearch(headerSearch, [c.name, catalogName]));
  }, [categories, catalogName, headerSearch]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto">
        {/* Back button and title */}
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <button
            onClick={onBack}
            className="p-2 rounded-xl transition-all active:scale-90"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
              border: isDark 
                ? '1px solid rgba(255, 255, 255, 0.1)' 
                : '1px solid rgba(0, 0, 0, 0.1)',
              color: isDark ? '#ffffff' : '#374151',
              boxShadow: isDark 
                ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                : '0 2px 6px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.08))'
                : 'linear-gradient(145deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.04))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDark
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))';
            }}
          >
            <ChevronLeft className="size-5" strokeWidth={2.5} />
          </button>
          <h2 
            className="text-xl sm:text-2xl font-semibold"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            {catalogName}
          </h2>
        </div>
        
        {visibleCategories.length === 0 && normalizeHeaderSearch(headerSearch) ? (
          <p className="text-center py-12 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}>
            «{headerSearch.trim()}» bo‘yicha kategoriya topilmadi.
          </p>
        ) : null}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategorySelect(category.id)}
              className="group relative rounded-2xl overflow-hidden transition-all active:scale-95"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))'
                  : 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(250, 250, 250, 0.9))',
                border: isDark 
                  ? '1px solid rgba(255, 255, 255, 0.15)' 
                  : '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: isDark 
                  ? '0 8px 20px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  : '0 4px 16px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = `${accentColor.color}60`;
                e.currentTarget.style.boxShadow = isDark
                  ? `0 12px 28px ${accentColor.color}30, 0 8px 20px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.15)`
                  : `0 8px 24px ${accentColor.color}20, 0 4px 16px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 1)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = isDark 
                  ? 'rgba(255, 255, 255, 0.15)' 
                  : 'rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.boxShadow = isDark 
                  ? '0 8px 20px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  : '0 4px 16px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
              }}
            >
              {/* Image */}
              <div className="h-32 sm:h-40 overflow-hidden relative">
                <img
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div 
                  className="absolute inset-0"
                  style={{
                    background: isDark
                      ? 'linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.2), transparent)'
                      : 'linear-gradient(to top, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.1), transparent)',
                  }}
                />
              </div>
              
              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <h3 
                    className="font-semibold text-sm sm:text-base drop-shadow-lg"
                    style={{ color: '#ffffff' }}
                  >
                    {category.name}
                  </h3>
                  <ChevronRight 
                    className="size-4 transition-all group-hover:translate-x-1 drop-shadow-lg" 
                    style={{ 
                      color: accentColor.color
                    }}
                    strokeWidth={2.5}
                  />
                </div>
              </div>

              {/* Hover Border Effect */}
              <div 
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${accentColor.color}12, transparent 50%)`,
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}