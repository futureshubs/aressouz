// Preparers Management - Admin Panel
// Tayyorlovchilar boshqaruvi - Admin panel

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { 
  X, Plus, Edit2, Trash2, User, Phone, MapPin, Clock, 
  DollarSign, Key, Lock, ChevronRight, Image as ImageIcon, Loader2,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { useVisibilityTick } from '../utils/visibilityRefetch';

interface Preparer {
  id: string;
  name: string;
  phone: string;
  address: string;
  zones: string[];
  region: string;
  district: string;
  workTime: string;
  salary: number;
  login: string;
  password?: string;
  image: string | null;
  status: string;
  createdAt: string;
}

interface Zone {
  id: string;
  name: string;
  region: string;
  district: string;
}

interface Region {
  name: string;
  districts: string[];
}

// Regions data - moved outside component to avoid re-creation
const REGIONS: Region[] = [
  {
    name: 'Andijon',
    districts: ['Andijon shahri', 'Asaka', 'Baliqchi', 'Bo\'z', 'Buloqboshi', 'Izboskan', 'Jalolquduq', 'Xo\'jaobod', 'Qo\'rg\'ontepa', 'Marhamat', 'Oltinko\'l', 'Paxtaobod', 'Shahrixon', 'Ulug\'nor']
  },
  {
    name: 'Toshkent',
    districts: ['Bekobod', 'Bo\'ka', 'Bo\'stonliq', 'Chinoz', 'O\'rta Chirchiq', 'Ohangaron', 'Oqqo\'rg\'on', 'Parkent', 'Piskent', 'Qibray', 'Quyichirchiq', 'Toshkent tumani', 'Yangiyo\'l', 'Yuqori Chirchiq', 'Zangiota']
  },
  // Add more regions...
];

export default function PrepareManager() {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [preparers, setPreparers] = useState<Preparer[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deletingPreparerId, setDeletingPreparerId] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    zones: [] as string[],
    region: '',
    district: '',
    workTime: '09:00-18:00',
    salary: 0,
    login: '',
    password: '',
    image: null as string | null,
  });
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadPreparers();
    loadZones();
  }, [visibilityRefetchTick]);

  const loadPreparers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/preparers`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📥 Preparers data received:', data);
        
        // Filter out invalid preparers (without ID or name)
        const validPreparers = (data.preparers || []).filter((p: any) => {
          const isValid = p && p.id && p.name && p.login;
          if (!isValid) {
            console.warn('⚠️ Invalid preparer found (skipping):', p);
          }
          return isValid;
        });
        
        console.log('✅ Valid preparers loaded:', validPreparers.length);
        setPreparers(validPreparers);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Tayyorlovchilarni yuklashda xatolik');
      }
    } catch (error) {
      console.error('Load preparers error:', error);
      toast.error('Tayyorlovchilarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const loadZones = async () => {
    try {
      let adminSessionHeader: Record<string, string> = {};
      try {
        const raw = localStorage.getItem('adminSession');
        if (raw) {
          const parsed = JSON.parse(raw) as { sessionToken?: string };
          if (parsed?.sessionToken) {
            adminSessionHeader = { 'X-Admin-Session': parsed.sessionToken };
          }
        }
      } catch {
        /* ignore */
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-zones`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
            ...adminSessionHeader,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setZones(data.zones || []);
      }
    } catch (error) {
      console.error('Load zones error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.phone || !formData.login || (!editingId && !formData.password)) {
      toast.error('Majburiy maydonlarni to\'ldiring');
      return;
    }

    setFormSubmitting(true);
    try {
      const url = editingId
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/preparers/${editingId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/preparers`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(editingId ? 'Tayyorlovchi yangilandi' : 'Tayyorlovchi qo\'shildi');
        setShowForm(false);
        setEditingId(null);
        resetForm();
        loadPreparers();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEdit = (preparer: Preparer) => {
    setFormData({
      name: preparer.name || '',
      phone: preparer.phone || '',
      address: preparer.address || '',
      zones: preparer.zones || [],
      region: preparer.region || '',
      district: preparer.district || '',
      workTime: preparer.workTime || '09:00-18:00',
      salary: preparer.salary || 0,
      login: preparer.login || '',
      password: '', // Don't pre-fill password
      image: preparer.image || null,
    });
    setEditingId(preparer.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tayyorlovchini o\'chirmoqchimisiz?')) return;

    setDeletingPreparerId(id);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/preparers/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        toast.success('Tayyorlovchi o\'chirildi');
        loadPreparers();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setDeletingPreparerId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      zones: [],
      region: '',
      district: '',
      workTime: '09:00-18:00',
      salary: 0,
      login: '',
      password: '',
      image: null,
    });
  };

  const handleZoneToggle = (zoneId: string) => {
    setFormData(prev => ({
      ...prev,
      zones: prev.zones.includes(zoneId)
        ? prev.zones.filter(z => z !== zoneId)
        : [...prev.zones, zoneId]
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-safe-pt">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: accentColor.color }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 app-safe-pt">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold mb-1">Tayyorlovchilar</h1>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Market buyurtmalarini tayyorlash uchun
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingId(null);
              setShowForm(true);
            }}
            className="px-6 py-3 rounded-xl font-bold transition-all active:scale-95"
            style={{
              background: accentColor.gradient,
              color: '#ffffff',
            }}
          >
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              <span>Tayyorlovchi qo'shish</span>
            </div>
          </button>
        </div>
      </div>

      {/* Preparers List */}
      <div className="max-w-7xl mx-auto">
        {preparers.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl border"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <User className="w-16 h-16 mx-auto mb-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }} />
            <p className="text-lg font-semibold mb-2">Tayyorlovchilar yo'q</p>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Birinchi tayyorlovchini qo'shing
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {preparers.map(preparer => (
              <div
                key={preparer.id}
                className="group relative p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                style={{
                  background: isDark 
                    ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)' 
                    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: isDark 
                    ? '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(255, 255, 255, 0.05)' 
                    : '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
                }}
              >
                {/* Top Badge */}
                <div className="absolute top-4 right-4">
                  <div 
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      background: `${accentColor.color}30`,
                      color: accentColor.color,
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${accentColor.color}40`,
                    }}
                  >
                    Faol
                  </div>
                </div>

                {/* Image */}
                <div className="flex items-start gap-4 mb-5">
                  <div
                    className="relative w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105"
                    style={{
                      background: preparer.image 
                        ? `url(${preparer.image}) center/cover` 
                        : `linear-gradient(135deg, ${accentColor.color}30, ${accentColor.color}50)`,
                      boxShadow: `0 4px 16px ${accentColor.color}40`,
                      border: `2px solid ${accentColor.color}60`,
                    }}
                  >
                    {!preparer.image && (
                      <User className="w-10 h-10" style={{ color: accentColor.color }} />
                    )}
                    <div 
                      className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"
                    />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="text-xl font-bold mb-1 truncate" style={{
                      color: isDark ? '#fff' : '#000',
                    }}>
                      {preparer.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      <div 
                        className="p-1.5 rounded-lg"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        <Phone className="w-3.5 h-3.5" style={{ color: accentColor.color }} />
                      </div>
                      <span className="font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                        {preparer.phone}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3 mb-5">
                  {preparer.address && (
                    <div 
                      className="flex items-start gap-3 p-3 rounded-xl transition-colors"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      <div 
                        className="p-1.5 rounded-lg flex-shrink-0 mt-0.5"
                        style={{
                          background: `${accentColor.color}20`,
                        }}
                      >
                        <MapPin className="w-4 h-4" style={{ color: accentColor.color }} />
                      </div>
                      <span className="text-sm leading-relaxed" style={{ color: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.75)' }}>
                        {preparer.address}
                      </span>
                    </div>
                  )}
                  
                  <div 
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <div 
                      className="p-1.5 rounded-lg flex-shrink-0"
                      style={{
                        background: `${accentColor.color}20`,
                      }}
                    >
                      <Clock className="w-4 h-4" style={{ color: accentColor.color }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.75)' }}>
                      {preparer.workTime}
                    </span>
                  </div>

                  {preparer.salary > 0 && (
                    <div 
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, ${accentColor.color}15, ${accentColor.color}05)`,
                        border: `1px solid ${accentColor.color}30`,
                      }}
                    >
                      <div 
                        className="p-1.5 rounded-lg flex-shrink-0"
                        style={{
                          background: accentColor.color,
                        }}
                      >
                        <DollarSign className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                          Oylik maosh
                        </div>
                        <div className="text-sm font-bold" style={{ color: accentColor.color }}>
                          {preparer.salary.toLocaleString()} so'm
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {preparer.region && (
                      <div 
                        className="p-3 rounded-xl"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                        }}
                      >
                        <div className="text-xs font-medium mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                          Hudud
                        </div>
                        <div className="text-sm font-semibold truncate" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                          {preparer.region}
                        </div>
                        {preparer.district && (
                          <div className="text-xs mt-0.5 truncate" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            {preparer.district}
                          </div>
                        )}
                      </div>
                    )}

                    {preparer.zones && preparer.zones.length > 0 && (
                      <div 
                        className="p-3 rounded-xl"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                        }}
                      >
                        <div className="text-xs font-medium mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                          Zonalar
                        </div>
                        <div className="text-2xl font-bold" style={{ color: accentColor.color }}>
                          {preparer.zones.length}
                        </div>
                      </div>
                    )}
                  </div>

                  <div 
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                  >
                    <div 
                      className="p-1.5 rounded-lg flex-shrink-0"
                      style={{
                        background: `${accentColor.color}20`,
                      }}
                    >
                      <Key className="w-4 h-4" style={{ color: accentColor.color }} />
                    </div>
                    <div>
                      <div className="text-xs font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                        Login
                      </div>
                      <div className="text-sm font-bold font-mono" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                        {preparer.login}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleEdit(preparer)}
                    className="flex-1 py-3 rounded-xl font-bold transition-all duration-200 active:scale-95 hover:shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                      color: '#fff',
                      boxShadow: `0 4px 16px ${accentColor.color}40`,
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Edit2 className="w-4 h-4" />
                      <span>Tahrirlash</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(preparer.id)}
                    disabled={deletingPreparerId === preparer.id}
                    className="px-4 py-3 rounded-xl font-bold transition-all duration-200 active:scale-95 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[52px]"
                    style={{
                      background: isDark 
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(239, 68, 68, 0.15))' 
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.08))',
                      color: '#ef4444',
                      border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                      boxShadow: '0 4px 16px rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    {deletingPreparerId === preparer.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'rgba(0, 0, 0, 0.8)' }}>
          <div className="min-h-screen px-4 flex items-center justify-center">
            <div
              className="w-full max-w-2xl rounded-2xl p-6"
              style={{
                background: isDark ? '#0a0a0a' : '#ffffff',
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">
                  {editingId ? 'Tayyorlovchini tahrirlash' : 'Yangi tayyorlovchi'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="p-2 rounded-xl transition-all active:scale-95"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-2">Ism *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="To'liq ism"
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium mb-2">Telefon *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                    required
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium mb-2">Manzil</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Ko'cha, uy..."
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                {/* Region & District */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Viloyat</label>
                    <select
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value, district: '' })}
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <option value="" key="empty-region">Tanlang</option>
                      {REGIONS.map(region => (
                        <option key={region.name} value={region.name}>{region.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Tuman</label>
                    <select
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                      disabled={!formData.region}
                    >
                      <option value="" key="empty-district">Tanlang</option>
                      {formData.region && REGIONS.find(r => r.name === formData.region)?.districts.map(district => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Zones */}
                <div>
                  <label className="block text-sm font-medium mb-2">Zonalar (IP)</label>
                  <div className="max-h-40 overflow-y-auto space-y-2 p-3 rounded-xl border" style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}>
                    {zones.length === 0 ? (
                      <p className="text-sm text-center" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                        Zonalar yo'q
                      </p>
                    ) : (
                      zones.map(zone => (
                        <label key={zone.id} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.zones.includes(zone.id)}
                            onChange={() => handleZoneToggle(zone.id)}
                            className="w-5 h-5 rounded"
                            style={{ accentColor: accentColor.color }}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{zone.name}</p>
                            <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                              {zone.region}, {zone.district}
                            </p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Work Time & Salary */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Ish vaqti</label>
                    <input
                      type="text"
                      value={formData.workTime}
                      onChange={(e) => setFormData({ ...formData, workTime: e.target.value })}
                      placeholder="09:00-18:00"
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Oylik maosh (so'm)</label>
                    <input
                      type="number"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: e.target.value === '' ? 0 : Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    />
                  </div>
                </div>

                {/* Login & Password */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Login *</label>
                    <input
                      type="text"
                      value={formData.login}
                      onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                      placeholder="login"
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Parol {!editingId && '*'}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingId ? 'O\'zgartirmaslik uchun bo\'sh qoldiring' : 'Parol'}
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                      required={!editingId}
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  disabled={formSubmitting}
                  className="flex-1 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  }}
                >
                  Bekor qilish
                </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="flex-1 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: accentColor.gradient,
                      color: '#ffffff',
                    }}
                  >
                    {formSubmitting && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                    {editingId ? 'Saqlash' : 'Qo\'shish'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}