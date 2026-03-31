import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Store, Utensils, BarChart3, TrendingUp, Plus, Edit2, Trash2, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { AddRestaurantModal } from '../components/AddRestaurantModal';
import { AddDishModal } from '../components/AddDishModal';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

interface RestaurantManagementProps {
  branchId?: string;
}

export function RestaurantManagement({ branchId }: RestaurantManagementProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [activeTab, setActiveTab] = useState<'dishes' | 'restaurants' | 'stats' | 'analytics'>('restaurants');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [showAddRestaurantModal, setShowAddRestaurantModal] = useState(false);
  const [showAddDishModal, setShowAddDishModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visibilityTick, setVisibilityTick] = useState(0);
  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  useEffect(() => {
    loadRestaurants();
  }, [branchId, visibilityTick]);

  useEffect(() => {
    if (selectedRestaurant) {
      loadDishes(selectedRestaurant);
    }
  }, [selectedRestaurant, visibilityTick]);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      
      // Build URL with branchId filter if provided
      const url = branchId 
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants?branchId=${branchId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        // Filter by branchId on client side as backup
        const filteredRestaurants = branchId 
          ? result.data.filter((r: any) => r.branchId === branchId)
          : result.data;
        
        setRestaurants(filteredRestaurants);
        if (filteredRestaurants.length > 0 && !selectedRestaurant) {
          setSelectedRestaurant(filteredRestaurants[0].id);
        }
      }
    } catch (error) {
      console.error('Load restaurants error:', error);
      toast.error('Restoranlarni yuklashda xatolik!');
    } finally {
      setLoading(false);
    }
  };

  const loadDishes = async (restaurantId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${restaurantId}/dishes`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const result = await response.json();
      
      if (result.success) {
        setDishes(result.data);
      }
    } catch (error) {
      console.error('Load dishes error:', error);
      toast.error('Taomlarni yuklashda xatolik!');
    }
  };

  const toggleDishStatus = async (dishId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/dishes/${dishId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ isActive: !currentStatus })
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success(currentStatus ? 'Taom to\'xtatildi' : 'Taom faollashtirildi');
        if (selectedRestaurant) {
          loadDishes(selectedRestaurant);
        }
      }
    } catch (error) {
      console.error('Toggle status error:', error);
      toast.error('Xatolik yuz berdi!');
    }
  };

  const deleteDish = async (dishId: string) => {
    if (!confirm('Taomni o\'chirishni tasdiqlaysizmi?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/dishes/${dishId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success('Taom o\'chirildi');
        if (selectedRestaurant) {
          loadDishes(selectedRestaurant);
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Xatolik yuz berdi!');
    }
  };

  const deleteRestaurant = async (restaurantId: string) => {
    if (!confirm('Restorani o\'chirishni tasdiqlaysizmi? Barcha taomlar ham o\'chiriladi!')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${restaurantId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success('Restoran o\'chirildi');
        loadRestaurants();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Xatolik yuz berdi!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('restaurants')}
          className="px-5 py-3 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all"
          style={{
            background: activeTab === 'restaurants' ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
            color: activeTab === 'restaurants' ? '#ffffff' : 'inherit'
          }}
        >
          <Store className="w-5 h-5" />
          Restoranlar
        </button>
        <button
          onClick={() => setActiveTab('dishes')}
          className="px-5 py-3 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all"
          style={{
            background: activeTab === 'dishes' ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
            color: activeTab === 'dishes' ? '#ffffff' : 'inherit'
          }}
        >
          <Utensils className="w-5 h-5" />
          Taomlar
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className="px-5 py-3 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all"
          style={{
            background: activeTab === 'stats' ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
            color: activeTab === 'stats' ? '#ffffff' : 'inherit'
          }}
        >
          <BarChart3 className="w-5 h-5" />
          Statistika
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className="px-5 py-3 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all"
          style={{
            background: activeTab === 'analytics' ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
            color: activeTab === 'analytics' ? '#ffffff' : 'inherit'
          }}
        >
          <TrendingUp className="w-5 h-5" />
          Data Analitika
        </button>
      </div>

      {/* Content */}
      {activeTab === 'restaurants' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Restoranlar</h2>
            <button
              onClick={() => setShowAddRestaurantModal(true)}
              className="px-5 py-3 rounded-xl font-bold flex items-center gap-2"
              style={{ background: accentColor.color, color: '#ffffff' }}
            >
              <Plus className="w-5 h-5" />
              Restoran qo'shish
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${accentColor.color}40`, borderTopColor: accentColor.color }} />
            </div>
          ) : restaurants.length === 0 ? (
            <div 
              className="text-center py-12 rounded-2xl"
              style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
            >
              <Store className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
              <p className="text-lg font-bold mb-2">Restoranlar yo'q</p>
              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                Birinchi restoraningizni qo'shing
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {restaurants.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                >
                  {restaurant.banner && (
                    <div className="w-full h-32 bg-black/10">
                      <img src={restaurant.banner} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      {restaurant.logo && (
                        <img src={restaurant.logo} alt="" className="w-16 h-16 rounded-xl object-cover" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-lg mb-1">{restaurant.name}</h3>
                        <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          {restaurant.type}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>Buyurtmalar:</span>
                        <span className="font-bold">{restaurant.totalOrders || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>Daromad:</span>
                        <span className="font-bold" style={{ color: accentColor.color }}>
                          {(restaurant.totalRevenue || 0).toLocaleString()} so'm
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteRestaurant(restaurant.id)}
                        className="flex-1 px-3 py-2 rounded-lg font-bold text-sm"
                        style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                      >
                        <Trash2 className="w-4 h-4 inline mr-1" />
                        O'chirish
                      </button>
                      <button
                        onClick={() => setSelectedRestaurant(restaurant.id)}
                        className="flex-1 px-3 py-2 rounded-lg font-bold text-sm"
                        style={{ background: accentColor.color, color: '#ffffff' }}
                      >
                        Tanlash
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'dishes' && (
        <div>
          {!selectedRestaurant ? (
            <div 
              className="text-center py-12 rounded-2xl"
              style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
            >
              <Store className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
              <p className="text-lg font-bold">Restoran tanlang</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Taomlar</h2>
                <button
                  onClick={() => setShowAddDishModal(true)}
                  className="px-5 py-3 rounded-xl font-bold flex items-center gap-2"
                  style={{ background: accentColor.color, color: '#ffffff' }}
                >
                  <Plus className="w-5 h-5" />
                  Taom qo'shish
                </button>
              </div>

              {dishes.length === 0 ? (
                <div 
                  className="text-center py-12 rounded-2xl"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
                >
                  <Utensils className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                  <p className="text-lg font-bold mb-2">Taomlar yo'q</p>
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Birinchi taomingizni qo'shing
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dishes.map((dish) => (
                    <div
                      key={dish.id}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                        opacity: dish.isActive ? 1 : 0.5
                      }}
                    >
                      {dish.images?.[0] && (
                        <div className="w-full h-48 bg-black/10">
                          <img src={dish.images[0]} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-bold text-lg mb-2">{dish.name}</h3>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {dish.isPopular && (
                            <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                              Mashhur
                            </span>
                          )}
                          {dish.isNatural && (
                            <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                              Tabiiy
                            </span>
                          )}
                          {!dish.isActive && (
                            <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                              To'xtatilgan
                            </span>
                          )}
                        </div>
                        <p className="text-sm mb-3" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          {dish.variants?.length || 0} variant
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleDishStatus(dish.id, dish.isActive)}
                            className="flex-1 px-3 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1"
                            style={{ 
                              background: dish.isActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                              color: dish.isActive ? '#ef4444' : '#10b981'
                            }}
                          >
                            {dish.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            {dish.isActive ? 'Stop' : 'Faol'}
                          </button>
                          <button
                            onClick={() => deleteDish(dish.id)}
                            className="px-3 py-2 rounded-lg"
                            style={{ background: 'rgba(239, 68, 68, 0.2)' }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div 
          className="p-12 rounded-2xl text-center"
          style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
        >
          <BarChart3 className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
          <h3 className="text-xl font-bold mb-2">Statistika</h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Bu bo'lim ustida ishlanmoqda
          </p>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div 
          className="p-12 rounded-2xl text-center"
          style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
        >
          <TrendingUp className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
          <h3 className="text-xl font-bold mb-2">Data Analitika</h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Bu bo'lim ustida ishlanmoqda
          </p>
        </div>
      )}

      {/* Modals */}
      {showAddRestaurantModal && (
        <AddRestaurantModal
          branchId={branchId}
          onClose={() => setShowAddRestaurantModal(false)}
          onSuccess={() => {
            loadRestaurants();
            setShowAddRestaurantModal(false);
          }}
        />
      )}

      {showAddDishModal && selectedRestaurant && (
        <AddDishModal
          restaurantId={selectedRestaurant}
          onClose={() => setShowAddDishModal(false)}
          onSuccess={() => {
            loadDishes(selectedRestaurant);
            setShowAddDishModal(false);
          }}
        />
      )}
    </div>
  );
}