import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { Home, LayoutGrid, ArrowLeft, Plus, Edit2, Trash2 } from 'lucide-react';
import { houseCategories, House } from '../data/houses';
import { HouseCard } from './HouseCard';
import { HouseCategoryCard } from './HouseCategoryCard';
import { HouseDetailModal } from './HouseDetailModal';
import { AddListingModal } from './AddListingModal';
import { LoginNotification } from './LoginNotification';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { BannerCarousel } from './BannerCarousel';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { ProductGridSkeleton } from './skeletons';
import { regions as allRegions } from '../data/regions';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

export function HousesView() {
  const { theme, accentColor } = useTheme();
  const { selectedRegion, selectedDistrict } = useLocation();
  const { isAuthenticated, user, session, setIsAuthOpen } = useAuth();
  const isDark = theme === 'dark';
  
  const [activeView, setActiveView] = useState<'houses' | 'categories'>('houses');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showLoginNotification, setShowLoginNotification] = useState(false);

  // Convert region ID to name for banners
  const selectedRegionData = allRegions.find(r => r.id === selectedRegion);
  const selectedRegionName = selectedRegionData?.name || '';
  const selectedDistrictData = selectedRegionData?.districts.find(d => d.id === selectedDistrict);
  const selectedDistrictName = selectedDistrictData?.name || '';

  // Debug logging for banner
  console.log('🏠 HousesView Banner Debug:', {
    selectedRegionId: selectedRegion,
    selectedDistrictId: selectedDistrict,
    selectedRegionName,
    selectedDistrictName,
    selectedCategoryId,
    activeView,
    willShowBanner: !!(selectedRegionName && selectedDistrictName && !selectedCategoryId && activeView === 'houses')
  });

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    if (!user?.id || !session?.access_token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/user/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': session.access_token,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserData(data.user);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserData();
    }
  }, [isAuthenticated, fetchUserData]);

  // Fetch houses from backend
  const fetchHouses = useCallback(async () => {
    console.log('🔄 Fetching houses...');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRegionName) {
        params.append('region', selectedRegionName.toLowerCase());
      }
      if (selectedDistrictName) {
        params.append('district', selectedDistrictName.toLowerCase());
      }
      if (selectedCategoryId) {
        params.append('category', selectedCategoryId);
      }

      const url = `${API_BASE_URL}/houses${params.toString() ? `?${params.toString()}` : ''}`;
      console.log('📍 Fetch URL:', url);
      console.log('🔍 Filters:', { region: selectedRegionName?.toLowerCase(), district: selectedDistrictName?.toLowerCase(), category: selectedCategoryId });
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      console.log('📥 Fetch status:', response.status);
      
      if (!response.ok) {
        throw new Error('Uylarni yuklab bo\'lmadi');
      }
      
      const data = await response.json();
      console.log('📥 Fetch data:', data);
      console.log('📊 Houses count:', data.houses?.length || 0);
      setHouses(data.houses || []);
    } catch (error) {
      console.error('❌ Error fetching houses:', error);
      setHouses([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRegionName, selectedDistrictName, selectedCategoryId]);

  useEffect(() => {
    fetchHouses();
  }, [fetchHouses]);

  useVisibilityRefetch(() => {
    void fetchHouses();
    if (isAuthenticated) void fetchUserData();
  });

  // Handle add house button click
  const handleAddClick = () => {
    if (!isAuthenticated) {
      setShowLoginNotification(true);
      return;
    }
    setShowAddModal(true);
  };

  // Seed houses
  const handleSeedHouses = useCallback(async () => {
    console.log('🌱 Starting seed...');
    try {
      const response = await fetch(`${API_BASE_URL}/houses/seed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      console.log('📥 Response status:', response.status);
      const data = await response.json();
      console.log('📥 Response data:', data);
      
      if (response.ok) {
        console.log('✅ Seed success:', data);
        fetchHouses();
      } else {
        console.error('❌ Seed failed:', data);
        alert(`Xatolik: ${data.error || 'Noma\'lum xatolik'}`);
      }
    } catch (error: any) {
      console.error('❌ Seed error:', error);
      alert(`Xatolik: ${error.message}`);
    }
  }, [fetchHouses]);

  // Update category counts
  const categoriesWithCounts = useMemo(() => {
    return houseCategories.map(cat => ({
      ...cat,
      count: houses.filter(h => h.categoryId === cat.id).length
    }));
  }, [houses]);

  const filteredHouses = useMemo(() => {
    if (!selectedCategoryId) return houses;
    return houses.filter(h => h.categoryId === selectedCategoryId);
  }, [houses, selectedCategoryId]);

  const selectedCategory = houseCategories.find(c => c.id === selectedCategoryId);

  return (
    <div className="min-h-screen pb-24">
      {/* Banner - Only show if location selected and no category selected */}
      {selectedRegionName && selectedDistrictName && !selectedCategoryId && activeView === 'houses' && (
        <div className="px-4 pt-4 pb-2">
          <BannerCarousel 
            category="house" 
            region={selectedRegionName} 
            district={selectedDistrictName}
          />
        </div>
      )}

      {/* View Toggle + Add Button */}
      {!selectedCategoryId && (
        <div className="px-4 py-4 flex items-center justify-between gap-3">
          <div 
            className="inline-flex p-1 rounded-2xl"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <button
              onClick={() => setActiveView('houses')}
              className="relative px-6 py-2.5 rounded-xl transition-all flex items-center gap-2"
              style={{
                color: activeView === 'houses' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
              }}
            >
              {activeView === 'houses' && (
                <div 
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: accentColor.color,
                    boxShadow: `0 4px 12px ${accentColor.color}66`,
                  }}
                />
              )}
              <Home className="size-4 relative z-10" />
              <span className="text-sm font-medium relative z-10">Uylar</span>
            </button>
            <button
              onClick={() => setActiveView('categories')}
              className="relative px-6 py-2.5 rounded-xl transition-all flex items-center gap-2"
              style={{
                color: activeView === 'categories' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
              }}
            >
              {activeView === 'categories' && (
                <div 
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: accentColor.color,
                    boxShadow: `0 4px 12px ${accentColor.color}66`,
                  }}
                />
              )}
              <LayoutGrid className="size-4 relative z-10" />
              <span className="text-sm font-medium relative z-10">Kategoriya</span>
            </button>
          </div>
          
          {/* Add Button */}
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all active:scale-95 font-bold text-white"
            style={{
              background: accentColor.color,
              boxShadow: `0 4px 12px ${accentColor.color}66`,
            }}
          >
            <Plus className="size-5" />
            <span className="text-sm">E'lon</span>
          </button>
        </div>
      )}

      {/* Houses View */}
      {activeView === 'houses' && !selectedCategoryId && (
        <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <h2 
            className="text-lg font-semibold mb-3 sm:mb-4"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Barcha uylar
          </h2>
          {loading ? (
            <ProductGridSkeleton
              isDark={isDark}
              count={12}
              gridClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5"
            />
          ) : houses.length > 0 ? (
            <div 
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5"
              style={{
                gridAutoRows: 'min-content',
              }}
            >
              {houses.map((house) => (
                <HouseCard
                  key={house.id}
                  house={house}
                  onClick={() => setSelectedHouse(house)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Home
                className="size-16 mx-auto mb-4"
                strokeWidth={1.5}
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
              />
              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                Hozircha uylar yo'q
              </p>
            </div>
          )}
        </div>
      )}

      {/* Categories View */}
      {activeView === 'categories' && !selectedCategoryId && (
        <div className="px-4 py-6">
          <h2 
            className="text-lg mb-4 font-bold"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Kategoriyalar
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {categoriesWithCounts.map((category) => (
              <HouseCategoryCard
                key={category.id}
                category={category}
                onClick={() => setSelectedCategoryId(category.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Category Selected */}
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
            {selectedCategory?.name} - {filteredHouses.length} ta uy
          </h2>

          {filteredHouses.length > 0 ? (
            <div 
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5"
              style={{
                gridAutoRows: 'min-content',
              }}
            >
              {filteredHouses.map((house) => (
                <HouseCard
                  key={house.id}
                  house={house}
                  onClick={() => setSelectedHouse(house)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Home
                className="size-16 mx-auto mb-4"
                strokeWidth={1.5}
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
              />
              <p className="mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                Bu kategoriyada uylar yo'q
              </p>
            </div>
          )}
        </div>
      )}

      {/* House Detail Modal */}
      {selectedHouse && (
        <HouseDetailModal
          house={selectedHouse}
          isOpen={!!selectedHouse}
          onClose={() => setSelectedHouse(null)}
        />
      )}

      {/* Add House Modal - Using AddListingModal */}
      {showAddModal && (
        <AddListingModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          userId={user?.id || ''}
          userName={userData?.fullName || userData?.firstName || user?.firstName || 'Foydalanuvchi'}
          userPhone={userData?.phone || user?.phone || ''}
          accessToken={session?.access_token || ''}
          defaultType="house"
          onSuccess={() => {
            fetchHouses();
            setShowAddModal(false);
          }}
        />
      )}

      {/* Login Notification */}
      {showLoginNotification && (
        <LoginNotification
          isOpen={showLoginNotification}
          onClose={() => setShowLoginNotification(false)}
          onLogin={() => setIsAuthOpen(true)}
        />
      )}
    </div>
  );
}