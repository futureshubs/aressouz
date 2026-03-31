import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Eye, 
  Upload,
  X,
  MapPin,
  Phone,
  MessageSquare,
  DollarSign,
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  Save
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface Portfolio {
  id: string;
  branchId: string;
  title: string;
  description: string;
  category: string;
  price: number | null;
  priceType: 'fixed' | 'negotiable' | 'contact';
  images: string[];
  videos: string[];
  phone: string;
  whatsapp: string;
  telegram: string;
  region: string;
  district: string;
  address: string;
  status: 'active' | 'inactive';
  views: number;
  createdAt: string;
  updatedAt: string;
}

interface ServicesManagementProps {
  branchId: string;
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
  };
}

export default function ServicesManagement({ branchId, branchInfo }: ServicesManagementProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [serviceCategories, setServiceCategories] = useState<any[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const visibilityRefetchTick = useVisibilityTick();

  // Load service categories from API
  const loadServiceCategories = async () => {
    try {
      setIsLoadingCategories(true);
      console.log('🛠️ Loading service categories...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/service-categories`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Xizmat kategoriyalarini yuklab bo\'lmadi');
      }

      const data = await response.json();
      if (data.success) {
        setServiceCategories(Array.isArray(data.data) ? data.data : []);
        console.log('✅ Service categories loaded from API');
      } else {
        throw new Error(data.error || 'Xizmat kategoriyalari olinmadi');
      }
    } catch (error) {
      console.error('❌ Error loading service categories:', error);
      setServiceCategories([]);
      toast.error('Xizmat kategoriyalarini yuklab bo\'lmadi');
    } finally {
      setIsLoadingCategories(false);
    }
  };

  // Upload state
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price: '',
    priceType: 'fixed' as 'fixed' | 'negotiable' | 'contact',
    images: [] as string[],
    videos: [] as string[],
    phone: branchInfo?.phone || '',
    whatsapp: '',
    telegram: '',
    address: '',
  });

  // Load portfolios
  useEffect(() => {
    loadPortfolios();
    loadServiceCategories();
  }, [branchId, visibilityRefetchTick]);

  const loadPortfolios = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/portfolios?branchId=${branchId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Portfoliolarni yuklashda xatolik');
      }

      const data = await response.json();
      setPortfolios(data.portfolios || []);
    } catch (error) {
      console.error('Load portfolios error:', error);
      toast.error('Portfoliolarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/public/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error('Rasm yuklashda xatolik');
        }

        const data = await response.json();
        uploadedUrls.push(data.url);
      }

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls],
      }));

      toast.success(`${uploadedUrls.length} ta rasm yuklandi`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Rasm yuklashda xatolik');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/public/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error('Video yuklashda xatolik');
        }

        const data = await response.json();
        uploadedUrls.push(data.url);
      }

      setFormData(prev => ({
        ...prev,
        videos: [...prev.videos, ...uploadedUrls],
      }));

      toast.success(`${uploadedUrls.length} ta video yuklandi`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Video yuklashda xatolik');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.title || !formData.category) {
      toast.error('Sarlavha va kategoriya majburiy');
      return;
    }

    if (!branchInfo?.region || !branchInfo?.district) {
      toast.error('Filial ma\'lumotlarida viloyat/tuman ko\'rsatilmagan');
      return;
    }

    try {
      setIsSaving(true);

      const portfolioData = {
        branchId,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        price: formData.price ? parseFloat(formData.price) : null,
        priceType: formData.priceType,
        images: formData.images,
        videos: formData.videos,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        telegram: formData.telegram,
        region: branchInfo.region,
        district: branchInfo.district,
        address: formData.address,
      };

      const url = editingId
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/portfolios/${editingId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/portfolios`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(portfolioData),
      });

      if (!response.ok) {
        throw new Error('Portfolio saqlashda xatolik');
      }

      toast.success(editingId ? 'Portfolio yangilandi' : 'Portfolio yaratildi');
      setIsModalOpen(false);
      resetForm();
      loadPortfolios();
    } catch (error) {
      console.error('Save portfolio error:', error);
      toast.error('Portfolio saqlashda xatolik');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (portfolio: Portfolio) => {
    setEditingId(portfolio.id);
    setFormData({
      title: portfolio.title,
      description: portfolio.description,
      category: portfolio.category,
      price: portfolio.price?.toString() || '',
      priceType: portfolio.priceType,
      images: portfolio.images,
      videos: portfolio.videos,
      phone: portfolio.phone,
      whatsapp: portfolio.whatsapp,
      telegram: portfolio.telegram,
      address: portfolio.address,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Portfolio o\'chirilsinmi?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/portfolios/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Portfolio o\'chirishda xatolik');
      }

      toast.success('Portfolio o\'chirildi');
      loadPortfolios();
    } catch (error) {
      console.error('Delete portfolio error:', error);
      toast.error('Portfolio o\'chirishda xatolik');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      title: '',
      description: '',
      category: '',
      price: '',
      priceType: 'fixed',
      images: [],
      videos: [],
      phone: branchInfo?.phone || '',
      whatsapp: '',
      telegram: '',
      address: '',
    });
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const removeVideo = (index: number) => {
    setFormData(prev => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Xizmatlar Portfoliosi</h2>
          <p 
            className="text-sm mt-1"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            O'z xizmatlaringizni namoyish qiling
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95"
          style={{
            background: accentColor.gradient,
            color: '#ffffff',
          }}
        >
          <Plus className="w-5 h-5" />
          <span>Portfolio qo'shish</span>
        </button>
      </div>

      {/* Portfolios Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
        </div>
      ) : portfolios.length === 0 ? (
        <div
          className="text-center py-16 rounded-3xl border"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="text-4xl mb-4">🎨</div>
          <h3 className="text-xl font-bold mb-2">Hali portfolio yo'q</h3>
          <p 
            className="text-sm"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            Birinchi portfolioni yaratish uchun "Portfolio qo'shish" tugmasini bosing
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolios.map((portfolio) => {
            const category = serviceCategories.find(c => c.id === portfolio.category);
            return (
              <div
                key={portfolio.id}
                className="rounded-3xl border overflow-hidden"
                style={{
                  background: isDark 
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                    : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* Image */}
                {portfolio.images.length > 0 ? (
                  <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 relative">
                    <img 
                      src={portfolio.images[0]} 
                      alt={portfolio.title}
                      className="w-full h-full object-cover"
                    />
                    {portfolio.images.length > 1 && (
                      <div 
                        className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-xs font-bold text-white"
                        style={{ background: 'rgba(0, 0, 0, 0.7)' }}
                      >
                        +{portfolio.images.length - 1}
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    className="aspect-video flex items-center justify-center"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <ImageIcon className="w-12 h-12" style={{ color: accentColor.color }} />
                  </div>
                )}

                {/* Content */}
                <div className="p-4">
                  {/* Category Badge */}
                  <div 
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold mb-3"
                    style={{ background: `${accentColor.color}20`, color: accentColor.color }}
                  >
                    <span>{category?.icon}</span>
                    <span>{category?.name}</span>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-lg mb-2 line-clamp-2">
                    {portfolio.title}
                  </h3>

                  {/* Description */}
                  {portfolio.description && (
                    <p 
                      className="text-sm mb-3 line-clamp-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      {portfolio.description}
                    </p>
                  )}

                  {/* Price */}
                  {portfolio.price && (
                    <div className="mb-3">
                      <span className="text-lg font-bold" style={{ color: accentColor.color }}>
                        {portfolio.price.toLocaleString()} so'm
                      </span>
                      {portfolio.priceType === 'negotiable' && (
                        <span className="text-xs ml-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                          (kelishiladi)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div 
                    className="flex items-center gap-4 mb-3 text-sm"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4" />
                      <span>{portfolio.views}</span>
                    </div>
                    {portfolio.images.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4" />
                        <span>{portfolio.images.length}</span>
                      </div>
                    )}
                    {portfolio.videos.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <VideoIcon className="w-4 h-4" />
                        <span>{portfolio.videos.length}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(portfolio)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border transition-all active:scale-95"
                      style={{
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                      <span className="text-sm font-medium">Tahrirlash</span>
                    </button>
                    <button
                      onClick={() => handleDelete(portfolio.id)}
                      className="px-3 py-2 rounded-xl border transition-all active:scale-95"
                      style={{
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                        background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                        color: '#ef4444',
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="flex items-center justify-between p-6 border-b"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <h2 className="text-2xl font-bold">
                {editingId ? 'Portfolio tahrirlash' : 'Yangi portfolio'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl transition-all active:scale-90"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Sarlavha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Masalan: Professional veb sayt yaratish"
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    }}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Kategoriya <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {serviceCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setFormData(prev => ({ ...prev, category: cat.id }))}
                        className="p-3 rounded-xl border transition-all active:scale-95"
                        style={{
                          background: formData.category === cat.id
                            ? accentColor.gradient
                            : isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                          borderColor: formData.category === cat.id
                            ? accentColor.color
                            : isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                          color: formData.category === cat.id ? '#ffffff' : 'inherit',
                        }}
                      >
                        <div className="text-2xl mb-1">{cat.icon}</div>
                        <div className="text-xs font-medium">{cat.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Ta'rif
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Xizmat haqida batafsil ma'lumot..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border outline-none resize-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    }}
                  />
                </div>

                {/* Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Narx (so'm)
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="100000"
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Narx turi
                    </label>
                    <select
                      value={formData.priceType}
                      onChange={(e) => setFormData(prev => ({ ...prev, priceType: e.target.value as any }))}
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                      }}
                    >
                      <option value="fixed">Aniq narx</option>
                      <option value="negotiable">Kelishiladi</option>
                      <option value="contact">Bog'laning</option>
                    </select>
                  </div>
                </div>

                {/* Images Upload */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Rasmlar
                  </label>
                  <div className="space-y-3">
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                      <div
                        className="w-full p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:scale-105"
                        style={{
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                          background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                        }}
                      >
                        <div className="text-center">
                          {isUploading ? (
                            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" style={{ color: accentColor.color }} />
                          ) : (
                            <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: accentColor.color }} />
                          )}
                          <p className="text-sm font-medium">
                            {isUploading ? 'Yuklanmoqda...' : 'Rasmlarni yuklash'}
                          </p>
                        </div>
                      </div>
                    </label>

                    {/* Preview Images */}
                    {formData.images.length > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        {formData.images.map((url, index) => (
                          <div key={index} className="relative aspect-square rounded-xl overflow-hidden group">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Videos Upload */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Videolar
                  </label>
                  <div className="space-y-3">
                    <label className="block">
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        onChange={handleVideoUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                      <div
                        className="w-full p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:scale-105"
                        style={{
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                          background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                        }}
                      >
                        <div className="text-center">
                          {isUploading ? (
                            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" style={{ color: accentColor.color }} />
                          ) : (
                            <VideoIcon className="w-8 h-8 mx-auto mb-2" style={{ color: accentColor.color }} />
                          )}
                          <p className="text-sm font-medium">
                            {isUploading ? 'Yuklanmoqda...' : 'Videolarni yuklash'}
                          </p>
                        </div>
                      </div>
                    </label>

                    {/* Preview Videos */}
                    {formData.videos.length > 0 && (
                      <div className="space-y-2">
                        {formData.videos.map((url, index) => (
                          <div 
                            key={index} 
                            className="flex items-center justify-between p-3 rounded-xl border"
                            style={{
                              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <VideoIcon className="w-5 h-5" style={{ color: accentColor.color }} />
                              <span className="text-sm">Video {index + 1}</span>
                            </div>
                            <button
                              onClick={() => removeVideo(index)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Telefon
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+998901234567"
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                      placeholder="+998901234567"
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Telegram
                    </label>
                    <input
                      type="text"
                      value={formData.telegram}
                      onChange={(e) => setFormData(prev => ({ ...prev, telegram: e.target.value }))}
                      placeholder="@username"
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                      }}
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Manzil
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Aniq manzil..."
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div 
              className="flex gap-3 p-6 border-t"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-6 py-3 rounded-xl border font-medium transition-all active:scale-95"
                style={{
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                }}
              >
                Bekor qilish
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving || isUploading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Saqlanmoqda...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>{editingId ? 'Yangilash' : 'Saqlash'}</span>
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
