import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  Bike, 
  Plus, 
  Edit2, 
  Trash2, 
  Phone, 
  MapPin, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Star,
  TrendingUp,
  Users,
  Package,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Save,
  Key,
  X,
  Smartphone,
  Navigation,
  Activity,
  Award,
  Target
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { CourierBagsPanel } from './CourierBagsPanel';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface Courier {
  id: string;
  branchId: string;
  name: string;
  phone: string;
  email: string;
  login?: string;
  pin?: string;
  vehicleType: 'bike' | 'car' | 'foot';
  vehicleNumber: string;
  status: 'active' | 'inactive' | 'busy' | 'offline';
  isAvailable?: boolean;
  serviceRadiusKm?: number;
  serviceZoneName?: string;
  serviceIp?: string;
  activeOrderId?: string | null;
  rating: number;
  totalDeliveries: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  averageDeliveryTime: number;
  totalEarnings: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  workingHours: {
    start: string;
    end: string;
  };
  joinedAt: string;
  lastActive: string;
  documents: {
    driverLicense: string;
    vehicleRegistration: string;
    insurance: string;
  };
}

interface CouriersProps {
  branchId: string;
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
  };
}

interface DeliveryZoneOption {
  id: string;
  name: string;
  zoneIp?: string;
  isActive?: boolean;
}

export function Couriers({ branchId, branchInfo }: CouriersProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingCourier, setIsAddingCourier] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZoneOption[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    login: '',
    pin: '',
    vehicleType: 'bike' as 'bike' | 'car' | 'foot',
    vehicleNumber: '',
    serviceRadiusKm: 5,
    serviceZoneIds: [] as string[],
    serviceZoneNames: [] as string[],
    serviceIps: [] as string[],
    serviceZoneName: '',
    serviceIp: '',
    workingHours: {
      start: '09:00',
      end: '18:00'
    }
  });
  const visibilityRefetchTick = useVisibilityTick();

  const loadCouriers = async () => {
    try {
      setIsLoading(true);
      console.log('🚚 Loading couriers for branch:', branchId);

      const params = new URLSearchParams({
        branchId,
        status: statusFilter !== 'all' ? statusFilter : '',
        search: searchTerm
      });

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/couriers?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        setCouriers([]);
        console.error('❌ Couriers API response not ok:', response.status, response.statusText);
        toast.error('Kuryerlarni yuklashda xatolik');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setCouriers(data.couriers);
        console.log('✅ Couriers loaded from API');
      }
    } catch (error) {
      console.error('❌ Error loading couriers:', error);
      toast.error('Kuryerlarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDeliveryZones = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-zones?branchId=${encodeURIComponent(branchId)}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) {
        setDeliveryZones([]);
        return;
      }
      const data = await response.json();
      const zones = Array.isArray(data.zones) ? data.zones : [];
      setDeliveryZones(
        zones
          .filter((z: any) => z && z.id && z.isActive !== false)
          .map((z: any) => ({
            id: String(z.id),
            name: String(z.name || z.id),
            zoneIp: String(z.zoneIp || '').trim(),
            isActive: z.isActive !== false,
          }))
      );
    } catch {
      setDeliveryZones([]);
    }
  };

  useEffect(() => {
    loadCouriers();
    loadDeliveryZones();
  }, [branchId, statusFilter, searchTerm, visibilityRefetchTick]);

  const handleAddCourier = async () => {
    try {
      console.log('➕ Adding new courier...');
      if (!formData.serviceZoneIds.length) {
        toast.error('Kamida bitta yetkazib berish zonasini tanlang');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/couriers`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            branchId
          })
        }
      );

      if (!response.ok) {
        throw new Error('Kuryerni qo\'shishda xatolik');
      }

      setIsAddingCourier(false);
      setFormData({
        name: '',
        phone: '',
        email: '',
        login: '',
        pin: '',
        vehicleType: 'bike',
        vehicleNumber: '',
        serviceRadiusKm: 5,
        serviceZoneIds: [],
        serviceZoneNames: [],
        serviceIps: [],
        serviceZoneName: '',
        serviceIp: '',
        workingHours: {
          start: '09:00',
          end: '18:00'
        }
      });
      
      toast.success('Kuryer muvaffaqiyatli qo\'shildi');
      loadCouriers();
    } catch (error) {
      console.error('❌ Error adding courier:', error);
      toast.error('Kuryerni qo\'shishda xatolik');
    }
  };

  const handleUpdateCourier = async () => {
    try {
      if (!editingCourier) return;

      console.log('✏️ Updating courier...');
      if (!formData.serviceZoneIds.length) {
        toast.error('Kamida bitta yetkazib berish zonasini tanlang');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/couriers/${editingCourier.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData)
        }
      );

      if (!response.ok) {
        throw new Error('Kuryerni yangilashda xatolik');
      }

      setEditingCourier(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        login: '',
        pin: '',
        vehicleType: 'bike',
        vehicleNumber: '',
        serviceRadiusKm: 5,
        serviceZoneIds: [],
        serviceZoneNames: [],
        serviceIps: [],
        serviceZoneName: '',
        serviceIp: '',
        workingHours: {
          start: '09:00',
          end: '18:00'
        }
      });
      
      toast.success('Kuryer muvaffaqiyatli yangilandi');
      loadCouriers();
    } catch (error) {
      console.error('❌ Error updating courier:', error);
      toast.error('Kuryerni yangilashda xatolik');
    }
  };

  const handleDeleteCourier = async (id: string) => {
    if (!confirm('Rostdan ham bu kuryerni o\'chirmoqchimisiz?')) return;

    const prevCouriers = couriers;
    setCouriers((prev) => prev.filter((c) => c.id !== id));

    try {
      console.log('🗑️ Deleting courier:', id);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/couriers/${id}?branchId=${branchId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Kuryerni o\'chirishda xatolik');
      }
      
      toast.success('Kuryer muvaffaqiyatli o\'chirildi');
    } catch (error) {
      console.error('❌ Error deleting courier:', error);
      setCouriers(prevCouriers);
      toast.error('Kuryerni o\'chirishda xatolik');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'busy': return '#f59e0b';
      case 'inactive': return '#6b7280';
      case 'offline': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Faol';
      case 'busy': return 'Band';
      case 'inactive': return 'Nofaol';
      case 'offline': return 'Oflayn';
      default: return status;
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'bike': return Bike;
      case 'car': return Navigation;
      case 'foot': return Users;
      default: return Bike;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: accentColor.color }} />
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Kuryerlar yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CourierBagsPanel
        branchId={branchId}
        couriers={couriers.map((courier) => ({
          id: courier.id,
          name: courier.name,
          status: courier.status,
        }))}
        mode="assignOnly"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Kuryerlar</h1>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Filial kuryerlarini boshqarish
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingCourier(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all"
            style={{
              background: accentColor.gradient,
              color: '#ffffff'
            }}
          >
            <Plus className="w-4 h-4" />
            Yangi kuryer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} />
            <input
              type="text"
              placeholder="Kuryer nomi yoki telefon raqami..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border outline-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border outline-none"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <option value="all">Barchasi</option>
          <option value="active">Faol</option>
          <option value="busy">Band</option>
          <option value="inactive">Nofaol</option>
          <option value="offline">Oflayn</option>
        </select>
        <button
          onClick={loadCouriers}
          className="p-2 rounded-xl border transition-all hover:shadow-lg"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Couriers List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {couriers.map((courier) => {
          const VehicleIcon = getVehicleIcon(courier.vehicleType);
          
          return (
            <div 
              key={courier.id}
              className="p-6 rounded-2xl border transition-all hover:shadow-lg cursor-pointer"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
              onClick={() => setShowDetails(courier.id)}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-3 rounded-xl"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <VehicleIcon className="w-6 h-6" style={{ color: accentColor.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{courier.name}</h3>
                    <p className="text-sm" style={{ 
                      color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                    }}>
                      {courier.vehicleType === 'bike' ? 'Mototsikl' : 
                       courier.vehicleType === 'car' ? 'Mashina' : 'Piyoda'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="px-2 py-1 rounded-lg text-xs font-medium"
                    style={{
                      background: `${getStatusColor(courier.status)}20`,
                      color: getStatusColor(courier.status)
                    }}
                  >
                    {getStatusText(courier.status)}
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span className="text-sm">{courier.phone}</span>
                </div>
                {courier.currentLocation && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span className="text-sm truncate">{courier.currentLocation.address}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <p className="text-lg font-bold" style={{ color: accentColor.color }}>
                    {courier.completedDeliveries}
                  </p>
                  <p className="text-xs" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Yetkazilgan
                  </p>
                </div>
                <div className="text-center p-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <p className="text-lg font-bold" style={{ color: accentColor.color }}>
                    {courier.rating}
                  </p>
                  <p className="text-xs" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Reyting
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCourier(courier);
                    setFormData({
                      name: courier.name,
                      phone: courier.phone,
                      email: courier.email,
                      login: courier.login || '',
                      pin: courier.pin || '',
                      vehicleType: courier.vehicleType,
                      vehicleNumber: courier.vehicleNumber,
                      serviceRadiusKm: courier.serviceRadiusKm || 5,
                      serviceZoneIds: Array.isArray((courier as any).serviceZoneIds) ? (courier as any).serviceZoneIds : (courier.serviceZoneName ? [courier.serviceZoneName] : []),
                      serviceZoneNames: Array.isArray((courier as any).serviceZoneNames) ? (courier as any).serviceZoneNames : (courier.serviceZoneName ? [courier.serviceZoneName] : []),
                      serviceIps: Array.isArray((courier as any).serviceIps) ? (courier as any).serviceIps : (courier.serviceIp ? [courier.serviceIp] : []),
                      serviceZoneName: courier.serviceZoneName || '',
                      serviceIp: courier.serviceIp || '',
                      workingHours: courier.workingHours
                    });
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border text-sm transition-all hover:shadow-lg"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <Edit2 className="w-4 h-4" />
                  Tahrirlash
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCourier(courier.id);
                  }}
                  className="p-2 rounded-lg border text-red-500 transition-all hover:shadow-lg"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Courier Modal */}
      {(isAddingCourier || editingCourier) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div 
            className="w-full max-w-md p-6 rounded-2xl"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
            }}
          >
            <h2 className="text-xl font-bold mb-4">
              {editingCourier ? 'Kuryerni tahrirlash' : 'Yangi kuryer qo\'shish'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ism Familiya *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                  placeholder="Ism Familiya"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Telefon *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                  placeholder="+998 90 123 45 67"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Login *</label>
                <input
                  type="text"
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                  placeholder="kuryer_login"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">PIN *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                  placeholder="1234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Transport turi *</label>
                <select
                  value={formData.vehicleType}
                  onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value as 'bike' | 'car' | 'foot' })}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <option value="bike">Mototsikl</option>
                  <option value="car">Mashina</option>
                  <option value="foot">Piyoda</option>
                </select>
              </div>

              {formData.vehicleType !== 'foot' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Transport raqami *</label>
                  <input
                    type="text"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                    placeholder="01 AA 123"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Radius (km)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.serviceRadiusKm}
                    onChange={(e) => setFormData({ ...formData, serviceRadiusKm: Number(e.target.value) || 5 })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ish boshlanishi</label>
                  <input
                    type="time"
                    value={formData.workingHours.start}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      workingHours: { ...formData.workingHours, start: e.target.value }
                    })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ish tugashi</label>
                  <input
                    type="time"
                    value={formData.workingHours.end}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      workingHours: { ...formData.workingHours, end: e.target.value }
                    })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Xizmat zonasi</label>
                  <div className="rounded-xl border p-2 space-y-1.5 max-h-36 overflow-y-auto"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    {deliveryZones.length === 0 ? (
                      <p className="text-sm opacity-70 px-1 py-1">Yetkazib berish zonalari topilmadi</p>
                    ) : (
                      deliveryZones.map((zone) => {
                        const checked = formData.serviceZoneIds.includes(zone.id);
                        return (
                          <label key={zone.id} className="flex items-center justify-between gap-2 px-1 py-1 cursor-pointer">
                            <span className="text-sm">{zone.name}</span>
                            <span className="text-xs opacity-70">{zone.zoneIp || '-'}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const nextIds = e.target.checked
                                  ? [...formData.serviceZoneIds, zone.id]
                                  : formData.serviceZoneIds.filter((id) => id !== zone.id);
                                const selectedZones = deliveryZones.filter((z) => nextIds.includes(z.id));
                                setFormData({
                                  ...formData,
                                  serviceZoneIds: nextIds,
                                  serviceZoneNames: selectedZones.map((z) => z.name),
                                  serviceIps: selectedZones.map((z) => z.zoneIp || '').filter(Boolean),
                                  serviceZoneName: selectedZones.map((z) => z.name).join(', '),
                                  serviceIp: selectedZones.map((z) => z.zoneIp || '').filter(Boolean).join(', '),
                                });
                              }}
                            />
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={editingCourier ? handleUpdateCourier : handleAddCourier}
                className="flex-1 py-2 rounded-xl font-medium transition-all"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff'
                }}
              >
                {editingCourier ? 'Yangilash' : 'Qo\'shish'}
              </button>
              <button
                onClick={() => {
                  setIsAddingCourier(false);
                  setEditingCourier(null);
                  setFormData({
                    name: '',
                    phone: '',
                    email: '',
                    login: '',
                    pin: '',
                    vehicleType: 'bike',
                    vehicleNumber: '',
                    serviceRadiusKm: 5,
                    serviceZoneIds: [],
                    serviceZoneNames: [],
                    serviceIps: [],
                    serviceZoneName: '',
                    serviceIp: '',
                    workingHours: {
                      start: '09:00',
                      end: '18:00'
                    }
                  });
                }}
                className="flex-1 py-2 rounded-xl border font-medium transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div 
            className="w-full max-w-2xl p-6 rounded-2xl max-h-[80vh] overflow-y-auto"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
            }}
          >
            {(() => {
              const courier = couriers.find(c => c.id === showDetails);
              if (!courier) return null;
              
              const VehicleIcon = getVehicleIcon(courier.vehicleType);
              
              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">{courier.name}</h2>
                    <button
                      onClick={() => setShowDetails(null)}
                      className="p-2 rounded-lg border"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div>
                      <h3 className="font-semibold mb-3">Asosiy ma'lumotlar</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" style={{ color: accentColor.color }} />
                          <span>{courier.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4" style={{ color: accentColor.color }} />
                          <span>{courier.email}</span>
                        </div>
                        {courier.login && (
                          <div className="flex items-center gap-2">
                            <Key className="w-4 h-4" style={{ color: accentColor.color }} />
                            <span>{courier.login} / PIN: {courier.pin || '----'}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <VehicleIcon className="w-4 h-4" style={{ color: accentColor.color }} />
                          <span>
                            {courier.vehicleType === 'bike' ? 'Mototsikl' : 
                             courier.vehicleType === 'car' ? 'Mashina' : 'Piyoda'}
                            {courier.vehicleNumber && ` (${courier.vehicleNumber})`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" style={{ color: accentColor.color }} />
                          <span>{courier.workingHours.start} - {courier.workingHours.end}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" style={{ color: accentColor.color }} />
                          <span>{(courier as any).serviceZoneNames?.length ? (courier as any).serviceZoneNames.join(', ') : (courier.serviceZoneName || 'Zona kiritilmagan')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Navigation className="w-4 h-4" style={{ color: accentColor.color }} />
                          <span>{(courier as any).serviceIps?.length ? (courier as any).serviceIps.join(', ') : (courier.serviceIp || 'IP kiritilmagan')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" style={{ color: accentColor.color }} />
                          <span>Qo'shilgan: {new Date(courier.joinedAt).toLocaleDateString('uz-UZ')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div>
                      <h3 className="font-semibold mb-3">Statistika</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Radius:</span>
                          <span className="font-bold">{courier.serviceRadiusKm || 5} km</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Jami yetkazmalar:</span>
                          <span className="font-bold">{courier.totalDeliveries}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Muvaffaqiyatli:</span>
                          <span className="font-bold text-green-500">{courier.completedDeliveries}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bekor qilingan:</span>
                          <span className="font-bold text-red-500">{courier.cancelledDeliveries}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>O'rtacha vaqt:</span>
                          <span className="font-bold">{courier.averageDeliveryTime} daqiqa</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Jami daromad:</span>
                          <span className="font-bold">{formatCurrency(courier.totalEarnings)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Reyting:</span>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span className="font-bold">{courier.rating}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  {courier.currentLocation && (
                    <div className="mt-6">
                      <h3 className="font-semibold mb-3">Joriy joylashuv</h3>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" style={{ color: accentColor.color }} />
                        <span>{courier.currentLocation.address}</span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
