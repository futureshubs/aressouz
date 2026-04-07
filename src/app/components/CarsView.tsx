import { useState, memo, useEffect, useCallback, useMemo } from 'react';
import { Car as CarIcon, Grid3x3, Plus } from 'lucide-react';
import { CarCategoryCard } from './CarCategoryCard';
import { CarItemCard } from './CarItemCard';
import { CarItemDetailModal } from './CarItemDetailModal';
import { AddListingModal } from './AddListingModal';
import { LoginNotification } from './LoginNotification';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { BannerCarousel } from './BannerCarousel';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { CarGridSkeleton } from './skeletons';
import { useHeaderSearchOptional } from '../context/HeaderSearchContext';
import { matchesHeaderSearch, normalizeHeaderSearch } from '../utils/headerSearchMatch';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

// Updated interfaces to match database schema
interface Car {
  id: string;
  name: string;
  category_id: string;
  image: string;
  images: string[];
  year: number;
  brand: string;
  model: string;
  fuel_type: string;
  transmission: string;
  seats: number;
  color: string;
  mileage: string;
  features: string[];
  rating: number;
  reviews: number;
  location: string;
  owner: string;
  available: boolean;
  price: number;
  currency: 'USD' | 'UZS';
  old_price?: number;
  description: string;
  condition: string;
  owner_phone?: string;
  user_id?: string;
  credit_available?: boolean;
  mortgage_available?: boolean;
  credit_term?: number;
  credit_interest_rate?: number;
  initial_payment?: number;
  has_halal_installment?: boolean;
  halal_installment_months?: number;
  halal_installment_bank?: string;
  halal_down_payment?: number;
  region_id?: string;
  district_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface CarCategory {
  id: string;
  name: string;
  description?: string;
  image: string;
  icon: string;
  count: number;
  created_at?: string;
}

interface Region {
  id: string;
  name: string;
  districts: District[];
}

interface District {
  id: string;
  name: string;
}

interface CarsViewProps {
  platform: Platform;
  onAddToCart: (car: Car) => void;
}

export const CarsView = memo(function CarsView({ platform, onAddToCart }: CarsViewProps) {
  const { theme, accentColor } = useTheme();
  const { selectedRegion, selectedDistrict } = useLocation();
  const { query: headerSearch } = useHeaderSearchOptional();
  const { isAuthenticated, user, session, setIsAuthOpen } = useAuth();
  const [activeTab, setActiveTab] = useState<'cars' | 'categories'>('cars');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [carCategories, setCarCategories] = useState<CarCategory[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [showLoginNotification, setShowLoginNotification] = useState(false);
  const [visibilityTick, setVisibilityTick] = useState(0);
  const isDark = theme === 'dark';
  const isIOS = platform === 'ios';

  // Convert region ID to name for banners
  const selectedRegionData = regions.find(r => r.id === selectedRegion);
  const selectedRegionName = selectedRegionData?.name || '';
  const selectedDistrictData = selectedRegionData?.districts.find(d => d.id === selectedDistrict);
  const selectedDistrictName = selectedDistrictData?.name || '';

  // Car advertisements data (keeping existing)
  const carAds = [
    {
      title: 'Tesla Model 3 2024',
      subtitle: 'Elektr avtomobili - 50% chegirma!',
      image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=1200&q=80',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      title: 'BMW X5 Sport Edition',
      subtitle: 'Premium krossover - maxsus taklif',
      image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200&q=80',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      title: 'Mercedes-Benz C-Class',
      subtitle: 'Yangi avlod - hozir sotuvda',
      image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200&q=80',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
    {
      title: 'Audi A6 Premium',
      subtitle: 'Luxury sedan - eng yaxshi narxda',
      image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200&q=80',
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    },
    {
      title: 'Range Rover Evoque',
      subtitle: 'Sport SUV - chegirmalar bilan',
      image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1200&q=80',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    },
    {
      title: 'Porsche 911 Turbo',
      subtitle: 'Sport avtomobil - premium sifat',
      image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80',
      gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    },
  ];

  // Auto-rotate slides every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carAds.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [carAds.length]);

  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  // Fetch regions from API (using existing API service)
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/regions`, {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setRegions(data.regions || []);
        }
      } catch (error) {
        console.error('Error fetching regions:', error);
      }
    };

    fetchRegions();
  }, [visibilityTick]);

  // Fetch car categories from API
  useEffect(() => {
    const fetchCarCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/car-categories`, {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setCarCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Error fetching car categories:', error);
      }
    };

    fetchCarCategories();
  }, [visibilityTick]);

  // Fetch cars from API
  useEffect(() => {
    const fetchCars = async () => {
      try {
        setLoading(true);
        let url = `${API_BASE_URL}/cars?available=true`;
        
        // Add filters to URL
        const params = new URLSearchParams();
        if (selectedCategory) params.append('category_id', selectedCategory);
        if (selectedRegion) params.append('region_id', selectedRegion);
        if (selectedDistrict) params.append('district_id', selectedDistrict);
        
        if (params.toString()) {
          url += `&${params.toString()}`;
        }

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setCars(data.cars || []);
        }
      } catch (error) {
        console.error('Error fetching cars:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCars();
  }, [selectedCategory, selectedRegion, selectedDistrict, visibilityTick]);

  // Filter cars for display
  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      if (selectedCategory && car.category_id !== selectedCategory) return false;
      if (selectedRegion && car.region_id !== selectedRegion) return false;
      if (selectedDistrict && car.district_id !== selectedDistrict) return false;
      if (normalizeHeaderSearch(headerSearch)) {
        const ok = matchesHeaderSearch(headerSearch, [
          car.name,
          car.brand,
          car.model,
          car.description,
          car.location,
          car.owner,
          car.fuel_type,
          car.transmission,
          car.color,
          String(car.year),
          ...(car.features ?? []),
        ]);
        if (!ok) return false;
      }
      return true;
    });
  }, [cars, selectedCategory, selectedRegion, selectedDistrict, headerSearch]);

  // Add "all" category to beginning
  const categoriesWithAll = useMemo(() => [
    { id: 'all', name: 'Hammasi', icon: Grid3x3, count: 0, image: 'https://images.unsplash.com/photo-1762517355525-eca3a813db32?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjYXJzJTIwY29sbGVjdGlvbnxlbnwxfHx8fDE3NzI5MDIxNTd8MA&ixlib=rb-4.1.0&q=80&w=1080' },
    ...carCategories.map(cat => ({
      ...cat,
      icon: () => <span>{cat.icon}</span>
    }))
  ], [carCategories]);

  const handleAddListing = () => {
    if (!isAuthenticated) {
      setShowLoginNotification(true);
      return;
    }
    setShowAddModal(true);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId === 'all' ? null : categoryId);
    setActiveTab('cars');
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setActiveTab('categories');
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: isDark ? '#000000' : '#f9fafb' }}>
      {/* Banner Carousel */}
      {selectedRegionName && selectedDistrictName && !selectedCategory && activeTab === 'cars' && (
        <div className="px-4 sm:px-6 md:px-8 mt-4">
          <BannerCarousel 
            slides={carAds}
            currentSlide={currentSlide}
            onSlideChange={setCurrentSlide}
            autoPlay={true}
            interval={3000}
          />
        </div>
      )}

      {/* Header */}
      <div className="px-4 sm:px-6 md:px-8 mt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
              {selectedCategory 
                ? categoriesWithAll.find(c => c.id === selectedCategory)?.name || 'Avtomobillar'
                : 'Avtomobillar'
              }
            </h1>
            <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              {selectedRegionName && selectedDistrictName 
                ? `${selectedDistrictName}, ${selectedRegionName}`
                : 'Barcha viloyatlar'
              }
            </p>
          </div>
          <button
            onClick={handleAddListing}
            className="p-3 rounded-2xl transition-all active:scale-90"
            style={{
              background: accentColor.gradient,
              boxShadow: '0 4px 16px rgba(20, 184, 166, 0.3)',
            }}
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('cars')}
            className={`flex-1 py-2 px-4 rounded-xl transition-all ${
              activeTab === 'cars'
                ? 'bg-white dark:bg-gray-700 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            style={{
              color: activeTab === 'cars' ? accentColor.color : undefined
            }}
          >
            Avtomobillar ({filteredCars.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-2 px-4 rounded-xl transition-all ${
              activeTab === 'categories'
                ? 'bg-white dark:bg-gray-700 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            style={{
              color: activeTab === 'categories' ? accentColor.color : undefined
            }}
          >
            Kategoriyalar ({carCategories.length})
          </button>
        </div>
      </div>

      {/* Categories View */}
      {activeTab === 'categories' && (
        <div className="px-4 sm:px-6 md:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categoriesWithAll.map((category) => (
              <CarCategoryCard
                key={category.id}
                category={category}
                onSelect={() => handleCategorySelect(category.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cars View */}
      {activeTab === 'cars' && (
        <div className="px-4 sm:px-6 md:px-8">
          {loading ? (
            <CarGridSkeleton isDark={isDark} count={6} />
          ) : filteredCars.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCars.map((car) => (
                <CarItemCard
                  key={car.id}
                  car={car}
                  onSelect={setSelectedCar}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CarIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                Avtomobillar topilmadi
              </h3>
              <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                {selectedCategory || selectedRegion || selectedDistrict
                  ? 'Tanlangan filterlar bo\'yicha avtomobillar yo\'q'
                  : 'Hozircha avtomobillar mavjud emas'
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Back button when category is selected */}
      {selectedCategory && activeTab === 'cars' && (
        <button
          onClick={handleBackToCategories}
          className="fixed bottom-24 right-4 p-3 rounded-2xl transition-all active:scale-90 z-40"
          style={{
            background: accentColor.gradient,
            boxShadow: '0 4px 16px rgba(20, 184, 166, 0.3)',
          }}
        >
          <Grid3x3 className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Modals */}
      {selectedCar && (
        <CarItemDetailModal
          car={selectedCar}
          onClose={() => setSelectedCar(null)}
          onAddToCart={onAddToCart}
        />
      )}

      {showAddModal && (
        <AddListingModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            // Refresh cars list
            window.location.reload();
          }}
        />
      )}

      {showLoginNotification && (
        <LoginNotification
          onClose={() => setShowLoginNotification(false)}
          onLogin={() => {
            setShowLoginNotification(false);
            setIsAuthOpen(true);
          }}
        />
      )}
    </div>
  );
});
