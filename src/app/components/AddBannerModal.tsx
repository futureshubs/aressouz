import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { X, Upload, Image as ImageIcon, Tag, Link, MapPin, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { regions } from '../data/regions';

const BANNER_CATEGORIES = [
  { value: 'market', label: 'Market' },
  { value: 'shop', label: 'Do\'kon' },
  { value: 'foods', label: 'Taomlar' },
  { value: 'rentals', label: 'Ijara' },
  { value: 'car', label: 'Moshina' },
  { value: 'house', label: 'Uy' },
  { value: 'services', label: 'Xizmatlar' },
] as const;

interface AddBannerModalProps {
  branchId: string;
  category?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddBannerModal({ branchId, category, onClose, onSuccess }: AddBannerModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [formData, setFormData] = useState({
    category: category || BANNER_CATEGORIES[0].value,
    name: '',
    image: '',
    description: '',
    link: '',
    promoCode: '',
    region: regions[0].id,  // ✅ Use ID instead of name
    district: regions[0].districts[0].id,  // ✅ Use ID instead of name
  });
  
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get selected region object
  const selectedRegion = regions.find(r => r.id === formData.region);  // ✅ Find by ID
  const availableDistricts = selectedRegion?.districts || [];

  const handleImageUpload = async (file: File) => {
    try {
      setUploading(true);
      
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/public/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: uploadFormData
        }
      );

      const result = await response.json();
      
      if (result.success) {
        setFormData(prev => ({ ...prev, image: result.url }));
        toast.success('Rasm yuklandi!');
      } else {
        toast.error('Yuklashda xatolik!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Yuklashda xatolik!');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.image) {
      toast.error('Banner nomi va rasmni kiriting!');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = {
        ...formData,
        branchId
      };

      console.log('🎨 ===== CREATE BANNER REQUEST =====');
      console.log('🎨 Payload:', payload);
      console.log('🎨 branchId:', branchId);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banners`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(payload)
        }
      );

      console.log('🎨 Response status:', response.status);
      const result = await response.json();
      console.log('🎨 Response result:', result);
      
      if (result.success) {
        console.log('🎨 ✅ Banner created successfully:', result.data);
        toast.success('Banner muvaffaqiyatli qo\'shildi! 🎉');
        onSuccess();
      } else {
        console.error('🎨 ❌ Failed to create banner:', result.error);
        toast.error(result.error || 'Xatolik yuz berdi!');
      }

      console.log('🎨 ===== END CREATE BANNER =====\n');
    } catch (error) {
      console.error('🎨 ❌ Submit error:', error);
      toast.error('Xatolik yuz berdi!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-fadeIn"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-3xl md:max-h-[90vh] z-[101] rounded-3xl overflow-hidden animate-slideUp"
        style={{ 
          background: isDark ? '#1a1a1a' : '#ffffff',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: `${accentColor.color}20` }}
            >
              <ImageIcon className="w-6 h-6" style={{ color: accentColor.color }} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Banner qo'shish</h2>
              <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                Yangi reklama banner yaratish
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-6">
            {/* Banner Image */}
            <div>
              <label className="block text-sm font-bold mb-2">Banner rasmi *</label>
              <div 
                className="relative w-full h-48 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden"
                style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
              >
                {formData.image ? (
                  <img src={formData.image} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Upload className="w-12 h-12 mx-auto mb-3" style={{ color: accentColor.color }} />
                    <p className="font-bold mb-1">Rasm yuklash</p>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                      Tavsiya: 1200x400 piksel
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  disabled={uploading}
                />
              </div>
              {uploading && (
                <p className="text-sm mt-2 text-center" style={{ color: accentColor.color }}>
                  Yuklanmoqda...
                </p>
              )}
            </div>

            {/* Category & Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Kategoriya *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  disabled={!!category}
                >
                  {BANNER_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Banner nomi *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="Masalan: Yangi yil chegirmasi"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Tavsif
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl resize-none"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                }}
                rows={3}
                placeholder="Banner haqida qisqacha ma'lumot"
              />
            </div>

            {/* Link & Promo Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                  <Link className="w-4 h-4" />
                  Havola (ixtiyoriy)
                </label>
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Promo kod (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={formData.promoCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, promoCode: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="PROMO2024"
                />
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Viloyat *
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => {
                    const newRegion = e.target.value;
                    const newRegionObj = regions.find(r => r.id === newRegion);
                    setFormData(prev => ({ 
                      ...prev, 
                      region: newRegion,
                      district: newRegionObj?.districts[0]?.id || ''
                    }));
                  }}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                >
                  {regions.map(region => (
                    <option 
                      key={region.id} 
                      value={region.id}
                      style={{ 
                        background: isDark ? '#1a1a1a' : '#ffffff',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    >
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Tuman *</label>
                <select
                  value={formData.district}
                  onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                >
                  {availableDistricts.map(district => (
                    <option 
                      key={district.id} 
                      value={district.id}
                      style={{ 
                        background: isDark ? '#1a1a1a' : '#ffffff',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    >
                      {district.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50"
              style={{ background: accentColor.color, color: '#ffffff' }}
            >
              {isSubmitting ? 'Saqlanmoqda...' : 'Banner qo\'shish'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
}