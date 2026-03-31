import { ChevronRight } from 'lucide-react';
import { Catalog } from '../data/categories';
import { useTheme } from '../context/ThemeContext';

interface CatalogListProps {
  catalogs: Catalog[];
  onCatalogSelect: (catalogId: string) => void;
}

export function CatalogList({ catalogs, onCatalogSelect }: CatalogListProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto">
        <h2 
          className="text-xl sm:text-2xl mb-4 sm:mb-6 font-semibold"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          Kataloglar
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {catalogs.map((catalog) => (
            <button
              key={catalog.id}
              onClick={() => onCatalogSelect(catalog.id)}
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
              <div className="aspect-square overflow-hidden relative">
                <img
                  src={catalog.image}
                  alt={catalog.name}
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
                    className="font-bold text-sm sm:text-base drop-shadow-lg"
                    style={{ color: '#ffffff' }}
                  >
                    {catalog.name}
                  </h3>
                  <ChevronRight 
                    className="size-4 transition-all group-hover:translate-x-1 drop-shadow-lg" 
                    style={{ 
                      color: accentColor.color
                    }}
                    strokeWidth={2.5}
                  />
                </div>
                <p 
                  className="text-xs font-medium drop-shadow mt-1"
                  style={{ color: 'rgba(255, 255, 255, 0.8)' }}
                >
                  {catalog.categories.length} kategoriya
                </p>
              </div>

              {/* Hover Border Effect */}
              <div 
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${accentColor.color}15, transparent 50%)`,
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}