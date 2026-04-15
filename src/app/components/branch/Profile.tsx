import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Edit2, 
  Save, 
  X, 
  Camera, 
  Shield, 
  Key, 
  Bell, 
  Globe, 
  Clock,
  Check,
  AlertCircle,
  Settings,
  LogOut,
  Smartphone,
  CreditCard,
  FileText,
  HelpCircle,
  Star,
  Award,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Activity,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '../../../../utils/supabase/info';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: string;
  profileImage: string;
  branchName: string;
  role: string;
  region: string;
  district: string;
  address: string;
  createdAt: string;
  lastLogin: string;
  status: 'active' | 'inactive';
  permissions: string[];
  stats: {
    totalOrders: number;
    totalRevenue: number;
    averageRating: number;
    completedDeliveries: number;
    customerSatisfaction: number;
  };
}

interface ProfileProps {
  branchId: string;
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
  };
}

export function Profile({ branchId, branchInfo }: ProfileProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, settings, security, activity
  const [editedProfile, setEditedProfile] = useState<Partial<ProfileData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const visibilityRefetchTick = useVisibilityTick();

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      console.log('👤 Loading profile for branch:', branchId);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-profile?branchId=${encodeURIComponent(branchId)}`,
        {
          headers: buildBranchHeaders({
            'Content-Type': 'application/json',
          }),
        }
      );

      if (!response.ok) {
        setProfileData(null);
        console.error('❌ Profile API response not ok');
        if (response.status === 401 || response.status === 403) {
          toast.error('Sessiya tugagan. Qaytadan filialga kiring.');
        } else {
          toast.error('Profil ma\'lumotlarini yuklashda xatolik');
        }
        return;
      }

      const data = await response.json();
      if (data.success) {
        setProfileData(data.data);
        console.log('✅ Profile loaded from API');
      }
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      toast.error('Profil ma\'lumotlarini yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [branchId, visibilityRefetchTick]);

  const handleEdit = () => {
    if (profileData) {
      setEditedProfile({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone,
        birthDate: profileData.birthDate,
        gender: profileData.gender,
        address: profileData.address
      });
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!profileData || !editedProfile) return;

    setIsSaving(true);
    try {
      console.log('💾 Saving profile...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-profile/${profileData.id}`,
        {
          method: 'PUT',
          headers: buildBranchHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(editedProfile)
        }
      );

      if (!response.ok) {
        throw new Error('Profilni saqlashda xatolik');
      }

      // Update local state
      setProfileData({ ...profileData, ...editedProfile });
      setIsEditing(false);
      setEditedProfile({});
      
      toast.success('Profil muvaffaqiyatli saqlandi');
      console.log('✅ Profile saved successfully');
    } catch (error) {
      console.error('❌ Error saving profile:', error);
      toast.error('Profilni saqlashda xatolik');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedProfile({});
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('uz-UZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center" aria-hidden>
          <Loader2 className="w-12 h-12 mx-auto animate-spin" style={{ color: accentColor.color }} />
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <User className="w-12 h-12 mx-auto mb-4" style={{ color: accentColor.color }} />
          <h3 className="text-xl font-bold mb-2">Profil ma\'lumotlari yo\'q</h3>
          <button
            type="button"
            onClick={() => void loadProfile()}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl font-medium transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: accentColor.gradient,
              color: '#ffffff'
            }}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Qayta yuklash
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Profil</h1>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Shaxsiy ma'lumotlar va sozlamalar
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isEditing ? (
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:shadow-lg"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            >
              <Edit2 className="w-4 h-4" />
              Tahrirlash
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-50"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff'
                }}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Saqlash
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:shadow-lg disabled:opacity-50"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                <X className="w-4 h-4" />
                Bekor qilish
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl border"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        }}
      >
        {[
          { id: 'overview', label: 'Umumiy ma\'lumot', icon: User },
          { id: 'settings', label: 'Sozlamalar', icon: Settings },
          { id: 'security', label: 'Xavfsizlik', icon: Shield },
          { id: 'activity', label: 'Faoliyat', icon: Activity }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === tab.id ? 'font-medium' : ''
            }`}
            style={{
              background: activeTab === tab.id 
                ? accentColor.gradient 
                : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)')
            }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div 
              className="p-6 rounded-2xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            >
              <div className="text-center">
                <div className="relative inline-block mb-4">
                  <div 
                    className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mx-auto"
                    style={{ 
                      background: accentColor.gradient,
                      color: '#ffffff'
                    }}
                  >
                    {profileData.firstName[0]}{profileData.lastName[0]}
                  </div>
                  <button 
                    className="absolute bottom-0 right-0 p-2 rounded-full border"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.9)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-xl font-bold mb-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedProfile.firstName || profileData.firstName}
                      onChange={(e) => setEditedProfile({ ...editedProfile, firstName: e.target.value })}
                      className="text-center px-2 py-1 rounded border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    />
                  ) : (
                    `${profileData.firstName} ${profileData.lastName}`
                  )}
                </h3>
                <p className="text-sm mb-4" style={{ 
                  color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                }}>
                  {profileData.role}
                </p>
                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: accentColor.color }} />
                    {isEditing ? (
                      <input
                        type="email"
                        value={editedProfile.email || profileData.email}
                        onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                        className="flex-1 px-2 py-1 rounded border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      />
                    ) : (
                      <span className="text-sm">{profileData.email}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" style={{ color: accentColor.color }} />
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editedProfile.phone || profileData.phone}
                        onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                        className="flex-1 px-2 py-1 rounded border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      />
                    ) : (
                      <span className="text-sm">{profileData.phone}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span className="text-sm">{profileData.region}, {profileData.district}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span className="text-sm">{formatDate(profileData.birthDate)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats and Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div 
                className="p-4 rounded-xl border text-center"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                <ShoppingCart className="w-6 h-6 mx-auto mb-2" style={{ color: accentColor.color }} />
                <p className="text-2xl font-bold">{profileData.stats.totalOrders}</p>
                <p className="text-sm" style={{ 
                  color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                }}>
                  Buyurtmalar
                </p>
              </div>
              <div 
                className="p-4 rounded-xl border text-center"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                <DollarSign className="w-6 h-6 mx-auto mb-2" style={{ color: '#10b981' }} />
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('uz-UZ', {
                    style: 'currency',
                    currency: 'UZS',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(profileData.stats.totalRevenue).split(' ')[0]}
                </p>
                <p className="text-sm" style={{ 
                  color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                }}>
                  Daromad
                </p>
              </div>
              <div 
                className="p-4 rounded-xl border text-center"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                <Star className="w-6 h-6 mx-auto mb-2" style={{ color: '#f59e0b' }} />
                <p className="text-2xl font-bold">{profileData.stats.averageRating}</p>
                <p className="text-sm" style={{ 
                  color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                }}>
                  Reyting
                </p>
              </div>
              <div 
                className="p-4 rounded-xl border text-center"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                <TrendingUp className="w-6 h-6 mx-auto mb-2" style={{ color: '#8b5cf6' }} />
                <p className="text-2xl font-bold">{profileData.stats.customerSatisfaction}%</p>
                <p className="text-sm" style={{ 
                  color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                }}>
                  Qoniqish
                </p>
              </div>
            </div>

            {/* Additional Info */}
            <div 
              className="p-6 rounded-2xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            >
              <h3 className="text-lg font-semibold mb-4">Qo'shimcha ma'lumotlar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm mb-1" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Filial nomi
                  </p>
                  <p className="font-medium">{profileData.branchName}</p>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Holati
                  </p>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: profileData.status === 'active' ? '#10b981' : '#ef4444'
                      }}
                    />
                    <p className="font-medium">
                      {profileData.status === 'active' ? 'Faol' : 'Nofaol'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Ro'yxatdan o'tgan
                  </p>
                  <p className="font-medium">{formatDate(profileData.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Oxirgi kirish
                  </p>
                  <p className="font-medium">{formatDateTime(profileData.lastLogin)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div 
          className="p-6 rounded-2xl border"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <h3 className="text-lg font-semibold mb-4">Sozlamalar</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            >
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5" style={{ color: accentColor.color }} />
                <div>
                  <p className="font-medium">Bildirishnomalar</p>
                  <p className="text-sm" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Yangi buyurtmalar va tizim xabarlari
                  </p>
                </div>
              </div>
              <button className="px-3 py-1 rounded-lg border text-sm"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                Sozlash
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5" style={{ color: accentColor.color }} />
                <div>
                  <p className="font-medium">Til</p>
                  <p className="text-sm" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Interfeys tili
                  </p>
                </div>
              </div>
              <select className="px-3 py-1 rounded-lg border text-sm"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <option value="uz">O'zbekcha</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div 
          className="p-6 rounded-2xl border"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <h3 className="text-lg font-semibold mb-4">Xavfsizlik</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            >
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5" style={{ color: accentColor.color }} />
                <div>
                  <p className="font-medium">Parolni o'zgartirish</p>
                  <p className="text-sm" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Oxirgi marta: 30 kun oldin
                  </p>
                </div>
              </div>
              <button className="px-3 py-1 rounded-lg border text-sm"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                O'zgartirish
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5" style={{ color: accentColor.color }} />
                <div>
                  <p className="font-medium">Ikki faktorli autentifikatsiya</p>
                  <p className="text-sm" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Qo'shimcha xavfsizlik
                  </p>
                </div>
              </div>
              <button className="px-3 py-1 rounded-lg border text-sm"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                Sozlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div 
          className="p-6 rounded-2xl border"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <h3 className="text-lg font-semibold mb-4">Faoliyat tarixi</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              }}
            >
              <Check className="w-5 h-5 text-green-500" />
              <div className="flex-1">
                <p className="font-medium">Buyurtma #1234 muvaffaqiyatli yakunlandi</p>
                <p className="text-sm" style={{ 
                  color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                }}>
                  2 soat oldin
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              }}
            >
              <Edit2 className="w-5 h-5 text-blue-500" />
              <div className="flex-1">
                <p className="font-medium">Mahsulot narhini yangiladi</p>
                <p className="text-sm" style={{ 
                  color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                }}>
                  5 soat oldin
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              }}
            >
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <div className="flex-1">
                <p className="font-medium">Yangi mijoz ro'yxatdan o'tdi</p>
                <p className="text-sm" style={{ 
                  color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                }}>
                  1 kun oldin
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
