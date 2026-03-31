import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { Platform } from '../utils/platform';
import { serviceCatalogs, serviceCategories, services, serviceBanners, Service } from '../data/services';
import { ServiceCategoryCard } from './ServiceCategoryCard';
import { ServiceCard } from './ServiceCard';
import { ServiceDetailModal } from './ServiceDetailModal';
import { CreatePortfolioModal } from './CreatePortfolioModal';
import { PortfolioCard } from './PortfolioCard';
import { ServicePortfolioCard } from './ServicePortfolioCard';
import { PortfolioDetailModal } from './PortfolioDetailModal';
import { LayoutGrid, Users, ArrowLeft, Briefcase, Plus } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { BannerCarousel } from './BannerCarousel';
import { regions as allRegions } from '../data/regions';
import { matchesSelectedLocation } from '../utils/locationMatching';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

// Professions with images
const professions = [
  { 
    id: 'santexnik', 
    name: 'Santexnik', 
    icon: '🔧',
    image: 'https://images.unsplash.com/photo-1759757707824-4e5f54b7a43c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbHVtYmVyJTIwcmVwYWlyJTIwcGlwZSUyMHdyZW5jaHxlbnwxfHx8fDE3NzMwODkzNDl8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'elektrik', 
    name: 'Elektrik', 
    icon: '⚡',
    image: 'https://images.unsplash.com/photo-1767961124255-0211254231a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJpY2lhbiUyMHdvcmtpbmclMjB3aXJlcyUyMGNhYmxlc3xlbnwxfHx8fDE3NzMwODkzNDl8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'usta', 
    name: "Usta (ta'mirlash)", 
    icon: '🔨',
    image: 'https://images.unsplash.com/photo-1645651964715-d200ce0939cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYW5keW1hbiUyMGNvbnN0cnVjdGlvbiUyMHRvb2xzJTIwcmVwYWlyfGVufDF8fHx8MTc3MzA4OTM0OXww&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'bogbon', 
    name: "Bog'bon", 
    icon: '🌱',
    image: 'https://images.unsplash.com/photo-1630937109872-e64a41a4ecc9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYXJkZW5lciUyMHBsYW50cyUyMGdhcmRlbiUyMGZsb3dlcnN8ZW58MXx8fHwxNzczMDg5MzQ5fDA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'tozalovchi', 
    name: 'Tozalovchi', 
    icon: '🧹',
    image: 'https://images.unsplash.com/photo-1581578949510-fa7315c4c350?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob3VzZSUyMGNsZWFuaW5nJTIwc2VydmljZSUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NzI5OTU5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'boyoqchi', 
    name: "Bo'yoqchi", 
    icon: '🎨',
    image: 'https://images.unsplash.com/photo-1745092707630-c00ef0a006c4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYWludGVyJTIwcGFpbnRpbmclMjB3YWxsJTIwYnJ1c2h8ZW58MXx8fHwxNzczMDg5MzUwfDA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'duradgor', 
    name: 'Duradgor', 
    icon: '🪚',
    image: 'https://images.unsplash.com/photo-1769430838012-8e1270d41f46?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXJwZW50ZXIlMjB3b29kJTIwZnVybml0dXJlJTIwY3JhZnRpbmd8ZW58MXx8fHwxNzczMDg5MzUxfDA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'temirchi', 
    name: 'Temirchi', 
    icon: '⚒️',
    image: 'https://images.unsplash.com/photo-1582649831749-e2d634f55cf3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWxkZXIlMjBtZXRhbHdvcmslMjBzcGFya3MlMjB3ZWxkaW5nfGVufDF8fHx8MTc3MzA4OTM1MXww&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'haydovchi', 
    name: 'Haydovchi', 
    icon: '🚗',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/Gemini_Generated_Image_6q15fn6q15fn6q15.png'
  },
  { 
    id: 'oshpaz', 
    name: 'Oshpaz', 
    icon: '👨‍🍳',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/Gemini_Generated_Image_xckco8xckco8xckc.png'
  },
  { 
    id: 'konditer', 
    name: 'Konditer', 
    icon: '🧁',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/Gemini_Generated_Image_x2ys40x2ys40x2ys.png'
  },
  { 
    id: 'kosmetolog', 
    name: 'Kosmetolog', 
    icon: '💄',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/Gemini_Generated_Image_tga32jtga32jtga3.png'
  },
  { 
    id: 'stilist', 
    name: 'Stilist/Sartarosh', 
    icon: '✂️',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/5deeecfdf112f9ff386ca4e5f411cade.jpg'
  },
  { 
    id: 'massajist', 
    name: 'Massajist', 
    icon: '💆',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/7203.jpg'
  },
  { 
    id: 'fotograf', 
    name: 'Fotograf', 
    icon: '📷',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/photographer-man-taking-photos-village_53876-121297.avif'
  },
  { 
    id: 'videograf', 
    name: 'Videograf', 
    icon: '🎥',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/filming-in-action-stockcake.webp'
  },
  { 
    id: 'dizayner', 
    name: 'Dizayner', 
    icon: '🎨',
    image: 'https://images.unsplash.com/photo-1732120529252-6829835e7468?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmFwaGljJTIwZGVzaWduZXIlMjB3b3Jrc3BhY2UlMjBjcmVhdGl2ZXxlbnwxfHx8fDE3NzMwODkyNDd8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'dasturchi', 
    name: 'Dasturchi', 
    icon: '💻',
    image: 'https://images.unsplash.com/photo-1618388607276-6dfb062c75a1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9ncmFtbWVyJTIwY29kaW5nJTIwbGFwdG9wJTIwc2NyZWVufGVufDF8fHx8MTc3MzA4OTI0OHww&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'oqituvchi', 
    name: "O'qituvchi", 
    icon: '📚',
    image: 'https://images.unsplash.com/photo-1758270704925-fa59d93119c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWFjaGVyJTIwY2xhc3Nyb29tJTIwc3R1ZGVudHMlMjBsZWFybmluZ3xlbnwxfHx8fDE3NzMwODkyNDh8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'tarjimon', 
    name: 'Tarjimon', 
    icon: '🌍',
    image: 'https://images.unsplash.com/photo-1543282949-ffbf6a0f263c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmFuc2xhdG9yJTIwbGFuZ3VhZ2UlMjBpbnRlcnByZXRlcnxlbnwxfHx8fDE3NzMwODkyNDh8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  { 
    id: 'boshqa', 
    name: 'Boshqa', 
    icon: '⭐',
    image: 'https://images.unsplash.com/photo-1759521296013-559479e2a891?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBzZXJ2aWNlJTIwd29ya2VyJTIwZXhwZXJ0fGVufDF8fHx8MTc3MzA4OTI0OXww&ixlib=rb-4.1.0&q=80&w=1080'
  },
];

interface ServicesViewProps {
  platform?: Platform;
}

export function ServicesView({ platform = 'ios' }: ServicesViewProps) {
  const { theme, accentColor } = useTheme();
  const { user, session } = useAuth();
  const { selectedRegion, selectedDistrict } = useLocation();
  const isDark = theme === 'dark';
  
  const [activeView, setActiveView] = useState<'services' | 'categories' | 'portfolios'>('services');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [isCreatePortfolioOpen, setIsCreatePortfolioOpen] = useState(false);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<any>(null);
  const [loadingPortfolios, setLoadingPortfolios] = useState(false);
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null);
  const [portfolioToEdit, setPortfolioToEdit] = useState<any>(null);
  const [visibilityTick, setVisibilityTick] = useState(0);

  // Convert region ID to name for banners
  const selectedRegionData = allRegions.find(r => r.id === selectedRegion);
  const selectedRegionName = selectedRegionData?.name || '';
  const selectedDistrictData = selectedRegionData?.districts.find(d => d.id === selectedDistrict);
  const selectedDistrictName = selectedDistrictData?.name || '';

  // Debug logging for banner
  console.log('🔧 ServicesView Banner Debug:', {
    selectedRegionId: selectedRegion,
    selectedDistrictId: selectedDistrict,
    selectedRegionName,
    selectedDistrictName,
    willShowBanner: !!(selectedRegionName && selectedDistrictName)
  });

  // Auto-scroll banner
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % serviceBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  const selectedCatalog = serviceCatalogs.find(c => c.id === selectedCatalogId);
  const selectedCategory = serviceCategories.find(c => c.id === selectedCategoryId);
  
  const filteredCategories = selectedCatalogId
    ? serviceCategories.filter(c => c.catalogId === selectedCatalogId)
    : serviceCategories;
  
  const filteredServices = selectedCategoryId
    ? services.filter(service => service.categoryId === selectedCategoryId)
    : selectedCatalogId
    ? services.filter(service => service.catalogId === selectedCatalogId)
    : services;

  const handleCatalogSelect = (catalogId: string) => {
    setSelectedCatalogId(catalogId);
    setSelectedCategoryId(null);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
  };

  const handleViewChange = (view: 'services' | 'categories' | 'portfolios') => {
    setActiveView(view);
    setSelectedCatalogId(null);
    setSelectedCategoryId(null);
  };

  useEffect(() => {
    const loadPortfolios = async () => {
      if (activeView === 'portfolios' && user && session?.access_token) {
        // Portfolio view - faqat o'ziga tegishli portfoliolarni ko'rsatish
        setLoadingPortfolios(true);
        try {
          // TODO: Implement user's own portfolios endpoint
          // For now, show empty
          setPortfolios([]);
        } catch (error) {
          console.error('Error fetching my portfolios:', error);
          setPortfolios([]);
        } finally {
          setLoadingPortfolios(false);
        }
      } else if (activeView === 'services' || activeView === 'categories') {
        // Services/Categories view - barcha portfoliolarni ko'rsatish (region/district bo'yicha filtr bilan)
        setLoadingPortfolios(true);
        try {
          const params = new URLSearchParams();
          
          // Region/district filtrlash
          if (selectedRegion && selectedRegionName) {
            params.append('region', selectedRegionName);
          }
          if (selectedDistrict && selectedDistrictName) {
            params.append('district', selectedDistrictName);
          }

          const url = `${API_BASE_URL}/portfolios${params.toString() ? `?${params.toString()}` : ''}`;
          
          console.log('📡 Loading portfolios from:', url);
          console.log('🔍 Filters:', { region: selectedRegionName, district: selectedDistrictName });
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          });
          
          if (!response.ok) {
            throw new Error('Portfolio\'larni yuklab bo\'lmadi');
          }
          
          const data = await response.json();
          const filteredPortfolios = (data.portfolios || []).filter((portfolio: Record<string, unknown>) =>
            matchesSelectedLocation(portfolio, {
              selectedRegionId: selectedRegion,
              selectedDistrictId: selectedDistrict,
            })
          );

          console.log('✅ Portfolios loaded:', filteredPortfolios.length);
          setPortfolios(filteredPortfolios);
        } catch (error) {
          console.error('Error fetching portfolios:', error);
          setPortfolios([]);
        } finally {
          setLoadingPortfolios(false);
        }
      }
    };

    loadPortfolios();
  }, [activeView, selectedRegion, selectedDistrict, selectedRegionName, selectedDistrictName, selectedProfession, user, session?.access_token, visibilityTick]);

  // Handle portfolio deletion
  const handleDeletePortfolio = async (portfolioId: string) => {
    try {
      console.log('🗑️ Deleting portfolio:', portfolioId);
      console.log('🔑 Session:', session);
      console.log('🔑 Access token:', session?.access_token);

      const response = await fetch(`${API_BASE_URL}/services/portfolio/${portfolioId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': session?.access_token || '',
        },
      });

      console.log('📡 Delete response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Delete error response:', errorText);
        let errorMessage = 'Portfolio o\'chirishda xatolik';
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Delete successful:', result);

      // Refresh by changing activeView temporarily to trigger useEffect
      const currentView = activeView;
      setActiveView('services');
      setTimeout(() => setActiveView(currentView), 10);
      
      alert('Portfolio muvaffaqiyatli o\'chirildi!');
    } catch (error: any) {
      console.error('❌ Delete portfolio error:', error);
      alert(error.message || 'Portfolio o\'chirishda xatolik yuz berdi');
    }
  };

  // Handle portfolio edit
  const handleEditPortfolio = (portfolio: any) => {
    setPortfolioToEdit(portfolio);
    setIsCreatePortfolioOpen(true);
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Banner - Only show on main view and if location selected */}
      {!selectedCatalogId && !selectedCategoryId && selectedRegionName && selectedDistrictName && (
        <div className="px-4 pt-4 pb-2">
          <BannerCarousel 
            category="services" 
            region={selectedRegionName} 
            district={selectedDistrictName}
          />
        </div>
      )}

      {/* View Toggle - Only show on main view */}
      {!selectedCatalogId && !selectedCategoryId && (
        <div className="px-4 py-4">
          <div 
            className="inline-flex p-0.5 sm:p-1 rounded-xl sm:rounded-2xl w-full sm:w-auto"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <button
              onClick={() => handleViewChange('services')}
              className="relative flex-1 sm:flex-none px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2"
              style={{
                color: activeView === 'services' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
              }}
            >
              {activeView === 'services' && (
                <div 
                  className="absolute inset-0 rounded-lg sm:rounded-xl"
                  style={{
                    background: accentColor.color,
                    boxShadow: `0 4px 12px ${accentColor.color}66`,
                  }}
                />
              )}
              <Users className="size-3.5 sm:size-4 relative z-10" />
              <span className="text-[11px] sm:text-sm font-medium relative z-10">Xizmatlar</span>
            </button>
            <button
              onClick={() => handleViewChange('categories')}
              className="relative flex-1 sm:flex-none px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2"
              style={{
                color: activeView === 'categories' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
              }}
            >
              {activeView === 'categories' && (
                <div 
                  className="absolute inset-0 rounded-lg sm:rounded-xl"
                  style={{
                    background: accentColor.color,
                    boxShadow: `0 4px 12px ${accentColor.color}66`,
                  }}
                />
              )}
              <LayoutGrid className="size-3.5 sm:size-4 relative z-10" />
              <span className="text-[11px] sm:text-sm font-medium relative z-10">Kategoriya</span>
            </button>
            <button
              onClick={() => handleViewChange('portfolios')}
              className="relative flex-1 sm:flex-none px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2"
              style={{
                color: activeView === 'portfolios' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
              }}
            >
              {activeView === 'portfolios' && (
                <div 
                  className="absolute inset-0 rounded-lg sm:rounded-xl"
                  style={{
                    background: accentColor.color,
                    boxShadow: `0 4px 12px ${accentColor.color}66`,
                  }}
                />
              )}
              <Briefcase className="size-3.5 sm:size-4 relative z-10" />
              <span className="text-[11px] sm:text-sm font-medium relative z-10">Portfolio</span>
            </button>
          </div>
        </div>
      )}

      {/* Services View */}
      {activeView === 'services' && !selectedCatalogId && !selectedCategoryId && (
        <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <h2 
            className="text-lg font-semibold mb-3 sm:mb-4"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Barcha ustalar
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5">
            {loadingPortfolios ? (
              <div className="col-span-full text-center py-8">
                <p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>Ustalar yuklanmoqda...</p>
              </div>
            ) : portfolios.length > 0 ? (
              portfolios.map((portfolio) => (
                <ServicePortfolioCard
                  key={portfolio.id}
                  portfolio={portfolio}
                  onClick={() => {
                    console.log('Portfolio clicked:', portfolio);
                    setSelectedPortfolio(portfolio);
                  }}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-8">
                <Briefcase
                  className="size-16 mx-auto mb-4"
                  strokeWidth={1.5}
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                />
                <p className="mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  Hozircha ustalar yo'q
                </p>
                <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                  Birinchi bo'lib portfolio yarating!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Categories View - Professions List */}
      {activeView === 'categories' && !selectedProfession && (
        <div className="px-4 py-6">
          <h2 
            className="text-lg mb-4 font-bold"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Kasblar
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {professions.map((prof) => (
              <button
                key={prof.id}
                onClick={() => setSelectedProfession(prof.name)}
                className="group relative overflow-hidden rounded-2xl sm:rounded-3xl transition-all duration-300 active:scale-95"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 1)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                  boxShadow: isDark 
                    ? '0 4px 16px rgba(0, 0, 0, 0.3)' 
                    : '0 4px 16px rgba(0, 0, 0, 0.08)',
                }}
              >
                <div className="relative h-32 sm:h-36 md:h-40 overflow-hidden">
                  <img 
                    src={prof.image} 
                    alt={prof.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div 
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(to top, ${isDark ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.7)'}, transparent)`,
                    }}
                  />
                  
                  <div className="absolute top-2 left-2">
                    <div 
                      className="size-9 sm:size-10 rounded-xl flex items-center justify-center backdrop-blur-xl border"
                      style={{
                        background: `${accentColor.color}33`,
                        borderColor: `${accentColor.color}66`,
                      }}
                    >
                      <span className="text-lg sm:text-xl">{prof.icon}</span>
                    </div>
                  </div>
                </div>

                <div className="p-2 sm:p-2.5">
                  <h3 
                    className="text-xs sm:text-sm font-semibold mb-0.5 text-left line-clamp-1"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    {prof.name}
                  </h3>
                  <p 
                    className="text-[10px] sm:text-xs text-left font-medium line-clamp-1"
                    style={{ color: accentColor.color }}
                  >
                    {portfolios.filter(p => p.profession === prof.name).length} ta usta
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Profession Selected - Show Portfolios for that Profession */}
      {activeView === 'categories' && selectedProfession && (
        <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          {/* Back Button */}
          <button
            onClick={() => setSelectedProfession(null)}
            className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            }}
          >
            <ArrowLeft className="size-5" style={{ color: accentColor.color }} />
            <span 
              className="text-sm font-medium"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Kasblarga qaytish
            </span>
          </button>

          <h2 
            className="text-lg font-semibold mb-3 sm:mb-4"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            {selectedProfession} - {portfolios.filter(p => p.profession === selectedProfession).length} ta usta
          </h2>

          {portfolios.filter(p => p.profession === selectedProfession).length > 0 ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
              {portfolios.filter(p => p.profession === selectedProfession).map((portfolio) => (
                <PortfolioCard
                  key={portfolio.id}
                  portfolio={portfolio}
                  onClick={() => setSelectedPortfolio(portfolio)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Briefcase
                className="size-16 mx-auto mb-4"
                strokeWidth={1.5}
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
              />
              <p className="mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                Hozircha bu kasbda ustalar yo'q
              </p>
              <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                Birinchi bo'lib portfolio yarating!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Categories View - Categories List */}
      {selectedCatalogId && !selectedCategoryId && (
        <div className="px-4 py-6">
          {/* Back Button */}
          <button
            onClick={() => setSelectedCatalogId(null)}
            className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            }}
          >
            <ArrowLeft className="size-5" style={{ color: accentColor.color }} />
            <span 
              className="text-sm font-medium"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Kataloglarga qaytish
            </span>
          </button>

          <h2 
            className="text-lg mb-4"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Kategoriyalar - {selectedCatalog?.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {filteredCategories.map((category) => (
              <ServiceCategoryCard
                key={category.id}
                category={category}
                onClick={() => handleCategorySelect(category.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Categories View - Services in Category */}
      {selectedCategoryId && (
        <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          {/* Back Button */}
          <button
            onClick={() => setSelectedCategoryId(null)}
            className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            }}
          >
            <ArrowLeft className="size-5" style={{ color: accentColor.color }} />
            <span 
              className="text-sm font-medium"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Kategoriyalarga qaytish
            </span>
          </button>

          <h2 
            className="text-lg font-semibold mb-3 sm:mb-4"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            {selectedCategory?.name} - {filteredServices.length} ta usta
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-3 md:gap-4">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onClick={() => setSelectedService(service)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Portfolios View */}
      {activeView === 'portfolios' && (
        <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <h2 
            className="text-lg font-semibold mb-3 sm:mb-4"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Portfolio
          </h2>

          {/* Check if user is logged in */}
          {!user || !session ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div 
                className="p-6 rounded-3xl mb-6"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                <Briefcase 
                  className="size-20"
                  strokeWidth={1.5}
                  style={{ color: accentColor.color }}
                />
              </div>
              
              <h3 
                className="text-xl font-bold mb-2 text-center"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                Tizimga kirish talab qilinadi
              </h3>
              
              <p 
                className="text-sm text-center mb-6 max-w-md"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                Portfolio yaratish va ko'rish uchun avval tizimga kirishingiz kerak
              </p>

              <button
                onClick={() => {
                  // Navigate to profile page - auth modal will open automatically if not logged in
                  window.location.hash = '#/profile';
                }}
                className="px-8 py-4 rounded-2xl font-bold text-white transition-all active:scale-95"
                style={{
                  background: accentColor.color,
                  boxShadow: isDark
                    ? `0 8px 24px ${accentColor.color}66, 0 4px 12px rgba(0, 0, 0, 0.4)`
                    : `0 6px 20px ${accentColor.color}4d, 0 2px 8px rgba(0, 0, 0, 0.15)`,
                }}
              >
                Tizimga kirish
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setIsCreatePortfolioOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  }}
                >
                  <Plus className="size-5" style={{ color: accentColor.color }} />
                  <span 
                    className="text-sm font-medium"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    Yangi portfolio yaratish
                  </span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3 md:gap-4">
                {loadingPortfolios ? (
                  <div className="col-span-full text-center py-8">
                    <p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>Portfolio yuklanmoqda...</p>
                  </div>
                ) : portfolios.length > 0 ? (
                  portfolios.map((portfolio) => (
                    <PortfolioCard
                      key={portfolio.id}
                      portfolio={portfolio}
                      onClick={() => setSelectedPortfolio(portfolio)}
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-8">
                    <p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>Portfolio topilmadi</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedService && (
        <ServiceDetailModal
          service={selectedService}
          isOpen={!!selectedService}
          onClose={() => setSelectedService(null)}
        />
      )}

      {/* Create Portfolio Modal */}
      {isCreatePortfolioOpen && (
        <CreatePortfolioModal
          isOpen={isCreatePortfolioOpen}
          onClose={() => setIsCreatePortfolioOpen(false)}
          userData={user}
          accessToken={session?.access_token || ''}
          accentColor={accentColor}
          isDark={isDark}
          onSuccess={() => {
            // Refresh by changing activeView temporarily to trigger useEffect
            const currentView = activeView;
            setActiveView('services');
            setTimeout(() => setActiveView(currentView), 10);
            setIsCreatePortfolioOpen(false);
          }}
          portfolioToEdit={portfolioToEdit}
          onDelete={handleDeletePortfolio}
          onEdit={handleEditPortfolio}
        />
      )}

      {/* Portfolio Detail Modal */}
      {selectedPortfolio && (
        <PortfolioDetailModal
          portfolio={selectedPortfolio}
          isOpen={!!selectedPortfolio}
          onClose={() => {
            console.log('Closing modal');
            setSelectedPortfolio(null);
          }}
          onEdit={handleEditPortfolio}
          onDelete={handleDeletePortfolio}
        />
      )}
      {console.log('selectedPortfolio:', selectedPortfolio)}
    </div>
  );
}