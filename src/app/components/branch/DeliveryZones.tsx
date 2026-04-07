import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  BarChart3,
  Users,
  TrendingUp,
  Map,
  RefreshCw,
  Bike,
  Package,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey, API_BASE_URL, DEV_API_BASE_URL } from '../../../../utils/supabase/info';
import PolygonMapPicker from './PolygonMapPicker';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import { buildBranchHeaders } from '../../utils/requestAuth';

interface DeliveryZone {
  id: string;
  branchId: string;
  name: string;
  coordinates: string; // JSON string of polygon coordinates
  polygon: { lat: number; lng: number }[];
  deliveryPrice: number;
  zoneIp: string;
  region: string;
  district: string;
  workingHours: string;
  deliveryTime: string; // in minutes
  minOrderAmount: number;
  isActive: boolean;
  createdAt: string;
}

interface DeliveryZonesProps {
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  branchInfo: any;
}

function branchApiBase(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return DEV_API_BASE_URL;
  }
  return API_BASE_URL;
}

interface DeliveryZonesAnalyticsSummary {
  zonesTotal: number;
  zonesActive: number;
  ordersToday: number;
  orders7d: number;
  orders30d: number;
  couriersTotal: number;
  couriersActive: number;
  couriersBusy: number;
}

interface DeliveryZonesZoneBreakdown {
  zoneId: string;
  zoneName: string;
  isActive: boolean;
  deliveryPrice: number;
  ordersToday: number;
  orders7d: number;
  orders30d: number;
}

interface DeliveryZonesCourierRow {
  id: string;
  name: string;
  phone: string;
  status: string;
  isAvailable: boolean;
  activeOrderId: string | null;
  totalDeliveries: number;
  completedDeliveries: number;
  lastActive: string;
  vehicleType: string;
  vehicleNumber: string;
  serviceZoneNames: string[];
}

interface DeliveryZonesAnalyticsPayload {
  success: boolean;
  summary?: DeliveryZonesAnalyticsSummary;
  zoneBreakdown?: DeliveryZonesZoneBreakdown[];
  couriers?: DeliveryZonesCourierRow[];
  error?: string;
}

function formatRelativeTime(iso: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'hozirgina';
  if (m < 60) return `${m} daq oldin`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  return `${d} kun oldin`;
}

export default function DeliveryZones({ isDark, accentColor, branchInfo }: DeliveryZonesProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'zones' | 'stats' | 'couriers' | 'popular'>('zones');
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [analytics, setAnalytics] = useState<DeliveryZonesAnalyticsPayload | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    coordinates: '',
    polygon: [] as { lat: number; lng: number }[],
    deliveryPrice: '',
    zoneIp: '',
    region: '',
    district: '',
    workingHours: '09:00-21:00',
    deliveryTime: '30',
    minOrderAmount: '5000',
  });
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadZones();
    loadRegions();
  }, [branchInfo?.id, visibilityRefetchTick]);

  const loadRegions = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/regions`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRegions(data.regions || []);
      }
    } catch (error) {
      console.error('Error loading regions:', error);
    }
  };

  const loadDistricts = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/districts`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setDistricts(data.districts || []);
      }
    } catch (error) {
      console.error('Error loading districts:', error);
    }
  };

  useEffect(() => {
    if (formData.region) {
      loadDistricts();
    } else {
      setDistricts([]);
      setFormData(prev => ({ ...prev, district: '' }));
    }
  }, [formData.region]);

  const loadZones = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-zones?branchId=${branchInfo.id}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setZones(data.zones || []);
      }
    } catch (error) {
      console.error('Error loading zones:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnalytics = useCallback(async () => {
    if (!branchInfo?.id) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch(`${branchApiBase()}/branch/delivery-zones-analytics`, {
        headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('branchSession');
        toast.error('Sessiya tugadi. Qayta kiring.');
        navigate('/filyal');
        return;
      }

      const data = (await res.json().catch(() => ({}))) as DeliveryZonesAnalyticsPayload;
      if (!res.ok || !data.success) {
        setAnalytics(null);
        setAnalyticsError(data.error || 'Ma’lumot yuklanmadi');
        return;
      }
      setAnalytics(data);
    } catch {
      setAnalytics(null);
      setAnalyticsError('Tarmoq xatosi');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [branchInfo?.id, navigate]);

  useEffect(() => {
    if (!branchInfo?.id) return;
    if (activeTab === 'stats' || activeTab === 'couriers' || activeTab === 'popular') {
      void loadAnalytics();
    }
  }, [branchInfo?.id, activeTab, visibilityRefetchTick, loadAnalytics]);

  const openModal = (zone?: DeliveryZone) => {
    if (zone) {
      setEditingZone(zone);
      setFormData({
        name: zone.name,
        coordinates: zone.coordinates,
        polygon: zone.polygon || [],
        deliveryPrice: zone.deliveryPrice.toString(),
        zoneIp: zone.zoneIp,
        region: zone.region,
        district: zone.district,
        workingHours: zone.workingHours,
        deliveryTime: zone.deliveryTime,
        minOrderAmount: zone.minOrderAmount.toString(),
      });
    } else {
      setEditingZone(null);
      setFormData({
        name: '',
        coordinates: '',
        polygon: [],
        deliveryPrice: '',
        zoneIp: '',
        region: '',
        district: '',
        workingHours: '09:00-21:00',
        deliveryTime: '30',
        minOrderAmount: '5000',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingZone(null);
  };

  const handleAddPolygonPoint = () => {
    const lat = parseFloat((document.getElementById('polygon-lat') as HTMLInputElement)?.value || '0');
    const lng = parseFloat((document.getElementById('polygon-lng') as HTMLInputElement)?.value || '0');
    
    if (lat && lng) {
      setFormData(prev => ({
        ...prev,
        polygon: [...prev.polygon, { lat, lng }]
      }));
      (document.getElementById('polygon-lat') as HTMLInputElement).value = '';
      (document.getElementById('polygon-lng') as HTMLInputElement).value = '';
      toast.success('Nuqta qo\'shildi');
    } else {
      toast.error('Koordinatalarni to\'g\'ri kiriting');
    }
  };

  const handleRemovePolygonPoint = (index: number) => {
    setFormData(prev => ({
      ...prev,
      polygon: prev.polygon.filter((_, i) => i !== index)
    }));
    toast.success('Nuqta o\'chirildi');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (zones.length >= 4 && !editingZone) {
      toast.error('Maksimal 4 ta zona qo\'shish mumkin');
      return;
    }

    if (!formData.name || !formData.deliveryPrice || !formData.zoneIp) {
      toast.error('Barcha maydonlarni to\'ldiring');
      return;
    }

    if (formData.polygon.length < 3) {
      toast.error('Kamida 3 ta nuqta qo\'shing (polygon)');
      return;
    }

    try {
      const zoneData = {
        branchId: branchInfo.id,
        name: formData.name,
        coordinates: JSON.stringify(formData.polygon),
        polygon: formData.polygon,
        deliveryPrice: parseFloat(formData.deliveryPrice),
        zoneIp: formData.zoneIp,
        region: formData.region,
        district: formData.district,
        workingHours: formData.workingHours,
        deliveryTime: formData.deliveryTime,
        minOrderAmount: parseFloat(formData.minOrderAmount),
        isActive: true,
      };

      const url = editingZone
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-zones/${editingZone.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-zones`;

      const response = await fetch(url, {
        method: editingZone ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(zoneData),
      });

      if (response.ok) {
        toast.success(editingZone ? 'Zona yangilandi' : 'Zona qo\'shildi');
        loadZones();
        closeModal();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error saving zone:', error);
      toast.error('Zona saqlashda xatolik');
    }
  };

  const handleDelete = async (zoneId: string) => {
    if (!confirm('Zonani o\'chirmoqchimisiz?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-zones/${zoneId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        toast.success('Zona o\'chirildi');
        loadZones();
      } else {
        toast.error('Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error deleting zone:', error);
      toast.error('Zona o\'chirishda xatolik');
    }
  };

  const tabs = [
    { id: 'zones' as const, label: 'Zonalar', icon: Map },
    { id: 'stats' as const, label: 'Statistika', icon: BarChart3 },
    { id: 'couriers' as const, label: 'Faol kuryerlar', icon: Users },
    { id: 'popular' as const, label: 'Ko\'p buyurtmalar', icon: TrendingUp },
  ];

  const filteredDistricts = districts.filter((d: any) => d.regionId === formData.region);

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap"
              style={{
                background: isActive ? accentColor.gradient : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                color: isActive ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'),
              }}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium text-sm">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Zones Tab */}
      {activeTab === 'zones' && (
        <div className="space-y-4">
          {/* Add Zone Button */}
          <button
            onClick={() => openModal()}
            disabled={zones.length >= 4}
            className="w-full px-6 py-4 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: zones.length >= 4 ? (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)') : accentColor.gradient,
              color: '#ffffff',
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              <span>
                {zones.length >= 4 ? 'Maksimal zona soni to\'ldi (4/4)' : `Zona qo'shish (${zones.length}/4)`}
              </span>
            </div>
          </button>

          {/* Zones List */}
          {isLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="p-6 rounded-2xl border animate-pulse"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div className="h-6 bg-gray-300 rounded mb-3" style={{ width: '40%' }} />
                  <div className="h-4 bg-gray-300 rounded mb-2" style={{ width: '60%' }} />
                  <div className="h-4 bg-gray-300 rounded" style={{ width: '50%' }} />
                </div>
              ))}
            </div>
          ) : zones.length === 0 ? (
            <div
              className="p-12 rounded-2xl border text-center"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="inline-flex p-4 rounded-2xl mb-4" style={{ background: `${accentColor.color}20` }}>
                <MapPin className="w-8 h-8" style={{ color: accentColor.color }} />
              </div>
              <h3 className="text-lg font-bold mb-2">Zonalar yo'q</h3>
              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                Yetkazib berish zonasini qo'shish uchun yuqoridagi tugmani bosing
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {zones.map(zone => (
                <div
                  key={zone.id}
                  className="p-6 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{zone.name}</h3>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-1 rounded-lg text-xs font-semibold"
                          style={{
                            background: zone.isActive ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: zone.isActive ? '#34d399' : '#ef4444',
                          }}
                        >
                          {zone.isActive ? '🟢 Faol' : '🔴 Nofaol'}
                        </span>
                        <span
                          className="px-2 py-1 rounded-lg text-xs"
                          style={{
                            background: `${accentColor.color}20`,
                            color: accentColor.color,
                          }}
                        >
                          IP: {zone.zoneIp}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openModal(zone)}
                        className="p-2 rounded-xl transition-all active:scale-95"
                        style={{
                          background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                          color: '#3b82f6',
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(zone.id)}
                        className="p-2 rounded-xl transition-all active:scale-95"
                        style={{
                          background: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        💰 Yetkazib berish
                      </p>
                      <p className="font-semibold">{zone.deliveryPrice.toLocaleString()} so'm</p>
                    </div>
                    <div>
                      <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        📍 Hudud
                      </p>
                      <p className="font-semibold">{zone.region}, {zone.district}</p>
                    </div>
                    <div>
                      <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        ⏰ Ish vaqti
                      </p>
                      <p className="font-semibold">{zone.workingHours}</p>
                    </div>
                    <div>
                      <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        🚚 Yetkazish vaqti
                      </p>
                      <p className="font-semibold">{zone.deliveryTime} daqiqa</p>
                    </div>
                    <div className="col-span-2">
                      <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        💵 Minimal buyurtma
                      </p>
                      <p className="font-semibold">{zone.minOrderAmount.toLocaleString()} so'm</p>
                    </div>
                    <div className="col-span-2">
                      <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        📐 Polygon nuqtalari
                      </p>
                      <p className="font-semibold">{zone.polygon?.length || 0} ta nuqta</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Yetkazish statistikasi</h2>
              <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                Buyurtmalar (market / shop / food / restaurant), bekor qilinmagan
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAnalytics()}
              disabled={analyticsLoading}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
              }}
            >
              <RefreshCw className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
              Yangilash
            </button>
          </div>

          {analyticsError && (
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'rgba(239,68,68,0.35)',
                background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                color: isDark ? '#fecaca' : '#991b1b',
              }}
            >
              {analyticsError}
            </div>
          )}

          {analyticsLoading && !analytics?.summary ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  }}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {(
                  [
                    {
                      label: 'Jami zonalar',
                      value: analytics?.summary?.zonesTotal ?? zones.length,
                      icon: Map,
                      color: '#14b8a6',
                    },
                    {
                      label: 'Faol zonalar',
                      value: analytics?.summary?.zonesActive ?? zones.filter(z => z.isActive).length,
                      icon: MapPin,
                      color: '#10b981',
                    },
                    {
                      label: 'Bugun',
                      value: analytics?.summary?.ordersToday ?? '—',
                      icon: Package,
                      color: '#f59e0b',
                    },
                    {
                      label: '7 kun',
                      value: analytics?.summary?.orders7d ?? '—',
                      icon: BarChart3,
                      color: '#a855f7',
                    },
                    {
                      label: '30 kun',
                      value: analytics?.summary?.orders30d ?? '—',
                      icon: TrendingUp,
                      color: '#ec4899',
                    },
                    {
                      label: 'Jami kuryerlar',
                      value: analytics?.summary?.couriersTotal ?? '—',
                      icon: Users,
                      color: '#3b82f6',
                    },
                    {
                      label: 'Faol holat',
                      value: analytics?.summary?.couriersActive ?? '—',
                      icon: Activity,
                      color: '#22c55e',
                    },
                    {
                      label: 'Band kuryerlar',
                      value: analytics?.summary?.couriersBusy ?? '—',
                      icon: Bike,
                      color: '#f97316',
                    },
                  ] as const
                ).map((stat, index) => {
                  const Icon = stat.icon;
                  const v =
                    typeof stat.value === 'number' ? stat.value.toLocaleString() : String(stat.value);
                  return (
                    <div
                      key={index}
                      className="rounded-2xl border p-4 sm:p-5"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <div className="rounded-lg p-1.5" style={{ background: `${stat.color}22` }}>
                          <Icon className="h-4 w-4" style={{ color: stat.color }} />
                        </div>
                        <span
                          className="text-xs font-medium sm:text-sm"
                          style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}
                        >
                          {stat.label}
                        </span>
                      </div>
                      <p className="text-2xl font-bold tabular-nums sm:text-3xl">{v}</p>
                    </div>
                  );
                })}
              </div>

              <div
                className="rounded-2xl border p-4 sm:p-6"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <h3 className="mb-1 text-base font-bold">Zonalar bo‘yicha (30 kun)</h3>
                <p
                  className="mb-4 text-sm"
                  style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
                >
                  Eng yuqori hajm — kengaytirilgan bar
                </p>
                {(() => {
                  const rows = analytics?.zoneBreakdown?.length
                    ? analytics.zoneBreakdown
                    : zones.map(z => ({
                        zoneId: z.id,
                        zoneName: z.name,
                        isActive: z.isActive,
                        deliveryPrice: z.deliveryPrice,
                        ordersToday: 0,
                        orders7d: 0,
                        orders30d: 0,
                      }));
                  const max30 = Math.max(1, ...rows.map(r => r.orders30d));
                  if (rows.length === 0) {
                    return (
                      <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                        Zona ma’lumoti yo‘q
                      </p>
                    );
                  }
                  return (
                    <ul className="space-y-3">
                      {rows.map(z => (
                        <li key={z.zoneId} className="space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="font-semibold">{z.zoneName}</span>
                            <span
                              className="tabular-nums text-xs font-medium"
                              style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}
                            >
                              bugun {z.ordersToday} · 7k {z.orders7d} · 30k {z.orders30d}
                            </span>
                          </div>
                          <div
                            className="h-2.5 overflow-hidden rounded-full"
                            style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(z.orders30d / max30) * 100}%`,
                                background: accentColor.gradient,
                                minWidth: z.orders30d > 0 ? '4px' : 0,
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* Couriers Tab */}
      {activeTab === 'couriers' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Kuryerlar</h2>
              <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                Filialga biriktirilgan kuryerlar
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAnalytics()}
              disabled={analyticsLoading}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
              }}
            >
              <RefreshCw className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
              Yangilash
            </button>
          </div>

          {analyticsError && (
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'rgba(239,68,68,0.35)',
                background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                color: isDark ? '#fecaca' : '#991b1b',
              }}
            >
              {analyticsError}
            </div>
          )}

          {analyticsLoading && !analytics?.couriers ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  }}
                />
              ))}
            </div>
          ) : !analytics?.couriers?.length ? (
            <div
              className="rounded-2xl border p-10 text-center"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <Bike className="mx-auto mb-3 h-12 w-12 opacity-40" style={{ color: accentColor.color }} />
              <p className="font-semibold">Hozircha kuryer yo‘q</p>
              <p className="mt-1 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                Admin panel orqali filialga kuryer biriktirilganda shu yerda ko‘rinadi
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {analytics.couriers.map(c => {
                const st = String(c.status || '').toLowerCase();
                const busy = Boolean(c.activeOrderId) || st === 'busy';
                const active = st === 'active' || busy;
                const statusLabel =
                  busy ? 'Band' : st === 'active' ? 'Faol' : st === 'offline' ? 'Oflayn' : c.status || 'Noma’lum';
                const statusBg = busy
                  ? 'rgba(249,115,22,0.2)'
                  : active
                    ? 'rgba(34,197,94,0.2)'
                    : 'rgba(148,163,184,0.25)';
                const statusColor = busy ? '#fb923c' : active ? '#4ade80' : '#94a3b8';
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border p-4 sm:p-5"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{c.name || 'Ismsiz'}</p>
                        {c.phone ? (
                          <a
                            href={`tel:${c.phone.replace(/\s/g, '')}`}
                            className="mt-0.5 block truncate text-sm"
                            style={{ color: accentColor.color }}
                          >
                            {c.phone}
                          </a>
                        ) : null}
                      </div>
                      <span
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold"
                        style={{ background: statusBg, color: statusColor }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:text-sm">
                      <div>
                        <p style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Yakunlangan</p>
                        <p className="font-semibold tabular-nums">{c.completedDeliveries}</p>
                      </div>
                      <div>
                        <p style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Jami yetkazish</p>
                        <p className="font-semibold tabular-nums">{c.totalDeliveries}</p>
                      </div>
                      <div className="col-span-2">
                        <p style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Oxirgi faollik</p>
                        <p className="font-medium">{formatRelativeTime(c.lastActive)}</p>
                      </div>
                      {(c.vehicleType || c.vehicleNumber) && (
                        <div className="col-span-2">
                          <p style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Transport</p>
                          <p className="font-medium">
                            {[c.vehicleType, c.vehicleNumber].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      )}
                      {c.serviceZoneNames?.length ? (
                        <div className="col-span-2">
                          <p style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Zonalar</p>
                          <p className="font-medium">{c.serviceZoneNames.slice(0, 4).join(', ')}</p>
                        </div>
                      ) : null}
                    </div>
                    {c.activeOrderId ? (
                      <div
                        className="mt-3 rounded-xl border px-3 py-2 text-xs"
                        style={{
                          borderColor: `${accentColor.color}40`,
                          background: `${accentColor.color}14`,
                        }}
                      >
                        <span className="font-semibold" style={{ color: accentColor.color }}>
                          Buyurtma:{' '}
                        </span>
                        {c.activeOrderId}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Popular Tab */}
      {activeTab === 'popular' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Eng ko‘p buyurtma — zonalar</h2>
              <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                30 kunlik hajm bo‘yicha tartib (yuqoridan pastga)
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAnalytics()}
              disabled={analyticsLoading}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
              }}
            >
              <RefreshCw className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
              Yangilash
            </button>
          </div>

          {analyticsError && (
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'rgba(239,68,68,0.35)',
                background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                color: isDark ? '#fecaca' : '#991b1b',
              }}
            >
              {analyticsError}
            </div>
          )}

          {analyticsLoading && !analytics?.zoneBreakdown ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  }}
                />
              ))}
            </div>
          ) : (
            (() => {
              const rows = analytics?.zoneBreakdown ?? [];
              const max30 = Math.max(1, ...rows.map(r => r.orders30d));
              if (!rows.length) {
                return (
                  <div
                    className="rounded-2xl border p-10 text-center"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    <TrendingUp className="mx-auto mb-3 h-12 w-12 opacity-40" style={{ color: accentColor.color }} />
                    <p className="font-semibold">Zonalar bo‘yicha ma’lumot yo‘q</p>
                  </div>
                );
              }
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <ul className="space-y-3">
                  {rows.map((z, idx) => (
                    <li
                      key={z.zoneId}
                      className="space-y-3 rounded-2xl border p-4 sm:p-5"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="text-2xl tabular-nums">{medals[idx] ?? `#${idx + 1}`}</span>
                          <div className="min-w-0">
                            <p className="truncate font-bold">{z.zoneName}</p>
                            <p
                              className="text-xs"
                              style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
                            >
                              {z.zoneId === '_none'
                                ? 'Buyurtmada zona ko‘rsatilmagan'
                                : z.isActive
                                  ? 'Faol zona'
                                  : 'Nofaol'}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                          <p
                            className="text-2xl font-bold tabular-nums leading-none"
                            style={{ color: accentColor.color }}
                          >
                            {z.orders30d}
                          </p>
                          <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                            30 kun
                          </p>
                          <div
                            className="flex gap-2 text-xs font-medium tabular-nums"
                            style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}
                          >
                            <span>bugun {z.ordersToday}</span>
                            <span>·</span>
                            <span>7k {z.orders7d}</span>
                          </div>
                        </div>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full"
                        style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(z.orders30d / max30) * 100}%`,
                            background: accentColor.gradient,
                            minWidth: z.orders30d > 0 ? '4px' : 0,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={closeModal}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">
                {editingZone ? 'Zonani tahrirlash' : 'Yangi zona qo\'shish'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl transition-all active:scale-95"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Zona nomi *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Masalan: Shahar ichi"
                    required
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Zona IP *</label>
                  <input
                    type="text"
                    value={formData.zoneIp}
                    onChange={e => setFormData({ ...formData, zoneIp: e.target.value })}
                    placeholder="Masalan: 192.168.1.1"
                    required
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    Kuryer bu IP orqali buyurtmalarni oladi
                  </p>
                </div>
              </div>

              {/* Region & District */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Viloyat *</label>
                  <select
                    value={formData.region}
                    onChange={e => setFormData({ ...formData, region: e.target.value, district: '' })}
                    required
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <option value="">Viloyatni tanlang</option>
                    {regions.map(region => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tuman *</label>
                  <select
                    value={formData.district}
                    onChange={e => setFormData({ ...formData, district: e.target.value })}
                    disabled={!formData.region}
                    required
                    className="w-full px-4 py-3 rounded-xl border outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <option value="">Tumanni tanlang</option>
                    {filteredDistricts.map((district: any) => (
                      <option key={district.id} value={district.id}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Yetkazib berish narxi (so'm) *</label>
                  <input
                    type="number"
                    value={formData.deliveryPrice}
                    onChange={e => setFormData({ ...formData, deliveryPrice: e.target.value })}
                    placeholder="Masalan: 5000"
                    required
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Yetkazib berish vaqti (daqiqa) *</label>
                  <input
                    type="number"
                    value={formData.deliveryTime}
                    onChange={e => setFormData({ ...formData, deliveryTime: e.target.value })}
                    placeholder="Masalan: 30"
                    required
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Minimal buyurtma (so'm) *</label>
                  <input
                    type="number"
                    value={formData.minOrderAmount}
                    onChange={e => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    placeholder="Masalan: 5000"
                    required
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
              </div>

              {/* Working Hours */}
              <div>
                <label className="block text-sm font-medium mb-2">Ish vaqti *</label>
                <input
                  type="text"
                  value={formData.workingHours}
                  onChange={e => setFormData({ ...formData, workingHours: e.target.value })}
                  placeholder="Masalan: 09:00-21:00"
                  required
                  className="w-full px-4 py-3 rounded-xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>

              {/* Polygon */}
              <div>
                <label className="block text-sm font-medium mb-2">Polygon (hudud chegarasi) *</label>
                <p className="text-sm mb-3" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Kamida 3 ta nuqta qo'shing. Har bir nuqta kenglik (latitude) va uzunlik (longitude) koordinatalaridan iborat.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="px-4 py-3 rounded-xl font-semibold transition-all active:scale-95"
                    style={{
                      background: accentColor.gradient,
                      color: '#ffffff',
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Map className="w-5 h-5" />
                      <span>🗺️ Haritadan tanlash</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddPolygonPoint}
                    className="px-4 py-3 rounded-xl font-medium transition-all active:scale-95"
                    style={{
                      background: `${accentColor.color}20`,
                      color: accentColor.color,
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" />
                      <span>Nuqta qo'shish</span>
                    </div>
                  </button>
                </div>

                {formData.polygon.length > 0 && (
                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.01)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <p className="text-sm font-medium mb-2">
                      Qo'shilgan nuqtalar ({formData.polygon.length})
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {formData.polygon.map((point, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 rounded-lg"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          }}
                        >
                          <span className="text-sm">
                            {index + 1}. Lat: {point.lat}, Lng: {point.lng}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePolygonPoint(index)}
                            className="p-1 rounded-lg transition-all active:scale-95"
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#ef4444',
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formData.polygon.length < 3 && (
                  <p className="text-sm mt-2" style={{ color: '#f59e0b' }}>
                    ⚠️ Polygon yaratish uchun kamida 3 ta nuqta kerak
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all active:scale-95"
                  style={{
                    background: accentColor.gradient,
                    color: '#ffffff',
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Save className="w-5 h-5" />
                    <span>{editingZone ? 'Saqlash' : 'Qo\'shish'}</span>
                  </div>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map Picker */}
      {showMapPicker && (
        <PolygonMapPicker
          isDark={isDark}
          accentColor={accentColor}
          initialPolygon={formData.polygon}
          onSave={(polygon) => {
            setFormData(prev => ({ ...prev, polygon }));
            setShowMapPicker(false);
            toast.success(`${polygon.length} ta nuqta haritadan qo'shildi!`);
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
}