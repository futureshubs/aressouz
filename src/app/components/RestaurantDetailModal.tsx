import { X, Star, MapPin, Phone, Clock, Truck, Package, ChevronLeft } from 'lucide-react';
import { memo, useState, useEffect } from 'react';
import { Restaurant, Food } from '../data/restaurants';
import { FoodCard } from './FoodCard';
import { FoodDetailModal } from './FoodDetailModal';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { ExpandableText } from './ui/ExpandableText';

interface RestaurantDetailModalProps {
  restaurant: Restaurant;
  onClose: () => void;
  onAddToCart: (food: Food, quantity: number, selectedAddons: string[]) => void;
  platform: Platform;
}

export const RestaurantDetailModal = memo(function RestaurantDetailModal({ restaurant, onClose, onAddToCart, platform }: RestaurantDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const isIOS = platform === 'ios';
  const isDark = theme === 'dark';

  return (
    <>
      <div 
        className="fixed inset-0 app-safe-pad z-50 overflow-hidden"
        style={{
          background: isDark ? '#000000' : '#f9fafb',
        }}
      >
        {/* Header with Image */}
        <div className="relative h-64 overflow-hidden">
          <img 
            src={restaurant.image} 
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />

          {/* Back Button */}
          <button
            onClick={onClose}
            className="absolute top-6 left-4 z-10 p-2.5 rounded-2xl transition-all active:scale-90"
            style={{
              background: isIOS
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))'
                : 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
              border: isIOS ? '0.5px solid rgba(255, 255, 255, 0.2)' : 'none',
            }}
          >
            {isIOS ? (
              <ChevronLeft className="size-5 text-white" strokeWidth={2.5} />
            ) : (
              <X className="size-5 text-white" strokeWidth={2.5} />
            )}
          </button>

          {/* Logo & Info */}
          <div className="absolute bottom-6 left-4 right-4 flex items-end gap-4">
            <div 
              className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0"
              style={{
                border: '3px solid rgba(255, 255, 255, 0.95)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              }}
            >
              <img 
                src={restaurant.logo} 
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex-1 pb-2">
              <h1 
                className="text-2xl font-bold text-white mb-1"
                style={{
                  textShadow: '0 2px 12px rgba(0, 0, 0, 0.5)',
                }}
              >
                {restaurant.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <Star className="size-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-bold text-white">
                    {restaurant.rating}
                  </span>
                  <span className="text-xs text-white/80">
                    ({restaurant.reviews} sharh)
                  </span>
                </div>
                <div 
                  className="px-2 py-0.5 rounded-md text-xs font-bold"
                  style={{
                    background: restaurant.isOpen 
                      ? 'rgba(34, 197, 94, 0.9)'
                      : 'rgba(239, 68, 68, 0.9)',
                    color: '#ffffff',
                  }}
                >
                  {restaurant.isOpen ? 'Ochiq' : 'Yopiq'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto" style={{ height: 'calc(100vh - 256px)' }}>
          <div className="px-4 py-6 space-y-6">
            {/* Description */}
            <div>
              <ExpandableText
                text={restaurant.description}
                mobileLines={2}
                minToggleChars={140}
                className="text-sm leading-relaxed"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
                moreLabel="Batafsil"
                lessLabel="Yopish"
                toggleColor={accentColor.color}
              />
            </div>

            {/* Cuisine Tags */}
            <div>
              <h3 
                className="font-bold mb-3"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                Oshxona turi
              </h3>
              <div className="flex flex-wrap gap-2">
                {restaurant.cuisine.map((item, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: isDark 
                        ? `${accentColor.color}1a`
                        : `${accentColor.color}15`,
                      color: accentColor.color,
                      border: `1px solid ${accentColor.color}33`,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Delivery Time */}
              <div 
                className="p-4 rounded-xl"
                style={{
                  background: isDark 
                    ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))'
                    : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
                  backdropFilter: isIOS ? 'blur(20px)' : undefined,
                  border: isDark 
                    ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.05)')
                    : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)'),
                  boxShadow: isDark
                    ? 'none'
                    : (isIOS ? '0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : '0 2px 8px rgba(0, 0, 0, 0.04)'),
                }}
              >
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                  style={{
                    background: `${accentColor.color}1a`,
                    border: `1px solid ${accentColor.color}33`,
                  }}
                >
                  <Truck className="size-5" style={{ color: accentColor.color }} />
                </div>
                <p 
                  className="text-xs mb-1"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Yetkazish
                </p>
                <p 
                  className="text-sm font-bold"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {restaurant.deliveryTime}
                </p>
              </div>

              {/* Min Order */}
              <div 
                className="p-4 rounded-xl"
                style={{
                  background: isDark 
                    ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))'
                    : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
                  backdropFilter: isIOS ? 'blur(20px)' : undefined,
                  border: isDark 
                    ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.05)')
                    : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)'),
                  boxShadow: isDark
                    ? 'none'
                    : (isIOS ? '0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : '0 2px 8px rgba(0, 0, 0, 0.04)'),
                }}
              >
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                  style={{
                    background: `${accentColor.color}1a`,
                    border: `1px solid ${accentColor.color}33`,
                  }}
                >
                  <Package className="size-5" style={{ color: accentColor.color }} />
                </div>
                <p 
                  className="text-xs mb-1"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Min buyurtma
                </p>
                <p 
                  className="text-sm font-bold"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {restaurant.minOrder.toLocaleString('uz-UZ')} so'm
                </p>
              </div>
            </div>

            {/* Contact Info */}
            <div 
              className="p-4 rounded-xl space-y-3"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))'
                  : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
                backdropFilter: isIOS ? 'blur(20px)' : undefined,
                border: isDark 
                  ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.05)')
                  : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)'),
                boxShadow: isDark
                  ? 'none'
                  : (isIOS ? '0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : '0 2px 8px rgba(0, 0, 0, 0.04)'),
              }}
            >
              <h3 
                className="font-bold mb-3"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                Aloqa
              </h3>

              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `${accentColor.color}1a`,
                  }}
                >
                  <MapPin className="size-5" style={{ color: accentColor.color }} />
                </div>
                <div className="flex-1">
                  <p 
                    className="text-xs mb-0.5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Manzil
                  </p>
                  <p 
                    className="text-sm font-medium"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    {restaurant.address}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `${accentColor.color}1a`,
                  }}
                >
                  <Phone className="size-5" style={{ color: accentColor.color }} />
                </div>
                <div className="flex-1">
                  <p 
                    className="text-xs mb-0.5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Telefon
                  </p>
                  <p 
                    className="text-sm font-medium"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    {restaurant.phone}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `${accentColor.color}1a`,
                  }}
                >
                  <Clock className="size-5" style={{ color: accentColor.color }} />
                </div>
                <div className="flex-1">
                  <p 
                    className="text-xs mb-0.5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Ish vaqti
                  </p>
                  <p 
                    className="text-sm font-medium"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    {restaurant.workingHours}
                  </p>
                </div>
              </div>
            </div>

            {/* Foods Menu */}
            <div>
              <h3 
                className="font-bold mb-4"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                Menyu ({restaurant.foods.length} ta taom)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {restaurant.foods.map((food) => (
                  <FoodCard
                    key={food.id}
                    food={food}
                    onFoodClick={setSelectedFood}
                    platform={platform}
                  />
                ))}
              </div>
            </div>

            {/* Bottom Padding */}
            <div className="h-4" />
          </div>
        </div>
      </div>

      {/* Food Detail Modal */}
      {selectedFood && (
        <FoodDetailModal
          food={selectedFood}
          onClose={() => setSelectedFood(null)}
          onAddToCart={onAddToCart}
          platform={platform}
        />
      )}
    </>
  );
});
