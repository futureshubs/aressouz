import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { X, Car, Heart, MapPin, Gauge, Fuel, Calendar, Users, Palette, Settings, Check, Phone, MessageCircle, Share2, Eye, Zap, Grid3x3, Shield, Award, TrendingUp, Clock, Plus, DollarSign, CreditCard, Home, Loader2 } from 'lucide-react';
import { AddListingModal } from '../components/AddListingModal';
import { LoginNotification } from '../components/LoginNotification';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { carCategories } from '../data/cars';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { openExternalUrlSync } from '../utils/openExternalUrl';

interface CarItem {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  color: string;
  location: string;
  region?: string;
  district?: string;
  image: string;
  images: string[];
  description: string;
  seller: string;
  phone: string;
  category: string;
  categoryId?: string;
  condition: string;
  views: number;
  isLiked?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  engineVolume: number;
  bodyType: string;
  driveType: string;
  features: string[];
  paymentTypes?: string[];
}

interface CarProps {
  onClose?: () => void;
}

// Add "all" category to the beginning
const CATEGORIES = [
  { id: 'all', name: 'Hammasi', icon: Grid3x3, count: 0, image: 'https://images.unsplash.com/photo-1762517355525-eca3a813db32?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjYXJzJTIwY29sbGVjdGlvbnxlbnwxfHx8fDE3NzI5MDIxNTd8MA&ixlib=rb-4.1.0&q=80&w=1080' },
  ...carCategories,
];

export default function CarPage({ onClose }: CarProps) {
  const { theme, accentColor } = useTheme();
  const { isAuthenticated, user, session, setIsAuthOpen } = useAuth();
  const { selectedRegion, selectedDistrict } = useLocation();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'cars' | 'categories'>('cars');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cars, setCars] = useState<CarItem[]>([]);
  const [selectedCar, setSelectedCar] = useState<CarItem | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLoginNotification, setShowLoginNotification] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loadingCars, setLoadingCars] = useState(true);
  const visibilityRefetchTick = useVisibilityTick();

  // Banner slides
  const bannerSlides = [
    {
      title: 'Premium Avtomobillar',
      subtitle: 'Eng yaxshi takliflar bizda',
      icon: Car,
      gradient: 'from-red-500 to-pink-500',
    },
    {
      title: 'Yangi Kelmalar',
      subtitle: '2023-2024 yil modellari',
      icon: Award,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'TOP Takliflar',
      subtitle: 'Maxsus chegirmalar bilan',
      icon: TrendingUp,
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Sifatli Xizmat',
      subtitle: 'Professional ko\'rik va maslahat',
      icon: Shield,
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Tez Sotib Olish',
      subtitle: 'Qulay to\'lov imkoniyatlari',
      icon: Zap,
      gradient: 'from-orange-500 to-yellow-500',
    },
  ];

  const loadCars = useCallback(async () => {
    setLoadingCars(true);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/cars`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.cars) {
        console.log('🚗 Cars loaded from backend:', data.cars);
        console.log('🚗 First car paymentTypes:', data.cars[0]?.paymentTypes);
        setCars(data.cars);
      } else {
        setCars([]);
      }
    } catch (error) {
      console.error('Error fetching cars:', error);
      setCars([]);
    } finally {
      setLoadingCars(false);
    }
  }, [visibilityRefetchTick]);

  useEffect(() => {
    void loadCars();
  }, [loadCars]);

  // Auto-rotate banner
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % bannerSlides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [bannerSlides.length]);

  // Filter cars - improved filtering logic
  const filteredCars = cars.filter(c => {
    // Category filter - check both category and categoryId fields
    if (selectedCategory !== 'all') {
      const matchesCategory = c.category === selectedCategory || c.categoryId === selectedCategory;
      if (!matchesCategory) {
        return false;
      }
    }
    
    // Region filter - check both region field and location string
    if (selectedRegion) {
      const matchesRegion = c.region === selectedRegion || 
                           (c.location && c.location.includes(selectedRegion));
      if (!matchesRegion) {
        return false;
      }
    }
    
    // District filter - check both district field and location string
    if (selectedDistrict) {
      const matchesDistrict = c.district === selectedDistrict || 
                             (c.location && c.location.includes(selectedDistrict));
      if (!matchesDistrict) {
        return false;
      }
    }
    
    return true;
  });

  // Calculate dynamic counts for categories
  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') {
      return cars.filter(c => {
        // Apply region and district filters for "all" count
        let matches = true;
        if (selectedRegion) {
          matches = matches && (c.region === selectedRegion || (c.location && c.location.includes(selectedRegion)));
        }
        if (selectedDistrict) {
          matches = matches && (c.district === selectedDistrict || (c.location && c.location.includes(selectedDistrict)));
        }
        return matches;
      }).length;
    }
    return cars.filter(c => {
      // Check category match
      const matchesCategory = c.category === categoryId || c.categoryId === categoryId;
      if (!matchesCategory) return false;
      
      // Apply region and district filters
      if (selectedRegion) {
        const matchesRegion = c.region === selectedRegion || (c.location && c.location.includes(selectedRegion));
        if (!matchesRegion) return false;
      }
      if (selectedDistrict) {
        const matchesDistrict = c.district === selectedDistrict || (c.location && c.location.includes(selectedDistrict));
        if (!matchesDistrict) return false;
      }
      return true;
    }).length;
  };

  const toggleLike = (id: string) => {
    const updated = cars.map(c => 
      c.id === id ? { ...c, isLiked: !c.isLiked } : c
    );
    setCars(updated);
  };

  // Handle add car button click
  const handleAddClick = () => {
    if (!isAuthenticated) {
      setShowLoginNotification(true);
      return;
    }
    setShowAddModal(true);
  };

  // Fetch user data
  useEffect(() => {
    if (isAuthenticated && user?.id && session?.access_token) {
      fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/user/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': session.access_token,
        },
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data && data.user) {
            setUserData(data.user);
          }
        })
        .catch(err => console.error('Error fetching user data:', err));
    }
  }, [isAuthenticated, user?.id, session?.access_token, visibilityRefetchTick]);

  return (
    <div 
      className="min-h-screen w-full"
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 50%, #ffffff 100%)',
      }}
    >
      {/* Header with Banner */}
      <div className="relative overflow-hidden">
        {/* Carousel Banner */}
        <div className="relative h-40 sm:h-48 overflow-hidden rounded-b-3xl sm:rounded-b-[2.5rem]">
          {/* Background Decorations */}
          <div className="absolute inset-0" style={{ background: isDark ? '#0a0a0a' : '#1a1a1a' }}>
            {/* Animated Gradient Circles */}
            <div 
              className="absolute -top-20 -right-20 w-48 h-48 rounded-full opacity-20 blur-3xl transition-all duration-1000"
              style={{
                background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}80)`,
              }}
            />
            <div 
              className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full opacity-20 blur-3xl transition-all duration-1000"
              style={{
                background: `linear-gradient(135deg, ${accentColor.color}80, ${accentColor.color})`,
              }}
            />
          </div>

          {/* Slides */}
          <div className="relative h-full">
            {bannerSlides.map((slide, index) => {
              const Icon = slide.icon;
              const isActive = index === currentBanner;
              
              return (
                <div
                  key={index}
                  className="absolute inset-0 transition-all duration-700 ease-in-out"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'translateX(0)' : index < currentBanner ? 'translateX(-100%)' : 'translateX(100%)',
                  }}
                >
                  <div className="h-full flex flex-col items-center justify-center px-4 text-center">
                    {/* Icon with Gradient Background */}
                    <div 
                      className={`inline-flex p-3 sm:p-4 rounded-2xl mb-2 sm:mb-3 bg-gradient-to-br ${slide.gradient} shadow-2xl`}
                      style={{
                        boxShadow: `0 12px 40px ${accentColor.color}40`,
                      }}
                    >
                      <Icon className="size-8 sm:size-10 text-white" strokeWidth={2.5} />
                    </div>

                    {/* Title */}
                    <h1 className="text-lg sm:text-2xl lg:text-3xl font-black mb-1 sm:mb-2 text-white">
                      {slide.title}
                    </h1>

                    {/* Subtitle */}
                    <p className="text-xs sm:text-sm font-semibold text-white/70 max-w-md">
                      {slide.subtitle}
                    </p>

                    {/* Decorative Line */}
                    <div 
                      className="mt-2 sm:mt-3 h-0.5 w-16 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${accentColor.color}, transparent)`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Dots */}
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {bannerSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentBanner(index)}
                className="transition-all duration-300"
                style={{
                  width: currentBanner === index ? '24px' : '6px',
                  height: '6px',
                  borderRadius: '999px',
                  background: currentBanner === index 
                    ? accentColor.color
                    : 'rgba(255, 255, 255, 0.3)',
                  boxShadow: currentBanner === index ? `0 0 10px ${accentColor.color}` : 'none',
                }}
              />
            ))}
          </div>

          {/* Manual Navigation Arrows */}
          <button
            onClick={() => setCurrentBanner((prev) => prev === 0 ? bannerSlides.length - 1 : prev - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full backdrop-blur-xl transition-all duration-300 hover:scale-110 active:scale-90 opacity-0 sm:opacity-100"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <span className="text-white text-xl font-bold">‹</span>
          </button>
          <button
            onClick={() => setCurrentBanner((prev) => (prev + 1) % bannerSlides.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full backdrop-blur-xl transition-all duration-300 hover:scale-110 active:scale-90 opacity-0 sm:opacity-100"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <span className="text-white text-xl font-bold">›</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3"
          style={{
            background: isDark 
              ? `linear-gradient(135deg, ${accentColor.color}15, ${accentColor.color}05)`
              : `linear-gradient(135deg, ${accentColor.color}10, ${accentColor.color}05)`,
          }}
        >
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('cars')}
              className="flex-1 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300"
              style={{
                background: activeTab === 'cars' 
                  ? `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`
                  : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                color: activeTab === 'cars' ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'),
                boxShadow: activeTab === 'cars' ? `0 4px 16px ${accentColor.color}40` : 'none',
              }}
            >
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                <Car className="size-3.5 sm:size-4" />
                <span className="hidden xs:inline">Avtomobillar</span>
                <span className="xs:hidden">Avto</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className="flex-1 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300"
              style={{
                background: activeTab === 'categories' 
                  ? `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`
                  : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                color: activeTab === 'categories' ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'),
                boxShadow: activeTab === 'categories' ? `0 4px 16px ${accentColor.color}40` : 'none',
              }}
            >
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                <Grid3x3 className="size-3.5 sm:size-4" />
                <span className="hidden xs:inline">Kategoriyalar</span>
                <span className="xs:hidden">Turkum</span>
              </div>
            </button>

            <button
              onClick={handleAddClick}
              className="py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
              style={{
                background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                color: '#ffffff',
                boxShadow: `0 4px 16px ${accentColor.color}40`,
              }}
            >
              <Plus className="size-3.5 sm:size-4" />
              <span className="hidden sm:inline">E'lon qo'shish</span>
              <span className="sm:hidden">Qo'shish</span>
            </button>
          </div>
        </div>

        {/* Region and District Filters - REMOVED: Using header location selector instead */}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Back Button - when category is selected */}
        {activeTab === 'cars' && selectedCategory !== 'all' && (
          <button
            onClick={() => {
              setSelectedCategory('all');
              setActiveTab('categories');
            }}
            className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.1)',
              color: isDark ? '#ffffff' : '#000000',
            }}
          >
            <span className="text-lg">←</span>
            Kategoriyalarga qaytish
          </button>
        )}

        {/* Category Title - when filtered */}
        {activeTab === 'cars' && selectedCategory !== 'all' && (
          <div className="mb-6">
            <h2 
              className="text-2xl sm:text-3xl font-black mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              {CATEGORIES.find(c => c.id === selectedCategory)?.name}
            </h2>
            <p 
              className="text-sm font-semibold"
              style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
            >
              {filteredCars.length} ta avtomobil topildi
            </p>
          </div>
        )}

        {/* Cars View */}
        {activeTab === 'cars' && (
          <>
            {loadingCars ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 sm:py-32">
                <Loader2 className="h-10 w-10 shrink-0 animate-spin" style={{ color: accentColor.color }} aria-label="Yuklanmoqda" />
                <p className="text-sm font-semibold opacity-60" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  Avtomobillar yuklanmoqda…
                </p>
              </div>
            ) : filteredCars.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-16 sm:py-24">
                <div 
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center mb-6"
                  style={{
                    background: `${accentColor.color}15`,
                  }}
                >
                  <Car 
                    className="w-12 h-12 sm:w-16 sm:h-16" 
                    style={{ color: accentColor.color }}
                    strokeWidth={1.5}
                  />
                </div>
                <h3 
                  className="text-xl sm:text-2xl font-black mb-3"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  Hozircha e'lon yo'q
                </h3>
                <p 
                  className="text-sm sm:text-base mb-6 text-center max-w-md"
                  style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
                >
                  Birinchi bo'lib o'z avtomobilingizni sotuvga qo'ying
                </p>
                <button
                  onClick={handleAddClick}
                  className="px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                    color: '#ffffff',
                    boxShadow: `0 4px 16px ${accentColor.color}40`,
                  }}
                >
                  E'lon joylashtirish
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                {filteredCars.map((car) => (
              <div
                key={car.id}
                className="group cursor-pointer"
                onClick={() => {
                  console.log('🚗 Selected car:', car);
                  console.log('🚗 Payment types:', car.paymentTypes);
                  setSelectedCar(car);
                  setCurrentImageIndex(0);
                }}
              >
                <div 
                  className="rounded-3xl overflow-hidden transition-all duration-500 hover:scale-[1.02]"
                  style={{
                    background: isDark 
                      ? '#1a1a1a'
                      : '#ffffff',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
                    boxShadow: isDark
                      ? '0 8px 32px rgba(0, 0, 0, 0.8)'
                      : '0 8px 32px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {/* Image */}
                  <div className="relative aspect-video overflow-hidden">
                    <img 
                      src={car.image} 
                      alt={`${car.brand} ${car.model}`}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    
                    {/* Gradient Overlay */}
                    <div 
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: `linear-gradient(to top, ${accentColor.color}40, transparent)`,
                      }}
                    />
                    
                    {/* Badges */}
                    <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 flex flex-col gap-1">
                      {car.isFeatured && (
                        <div 
                          className="px-1.5 py-0.5 rounded-full backdrop-blur-xl flex items-center gap-0.5"
                          style={{
                            background: accentColor.color,
                            boxShadow: `0 2px 8px ${accentColor.color}80`,
                          }}
                        >
                          <Award className="size-2 sm:size-2.5 text-white" />
                          <span className="text-[8px] sm:text-[9px] font-black text-white">TOP</span>
                        </div>
                      )}
                      {car.isNew && (
                        <div 
                          className="px-1.5 py-0.5 rounded-full backdrop-blur-xl"
                          style={{
                            background: isDark ? '#ffffff' : '#000000',
                            boxShadow: isDark ? '0 2px 8px rgba(255,255,255,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
                          }}
                        >
                          <span className="text-[8px] sm:text-[9px] font-black" style={{ color: isDark ? '#000000' : '#ffffff' }}>
                            YANGI
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Like button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(car.id);
                      }}
                      className="absolute top-2 sm:top-3 right-2 sm:right-3 p-1.5 sm:p-2 rounded-full backdrop-blur-2xl transition-all duration-300 active:scale-90"
                      style={{
                        background: car.isLiked ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'),
                        border: car.isLiked ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: car.isLiked ? `0 4px 12px ${accentColor.color}60` : 'none',
                      }}
                    >
                      <Heart 
                        className="size-3.5 sm:size-4"
                        fill={car.isLiked ? '#ffffff' : 'none'}
                        style={{ color: '#ffffff' }}
                        strokeWidth={2.5}
                      />
                    </button>

                    {/* Views */}
                    <div 
                      className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 px-2 sm:px-2.5 py-1 rounded-full backdrop-blur-2xl flex items-center gap-1"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <Eye className="size-2.5 sm:size-3 text-white" />
                      <span className="text-[10px] sm:text-xs font-bold text-white">{(car.views || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2.5 sm:p-3 md:p-4 lg:p-5">
                    {/* Title */}
                    <h3 
                      className="text-xs sm:text-sm md:text-base lg:text-lg font-black mb-1.5 sm:mb-2 lg:mb-2.5 line-clamp-1"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}
                    >
                      {car.brand} {car.model}
                    </h3>

                    {/* Stats - Minimalist */}
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 mb-2 sm:mb-3 flex-wrap">
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <Calendar className="size-2.5 sm:size-3 md:size-3.5" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }} />
                        <span 
                          className="text-[9px] sm:text-[10px] md:text-xs font-bold whitespace-nowrap"
                          style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}
                        >
                          {car.year}
                        </span>
                      </div>
                      <div 
                        className="w-px h-2.5 sm:h-3 md:h-4"
                        style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                      />
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <Gauge className="size-2.5 sm:size-3 md:size-3.5" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }} />
                        <span 
                          className="text-[9px] sm:text-[10px] md:text-xs font-bold whitespace-nowrap"
                          style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}
                        >
                          {typeof car.mileage === 'number' ? car.mileage.toLocaleString() : car.mileage || '0'} km
                        </span>
                      </div>
                      <div 
                        className="w-px h-2.5 sm:h-3 md:h-4"
                        style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                      />
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <Fuel className="size-2.5 sm:size-3 md:size-3.5" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }} />
                        <span 
                          className="text-[9px] sm:text-[10px] md:text-xs font-bold whitespace-nowrap"
                          style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}
                        >
                          {car.fuelType}
                        </span>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-1 sm:gap-1.5 mb-2 sm:mb-3">
                      <MapPin className="size-2.5 sm:size-3 md:size-3.5 flex-shrink-0" style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }} />
                      <span 
                        className="text-[9px] sm:text-[10px] md:text-xs font-medium truncate"
                        style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
                      >
                        {car.location}
                      </span>
                    </div>

                    {/* Divider */}
                    <div 
                      className="h-px mb-2 sm:mb-3"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
                    />

                    {/* Price - Bold & Clean */}
                    <div className="flex items-baseline gap-0.5 sm:gap-1 mb-2 sm:mb-3">
                      <span 
                        className="text-[10px] sm:text-xs md:text-sm font-medium"
                        style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
                      >
                        $
                      </span>
                      <span 
                        className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-normal tracking-tight"
                        style={{ color: isDark ? '#ffffff' : '#000000' }}
                      >
                        {(car.price || 0).toLocaleString('en-US')}
                      </span>
                    </div>

                    {/* View button - Clean */}
                    <button
                      className="w-full py-2 sm:py-2.5 md:py-3 lg:py-3.5 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs md:text-sm transition-all duration-300 hover:scale-[1.02] active:scale-95"
                      style={{
                        background: accentColor.color,
                        boxShadow: `0 6px 20px ${accentColor.color}50`,
                        color: '#ffffff',
                      }}
                    >
                      Batafsil ko'rish
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
            )}
          </>
        )}

        {/* Categories View */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {CATEGORIES.map((category) => {
              const isActive = selectedCategory === category.id;
              const dynamicCount = getCategoryCount(category.id);
              
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setActiveTab('cars');
                  }}
                  className="group relative overflow-hidden rounded-3xl transition-all duration-500 hover:scale-[1.02] active:scale-95"
                  style={{
                    background: isDark ? '#1a1a1a' : '#ffffff',
                    border: isActive 
                      ? `2px solid ${accentColor.color}`
                      : isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
                    boxShadow: isActive 
                      ? `0 12px 40px ${accentColor.color}60`
                      : isDark ? '0 8px 32px rgba(0, 0, 0, 0.8)' : '0 8px 32px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {/* Image */}
                  <div className="relative h-36 sm:h-44 overflow-hidden">
                    <img 
                      src={category.image} 
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    
                    {/* Gradient Overlay */}
                    <div 
                      className="absolute inset-0"
                      style={{
                        background: isActive
                          ? `linear-gradient(to bottom, transparent 0%, ${accentColor.color}dd 100%)`
                          : isDark 
                            ? 'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.85) 100%)'
                            : 'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.7) 100%)',
                      }}
                    />
                    
                    {/* Active Glow */}
                    {isActive && (
                      <div 
                        className="absolute inset-0 opacity-30"
                        style={{
                          background: `radial-gradient(circle at center, ${accentColor.color}, transparent 70%)`,
                        }}
                      />
                    )}

                    {/* Bottom Text */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 
                        className="text-base sm:text-lg font-black mb-1"
                        style={{ 
                          color: isActive ? '#ffffff' : '#ffffff',
                          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        }}
                      >
                        {category.name}
                      </h3>
                      <p 
                        className="text-xs sm:text-sm font-bold"
                        style={{ 
                          color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)',
                          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        }}
                      >
                        {dynamicCount} ta avtomobil
                      </p>
                    </div>

                    {/* Check icon for active */}
                    {isActive && (
                      <div 
                        className="absolute top-3 right-3 p-2 rounded-full"
                        style={{
                          background: '#ffffff',
                          boxShadow: `0 4px 16px ${accentColor.color}80`,
                        }}
                      >
                        <Check className="size-4" style={{ color: accentColor.color }} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedCar && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(12px)',
          }}
          onClick={() => setSelectedCar(null)}
        >
          <div 
            className="relative w-full sm:max-w-4xl max-h-[95vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, #1a1a1a, #0f0f0f)'
                : 'linear-gradient(145deg, #ffffff, #f5f5f5)',
              boxShadow: isDark
                ? '0 20px 60px rgba(0, 0, 0, 0.9)'
                : '0 20px 60px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedCar(null)}
              className="absolute top-4 right-4 z-10 p-2.5 rounded-full backdrop-blur-xl transition-all duration-300 active:scale-90"
              style={{
                background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)',
              }}
            >
              <X className="size-5" style={{ color: isDark ? '#ffffff' : '#000000' }} />
            </button>
            
            {/* Image Gallery */}
            <div className="relative aspect-video overflow-hidden">
              <img 
                src={selectedCar.images[currentImageIndex]} 
                alt={`${selectedCar.brand} ${selectedCar.model}`}
                className="w-full h-full object-cover"
              />
              
              {/* Image navigation */}
              {selectedCar.images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => prev === 0 ? selectedCar.images.length - 1 : prev - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full backdrop-blur-xl transition-all duration-300 active:scale-90"
                    style={{
                      background: 'rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    <span className="text-white text-xl font-bold">‹</span>
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => prev === selectedCar.images.length - 1 ? 0 : prev + 1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full backdrop-blur-xl transition-all duration-300 active:scale-90"
                    style={{
                      background: 'rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    <span className="text-white text-xl font-bold">›</span>
                  </button>
                  
                  {/* Image indicators */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {selectedCar.images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className="w-2 h-2 rounded-full transition-all duration-300"
                        style={{
                          background: index === currentImageIndex ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Title & Price */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 
                    className="text-2xl sm:text-3xl font-black mb-2"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}
                  >
                    {selectedCar.brand} {selectedCar.model}
                  </h2>
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="px-3 py-1 rounded-lg"
                      style={{
                        background: `${accentColor.color}20`,
                        border: `1px solid ${accentColor.color}40`,
                      }}
                    >
                      <span 
                        className="text-sm font-bold"
                        style={{ color: accentColor.color }}
                      >
                        {selectedCar.condition}
                      </span>
                    </div>
                    {selectedCar.isFeatured && (
                      <div 
                        className="px-3 py-1 rounded-lg flex items-center gap-1"
                        style={{
                          background: `${accentColor.color}20`,
                          border: `1px solid ${accentColor.color}40`,
                        }}
                      >
                        <Award className="size-3" style={{ color: accentColor.color }} />
                        <span 
                          className="text-sm font-bold"
                          style={{ color: accentColor.color }}
                        >
                          TOP
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-1 justify-end mb-1">
                    <span 
                      className="text-base sm:text-lg font-bold"
                      style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}
                    >
                      $
                    </span>
                    <span 
                      className="text-3xl font-black"
                      style={{ color: accentColor.color }}
                    >
                      {(selectedCar.price || 0).toLocaleString('en-US')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div 
                  className="p-4 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <Calendar className="size-5 mb-2" style={{ color: accentColor.color }} />
                  <div className="text-xs mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Yil
                  </div>
                  <div className="text-lg font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    {selectedCar.year}
                  </div>
                </div>

                <div 
                  className="p-4 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <Gauge className="size-5 mb-2" style={{ color: accentColor.color }} />
                  <div className="text-xs mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Yurgan
                  </div>
                  <div className="text-lg font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    {typeof selectedCar.mileage === 'number' ? selectedCar.mileage.toLocaleString() : selectedCar.mileage || '0'} km
                  </div>
                </div>

                <div 
                  className="p-4 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <Fuel className="size-5 mb-2" style={{ color: accentColor.color }} />
                  <div className="text-xs mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Yoqilg'i
                  </div>
                  <div className="text-lg font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    {selectedCar.fuelType}
                  </div>
                </div>

                <div 
                  className="p-4 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <Settings className="size-5 mb-2" style={{ color: accentColor.color }} />
                  <div className="text-xs mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    Uzatma
                  </div>
                  <div className="text-lg font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    {selectedCar.transmission}
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div 
                  className="p-3 rounded-xl flex items-center gap-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <Palette className="size-4" style={{ color: accentColor.color }} />
                  <div>
                    <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      Rang
                    </div>
                    <div className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {selectedCar.color}
                    </div>
                  </div>
                </div>

                <div 
                  className="p-3 rounded-xl flex items-center gap-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <Zap className="size-4" style={{ color: accentColor.color }} />
                  <div>
                    <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      Dvigatel
                    </div>
                    <div className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {selectedCar.engineVolume} L
                    </div>
                  </div>
                </div>

                <div 
                  className="p-3 rounded-xl flex items-center gap-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <Car className="size-4" style={{ color: accentColor.color }} />
                  <div>
                    <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      Kuzov
                    </div>
                    <div className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {selectedCar.bodyType}
                    </div>
                  </div>
                </div>

                <div 
                  className="p-3 rounded-xl flex items-center gap-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <TrendingUp className="size-4" style={{ color: accentColor.color }} />
                  <div>
                    <div className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      Privod
                    </div>
                    <div className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {selectedCar.driveType}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 
                  className="text-lg font-bold mb-3"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  Ta'rif
                </h3>
                <p 
                  className="text-sm leading-relaxed"
                  style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}
                >
                  {selectedCar.description}
                </p>
              </div>

              {/* Features */}
              <div className="mb-6">
                <h3 
                  className="text-lg font-bold mb-3"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  Qo'shimcha jihozlar
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {selectedCar.features.map((feature, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-2 p-2.5 rounded-lg"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      <Check className="size-4 flex-shrink-0" style={{ color: accentColor.color }} />
                      <span 
                        className="text-sm font-semibold"
                        style={{ color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }}
                      >
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Types */}
              <div className="mb-6">
                <h3 
                  className="text-lg font-bold mb-3"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  To'lov turlari
                </h3>
                
                {/* Debug info */}
                {(!selectedCar.paymentTypes || selectedCar.paymentTypes.length === 0) && (
                  <div 
                    className="px-4 py-3 rounded-xl mb-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                    }}
                  >
                    <span 
                      className="text-xs font-semibold"
                      style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
                    >
                      🔍 Debug: paymentTypes = {JSON.stringify(selectedCar.paymentTypes || null)}
                    </span>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {selectedCar.paymentTypes?.includes('cash') && (
                    <div 
                      className="px-4 py-2.5 rounded-xl flex items-center gap-2"
                      style={{
                        background: `${accentColor.color}15`,
                        border: `2px solid ${accentColor.color}`,
                      }}
                    >
                      <DollarSign className="size-5" style={{ color: accentColor.color }} />
                      <span 
                        className="text-sm font-bold"
                        style={{ color: isDark ? '#ffffff' : '#000000' }}
                      >
                        Naqd
                      </span>
                    </div>
                  )}
                  {selectedCar.paymentTypes?.includes('credit') && (
                    <div 
                      className="px-4 py-2.5 rounded-xl flex items-center gap-2"
                      style={{
                        background: `${accentColor.color}15`,
                        border: `2px solid ${accentColor.color}`,
                      }}
                    >
                      <CreditCard className="size-5" style={{ color: accentColor.color }} />
                      <span 
                        className="text-sm font-bold"
                        style={{ color: isDark ? '#ffffff' : '#000000' }}
                      >
                        Kredit
                      </span>
                    </div>
                  )}
                  {selectedCar.paymentTypes?.includes('mortgage') && (
                    <div 
                      className="px-4 py-2.5 rounded-xl flex items-center gap-2"
                      style={{
                        background: `${accentColor.color}15`,
                        border: `2px solid ${accentColor.color}`,
                      }}
                    >
                      <Home className="size-5" style={{ color: accentColor.color }} />
                      <span 
                        className="text-sm font-bold"
                        style={{ color: isDark ? '#ffffff' : '#000000' }}
                      >
                        Ipoteka
                      </span>
                    </div>
                  )}
                  
                  {(!selectedCar.paymentTypes || selectedCar.paymentTypes.length === 0) && (
                    <div 
                      className="px-4 py-2.5 rounded-xl"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      }}
                    >
                      <span 
                        className="text-sm font-semibold"
                        style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
                      >
                        Ma'lumot kiritilmagan
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Seller Info */}
              <div 
                className="p-4 rounded-2xl mb-6"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      Sotuvchi
                    </div>
                    <div className="text-base font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                      {selectedCar.seller}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4" style={{ color: accentColor.color }} />
                    <span className="text-sm font-semibold" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                      {selectedCar.location}
                    </span>
                  </div>
                </div>
                <div className="text-sm font-semibold" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                  {selectedCar.phone}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => window.location.href = `tel:${selectedCar.phone}`}
                  className="py-3.5 rounded-xl font-bold text-sm transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: accentColor.color,
                    boxShadow: `0 4px 16px ${accentColor.color}40`,
                    color: '#ffffff',
                  }}
                >
                  <Phone className="size-5" />
                  Qo'ng'iroq qilish
                </button>

                <button
                  onClick={() =>
                    openExternalUrlSync(
                      `https://t.me/share/url?url=${encodeURIComponent(`${window.location.origin}/car`)}&text=${encodeURIComponent(`Avtomobil: ${selectedCar.brand} ${selectedCar.model}`)}`,
                    )
                  }
                  className="py-3.5 rounded-xl font-bold text-sm transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#000000',
                  }}
                >
                  <Share2 className="size-5" />
                  Ulashish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Listing Modal */}
      {showAddModal && (
        <AddListingModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          userId={user?.id || ''}
          userName={userData?.fullName || userData?.firstName || user?.firstName || 'Foydalanuvchi'}
          userPhone={userData?.phone || user?.phone || ''}
          accessToken={session?.access_token || ''}
          defaultType="car"
          onSuccess={async () => {
            setShowAddModal(false);
            await loadCars();
          }}
        />
      )}

      {/* Login Notification */}
      {showLoginNotification && (
        <LoginNotification
          onClose={() => setShowLoginNotification(false)}
          onLogin={() => setIsAuthOpen(true)}
        />
      )}
    </div>
  );
}