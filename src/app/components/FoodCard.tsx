import { Plus, Star } from 'lucide-react';
import { memo, useRef } from 'react';
import { Food } from '../data/restaurants';
import { useTheme } from '../context/ThemeContext';
import { CardImageScroll } from './CardImageScroll';
import { collectProductGalleryImages } from '../utils/cardGalleryImages';

interface FoodCardProps {
  food: Food;
  onFoodClick: (food: Food) => void;
}

export const FoodCard = memo(function FoodCard({ food, onFoodClick }: FoodCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const blockOpenAfterGalleryScroll = useRef(false);
  const gallery = collectProductGalleryImages({
    ...food,
    images: (food as Food & { images?: string[] }).images,
  });
  const imageList = gallery.length > 0 ? gallery : food.image ? [food.image] : [];

  return (
    <div
      onClick={() => {
        if (blockOpenAfterGalleryScroll.current) return;
        onFoodClick(food);
      }}
      className="group cursor-pointer"
    >
      <div
        className="relative overflow-hidden transition-all duration-300"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(25, 25, 25, 0.98), rgba(15, 15, 15, 0.98))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
          backdropFilter: 'blur(30px)',
          border: isDark 
            ? '1px solid rgba(255, 255, 255, 0.08)' 
            : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark
            ? '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 1)',
          borderRadius: '24px',
          transform: 'scale(1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.04)';
          e.currentTarget.style.boxShadow = isDark
            ? `0 16px 48px ${accentColor.color}60, inset 0 1px 0 rgba(255, 255, 255, 0.08)`
            : `0 16px 48px ${accentColor.color}40, inset 0 1px 0 rgba(255, 255, 255, 1)`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = isDark
            ? '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 1)';
        }}
      >
        {/* Image Container */}
        <div className="relative h-36 sm:h-40 md:h-44 overflow-hidden rounded-t-[23px]">
          {imageList.length > 1 ? (
            <CardImageScroll
              images={imageList}
              alt={food.name}
              dotColor={accentColor.color}
              onUserInteracted={() => {
                blockOpenAfterGalleryScroll.current = true;
                window.setTimeout(() => {
                  blockOpenAfterGalleryScroll.current = false;
                }, 450);
              }}
              imgClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : imageList.length === 1 ? (
            <img 
              src={imageList[0]} 
              alt={food.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
            />
          )}
          
          {/* Dark gradient overlay */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7) 100%)',
            }}
          />

          {/* Rating Badge - Top Right */}
          <div 
            className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-xl"
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(20px)',
              border: '0.5px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <Star className="size-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-bold text-white">
              {food.rating}
            </span>
          </div>

          {/* Discount Badge - Top Left (if available) */}
          {food.discount && (
            <div 
              className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl font-bold text-xs text-white"
              style={{
                backgroundImage: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.5)',
              }}
            >
              -{food.discount}%
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-3">
          {/* Food Name */}
          <h3 
            className="text-sm font-bold leading-tight line-clamp-2 mb-2 min-h-[2.5rem]"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            {food.name}
          </h3>
          
          {/* Stats Row - Weight and Calories */}
          <div className="flex items-center gap-2 text-[10px] mb-3">
            <span 
              className="font-semibold"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
            >
              {food.weight}
            </span>
            <div 
              className="w-1 h-1 rounded-full"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
              }}
            />
            <span 
              className="font-semibold"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
            >
              {food.calories} kcal
            </span>
          </div>

          {/* Price & Action Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <p 
                className="text-lg font-black leading-none mb-0.5"
                style={{ 
                  color: accentColor.color,
                  textShadow: isDark ? `0 0 20px ${accentColor.color}40` : 'none'
                }}
              >
                {food.price.toLocaleString('uz-UZ')}
              </p>
              <p 
                className="text-[9px] font-semibold"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
              >
                so'm
              </p>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFoodClick(food);
              }}
              className="p-2.5 rounded-2xl transition-all active:scale-90"
              style={{
                backgroundImage: accentColor.gradient,
                boxShadow: `0 8px 24px ${accentColor.color}66`,
              }}
            >
              <Plus className="size-5 text-white" strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
