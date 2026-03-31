import { useState, useEffect } from 'react';
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
  Clock,
  DollarSign,
  Map,
  Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import PolygonMapPicker from './PolygonMapPicker';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

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

export default function DeliveryZones({ isDark, accentColor, branchInfo }: DeliveryZonesProps) {
  const [activeTab, setActiveTab] = useState<'zones' | 'stats' | 'couriers' | 'popular'>('zones');
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [showMapPicker, setShowMapPicker] = useState(false);

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Jami zonalar', value: zones.length.toString(), icon: Map, color: '#14b8a6' },
              { label: 'Faol zonalar', value: zones.filter(z => z.isActive).length.toString(), icon: MapPin, color: '#10b981' },
              { label: 'Bugungi buyurtmalar', value: '0', icon: TrendingUp, color: '#f59e0b' },
              { label: 'Jami kuryerlar', value: '0', icon: Users, color: '#3b82f6' },
            ].map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className="p-6 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl" style={{ background: `${stat.color}20` }}>
                      <Icon className="w-5 h-5" style={{ color: stat.color }} />
                    </div>
                    <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                      {stat.label}
                    </p>
                  </div>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
              );
            })}
          </div>

          <div
            className="p-12 rounded-2xl border text-center"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <BarChart3 className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color }} />
            <h3 className="text-xl font-bold mb-2">Statistika tez orada...</h3>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Batafsil statistika va grafiklar qo'shilmoqda
            </p>
          </div>
        </div>
      )}

      {/* Couriers Tab */}
      {activeTab === 'couriers' && (
        <div
          className="p-12 rounded-2xl border text-center"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <Users className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color }} />
          <h3 className="text-xl font-bold mb-2">Kuryerlar tez orada...</h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Faol kuryerlar va ularning holati ko'rsatiladi
          </p>
        </div>
      )}

      {/* Popular Tab */}
      {activeTab === 'popular' && (
        <div
          className="p-12 rounded-2xl border text-center"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <TrendingUp className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color }} />
          <h3 className="text-xl font-bold mb-2">Ko'p buyurtmalar tez orada...</h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Eng ko'p buyurtma berilgan zonalar ko'rsatiladi
          </p>
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