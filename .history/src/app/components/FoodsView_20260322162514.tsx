import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import { Search, Star, Clock, MapPin, ChevronRight, Utensils, TrendingUp, Leaf, X, Plus, Minus, Phone, Heart, Share2, PackageCheck, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { BannerCarousel } from './BannerCarousel';
import { regions as allRegions } from '../data/regions';
import { matchesSelectedLocation } from '../utils/locationMatching';

interface Restaurant {
  id: string;
  name: string;
  logo: string;
  banner: string;
  type: string;
  workTime: string;
  minOrderPrice: number;
  deliveryTime: string;
  description: string;
  region: string;
  district: string;
  contact: {
    address: string;
    phone: string;
    workHours: string;
  };
  totalOrders: number;
  isActive: boolean;
}

interface Dish {
  id: string;
  restaurantId: string;
  name: string;
  images: string[];
  kcal: number;
  calories: number;
  description: string;
  ingredients: string[];
  weight: string;
  additionalProducts: { name: string; price: number }[];
  variants: { name: string; image: string; price: number; prepTime: string }[];
  isPopular: boolean;
  isNatural: boolean;
  isActive: boolean;
}

interface FoodsViewProps {
  platform: string;
  onAddToCart: (dish: any, quantity: number, variant: any, additionalProducts: any[]) => void;
}

export default function FoodsView({ platform, onAddToCart }: FoodsViewProps) {
  const { theme, accentColor } = useTheme();
  const { selectedRegion, selectedDistrict } = useLocation();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'dishes' | 'restaurants'>('dishes');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedAddons, setSelectedAddons] = useState<{ name: string; quantity: number }[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Convert region ID to name for banners
  const selectedRegionData = allRegions.find(r => r.id === selectedRegion);
  const selectedRegionName = selectedRegionData?.name || '';
  const selectedDistrictData = selectedRegionData?.districts.find(d => d.id === selectedDistrict);
  const selectedDistrictName = selectedDistrictData?.name || '';

  // Debug logging for banner
  console.log('🍕 FoodsView Banner Debug:', {
    selectedRegionId: selectedRegion,
    selectedDistrictId: selectedDistrict,
    selectedRegionName,
    selectedDistrictName,
    willShowBanner: !!(selectedRegionName && selectedDistrictName)
  });

  useEffect(() => {
    loadRestaurantsAndDishes();
  }, [selectedRegion, selectedDistrict]);

  const loadRestaurantsAndDishes = async () => {
    try {
      setLoading(true);
      const restaurantsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      const restaurantsResult = await restaurantsResponse.json();
      
      if (restaurantsResult.success) {
        const filtered = restaurantsResult.data.filter(
          (restaurant: Restaurant) =>
            restaurant.isActive &&
            matchesSelectedLocation(restaurant as unknown as Record<string, unknown>, {
              selectedRegionId: selectedRegion,
              selectedDistrictId: selectedDistrict,
            })
        );
        setRestaurants(filtered);
        await loadAllDishes(filtered);
      }
    } catch (error) {
      console.error('Load restaurants error:', error);
      toast.error('Restoranlarni yuklashda xatolik!');
    } finally {
      setLoading(false);
    }
  };

  const loadAllDishes = async (restaurants: Restaurant[]) => {
    try {
      const allDishesArray: Dish[] = [];
      for (const restaurant of restaurants) {
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${restaurant.id}/dishes`,
            { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
          );
          const result = await response.json();
          if (result.success) {
            const activeDishes = result.data
              .filter((d: Dish) => d.isActive)
              .map((d: Dish) => ({ ...d, restaurantId: restaurant.id }));
            allDishesArray.push(...activeDishes);
          }
        } catch (error) {
          console.error(`Error loading dishes for restaurant ${restaurant.name}:`, error);
        }
      }
      setAllDishes(allDishesArray);
    } catch (error) {
      console.error('Load all dishes error:', error);
    }
  };

  const handleDishClick = (dish: Dish) => {
    setSelectedDish(dish);
    setSelectedVariant(dish.variants[0] || null);
    setSelectedAddons([]);
    setQuantity(1);
    setCurrentImageIndex(0);
  };

  const handleRestaurantClick = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
  };

  const handleAddToCart = async () => {
    if (!selectedDish || !selectedVariant) {
      toast.error('Variant tanlang!');
      return;
    }
    
    // Map selected addons with their quantities to the addon products
    const selectedAddonProducts = selectedAddons.map(selectedAddon => {
      const addonProduct = selectedDish.additionalProducts?.find(p => p.name === selectedAddon.name);
      return {
        ...addonProduct,
        quantity: selectedAddon.quantity
      };
    }).filter(Boolean);
    
    onAddToCart(selectedDish, quantity, selectedVariant, selectedAddonProducts);
    toast.success(`${selectedDish.name} savatga qo'shildi! 🎉`);
    setSelectedDish(null);
  };

  const getRestaurantName = (restaurantId: string) => {
    const restaurant = restaurants.find(r => r.id === restaurantId);
    return restaurant?.name || '';
  };

  const filteredDishes = allDishes.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getRestaurantName(d.restaurantId).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRestaurants = restaurants.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedRestaurantDishes = selectedRestaurant 
    ? allDishes.filter(d => d.restaurantId === selectedRestaurant.id)
    : [];

  useEffect(() => {
    if (selectedRestaurant && !restaurants.some(restaurant => restaurant.id === selectedRestaurant.id)) {
      setSelectedRestaurant(null);
    }
  }, [restaurants, selectedRestaurant]);

  useEffect(() => {
    if (selectedDish && !allDishes.some(dish => dish.id === selectedDish.id)) {
      setSelectedDish(null);
    }
  }, [allDishes, selectedDish]);

  return (
    <div className="min-h-screen pb-24" style={{ background: isDark ? '#000000' : '#f5f5f5' }}>
      {/* Food Banners - Only show if location selected */}
      {selectedRegionName && selectedDistrictName && (
        <div className="px-4 pt-6 pb-2">
          <BannerCarousel 
            category="foods" 
            region={selectedRegionName} 
            district={selectedDistrictName}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab('dishes')}
            className="flex-1 py-4 rounded-3xl font-bold text-base transition-all flex items-center justify-center gap-2"
            style={{
              background: activeTab === 'dishes' ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#ffffff'),
              color: activeTab === 'dishes' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
              boxShadow: activeTab === 'dishes' ? `0 4px 20px ${accentColor.color}40` : 'none'
            }}
          >
            <Utensils className="w-5 h-5" />
            Taomlar
          </button>
          <button
            onClick={() => setActiveTab('restaurants')}
            className="flex-1 py-4 rounded-3xl font-bold text-base transition-all flex items-center justify-center gap-2"
            style={{
              background: activeTab === 'restaurants' ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#ffffff'),
              color: activeTab === 'restaurants' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
              boxShadow: activeTab === 'restaurants' ? `0 4px 20px ${accentColor.color}40` : 'none'
            }}
          >
            <MapPin className="w-5 h-5" />
            Restoranlar
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            {activeTab === 'dishes' ? 'Barcha taomlar' : 'Restoranlar'}
          </h1>
          <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
            {activeTab === 'dishes' 
              ? `${filteredDishes.length} ta` 
              : `${filteredRestaurants.length} ta`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mb-6">
        <div 
          className="flex items-center gap-3 px-4 py-3 rounded-2xl hidden"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`
          }}
        >
          <Search className="w-5 h-5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'dishes' ? "Taom qidirish..." : "Restoran qidirish..."}
            className="flex-1 bg-transparent outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div 
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: `${accentColor.color}40`, borderTopColor: accentColor.color }}
          />
        </div>
      ) : (
        <>
          {/* DISHES TAB */}
          {activeTab === 'dishes' && (
            <div className="px-4">
              <div className="grid grid-cols-2 gap-4">
                {filteredDishes.map(dish => {
                  const restaurant = restaurants.find(r => r.id === dish.restaurantId);
                  return (
                    <div
                      key={dish.id}
                      onClick={() => handleDishClick(dish)}
                      className="rounded-3xl overflow-hidden cursor-pointer transition-all active:scale-95"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        boxShadow: isDark ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.08)'
                      }}
                    >
                      {/* Image */}
                      <div className="w-[300px] h-[500px] aspect-square bg-black/10 relative">
                        {dish.images[0] && (
                          <img src={dish.images[0]} alt="" className="w-full h-full object-cover" />
                        )}
                        
                        {dish.isNatural && (
                          <div 
                            className="absolute top-3 left-3 w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: accentColor.color }}
                          >
                            <Leaf className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="p-2.5 sm:p-3 md:p-4">
                        <h3 className="font-bold mb-1.5 sm:mb-2 text-sm sm:text-base line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem]">{dish.name}</h3>
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 text-xs sm:text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                          {dish.weight && <span className="truncate">{dish.weight}</span>}
                          {dish.weight && dish.kcal > 0 && <span>•</span>}
                          {dish.kcal > 0 && <span className="truncate">{dish.kcal} kcal</span>}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-base sm:text-lg md:text-xl font-bold truncate" style={{ color: accentColor.color }}>
                              {dish.variants[0]?.price.toLocaleString() || '0'}
                            </p>
                            <p className="text-[10px] sm:text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>so'm</p>
                          </div>
                          <button
                            className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ background: accentColor.color }}
                          >
                            <Plus className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* RESTAURANTS TAB */}
          {activeTab === 'restaurants' && (
            <div className="px-4 space-y-4">
              {filteredRestaurants.map(restaurant => (
                <div
                  key={restaurant.id}
                  onClick={() => handleRestaurantClick(restaurant)}
                  className="rounded-3xl overflow-hidden cursor-pointer transition-all active:scale-98"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    boxShadow: isDark ? 'none' : '0 2px 12px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <div className="flex gap-4 p-4">
                    {/* Logo */}
                    <div className="relative flex-shrink-0">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden bg-black/5">
                        {restaurant.banner && (
                          <img src={restaurant.logo} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      {restaurant.logo && (
                        <div className="absolute -bottom-2 -right-2 w-16 h-16 rounded-xl overflow-hidden border-4 hidden" style={{ borderColor: isDark ? '#000' : '#fff' }}>
                          <img src={restaurant.logo} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div 
                        className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold"
                        style={{ background: accentColor.color, color: '#fff' }}
                      >
                        OPEN
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-lg">{restaurant.name}</h3>
                        <div 
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                          style={{ background: `${accentColor.color}20`, color: accentColor.color }}
                        >
                          <Star className="w-3 h-3 fill-current" />
                          4.9
                        </div>
                      </div>
                      
                      <div 
                        className="inline-block px-3 py-1 rounded-lg text-xs font-medium mb-3"
                        style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                      >
                        {restaurant.type}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3 hidden">
                        {['Italian', 'Pizza', 'Pasta'].map((tag, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-1 rounded-lg text-xs"
                            style={{ background: `${accentColor.color}15`, color: accentColor.color }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-sm mb-3">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" style={{ color: accentColor.color }} />
                          <span>{restaurant.totalOrders || 2547}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" style={{ color: accentColor.color }} />
                          <span>{restaurant.deliveryTime}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 text-xs">
                        <div 
                          className="px-3 py-1.5 rounded-lg"
                          style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }}
                        >
                          ⚡ Tez yetkazish
                        </div>
                        <div 
                          className="px-3 py-1.5 rounded-lg"
                          style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }}
                        >
                          ✓ Halol
                        </div>
                      </div>

                      <button
                        className="w-full mt-3 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                        style={{ background: accentColor.color, color: '#fff' }}
                      >
                        OCHISH
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* RESTAURANT DETAIL MODAL */}
      {selectedRestaurant && (
        <>
          <div 
            className="fixed inset-0 bg-black/80 z-[100]"
            onClick={() => setSelectedRestaurant(null)}
          />
          
          <div 
            className="fixed inset-0 z-[101] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-h-screen">
              {/* Header with Background */}
              <div className="relative h-80">
                {selectedRestaurant.banner && (
                  <img src={selectedRestaurant.banner} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
                
                {/* Close Button */}
                <button
                  onClick={() => setSelectedRestaurant(null)}
                  className="absolute top-6 left-4 w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0, 0, 0, 0.5)' }}
                >
                  <X className="w-6 h-6 text-white" />
                </button>

                {/* Restaurant Info on Image */}
                <div className="absolute bottom-6 left-4 right-4">
                  <div className="flex items-center gap-4 mb-3">
                    {selectedRestaurant.logo && (
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white/20">
                        <img src={selectedRestaurant.logo} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h2 className="text-3xl font-bold text-white mb-2">{selectedRestaurant.name}</h2>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-white">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-bold">4.9</span>
                          <span className="text-sm opacity-70">(2547 sharh)</span>
                        </div>
                        <div 
                          className="px-3 py-1 rounded-lg text-sm font-bold"
                          style={{ background: accentColor.color, color: '#fff' }}
                        >
                          Ochiq
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div style={{ background: isDark ? '#000' : '#f5f5f5' }}>
                {/* Info Section */}
                <div className="px-4 py-6">
                  {selectedRestaurant.description && (
                    <p className="mb-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      {selectedRestaurant.description}
                    </p>
                  )}

                  {/* Tags */}
                  <div className="mb-6">
                    <h3 className="font-bold mb-3">Oshxona turi</h3>
                    <div className="flex flex-wrap gap-2">
                      <span 
                        className="px-4 py-2 rounded-xl text-sm font-medium"
                        style={{ background: `${accentColor.color}15`, color: accentColor.color }}
                      >
                        {selectedRestaurant.type}
                      </span>
                    </div>
                  </div>

                  {/* Delivery Info */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div 
                      className="p-4 rounded-2xl"
                      style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: `${accentColor.color}20` }}
                        >
                          <Timer className="w-5 h-5" style={{ color: accentColor.color }} />
                        </div>
                      </div>
                      <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>Yetkazish</p>
                      <p className="font-bold">{selectedRestaurant.deliveryTime}</p>
                    </div>

                    <div 
                      className="p-4 rounded-2xl"
                      style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: `${accentColor.color}20` }}
                        >
                          <PackageCheck className="w-5 h-5" style={{ color: accentColor.color }} />
                        </div>
                      </div>
                      <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>Min buyurtma</p>
                      <p className="font-bold">{selectedRestaurant.minOrderPrice.toLocaleString()} so'm</p>
                    </div>
                  </div>

                  {/* Contact */}
                  <div 
                    className="p-4 rounded-2xl mb-6"
                    style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff' }}
                  >
                    <h3 className="font-bold mb-3">Aloqa</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: `${accentColor.color}20` }}
                        >
                          <MapPin className="w-5 h-5" style={{ color: accentColor.color }} />
                        </div>
                        <div>
                          <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>Manzil</p>
                          <p className="font-medium">{selectedRestaurant.contact.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: `${accentColor.color}20` }}
                        >
                          <Phone className="w-5 h-5" style={{ color: accentColor.color }} />
                        </div>
                        <div>
                          <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>Telefon</p>
                          <p className="font-medium">{selectedRestaurant.contact.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: `${accentColor.color}20` }}
                        >
                          <Clock className="w-5 h-5" style={{ color: accentColor.color }} />
                        </div>
                        <div>
                          <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>Ish vaqti</p>
                          <p className="font-medium">{selectedRestaurant.workTime}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu */}
                <div className="px-4 pb-6">
                  <h3 className="text-xl font-bold mb-4">Menyu ({selectedRestaurantDishes.length} ta taom)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedRestaurantDishes.map(dish => (
                      <div
                        key={dish.id}
                        onClick={() => {
                          setSelectedRestaurant(null);
                          handleDishClick(dish);
                        }}
                        className="rounded-3xl overflow-hidden cursor-pointer transition-all active:scale-95"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                          boxShadow: isDark ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.08)'
                        }}
                      >
                        <div className="w-full aspect-square bg-black/10 relative">
                          {dish.images[0] && (
                            <img src={dish.images[0]} alt="" className="w-full h-full object-cover" />
                          )}
                          <div 
                            className="absolute top-3 right-3 px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1"
                            style={{ background: 'rgba(0, 0, 0, 0.7)', color: '#fff' }}
                          >
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            4.9
                          </div>
                        </div>
                        
                        <div className="p-3">
                          <h4 className="font-bold mb-1 text-sm">{dish.name}</h4>
                          <p className="text-xs mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                            {dish.weight} • {dish.kcal} kcal
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-lg font-bold" style={{ color: accentColor.color }}>
                                {dish.variants[0]?.price.toLocaleString()}
                              </p>
                              <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>so'm</p>
                            </div>
                            <button
                              className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{ background: accentColor.color }}
                            >
                              <Plus className="w-5 h-5 text-white" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* DISH DETAIL MODAL */}
      {selectedDish && (
        <>
          <div 
            className="fixed inset-0 bg-black z-[100]"
            onClick={() => setSelectedDish(null)}
          />
          
          <div 
            className="fixed inset-0 z-[101] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-h-screen" style={{ background: isDark ? '#000' : '#fff' }}>
              {/* Image Header */}
              <div className="relative h-96">
                {selectedDish.images[currentImageIndex] && (
                  <img src={selectedDish.images[currentImageIndex]} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
                
                {/* Close Button */}
                <button
                  onClick={() => setSelectedDish(null)}
                  className="absolute top-6 left-4 w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0, 0, 0, 0.5)' }}
                >
                  <X className="w-6 h-6 text-white" />
                </button>

                {/* Popular Badge */}
                {selectedDish.isPopular && (
                  <div 
                    className="absolute top-6 right-4 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{ background: '#fbbf24', color: '#000' }}
                  >
                    MASHHUR
                  </div>
                )}

                {/* Natural Badge */}
                {selectedDish.isNatural && (
                  <div 
                    className="absolute top-20 left-4 w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: accentColor.color }}
                  >
                    <Leaf className="w-6 h-6 text-white" />
                  </div>
                )}

                {/* Title and Rating on Image */}
                <div className="absolute bottom-6 left-4 right-4">
                  <h2 className="text-3xl font-bold text-white mb-3">{selectedDish.name}</h2>
                  <div className="flex items-center gap-4 text-white">
                    <span className="text-sm">{selectedDish.weight}</span>
                    <span className="text-sm">•</span>
                    <span className="text-sm">{selectedDish.kcal} kcal</span>
                    <span className="text-sm">•</span>
                    <span className="font-bold" style={{ color: accentColor.color }}>
                      {selectedVariant?.price.toLocaleString()} so'm
                    </span>
                  </div>
                </div>

                {/* Rating Badge */}
                <div 
                  className="absolute bottom-6 right-4 px-3 py-1.5 rounded-xl flex items-center gap-1 font-bold"
                  style={{ background: 'rgba(0, 0, 0, 0.7)', color: '#fff' }}
                >
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  4.9
                </div>

                {/* Image Indicators */}
                {selectedDish.images.length > 1 && (
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2">
                    {selectedDish.images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className="w-2 h-2 rounded-full transition-all"
                        style={{ 
                          background: idx === currentImageIndex ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                          width: idx === currentImageIndex ? '24px' : '8px'
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="px-4 py-6 pb-32">
                {/* Restaurant Badge */}
                {(() => {
                  const restaurant = restaurants.find(r => r.id === selectedDish.restaurantId);
                  return restaurant && (
                    <div 
                      className="p-3 sm:p-4 rounded-2xl mb-4 sm:mb-6 flex items-center justify-between gap-2"
                      style={{ 
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        border: `2px solid ${accentColor.color}40`
                      }}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        {restaurant.logo && (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden flex-shrink-0">
                            <img src={restaurant.logo} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>Restoran:</p>
                          <p className="font-bold text-sm sm:text-base truncate">{restaurant.name}</p>
                        </div>
                      </div>
                      <button
                        className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex-shrink-0"
                        style={{ background: accentColor.color, color: '#fff' }}
                      >
                        Restoran
                      </button>
                    </div>
                  );
                })()}

                {/* Info Cards */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <div 
                    className="p-2 sm:p-4 rounded-xl sm:rounded-2xl text-center"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`
                    }}
                  >
                    <div 
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl mx-auto mb-1 sm:mb-2 flex items-center justify-center"
                      style={{ background: `${accentColor.color}20` }}
                    >
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: accentColor.color }} />
                    </div>
                    <p className="text-[10px] sm:text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>Tayyorlanadi</p>
                    <p className="font-bold text-xs sm:text-sm">{selectedVariant?.prepTime || '15-20 daq'}</p>
                  </div>

                  <div 
                    className="p-2 sm:p-4 rounded-xl sm:rounded-2xl text-center"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`
                    }}
                  >
                    <div 
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl mx-auto mb-1 sm:mb-2 flex items-center justify-center"
                      style={{ background: `${accentColor.color}20` }}
                    >
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: accentColor.color }} />
                    </div>
                    <p className="text-[10px] sm:text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>Bu hafta</p>
                    <p className="font-bold text-xs sm:text-sm">243 ta</p>
                  </div>

                  <div 
                    className="p-2 sm:p-4 rounded-xl sm:rounded-2xl text-center"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`
                    }}
                  >
                    <div 
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl mx-auto mb-1 sm:mb-2 flex items-center justify-center"
                      style={{ background: `${accentColor.color}20` }}
                    >
                      <Heart className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: accentColor.color }} />
                    </div>
                    <p className="text-[10px] sm:text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>Yoqtirish</p>
                    <p className="font-bold text-xs sm:text-sm">98%</p>
                  </div>
                </div>

                {/* Variant Selection */}
                {selectedDish.variants && selectedDish.variants.length > 0 && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="font-bold mb-3 text-base sm:text-lg">Porsiya tanlang</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {selectedDish.variants.map((variant, idx) => {
                        const isSelected = selectedVariant === variant;
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedVariant(variant)}
                            className="rounded-lg overflow-hidden transition-all flex-shrink-0"
                            style={{
                              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                              border: `2px solid ${isSelected ? accentColor.color : 'transparent'}`,
                              boxShadow: isSelected ? `0 2px 8px ${accentColor.color}30` : 'none',
                              width: '100px'
                            }}
                          >
                            <div className="p-2">
                              {/* Image */}
                              <div className="w-full aspect-square rounded-md overflow-hidden bg-black/5 relative mb-1.5">
                                {variant.image ? (
                                  <img src={variant.image} alt={variant.name} className="w-full h-full object-cover" />
                                ) : selectedDish.images[0] ? (
                                  <img src={selectedDish.images[0]} alt={variant.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center" style={{ background: `${accentColor.color}20` }}>
                                    <Utensils className="w-5 h-5" style={{ color: accentColor.color }} />
                                  </div>
                                )}
                                {isSelected && (
                                  <div className="absolute top-1 right-1">
                                    <div
                                      className="w-4 h-4 rounded-full flex items-center justify-center"
                                      style={{ background: accentColor.color }}
                                    >
                                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="text-center">
                                <h4 className="font-bold text-[10px] mb-0.5 line-clamp-1">{variant.name}</h4>
                                <p className="text-xs font-bold" style={{ color: accentColor.color }}>
                                  {variant.price.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Additional Products */}
                {selectedDish.additionalProducts && selectedDish.additionalProducts.length > 0 && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="font-bold mb-3 text-base sm:text-lg">
                      Qo'shimchalar ({selectedDish.additionalProducts.length} ta)
                    </h3>
                    <div className="space-y-2">
                      {selectedDish.additionalProducts.map((addon, idx) => {
                        const selectedAddon = selectedAddons.find(a => a.name === addon.name);
                        const addonQuantity = selectedAddon?.quantity || 0;
                        
                        return (
                          <div
                            key={idx}
                            className="rounded-xl sm:rounded-2xl overflow-hidden transition-all"
                            style={{
                              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                              border: `1px solid ${addonQuantity > 0 ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')}`,
                              boxShadow: addonQuantity > 0 ? `0 2px 8px ${accentColor.color}20` : 'none'
                            }}
                          >
                            <div className="flex items-center justify-between gap-3 p-3">
                              {/* Name and Price */}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm mb-0.5 truncate">{addon.name}</h4>
                                <p className="text-xs" style={{ color: accentColor.color }}>
                                  +{addon.price.toLocaleString()} so'm
                                </p>
                              </div>

                              {/* Quantity Controls */}
                              {addonQuantity === 0 ? (
                                <button
                                  onClick={() => {
                                    setSelectedAddons([...selectedAddons, { name: addon.name, quantity: 1 }]);
                                    toast.success(`${addon.name} qo'shildi! 🎉`);
                                  }}
                                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: accentColor.color }}
                                >
                                  <Plus className="w-5 h-5 text-white" />
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      if (addonQuantity === 1) {
                                        setSelectedAddons(selectedAddons.filter(a => a.name !== addon.name));
                                        toast.info(`${addon.name} olib tashlandi`);
                                      } else {
                                        setSelectedAddons(selectedAddons.map(a => 
                                          a.name === addon.name ? { ...a, quantity: a.quantity - 1 } : a
                                        ));
                                      }
                                    }}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="text-lg font-bold w-6 text-center">{addonQuantity}</span>
                                  <button
                                    onClick={() => {
                                      setSelectedAddons(selectedAddons.map(a => 
                                        a.name === addon.name ? { ...a, quantity: a.quantity + 1 } : a
                                      ));
                                    }}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: accentColor.color }}
                                  >
                                    <Plus className="w-4 h-4 text-white" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedDish.description && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="font-bold mb-3 text-base sm:text-lg flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: `${accentColor.color}20` }}
                      >
                        📝
                      </div>
                      Tavsif
                    </h3>
                    <div 
                      className="p-4 rounded-2xl"
                      style={{ 
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                      }}
                    >
                      <p 
                        className="text-sm leading-relaxed"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
                      >
                        {selectedDish.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* Ingredients */}
                {selectedDish.ingredients && Array.isArray(selectedDish.ingredients) && selectedDish.ingredients.length > 0 && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="font-bold mb-3 text-base sm:text-lg flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: `${accentColor.color}20` }}
                      >
                        🥘
                      </div>
                      Tarkibi ({selectedDish.ingredients.length} ta)
                    </h3>
                    <div 
                      className="p-4 rounded-2xl"
                      style={{ 
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                      }}
                    >
                      <div className="flex flex-wrap gap-2">
                        {selectedDish.ingredients.map((ingredient, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2 rounded-xl text-sm font-medium"
                            style={{ 
                              background: `${accentColor.color}15`,
                              color: accentColor.color
                            }}
                          >
                            {ingredient}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Bar */}
              <div 
                className="fixed bottom-0 left-0 right-0 p-4"
                style={{ 
                  background: isDark ? '#000' : '#fff',
                  borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="text-xl font-bold w-8 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: accentColor.color, color: '#fff' }}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Add to Cart Button with Total Price */}
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 py-4 rounded-2xl font-bold text-base"
                    style={{ background: accentColor.color, color: '#fff' }}
                  >
                    <div className="flex items-center justify-between px-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>Savatga</span>
                      </div>
                      {selectedVariant && (
                        <span>
                          {(() => {
                            // Calculate addons total
                            const addonsTotal = selectedAddons.reduce((sum, addon) => {
                              const addonProduct = selectedDish.additionalProducts?.find(p => p.name === addon.name);
                              return sum + ((addonProduct?.price || 0) * addon.quantity);
                            }, 0);
                            
                            // Calculate total price
                            const dishTotal = selectedVariant.price * quantity;
                            const totalPrice = dishTotal + addonsTotal;
                            
                            return totalPrice.toLocaleString();
                          })()} so'm
                        </span>
                      )}
                    </div>
                  </button>
                </div>

                {/* Addons Summary */}
                {selectedAddons.length > 0 && (
                  <div 
                    className="mt-3 p-3 rounded-xl"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`
                    }}
                  >
                    <div className="space-y-1.5">
                      {/* Dish Price */}
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          {selectedDish.name} × {quantity}
                        </span>
                        <span className="font-bold">
                          {(selectedVariant.price * quantity).toLocaleString()} so'm
                        </span>
                      </div>
                      
                      {/* Addons */}
                      {selectedAddons.map((addon, idx) => {
                        const addonProduct = selectedDish.additionalProducts?.find(p => p.name === addon.name);
                        const addonTotal = (addonProduct?.price || 0) * addon.quantity;
                        return (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                              + {addon.name} × {addon.quantity}
                            </span>
                            <span className="font-bold" style={{ color: accentColor.color }}>
                              +{addonTotal.toLocaleString()} so'm
                            </span>
                          </div>
                        );
                      })}

                      {/* Divider */}
                      <div 
                        className="h-px my-2"
                        style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                      />

                      {/* Total */}
                      <div className="flex items-center justify-between text-base">
                        <span className="font-bold">Jami:</span>
                        <span className="font-bold text-lg" style={{ color: accentColor.color }}>
                          {(() => {
                            const addonsTotal = selectedAddons.reduce((sum, addon) => {
                              const addonProduct = selectedDish.additionalProducts?.find(p => p.name === addon.name);
                              return sum + ((addonProduct?.price || 0) * addon.quantity);
                            }, 0);
                            return (selectedVariant.price * quantity + addonsTotal).toLocaleString();
                          })()} so'm
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}