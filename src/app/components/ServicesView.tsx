import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { ProfessionIcon } from './ProfessionIcon';
import { LayoutGrid, Users, ArrowLeft, Briefcase, Plus, Search } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { BannerCarousel } from './BannerCarousel';
import { regions as allRegions } from '../data/regions';
import { matchesSelectedLocation } from '../utils/locationMatching';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { ProductGridSkeleton } from './skeletons';
import { useHeaderSearchOptional } from '../context/HeaderSearchContext';
import { matchesHeaderSearch, normalizeHeaderSearch, sortByHeaderSearchRelevance } from '../utils/headerSearchMatch';
import { useRankedCatalogFeed } from '../hooks/useRankedCatalogFeed';
import {
  filterProfessionGridCategories,
  isKnownProfession,
  PROFESSION_OTHER,
} from '../data/serviceProfessions';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

interface ServicesViewProps {
  platform?: Platform;
}

export function ServicesView({ platform = 'ios' }: ServicesViewProps) {
  const { theme, accentColor } = useTheme();
  const { user, session } = useAuth();
  const { selectedRegion, selectedDistrict } = useLocation();
  const { effectiveQuery: headerSearch } = useHeaderSearchOptional();
  const isDark = theme === 'dark';
  
  const [activeView, setActiveView] = useState<'services' | 'categories' | 'portfolios'>('services');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [isCreatePortfolioOpen, setIsCreatePortfolioOpen] = useState(false);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<any>(null);
  const [loadingPortfolios, setLoadingPortfolios] = useState(true);
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null);
  const [portfolioToEdit, setPortfolioToEdit] = useState<any>(null);
  const [deletingPortfolioId, setDeletingPortfolioId] = useState<string | null>(null);
  const [visibilityTick, setVisibilityTick] = useState(0);
  const [professionQuery, setProfessionQuery] = useState('');

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

  const searchFilteredCategories = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return filteredCategories;
    const q = headerSearch;
    const parts = (c: (typeof filteredCategories)[number]) => [c.name, c.description, selectedCatalog?.name];
    const matched = filteredCategories.filter((c) => matchesHeaderSearch(q, parts(c), { vertical: 'general' }));
    return sortByHeaderSearchRelevance(matched, q, parts, { vertical: 'general' });
  }, [filteredCategories, headerSearch, selectedCatalog]);

  const searchFilteredServices = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return filteredServices;
    const q = headerSearch;
    const parts = (s: (typeof filteredServices)[number]) => [
      s.name,
      s.description,
      s.profession,
      s.location,
      s.phone,
      ...(s.skills ?? []),
      ...(s.languages ?? []),
    ];
    const matched = filteredServices.filter((s) => matchesHeaderSearch(q, parts(s), { vertical: 'general' }));
    return sortByHeaderSearchRelevance(matched, q, parts, { vertical: 'general' });
  }, [filteredServices, headerSearch]);

  const isServiceSearch = Boolean(normalizeHeaderSearch(headerSearch));
  const rankedServices = useRankedCatalogFeed(searchFilteredServices, 'service', isServiceSearch, {
    getSignals: (s) => ({
      id: String(s.id ?? ''),
      categoryKey: String(s.categoryId ?? s.catalogId ?? 'service'),
      rating: Number(s.rating) || 0,
      reviewCount: Number(s.reviews) || 0,
    }),
  });

  const effectiveProfessionQuery = useMemo(() => {
    const header = normalizeHeaderSearch(headerSearch);
    return header || professionQuery.trim();
  }, [headerSearch, professionQuery]);

  const professionGridCategories = useMemo(
    () => filterProfessionGridCategories(effectiveProfessionQuery),
    [effectiveProfessionQuery],
  );

  const selectedProfessionVisual = useMemo(() => {
    if (!selectedProfession) return null;
    if (selectedProfession === PROFESSION_OTHER) {
      return { name: PROFESSION_OTHER, categoryId: 'other' };
    }
    for (const cat of professionGridCategories) {
      const item = cat.items.find((p) => p.name === selectedProfession);
      if (item) return { name: item.name, categoryId: item.categoryId };
    }
    return { name: selectedProfession, categoryId: 'other' };
  }, [selectedProfession, professionGridCategories]);

  const professionCountTotal = useMemo(
    () => professionGridCategories.reduce((n, c) => n + c.items.length, 0),
    [professionGridCategories],
  );

  const portfolioCountByProfession = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of portfolios) {
      const key = String(p?.profession || '').trim();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [portfolios]);

  const countPortfoliosForProfession = (name: string) => {
    if (name === PROFESSION_OTHER) {
      return portfolios.filter((p) => {
        const prof = String(p?.profession || '').trim();
        return prof && !isKnownProfession(prof) && prof !== PROFESSION_OTHER;
      }).length;
    }
    return portfolioCountByProfession.get(name) || 0;
  };

  const portfoliosForSelectedProfession = useMemo(() => {
    if (!selectedProfession) return [];
    if (selectedProfession === PROFESSION_OTHER) {
      return portfolios.filter((p) => {
        const prof = String(p?.profession || '').trim();
        return prof && !isKnownProfession(prof);
      });
    }
    return portfolios.filter((p) => p.profession === selectedProfession);
  }, [portfolios, selectedProfession]);

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

  const handlePortfolioViewsUpdated = useCallback((portfolioId: string, views: number) => {
    setPortfolios((prev) =>
      prev.map((p) => (p.id === portfolioId ? { ...p, views } : p)),
    );
    setSelectedPortfolio((prev) =>
      prev?.id === portfolioId ? { ...prev, views } : prev,
    );
  }, []);

  useEffect(() => {
    const loadPortfolios = async () => {
      if (activeView === 'portfolios' && user && session?.access_token) {
        // Portfolio view - faqat o'ziga tegishli portfoliolarni ko'rsatish
        setLoadingPortfolios(true);
        try {
          const resp = await fetch(`${API_BASE_URL}/services/my-portfolios`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            throw new Error(data?.error || 'Portfoliolar yuklanmadi');
          }
          setPortfolios(Array.isArray(data.portfolios) ? data.portfolios : []);
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
      } else {
        setLoadingPortfolios(false);
      }
    };

    loadPortfolios();
  }, [activeView, selectedRegion, selectedDistrict, selectedRegionName, selectedDistrictName, selectedProfession, user, session?.access_token, visibilityTick]);

  // Handle portfolio deletion
  const handleDeletePortfolio = async (portfolioId: string) => {
    setDeletingPortfolioId(portfolioId);
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
      throw error;
    } finally {
      setDeletingPortfolioId(null);
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
              <div className="col-span-full">
                <ProductGridSkeleton
                  isDark={isDark}
                  count={8}
                  gridClassName="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5"
                />
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                Kasblar
              </h2>
              <p className="mt-1 text-xs sm:text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                {professionCountTotal} ta kasb
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
              />
              <input
                type="search"
                value={professionQuery}
                onChange={(e) => setProfessionQuery(e.target.value)}
                placeholder="Kasb qidirish..."
                className="w-full rounded-2xl border py-2.5 pl-9 pr-3 text-sm outline-none"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  color: isDark ? '#fff' : '#111',
                }}
              />
            </div>
          </div>

          {professionGridCategories.length === 0 ? (
            <div className="py-12 text-center">
              <p style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                Kasb topilmadi
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {professionGridCategories.map((cat) => (
                <section key={cat.id}>
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      className="h-1 w-5 shrink-0 rounded-full"
                      style={{ background: accentColor.color }}
                    />
                    <h3
                      className="text-[11px] font-bold uppercase tracking-[0.14em] sm:text-xs"
                      style={{ color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.62)' }}
                    >
                      {cat.label}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {cat.items.map((prof) => {
                      const ustaCount = countPortfoliosForProfession(prof.name);
                      return (
                        <button
                          key={prof.id}
                          type="button"
                          onClick={() => setSelectedProfession(prof.name)}
                          className="group flex flex-col items-center gap-2.5 rounded-2xl border p-3.5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98] sm:gap-3 sm:rounded-3xl sm:p-4"
                          style={{
                            background: isDark
                              ? 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)'
                              : 'linear-gradient(160deg, #ffffff 0%, #f8fafc 100%)',
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                            boxShadow: isDark
                              ? '0 2px 12px rgba(0,0,0,0.22)'
                              : '0 2px 12px rgba(15,23,42,0.06)',
                          }}
                        >
                          <div
                            className="relative flex size-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 sm:size-[3.75rem]"
                            style={{
                              background: isDark
                                ? `linear-gradient(145deg, ${accentColor.color}28, ${accentColor.color}10)`
                                : `linear-gradient(145deg, ${accentColor.color}18, ${accentColor.color}06)`,
                              border: `1px solid ${accentColor.color}30`,
                              boxShadow: `0 8px 22px ${accentColor.color}20`,
                            }}
                          >
                            <div
                              className="absolute inset-0 rounded-2xl opacity-60"
                              style={{
                                background: `radial-gradient(circle at 30% 20%, ${accentColor.color}35, transparent 55%)`,
                              }}
                            />
                            <ProfessionIcon
                              name={prof.name}
                              categoryId={prof.categoryId}
                              className="relative size-6 sm:size-7"
                              style={{ color: accentColor.color }}
                              strokeWidth={2}
                            />
                          </div>

                          <h3
                            className="line-clamp-2 min-h-[2.35rem] w-full text-[11px] font-bold leading-snug sm:min-h-[2.5rem] sm:text-xs"
                            style={{ color: isDark ? '#ffffff' : '#111827' }}
                          >
                            {prof.name}
                          </h3>

                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-[11px]"
                            style={{
                              background: isDark
                                ? `${accentColor.color}22`
                                : `${accentColor.color}14`,
                              color: accentColor.color,
                            }}
                          >
                            <Users className="size-3 shrink-0 opacity-80" />
                            {ustaCount} ta usta
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
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

          <div
            className="mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 sm:mb-5 sm:rounded-3xl sm:px-5 sm:py-4"
            style={{
              background: isDark
                ? `linear-gradient(135deg, ${accentColor.color}18, rgba(255,255,255,0.04))`
                : `linear-gradient(135deg, ${accentColor.color}12, #ffffff)`,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            {selectedProfessionVisual ? (
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl sm:size-14"
                style={{
                  background: isDark ? `${accentColor.color}28` : `${accentColor.color}14`,
                  border: `1px solid ${accentColor.color}35`,
                  boxShadow: `0 8px 20px ${accentColor.color}22`,
                }}
              >
                <ProfessionIcon
                  name={selectedProfessionVisual.name}
                  categoryId={selectedProfessionVisual.categoryId}
                  className="size-6 sm:size-7"
                  style={{ color: accentColor.color }}
                  strokeWidth={2}
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <h2
                className="truncate text-base font-bold sm:text-lg"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {selectedProfession}
              </h2>
              <p
                className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold sm:text-sm"
                style={{ color: accentColor.color }}
              >
                <Users className="size-3.5 shrink-0" />
                {portfoliosForSelectedProfession.length} ta usta
              </p>
            </div>
          </div>

          {portfoliosForSelectedProfession.length > 0 ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
              {portfoliosForSelectedProfession.map((portfolio) => (
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
            {searchFilteredCategories.map((category) => (
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
            {selectedCategory?.name} - {rankedServices.length} ta usta
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-3 md:gap-4">
            {rankedServices.map((service) => (
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
                  <div className="col-span-full">
                    <ProductGridSkeleton
                      isDark={isDark}
                      count={8}
                      gridClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3 md:gap-4"
                    />
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
          portfolioDeletePending={deletingPortfolioId === selectedPortfolio.id}
          onViewsUpdated={handlePortfolioViewsUpdated}
        />
      )}
      {console.log('selectedPortfolio:', selectedPortfolio)}
    </div>
  );
}