import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Plus, Trash2, Power, PowerOff, Edit2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { AddBannerModal } from './AddBannerModal';
import { BannerCarousel } from './BannerCarousel';
import { useVisibilityTick } from '../utils/visibilityRefetch';

const BANNER_CATEGORIES = [
  { value: 'all', label: 'Barchasi', icon: '🌐' },
  { value: 'market', label: 'Market', icon: '🛒' },
  { value: 'shop', label: 'Do\'kon', icon: '🏪' },
  { value: 'foods', label: 'Taomlar', icon: '🍽️' },
  { value: 'rentals', label: 'Ijara', icon: '🔑' },
  { value: 'car', label: 'Moshina', icon: '🚗' },
  { value: 'house', label: 'Uy', icon: '🏠' },
  { value: 'services', label: 'Xizmatlar', icon: '⚙️' },
] as const;

interface Banner {
  id: string;
  branchId: string;
  category: string;
  name: string;
  image: string;
  description: string;
  link?: string;
  promoCode?: string;
  region: string;
  district: string;
  isActive: boolean;
  order: number;
}

interface BannerManagementProps {
  branchId: string;
}

export function BannerManagement({ branchId }: BannerManagementProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadBanners();
  }, [branchId, selectedCategory, visibilityRefetchTick]);

  const loadBanners = async () => {
    try {
      setLoading(true);
      
      const url = selectedCategory === 'all'
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banners?branchId=${branchId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banners?branchId=${branchId}&category=${selectedCategory}`;

      console.log('🎯 ===== LOADING BANNERS =====');
      console.log('🎯 URL:', url);
      console.log('🎯 branchId:', branchId);
      console.log('🎯 selectedCategory:', selectedCategory);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      console.log('🎯 Response status:', response.status);
      const result = await response.json();
      console.log('🎯 Response result:', result);
      
      if (result.success) {
        console.log('🎯 Banners loaded:', result.data.length, 'items');
        console.log('🎯 Banners data:', result.data);
        setBanners(result.data);
      } else {
        console.error('🎯 Failed to load banners:', result.error);
        toast.error(result.error || 'Bannerlarni yuklashda xatolik!');
      }
      
      console.log('🎯 ===== END LOADING BANNERS =====\n');
    } catch (error) {
      console.error('🎯 Load banners error:', error);
      toast.error('Bannerlarni yuklashda xatolik!');
    } finally {
      setLoading(false);
    }
  };

  const toggleBannerStatus = async (bannerId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banners/${bannerId}/toggle`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success('Banner holati o\'zgartirildi');
        loadBanners();
      }
    } catch (error) {
      console.error('Toggle banner error:', error);
      toast.error('Xatolik yuz berdi!');
    }
  };

  const deleteBanner = async (bannerId: string) => {
    if (!confirm('Bannerni o\'chirishni tasdiqlaysizmi?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banners/${bannerId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success('Banner o\'chirildi');
        loadBanners();
      }
    } catch (error) {
      console.error('Delete banner error:', error);
      toast.error('Xatolik yuz berdi!');
    }
  };

  // Get active banners for carousel (current category)
  const activeBannersForCarousel = selectedCategory === 'all'
    ? banners.filter(b => b.isActive)
    : banners.filter(b => b.isActive && b.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {BANNER_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className="px-5 py-3 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all"
            style={{
              background: selectedCategory === cat.value 
                ? accentColor.color 
                : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
              color: selectedCategory === cat.value ? '#ffffff' : 'inherit'
            }}
          >
            <span className="text-lg">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Banner Carousel Preview */}
      {activeBannersForCarousel.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5" style={{ color: accentColor.color }} />
            Ko'rinish (5 sekund avtomatik aylanish)
          </h3>
          <BannerCarousel banners={activeBannersForCarousel} autoRotate interval={5000} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {selectedCategory === 'all' ? 'Barcha bannerlar' : BANNER_CATEGORIES.find(c => c.value === selectedCategory)?.label}
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95"
          style={{ background: accentColor.color, color: '#ffffff' }}
        >
          <Plus className="w-5 h-5" />
          Banner qo'shish
        </button>
      </div>

      {/* Banners List */}
      {loading ? (
        <div className="text-center py-12">
          <div 
            className="inline-block w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" 
            style={{ 
              borderColor: `${accentColor.color}40`, 
              borderTopColor: accentColor.color 
            }} 
          />
        </div>
      ) : banners.length === 0 ? (
        <div 
          className="text-center py-12 rounded-2xl"
          style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
        >
          <ImageIcon className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
          <p className="text-lg font-bold mb-2">Banner mavjud emas</p>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Birinchi banneringizni qo'shing
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="rounded-2xl overflow-hidden transition-all"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                opacity: banner.isActive ? 1 : 0.6
              }}
            >
              {/* Banner Image */}
              <div className="relative w-full h-40 bg-black/10">
                <img src={banner.image} alt={banner.name} className="w-full h-full object-cover" />
                {!banner.isActive && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="px-3 py-1 rounded-lg bg-red-500 text-white text-sm font-bold">
                      Nofaol
                    </span>
                  </div>
                )}
                {/* Category Badge */}
                <div 
                  className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold backdrop-blur-md"
                  style={{ background: 'rgba(0, 0, 0, 0.6)', color: 'white' }}
                >
                  {BANNER_CATEGORIES.find(c => c.value === banner.category)?.icon}{' '}
                  {BANNER_CATEGORIES.find(c => c.value === banner.category)?.label}
                </div>
              </div>

              {/* Banner Info */}
              <div className="p-4 space-y-3">
                <h3 className="font-bold text-lg line-clamp-1">{banner.name}</h3>
                
                {banner.description && (
                  <p 
                    className="text-sm line-clamp-2" 
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    {banner.description}
                  </p>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {banner.promoCode && (
                    <span 
                      className="px-2 py-1 rounded-lg text-xs font-bold"
                      style={{ 
                        background: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)',
                        color: '#f59e0b' 
                      }}
                    >
                      🏷️ {banner.promoCode}
                    </span>
                  )}
                  {banner.link && (
                    <span 
                      className="px-2 py-1 rounded-lg text-xs font-bold"
                      style={{ 
                        background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                        color: '#3b82f6' 
                      }}
                    >
                      🔗 Havola
                    </span>
                  )}
                </div>

                {/* Location */}
                <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  📍 {banner.region}, {banner.district}
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => toggleBannerStatus(banner.id)}
                    className="flex-1 px-3 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-all active:scale-95"
                    style={{ 
                      background: banner.isActive 
                        ? 'rgba(239, 68, 68, 0.2)' 
                        : 'rgba(16, 185, 129, 0.2)',
                      color: banner.isActive ? '#ef4444' : '#10b981'
                    }}
                  >
                    {banner.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                    {banner.isActive ? 'To\'xtatish' : 'Faollashtirish'}
                  </button>
                  
                  <button
                    onClick={() => deleteBanner(banner.id)}
                    className="px-3 py-2 rounded-lg transition-all active:scale-95"
                    style={{ background: 'rgba(239, 68, 68, 0.2)' }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Banner Modal */}
      {showAddModal && (
        <AddBannerModal
          branchId={branchId}
          category={selectedCategory !== 'all' ? selectedCategory : undefined}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            loadBanners();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}