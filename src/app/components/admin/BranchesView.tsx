import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  MapPin, 
  Phone, 
  User, 
  Lock,
  Calendar,
  Building2,
  X,
  Save,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { regions, getDistrictsByRegionId } from '../../data/regions';
import { projectId } from '../../../../utils/supabase/info';
import { buildAdminHeaders } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface Branch {
  id: string;
  name: string;
  login: string;
  password: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  phone: string;
  managerName: string;
  region: string;
  district: string;
  openDate: string;
  paymentQrImage?: string;
  createdAt: string;
}

interface BranchesViewProps {
  onStatsUpdate: () => void;
}

export default function BranchesView({ onStatsUpdate }: BranchesViewProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    login: '',
    password: '',
    lat: '',
    lng: '',
    phone: '',
    managerName: '',
    regionId: '',
    districtId: '',
    openDate: '',
    paymentQrImage: '',
  });

  const [availableDistricts, setAvailableDistricts] = useState<any[]>([]);
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  /** Ro‘yxat API dan kelguncha — «hozircha yo‘q» erta chiqmasin */
  const [isListLoading, setIsListLoading] = useState(true);
  
  // Delete confirmation dialog state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    branchId: string | null;
    branchName: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    branchId: null,
    branchName: '',
    isLoading: false,
  });
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadBranches();
  }, [visibilityRefetchTick]);

  useEffect(() => {
    // Update districts when region changes
    if (formData.regionId) {
      const districts = getDistrictsByRegionId(formData.regionId);
      setAvailableDistricts(districts);
      // Reset district if it doesn't exist in new region
      if (formData.districtId && !districts.find(d => d.id === formData.districtId)) {
        setFormData(prev => ({ ...prev, districtId: '' }));
      }
    } else {
      setAvailableDistricts([]);
    }
  }, [formData.regionId]);

  const loadBranches = async () => {
    setIsListLoading(true);
    try {
      console.log('📦 Loading branches from Supabase...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branches`,
        {
          headers: buildAdminHeaders({
            'Content-Type': 'application/json',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load branches');
      }

      const data = await response.json();
      console.log('✅ Branches loaded:', data.branches.length);
      
      // Convert to local format
      const formattedBranches = data.branches.map((b: any) => ({
        id: b.id,
        name: b.name || b.branchName,
        login: b.login,
        password: b.password,
        coordinates: b.coordinates || { lat: 0, lng: 0 },
        phone: b.phone || '',
        managerName: b.managerName || 'Admin',
        region: b.regionName || b.region || '',
        district: b.districtName || b.district || '',
        openDate: b.openDate || b.createdAt || new Date().toISOString().split('T')[0],
        paymentQrImage: b.paymentQrImage || '',
        createdAt: b.createdAt || new Date().toISOString(),
      }));
      
      setBranches(formattedBranches);
    } catch (error) {
      console.error('❌ Error loading branches:', error);
      toast.error('Filiallarni yuklashda xatolik');
    } finally {
      setIsListLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.login || !formData.password || 
        !formData.lat || !formData.lng || !formData.phone || 
        !formData.managerName || !formData.regionId || !formData.districtId || 
        !formData.openDate) {
      toast.error('Barcha maydonlarni to\'ldiring');
      return;
    }

    setIsSavingBranch(true);

    try {
      const region = regions.find(r => r.id === formData.regionId);
      const district = availableDistricts.find(d => d.id === formData.districtId);

      if (!region || !district) {
        toast.error('Viloyat yoki tuman topilmadi');
        return;
      }

      const branchData = {
        name: formData.name,
        login: formData.login,
        password: formData.password,
        branchName: formData.name,
        regionId: formData.regionId,
        regionName: region.name,
        districtId: formData.districtId,
        districtName: district.name,
        coordinates: {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
        },
        phone: formData.phone,
        managerName: formData.managerName,
        openDate: formData.openDate,
        paymentQrImage: formData.paymentQrImage,
      };

      if (editingBranch) {
        // Update existing branch
        console.log('📝 Updating branch:', editingBranch.id);
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branches/${editingBranch.id}`,
          {
            method: 'PUT',
            headers: buildAdminHeaders({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(branchData),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update branch');
        }

        const data = await response.json();
        console.log('✅ Branch updated:', data);
        toast.success('Filial muvaffaqiyatli yangilandi');
      } else {
        // Create new branch
        console.log('📝 Creating new branch...');
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branches`,
          {
            method: 'POST',
            headers: buildAdminHeaders({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(branchData),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to create branch');
        }

        const data = await response.json();
        console.log('✅ Branch created:', data);
        toast.success('Filial muvaffaqiyatli qo\'shildi');
      }

      // Reload branches
      await loadBranches();
      onStatsUpdate();
      
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error('❌ Error saving branch:', error);
      toast.error('Saqlashda xatolik');
    } finally {
      setIsSavingBranch(false);
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    
    // Find region and district IDs
    const region = regions.find(r => r.name === branch.region);
    const regionId = region?.id || '';
    
    let districtId = '';
    if (region) {
      const district = region.districts.find(d => d.name === branch.district);
      districtId = district?.id || '';
    }

    setFormData({
      name: branch.name,
      login: branch.login,
      password: branch.password,
      lat: branch.coordinates.lat.toString(),
      lng: branch.coordinates.lng.toString(),
      phone: branch.phone,
      managerName: branch.managerName,
      regionId: regionId,
      districtId: districtId,
      openDate: branch.openDate,
      paymentQrImage: branch.paymentQrImage || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, branchName: string) => {
    // Open confirmation dialog
    setDeleteConfirmation({
      isOpen: true,
      branchId: id,
      branchName: branchName,
      isLoading: false,
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.branchId) return;

    setDeleteConfirmation(prev => ({ ...prev, isLoading: true }));

    try {
      console.log('🗑️ Deleting branch:', deleteConfirmation.branchId);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branches/${deleteConfirmation.branchId}`,
        {
          method: 'DELETE',
          headers: buildAdminHeaders({
            'Content-Type': 'application/json',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete branch');
      }

      const result = await response.json();
      
      console.log('✅ Branch deleted:', result);
      
      // Show detailed success message
      const summary = result.summary;
      const message = `Filial va barcha ma'lumotlar o'chirildi:\n` +
        `🏪 Do'konlar: ${summary.deleted.shops}\n` +
        `📦 Market mahsulotlari: ${summary.deleted.branchProducts}\n` +
        `🛍️ Do'kon mahsulotlari: ${summary.deleted.shopProducts}\n` +
        `📋 Buyurtmalar: ${summary.deleted.shopOrders}`;
      
      toast.success(message);
      
      // Close dialog and reload
      setDeleteConfirmation({
        isOpen: false,
        branchId: null,
        branchName: '',
        isLoading: false,
      });
      
      await loadBranches();
      onStatsUpdate();
    } catch (error) {
      console.error('❌ Error deleting branch:', error);
      toast.error('O\'chirishda xatolik');
      setDeleteConfirmation(prev => ({ ...prev, isLoading: false }));
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation({
      isOpen: false,
      branchId: null,
      branchName: '',
      isLoading: false,
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      login: '',
      password: '',
      lat: '',
      lng: '',
      phone: '',
      managerName: '',
      regionId: '',
      districtId: '',
      openDate: '',
      paymentQrImage: '',
    });
    setEditingBranch(null);
    setAvailableDistricts([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">Filiallar</h2>
          <p 
            className="text-sm"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            {isListLoading ? 'Yuklanmoqda…' : `Jami ${branches.length} ta filial`}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold transition-all active:scale-95"
          style={{
            background: accentColor.gradient,
            color: '#ffffff',
            boxShadow: `0 4px 16px ${accentColor.color}40`,
          }}
        >
          <Plus className="w-5 h-5" />
          Yangi filial
        </button>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {isListLoading && branches.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="p-6 rounded-3xl border animate-pulse"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                <div className="flex justify-between mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/10" />
                  <div className="flex gap-2">
                    <div className="h-9 w-9 rounded-xl bg-white/10" />
                    <div className="h-9 w-9 rounded-xl bg-white/10" />
                  </div>
                </div>
                <div className="h-6 w-3/4 rounded-lg bg-white/10 mb-4" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-white/10" />
                  <div className="h-4 w-5/6 rounded bg-white/10" />
                  <div className="h-4 w-4/6 rounded bg-white/10" />
                </div>
              </div>
            ))
          : null}
        {!isListLoading || branches.length > 0
          ? branches.map((branch) => (
          <div
            key={branch.id}
            className="p-6 rounded-3xl border group"
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
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div 
                className="p-3 rounded-2xl"
                style={{ background: `${accentColor.color}20` }}
              >
                <Building2 className="w-6 h-6" style={{ color: accentColor.color }} />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(branch)}
                  className="p-2 rounded-xl transition-all active:scale-90"
                  style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(branch.id, branch.name)}
                  className="p-2 rounded-xl transition-all active:scale-90"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Name */}
            <h3 className="text-lg font-bold mb-4">{branch.name}</h3>

            {/* Details */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <User 
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                />
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  {branch.managerName}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Phone 
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                />
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  {branch.phone}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <MapPin 
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                />
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  {branch.region}, {branch.district}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Calendar 
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                />
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  {new Date(branch.openDate).toLocaleDateString('uz-UZ')}
                </span>
              </div>
            </div>

            {/* Login Info */}
            <div 
              className="mt-4 p-3 rounded-xl border text-xs"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-3.5 h-3.5" style={{ color: accentColor.color }} />
                <span className="font-medium">Kirish ma'lumotlari</span>
              </div>
              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                Login: {branch.login}
              </p>
              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                Parol: {branch.password}
              </p>
            </div>
          </div>
        ))
          : null}
      </div>

      {/* Empty State */}
      {!isListLoading && branches.length === 0 && (
        <div 
          className="text-center py-12 rounded-3xl border"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <Building2 
            className="w-12 h-12 mx-auto mb-4"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
          />
          <p 
            className="text-lg font-medium mb-2"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            Hozircha filiallar yo'q
          </p>
          <p 
            className="text-sm"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
          >
            Yangi filial qo'shish uchun yuqoridagi tugmani bosing
          </p>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setIsModalOpen(false)}
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
              <h3 className="text-xl font-bold">
                {editingBranch ? 'Filialni tahrirlash' : 'Yangi filial qo\'shish'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl transition-all active:scale-90"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-2">Filial nomi *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Toshkent filiali"
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                </div>

                {/* Manager Name */}
                <div>
                  <label className="block text-sm font-medium mb-2">Menejer ismi *</label>
                  <input
                    type="text"
                    value={formData.managerName}
                    onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                    placeholder="Ali Valiyev"
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                </div>

                {/* Login */}
                <div>
                  <label className="block text-sm font-medium mb-2">Login *</label>
                  <input
                    type="text"
                    value={formData.login}
                    onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                    placeholder="toshkent_filial"
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium mb-2">Parol *</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="parol123"
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
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
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                </div>

                {/* Open Date */}
                <div>
                  <label className="block text-sm font-medium mb-2">Ochilgan sana *</label>
                  <input
                    type="date"
                    value={formData.openDate}
                    onChange={(e) => setFormData({ ...formData, openDate: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                      colorScheme: isDark ? 'dark' : 'light',
                    }}
                  />
                </div>

                {/* Region */}
                <div>
                  <label className="block text-sm font-medium mb-2">Viloyat *</label>
                  <select
                    value={formData.regionId}
                    onChange={(e) => setFormData({ ...formData, regionId: e.target.value, districtId: '' })}
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  >
                    <option value="" style={{ background: isDark ? '#0a0a0a' : '#ffffff' }}>Tanlang</option>
                    {regions.map((region) => (
                      <option 
                        key={region.id} 
                        value={region.id}
                        style={{ background: isDark ? '#0a0a0a' : '#ffffff' }}
                      >
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* District */}
                <div>
                  <label className="block text-sm font-medium mb-2">Tuman *</label>
                  <select
                    value={formData.districtId}
                    onChange={(e) => setFormData({ ...formData, districtId: e.target.value })}
                    disabled={!formData.regionId}
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  >
                    <option value="" style={{ background: isDark ? '#0a0a0a' : '#ffffff' }}>
                      {formData.regionId ? 'Tanlang' : 'Avval viloyatni tanlang'}
                    </option>
                    {availableDistricts.map((district) => (
                      <option 
                        key={district.id} 
                        value={district.id}
                        style={{ background: isDark ? '#0a0a0a' : '#ffffff' }}
                      >
                        {district.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Latitude */}
                <div>
                  <label className="block text-sm font-medium mb-2">Kenglik (Latitude) *</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                    placeholder="41.311151"
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                </div>

                {/* Longitude */}
                <div>
                  <label className="block text-sm font-medium mb-2">Uzunlik (Longitude) *</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                    placeholder="69.279737"
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                </div>

                {/* Branch Payment QR (URL) */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Filial to'lov QR rasmi (URL)</label>
                  <input
                    type="url"
                    value={formData.paymentQrImage}
                    onChange={(e) => setFormData({ ...formData, paymentQrImage: e.target.value })}
                    placeholder="https://.../branch-qr.png"
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                  <p className="text-xs mt-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Market/ijaradan tashqari buyurtmalar kassa bo'limida shu QR bilan ko'rsatiladi.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl font-medium border transition-all active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSavingBranch}
                  className="flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:cursor-not-allowed"
                  style={{
                    background: accentColor.gradient,
                    color: '#ffffff',
                    boxShadow: `0 4px 16px ${accentColor.color}40`,
                    opacity: isSavingBranch ? 0.7 : 1,
                  }}
                >
                  {isSavingBranch ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isSavingBranch ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
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
            {/* Icon */}
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
              }}
            >
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>

            {/* Header */}
            <h3 className="text-xl font-bold text-center mb-2">
              O'chirish tasdiqlash
            </h3>

            {/* Message */}
            <div className="space-y-3 mb-6">
              <p 
                className="text-center text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
              >
                Siz <strong>{deleteConfirmation.branchName}</strong> nomli filialni o'chirmoqchimisiz?
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
                  <li>• Filialning barcha Market mahsulotlari</li>
                  <li>• Filialga tegishli barcha Do'konlar</li>
                  <li>• Do'konlarning barcha mahsulotlari</li>
                  <li>• Do'konlarning barcha buyurtmalari</li>
                </ul>
                <p className="mt-3 font-medium text-red-500">Bu amalni bekor qilish mumkin emas!</p>
              </div>
            </div>

            {/* Actions */}
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