import { LayoutGrid, List } from 'lucide-react';
import { memo } from 'react';
import { useTheme } from '../context/ThemeContext';

interface ViewToggleProps {
  activeView: 'products' | 'catalog';
  onViewChange: (view: 'products' | 'catalog') => void;
}

export const ViewToggle = memo(function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-2">
          <button
            onClick={() => onViewChange('products')}
            className="flex-1 py-2 px-4 rounded-xl transition-all font-medium text-sm active:scale-98"
            style={{
              background: activeView === 'products'
                ? accentColor.gradient
                : isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                  : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
              color: activeView === 'products'
                ? '#ffffff'
                : isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)',
              border: activeView === 'products'
                ? `1px solid ${accentColor.color}4d`
                : isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
              boxShadow: activeView === 'products'
                ? isDark
                  ? `0 8px 24px ${accentColor.color}66, 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                  : `0 4px 16px ${accentColor.color}4d, 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)`
                : isDark
                  ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                  : '0 2px 6px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
            }}
          >
            <LayoutGrid className="w-4 h-4 mr-1.5" />
            Mahsulotlar
          </button>
          <button
            onClick={() => onViewChange('catalog')}
            className="flex-1 py-2 px-4 rounded-xl transition-all font-medium text-sm active:scale-98"
            style={{
              background: activeView === 'catalog'
                ? accentColor.gradient
                : isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                  : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
              color: activeView === 'catalog'
                ? '#ffffff'
                : isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)',
              border: activeView === 'catalog'
                ? `1px solid ${accentColor.color}4d`
                : isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
              boxShadow: activeView === 'catalog'
                ? isDark
                  ? `0 8px 24px ${accentColor.color}66, 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                  : `0 4px 16px ${accentColor.color}4d, 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)`
                : isDark
                  ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                  : '0 2px 6px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
            }}
          >
            <List className="w-4 h-4 mr-1.5" />
            Katalog
          </button>
        </div>
      </div>
    </div>
  );
});