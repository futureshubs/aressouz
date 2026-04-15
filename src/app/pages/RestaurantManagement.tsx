import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Store, Utensils, BarChart3, TrendingUp, Plus, Edit2, Trash2, Power, PowerOff, Loader2, Armchair, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL, DEV_API_BASE_URL, publicAnonKey } from '/utils/supabase/info';
import { AddRestaurantModal } from '../components/AddRestaurantModal';
import { AddDishModal } from '../components/AddDishModal';
import Analytics from '../components/branch/Analytics';
import { Statistics } from '../components/branch/Statistics';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { restaurantMatchesBranchArea } from '../utils/locationMatching';

function normalizeBranchIdLocal(raw: string | undefined): string {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* ignore */
  }
  while (s.startsWith('branch:')) {
    s = s.slice('branch:'.length).trim();
  }
  return s;
}

interface RestaurantManagementProps {
  branchId?: string;
  branchRegionId?: string;
  branchDistrictId?: string;
  branchRegion?: string;
  branchDistrict?: string;
}

export function RestaurantManagement({
  branchId,
  branchRegionId,
  branchDistrictId,
  branchRegion,
  branchDistrict,
}: RestaurantManagementProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;
  
  const [activeTab, setActiveTab] = useState<'dishes' | 'restaurants' | 'rooms' | 'stats' | 'analytics'>('restaurants');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [showAddRestaurantModal, setShowAddRestaurantModal] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<any>(null);
  const [showAddDishModal, setShowAddDishModal] = useState(false);
  const [editingDish, setEditingDish] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [visibilityTick, setVisibilityTick] = useState(0);
  const [dishToggleBusyId, setDishToggleBusyId] = useState<string | null>(null);
  const [dishDeleteBusyId, setDishDeleteBusyId] = useState<string | null>(null);
  const [restaurantDeleteBusyId, setRestaurantDeleteBusyId] = useState<string | null>(null);
  const [diningRooms, setDiningRooms] = useState<any[]>([]);
  const [tableBookings, setTableBookings] = useState<any[]>([]);
  const [roomsPanelLoading, setRoomsPanelLoading] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState(4);
  const [roomSaveBusy, setRoomSaveBusy] = useState(false);
  const [bookingStatusBusyId, setBookingStatusBusyId] = useState<string | null>(null);
  const [publicBookingSaveBusy, setPublicBookingSaveBusy] = useState(false);
  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  useEffect(() => {
    loadRestaurants();
  }, [branchId, branchRegionId, branchDistrictId, branchRegion, branchDistrict, visibilityTick]);

  useEffect(() => {
    if (selectedRestaurant) {
      loadDishes(selectedRestaurant);
    }
  }, [selectedRestaurant, visibilityTick]);

  const loadRoomsAndBookings = async (restaurantId: string) => {
    try {
      setRoomsPanelLoading(true);
      const rid = encodeURIComponent(restaurantId);
      const [roomsRes, bookRes] = await Promise.all([
        fetch(`${apiBaseUrl}/restaurants/${rid}/rooms`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
        fetch(`${apiBaseUrl}/restaurants/${rid}/table-bookings`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
      ]);
      const roomsJson = await roomsRes.json();
      const bookJson = await bookRes.json();
      if (roomsJson.success) setDiningRooms(roomsJson.data || []);
      if (bookJson.success) setTableBookings(bookJson.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Xonalar / bronlarni yuklashda xatolik');
    } finally {
      setRoomsPanelLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'rooms' && selectedRestaurant) {
      void loadRoomsAndBookings(selectedRestaurant);
    }
  }, [activeTab, selectedRestaurant, visibilityTick]);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      
      let url = `${apiBaseUrl}/restaurants`;
      if (branchId) {
        const params = new URLSearchParams();
        params.set('branchId', branchId);
        params.set('forBranchPanel', '1');
        if (branchRegionId) params.set('regionId', branchRegionId);
        if (branchDistrictId) params.set('districtId', branchDistrictId);
        if (branchRegion) params.set('region', branchRegion);
        if (branchDistrict) params.set('district', branchDistrict);
        url = `${apiBaseUrl}/restaurants?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        const want = normalizeBranchIdLocal(branchId);
        const filteredRestaurants = want
          ? result.data.filter((r: any) => {
              if (normalizeBranchIdLocal(r.branchId) === want) return true;
              if (normalizeBranchIdLocal(r.branchId) !== '') return false;
              return restaurantMatchesBranchArea(r as Record<string, unknown>, {
                regionId: branchRegionId,
                districtId: branchDistrictId,
                regionName: branchRegion,
                districtName: branchDistrict,
              });
            })
          : result.data;

        setRestaurants(filteredRestaurants);
        setSelectedRestaurant((prev) => {
          if (prev && filteredRestaurants.some((r: any) => r.id === prev)) {
            return prev;
          }
          return filteredRestaurants.length > 0 ? filteredRestaurants[0].id : null;
        });
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
        `${apiBaseUrl}/restaurants/${encodeURIComponent(restaurantId)}/dishes`,
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
    setDishToggleBusyId(dishId);
    try {
      const response = await fetch(
        `${apiBaseUrl}/dishes/${encodeURIComponent(dishId)}/status`,
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
    } finally {
      setDishToggleBusyId(null);
    }
  };

  const deleteDish = async (dishId: string) => {
    if (!confirm('Taomni o\'chirishni tasdiqlaysizmi?')) return;

    setDishDeleteBusyId(dishId);
    try {
      const response = await fetch(
        `${apiBaseUrl}/dishes/${encodeURIComponent(dishId)}`,
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
    } finally {
      setDishDeleteBusyId(null);
    }
  };

  const deleteRestaurant = async (restaurantId: string) => {
    if (!confirm('Restorani o\'chirishni tasdiqlaysizmi? Barcha taomlar ham o\'chiriladi!')) return;

    setRestaurantDeleteBusyId(restaurantId);
    try {
      const response = await fetch(
        `${apiBaseUrl}/restaurants/${encodeURIComponent(restaurantId)}`,
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
        if (selectedRestaurant === restaurantId) {
          setSelectedRestaurant(null);
          setDishes([]);
        }
        loadRestaurants();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Xatolik yuz berdi!');
    } finally {
      setRestaurantDeleteBusyId(null);
    }
  };

  const addDiningRoom = async () => {
    if (!selectedRestaurant || !newRoomName.trim()) {
      toast.error('Xona nomini kiriting');
      return;
    }
    setRoomSaveBusy(true);
    try {
      const rid = encodeURIComponent(selectedRestaurant);
      const response = await fetch(`${apiBaseUrl}/restaurants/${rid}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          name: newRoomName.trim(),
          capacity: newRoomCapacity,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Xona qo‘shildi');
        setNewRoomName('');
        await loadRoomsAndBookings(selectedRestaurant);
      } else {
        toast.error(result.error || 'Xatolik');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    } finally {
      setRoomSaveBusy(false);
    }
  };

  const deleteDiningRoom = async (roomId: string) => {
    if (!confirm('Xonani o‘chirishni tasdiqlaysizmi?')) return;
    try {
      const response = await fetch(
        `${apiBaseUrl}/dining-rooms/${encodeURIComponent(roomId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        },
      );
      const result = await response.json();
      if (result.success) {
        toast.success('Xona o‘chirildi');
        if (selectedRestaurant) await loadRoomsAndBookings(selectedRestaurant);
      } else {
        toast.error(result.error || 'Xatolik');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    }
  };

  const toggleDiningRoomActive = async (room: any) => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/dining-rooms/${encodeURIComponent(room.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ isActive: !room.isActive }),
        },
      );
      const result = await response.json();
      if (result.success) {
        toast.success(room.isActive ? 'Xona mijozdan yashirildi' : 'Xona faollashtirildi');
        if (selectedRestaurant) await loadRoomsAndBookings(selectedRestaurant);
      }
    } catch {
      toast.error('Xatolik');
    }
  };

  const saveSelectedRestaurantPublicBooking = async (enabled: boolean) => {
    if (!selectedRestaurant) return;
    setPublicBookingSaveBusy(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/restaurants/${encodeURIComponent(selectedRestaurant)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ publicTableBookingEnabled: enabled }),
        },
      );
      const result = await response.json();
      if (result.success && result.data) {
        setRestaurants((prev) =>
          prev.map((x) => (x.id === selectedRestaurant ? { ...x, ...result.data } : x)),
        );
        toast.success(
          enabled
            ? 'Mijozlar joy bron qila oladi'
            : 'Onlayn joy bron o‘chirildi — mijozlar yangi so‘rov yubora olmaydi',
        );
      } else {
        toast.error(result.error || 'Saqlanmadi');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    } finally {
      setPublicBookingSaveBusy(false);
    }
  };

  const patchBookingStatus = async (bookingId: string, status: string) => {
    setBookingStatusBusyId(bookingId);
    try {
      const response = await fetch(
        `${apiBaseUrl}/table-bookings/${encodeURIComponent(bookingId)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ status }),
        },
      );
      const result = await response.json();
      if (result.success) {
        toast.success('Bron yangilandi');
        if (selectedRestaurant) await loadRoomsAndBookings(selectedRestaurant);
      } else {
        toast.error(result.error || 'Xatolik');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    } finally {
      setBookingStatusBusyId(null);
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
          onClick={() => setActiveTab('rooms')}
          className="px-5 py-3 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all"
          style={{
            background: activeTab === 'rooms' ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
            color: activeTab === 'rooms' ? '#ffffff' : 'inherit'
          }}
        >
          <Armchair className="w-5 h-5" />
          Xonalar
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
              onClick={() => {
                setEditingRestaurant(null);
                setShowAddRestaurantModal(true);
              }}
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
                        {branchId &&
                          normalizeBranchIdLocal(restaurant.branchId) !==
                            normalizeBranchIdLocal(branchId) && (
                            <p
                              className="text-xs font-semibold mt-1"
                              style={{ color: '#ca8a04' }}
                            >
                              Filial ID biriktirilmagan — mijozga mintaqangizda ko‘rinadi
                            </p>
                          )}
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRestaurant(restaurant);
                          setShowAddRestaurantModal(true);
                        }}
                        className="flex-1 min-w-[100px] px-3 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                        }}
                      >
                        <Edit2 className="w-4 h-4 shrink-0" />
                        Tahrirlash
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRestaurant(restaurant.id)}
                        disabled={restaurantDeleteBusyId === restaurant.id}
                        className="flex-1 min-w-[100px] px-3 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                      >
                        {restaurantDeleteBusyId === restaurant.id ? (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        ) : (
                          <Trash2 className="w-4 h-4 shrink-0" />
                        )}
                        O'chirish
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRestaurant(restaurant.id)}
                        className="flex-1 min-w-[100px] px-3 py-2 rounded-lg font-bold text-sm"
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
                  onClick={() => {
                    setEditingDish(null);
                    setShowAddDishModal(true);
                  }}
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
                            type="button"
                            onClick={() => toggleDishStatus(dish.id, dish.isActive)}
                            disabled={dishToggleBusyId === dish.id}
                            className="flex-1 px-3 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ 
                              background: dish.isActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                              color: dish.isActive ? '#ef4444' : '#10b981'
                            }}
                          >
                            {dishToggleBusyId === dish.id ? (
                              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            ) : dish.isActive ? (
                              <PowerOff className="w-4 h-4 shrink-0" />
                            ) : (
                              <Power className="w-4 h-4 shrink-0" />
                            )}
                            {dish.isActive ? 'Stop' : 'Faol'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDish(dish.id)}
                            disabled={dishDeleteBusyId === dish.id}
                            className="px-3 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            style={{ background: 'rgba(239, 68, 68, 0.2)' }}
                          >
                            {dishDeleteBusyId === dish.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-500" />
                            )}
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

      {activeTab === 'rooms' && (
        <div className="space-y-6">
          {!selectedRestaurant ? (
            <div
              className="text-center py-12 rounded-2xl"
              style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
            >
              <Armchair className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
              <p className="text-lg font-bold">Restoran tanlang</p>
              <p className="text-sm mt-2" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                «Restoranlar» bo‘limidan restoranni tanlang, so‘ng xona va bronlarni boshqaring.
              </p>
            </div>
          ) : (
            <>
              {(() => {
                const rec = restaurants.find((r) => r.id === selectedRestaurant);
                const bookingOn = rec?.publicTableBookingEnabled !== false;
                return (
                  <div
                    className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    <div className="min-w-0">
                      <h3 className="font-bold text-lg mb-1">Onlayn joy bron (mijozlar)</h3>
                      <p className="text-sm opacity-75">
                        O‘chirilsa, mijoz ilovasida «Joy bron qilish» ko‘rinmaydi; bu yerda bronlar ro‘yxati
                        qoladi.
                      </p>
                      <p className="text-xs mt-2 font-semibold" style={{ color: accentColor.color }}>
                        Holat: {bookingOn ? 'yoqilgan' : 'o‘chirilgan'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={publicBookingSaveBusy}
                      onClick={() => void saveSelectedRestaurantPublicBooking(!bookingOn)}
                      className="px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 flex items-center justify-center gap-2 disabled:opacity-50 min-w-[8rem]"
                      style={{
                        background: bookingOn ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.2)',
                        color: bookingOn ? '#ef4444' : '#10b981',
                      }}
                    >
                      {publicBookingSaveBusy ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : bookingOn ? (
                        'O‘chirish'
                      ) : (
                        'Yoqish'
                      )}
                    </button>
                  </div>
                );
              })()}

              <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <label className="text-xs font-semibold block mb-1 opacity-70">Yangi xona nomi</label>
                  <input
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Masalan: VIP zal, Terrasa 2"
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                    }}
                  />
                </div>
                <div className="w-28">
                  <label className="text-xs font-semibold block mb-1 opacity-70">Joy</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={newRoomCapacity}
                    onChange={(e) =>
                      setNewRoomCapacity(Math.max(1, Math.min(200, Number(e.target.value) || 1)))
                    }
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void addDiningRoom()}
                  disabled={roomSaveBusy}
                  className="px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                  style={{ background: accentColor.color, color: '#fff' }}
                >
                  {roomSaveBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  Qo‘shish
                </button>
              </div>

              {roomsPanelLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color: accentColor.color }} />
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-xl font-bold mb-3">Xonalar / joylar</h3>
                    {diningRooms.length === 0 ? (
                      <p className="text-sm opacity-70">Hozircha xona yo‘q. Yuqoridan qo‘shing — mijoz ilovasida «Joy bron qilish» paydo bo‘ladi.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {diningRooms.map((room) => (
                          <div
                            key={room.id}
                            className="p-4 rounded-2xl border flex flex-col gap-2"
                            style={{
                              background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                              opacity: room.isActive === false ? 0.55 : 1,
                            }}
                          >
                            <div className="font-bold">{room.name}</div>
                            <div className="text-sm opacity-70">{room.capacity ?? 4} kishilik</div>
                            {room.description ? (
                              <p className="text-xs opacity-60 line-clamp-2">{room.description}</p>
                            ) : null}
                            <div className="flex flex-wrap gap-2 mt-auto pt-2">
                              <button
                                type="button"
                                onClick={() => void toggleDiningRoomActive(room)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                                style={{
                                  background: room.isActive ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                                  color: room.isActive ? '#ef4444' : '#10b981',
                                }}
                              >
                                {room.isActive ? 'To‘xtatish' : 'Faollashtirish'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteDiningRoom(room.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                              >
                                O‘chirish
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                      <CalendarDays className="w-5 h-5" style={{ color: accentColor.color }} />
                      Joy bronlari
                    </h3>
                    {tableBookings.length === 0 ? (
                      <p className="text-sm opacity-70">Hozircha bronlar yo‘q.</p>
                    ) : (
                      <div className="space-y-2">
                        {tableBookings.map((b) => {
                          const st = String(b.status || 'pending').toLowerCase();
                          return (
                            <div
                              key={b.id}
                              className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                              style={{
                                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                              }}
                            >
                              <div className="min-w-0">
                                <p className="font-bold">
                                  {b.roomName} · {b.bookingDate} {b.bookingTime}
                                </p>
                                <p className="text-sm opacity-80">
                                  {b.customerName} — {b.customerPhone} ({b.partySize} kishi)
                                </p>
                                {b.notes ? (
                                  <p className="text-xs opacity-60 mt-1 line-clamp-2">{b.notes}</p>
                                ) : null}
                                <p className="text-xs mt-1 font-semibold uppercase" style={{ color: accentColor.color }}>
                                  {st}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 shrink-0">
                                {st === 'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={bookingStatusBusyId === b.id}
                                      onClick={() => void patchBookingStatus(b.id, 'confirmed')}
                                      className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                                      style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}
                                    >
                                      Tasdiqlash
                                    </button>
                                    <button
                                      type="button"
                                      disabled={bookingStatusBusyId === b.id}
                                      onClick={() => void patchBookingStatus(b.id, 'rejected')}
                                      className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                                      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                                    >
                                      Rad etish
                                    </button>
                                  </>
                                )}
                                {(st === 'confirmed' || st === 'pending') && (
                                  <button
                                    type="button"
                                    disabled={bookingStatusBusyId === b.id}
                                    onClick={() => void patchBookingStatus(b.id, 'cancelled')}
                                    className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                                  >
                                    Bekor
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'stats' &&
        (branchId ? (
          <Statistics
            branchId={branchId}
            orderType="food"
            branchInfo={{
              region: branchRegion,
              district: branchDistrict,
            }}
          />
        ) : (
          <div
            className="p-12 rounded-2xl text-center border"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <BarChart3 className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
            <h3 className="text-xl font-bold mb-2">Filial konteksti kerak</h3>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Taomlar statistikasi filial panelidan ochilganda filial buyurtmalari bo‘yicha real ma’lumot beradi.
            </p>
          </div>
        ))}

      {activeTab === 'analytics' &&
        (branchId ? (
          <Analytics branchId={branchId} orderType="food" />
        ) : (
          <div
            className="p-12 rounded-2xl text-center border"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <TrendingUp className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
            <h3 className="text-xl font-bold mb-2">Filial konteksti kerak</h3>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Data analitika filial sessiyasi bilan taom buyurtmalaridan hisoblanadi.
            </p>
          </div>
        ))}

      {/* Modals */}
      {showAddRestaurantModal && (
        <AddRestaurantModal
          key={editingRestaurant?.id ?? 'new-restaurant'}
          branchId={branchId}
          editingRestaurant={editingRestaurant}
          onClose={() => {
            setShowAddRestaurantModal(false);
            setEditingRestaurant(null);
          }}
          onSuccess={() => {
            loadRestaurants();
            setShowAddRestaurantModal(false);
            setEditingRestaurant(null);
          }}
        />
      )}

      {showAddDishModal && selectedRestaurant && (
        <AddDishModal
          restaurantId={selectedRestaurant}
          dish={editingDish || undefined}
          onClose={() => {
            setShowAddDishModal(false);
            setEditingDish(null);
          }}
          onSuccess={() => {
            loadDishes(selectedRestaurant);
            setShowAddDishModal(false);
            setEditingDish(null);
          }}
        />
      )}
    </div>
  );
}