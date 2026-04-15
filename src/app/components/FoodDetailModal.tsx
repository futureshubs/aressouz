import { X, Star, Flame, Leaf, Plus, Minus, ChevronLeft, ShoppingCart, Clock, Truck, Shield, Heart, Share2, MessageCircle, CreditCard, Package, ChefHat, Timer, Users, ThumbsUp, ChevronRight } from 'lucide-react';
import { memo, useState, useRef } from 'react';
import { Food } from '../data/restaurants';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import { shareTitleTextUrl } from '../utils/marketplaceNativeBridge';

interface FoodDetailModalProps {
  food: Food;
  onClose: () => void;
  onAddToCart: (food: Food, quantity: number, selectedAddons: string[]) => void;
  platform: Platform;
  restaurantName?: string;
}

export const FoodDetailModal = memo(function FoodDetailModal({ food, onClose, onAddToCart, platform, restaurantName }: FoodDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'description' | 'nutrition' | 'reviews'>('description');
  const [isLiked, setIsLiked] = useState(false);
  const [isInCart, setIsInCart] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isIOS = platform === 'ios';
  const isDark = theme === 'dark';

  // Food images gallery
  const foodImages = [
    food.image,
    food.image, // Demo: same image repeated
    food.image,
    food.image,
  ];

  const handleImageScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollAmount = container.offsetWidth;
    
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      setCurrentImageIndex(Math.max(0, currentImageIndex - 1));
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setCurrentImageIndex(Math.min(foodImages.length - 1, currentImageIndex + 1));
    }
  };

  const toggleAddon = (addonId: string) => {
    setSelectedAddons(prev => {
      if (prev.includes(addonId)) {
        // Remove from selected and reset quantity
        setAddonQuantities(prevQty => {
          const newQty = { ...prevQty };
          delete newQty[addonId];
          return newQty;
        });
        return prev.filter(id => id !== addonId);
      } else {
        // Add to selected with quantity 1
        setAddonQuantities(prevQty => ({ ...prevQty, [addonId]: 1 }));
        return [...prev, addonId];
      }
    });
  };

  const updateAddonQuantity = (addonId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      // Remove addon if quantity is 0
      setSelectedAddons(prev => prev.filter(id => id !== addonId));
      setAddonQuantities(prevQty => {
        const newQty = { ...prevQty };
        delete newQty[addonId];
        return newQty;
      });
    } else {
      setAddonQuantities(prevQty => ({ ...prevQty, [addonId]: newQuantity }));
    }
  };

  const calculateTotal = () => {
    const addonsPrice = food.addons
      .filter(addon => selectedAddons.includes(addon.id))
      .reduce((sum, addon) => sum + (addon.price * (addonQuantities[addon.id] || 1)), 0);
    return (food.price + addonsPrice) * quantity;
  };

  const handleAddToCart = () => {
    const f = food as any;
    if (f.available === false || f.inStock === false) {
      toast.error('Mahsulot tugagan');
      return;
    }
    const sq = Number(f.stockQuantity ?? f.stockCount ?? NaN);
    if (Number.isFinite(sq)) {
      if (sq <= 0) {
        toast.error('Mahsulot tugagan');
        return;
      }
      if (quantity > sq) {
        toast.error(`Omborda faqat ${sq} ta qoldi`);
        return;
      }
    }
    onAddToCart(food, quantity, selectedAddons);
    onClose();
  };

  const buildFoodShareUrl = () => {
    const base = `${window.location.origin}${window.location.pathname || '/'}`;
    const q = new URLSearchParams();
    q.set('foodId', food.id);
    if (restaurantName) q.set('restaurant', restaurantName);
    const qs = q.toString();
    return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
  };

  const handleShareFood = async () => {
    const url = buildFoodShareUrl();
    const text = `${food.name} — ${food.price.toLocaleString('uz-UZ')} so'm${restaurantName ? ` (${restaurantName})` : ''}`;
    await shareTitleTextUrl({
      title: food.name,
      text,
      url,
      toast,
    });
  };

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-50 overflow-y-auto scrollbar-hide"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
      }}
    >
      {/* Floating Header Buttons */}
      <div className="fixed top-6 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <button
          onClick={onClose}
          className="p-2.5 rounded-2xl transition-all active:scale-90 pointer-events-auto"
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

        {food.isPopular && (
          <div 
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white pointer-events-auto"
            style={{
              background: 'rgba(234, 179, 8, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(234, 179, 8, 0.4)',
            }}
          >
            MASHHUR
          </div>
        )}
      </div>

      {/* Image Gallery with Horizontal Scroll */}
      <div className="relative mb-0">
        <div 
          ref={scrollContainerRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {foodImages.map((img, index) => (
            <div
              key={index}
              className="flex-shrink-0 snap-center relative w-full"
            >
              <img 
                src={img} 
                alt={`${food.name} ${index + 1}`}
                className="w-full h-72 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/80" />
              
              {/* Bottom Info - Only on first image */}
              {index === 0 && (
                <div className="absolute bottom-6 left-4 right-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex gap-2">
                      {food.isVegetarian && (
                        <div 
                          className="p-2 rounded-xl"
                          style={{
                            background: 'rgba(34, 197, 94, 0.95)',
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          <Leaf className="size-5 text-white" strokeWidth={2.5} />
                        </div>
                      )}
                      {food.isSpicy && (
                        <div 
                          className="p-2 rounded-xl"
                          style={{
                            background: 'rgba(239, 68, 68, 0.95)',
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          <Flame className="size-5 text-white" strokeWidth={2.5} />
                        </div>
                      )}
                    </div>

                    <div 
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                      style={{
                        background: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(20px)',
                      }}
                    >
                      <Star className="size-5 fill-yellow-400 text-yellow-400" />
                      <span className="text-base font-bold text-white">
                        {food.rating}
                      </span>
                    </div>
                  </div>

                  <h1 
                    className="text-2xl font-bold text-white mb-2"
                    style={{
                      textShadow: '0 2px 12px rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    {food.name}
                  </h1>

                  <div className="flex items-center gap-4 text-sm text-white/90">
                    <span>{food.weight}</span>
                    <span>•</span>
                    <span>{food.calories} kcal</span>
                    <span>•</span>
                    <span className="font-bold" style={{ color: accentColor.color }}>
                      {food.price.toLocaleString('uz-UZ')} so'm
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        {currentImageIndex > 0 && (
          <button
            onClick={() => handleImageScroll('left')}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-md transition-all active:scale-90 z-10"
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <ChevronLeft className="size-5 text-white" />
          </button>
        )}
        
        {currentImageIndex < foodImages.length - 1 && (
          <button
            onClick={() => handleImageScroll('right')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-md transition-all active:scale-90 z-10"
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <ChevronRight className="size-5 text-white" />
          </button>
        )}

        {/* Image Indicators */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
          {foodImages.map((_, index) => (
            <div
              key={index}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: index === currentImageIndex ? '24px' : '6px',
                background: index === currentImageIndex 
                  ? '#ffffff' 
                  : 'rgba(255, 255, 255, 0.4)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Restaurant Badge - New */}
        {restaurantName && (
          <div 
            className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2"
            style={{
              borderColor: '#f97316',
              background: isDark ? 'rgba(249, 115, 22, 0.1)' : 'rgba(249, 115, 22, 0.05)',
            }}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div 
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full sm:rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, #f97316, #ea580c)',
                  boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)',
                }}
              >
                <ChefHat className="size-5 sm:size-6 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <p 
                  className="text-[10px] sm:text-xs font-semibold mb-0.5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Restoran:
                </p>
                <p 
                  className="text-sm sm:text-base font-bold"
                  style={{ color: '#f97316' }}
                >
                  {restaurantName}
                </p>
              </div>
              <div 
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg backdrop-blur-xl font-bold text-[10px] sm:text-xs"
                style={{
                  background: 'linear-gradient(145deg, #f97316, #ea580c)',
                  boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)',
                }}
              >
                <span className="text-white drop-shadow-lg">Restoran</span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div 
            className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl border-2"
            style={{
              borderColor: '#10b981',
              background: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
            }}
          >
            <Timer className="size-4 sm:size-5 mb-1 sm:mb-1.5" style={{ color: '#10b981' }} strokeWidth={2} />
            <p className="text-[10px] sm:text-xs font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Tayyorlanadi
            </p>
            <p className="text-sm sm:text-base font-bold" style={{ color: '#10b981' }}>
              15-20 daq
            </p>
          </div>

          <div 
            className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl border-2"
            style={{
              borderColor: accentColor.color,
              background: isDark ? `${accentColor.color}15` : `${accentColor.color}08`,
            }}
          >
            <Users className="size-4 sm:size-5 mb-1 sm:mb-1.5" style={{ color: accentColor.color }} strokeWidth={2} />
            <p className="text-[10px] sm:text-xs font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Bu hafta
            </p>
            <p className="text-sm sm:text-base font-bold" style={{ color: accentColor.color }}>
              243 ta
            </p>
          </div>

          <div 
            className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl border-2"
            style={{
              borderColor: '#eab308',
              background: isDark ? 'rgba(234, 179, 8, 0.1)' : 'rgba(234, 179, 8, 0.05)',
            }}
          >
            <ThumbsUp className="size-4 sm:size-5 mb-1 sm:mb-1.5" style={{ color: '#eab308' }} strokeWidth={2} />
            <p className="text-[10px] sm:text-xs font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Yoqtirish
            </p>
            <p className="text-sm sm:text-base font-bold" style={{ color: '#eab308' }}>
              98%
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className="flex items-center justify-center gap-2 p-3 rounded-xl transition-all active:scale-95"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))' 
                : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
              border: isDark 
                ? '0.5px solid rgba(255, 255, 255, 0.08)' 
                : '0.5px solid rgba(0, 0, 0, 0.08)',
              boxShadow: isDark 
                ? 'none' 
                : '0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <Heart 
              className="size-5" 
              fill={isLiked ? '#ef4444' : 'none'}
              stroke={isLiked ? '#ef4444' : (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)')}
              strokeWidth={2}
            />
            <span 
              className="text-sm font-semibold"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
            >
              Yoqtirish
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleShareFood()}
            className="flex items-center justify-center gap-2 p-3 rounded-xl transition-all active:scale-95"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))' 
                : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
              border: isDark 
                ? '0.5px solid rgba(255, 255, 255, 0.08)' 
                : '0.5px solid rgba(0, 0, 0, 0.08)',
              boxShadow: isDark 
                ? 'none' 
                : '0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
            aria-label="Ulashish"
          >
            <Share2 
              className="size-5" 
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
              strokeWidth={2}
            />
            <span 
              className="text-sm font-semibold"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
            >
              Ulashish
            </span>
          </button>
        </div>

        {/* Price Card */}
        <div 
          className="p-4 sm:p-5 rounded-xl sm:rounded-2xl"
          style={{
            background: isDark ? '#111111' : '#f9fafb',
            border: isDark ? '1px solid #1f1f1f' : '1px solid #e5e7eb',
          }}
        >
          <div className="flex items-baseline gap-2 sm:gap-3 mb-3 flex-wrap">
            <p 
              className="text-2xl sm:text-3xl md:text-4xl font-bold"
              style={{ color: accentColor.color }}
            >
              {food.price.toLocaleString('uz-UZ')} so'm
            </p>
            <p 
              className="text-base sm:text-lg line-through"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
            >
              {Math.round(food.price * 1.15).toLocaleString('uz-UZ')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Package className="size-4 sm:size-5" style={{ color: accentColor.color }} strokeWidth={2} />
              <div>
                <p className="text-[10px] font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  Vazni
                </p>
                <p className="text-xs sm:text-sm font-bold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                  {food.weight}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Flame className="size-4 sm:size-5" style={{ color: '#ef4444' }} strokeWidth={2} />
              <div>
                <p className="text-[10px] font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  Kaloriya
                </p>
                <p className="text-xs sm:text-sm font-bold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                  {food.calories} kcal
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div>
          <h3 
            className="text-sm sm:text-base font-bold mb-3"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            To'lov usullari
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { id: 'cash', label: 'Naqd', icon: '💵' },
              { id: 'card', label: 'Karta', icon: '💳' },
              { id: 'click', label: 'Click', icon: '🔵' },
              { id: 'payme', label: 'Payme', icon: '🟢' },
              { id: 'uzum', label: 'Uzum', icon: '🟣' },
              { id: 'apelsin', label: 'Apelsin', icon: '🟠' },
            ].map((method) => (
              <button
                key={method.id}
                className="flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-lg sm:rounded-xl transition-all active:scale-95"
                style={{
                  background: isDark ? '#111111' : '#f9fafb',
                  border: `2px solid ${isDark ? '#1f1f1f' : '#e5e7eb'}`,
                }}
              >
                <div className="text-xl sm:text-2xl">{method.icon}</div>
                <p 
                  className="text-[9px] sm:text-[10px] font-bold text-center"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                >
                  {method.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-3 sm:mb-4">
          <div 
            className="flex items-center gap-4 sm:gap-6 border-b overflow-x-auto"
            style={{
              borderColor: isDark ? '#1f1f1f' : '#e5e7eb',
            }}
          >
            {[
              { id: 'description', label: 'Tavsif' },
              { id: 'nutrition', label: 'Tarkibi' },
              { id: 'reviews', label: 'Sharhlar (8)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="pb-2 sm:pb-3 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap"
                style={{
                  color: activeTab === tab.id 
                    ? accentColor.color 
                    : (isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'),
                }}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: accentColor.color }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-4 sm:mb-6">
          {activeTab === 'description' && (
            <div>
              <p 
                className="text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
              >
                {food.description}
              </p>

              <div 
                className="p-3 sm:p-4 rounded-lg sm:rounded-xl border-l-4"
                style={{
                  background: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
                  borderColor: '#22c55e',
                }}
              >
                <div className="flex gap-2 sm:gap-3">
                  <div className="text-xl sm:text-2xl">🍽️</div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold mb-1" style={{ color: '#22c55e' }}>
                      Tavsiya: Yangi tayyorlangan holda iste'mol qiling
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'nutrition' && (
            <div className="space-y-2 sm:space-y-3">
              {[
                { label: 'Oqsillar', value: '24g', percent: 48 },
                { label: 'Yog\'lar', value: '18g', percent: 36 },
                { label: 'Uglevodlar', value: '32g', percent: 64 },
                { label: 'Kaloriya', value: food.calories + ' kcal', percent: 35 },
                { label: 'Tuz', value: '1.2g', percent: 20 },
              ].map((nutrition, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between py-2 border-b"
                  style={{
                    borderColor: isDark ? '#1f1f1f' : '#e5e7eb',
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span 
                        className="text-xs sm:text-sm"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      >
                        {nutrition.label}
                      </span>
                      <span 
                        className="text-xs sm:text-sm font-semibold"
                        style={{ color: isDark ? '#ffffff' : '#111827' }}
                      >
                        {nutrition.value}
                      </span>
                    </div>
                    <div 
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: isDark ? '#1f1f1f' : '#e5e7eb' }}
                    >
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${nutrition.percent}%`,
                          background: accentColor.gradient,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-3">
              <div 
                className="p-3 sm:p-4 rounded-lg sm:rounded-xl"
                style={{
                  background: isDark ? '#111111' : '#f9fafb',
                }}
              >
                <div className="flex items-start gap-3 mb-2">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: accentColor.gradient }}
                  >
                    A
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Alisher Navoiy
                      </p>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className="size-3" 
                            fill="#eab308"
                            stroke="#eab308"
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      Juda mazali va sifatli taom! Tavsiya qilaman 👍
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                      2 kun oldin
                    </p>
                  </div>
                </div>
              </div>

              <div 
                className="p-3 sm:p-4 rounded-lg sm:rounded-xl"
                style={{
                  background: isDark ? '#111111' : '#f9fafb',
                }}
              >
                <div className="flex items-start gap-3 mb-2">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: 'linear-gradient(145deg, #8b5cf6, #7c3aed)' }}
                  >
                    M
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Malika Sharipova
                      </p>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className="size-3" 
                            fill={i < 4 ? "#eab308" : "none"}
                            stroke="#eab308"
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      Yaxshi, lekin biroz kech yetkazib berishdi
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                      1 hafta oldin
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <h3 
            className="font-bold mb-2"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Batafsil ma'lumot
          </h3>
          <p 
            className="text-sm leading-relaxed"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
          >
            {food.description}
          </p>
        </div>

        {/* Addons */}
        {food.addons.length > 0 && (
          <div className="mb-32">
            <h3 
              className="font-bold mb-4"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Qo'shimchalar ({food.addons.length} ta)
            </h3>
            <div className="space-y-3">
              {food.addons.map((addon) => {
                const isSelected = selectedAddons.includes(addon.id);
                const addonQty = addonQuantities[addon.id] || 0;
                return (
                  <div
                    key={addon.id}
                    className="p-4 rounded-xl transition-all"
                    style={{
                      background: isSelected
                        ? (isDark 
                            ? `${accentColor.color}26`
                            : `${accentColor.color}1a`)
                        : (isDark 
                            ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))'
                            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))'),
                      border: isSelected
                        ? `2px solid ${accentColor.color}`
                        : (isDark 
                            ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.05)')
                            : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)')),
                      boxShadow: isSelected
                        ? `0 4px 12px ${accentColor.color}33`
                        : (isDark
                            ? 'none'
                            : (isIOS ? '0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : '0 2px 8px rgba(0, 0, 0, 0.04)')),
                      backdropFilter: isIOS ? 'blur(20px)' : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span 
                          className="font-semibold"
                          style={{ color: isDark ? '#ffffff' : '#111827' }}
                        >
                          {addon.name}
                        </span>
                      </div>
                      <span 
                        className="font-bold"
                        style={{ color: isSelected ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)') }}
                      >
                        {addon.price.toLocaleString('uz-UZ')} so'm
                      </span>
                    </div>

                    {/* Cart Button / Quantity Controls */}
                    {!isSelected ? (
                      <button
                        onClick={() => toggleAddon(addon.id)}
                        className="w-full py-2.5 rounded-lg font-bold text-sm transition-all active:scale-98 flex items-center justify-center gap-2"
                        style={{
                          backgroundImage: accentColor.gradient,
                          color: '#ffffff',
                          boxShadow: `0 4px 12px ${accentColor.color}44`,
                        }}
                      >
                        <ShoppingCart className="size-4" strokeWidth={2.5} />
                        <span>Savatga</span>
                      </button>
                    ) : (
                      <div 
                        className="flex items-center gap-3 justify-between p-2 rounded-lg"
                        style={{
                          background: isDark 
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.05)',
                          border: isDark 
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : '1px solid rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateAddonQuantity(addon.id, addonQty - 1);
                          }}
                          className="p-2 rounded-lg transition-all active:scale-90"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <Minus className="size-4" style={{ color: isDark ? '#ffffff' : '#111827' }} strokeWidth={2.5} />
                        </button>
                        
                        <div className="flex items-center gap-2">
                          <span 
                            className="text-lg font-bold w-8 text-center"
                            style={{ color: isDark ? '#ffffff' : '#111827' }}
                          >
                            {addonQty}
                          </span>
                          <span 
                            className="text-sm font-semibold"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                          >
                            × {addon.price.toLocaleString('uz-UZ')} = {(addon.price * addonQty).toLocaleString('uz-UZ')} so'm
                          </span>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateAddonQuantity(addon.id, addonQty + 1);
                          }}
                          className="p-2 rounded-lg transition-all active:scale-90"
                          style={{
                            backgroundImage: accentColor.gradient,
                          }}
                        >
                          <Plus className="size-4 text-white" strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div 
        className="fixed bottom-0 inset-x-0 p-4"
        style={{
          background: isDark 
            ? 'linear-gradient(to top, #000000 80%, transparent)'
            : 'linear-gradient(to top, #f9fafb 80%, transparent)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div 
          className="max-w-lg mx-auto p-4 rounded-2xl"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.98))'
              : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
            border: isDark 
              ? '0.5px solid rgba(255, 255, 255, 0.1)' 
              : '0.5px solid rgba(0, 0, 0, 0.1)',
            boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.2)',
          }}
        >
          <div className="flex items-center justify-between gap-4">
            {/* Quantity Controls */}
            <div 
              className="flex items-center gap-3 px-4 py-2 rounded-xl"
              style={{
                background: isDark 
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.05)',
                border: isDark 
                  ? '1px solid rgba(255, 255, 255, 0.1)'
                  : '1px solid rgba(0, 0, 0, 0.1)',
              }}
            >
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="p-1.5 rounded-lg transition-all active:scale-90 disabled:opacity-50"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <Minus className="size-4" style={{ color: isDark ? '#ffffff' : '#111827' }} strokeWidth={2.5} />
              </button>
              
              <span 
                className="text-lg font-bold w-8 text-center"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {quantity}
              </span>
              
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="p-1.5 rounded-lg transition-all active:scale-90"
                style={{
                  backgroundImage: accentColor.gradient,
                }}
              >
                <Plus className="size-4 text-white" strokeWidth={2.5} />
              </button>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              className="flex-1 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-98 flex items-center justify-center gap-2"
              style={{
                backgroundImage: accentColor.gradient,
                color: '#ffffff',
                boxShadow: `0 8px 24px ${accentColor.color}66`,
              }}
            >
              <ShoppingCart className="size-5" strokeWidth={2.5} />
              <span>{calculateTotal().toLocaleString('uz-UZ')} so'm</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});