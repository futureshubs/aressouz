import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import {
  ShoppingCart,
  Package,
  BarChart3,
  TrendingUp,
  DollarSign,
  Power,
  LogOut,
  Bell,
  Plus,
  X,
  Upload,
  Trash2,
  Clock,
  Flame,
  Star,
  CheckCircle,
  XCircle,
  ChefHat,
  Users,
  TrendingDown,
  Calendar,
  Edit2,
  QrCode,
  RotateCcw,
  Loader2,
  Menu,
  Armchair,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatOrderNumber } from '../utils/orderNumber';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { sortOrdersNewestFirst } from '../utils/sortOrdersNewestFirst';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import {
  clampPlatformCommissionPercentClient,
  platformCommissionHintUz,
  validateVariantCommissionsClient,
} from '../utils/platformCommission';
import {
  diningRoomCapacityRange,
  diningRoomImageList,
  formatDiningRoomCapacityLabel,
} from '../utils/diningRoomClient';

const edgeFnHeaders = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
};

export default function RestaurantPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [restaurant, setRestaurant] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'orders' | 'dishes' | 'rooms' | 'stats' | 'analytics' | 'payment'
  >('dashboard');
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersCategory, setOrdersCategory] = useState<'all' | 'new' | 'accepted' | 'completed' | 'cancelled'>('all');
  const [dishes, setDishes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [diningRooms, setDiningRooms] = useState<any[]>([]);
  const [tableBookings, setTableBookings] = useState<any[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [newRoomCapacityMin, setNewRoomCapacityMin] = useState(2);
  const [newRoomCapacityMax, setNewRoomCapacityMax] = useState(8);
  const [newRoomIsPaid, setNewRoomIsPaid] = useState(false);
  const [newRoomPriceUzs, setNewRoomPriceUzs] = useState('');
  const [newRoomImages, setNewRoomImages] = useState<string[]>([]);
  const [uploadingRoomImages, setUploadingRoomImages] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomSaveBusy, setRoomSaveBusy] = useState(false);
  const [bookingStatusBusyId, setBookingStatusBusyId] = useState<string | null>(null);
  const [bookingSettingsBusy, setBookingSettingsBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Add / edit dish modal
  const [showAddDish, setShowAddDish] = useState(false);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [newDish, setNewDish] = useState({
    name: '',
    image: '',
    images: [] as string[], // Multiple images
    kcal: '',
    description: '',
    ingredients: '',
    weight: '',
    extras: [] as any[],
    variants: [] as any[],
    isPopular: false,
    isNatural: false
  });
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [orderStatusBusyOrderId, setOrderStatusBusyOrderId] = useState<string | null>(null);
  const [dishToggleBusyId, setDishToggleBusyId] = useState<string | null>(null);
  const [dishDeleteBusyId, setDishDeleteBusyId] = useState<string | null>(null);
  const [saveDishSubmitting, setSaveDishSubmitting] = useState(false);
  const [paymentRequestBusy, setPaymentRequestBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const restaurantMenuTabs: Array<{
    id: 'dashboard' | 'orders' | 'dishes' | 'rooms' | 'stats' | 'analytics' | 'payment';
    label: string;
    icon: typeof Package;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: Package },
    { id: 'orders', label: 'Buyurtmalar', icon: ShoppingCart },
    { id: 'dishes', label: 'Taomlar', icon: ChefHat },
    { id: 'rooms', label: 'Xonalar / bron', icon: Armchair },
    { id: 'stats', label: 'Statistika', icon: BarChart3 },
    { id: 'analytics', label: 'Data Analitika', icon: TrendingUp },
    { id: 'payment', label: "To'lov qabul qilish", icon: DollarSign },
  ];

  // Determine login path based on current URL
  const loginPath = location.pathname.includes('/taom') ? '/taom' : '/restaurant';

  useEffect(() => {
    const restaurantSession = localStorage.getItem('restaurantSession');
    if (!restaurantSession) {
      navigate(loginPath);
      return;
    }

    const restaurantData = JSON.parse(restaurantSession);
    setRestaurant(restaurantData);
    loadData(restaurantData.id);
  }, [navigate, loginPath]);

  const loadData = async (restaurantId: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    try {
      if (!silent) setLoading(true);
      
      const rid = encodeURIComponent(restaurantId);

      // Load orders
      const ordersResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/orders`,
        { headers: edgeFnHeaders }
      );
      const ordersResult = await ordersResponse.json();
      if (ordersResult.success) setOrders(sortOrdersNewestFirst(ordersResult.data || []));
      else console.error('Restoran buyurtmalari:', ordersResult.error || ordersResponse.status);

      // Load dishes
      const dishesResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/dishes`,
        { headers: edgeFnHeaders }
      );
      const dishesResult = await dishesResponse.json();
      if (dishesResult.success) setDishes(dishesResult.data || []);

      const [roomsRes, bookingsRes] = await Promise.all([
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/rooms`,
          { headers: edgeFnHeaders },
        ),
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/table-bookings`,
          { headers: edgeFnHeaders },
        ),
      ]);
      const roomsJson = await roomsRes.json();
      const bookingsJson = await bookingsRes.json();
      if (roomsJson.success) setDiningRooms(roomsJson.data || []);
      if (bookingsJson.success) setTableBookings(bookingsJson.data || []);

      // Load stats
      const statsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/stats`,
        { headers: edgeFnHeaders }
      );
      const statsResult = await statsResponse.json();
      if (statsResult.success) setStats(statsResult.data);

    } catch (error) {
      console.error('Load data error:', error);
      if (!silent) toast.error('Ma\'lumotlarni yuklashda xatolik!');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  useEffect(() => {
    if (!restaurant?.id) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void loadDataRef.current(restaurant.id, { silent: true });
    }, 8000);
    return () => window.clearInterval(id);
  }, [restaurant?.id]);

  useVisibilityRefetch(() => {
    if (restaurant?.id) void loadData(restaurant.id, { silent: true });
  });

  useBodyScrollLock(showAddDish || Boolean(editingDishId) || sidebarOpen);

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (!restaurant?.id) return;
    setOrderStatusBusyOrderId(orderId);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${encodeURIComponent(restaurant.id)}/orders/${encodeURIComponent(orderId)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...edgeFnHeaders,
          },
          body: JSON.stringify({ status })
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success('Status yangilandi!');
        void loadData(restaurant.id, { silent: true });
      } else {
        toast.error(result?.error || 'Status yangilanmadi');
      }
    } catch (error) {
      console.error('Update status error:', error);
      toast.error('Xatolik yuz berdi!');
    } finally {
      setOrderStatusBusyOrderId(null);
    }
  };

  const emptyNewDish = () => ({
    name: '',
    image: '',
    images: [] as string[],
    kcal: '',
    description: '',
    ingredients: '',
    weight: '',
    extras: [] as any[],
    variants: [] as any[],
    isPopular: false,
    isNatural: false,
  });

  const closeAddDishModal = () => {
    setShowAddDish(false);
    setEditingDishId(null);
    setNewDish(emptyNewDish());
  };

  const dishToForm = (dish: any) => {
    const imgs =
      Array.isArray(dish.images) && dish.images.length > 0
        ? [...dish.images]
        : dish.image
          ? [dish.image]
          : [];
    const ing = dish.ingredients;
    const ingredientsStr = Array.isArray(ing)
      ? ing.map((x: any) => String(x)).join(', ')
      : ing != null && ing !== ''
        ? String(ing)
        : '';
    let variants = (Array.isArray(dish.variants) ? dish.variants : []).map((v: any) => ({
      name: String(v.name ?? ''),
      image: String(v.image ?? ''),
      price: v.price != null && v.price !== '' ? String(v.price) : '',
      prepTime: String(v.prepTime ?? ''),
      commission: v.commission != null && v.commission !== '' ? String(v.commission) : '',
    }));
    if (variants.length === 0) {
      variants = [
        {
          name: 'Standart',
          image: String(dish.image ?? imgs[0] ?? ''),
          price:
            dish.price != null && dish.price !== ''
              ? String(dish.price)
              : '',
          prepTime: '',
          commission: '',
        },
      ];
    }
    return {
      name: String(dish.name ?? ''),
      image: String(dish.image ?? imgs[0] ?? ''),
      images: imgs,
      kcal: dish.kcal != null && dish.kcal !== '' ? String(dish.kcal) : '',
      description: String(dish.description ?? ''),
      ingredients: ingredientsStr,
      weight: dish.weight != null && dish.weight !== '' ? String(dish.weight) : '',
      extras: Array.isArray(dish.additionalProducts)
        ? dish.additionalProducts.map((e: any) => ({
            name: String(e.name ?? ''),
            price: e.price != null && e.price !== '' ? String(e.price) : '',
          }))
        : [],
      variants,
      isPopular: Boolean(dish.isPopular),
      isNatural: Boolean(dish.isNatural),
    };
  };

  const toggleDishStatus = async (dishId: string, currentStatus: boolean) => {
    if (!restaurant?.id) return;
    setDishToggleBusyId(dishId);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/dishes/${encodeURIComponent(dishId)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...edgeFnHeaders,
          },
          body: JSON.stringify({ isActive: !currentStatus })
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success(currentStatus ? 'Taom to\'xtatildi' : 'Taom faollashtirildi');
        const next = result.data;
        if (next && typeof next === 'object' && String(next.id) === String(dishId)) {
          setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, ...next } : d)));
        } else {
          setDishes((prev) =>
            prev.map((d) => (d.id === dishId ? { ...d, isActive: !currentStatus } : d)),
          );
        }
        void loadData(restaurant.id, { silent: true });
      }
    } catch (error) {
      console.error('Toggle status error:', error);
      toast.error('Xatolik yuz berdi!');
    } finally {
      setDishToggleBusyId(null);
    }
  };

  const deleteDish = async (dishId: string, dishName: string) => {
    if (!restaurant?.id) return;
    const label = (dishName || 'Taom').trim() || 'Taom';
    const ok = window.confirm(
      `«${label}» ni o‘chirishni tasdiqlaysizmi? Rasmlar ham o‘chiriladi; qayta tiklab bo‘lmaydi.`,
    );
    if (!ok) return;
    setDishDeleteBusyId(dishId);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/dishes/${encodeURIComponent(dishId)}`,
        {
          method: 'DELETE',
          headers: { ...edgeFnHeaders },
        },
      );
      const result = await response.json();
      if (result.success) {
        toast.success('Taom o‘chirildi');
        setDishes((prev) => prev.filter((d) => d.id !== dishId));
        if (editingDishId === dishId) {
          setShowAddDish(false);
          setEditingDishId(null);
          setNewDish(emptyNewDish());
        }
        void loadData(restaurant.id, { silent: true });
      } else {
        toast.error(typeof result?.error === 'string' ? result.error : 'O‘chirish amalga oshmadi');
      }
    } catch (error) {
      console.error('Delete dish error:', error);
      toast.error('Xatolik yuz berdi!');
    } finally {
      setDishDeleteBusyId(null);
    }
  };

  const reloadRoomsFromServer = async (restaurantId: string) => {
    const rid = encodeURIComponent(restaurantId);
    const [roomsRes, bookingsRes] = await Promise.all([
      fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/rooms`,
        { headers: edgeFnHeaders },
      ),
      fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/table-bookings`,
        { headers: edgeFnHeaders },
      ),
    ]);
    const roomsJson = await roomsRes.json();
    const bookingsJson = await bookingsRes.json();
    if (roomsJson.success) setDiningRooms(roomsJson.data || []);
    if (bookingsJson.success) setTableBookings(bookingsJson.data || []);
  };

  const resetRoomForm = () => {
    setNewRoomName('');
    setNewRoomDescription('');
    setNewRoomCapacityMin(2);
    setNewRoomCapacityMax(8);
    setNewRoomIsPaid(false);
    setNewRoomPriceUzs('');
    setNewRoomImages([]);
    setEditingRoomId(null);
  };

  const beginEditDiningRoom = (room: any) => {
    const { min, max } = diningRoomCapacityRange(room);
    setEditingRoomId(String(room.id));
    setNewRoomName(String(room.name || ''));
    setNewRoomDescription(String(room.description || ''));
    setNewRoomCapacityMin(min);
    setNewRoomCapacityMax(max);
    const paid = Boolean(room.isPaidRoom) && Number(room.priceUzs) > 0;
    setNewRoomIsPaid(paid);
    setNewRoomPriceUzs(paid ? String(Math.floor(Number(room.priceUzs) || 0)) : '');
    setNewRoomImages(diningRoomImageList(room));
  };

  const saveDiningRoomPanel = async () => {
    if (!restaurant?.id || !newRoomName.trim()) {
      toast.error('Xona nomini kiriting');
      return;
    }
    let capMin = Math.max(1, Math.min(200, Math.floor(Number(newRoomCapacityMin) || 1)));
    let capMax = Math.max(1, Math.min(200, Math.floor(Number(newRoomCapacityMax) || 4)));
    if (capMin > capMax) {
      const t = capMin;
      capMin = capMax;
      capMax = t;
    }
    if (newRoomIsPaid) {
      const p = Math.floor(Number(String(newRoomPriceUzs).replace(/\s/g, '')) || 0);
      if (p <= 0) {
        toast.error('Pulik xona uchun narx (so‘m) kiriting');
        return;
      }
    }
    if (newRoomImages.length < 2 || newRoomImages.length > 4) {
      toast.error('2 dan 4 tagacha rasm yuklang');
      return;
    }
    setRoomSaveBusy(true);
    try {
      const rid = encodeURIComponent(restaurant.id);
      const payload = {
        name: newRoomName.trim(),
        description: newRoomDescription.trim(),
        capacity: capMax,
        capacityMin: capMin,
        capacityMax: capMax,
        isPaidRoom: newRoomIsPaid,
        priceUzs: newRoomIsPaid ? Math.floor(Number(String(newRoomPriceUzs).replace(/\s/g, '')) || 0) : 0,
        images: newRoomImages,
      };
      const res = editingRoomId
        ? await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/dining-rooms/${encodeURIComponent(editingRoomId)}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...edgeFnHeaders },
              body: JSON.stringify(payload),
            },
          )
        : await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${rid}/rooms`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...edgeFnHeaders },
              body: JSON.stringify(payload),
            },
          );
      const j = await res.json();
      if (j.success) {
        toast.success(editingRoomId ? 'Xona yangilandi' : 'Xona qo‘shildi');
        resetRoomForm();
        await reloadRoomsFromServer(restaurant.id);
      } else {
        toast.error(j.error || 'Xatolik');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    } finally {
      setRoomSaveBusy(false);
    }
  };

  const uploadRoomImages = async (files: FileList | File[]) => {
    setUploadingRoomImages(true);
    const uploadedUrls: string[] = [];
    try {
      const filesArray = Array.from(files);
      const remaining = 4 - newRoomImages.length;
      if (remaining <= 0) {
        toast.error('Maksimal 4 ta rasm');
        return;
      }
      const slice = filesArray.slice(0, remaining);
      for (const file of slice) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/public/upload`,
            { method: 'POST', headers: edgeFnHeaders, body: formData },
          );
          const result = await response.json();
          if (result.success && result.url) uploadedUrls.push(result.url);
          else toast.error(`${file.name}: ${result.error || 'Xatolik'}`);
        } catch {
          toast.error(`${file.name} yuklanmadi`);
        }
      }
      if (uploadedUrls.length > 0) {
        setNewRoomImages((prev) => [...prev, ...uploadedUrls].slice(0, 4));
        toast.success(`${uploadedUrls.length} ta rasm yuklandi`);
      }
    } finally {
      setUploadingRoomImages(false);
    }
  };

  const deleteDiningRoomPanel = async (roomId: string) => {
    if (!confirm('Xonani o‘chirishni tasdiqlaysizmi?')) return;
    if (!restaurant?.id) return;
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/dining-rooms/${encodeURIComponent(roomId)}`,
        { method: 'DELETE', headers: edgeFnHeaders },
      );
      const j = await res.json();
      if (j.success) {
        toast.success('Xona o‘chirildi');
        await reloadRoomsFromServer(restaurant.id);
      } else {
        toast.error(j.error || 'Xatolik');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    }
  };

  const toggleDiningRoomPanel = async (room: any) => {
    if (!restaurant?.id) return;
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/dining-rooms/${encodeURIComponent(room.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...edgeFnHeaders },
          body: JSON.stringify({ isActive: !room.isActive }),
        },
      );
      const j = await res.json();
      if (j.success) {
        toast.success(room.isActive ? 'Xona mijozdan yashirildi' : 'Xona faollashtirildi');
        await reloadRoomsFromServer(restaurant.id);
      }
    } catch {
      toast.error('Xatolik');
    }
  };

  const patchBookingPanel = async (bookingId: string, status: string) => {
    if (!restaurant?.id) return;
    setBookingStatusBusyId(bookingId);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/table-bookings/${encodeURIComponent(bookingId)}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...edgeFnHeaders },
          body: JSON.stringify({ status }),
        },
      );
      const j = await res.json();
      if (j.success) {
        toast.success('Bron yangilandi');
        await reloadRoomsFromServer(restaurant.id);
      } else {
        toast.error(j.error || 'Xatolik');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    } finally {
      setBookingStatusBusyId(null);
    }
  };

  const setRestaurantPublicTableBooking = async (enabled: boolean) => {
    if (!restaurant?.id) return;
    setBookingSettingsBusy(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${encodeURIComponent(restaurant.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...edgeFnHeaders },
          body: JSON.stringify({ publicTableBookingEnabled: enabled }),
        },
      );
      const j = await res.json();
      if (j.success && j.data) {
        setRestaurant(j.data);
        try {
          localStorage.setItem('restaurantSession', JSON.stringify(j.data));
        } catch {
          /* ignore */
        }
        toast.success(
          enabled
            ? 'Mijozlar joy bron qila oladi'
            : 'Onlayn joy bron o‘chirildi — mijozlar yangi so‘rov yubora olmaydi',
        );
      } else {
        toast.error(j.error || 'Saqlanmadi');
      }
    } catch {
      toast.error('Tarmoq xatolik');
    } finally {
      setBookingSettingsBusy(false);
    }
  };

  const orderCounts = {
    all: orders.length,
    new: orders.filter((o) => o.status === 'pending').length,
    accepted: orders.filter((o) => o.status === 'accepted' || o.status === 'confirmed').length,
    completed: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled' || o.status === 'rejected').length,
  };

  const restaurantOrderPaymentLabel = (order: any) => {
    const pm = String(order?.paymentMethod || '').toLowerCase();
    if (pm === 'cash') return 'Naqd pul';
    if (pm === 'payme') return 'Payme';
    if (pm === 'click' || pm === 'click_card') return 'Click';
    if (pm === 'atmos') return 'Atmos';
    if (pm === 'qr') return 'Kassa QR (oldingi)';
    return order?.paymentMethod ? String(order.paymentMethod) : 'Karta / boshqa';
  };

  const counterQrUrlForOrder = (order: any) =>
    String(order?.merchantPaymentQrUrl || restaurant?.paymentQrImage || '').trim();

  const showCounterQrAfterAccept = (order: any) => {
    const st = String(order?.status || '').toLowerCase();
    const afterAccept = ['accepted', 'confirmed', 'preparing', 'ready'].includes(st);
    const pm = String(order?.paymentMethod || '').toLowerCase();
    const onlinePaid =
      order?.paymentStatus === 'paid' &&
      ['click', 'click_card', 'payme', 'atmos'].includes(pm);
    return afterAccept && onlinePaid && Boolean(counterQrUrlForOrder(order));
  };

  const needsCounterQrButMissing = (order: any) => {
    const st = String(order?.status || '').toLowerCase();
    const afterAccept = ['accepted', 'confirmed', 'preparing', 'ready'].includes(st);
    const pm = String(order?.paymentMethod || '').toLowerCase();
    const onlinePaid =
      order?.paymentStatus === 'paid' &&
      ['click', 'click_card', 'payme', 'atmos'].includes(pm);
    return afterAccept && onlinePaid && !counterQrUrlForOrder(order);
  };

  const filteredOrders = orders.filter((order) => {
    if (ordersCategory === 'all') return true;
    if (ordersCategory === 'new') return order.status === 'pending';
    if (ordersCategory === 'accepted') return order.status === 'accepted' || order.status === 'confirmed';
    if (ordersCategory === 'completed') return order.status === 'delivered';
    if (ordersCategory === 'cancelled') return order.status === 'cancelled' || order.status === 'rejected';
    return true;
  });

  const restaurantRefundPending = orders.filter(
    (o: any) =>
      o.refundPending === true &&
      (o.status === 'cancelled' || o.status === 'rejected' || o.status === 'canceled'),
  );

  const saveDish = async () => {
    if (!newDish.name) {
      toast.error('Taom nomini kiriting!');
      return;
    }

    if (newDish.images.length === 0) {
      toast.error('Kamida 1 ta rasm yuklang!');
      return;
    }

    if (newDish.variants.length === 0) {
      toast.error('Kamida 1 ta variant qo\'shing!');
      return;
    }

    const cErr = validateVariantCommissionsClient(
      newDish.variants.map((v: any) => ({
        commission: v.commission === '' ? 0 : Number(v.commission),
      })),
      'Taom',
    );
    if (cErr) {
      toast.error(cErr);
      return;
    }

    const payload = {
      name: newDish.name,
      images: newDish.images,
      image: newDish.image,
      kcal: newDish.kcal,
      description: newDish.description,
      ingredients: newDish.ingredients,
      weight: newDish.weight,
      additionalProducts: newDish.extras,
      variants: newDish.variants.map((v: any) => ({
        ...v,
        price: Number(v.price) || 0,
        commission: clampPlatformCommissionPercentClient(
          v.commission === '' || v.commission == null ? 0 : v.commission,
        ),
      })),
      isPopular: newDish.isPopular,
      isNatural: newDish.isNatural,
    };

    const isEdit = Boolean(editingDishId);
    const url = isEdit
      ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/dishes/${encodeURIComponent(editingDishId!)}`
      : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${encodeURIComponent(restaurant.id)}/dishes`;

    setSaveDishSubmitting(true);
    try {
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...edgeFnHeaders,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(isEdit ? 'Taom yangilandi!' : 'Taom qo\'shildi!');
        setShowAddDish(false);
        setEditingDishId(null);
        setNewDish(emptyNewDish());
        void loadData(restaurant.id, { silent: true });
      } else {
        toast.error(result.error || 'Xatolik yuz berdi!');
      }
    } catch (error) {
      console.error('Save dish error:', error);
      toast.error('Xatolik yuz berdi!');
    } finally {
      setSaveDishSubmitting(false);
    }
  };

  const requestPayment = async () => {
    if (!stats?.pendingBalance || stats.pendingBalance <= 0) {
      toast.error('To\'lov uchun mablag\' mavjud emas!');
      return;
    }

    setPaymentRequestBusy(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${encodeURIComponent(restaurant.id)}/payment-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...edgeFnHeaders,
          },
          body: JSON.stringify({ amount: stats.pendingBalance })
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success('To\'lov so\'rovi yuborildi! 24 soat ichida tekshiriladi.');
        void loadData(restaurant.id, { silent: true });
      } else {
        toast.error(result.error || 'Xatolik yuz berdi!');
      }
    } catch (error) {
      console.error('Payment request error:', error);
      toast.error('Xatolik yuz berdi!');
    } finally {
      setPaymentRequestBusy(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('restaurantSession');
    navigate(loginPath);
  };

  // Upload images to R2
  const uploadImages = async (files: FileList | File[]) => {
    setUploadingImages(true);
    const uploadedUrls: string[] = [];
    
    try {
      const filesArray = Array.from(files);
      
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const formData = new FormData();
        formData.append('file', file);
        
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/public/upload`,
            {
              method: 'POST',
              headers: edgeFnHeaders,
              body: formData
            }
          );
          
          const result = await response.json();
          
          if (result.success && result.url) {
            uploadedUrls.push(result.url);
            setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
          } else {
            toast.error(`${file.name} yuklanmadi: ${result.error || 'Xatolik'}`);
          }
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          toast.error(`${file.name} yuklanmadi!`);
        }
      }
      
      if (uploadedUrls.length > 0) {
        setNewDish(prev => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls],
          image: prev.image || uploadedUrls[0] // Set first image as main
        }));
        toast.success(`${uploadedUrls.length} ta rasm yuklandi!`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Rasmlarni yuklashda xatolik!');
    } finally {
      setUploadingImages(false);
      setUploadProgress({});
    }
  };

  // Upload variant image
  const uploadVariantImage = async (file: File, variantIndex: number) => {
    setUploadingImages(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/public/upload`,
        {
          method: 'POST',
          headers: edgeFnHeaders,
          body: formData
        }
      );
      
      const result = await response.json();
      
      if (result.success && result.url) {
        const updated = [...newDish.variants];
        updated[variantIndex].image = result.url;
        setNewDish({ ...newDish, variants: updated });
        toast.success('Variant rasmi yuklandi!');
      } else {
        toast.error(result.error || 'Rasm yuklanmadi!');
      }
    } catch (error) {
      console.error('Upload variant image error:', error);
      toast.error('Rasmni yuklashda xatolik!');
    } finally {
      setUploadingImages(false);
    }
  };

  if (loading || !restaurant) {
    return (
      <div
        className="app-panel-viewport app-safe-pad flex items-center justify-center"
        style={{ background: isDark ? '#000000' : '#f9fafb' }}
      >
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: `${accentColor.color}40`, borderTopColor: accentColor.color }} />
          <p></p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="app-panel-viewport app-safe-pad"
      style={{ background: isDark ? '#000000' : '#f9fafb', color: isDark ? '#ffffff' : '#111827' }}
    >
      {/* Chap menyu — desktop */}
      <aside
        className="hidden lg:flex lg:flex-col fixed left-0 top-0 z-30 h-[100dvh] max-h-[100dvh] w-64 min-w-[16rem] border-r overflow-hidden app-safe-pl"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          paddingTop: 'var(--app-safe-top)',
        }}
      >
        <div className="app-panel-sidebar-scroll p-6 pb-4">
          <div className="mb-6 p-4 rounded-2xl" style={{ background: `${accentColor.color}20` }}>
            <h1 className="text-lg font-bold text-center leading-tight" style={{ color: accentColor.color }}>
              {restaurant.name}
            </h1>
            <p
              className="text-xs text-center mt-2"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)' }}
            >
              {restaurant.type} • {restaurant.region}
            </p>
          </div>
          <nav className="space-y-1.5">
            {restaurantMenuTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm text-left"
                  style={{
                    background: isActive ? accentColor.gradient : 'transparent',
                    color: isActive ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.85)' : '#111827',
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div
          className="shrink-0 border-t p-4"
          style={{
            background: isDark ? '#0a0a0a' : '#ffffff',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="font-medium">Chiqish</span>
          </button>
        </div>
      </aside>

      {/* Chap menyu — mobil (hamburger) */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 app-safe-pad z-50 app-modal-overlay"
          style={{ background: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setSidebarOpen(false)}
          role="presentation"
        >
          <aside
            className="absolute left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-[min(100%,16rem)] max-w-[85vw] flex-col overflow-hidden border-r shadow-xl app-safe-pl"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              paddingTop: 'var(--app-safe-top)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="app-panel-sidebar-scroll p-5 pb-4">
              <div className="flex items-center justify-between gap-2 mb-5">
                <p className="text-sm font-bold truncate min-w-0" style={{ color: accentColor.color }}>
                  {restaurant.name}
                </p>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-xl shrink-0"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                  aria-label="Yopish"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1.5">
                {restaurantMenuTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setSidebarOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm text-left"
                      style={{
                        background: isActive ? accentColor.gradient : 'transparent',
                        color: isActive ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.85)' : '#111827',
                      }}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <div
              className="shrink-0 border-t p-4"
              style={{
                background: isDark ? '#0a0a0a' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all active:scale-95"
                style={{
                  background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                }}
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span className="font-medium">Chiqish</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:ml-64">
        <header
          className="shrink-0 border-b z-40"
          style={{
            background: isDark ? '#0a0a0a' : '#ffffff',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="max-w-7xl mx-auto w-full px-4 py-3 lg:py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl shrink-0"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                aria-label="Menyu"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg lg:text-2xl font-bold truncate">
                  {restaurantMenuTabs.find((t) => t.id === activeTab)?.label ?? 'Dashboard'}
                </h1>
                <p
                  className="text-xs lg:text-sm truncate"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)' }}
                >
                  {restaurant.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl font-bold shrink-0"
              style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
            >
              <LogOut className="w-4 h-4" />
              Chiqish
            </button>
          </div>
        </header>

        <div className="app-panel-main-scroll max-w-7xl mx-auto w-full px-4 py-6 min-h-0 flex-1">
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Bugungi buyurtmalar', value: stats?.todayOrders || 0, color: '#14b8a6', icon: ShoppingCart },
                { label: 'Kutilayotgan', value: stats?.pendingOrders || 0, color: '#f59e0b', icon: Clock },
                { label: 'Bajarilgan', value: stats?.completedOrders || 0, color: '#10b981', icon: CheckCircle },
                { label: 'Bugungi daromad', value: (stats?.todayRevenue || 0).toLocaleString() + ' so\'m', color: '#3b82f6', icon: DollarSign },
              ].map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={idx}
                    className="p-6 rounded-2xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Icon className="w-6 h-6" style={{ color: stat.color }} />
                    </div>
                    <p className="text-sm mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('orders')}
                className="p-6 rounded-2xl text-left"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                }}
              >
                <ShoppingCart className="w-8 h-8 mb-3" style={{ color: accentColor.color }} />
                <h3 className="font-bold text-lg mb-1">Buyurtmalarni ko'rish</h3>
                <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  {stats?.pendingOrders || 0} ta kutilayotgan
                </p>
              </button>
              
              <button
                onClick={() => setShowAddDish(true)}
                className="p-6 rounded-2xl text-left"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                }}
              >
                <Plus className="w-8 h-8 mb-3" style={{ color: accentColor.color }} />
                <h3 className="font-bold text-lg mb-1">Taom qo'shish</h3>
                <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Yangi taom yaratish
                </p>
              </button>
              
              <button
                onClick={() => setActiveTab('payment')}
                className="p-6 rounded-2xl text-left"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                }}
              >
                <DollarSign className="w-8 h-8 mb-3" style={{ color: accentColor.color }} />
                <h3 className="font-bold text-lg mb-1">Pul talab qilish</h3>
                <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  {(stats?.pendingBalance || 0).toLocaleString()} so'm
                </p>
              </button>
            </div>
          </div>
        )}

        {/* BUYURTMALAR */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {restaurantRefundPending.length > 0 ? (
              <div
                className="p-4 rounded-2xl border flex flex-wrap items-start gap-3"
                style={{
                  background: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(254, 226, 226, 0.65)',
                  borderColor: 'rgba(239, 68, 68, 0.35)',
                }}
              >
                <RotateCcw className="w-6 h-6 shrink-0 text-red-500 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-red-600 dark:text-red-400">
                    To‘lov qaytarish: {restaurantRefundPending.length} ta bekor buyurtma
                  </p>
                  <p className="text-sm mt-1 opacity-90" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#374151' }}>
                    Mijoz onlayn to‘lagan. Provayder orqali qaytarib, filial «Qaytarish to‘lovlari» bilan
                    ishlang.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Buyurtmalar</h2>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5" style={{ color: accentColor.color }} />
                <span className="font-bold">{orders.filter(o => o.status === 'pending').length} yangi</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Barchasi', count: orderCounts.all },
                { key: 'new', label: 'Yangi', count: orderCounts.new },
                { key: 'accepted', label: 'Qabul qilingan', count: orderCounts.accepted },
                { key: 'completed', label: 'Tugallangan', count: orderCounts.completed },
                { key: 'cancelled', label: 'Bekor qilingan', count: orderCounts.cancelled },
              ].map((cat) => {
                const active = ordersCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setOrdersCategory(cat.key as typeof ordersCategory)}
                    className="px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all"
                    style={{
                      background: active ? `${accentColor.color}22` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
                      color: active ? accentColor.color : (isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)'),
                      borderColor: active ? `${accentColor.color}66` : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'),
                    }}
                  >
                    {cat.label} ({cat.count})
                  </button>
                );
              })}
            </div>
            
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff' }}>
                <ShoppingCart className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                <p className="font-bold">Bu kategoriyada buyurtma yo'q</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredOrders.map(order => (
                  <div
                    key={order.id}
                    className="p-6 rounded-2xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      border: `2px solid ${
                        order.status === 'pending' ? '#f59e0b' :
                        order.status === 'delivered' ? '#10b981' : 
                        isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                      }`
                    }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg">Buyurtma {formatOrderNumber(order.orderNumber, order.id)}</h3>
                        <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          {new Date(order.createdAt).toLocaleString('uz-UZ')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {order.refundPending ? (
                          <span
                            className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase"
                            style={{ background: 'rgba(239,68,68,0.2)', color: '#dc2626' }}
                          >
                            Qaytarish kutilmoqda
                          </span>
                        ) : null}
                        <span
                          className="px-3 py-1 rounded-lg text-sm font-bold"
                          style={{
                            background: order.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' :
                                       order.status === 'delivered' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                            color: order.status === 'pending' ? '#f59e0b' :
                                   order.status === 'delivered' ? '#10b981' : '#3b82f6'
                          }}
                        >
                          {order.status === 'pending' ? 'Yangi' :
                           order.status === 'accepted' || order.status === 'confirmed' ? 'Qabul qilindi' :
                           order.status === 'delivered' ? 'Yetkazildi' : order.status}
                        </span>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="mb-4 p-4 rounded-xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)' }}>
                      <h4 className="font-bold mb-2">Mijoz ma'lumotlari:</h4>
                      <p className="text-sm"><strong>Ismi:</strong> {order.customerName}</p>
                      <p className="text-sm"><strong>Telefon:</strong> {order.customerPhone}</p>
                      <p className="text-sm"><strong>Manzil:</strong> {order.customerAddress}</p>
                    </div>

                    {/* Items */}
                    <div className="space-y-2 mb-4">
                      <h4 className="font-bold">Taomlar:</h4>
                      {order.items?.map((item: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                          <div className="flex items-center justify-between">
                            <span>{item.dishName} {item.variantName ? `(${item.variantName})` : ''} x{item.quantity}</span>
                            <span className="font-bold">{item.price.toLocaleString()} so'm</span>
                          </div>
                          {(Array.isArray(item.additionalProducts) || Array.isArray(item.addons)) && ((item.additionalProducts || item.addons || []).length > 0) && (
                            <div className="mt-2 pl-3 border-l" style={{ borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }}>
                              <p className="text-xs font-semibold mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                                Qo'shimchalar:
                              </p>
                              <div className="space-y-1">
                                {(item.additionalProducts || item.addons || []).map((addon: any, addonIdx: number) => (
                                  <div key={addonIdx} className="flex items-center justify-between text-xs">
                                    <span>+ {addon?.name || 'Qo\'shimcha'} x{Number(addon?.quantity || 1)}</span>
                                    <span>{Number(addon?.price || 0).toLocaleString()} so'm</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {showCounterQrAfterAccept(order) && (
                      <div
                        className="mb-4 p-4 rounded-xl border"
                        style={{
                          background: isDark ? 'rgba(20, 184, 166, 0.12)' : 'rgba(20, 184, 166, 0.08)',
                          borderColor: accentColor.color,
                        }}
                      >
                        <h4 className="font-bold mb-1 flex items-center gap-2">
                          <QrCode className="w-5 h-5" style={{ color: accentColor.color }} />
                          Kassa — to&apos;lov QR
                        </h4>
                        <p className="text-xs mb-3" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }}>
                          Mijoz Click / Payme / Atmos orqali to&apos;lagan. Buyurtmani qabul qildingiz — kassada shu
                          restoran QR kodini ko&apos;rsating yoki skaner qiling.
                        </p>
                        <div className="flex justify-center">
                          <img
                            src={counterQrUrlForOrder(order)}
                            alt="To'lov QR"
                            className="max-w-[240px] w-full rounded-xl object-contain bg-white p-2"
                            style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}` }}
                          />
                        </div>
                      </div>
                    )}

                    {needsCounterQrButMissing(order) && (
                      <div
                        className="mb-4 p-3 rounded-xl text-sm"
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
                        }}
                      >
                        Kassa QR yo&apos;q: restoran profilida to&apos;lov QR rasmi yuklanmagan. Admin yoki «Restoran
                        qo&apos;shish» sozlamalarida QR URL qo&apos;shing.
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                      <div>
                        <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          To&apos;lov: {restaurantOrderPaymentLabel(order)}
                          {order.paymentStatus === 'paid' && (
                            <span className="ml-2 text-green-500 font-semibold">• To&apos;langan</span>
                          )}
                        </p>
                        <p className="font-bold text-xl" style={{ color: accentColor.color }}>
                          {order.totalPrice.toLocaleString()} so'm
                        </p>
                      </div>
                      
                      {order.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateOrderStatus(order.id, 'rejected')}
                            disabled={orderStatusBusyOrderId === order.id}
                            className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                          >
                            {orderStatusBusyOrderId === order.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            Bekor qilish
                          </button>
                          <button
                            type="button"
                            onClick={() => updateOrderStatus(order.id, 'accepted')}
                            disabled={orderStatusBusyOrderId === order.id}
                            className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: accentColor.color, color: '#ffffff' }}
                          >
                            {orderStatusBusyOrderId === order.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Qabul qilish
                          </button>
                        </div>
                      )}
                      
                      {(order.status === 'accepted' || order.status === 'confirmed') && (
                        <div
                          className="px-4 py-2 rounded-xl font-bold"
                          style={{
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: '#3b82f6',
                          }}
                        >
                          Qabul qilindi
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAOMLAR */}
        {activeTab === 'dishes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Taomlar</h2>
              <button
                type="button"
                onClick={() => {
                  setEditingDishId(null);
                  setNewDish(emptyNewDish());
                  setShowAddDish(true);
                }}
                className="px-4 py-2 rounded-xl font-bold flex items-center gap-2"
                style={{ background: accentColor.color, color: '#ffffff' }}
              >
                <Plus className="w-4 h-4" />
                Taom qo'shish
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dishes.map(dish => (
                <div
                  key={dish.id}
                  data-restaurant-dish-card="1"
                  className="rounded-2xl flex flex-col"
                  style={{
                    overflow: 'visible',
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    opacity: dish.isActive ? 1 : 0.5
                  }}
                >
                  <div className="relative h-48 shrink-0 overflow-hidden rounded-t-2xl">
                    <img src={dish.image} alt={dish.name} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 z-20 flex flex-wrap items-center justify-end gap-2 max-w-[85%]">
                      {dish.isPopular && (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: '#f59e0b', color: '#ffffff' }}>
                          <Star className="w-3 h-3 inline mr-1" />
                          Mashhur
                        </span>
                      )}
                      {dish.isNatural && (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: '#10b981', color: '#ffffff' }}>
                          <Flame className="w-3 h-3 inline mr-1" />
                          Tabiiy
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4 overflow-visible shrink-0">
                    <h3 className="font-bold text-lg mb-2">{dish.name}</h3>
                    {dish.kcal && (
                      <p className="text-sm mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        🔥 {dish.kcal} kcal
                      </p>
                    )}
                    <div className="flex flex-col gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDishId(dish.id);
                          setNewDish(dishToForm(dish));
                          setShowAddDish(true);
                        }}
                        className="w-full px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2"
                        style={{
                          background: `${accentColor.color}22`,
                          color: accentColor.color,
                        }}
                      >
                        <Edit2 className="w-4 h-4 shrink-0" />
                        Tahrirlash
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDishStatus(dish.id, dish.isActive)}
                        disabled={dishToggleBusyId === dish.id || dishDeleteBusyId === dish.id}
                        className="w-full px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: dish.isActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: dish.isActive ? '#ef4444' : '#10b981'
                        }}
                      >
                        {dishToggleBusyId === dish.id ? (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        ) : (
                          <Power className="w-4 h-4 shrink-0" />
                        )}
                        {dish.isActive ? 'Stop' : 'Faol'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteDish(dish.id, dish.name)}
                        disabled={dishDeleteBusyId === dish.id || dishToggleBusyId === dish.id}
                        className="w-full px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border"
                        style={{
                          background: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)',
                          color: isDark ? '#fecaca' : '#b91c1c',
                          borderColor: isDark ? 'rgba(248, 113, 113, 0.45)' : 'rgba(239, 68, 68, 0.35)',
                        }}
                      >
                        {dishDeleteBusyId === dish.id ? (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        ) : (
                          <Trash2 className="w-4 h-4 shrink-0" />
                        )}
                        O‘chirish
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* XONALAR / BRON */}
        {activeTab === 'rooms' && restaurant?.id && (
          <div className="space-y-6">
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
                  O‘chirilsa, ilovada «Joy bron qilish» yo‘qoladi; restoran panelida bronlarni ko‘rish va
                  holatini boshqarish davom etadi.
                </p>
                <p className="text-xs mt-2 font-semibold" style={{ color: accentColor.color }}>
                  Holat: {restaurant?.publicTableBookingEnabled === false ? 'o‘chirilgan' : 'yoqilgan'}
                </p>
              </div>
              <button
                type="button"
                disabled={bookingSettingsBusy}
                onClick={() =>
                  void setRestaurantPublicTableBooking(restaurant?.publicTableBookingEnabled === false)
                }
                className="px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 flex items-center justify-center gap-2 disabled:opacity-50 min-w-[8rem]"
                style={{
                  background:
                    restaurant?.publicTableBookingEnabled === false
                      ? 'rgba(16,185,129,0.2)'
                      : 'rgba(239,68,68,0.15)',
                  color: restaurant?.publicTableBookingEnabled === false ? '#10b981' : '#ef4444',
                }}
              >
                {bookingSettingsBusy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : restaurant?.publicTableBookingEnabled === false ? (
                  'Yoqish'
                ) : (
                  'O‘chirish'
                )}
              </button>
            </div>

            <div
              className="p-4 rounded-2xl border space-y-4"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-base">
                  {editingRoomId ? 'Xonani tahrirlash' : 'Yangi xona'}
                </h3>
                {editingRoomId ? (
                  <button
                    type="button"
                    onClick={() => resetRoomForm()}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                      color: isDark ? 'rgba(255,255,255,0.85)' : '#111',
                    }}
                  >
                    Bekor qilish
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold block mb-1 opacity-70">Xona nomi *</label>
                  <input
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Masalan: VIP, Terrasa"
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                      color: isDark ? '#fff' : '#111',
                    }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold block mb-1 opacity-70">Qisqa tavsif (ixtiyoriy)</label>
                  <textarea
                    value={newRoomDescription}
                    onChange={(e) => setNewRoomDescription(e.target.value)}
                    rows={2}
                    placeholder="Mijozga ko‘rinadigan qisqa matn"
                    className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                      color: isDark ? '#fff' : '#111',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1 opacity-70">Min. sig‘im (kishi) *</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={newRoomCapacityMin}
                    onChange={(e) =>
                      setNewRoomCapacityMin(Math.max(1, Math.min(200, Number(e.target.value) || 1)))
                    }
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                      color: isDark ? '#fff' : '#111',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1 opacity-70">Max. sig‘im (kishi) *</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={newRoomCapacityMax}
                    onChange={(e) =>
                      setNewRoomCapacityMax(Math.max(1, Math.min(200, Number(e.target.value) || 4)))
                    }
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                      color: isDark ? '#fff' : '#111',
                    }}
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRoomIsPaid}
                      onChange={(e) => {
                        setNewRoomIsPaid(e.target.checked);
                        if (!e.target.checked) setNewRoomPriceUzs('');
                      }}
                      className="rounded border"
                    />
                    <span>Pulik xona (bron uchun alohida narx)</span>
                  </label>
                  {newRoomIsPaid ? (
                    <div className="flex-1 min-w-[140px] max-w-xs">
                      <label className="text-xs font-semibold block mb-1 opacity-70">Narx (so‘m) *</label>
                      <input
                        type="number"
                        min={0}
                        value={newRoomPriceUzs}
                        onChange={(e) => setNewRoomPriceUzs(e.target.value)}
                        placeholder="Masalan: 500000"
                        className="w-full px-4 py-3 rounded-xl outline-none"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                          color: isDark ? '#fff' : '#111',
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold block mb-1 opacity-70">
                    Rasmlar * (2–4 ta, taomlar kabi yuklash)
                  </label>
                  <label
                    className="w-full px-4 py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 border-2 border-dashed"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      borderColor: uploadingRoomImages ? accentColor.color : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={uploadingRoomImages || newRoomImages.length >= 4}
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          const left = 4 - newRoomImages.length;
                          if (e.target.files.length > left) {
                            toast.error(`Yana maksimal ${left} ta rasm qo‘shishingiz mumkin`);
                            return;
                          }
                          void uploadRoomImages(e.target.files);
                        }
                      }}
                    />
                    {uploadingRoomImages ? (
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: accentColor.color }} />
                    ) : (
                      <Upload className="w-5 h-5" style={{ color: accentColor.color }} />
                    )}
                    <span className="text-sm">Yuklash ({newRoomImages.length}/4)</span>
                  </label>
                  {newRoomImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      {newRoomImages.map((url, idx) => (
                        <div key={url + idx} className="relative rounded-xl overflow-hidden border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                          <img src={url} alt="" className="w-full h-24 object-cover" />
                          <button
                            type="button"
                            onClick={() => setNewRoomImages((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(239,68,68,0.95)', color: '#fff' }}
                            aria-label="O‘chirish"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void saveDiningRoomPanel()}
                disabled={roomSaveBusy}
                className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
                style={{ background: accentColor.color, color: '#fff' }}
              >
                {roomSaveBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : editingRoomId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingRoomId ? 'Saqlash' : 'Qo‘shish'}
              </button>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3">Xonalar</h2>
              {diningRooms.length === 0 ? (
                <p className="text-sm opacity-70">Xonalar yo‘q. Mijoz ilovasida joy bron paydo bo‘lishi uchun qo‘shing.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {diningRooms.map((room) => {
                    const imgs = diningRoomImageList(room);
                    const capLabel = formatDiningRoomCapacityLabel(room);
                    const paid = Boolean(room.isPaidRoom) && Number(room.priceUzs) > 0;
                    return (
                      <div
                        key={room.id}
                        className="rounded-2xl border overflow-hidden"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                          opacity: room.isActive === false ? 0.55 : 1,
                        }}
                      >
                        <div className="relative h-36 bg-black/10">
                          {imgs[0] ? (
                            <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm opacity-50">
                              Rasm yo‘q
                            </div>
                          )}
                          {imgs.length > 1 ? (
                            <div className="absolute bottom-2 right-2 flex gap-1">
                              {imgs.slice(0, 4).map((u, i) => (
                                <div
                                  key={u + i}
                                  className="w-7 h-7 rounded-md border-2 overflow-hidden shrink-0"
                                  style={{
                                    borderColor: i === 0 ? accentColor.color : 'rgba(255,255,255,0.6)',
                                  }}
                                >
                                  <img src={u} alt="" className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="p-4">
                          <p className="font-bold">{room.name}</p>
                          <p className="text-sm opacity-70 mt-0.5">{capLabel}</p>
                          {paid ? (
                            <p className="text-sm font-semibold mt-1" style={{ color: accentColor.color }}>
                              {Number(room.priceUzs).toLocaleString('uz-UZ')} so‘m
                            </p>
                          ) : (
                            <p className="text-xs opacity-60 mt-1">Bepul / bron narxi yo‘q</p>
                          )}
                          {room.description ? (
                            <p className="text-xs mt-2 line-clamp-2 opacity-75">{room.description}</p>
                          ) : null}
                          <div className="flex flex-wrap gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => beginEditDiningRoom(room)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold"
                              style={{ background: `${accentColor.color}22`, color: accentColor.color }}
                            >
                              Tahrirlash
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleDiningRoomPanel(room)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold"
                              style={{
                                background: room.isActive ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                                color: room.isActive ? '#ef4444' : '#10b981',
                              }}
                            >
                              {room.isActive ? 'To‘xtatish' : 'Faol'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteDiningRoomPanel(room.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold"
                              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                            >
                              O‘chirish
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <CalendarDays className="w-5 h-5" style={{ color: accentColor.color }} />
                Bronlar
              </h2>
              {tableBookings.length === 0 ? (
                <p className="text-sm opacity-70">Bronlar yo‘q.</p>
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
                            {b.customerName} — {b.customerPhone} ({b.partySize})
                          </p>
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
                                onClick={() => void patchBookingPanel(b.id, 'confirmed')}
                                className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                                style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}
                              >
                                Tasdiqlash
                              </button>
                              <button
                                type="button"
                                disabled={bookingStatusBusyId === b.id}
                                onClick={() => void patchBookingPanel(b.id, 'rejected')}
                                className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                              >
                                Rad
                              </button>
                            </>
                          )}
                          {(st === 'confirmed' || st === 'pending') && (
                            <button
                              type="button"
                              disabled={bookingStatusBusyId === b.id}
                              onClick={() => void patchBookingPanel(b.id, 'cancelled')}
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
          </div>
        )}

        {/* STATISTIKA */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Statistika</h2>
            
            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Jami buyurtmalar', value: stats?.totalOrders || 0, color: '#14b8a6' },
                { label: 'Topshirilgan', value: stats?.completedOrders || 0, color: '#10b981' },
                { label: 'Bekor qilingan', value: stats?.rejectedOrders || 0, color: '#ef4444' },
                { label: 'Jami daromad', value: (stats?.totalRevenue || 0).toLocaleString() + ' so\'m', color: '#3b82f6' },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                >
                  <p className="text-sm mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Payment Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
                <h3 className="font-bold text-lg mb-4">Pul holati</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Kutilayotgan:</span>
                    <span className="font-bold" style={{ color: '#f59e0b' }}>{(stats?.pendingBalance || 0).toLocaleString()} so'm</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>To'langan:</span>
                    <span className="font-bold" style={{ color: '#10b981' }}>{(stats?.paidBalance || 0).toLocaleString()} so'm</span>
                  </div>
                  <div className="h-px" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Jami:</span>
                    <span className="font-bold text-xl" style={{ color: accentColor.color }}>{(stats?.totalRevenue || 0).toLocaleString()} so'm</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
                <h3 className="font-bold text-lg mb-4">Buyurtma statistikasi</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Bugungi:</span>
                    <span className="font-bold">{stats?.todayOrders || 0} ta</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Kutilayotgan:</span>
                    <span className="font-bold" style={{ color: '#f59e0b' }}>{stats?.pendingOrders || 0} ta</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Topshirilgan:</span>
                    <span className="font-bold" style={{ color: '#10b981' }}>{stats?.completedOrders || 0} ta</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DATA ANALITIKA */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Data Analitika</h2>
            
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Chart */}
              <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
                <h3 className="font-bold text-lg mb-4">Haftalik daromad</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={stats?.weeklyRevenue || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                    <XAxis dataKey="day" stroke={isDark ? '#fff' : '#000'} />
                    <YAxis stroke={isDark ? '#fff' : '#000'} />
                    <Tooltip 
                      contentStyle={{ 
                        background: isDark ? '#1a1a1a' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        borderRadius: '12px'
                      }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke={accentColor.color} strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Orders Chart */}
              <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
                <h3 className="font-bold text-lg mb-4">Haftalik buyurtmalar</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats?.weeklyOrders || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                    <XAxis dataKey="day" stroke={isDark ? '#fff' : '#000'} />
                    <YAxis stroke={isDark ? '#fff' : '#000'} />
                    <Tooltip 
                      contentStyle={{ 
                        background: isDark ? '#1a1a1a' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        borderRadius: '12px'
                      }}
                    />
                    <Bar dataKey="orders" fill={accentColor.color} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Status Distribution */}
              <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
                <h3 className="font-bold text-lg mb-4">Buyurtma statuslari</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Topshirilgan', value: stats?.completedOrders || 0, id: 'completed' },
                        { name: 'Kutilayotgan', value: stats?.pendingOrders || 0, id: 'pending' },
                        { name: 'Bekor qilingan', value: stats?.rejectedOrders || 0, id: 'rejected' },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell key="cell-completed" fill="#10b981" />
                      <Cell key="cell-pending" fill="#f59e0b" />
                      <Cell key="cell-rejected" fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Top Dishes */}
              <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
                <h3 className="font-bold text-lg mb-4">Top taomlar</h3>
                <div className="space-y-3">
                  {(stats?.topDishes || []).slice(0, 5).map((dish: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-xl" style={{ color: accentColor.color }}>#{idx + 1}</span>
                        <span>{dish.name}</span>
                      </div>
                      <span className="font-bold">{dish.orders} ta</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TO'LOV QABUL QILISH */}
        {activeTab === 'payment' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">To'lov qabul qilish</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
                <p className="text-sm mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>Kutilayotgan to'lov</p>
                <p className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{(stats?.pendingBalance || 0).toLocaleString()} so'm</p>
              </div>
              <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
                <p className="text-sm mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>To'langan</p>
                <p className="text-3xl font-bold" style={{ color: '#10b981' }}>{(stats?.paidBalance || 0).toLocaleString()} so'm</p>
              </div>
              <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
                <p className="text-sm mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>Jami daromad</p>
                <p className="text-3xl font-bold" style={{ color: accentColor.color }}>{(stats?.totalRevenue || 0).toLocaleString()} so'm</p>
              </div>
            </div>

            {/* Payment Request Info */}
            <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
              <h3 className="font-bold text-lg mb-4">To'lov so'rovi yuborish</h3>
              <p className="mb-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                Siz har 24 soatda bir marta pul talab qilishingiz mumkin. To'lov so'rovi yuborilgandan so'ng, 
                admin tekshiradi va kartangizga pul o'tkazadi yoki kasser orqali naqd pul topshiradi.
              </p>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={requestPayment}
                  disabled={
                    paymentRequestBusy ||
                    !stats?.pendingBalance ||
                    stats.pendingBalance <= 0
                  }
                  className="px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: accentColor.color, color: '#ffffff' }}
                >
                  {paymentRequestBusy && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                  Pul talab qilish ({(stats?.pendingBalance || 0).toLocaleString()} so'm)
                </button>
                {stats?.lastPaymentRequest && (
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Oxirgi so'rov: {new Date(stats.lastPaymentRequest).toLocaleString('uz-UZ')}
                  </p>
                )}
              </div>
            </div>

            {/* Payment History */}
            <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
              <h3 className="font-bold text-lg mb-4">To'lov tarixi</h3>
              {(stats?.paymentHistory || []).length === 0 ? (
                <p className="text-center py-8" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Hali to'lovlar yo'q
                </p>
              ) : (
                <div className="space-y-3">
                  {(stats?.paymentHistory || []).map((payment: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)' }}>
                      <div>
                        <p className="font-bold">{payment.amount.toLocaleString()} so'm</p>
                        <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          {new Date(payment.date).toLocaleString('uz-UZ')}
                        </p>
                      </div>
                      <span
                        className="px-3 py-1 rounded-lg text-sm font-bold"
                        style={{
                          background: payment.status === 'paid' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: payment.status === 'paid' ? '#10b981' : '#f59e0b'
                        }}
                      >
                        {payment.status === 'paid' ? 'To\'landi' : 'Kutilmoqda'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </main>

      {/* Add Dish Modal */}
      {showAddDish && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 app-modal-overlay app-safe-pad"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
        >
          <div
            className="w-full max-w-2xl max-h-[min(90dvh,90vh)] min-h-0 overflow-y-auto overscroll-y-contain rounded-3xl p-6 [-webkit-overflow-scrolling:touch] touch-pan-y"
            style={{ background: isDark ? '#1a1a1a' : '#ffffff' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">
                {editingDishId ? 'Taomni tahrirlash' : 'Taom qo\'shish'}
              </h2>
              <button type="button" onClick={closeAddDishModal}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block font-bold mb-2">Taom nomi *</label>
                <input
                  type="text"
                  value={newDish.name}
                  onChange={(e) => setNewDish({ ...newDish, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="Masalan: Osh"
                />
              </div>

              {/* Images Upload */}
              <div>
                <label className="block font-bold mb-2">Rasmlar * (2-6 ta)</label>
                
                {/* Upload Button */}
                <label className="w-full px-4 py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 border-2 border-dashed transition-all hover:border-opacity-80"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                    borderColor: uploadingImages ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)')
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    max={6}
                    className="hidden"
                    disabled={uploadingImages || newDish.images.length >= 6}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const remainingSlots = 6 - newDish.images.length;
                        if (e.target.files.length > remainingSlots) {
                          toast.error(`Maksimal ${remainingSlots} ta rasm qo'shishingiz mumkin!`);
                          return;
                        }
                        uploadImages(e.target.files);
                      }
                    }}
                  />
                  {uploadingImages ? (
                    <>
                      <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: accentColor.color, borderTopColor: 'transparent' }} />
                      <span></span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" style={{ color: accentColor.color }} />
                      <span>Rasmlarni yuklash ({newDish.images.length}/6)</span>
                    </>
                  )}
                </label>

                {/* Image Previews */}
                {newDish.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {newDish.images.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-xl overflow-hidden"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          border: `2px solid ${newDish.image === url ? accentColor.color : 'transparent'}`
                        }}
                      >
                        <img src={url} alt={`Rasm ${idx + 1}`} className="w-full h-24 object-cover" />
                        <button
                          onClick={() => {
                            const filtered = newDish.images.filter((_, i) => i !== idx);
                            setNewDish({
                              ...newDish,
                              images: filtered,
                              image: filtered.length > 0 ? (newDish.image === url ? filtered[0] : newDish.image) : ''
                            });
                          }}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(239, 68, 68, 0.9)', color: '#ffffff' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setNewDish({ ...newDish, image: url })}
                          className="absolute bottom-1 left-1 right-1 px-2 py-1 text-xs font-bold rounded"
                          style={{
                            background: newDish.image === url ? accentColor.color : 'rgba(0, 0, 0, 0.5)',
                            color: '#ffffff'
                          }}
                        >
                          {newDish.image === url ? '✓ Asosiy' : 'Asosiy qilish'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs mt-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  Rasmlarni yuklang (JPEG, PNG). Birinchi rasm asosiy rasm bo'ladi.
                </p>
              </div>

              {/* Kcal & Weight */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-2">Kaloriya (kcal)</label>
                  <input
                    type="text"
                    value={newDish.kcal}
                    onChange={(e) => setNewDish({ ...newDish, kcal: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                    }}
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-2">Vazn (gr)</label>
                  <input
                    type="text"
                    value={newDish.weight}
                    onChange={(e) => setNewDish({ ...newDish, weight: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                    }}
                    placeholder="350"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold mb-2">Tavsif</label>
                <textarea
                  value={newDish.description}
                  onChange={(e) => setNewDish({ ...newDish, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="Mazali va shirin taom..."
                />
              </div>

              {/* Ingredients */}
              <div>
                <label className="block font-bold mb-2">Tarkib</label>
                <textarea
                  value={newDish.ingredients}
                  onChange={(e) => setNewDish({ ...newDish, ingredients: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="Guruch, go'sht, sabzi, piyoz..."
                />
              </div>

              {/* Flags */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newDish.isPopular}
                    onChange={(e) => setNewDish({ ...newDish, isPopular: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <Star className="w-5 h-5" style={{ color: '#f59e0b' }} />
                  <span>Mashhur</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newDish.isNatural}
                    onChange={(e) => setNewDish({ ...newDish, isNatural: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <Flame className="w-5 h-5" style={{ color: '#10b981' }} />
                  <span>Tabiiy</span>
                </label>
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="font-bold">Variantlar *</label>
                  <button
                    onClick={() => setNewDish({
                      ...newDish,
                      variants: [...newDish.variants, { name: '', image: '', price: '', prepTime: '', commission: '' }]
                    })}
                    className="px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 text-sm"
                    style={{ background: accentColor.color, color: '#ffffff' }}
                  >
                    <Plus className="w-4 h-4" />
                    Variant
                  </button>
                </div>
                <p className="text-xs mb-2 opacity-70">{platformCommissionHintUz()}</p>
                <div className="space-y-3">
                  {newDish.variants.map((variant, idx) => (
                    <div key={idx} className="p-4 rounded-xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold">Variant #{idx + 1}</span>
                        <button
                          onClick={() => setNewDish({ ...newDish, variants: newDish.variants.filter((_, i) => i !== idx) })}
                        >
                          <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={variant.name}
                          onChange={(e) => {
                            const updated = [...newDish.variants];
                            updated[idx].name = e.target.value;
                            setNewDish({ ...newDish, variants: updated });
                          }}
                          className="px-3 py-2 rounded-lg"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                          }}
                          placeholder="Kichik / O'rta / Katta"
                        />
                        <input
                          type="text"
                          value={variant.price}
                          onChange={(e) => {
                            const updated = [...newDish.variants];
                            updated[idx].price = e.target.value;
                            setNewDish({ ...newDish, variants: updated });
                          }}
                          className="px-3 py-2 rounded-lg"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                          }}
                          placeholder="Narx (25000)"
                        />
                        <input
                          type="number"
                          min={0}
                          max={15}
                          value={variant.commission ?? ''}
                          onChange={(e) => {
                            const updated = [...newDish.variants];
                            updated[idx].commission = e.target.value;
                            setNewDish({ ...newDish, variants: updated });
                          }}
                          className="px-3 py-2 rounded-lg"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                          }}
                          placeholder="Berish % (0–15)"
                        />
                        <div className="col-span-2">
                          {variant.image ? (
                            <div className="flex items-center gap-2">
                              <img src={variant.image} alt="Variant" className="w-12 h-12 object-cover rounded" />
                              <button
                                onClick={() => {
                                  const updated = [...newDish.variants];
                                  updated[idx].image = '';
                                  setNewDish({ ...newDish, variants: updated });
                                }}
                                className="px-2 py-1 rounded text-sm"
                                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                              >
                                O'chirish
                              </button>
                            </div>
                          ) : (
                            <label className="px-3 py-2 rounded-lg cursor-pointer flex items-center justify-center gap-2 border"
                              style={{
                                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                              }}
                            >
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingImages}
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    uploadVariantImage(e.target.files[0], idx);
                                  }
                                }}
                              />
                              <Upload className="w-4 h-4" style={{ color: accentColor.color }} />
                              <span className="text-sm">Rasm yuklash</span>
                            </label>
                          )}
                        </div>
                        <input
                          type="text"
                          value={variant.prepTime}
                          onChange={(e) => {
                            const updated = [...newDish.variants];
                            updated[idx].prepTime = e.target.value;
                            setNewDish({ ...newDish, variants: updated });
                          }}
                          className="px-3 py-2 rounded-lg col-span-2"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                          }}
                          placeholder="Tayyorlash vaqti (20-30 daqiqa)"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extras */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="font-bold">Qo'shimcha mahsulotlar</label>
                  <button
                    onClick={() => setNewDish({
                      ...newDish,
                      extras: [...newDish.extras, { name: '', price: '' }]
                    })}
                    className="px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 text-sm"
                    style={{ background: accentColor.color, color: '#ffffff' }}
                  >
                    <Plus className="w-4 h-4" />
                    Qo'shimcha
                  </button>
                </div>
                <div className="space-y-2">
                  {newDish.extras.map((extra, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={extra.name}
                        onChange={(e) => {
                          const updated = [...newDish.extras];
                          updated[idx].name = e.target.value;
                          setNewDish({ ...newDish, extras: updated });
                        }}
                        className="flex-1 px-3 py-2 rounded-lg"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                        }}
                        placeholder="Nomi (Achchiq sous)"
                      />
                      <input
                        type="text"
                        value={extra.price}
                        onChange={(e) => {
                          const updated = [...newDish.extras];
                          updated[idx].price = e.target.value;
                          setNewDish({ ...newDish, extras: updated });
                        }}
                        className="w-32 px-3 py-2 rounded-lg"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                        }}
                        placeholder="Narx"
                      />
                      <button onClick={() => setNewDish({ ...newDish, extras: newDish.extras.filter((_, i) => i !== idx) })}>
                        <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeAddDishModal}
                    disabled={Boolean(dishDeleteBusyId && editingDishId === dishDeleteBusyId)}
                    className="flex-1 px-4 py-3 rounded-xl font-bold disabled:opacity-50"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="button"
                    onClick={saveDish}
                    disabled={
                      saveDishSubmitting ||
                      uploadingImages ||
                      (Boolean(editingDishId) && dishDeleteBusyId === editingDishId)
                    }
                    className="flex-1 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: accentColor.color, color: '#ffffff' }}
                  >
                    {saveDishSubmitting && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                    Saqlash
                  </button>
                </div>
                {editingDishId ? (
                  <button
                    type="button"
                    onClick={() => void deleteDish(editingDishId, newDish.name)}
                    disabled={
                      saveDishSubmitting || uploadingImages || dishDeleteBusyId === editingDishId
                    }
                    className="w-full px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
                    }}
                  >
                    {dishDeleteBusyId === editingDishId ? (
                      <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    ) : (
                      <Trash2 className="w-5 h-5 shrink-0" />
                    )}
                    Taomni o‘chirish
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}