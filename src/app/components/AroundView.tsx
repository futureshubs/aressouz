import { useState, useEffect, memo, useRef, useCallback, useMemo } from 'react';
import { MapPin, Map as MapIcon, Grid3x3, Plus } from 'lucide-react';
import { placeCategories, Place, PlaceCategory } from '../data/places';
import { PlaceCard } from './PlaceCard';
import { CategoryCard } from './CategoryCard';
import { PlaceDetailModal } from './PlaceDetailModal';
import { FullMapView } from './FullMapView';
import { AddPlaceModal } from './AddPlaceModal';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { calculateDistance, formatDistance, getUserLocation } from '../utils/distance';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { ProductGridSkeleton } from './skeletons';
import { useHeaderSearchOptional } from '../context/HeaderSearchContext';
import { matchesHeaderSearch, normalizeHeaderSearch } from '../utils/headerSearchMatch';

interface AroundViewProps {
  platform: Platform;
}

export const AroundView = memo(function AroundView({ platform }: AroundViewProps) {
  const { theme, accentColor } = useTheme();
  const { selectedRegion: headerRegion, selectedDistrict: headerDistrict } = useLocation();
  const { query: headerSearch } = useHeaderSearchOptional();
  const [activeTab, setActiveTab] = useState<'around' | 'map' | 'catalog'>('around');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showFullMap, setShowFullMap] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(10); // Lazy loading - birin-ketin yuklash
  const loadMoreRef = useRef<HTMLDivElement>(null); // Intersection Observer uchun
  const filteredPlacesLenRef = useRef(0);
  const fetchPlacesRef = useRef<(opts?: { showSkeleton?: boolean }) => Promise<void>>(async () => {});
  
  const isDark = theme === 'dark';
  const userLat = userLocation?.lat;
  const userLng = userLocation?.lng;
  const isIOS = platform === 'ios';

  // Get user location on mount
  useEffect(() => {
    getUserLocation().then(location => {
      setUserLocation(location);
    });
  }, []);

  // Filter places by category for display
  const filteredPlaces = selectedCategoryId
    ? places.filter(place => place.categoryId === selectedCategoryId)
    : places;

  const searchFilteredPlaces = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return filteredPlaces;
    return filteredPlaces.filter((place) =>
      matchesHeaderSearch(headerSearch, [
        place.name,
        place.category,
        place.address,
        place.description,
        place.phone,
        place.location,
        place.region,
        place.district,
        ...(place.services ?? []),
      ]),
    );
  }, [filteredPlaces, headerSearch]);

  filteredPlacesLenRef.current = searchFilteredPlaces.length;

  // Intersection Observer — visibleCount dependency yo'q: aks holda observer qayta yaratilib,
  // sentinel hali ko'rinsa ketma-ket +10 bo'lib, kartalar "doim yangilanayotgandek" bo'lardi.
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || searchFilteredPlaces.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setVisibleCount((prev) => {
          const max = filteredPlacesLenRef.current;
          if (prev >= max) return prev;
          return Math.min(prev + 10, max);
        });
      },
      { threshold: 0.7 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [searchFilteredPlaces.length]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [selectedCategoryId, headerRegion, headerDistrict, headerSearch]);

  // Fetch places from backend (showSkeleton: tab/filtr o'zgarganda; silent: fonda yangilash)
  const fetchPlaces = useCallback(
    async (options?: { showSkeleton?: boolean }) => {
      const showSkeleton = options?.showSkeleton !== false;
      if (showSkeleton) setLoading(true);

      try {
        const params = new URLSearchParams();
        if (headerRegion) params.append('region', headerRegion);
        if (headerDistrict) params.append('district', headerDistrict);
        if (selectedCategoryId) params.append('category', selectedCategoryId);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/places?${params}`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error('Joylarni yuklashda xatolik');
        }

        const data = await response.json();
        let fetchedPlaces = data.places || [];

        if (userLat != null && userLng != null) {
          fetchedPlaces = fetchedPlaces.map((place: Place) => {
            if (!place.coordinates || !Array.isArray(place.coordinates) || place.coordinates.length < 2) {
              return {
                ...place,
                distance: "Noma'lum",
              };
            }

            const distance = calculateDistance(
              userLat,
              userLng,
              place.coordinates[0],
              place.coordinates[1],
            );
            return {
              ...place,
              distance: formatDistance(distance),
            };
          });
        }

        setPlaces(fetchedPlaces);

        const counts: Record<string, number> = {};
        fetchedPlaces.forEach((place: Place) => {
          counts[place.categoryId] = (counts[place.categoryId] || 0) + 1;
        });
        setCategoryCounts(counts);
      } catch (error) {
        console.error('❌ Error fetching places:', error);
        setPlaces([]);
      } finally {
        setLoading(false);
      }
    },
    [headerRegion, headerDistrict, selectedCategoryId, userLat, userLng],
  );

  fetchPlacesRef.current = fetchPlaces;

  useEffect(() => {
    void fetchPlacesRef.current({ showSkeleton: true });
  }, [headerRegion, headerDistrict, selectedCategoryId]);

  useEffect(() => {
    if (userLat == null || userLng == null) return;
    void fetchPlacesRef.current({ showSkeleton: false });
  }, [userLat, userLng]);

  useVisibilityRefetch(() => {
    void fetchPlacesRef.current({ showSkeleton: false });
  });

  const refreshPlacesSilent = useCallback(() => {
    void fetchPlacesRef.current({ showSkeleton: false });
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setActiveTab('around');
  };

  // Update category counts for display
  const categoriesWithCounts = placeCategories.map(cat => ({
    ...cat,
    count: categoryCounts[cat.id] || 0,
  }));

  return (
    <>
      <div className="pb-8 sm:pb-12">
        {/* Max-width container for all content */}
        <div className="w-full mx-auto">
          {/* Tabs */}
          <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
            <div 
              className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 rounded-xl sm:rounded-2xl"
              style={{
                background: isDark 
                  ? (isIOS ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))' : 'linear-gradient(135deg, #1a1a1a, #141414)')
                  : (isIOS ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))' : 'linear-gradient(135deg, #ffffff, #fafafa)'),
                backdropFilter: isIOS ? 'blur(20px)' : undefined,
                border: isDark 
                  ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.08)')
                  : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)'),
                boxShadow: isDark
                  ? 'none'
                  : (isIOS ? '0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : '0 4px 12px rgba(0, 0, 0, 0.08)'),
              }}
            >
              <button
                onClick={() => setActiveTab('around')}
                className="flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-[10px] sm:text-xs transition-all"
                style={{
                  backgroundImage: activeTab === 'around' ? accentColor.gradient : 'none',
                  color: activeTab === 'around' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
                  boxShadow: activeTab === 'around' ? `0 4px 12px ${accentColor.color}66` : 'none',
                }}
              >
                <MapPin className="size-3.5 sm:size-4" strokeWidth={2.5} />
                Atrof
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('map');
                  setShowFullMap(true);
                }}
                className="flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-[10px] sm:text-xs transition-all"
                style={{
                  backgroundImage: activeTab === 'map' ? accentColor.gradient : 'none',
                  color: activeTab === 'map' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
                  boxShadow: activeTab === 'map' ? `0 4px 12px ${accentColor.color}66` : 'none',
                }}
              >
                <MapIcon className="size-3.5 sm:size-4" strokeWidth={2.5} />
                Xarita
              </button>

              <button
                onClick={() => setActiveTab('catalog')}
                className="flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-[10px] sm:text-xs transition-all"
                style={{
                  backgroundImage: activeTab === 'catalog' ? accentColor.gradient : 'none',
                  color: activeTab === 'catalog' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
                  boxShadow: activeTab === 'catalog' ? `0 4px 12px ${accentColor.color}66` : 'none',
                }}
              >
                <Grid3x3 className="size-3.5 sm:size-4" strokeWidth={2.5} />
                Katalog
              </button>
            </div>

            {/* Action Buttons */}
            {activeTab === 'around' && (
              <div className="mt-3 sm:mt-4 flex items-center gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white transition-all active:scale-95"
                  style={{
                    backgroundImage: accentColor.gradient,
                    boxShadow: `0 4px 12px ${accentColor.color}44`,
                  }}
                >
                  <Plus className="size-3.5 sm:size-4" />
                  Joy qo'shish
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="w-full mx-auto">
            {/* Around Tab */}
            {activeTab === 'around' && (
              <div>
                {/* Header with back button */}
                {selectedCategoryId ? (
                  <div className="mb-4 sm:mb-6">
                    <button
                      onClick={() => setSelectedCategoryId(null)}
                      className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl transition-all active:scale-95"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        color: accentColor.color,
                      }}
                    >
                      <svg className="size-4 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span className="font-semibold text-xs sm:text-sm">Orqaga</span>
                    </button>
                    <div className="flex items-center justify-between">
                      <h2 
                        className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold"
                        style={{ color: isDark ? '#ffffff' : '#111827' }}
                      >
                        {placeCategories.find(c => c.id === selectedCategoryId)?.icon} {placeCategories.find(c => c.id === selectedCategoryId)?.name}
                      </h2>
                      <span 
                        className="text-[10px] sm:text-xs md:text-sm"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                      >
                        {loading ? '...' : `${searchFilteredPlaces.length} ta`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h2 
                      className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold"
                      style={{ color: isDark ? '#ffffff' : '#111827' }}
                    >
                      Atrofdagi joylar
                    </h2>
                    <span 
                      className="text-[10px] sm:text-xs md:text-sm"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      {loading ? '...' : `${searchFilteredPlaces.length} ta`}
                    </span>
                  </div>
                )}

                {loading ? (
                  <ProductGridSkeleton
                    isDark={isDark}
                    count={10}
                    gridClassName="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 md:gap-4"
                  />
                ) : searchFilteredPlaces.length === 0 ? (
                  <div className="text-center py-12 sm:py-20">
                    <MapPin className="size-12 sm:size-16 mx-auto mb-3 sm:mb-4 opacity-30" />
                    <p className="text-base sm:text-lg font-semibold mb-1 sm:mb-2"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}
                    >
                      Joylar topilmadi
                    </p>
                    <p className="text-xs sm:text-sm mb-4 sm:mb-6"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      Bu kategoriyada hozircha joylar yo'q
                    </p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base text-white transition-all active:scale-95"
                      style={{
                        backgroundImage: accentColor.gradient,
                        boxShadow: `0 4px 12px ${accentColor.color}44`,
                      }}
                    >
                      Birinchi bo'lib qo'shing
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 md:gap-4">
                    {searchFilteredPlaces.slice(0, visibleCount).map((place) => (
                      <PlaceCard
                        key={place.id}
                        place={place}
                        onPlaceClick={setSelectedPlace}
                        platform={platform}
                        onPlaceUpdated={refreshPlacesSilent}
                      />
                    ))}
                    {/* Lazy loading sentinel */}
                    {searchFilteredPlaces.length > visibleCount && (
                      <div ref={loadMoreRef} className="col-span-full text-center py-4 mt-2">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)'
                          }}
                        >
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent"
                            style={{ borderColor: `${accentColor.color}44`, borderTopColor: 'transparent' }}
                          />
                          <span className="text-sm">Yuklanmoqda...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Catalog Tab */}
            {activeTab === 'catalog' && (
              <div>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 
                    className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    Kataloglar
                  </h2>
                  <span 
                    className="text-[10px] sm:text-xs md:text-sm"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                  >
                    {categoriesWithCounts.length} ta
                  </span>
                </div>

                {/* Category Groups */}
                <div className="space-y-6 sm:space-y-8">
                  {/* Emergency & Health */}
                  <div>
                    <h3 
                      className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 px-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      🏥 Shoshilinch & Sog'liq
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3 md:gap-4">
                      {categoriesWithCounts
                        .filter(cat => ['pharmacy', 'hospital', 'night'].includes(cat.id))
                        .map((category) => (
                          <CategoryCard
                            key={category.id}
                            category={category}
                            onCategoryClick={handleCategoryClick}
                            platform={platform}
                          />
                        ))
                      }
                    </div>
                  </div>

                  {/* Finance */}
                  <div>
                    <h3 
                      className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 px-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      💰 Moliya
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3 md:gap-4">
                      {categoriesWithCounts
                        .filter(cat => ['bank', 'atm'].includes(cat.id))
                        .map((category) => (
                          <CategoryCard
                            key={category.id}
                            category={category}
                            onCategoryClick={handleCategoryClick}
                            platform={platform}
                          />
                        ))
                      }
                    </div>
                  </div>

                  {/* Food & Dining */}
                  <div>
                    <h3 
                      className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 px-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      🍽️ Ovqatlanish
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3 md:gap-4">
                      {categoriesWithCounts
                        .filter(cat => ['restaurant', 'cafe', 'fastfood', 'bakery'].includes(cat.id))
                        .map((category) => (
                          <CategoryCard
                            key={category.id}
                            category={category}
                            onCategoryClick={handleCategoryClick}
                            platform={platform}
                          />
                        ))
                      }
                    </div>
                  </div>

                  {/* Shopping */}
                  <div>
                    <h3 
                      className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 px-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      🛍️ Xarid
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3 md:gap-4">
                      {categoriesWithCounts
                        .filter(cat => ['supermarket', 'grocery', 'clothing', 'stationery', 'butcher'].includes(cat.id))
                        .map((category) => (
                          <CategoryCard
                            key={category.id}
                            category={category}
                            onCategoryClick={handleCategoryClick}
                            platform={platform}
                          />
                        ))
                      }
                    </div>
                  </div>

                  {/* Services */}
                  <div>
                    <h3 
                      className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 px-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      🔧 Xizmatlar
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3 md:gap-4">
                      {categoriesWithCounts
                        .filter(cat => ['barbershop', 'hotel', 'workshop', 'carservice', 'motoservice', 'bikeservice', 'gasstation'].includes(cat.id))
                        .map((category) => (
                          <CategoryCard
                            key={category.id}
                            category={category}
                            onCategoryClick={handleCategoryClick}
                            platform={platform}
                          />
                        ))
                      }
                    </div>
                  </div>

                  {/* Entertainment */}
                  <div>
                    <h3 
                      className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 px-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      🎭 O'yin-kulgi
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3 md:gap-4">
                      {categoriesWithCounts
                        .filter(cat => ['cinema', 'entertainment', 'gym', 'theater'].includes(cat.id))
                        .map((category) => (
                          <CategoryCard
                            key={category.id}
                            category={category}
                            onCategoryClick={handleCategoryClick}
                            platform={platform}
                          />
                        ))
                      }
                    </div>
                  </div>

                  {/* Education */}
                  <div>
                    <h3 
                      className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 px-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      📚 Ta'lim
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3 md:gap-4">
                      {categoriesWithCounts
                        .filter(cat => ['school', 'university', 'library'].includes(cat.id))
                        .map((category) => (
                          <CategoryCard
                            key={category.id}
                            category={category}
                            onCategoryClick={handleCategoryClick}
                            platform={platform}
                          />
                        ))
                      }
                    </div>
                  </div>

                  {/* Transport & Others */}
                  <div>
                    <h3 
                      className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 px-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      🚇 Transport & Boshqalar
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3 md:gap-4">
                      {categoriesWithCounts
                        .filter(cat => ['metro', 'bus', 'taxi', 'police', 'park', 'parking'].includes(cat.id))
                        .map((category) => (
                          <CategoryCard
                            key={category.id}
                            category={category}
                            onCategoryClick={handleCategoryClick}
                            platform={platform}
                          />
                        ))
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Place Detail Modal */}
      {selectedPlace && (
        <PlaceDetailModal
          place={selectedPlace}
          isOpen={!!selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
      )}

      {/* Add Place Modal */}
      <AddPlaceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        platform={platform}
        onSuccess={() => {
          setSelectedCategoryId(null);
          void fetchPlacesRef.current({ showSkeleton: false });
          setShowAddModal(false);
        }}
      />

      {/* Full Map View */}
      {showFullMap && (
        <FullMapView
          places={places}
          gasStations={[]}
          onClose={() => {
            setShowFullMap(false);
            setActiveTab('around');
          }}
          onPlaceClick={(place) => {
            setShowFullMap(false);
            setActiveTab('around');
            setSelectedPlace(place);
          }}
          onStationClick={() => {}}
          platform={platform}
        />
      )}
    </>
  );
});