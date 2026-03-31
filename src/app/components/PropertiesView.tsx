import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Platform } from '../utils/platform';
import { PropertyCategoryCard } from './PropertyCategoryCard';
import { PropertyCard } from './PropertyCard';
import { PropertyDetailModal } from './PropertyDetailModal';
import { propertyCategories, properties, Property, PropertyCategory } from '../data/properties';
import { Home, FolderOpen } from 'lucide-react';

interface PropertiesViewProps {
  platform: Platform;
}

export function PropertiesView({ platform }: PropertiesViewProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [viewMode, setViewMode] = useState<'properties' | 'categories'>('properties');
  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const handleCategoryClick = (category: PropertyCategory) => {
    setSelectedCategory(category);
  };

  const handlePropertyClick = (property: Property) => {
    setSelectedProperty(property);
  };

  const handleCloseDetail = () => {
    setSelectedProperty(null);
  };

  const filteredProperties = selectedCategory
    ? properties.filter(p => p.categoryId === selectedCategory.id)
    : properties;

  const isAndroid = platform === 'android';

  return (
    <div className="min-h-screen">
      {/* Header with Toggle */}
      <div 
        className="sticky top-0 z-40 px-5 py-4"
        style={{
          background: isDark 
            ? 'rgba(0, 0, 0, 0.95)' 
            : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
        }}
      >
        {/* Toggle Buttons */}
        <div 
          className="flex items-center gap-2 p-1.5 rounded-2xl max-w-md mx-auto"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          }}
        >
          <button
            onClick={() => {
              setViewMode('properties');
              setSelectedCategory(null);
            }}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
            style={{
              background: viewMode === 'properties' ? accentColor.color : 'transparent',
              color: viewMode === 'properties' ? '#ffffff' : isDark ? '#ffffff' : '#111827',
            }}
          >
            <Home className="w-5 h-5" /> Uylar
          </button>
          <button
            onClick={() => setViewMode('categories')}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
            style={{
              background: viewMode === 'categories' ? accentColor.color : 'transparent',
              color: viewMode === 'categories' ? '#ffffff' : isDark ? '#ffffff' : '#111827',
            }}
          >
            <FolderOpen className="w-5 h-5" /> Kategoriyalar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-6">
        {viewMode === 'categories' ? (
          // Categories Grid
          <div className="grid grid-cols-2 gap-4">
            {propertyCategories.map((category) => (
              <PropertyCategoryCard
                key={category.id}
                category={category}
                onClick={() => {
                  handleCategoryClick(category);
                  setViewMode('properties');
                }}
              />
            ))}
          </div>
        ) : (
          // Properties Grid
          <div className="grid grid-cols-2 gap-4">
            {filteredProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onClick={() => handlePropertyClick(property)}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {viewMode === 'properties' && filteredProperties.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div 
              className="size-20 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <span className="text-4xl">🏠</span>
            </div>
            <h3 
              className="text-lg font-bold mb-2"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              E'lonlar topilmadi
            </h3>
            <p 
              className="text-sm"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
            >
              Bu kategoriyada hozircha e'lonlar yo'q
            </p>
          </div>
        )}
      </div>

      {/* Property Detail Modal */}
      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}