import { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import {
  Star,
  Clock,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Utensils,
  TrendingUp,
  Leaf,
  X,
  Plus,
  Minus,
  Phone,
  Heart,
  Share2,
  PackageCheck,
  Timer,
  Loader2,
  Armchair,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { notifyCartAdded } from '../utils/appToast';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { BannerCarousel } from './BannerCarousel';
import { regions as allRegions } from '../data/regions';
import { matchesSelectedLocation } from '../utils/locationMatching';
import { getMaxOrderableUnits } from '../utils/cartStock';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { ProductCardSkeleton, ProductGridSkeleton, ShopListSkeleton, SkeletonBox } from './skeletons';
import { useHeaderSearchOptional } from '../context/HeaderSearchContext';
import { matchesHeaderSearch, normalizeHeaderSearch } from '../utils/headerSearchMatch';
import {
  diningRoomCapacityRange,
  diningRoomImageList,
  formatDiningRoomCapacityLabel,
} from '../utils/diningRoomClient';

/** Restoran/taom modali — Telegram / notch ostida qolmasin */
const FOODS_MODAL_TOP_OFFSET = 'calc(1.5rem + var(--app-safe-top, env(safe-area-inset-top, 0px)))';
const FOODS_MODAL_LEFT_INSET = 'max(1rem, var(--app-safe-left, env(safe-area-inset-left, 0px)))';
const FOODS_MODAL_RIGHT_INSET = 'max(1rem, var(--app-safe-right, env(safe-area-inset-right, 0px)))';
const FOODS_MODAL_SECOND_ROW_TOP = 'calc(5rem + var(--app-safe-top, env(safe-area-inset-top, 0px)))';

interface Restaurant {
  id: string;
  branchId?: string;
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
  restaurantName?: string;
  restaurantBranchId?: string;
  restaurantRegion?: string;
  restaurantDistrict?: string;
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

/** Restoran joy bron — panel bilan mos maydonlar */
type PublicDiningRoom = {
  id: string;
  name: string;
  description?: string;
  capacity?: number;
  capacityMin?: number;
  capacityMax?: number;
  images?: string[];
  isPaidRoom?: boolean;
  priceUzs?: number;
};

interface FoodsViewProps {
  platform: string;
  onAddToCart: (
    dish: any,
    quantity: number,
    variant: any,
    additionalProducts: any[],
    diningRoom?: { id: string; name: string } | null,
  ) => void;
}

export default function FoodsView({ platform, onAddToCart }: FoodsViewProps) {
  const { theme, accentColor } = useTheme();
  const { selectedRegion, selectedDistrict } = useLocation();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'dishes' | 'restaurants'>('dishes');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [diningRooms, setDiningRooms] = useState<PublicDiningRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  /** Restoran paneli o‘chirganda mijoz «Joy bron qilish» ko‘rmaydi */
  const [publicTableBookingEnabled, setPublicTableBookingEnabled] = useState(true);
  const [bookingRoomId, setBookingRoomId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingParty, setBookingParty] = useState(2);
  const [bookingName, setBookingName] = useState('');
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  /** Xona kartadan tanlangach — sana/ism formasi alohida modalda */
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  /** Joy bron modalida rasmni katta ko‘rish */
  const [bookingImageLightbox, setBookingImageLightbox] = useState<{ urls: string[]; index: number } | null>(
    null,
  );
  const [dishDetailRooms, setDishDetailRooms] = useState<PublicDiningRoom[]>([]);
  const [dishDetailRoomsLoading, setDishDetailRoomsLoading] = useState(false);
  const [dishDetailRoomId, setDishDetailRoomId] = useState('');
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const { query: headerSearch } = useHeaderSearchOptional();
  const [loading, setLoading] = useState(true);
  /** Restoranlar bo‘yicha hali tugamagan taom so‘rovlari (progressive yuklash) */
  const [dishFetchesRemaining, setDishFetchesRemaining] = useState(0);
  const dishLoadGenRef = useRef(0);

  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedAddons, setSelectedAddons] = useState<{ name: string; quantity: number }[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Convert region ID to name for banners
  const selectedRegionData = allRegions.find(r => r.id === selectedRegion);
  const selectedRegionName = selectedRegionData?.name || '';
  const selectedDistrictData = selectedRegionData?.districts.find(d => d.id === selectedDistrict);
  const selectedDistrictName = selectedDistrictData?.name || '';

  useEffect(() => {
    void loadRestaurantsAndDishes();
  }, [selectedRegion, selectedDistrict]);

  useEffect(() => {
    if (!bookingRoomId) return;
    const room = diningRooms.find((r) => r.id === bookingRoomId);
    const { min, max } = diningRoomCapacityRange(room);
    setBookingParty((p) => Math.max(min, Math.min(max, p)));
  }, [bookingRoomId, diningRooms]);

  useEffect(() => {
    if (!bookingModalOpen) setBookingImageLightbox(null);
  }, [bookingModalOpen]);

  useEffect(() => {
    if (!bookingImageLightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setBookingImageLightbox(null);
      }
      if (e.key === 'ArrowLeft' && bookingImageLightbox.urls.length > 1) {
        e.preventDefault();
        setBookingImageLightbox((prev) =>
          prev
            ? {
                ...prev,
                index: (prev.index - 1 + prev.urls.length) % prev.urls.length,
              }
            : null,
        );
      }
      if (e.key === 'ArrowRight' && bookingImageLightbox.urls.length > 1) {
        e.preventDefault();
        setBookingImageLightbox((prev) =>
          prev
            ? {
                ...prev,
                index: (prev.index + 1) % prev.urls.length,
              }
            : null,
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bookingImageLightbox]);

  const loadRestaurantsAndDishes = async () => {
    const gen = ++dishLoadGenRef.current;
    try {
      setLoading(true);
      setAllDishes([]);
      setDishFetchesRemaining(0);
      const restaurantsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      const restaurantsResult = await restaurantsResponse.json();

      if (gen !== dishLoadGenRef.current) return;

      if (restaurantsResult.success) {
        const filtered = restaurantsResult.data.filter(
          (restaurant: Restaurant) =>
            restaurant.isActive &&
            matchesSelectedLocation(restaurant as unknown as Record<string, unknown>, {
              selectedRegionId: selectedRegion,
              selectedDistrictId: selectedDistrict,
            }),
        );
        setRestaurants(filtered);
        setLoading(false);
        startProgressiveDishes(filtered, gen);
      } else {
        setRestaurants([]);
        setAllDishes([]);
        setLoading(false);
      }
    } catch (error) {
      console.error('Load restaurants error:', error);
      toast.error('Restoranlarni yuklashda xatolik!');
      setLoading(false);
    }
  };

  /** Har restoran uchun parallel so‘rov; tugaganlari bo‘yicha ro‘yxatga qo‘shiladi */
  const startProgressiveDishes = (restaurantList: Restaurant[], gen: number) => {
    if (restaurantList.length === 0) {
      setDishFetchesRemaining(0);
      return;
    }
    setDishFetchesRemaining(restaurantList.length);
    for (const restaurant of restaurantList) {
      void (async () => {
        try {
          const rid = encodeURIComponent(restaurant.id);
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/dishes`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } },
          );
          const result = await response.json();
          if (gen !== dishLoadGenRef.current) return;
          if (result.success && Array.isArray(result.data)) {
            const activeDishes = result.data
              .filter((d: Dish) => d.isActive)
              .map((d: Dish) => ({
                ...d,
                restaurantId: restaurant.id,
                restaurantName: restaurant.name,
                restaurantBranchId: restaurant.branchId,
                restaurantRegion: restaurant.region,
                restaurantDistrict: restaurant.district,
              }));
            setAllDishes((prev) => {
              if (gen !== dishLoadGenRef.current) return prev;
              const seen = new Set(prev.map((x) => x.id));
              const add = activeDishes.filter((d) => !seen.has(d.id));
              return add.length ? [...prev, ...add] : prev;
            });
          }
        } catch (err) {
          console.error(`Taomlar: ${restaurant.name}`, err);
        } finally {
          if (gen === dishLoadGenRef.current) {
            setDishFetchesRemaining((n) => Math.max(0, n - 1));
          }
        }
      })();
    }
  };

  useVisibilityRefetch(() => {
    void loadRestaurantsAndDishes();
  });

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

  const submitTableBooking = async () => {
    if (!selectedRestaurant || !bookingRoomId) {
      toast.error('Xona tanlang');
      return;
    }
    if (!bookingName.trim() || !bookingPhone.trim()) {
      toast.error('Ism va telefon majburiy');
      return;
    }
    const brRoom = diningRooms.find((r) => r.id === bookingRoomId);
    const { min: capMin, max: capMax } = diningRoomCapacityRange(brRoom);
    if (bookingParty < capMin || bookingParty > capMax) {
      toast.error(`Odamlar soni ${capMin} dan ${capMax} gacha bo‘lishi kerak`);
      return;
    }
    try {
      setBookingSubmitting(true);
      const rid = encodeURIComponent(selectedRestaurant.id);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/table-bookings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            roomId: bookingRoomId,
            customerName: bookingName.trim(),
            customerPhone: bookingPhone.trim(),
            bookingDate,
            bookingTime,
            partySize: bookingParty,
            notes: bookingNotes.trim(),
          }),
        },
      );
      const j = await res.json();
      if (j.success) {
        toast.success('Bron yuborildi! Restoran Telegram orqali xabardor qilindi.');
        setBookingNotes('');
        setBookingModalOpen(false);
        setBookingRoomId('');
      } else {
        toast.error(j.error || 'Bron qilishda xatolik');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedDish || !selectedVariant) {
      toast.error('Variant tanlang!');
      return;
    }

    const stockProbe = {
      restaurantId: selectedDish.restaurantId,
      catalogId: 'foods',
      quantity,
      stockQuantity: (selectedVariant as any)?.stockQuantity,
      stockCount: (selectedVariant as any)?.stockCount,
      dishDetails: {},
      available: (selectedDish as any)?.available,
    };
    const max = getMaxOrderableUnits(stockProbe);
    if (max !== null && (max <= 0 || quantity > max)) {
      toast.error(max <= 0 ? 'Mahsulot tugagan' : `Omborda faqat ${max} ta qoldi`);
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
    
    const diningRoom =
      dishDetailRoomId && dishDetailRooms.some((x) => x.id === dishDetailRoomId)
        ? {
            id: dishDetailRoomId,
            name: dishDetailRooms.find((x) => x.id === dishDetailRoomId)?.name || 'Joy',
          }
        : null;
    onAddToCart(selectedDish, quantity, selectedVariant, selectedAddonProducts, diningRoom);
    notifyCartAdded(quantity, { name: selectedDish.name });
    setSelectedDish(null);
  };

  const getRestaurantName = (restaurantId: string) => {
    const restaurant = restaurants.find(r => r.id === restaurantId);
    return restaurant?.name || '';
  };

  const filteredDishes = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return allDishes;
    return allDishes.filter((d) =>
      matchesHeaderSearch(headerSearch, [
        d.name,
        d.description,
        Array.isArray(d.ingredients) ? d.ingredients.join(' ') : '',
        getRestaurantName(d.restaurantId),
        d.weight,
        String(d.kcal || ''),
      ]),
    );
  }, [allDishes, headerSearch, restaurants]);

  const filteredRestaurants = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return restaurants;
    return restaurants.filter((r) =>
      matchesHeaderSearch(headerSearch, [r.name, r.type, r.description, r.contact?.address, r.contact?.phone]),
    );
  }, [restaurants, headerSearch]);

  const todayDateInputMin = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  const selectedRestaurantDishes = useMemo(() => {
    if (!selectedRestaurant) return [];
    const base = allDishes.filter((d) => d.restaurantId === selectedRestaurant.id);
    if (!normalizeHeaderSearch(headerSearch)) return base;
    return base.filter((d) =>
      matchesHeaderSearch(headerSearch, [
        d.name,
        d.description,
        Array.isArray(d.ingredients) ? d.ingredients.join(' ') : '',
        d.weight,
        String(d.kcal || ''),
      ]),
    );
  }, [selectedRestaurant, allDishes, headerSearch]);

  useEffect(() => {
    if (selectedRestaurant && !restaurants.some(restaurant => restaurant.id === selectedRestaurant.id)) {
      setSelectedRestaurant(null);
    }
  }, [restaurants, selectedRestaurant]);

  useEffect(() => {
    if (!selectedRestaurant) {
      setDiningRooms([]);
      setBookingRoomId('');
      setPublicTableBookingEnabled(true);
      setBookingModalOpen(false);
      return;
    }
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setBookingDate(`${y}-${m}-${d}`);
    setBookingTime('18:00');
    let cancelled = false;
    (async () => {
      setRoomsLoading(true);
      try {
        const rid = encodeURIComponent(selectedRestaurant.id);
        const r = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/rooms?public=1`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        const j = await r.json();
        const list = j.success && Array.isArray(j.data) ? j.data : [];
        const bookingOn = j.publicTableBookingEnabled !== false;
        if (!cancelled) {
          setPublicTableBookingEnabled(bookingOn);
          setDiningRooms(list);
          setBookingRoomId((prev) =>
            prev && list.some((x: { id: string }) => x.id === prev) ? prev : '',
          );
          if (!bookingOn) {
            setBookingModalOpen(false);
            setBookingRoomId('');
          }
        }
      } catch {
        if (!cancelled) {
          setDiningRooms([]);
          setPublicTableBookingEnabled(true);
        }
      } finally {
        if (!cancelled) setRoomsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRestaurant?.id]);

  useEffect(() => {
    if (!selectedRestaurant) setBookingModalOpen(false);
  }, [selectedRestaurant]);

  useEffect(() => {
    if (selectedDish && !allDishes.some(dish => dish.id === selectedDish.id)) {
      setSelectedDish(null);
    }
  }, [allDishes, selectedDish]);

  useEffect(() => {
    if (!selectedDish?.restaurantId) {
      setDishDetailRooms([]);
      setDishDetailRoomId('');
      return;
    }
    let cancelled = false;
    (async () => {
      setDishDetailRoomsLoading(true);
      try {
        const rid = encodeURIComponent(selectedDish.restaurantId);
        const r = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/rooms?public=1`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        const j = await r.json();
        const list = j.success && Array.isArray(j.data) ? j.data : [];
        if (!cancelled) {
          setDishDetailRooms(list);
          setDishDetailRoomId((prev) => {
            if (prev && list.some((x: { id: string }) => x.id === prev)) return prev;
            if (list.length === 1) return list[0].id;
            return '';
          });
        }
      } catch {
        if (!cancelled) {
          setDishDetailRooms([]);
          setDishDetailRoomId('');
        }
      } finally {
        if (!cancelled) setDishDetailRoomsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDish?.id, selectedDish?.restaurantId]);

  return (
    <div
      className="min-h-screen pb-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom)))]"
      style={{ background: isDark ? '#000000' : '#f5f5f5' }}
    >
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

      <p
        className="text-xs px-4 -mt-2 mb-4"
        style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.45)' }}
      >
        Qidiruv — sahifa tepasidagi maydon orqali (taom nomi, restoran, tavsif).
      </p>

      {loading ? (
        <div className="px-4 pb-8" aria-hidden>
          {activeTab === 'dishes' ? (
            <ProductGridSkeleton
              isDark={isDark}
              count={10}
              gridClassName="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-5"
            />
          ) : (
            <ShopListSkeleton isDark={isDark} rows={5} />
          )}
        </div>
      ) : (
        <>
          {/* DISHES TAB */}
          {activeTab === 'dishes' && (
            <div className="px-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-5">
                {filteredDishes.map((dish) => {
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
                      <div className="w-full aspect-square bg-black/10 relative">
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
                {filteredDishes.length === 0 &&
                  dishFetchesRemaining > 0 &&
                  Array.from({ length: Math.min(8, Math.max(dishFetchesRemaining, 4)) }, (_, i) => (
                    <ProductCardSkeleton
                      key={`dish-pending-${i}`}
                      isDark={isDark}
                      imageClassName="aspect-square"
                    />
                  ))}
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
                        style={{
                          background: restaurant.isActive ? accentColor.color : 'rgba(107,114,128,0.9)',
                          color: '#fff',
                        }}
                      >
                        {restaurant.isActive ? 'OCHIQ' : 'YOPILGAN'}
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
            className="fixed inset-0 app-safe-pad bg-black/80 z-[100]"
            onClick={() => setSelectedRestaurant(null)}
          />
          
          <div 
            className="fixed inset-0 app-safe-pad z-[101] overflow-y-auto"
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
                  type="button"
                  className="absolute w-12 h-12 rounded-full flex items-center justify-center z-10"
                  style={{
                    top: FOODS_MODAL_TOP_OFFSET,
                    left: FOODS_MODAL_LEFT_INSET,
                    background: 'rgba(0, 0, 0, 0.5)',
                  }}
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

                  {(roomsLoading ||
                    !publicTableBookingEnabled ||
                    diningRooms.length > 0) && (
                  <div
                    className="p-4 rounded-2xl mb-6 border"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Armchair className="w-6 h-6 shrink-0" style={{ color: accentColor.color }} />
                      <h3 className="font-bold text-lg">Joy bron qilish</h3>
                    </div>
                    {roomsLoading ? (
                      <div className="grid grid-cols-2 gap-3 py-1 sm:grid-cols-3" aria-hidden>
                        <SkeletonBox isDark={isDark} className="h-24 rounded-2xl" />
                        <SkeletonBox isDark={isDark} className="h-24 rounded-2xl" />
                        <SkeletonBox isDark={isDark} className="hidden h-24 rounded-2xl sm:block" />
                      </div>
                    ) : !publicTableBookingEnabled ? (
                      <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                        Bu restoran hozircha onlayn joy bron qabul qilmaydi. Telefon orqali bog‘laning yoki keyinroq urinib ko‘ring.
                      </p>
                    ) : diningRooms.length === 0 ? (
                      <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                        Ushbu restoran hozircha onlayn joy bronini yoqmaganda. Keyinroq urinib ko‘ring yoki telefon orqali bog‘laning.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs mb-3" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                          Xonani tanlang — sana, vaqt va aloqa ma’lumotlari keyingi qadamda ochiladi. So‘rov restoranga Telegram orqali boradi.
                        </p>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          {diningRooms.map((room) => {
                            const imgs = diningRoomImageList(room);
                            const capLbl = formatDiningRoomCapacityLabel(room);
                            const paid = Boolean(room.isPaidRoom) && Number(room.priceUzs) > 0;
                            return (
                              <button
                                key={room.id}
                                type="button"
                                onClick={() => {
                                  setBookingRoomId(room.id);
                                  setBookingModalOpen(true);
                                }}
                                className="text-left rounded-2xl border overflow-hidden transition-all active:scale-[0.98] hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                                style={{
                                  background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.02)',
                                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                                  boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                                }}
                              >
                                <div className="relative h-24 w-full bg-black/15">
                                  {imgs[0] ? (
                                    <img src={imgs[0]} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <Armchair className="h-8 w-8 opacity-35" style={{ color: accentColor.color }} />
                                    </div>
                                  )}
                                </div>
                                <div className="p-3">
                                  <p className="font-bold text-sm leading-tight mb-0.5" style={{ color: isDark ? '#fff' : '#111' }}>
                                    {room.name}
                                  </p>
                                  <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}>
                                    {capLbl}
                                  </p>
                                  {paid ? (
                                    <p className="text-xs font-semibold mt-0.5" style={{ color: accentColor.color }}>
                                      {Number(room.priceUzs).toLocaleString('uz-UZ')} so‘m
                                    </p>
                                  ) : null}
                                  {room.description ? (
                                    <p className="text-xs mt-1 line-clamp-2" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
                                      {room.description}
                                    </p>
                                  ) : null}
                                  <p className="text-xs font-semibold mt-2" style={{ color: accentColor.color }}>
                                    Tanlash →
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                  )}
                </div>

                {/* Menu */}
                <div className="px-4 pb-6">
                  <h3 className="text-xl font-bold mb-4">Menyu ({selectedRestaurantDishes.length} ta taom)</h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-5">
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

          {publicTableBookingEnabled && bookingModalOpen && bookingRoomId ? (
            <>
              <button
                type="button"
                aria-label="Bron oynasini yopish"
                className="fixed inset-0 app-safe-pad z-[110] w-full cursor-default border-0 p-0"
                style={{ background: 'rgba(0,0,0,0.65)' }}
                disabled={bookingSubmitting}
                onClick={() => {
                  if (!bookingSubmitting) {
                    setBookingModalOpen(false);
                    setBookingRoomId('');
                  }
                }}
              />
              <div className="fixed inset-0 app-safe-pad z-[111] flex items-end justify-center p-0 sm:items-center sm:p-4 pointer-events-none">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="booking-modal-title"
                  className="pointer-events-auto w-full max-h-[min(92dvh,720px)] overflow-y-auto rounded-t-[1.75rem] border p-5 pb-6 shadow-2xl sm:max-w-md sm:rounded-3xl"
                  style={{
                    background: isDark ? '#141414' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-xs font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                        Joy bron qilish
                      </p>
                      <h4 id="booking-modal-title" className="text-lg font-bold leading-snug" style={{ color: isDark ? '#fff' : '#111' }}>
                        {diningRooms.find((r) => r.id === bookingRoomId)?.name ?? 'Xona'}
                      </h4>
                      {(() => {
                        const sel = diningRooms.find((r) => r.id === bookingRoomId);
                        const capLbl = formatDiningRoomCapacityLabel(sel);
                        const paid = Boolean(sel?.isPaidRoom) && Number(sel?.priceUzs) > 0;
                        const imgs = diningRoomImageList(sel);
                        return (
                          <>
                            {imgs.length > 0 ? (
                              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                                {imgs.map((u, imgIdx) => (
                                  <button
                                    key={u}
                                    type="button"
                                    onClick={() => setBookingImageLightbox({ urls: imgs, index: imgIdx })}
                                    className="relative shrink-0 cursor-zoom-in overflow-hidden rounded-lg border outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                                    style={{
                                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                                      boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                                    }}
                                    aria-label={`Rasmni katta ko‘rish ${imgIdx + 1} / ${imgs.length}`}
                                  >
                                    <img src={u} alt="" className="h-16 w-20 object-cover" />
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            <p className="mt-1 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}>
                              {capLbl}
                            </p>
                            {paid ? (
                              <p className="mt-0.5 text-sm font-semibold" style={{ color: accentColor.color }}>
                                Joy narxi: {Number(sel?.priceUzs).toLocaleString('uz-UZ')} so‘m
                              </p>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!bookingSubmitting) {
                          setBookingModalOpen(false);
                          setBookingRoomId('');
                        }
                      }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                      aria-label="Yopish"
                    >
                      <X className="h-5 w-5" style={{ color: isDark ? '#fff' : '#111' }} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-xs font-semibold" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>
                          <CalendarDays className="h-3.5 w-3.5" />
                          Sana
                        </label>
                        <input
                          type="date"
                          value={bookingDate}
                          min={todayDateInputMin}
                          onChange={(e) => setBookingDate(e.target.value)}
                          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                          style={{
                            background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                            color: isDark ? '#fff' : '#111',
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>
                          Vaqt
                        </label>
                        <input
                          type="time"
                          value={bookingTime}
                          onChange={(e) => setBookingTime(e.target.value)}
                          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                          style={{
                            background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                            color: isDark ? '#fff' : '#111',
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      {(() => {
                        const r = diningRooms.find((x) => x.id === bookingRoomId);
                        const { min: pMin, max: pMax } = diningRoomCapacityRange(r);
                        return (
                          <>
                            <label className="mb-1 block text-xs font-semibold" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>
                              Odamlar soni ({pMin}–{pMax})
                            </label>
                            <input
                              type="number"
                              min={pMin}
                              max={pMax}
                              value={bookingParty}
                              onChange={(e) =>
                                setBookingParty(Math.max(pMin, Math.min(pMax, Number(e.target.value) || pMin)))
                              }
                              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                              style={{
                                background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                                color: isDark ? '#fff' : '#111',
                              }}
                            />
                          </>
                        );
                      })()}
                    </div>
                    <input
                      type="text"
                      placeholder="Ismingiz"
                      value={bookingName}
                      onChange={(e) => setBookingName(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{
                        background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                        color: isDark ? '#fff' : '#111',
                      }}
                    />
                    <input
                      type="tel"
                      placeholder="Telefon (+998...)"
                      value={bookingPhone}
                      onChange={(e) => setBookingPhone(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{
                        background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                        color: isDark ? '#fff' : '#111',
                      }}
                    />
                    <textarea
                      placeholder="Izoh (ixtiyoriy)"
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none"
                      style={{
                        background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                        color: isDark ? '#fff' : '#111',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void submitTableBooking()}
                      disabled={bookingSubmitting}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold disabled:opacity-60"
                      style={{ background: accentColor.color, color: '#fff' }}
                    >
                      {bookingSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Yuborilmoqda…
                        </>
                      ) : (
                        'Bronni yuborish'
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={bookingSubmitting}
                      onClick={() => {
                        setBookingModalOpen(false);
                        setBookingRoomId('');
                      }}
                      className="w-full py-2 text-center text-sm font-medium disabled:opacity-50"
                      style={{ color: accentColor.color }}
                    >
                      Boshqa xona tanlash
                    </button>
                  </div>
                </div>
              </div>

              {bookingImageLightbox && bookingImageLightbox.urls.length > 0 ? (
                <div
                  className="fixed inset-0 z-[125] flex flex-col app-safe-pad"
                  style={{ background: 'rgba(0,0,0,0.94)' }}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Xona rasmi"
                  onClick={() => setBookingImageLightbox(null)}
                >
                  <div
                    className="flex shrink-0 items-center justify-between gap-2 px-2 py-2 sm:px-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs font-medium text-white/85">
                      {bookingImageLightbox.index + 1} / {bookingImageLightbox.urls.length}
                    </p>
                    <button
                      type="button"
                      onClick={() => setBookingImageLightbox(null)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                      aria-label="Yopish"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div
                    className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6 sm:px-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {bookingImageLightbox.urls.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setBookingImageLightbox((prev) =>
                            prev && prev.urls.length > 1
                              ? {
                                  ...prev,
                                  index: (prev.index - 1 + prev.urls.length) % prev.urls.length,
                                }
                              : prev,
                          )
                        }
                        className="absolute left-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white shadow-lg sm:left-3 sm:h-12 sm:w-12"
                        aria-label="Oldingi rasm"
                      >
                        <ChevronLeft className="h-7 w-7" />
                      </button>
                    ) : null}
                    <img
                      src={bookingImageLightbox.urls[bookingImageLightbox.index]}
                      alt=""
                      className="max-h-[min(82dvh,820px)] max-w-full rounded-lg object-contain shadow-2xl"
                    />
                    {bookingImageLightbox.urls.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setBookingImageLightbox((prev) =>
                            prev && prev.urls.length > 1
                              ? {
                                  ...prev,
                                  index: (prev.index + 1) % prev.urls.length,
                                }
                              : prev,
                          )
                        }
                        className="absolute right-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white shadow-lg sm:right-3 sm:h-12 sm:w-12"
                        aria-label="Keyingi rasm"
                      >
                        <ChevronRight className="h-7 w-7" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}

      {/* DISH DETAIL MODAL */}
      {selectedDish && (
        <>
          <div 
            className="fixed inset-0 app-safe-pad bg-black z-[100]"
            onClick={() => setSelectedDish(null)}
          />
          
          <div 
            className="fixed inset-0 app-safe-pad z-[101] overflow-y-auto"
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
                  type="button"
                  className="absolute w-12 h-12 rounded-full flex items-center justify-center z-10"
                  style={{
                    top: FOODS_MODAL_TOP_OFFSET,
                    left: FOODS_MODAL_LEFT_INSET,
                    background: 'rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <X className="w-6 h-6 text-white" />
                </button>

                {/* Popular Badge */}
                {selectedDish.isPopular && (
                  <div 
                    className="absolute px-3 py-1.5 rounded-xl text-xs font-bold z-10"
                    style={{
                      top: FOODS_MODAL_TOP_OFFSET,
                      right: FOODS_MODAL_RIGHT_INSET,
                      background: '#fbbf24',
                      color: '#000',
                    }}
                  >
                    MASHHUR
                  </div>
                )}

                {/* Natural Badge */}
                {selectedDish.isNatural && (
                  <div 
                    className="absolute w-12 h-12 rounded-2xl flex items-center justify-center z-10"
                    style={{
                      top: FOODS_MODAL_SECOND_ROW_TOP,
                      left: FOODS_MODAL_LEFT_INSET,
                      background: accentColor.color,
                    }}
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
                                    notifyCartAdded(1, { name: addon.name });
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

                {(dishDetailRoomsLoading || dishDetailRooms.length > 0) && (
                  <div
                    className="mb-4 sm:mb-6 p-4 rounded-2xl border"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    <h3 className="mb-2 flex items-center gap-2 text-base font-bold sm:text-lg">
                      <Armchair className="h-5 w-5 shrink-0" style={{ color: accentColor.color }} />
                      Joy / xona
                    </h3>
                    {dishDetailRoomsLoading ? (
                      <div className="grid grid-cols-2 gap-3 py-1 sm:grid-cols-3" aria-hidden>
                        <SkeletonBox isDark={isDark} className="h-24 rounded-2xl" />
                        <SkeletonBox isDark={isDark} className="h-24 rounded-2xl" />
                        <SkeletonBox isDark={isDark} className="hidden h-24 rounded-2xl sm:block" />
                      </div>
                    ) : (
                      <>
                        <p className="mb-3 text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                          Buyurtma qaysi joyda tayyorlanishini tanlang (tavsifdan yuqori). Kartani bosing.
                        </p>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          {dishDetailRooms.map((room) => {
                            const selected = dishDetailRoomId === room.id;
                            const imgs = diningRoomImageList(room);
                            const capLbl = formatDiningRoomCapacityLabel(room);
                            const paid = Boolean(room.isPaidRoom) && Number(room.priceUzs) > 0;
                            return (
                              <button
                                key={room.id}
                                type="button"
                                onClick={() => setDishDetailRoomId(room.id)}
                                className="overflow-hidden rounded-2xl border text-left transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                                style={{
                                  background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.02)',
                                  borderColor: selected
                                    ? accentColor.color
                                    : isDark
                                      ? 'rgba(255,255,255,0.12)'
                                      : 'rgba(0,0,0,0.08)',
                                  boxShadow: selected ? `0 0 0 2px ${accentColor.color}55` : isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                                }}
                              >
                                <div className="relative h-20 w-full bg-black/15">
                                  {imgs[0] ? (
                                    <img src={imgs[0]} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <Armchair className="h-7 w-7 opacity-35" style={{ color: accentColor.color }} />
                                    </div>
                                  )}
                                </div>
                                <div className="p-3 sm:p-4">
                                  <p className="text-sm font-bold leading-tight" style={{ color: isDark ? '#fff' : '#111' }}>
                                    {room.name}
                                  </p>
                                  <p className="mt-0.5 text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}>
                                    {capLbl}
                                  </p>
                                  {paid ? (
                                    <p className="mt-0.5 text-xs font-semibold" style={{ color: accentColor.color }}>
                                      {Number(room.priceUzs).toLocaleString('uz-UZ')} so‘m
                                    </p>
                                  ) : null}
                                  {room.description ? (
                                    <p className="mt-1 line-clamp-2 text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
                                      {room.description}
                                    </p>
                                  ) : null}
                                  {selected ? (
                                    <p className="mt-2 text-xs font-semibold" style={{ color: accentColor.color }}>
                                      Tanlangan
                                    </p>
                                  ) : (
                                    <p className="mt-2 text-xs font-semibold opacity-70" style={{ color: accentColor.color }}>
                                      Tanlash
                                    </p>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {dishDetailRoomId ? (
                          <button
                            type="button"
                            onClick={() => setDishDetailRoomId('')}
                            className="mt-3 w-full py-2 text-center text-sm font-medium"
                            style={{ color: accentColor.color }}
                          >
                            Tanlovni bekor qilish
                          </button>
                        ) : null}
                      </>
                    )}
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