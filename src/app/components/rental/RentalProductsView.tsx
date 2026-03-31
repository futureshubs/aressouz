import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Plus, Package, Edit, Trash2, ImageIcon, X, LayoutGrid } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { regions as allRegions } from '../../data/regions';
import { rentalCatalogs, rentalCategories } from '../../data/rentals';

// Extract regions and districts from structured data
const regions = allRegions.map(r => r.name);
const districts: { [key: string]: string[] } = {};
allRegions.forEach(region => {
  districts[region.name] = region.districts.map(d => d.name);
});

export function RentalProductsView({ branchId }: { branchId: string }) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  // Filters
  const [selectedCatalog, setSelectedCatalog] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    catalog: '',
    category: '',
    region: '',
    district: '',
    images: [] as string[],
    tariff: '',
    features: [] as string[],
    deposit: '',
    minDuration: '',
    durations: {
      hourly: { enabled: false, price: '' },
      daily: { enabled: false, price: '' },
      weekly: { enabled: false, price: '' },
      monthly: { enabled: false, price: '' }
    },
    quantity: 1,
    description: ''
  });

  const [newFeature, setNewFeature] = useState('');
  const [visibilityTick, setVisibilityTick] = useState(0);
  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  useEffect(() => {
    loadProducts();
  }, [branchId, visibilityTick]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/products/${branchId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Mahsulotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    setUploading(true);

    try {
      console.log('📤 Uploading images...', files.length);
      
      const uploadPromises = files.map(async (file) => {
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        console.log('📤 Uploading file:', file.name, file.type, file.size);
        
        // Use /public/upload endpoint with auth header (Supabase requires it)
        const uploadUrl = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/public/upload`;
        console.log('📤 Upload URL:', uploadUrl);

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: uploadFormData
        });

        console.log('📥 Upload response status:', response.status);
        const data = await response.json();
        console.log('📥 Upload response data:', data);
        
        if (data.success) {
          console.log('✅ Image uploaded:', data.url);
          return data.url;
        } else {
          console.error('❌ Image upload failed:', data);
          toast.error(data.error || 'Rasm yuklashda xatolik');
          return null;
        }
      });

      const urls = await Promise.all(uploadPromises);
      const validUrls = urls.filter(url => url !== null) as string[];

      console.log('✅ All images uploaded:', validUrls);

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...validUrls]
      }));

      if (validUrls.length > 0) {
        toast.success(`${validUrls.length} ta rasm yuklandi`);
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      toast.error('Rasmlarni yuklashda xatolik');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🚀 Form submission started');
    console.log('📋 Form data:', formData);

    if (!formData.name || !formData.category || !formData.region) {
      toast.error('Iltimos, barcha majburiy maydonlarni to\'ldiring');
      return;
    }

    try {
      const url = editingProduct
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/products/${editingProduct.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/products`;

      const payload = {
        ...formData,
        branchId
      };

      console.log('📤 Sending request to:', url);
      console.log('📦 Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log('📥 Response:', data);

      if (data.success) {
        toast.success(editingProduct ? 'Mahsulot yangilandi' : 'Mahsulot qo\'shildi');
        setShowModal(false);
        resetForm();
        loadProducts();
      } else {
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('❌ Error saving product:', error);
      toast.error('Mahsulotni saqlashda xatolik');
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Mahsulotni o\'chirishni tasdiqlaysizmi?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/products/${branchId}/${productId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Mahsulot o\'chirildi');
        loadProducts();
      } else {
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Mahsulotni o\'chirishda xatolik');
    }
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      catalog: product.catalog || '',
      category: product.category,
      region: product.region,
      district: product.district || '',
      images: product.images || [],
      tariff: product.tariff || '',
      features: product.features || [],
      deposit: product.deposit || '',
      minDuration: product.minDuration || '',
      durations: product.durations || {
        hourly: { enabled: false, price: '' },
        daily: { enabled: false, price: '' },
        weekly: { enabled: false, price: '' },
        monthly: { enabled: false, price: '' }
      },
      quantity: product.totalQuantity || 1,
      description: product.description || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      catalog: '',
      category: '',
      region: '',
      district: '',
      images: [],
      tariff: '',
      features: [],
      deposit: '',
      minDuration: '',
      durations: {
        hourly: { enabled: false, price: '' },
        daily: { enabled: false, price: '' },
        weekly: { enabled: false, price: '' },
        monthly: { enabled: false, price: '' }
      },
      quantity: 1,
      description: ''
    });
    setEditingProduct(null);
    setNewFeature('');
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    if (selectedCatalog && product.catalog !== selectedCatalog) return false;
    if (selectedCategory && product.category !== selectedCategory) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" 
               style={{ 
                 borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                 borderTopColor: accentColor.color 
               }}
          />
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            Yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mahsulotlar</h2>
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            {filteredProducts.length} ta mahsulot
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-6 py-3 rounded-2xl font-medium flex items-center gap-2 transition-all hover:scale-105"
          style={{ 
            background: accentColor.color,
            color: '#ffffff'
          }}
        >
          <Plus className="w-5 h-5" />
          Mahsulot qo'shish
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={selectedCatalog}
          onChange={(e) => {
            setSelectedCatalog(e.target.value);
            setSelectedCategory('');
          }}
          className="px-4 py-3 rounded-2xl outline-none min-w-[200px]"
          style={{
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
          }}
        >
          <option value="">🏢 Barcha kataloglar</option>
          {rentalCatalogs.map(catalog => (
            <option key={catalog.id} value={catalog.id}>
              {catalog.icon} {catalog.name}
            </option>
          ))}
        </select>

        {selectedCatalog && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 rounded-2xl outline-none min-w-[200px]"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
            }}
          >
            <option value="">📦 Barcha kategoriyalar</option>
            {rentalCategories
              .filter(cat => cat.catalogId === selectedCatalog)
              .map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
          </select>
        )}

        {(selectedCatalog || selectedCategory) && (
          <button
            onClick={() => {
              setSelectedCatalog('');
              setSelectedCategory('');
            }}
            className="px-4 py-3 rounded-2xl font-medium transition-all"
            style={{
              background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.1)',
              color: '#ef4444'
            }}
          >
            Tozalash
          </button>
        )}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div 
          className="text-center py-12 rounded-3xl border"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <Package className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
          <h3 className="text-xl font-bold mb-2">Mahsulotlar yo'q</h3>
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            Birinchi mahsulotingizni qo'shing
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="rounded-3xl overflow-hidden border transition-all hover:scale-[1.02]"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Image */}
              <div className="aspect-video bg-gray-200 dark:bg-gray-800 relative">
                {product.images && product.images.length > 0 ? (
                  <ImageWithFallback
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12" style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }} />
                  </div>
                )}
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium" 
                     style={{ background: accentColor.color, color: '#ffffff' }}>
                  {product.availableQuantity}/{product.totalQuantity}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-lg mb-1">{product.name}</h3>
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                    {product.category} • {product.region}
                  </p>
                </div>

                {/* Prices */}
                <div className="space-y-1">
                  {product.durations?.hourly?.enabled && (
                    <div className="text-sm">
                      <span style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Soatlik: </span>
                      <span className="font-semibold">{parseInt(product.durations.hourly.price).toLocaleString()} so'm</span>
                    </div>
                  )}
                  {product.durations?.daily?.enabled && (
                    <div className="text-sm">
                      <span style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Kunlik: </span>
                      <span className="font-semibold">{parseInt(product.durations.daily.price).toLocaleString()} so'm</span>
                    </div>
                  )}
                  {product.durations?.weekly?.enabled && (
                    <div className="text-sm">
                      <span style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Haftalik: </span>
                      <span className="font-semibold">{parseInt(product.durations.weekly.price).toLocaleString()} so'm</span>
                    </div>
                  )}
                  {product.durations?.monthly?.enabled && (
                    <div className="text-sm">
                      <span style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>Oylik: </span>
                      <span className="font-semibold">{parseInt(product.durations.monthly.price).toLocaleString()} so'm</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => openEditModal(product)}
                    className="flex-1 px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
                    style={{ 
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      color: accentColor.color
                    }}
                  >
                    <Edit className="w-4 h-4" />
                    Tahrirlash
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="px-4 py-2 rounded-xl transition-all"
                    style={{ 
                      background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.1)',
                      color: '#ef4444'
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}\n        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">
                {editingProduct ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div>
                <label className="block mb-2 font-medium">Mahsulot nomi *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl outline-none"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                  }}
                  placeholder="Masalan: Tesla Model S"
                  required
                />
              </div>

              {/* Catalog and Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Katalog *</label>
                  <select
                    value={formData.catalog}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      catalog: e.target.value,
                      category: ''
                    }))}
                    className="w-full px-4 py-3 rounded-2xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                    }}
                    required
                  >
                    <option value="">Katalog tanlang</option>
                    {rentalCatalogs.map(catalog => (
                      <option key={catalog.id} value={catalog.id}>
                        {catalog.icon} {catalog.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">Kategoriya *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                    }}
                    required
                    disabled={!formData.catalog}
                  >
                    <option value="">Kategoriya tanlang</option>
                    {formData.catalog && rentalCategories
                      .filter(cat => cat.catalogId === formData.catalog)
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Region and District */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Viloyat *</label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      region: e.target.value,
                      district: ''
                    }))}
                    className="w-full px-4 py-3 rounded-2xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                    }}
                    required
                  >
                    <option value="">Viloyat tanlang</option>
                    {regions.map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">Tuman</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                    }}
                    disabled={!formData.region}
                  >
                    <option value="">Tuman tanlang</option>
                    {formData.region && districts[formData.region]?.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block mb-2 font-medium">Miqdori *</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  className="w-full px-4 py-3 rounded-2xl outline-none"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                  }}
                  min="1"
                  required
                />
              </div>

              {/* Images */}
              <div>
                <label className="block mb-2 font-medium">Rasmlar (3-5 ta)</label>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {formData.images.map((img, index) => (
                      <div key={index} className="relative aspect-square rounded-xl overflow-hidden">
                        <ImageWithFallback
                          src={img}
                          alt={`Image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 rounded-lg"
                          style={{ background: 'rgba(0,0,0,0.7)', color: '#ffffff' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {formData.images.length < 5 && (
                    <label className="block">
                      <div
                        className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all hover:scale-[1.02]"
                        style={{
                          borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
                        }}
                      >
                        {uploading ? (
                          <div className="text-center">
                            <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto mb-2" 
                                 style={{ 
                                   borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                   borderTopColor: accentColor.color 
                                 }}
                            />
                            <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                              Yuklanmoqda...
                            </p>
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 mx-auto mb-2" style={{ color: accentColor.color }} />
                            <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                              Rasm yuklash uchun bosing ({formData.images.length}/5)
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Tariff and Deposit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Tarif</label>
                  <input
                    type="text"
                    value={formData.tariff}
                    onChange={(e) => setFormData(prev => ({ ...prev, tariff: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                    }}
                    placeholder="Masalan: Standart"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">Garov (so'm)</label>
                  <input
                    type="number"
                    value={formData.deposit}
                    onChange={(e) => setFormData(prev => ({ ...prev, deposit: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                    }}
                    placeholder="Masalan: 1000000"
                  />
                </div>
              </div>

              {/* Min Duration */}
              <div>
                <label className="block mb-2 font-medium">Minimal muddat</label>
                <input
                  type="text"
                  value={formData.minDuration}
                  onChange={(e) => setFormData(prev => ({ ...prev, minDuration: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl outline-none"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                  }}
                  placeholder="Masalan: 1 kun"
                />
              </div>

              {/* Durations */}
              <div>
                <label className="block mb-3 font-medium">Ijara muddatlari va narxlari</label>
                <div className="space-y-3">
                  {/* Hourly */}
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={formData.durations.hourly.enabled}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        durations: {
                          ...prev.durations,
                          hourly: { ...prev.durations.hourly, enabled: e.target.checked }
                        }
                      }))}
                      className="w-5 h-5"
                    />
                    <span className="w-24">Soatlik</span>
                    <input
                      type="number"
                      value={formData.durations.hourly.price}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        durations: {
                          ...prev.durations,
                          hourly: { ...prev.durations.hourly, price: e.target.value }
                        }
                      }))}
                      disabled={!formData.durations.hourly.enabled}
                      className="flex-1 px-4 py-2 rounded-xl outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                      }}
                      placeholder="Narx (so'm)"
                    />
                  </div>

                  {/* Daily */}
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={formData.durations.daily.enabled}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        durations: {
                          ...prev.durations,
                          daily: { ...prev.durations.daily, enabled: e.target.checked }
                        }
                      }))}
                      className="w-5 h-5"
                    />
                    <span className="w-24">Kunlik</span>
                    <input
                      type="number"
                      value={formData.durations.daily.price}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        durations: {
                          ...prev.durations,
                          daily: { ...prev.durations.daily, price: e.target.value }
                        }
                      }))}
                      disabled={!formData.durations.daily.enabled}
                      className="flex-1 px-4 py-2 rounded-xl outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                      }}
                      placeholder="Narx (so'm)"
                    />
                  </div>

                  {/* Weekly */}
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={formData.durations.weekly.enabled}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        durations: {
                          ...prev.durations,
                          weekly: { ...prev.durations.weekly, enabled: e.target.checked }
                        }
                      }))}
                      className="w-5 h-5"
                    />
                    <span className="w-24">Haftalik</span>
                    <input
                      type="number"
                      value={formData.durations.weekly.price}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        durations: {
                          ...prev.durations,
                          weekly: { ...prev.durations.weekly, price: e.target.value }
                        }
                      }))}
                      disabled={!formData.durations.weekly.enabled}
                      className="flex-1 px-4 py-2 rounded-xl outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                      }}
                      placeholder="Narx (so'm)"
                    />
                  </div>

                  {/* Monthly */}
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={formData.durations.monthly.enabled}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        durations: {
                          ...prev.durations,
                          monthly: { ...prev.durations.monthly, enabled: e.target.checked }
                        }
                      }))}
                      className="w-5 h-5"
                    />
                    <span className="w-24">Oylik</span>
                    <input
                      type="number"
                      value={formData.durations.monthly.price}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        durations: {
                          ...prev.durations,
                          monthly: { ...prev.durations.monthly, price: e.target.value }
                        }
                      }))}
                      disabled={!formData.durations.monthly.enabled}
                      className="flex-1 px-4 py-2 rounded-xl outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                      }}
                      placeholder="Narx (so'm)"
                    />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block mb-2 font-medium">Xususiyatlar</label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                      className="flex-1 px-4 py-3 rounded-2xl outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                      }}
                      placeholder="Xususiyat kiriting"
                    />
                    <button
                      type="button"
                      onClick={addFeature}
                      className="px-6 py-3 rounded-2xl font-medium"
                      style={{ 
                        background: accentColor.color,
                        color: '#ffffff'
                      }}
                    >
                      Qo'shish
                    </button>
                  </div>

                  {formData.features.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.features.map((feature, index) => (
                        <div
                          key={index}
                          className="px-3 py-2 rounded-xl flex items-center gap-2"
                          style={{
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                          }}
                        >
                          <span className="text-sm">{feature}</span>
                          <button
                            type="button"
                            onClick={() => removeFeature(index)}
                            className="p-1 rounded-lg hover:bg-red-500/20"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block mb-2 font-medium">Tavsif</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl outline-none resize-none"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                  }}
                  rows={4}
                  placeholder="Mahsulot haqida qo'shimcha ma'lumot..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 rounded-2xl font-medium"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
                  }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 rounded-2xl font-medium"
                  style={{ 
                    background: accentColor.color,
                    color: '#ffffff'
                  }}
                >
                  {editingProduct ? 'Saqlash' : 'Qo\'shish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}