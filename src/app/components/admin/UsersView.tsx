import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  Search,
  Users as UsersIcon,
  User,
  Phone,
  Calendar,
  ShoppingBag,
  Gift,
  DollarSign,
  Ban,
  CheckCircle,
  Trash2,
  Eye,
  X,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '../../../../utils/supabase/info';
import { buildAdminHeaders } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface UserData {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: string;
  email: string;
  profileImage?: string;
  bonusBalance: number;
  totalBonusEarned: number;
  purchasesCount: number;
  totalSpent: number;
  status: 'active' | 'blocked';
  blocked?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface UserDetails extends UserData {
  bonus: {
    balance: number;
    earnedToday: number;
    totalEarned: number;
    tapCount: number;
  };
  favorites: any[];
  cart: any[];
  purchases: any[];
}

interface UsersViewProps {
  onStatsUpdate: () => void;
}

function normalizeAdminUser(u: Record<string, unknown>): UserData {
  const firstName =
    (u.firstName as string) ||
    (u.first_name as string) ||
    (typeof u.name === 'string' ? String(u.name).trim().split(/\s+/)[0] : '') ||
    (typeof u.display_name === 'string'
      ? String(u.display_name).trim().split(/\s+/)[0]
      : '') ||
    '';
  const lastName =
    (u.lastName as string) ||
    (u.last_name as string) ||
    (typeof u.name === 'string'
      ? String(u.name).trim().split(/\s+/).slice(1).join(' ')
      : '') ||
    (typeof u.display_name === 'string'
      ? String(u.display_name).trim().split(/\s+/).slice(1).join(' ')
      : '') ||
    '';
  const phone = String(u.phone ?? '');
  const emailStr = String(u.email ?? '');
  return {
    id: String(u.id ?? ''),
    phone,
    firstName:
      firstName ||
      phone ||
      (emailStr.includes('@') ? emailStr.split('@')[0] : emailStr) ||
      'Mijoz',
    lastName: lastName || '',
    birthDate: u.birthDate as string | undefined,
    gender: u.gender as string | undefined,
    email: String(u.email ?? ''),
    profileImage: u.profileImage as string | undefined,
    bonusBalance: Number(u.bonusBalance) || 0,
    totalBonusEarned: Number(u.totalBonusEarned) || 0,
    purchasesCount: Number(u.purchasesCount) || 0,
    totalSpent: Number(u.totalSpent) || 0,
    status: (u.status === 'blocked' ? 'blocked' : 'active') as 'active' | 'blocked',
    blocked: Boolean(u.blocked),
    createdAt: String(u.createdAt ?? u.created_at ?? new Date().toISOString()),
    updatedAt: (u.updatedAt ?? u.updated_at) as string | undefined,
  };
}

export default function UsersView({ onStatsUpdate }: UsersViewProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'blocked'>('all');
  
  // View user details modal
  const [viewUserModal, setViewUserModal] = useState<{
    isOpen: boolean;
    user: UserDetails | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    user: null,
    isLoading: false,
  });

  // Delete confirmation dialog
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    userId: string | null;
    userName: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    userId: null,
    userName: '',
    isLoading: false,
  });
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadUsers();
  }, [visibilityRefetchTick]);

  useEffect(() => {
    // Filter users based on search and status filter
    let filtered = users;

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(user => user.status === selectedFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.firstName?.toLowerCase().includes(query) ||
        user.lastName?.toLowerCase().includes(query) ||
        user.phone?.includes(query) ||
        user.email?.toLowerCase().includes(query)
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, selectedFilter]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      console.log('📦 Loading users from Supabase...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/admin/users`,
        {
          headers: buildAdminHeaders({
            'Content-Type': 'application/json',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      const raw = Array.isArray(data.users) ? data.users : [];
      console.log('✅ Users loaded:', raw.length);

      setUsers(raw.map((row: Record<string, unknown>) => normalizeAdminUser(row)));
    } catch (error) {
      console.error('❌ Error loading users:', error);
      toast.error('Foydalanuvchilarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewUser = async (userId: string) => {
    setViewUserModal({ isOpen: true, user: null, isLoading: true });

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/admin/users/${userId}`,
        {
          headers: buildAdminHeaders({
            'Content-Type': 'application/json',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load user details');
      }

      const data = await response.json();
      const raw = data.user as Record<string, unknown> | null;
      if (!raw) {
        throw new Error('Empty user payload');
      }
      const base = normalizeAdminUser(raw);
      const bonusRaw = (raw.bonus as UserDetails['bonus']) || {
        balance: base.bonusBalance,
        earnedToday: 0,
        totalEarned: base.totalBonusEarned,
        tapCount: 0,
      };
      const userDetails: UserDetails = {
        ...base,
        bonus: {
          balance: Number(bonusRaw.balance) ?? base.bonusBalance,
          earnedToday: Number(bonusRaw.earnedToday) || 0,
          totalEarned: Number(bonusRaw.totalEarned) ?? base.totalBonusEarned,
          tapCount: Number(bonusRaw.tapCount) || 0,
        },
        favorites: Array.isArray(raw.favorites) ? raw.favorites : [],
        cart: Array.isArray(raw.cart) ? raw.cart : [],
        purchases: Array.isArray(raw.purchases) ? raw.purchases : [],
      };
      setViewUserModal({ isOpen: true, user: userDetails, isLoading: false });
    } catch (error) {
      console.error('❌ Error loading user details:', error);
      toast.error('Foydalanuvchi ma\'lumotlarini yuklashda xatolik');
      setViewUserModal({ isOpen: false, user: null, isLoading: false });
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newBlocked = currentStatus === 'active';
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/admin/users/${userId}/status`,
        {
          method: 'PATCH',
          headers: buildAdminHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ blocked: newBlocked }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      toast.success(newBlocked ? 'Foydalanuvchi bloklandi' : 'Foydalanuvchi aktivlashtirildi');
      await loadUsers();
      onStatsUpdate();
    } catch (error) {
      console.error('❌ Error updating user status:', error);
      toast.error('Holat o\'zgartirishda xatolik');
    }
  };

  const handleDeleteClick = (userId: string, userName: string) => {
    setDeleteConfirmation({
      isOpen: true,
      userId: userId,
      userName: userName,
      isLoading: false,
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.userId) return;

    setDeleteConfirmation(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/admin/users/${deleteConfirmation.userId}`,
        {
          method: 'DELETE',
          headers: buildAdminHeaders({
            'Content-Type': 'application/json',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      toast.success('Foydalanuvchi o\'chirildi');
      
      setDeleteConfirmation({
        isOpen: false,
        userId: null,
        userName: '',
        isLoading: false,
      });
      
      await loadUsers();
      onStatsUpdate();
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      toast.error('O\'chirishda xatolik');
      setDeleteConfirmation(prev => ({ ...prev, isLoading: false }));
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation({
      isOpen: false,
      userId: null,
      userName: '',
      isLoading: false,
    });
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? '#10b981' : '#ef4444';
  };

  const getStatusText = (status: string) => {
    return status === 'active' ? 'Faol' : 'Bloklangan';
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('uz-UZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
  };

  const stats = [
    {
      title: 'Jami foydalanuvchilar',
      value: users.length,
      icon: UsersIcon,
      color: accentColor.color,
    },
    {
      title: 'Faol foydalanuvchilar',
      value: users.filter(u => u.status === 'active').length,
      icon: CheckCircle,
      color: '#10b981',
    },
    {
      title: 'Bloklangan',
      value: users.filter(u => u.status === 'blocked').length,
      icon: Ban,
      color: '#ef4444',
    },
    {
      title: 'Jami xaridlar',
      value: users.reduce((sum, u) => sum + (u.purchasesCount || 0), 0),
      icon: ShoppingBag,
      color: '#8b5cf6',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Foydalanuvchilar</h2>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="p-6 rounded-3xl border"
                style={{
                  background: isDark 
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                    : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  boxShadow: isDark
                    ? '0 10px 30px rgba(0, 0, 0, 0.3)'
                    : '0 10px 30px rgba(0, 0, 0, 0.05)',
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div 
                    className="p-3 rounded-2xl"
                    style={{ background: `${stat.color}20` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: stat.color }} />
                  </div>
                </div>
                <p 
                  className="text-sm mb-1"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  {stat.title}
                </p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search 
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ism, telefon yoki email orqali qidirish..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              color: isDark ? '#ffffff' : '#111827',
            }}
          />
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Hammasi' },
            { value: 'active', label: 'Faol' },
            { value: 'blocked', label: 'Bloklangan' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setSelectedFilter(filter.value as any)}
              className="px-4 py-3 rounded-2xl font-medium transition-all active:scale-95"
              style={{
                background: selectedFilter === filter.value
                  ? accentColor.gradient
                  : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                color: selectedFilter === filter.value
                  ? '#ffffff'
                  : isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div 
          className="text-center py-12 rounded-3xl border"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <UsersIcon 
            className="w-12 h-12 mx-auto mb-4"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
          />
          <p 
            className="text-lg font-medium mb-2"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            {searchQuery ? 'Foydalanuvchilar topilmadi' : 'Hozircha foydalanuvchilar yo\'q'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="p-6 rounded-3xl border"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                boxShadow: isDark
                  ? '0 10px 30px rgba(0, 0, 0, 0.3)'
                  : '0 10px 30px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* User Info */}
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div 
                      className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${accentColor.color}20` }}
                    >
                      {user.profileImage ? (
                        <img 
                          src={user.profileImage} 
                          alt={user.firstName}
                          className="w-full h-full rounded-2xl object-cover"
                        />
                      ) : (
                        <User className="w-7 h-7" style={{ color: accentColor.color }} />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold truncate">
                          {user.firstName} {user.lastName}
                        </h3>
                        <span 
                          className="px-2 py-0.5 rounded-lg text-xs font-medium flex-shrink-0"
                          style={{
                            background: `${getStatusColor(user.status)}20`,
                            color: getStatusColor(user.status),
                          }}
                        >
                          {getStatusText(user.status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone 
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                          />
                          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            {user.phone}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar 
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                          />
                          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            {formatDate(user.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <ShoppingBag className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                    </div>
                    <p className="text-lg font-bold">{user.purchasesCount || 0}</p>
                    <p 
                      className="text-xs"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      Xarid
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <DollarSign className="w-4 h-4" style={{ color: '#10b981' }} />
                    </div>
                    <p className="text-lg font-bold">{Math.round((user.totalSpent || 0) / 1000)}K</p>
                    <p 
                      className="text-xs"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      Sarflangan
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Gift className="w-4 h-4" style={{ color: '#f59e0b' }} />
                    </div>
                    <p className="text-lg font-bold">{user.bonusBalance || 0}</p>
                    <p 
                      className="text-xs"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      Bonus
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <TrendingUp className="w-4 h-4" style={{ color: accentColor.color }} />
                    </div>
                    <p className="text-lg font-bold">{user.totalBonusEarned || 0}</p>
                    <p 
                      className="text-xs"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      Toplangan
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 lg:flex-col">
                  <button
                    onClick={() => handleViewUser(user.id)}
                    className="flex-1 lg:flex-none p-2.5 rounded-xl transition-all active:scale-90"
                    style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}
                    title="Ko'rish"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleStatus(user.id, user.status)}
                    className="flex-1 lg:flex-none p-2.5 rounded-xl transition-all active:scale-90"
                    style={{
                      background: user.status === 'active' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: user.status === 'active' ? '#ef4444' : '#10b981',
                    }}
                    title={user.status === 'active' ? 'Bloklash' : 'Aktivlashtirish'}
                  >
                    {user.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDeleteClick(user.id, `${user.firstName} ${user.lastName}`)}
                    className="flex-1 lg:flex-none p-2.5 rounded-xl transition-all active:scale-90"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                    title="O'chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View User Details Modal */}
      {viewUserModal.isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setViewUserModal({ isOpen: false, user: null, isLoading: false })}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border p-6 max-h-[90vh] overflow-y-auto"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Foydalanuvchi ma'lumotlari</h3>
              <button
                onClick={() => setViewUserModal({ isOpen: false, user: null, isLoading: false })}
                className="p-2 rounded-xl transition-all active:scale-90"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {viewUserModal.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
              </div>
            ) : viewUserModal.user && (
              <div className="space-y-6">
                {/* User Profile */}
                <div className="flex items-start gap-4">
                  <div 
                    className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    {viewUserModal.user.profileImage ? (
                      <img 
                        src={viewUserModal.user.profileImage} 
                        alt={viewUserModal.user.firstName}
                        className="w-full h-full rounded-2xl object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10" style={{ color: accentColor.color }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold mb-1">
                      {viewUserModal.user.firstName} {viewUserModal.user.lastName}
                    </h4>
                    <p 
                      className="text-sm mb-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      {viewUserModal.user.phone}
                    </p>
                    <span 
                      className="px-3 py-1 rounded-lg text-sm font-medium inline-block"
                      style={{
                        background: `${getStatusColor(viewUserModal.user.status)}20`,
                        color: getStatusColor(viewUserModal.user.status),
                      }}
                    >
                      {getStatusText(viewUserModal.user.status)}
                    </span>
                  </div>
                </div>

                {/* Bonus Info */}
                <div 
                  className="p-4 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <h5 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Gift className="w-4 h-4" style={{ color: accentColor.color }} />
                    Bonus ma'lumotlari
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p 
                        className="text-xs mb-1"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                      >
                        Joriy balans
                      </p>
                      <p className="text-lg font-bold">{viewUserModal.user.bonus.balance}</p>
                    </div>
                    <div>
                      <p 
                        className="text-xs mb-1"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                      >
                        Jami toplangan
                      </p>
                      <p className="text-lg font-bold">{viewUserModal.user.bonus.totalEarned}</p>
                    </div>
                    <div>
                      <p 
                        className="text-xs mb-1"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                      >
                        Bugun toplangan
                      </p>
                      <p className="text-lg font-bold">{viewUserModal.user.bonus.earnedToday}</p>
                    </div>
                    <div>
                      <p 
                        className="text-xs mb-1"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                      >
                        Tap soni
                      </p>
                      <p className="text-lg font-bold">{viewUserModal.user.bonus.tapCount}</p>
                    </div>
                  </div>
                </div>

                {/* Purchase History */}
                <div>
                  <h5 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4" style={{ color: accentColor.color }} />
                    Xaridlar tarixi ({viewUserModal.user.purchases.length})
                  </h5>
                  {viewUserModal.user.purchases.length === 0 ? (
                    <p 
                      className="text-sm text-center py-4"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      Hozircha xaridlar yo'q
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {viewUserModal.user.purchases.slice(0, 10).map((purchase: any, index: number) => (
                        <div
                          key={index}
                          className="p-3 rounded-xl border text-sm"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{purchase.productName || 'Mahsulot'}</span>
                            <span className="font-bold">{formatCurrency(purchase.amount || 0)}</span>
                          </div>
                          <p 
                            className="text-xs"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                          >
                            {formatDate(purchase.date)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p 
                      className="mb-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      Sevimlilar
                    </p>
                    <p className="font-semibold">{viewUserModal.user.favorites.length} ta</p>
                  </div>
                  <div>
                    <p 
                      className="mb-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      Savatda
                    </p>
                    <p className="font-semibold">{viewUserModal.user.cart.length} ta</p>
                  </div>
                  {viewUserModal.user.birthDate && (
                    <div>
                      <p 
                        className="mb-1"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                      >
                        Tug'ilgan kun
                      </p>
                      <p className="font-semibold">{formatDate(viewUserModal.user.birthDate)}</p>
                    </div>
                  )}
                  {viewUserModal.user.gender && (
                    <div>
                      <p 
                        className="mb-1"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                      >
                        Jinsi
                      </p>
                      <p className="font-semibold">{viewUserModal.user.gender === 'male' ? 'Erkak' : 'Ayol'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation.isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => cancelDelete()}
        >
          <div
            className="w-full max-w-md rounded-3xl border p-6"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(239, 68, 68, 0.1)' }}
            >
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>

            <h3 className="text-xl font-bold text-center mb-2">
              O'chirish tasdiqlash
            </h3>

            <div className="space-y-3 mb-6">
              <p 
                className="text-center text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
              >
                Siz <strong>{deleteConfirmation.userName}</strong> nomli foydalanuvchini o'chirmoqchimisiz?
              </p>
              
              <div 
                className="p-4 rounded-2xl border text-xs space-y-2"
                style={{
                  background: 'rgba(239, 68, 68, 0.05)',
                  borderColor: 'rgba(239, 68, 68, 0.2)',
                }}
              >
                <p className="font-semibold text-red-500 mb-2">⚠️ Quyidagilar o'chiriladi:</p>
                <ul className="space-y-1 text-red-500/80">
                  <li>• Foydalanuvchi profili</li>
                  <li>• Barcha sevimlilar va savat</li>
                  <li>• Bonus ma'lumotlari</li>
                  <li>• Xaridlar tarixi</li>
                  <li>• Barcha sozlamalar</li>
                </ul>
                <p className="mt-3 font-medium text-red-500">Bu amalni bekor qilish mumkin emas!</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => cancelDelete()}
                disabled={deleteConfirmation.isLoading}
                className="flex-1 py-3 rounded-2xl font-medium border transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#111827',
                }}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => confirmDelete()}
                disabled={deleteConfirmation.isLoading}
                className="flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#ffffff',
                  boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
                  opacity: deleteConfirmation.isLoading ? 0.7 : 1,
                }}
              >
                {deleteConfirmation.isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    O'chirilmoqda...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Ha, o'chirish
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
