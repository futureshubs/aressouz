import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  X, 
  Plus, 
  Trash2, 
  Upload, 
  Image as ImageIcon, 
  Video as VideoIcon,
  Loader2,
  Save
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import { platformCommissionHintUz, validateVariantCommissionsClient } from '../../utils/platformCommission';

interface Variant {
  id: string;
  name: string;
  price: number;
  oldPrice: number;
  commission: number;
  stock: number;
  barcode: string;
  images: string[];
  video: string;
  uploadingImages: boolean[];
  uploadingVideo: boolean;
}

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token: string;
  product: any;
}

export default function EditProductModal({ isOpen, onClose, onSuccess, token, product }: EditProductModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    features: [] as string[], // Changed to array
  });

  const [newFeature, setNewFeature] = useState(''); // For adding new features

  const [variants, setVariants] = useState<Variant[]>([{
    id: Date.now().toString(),
    name: '',
    price: 0,
    oldPrice: 0,
    commission: 0,
    stock: 0,
    barcode: '',
    images: [],
    video: '',
    uploadingImages: [],
    uploadingVideo: false,
  }]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const videoInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const visibilityRefetchTick = useVisibilityTick();

  // Load product data when modal opens
  useEffect(() => {
    if (isOpen && product) {
      // Handle features - convert string to array or use existing array
      let featuresArray: string[] = [];
      if (product.features) {
        if (Array.isArray(product.features)) {
          featuresArray = product.features;
        } else if (typeof product.features === 'string') {
          // Old format: string - ignore it for now (user can add new features)
          featuresArray = [];
        }
      }
      
      setFormData({
        name: product.name || '',
        description: product.description || '',
        features: featuresArray,
      });

      if (product.variants && product.variants.length > 0) {
        setVariants(product.variants.map((v: any) => ({
          id: v.id || Date.now().toString(),
          name: v.name || '',
          price: v.price || 0,
          oldPrice: v.oldPrice || 0,
          commission: v.commission || 0,
          stock: v.stock || 0,
          barcode: v.barcode || '',
          images: v.images || [],
          video: v.video || '',
          uploadingImages: [],
          uploadingVideo: false,
        })));
      }
    }
  }, [isOpen, product, visibilityRefetchTick]);

  if (!isOpen || !product) return null;

  const handleAddVariant = () => {
    setVariants([...variants, {
      id: Date.now().toString(),
      name: '',
      price: 0,
      oldPrice: 0,
      commission: 0,
      stock: 0,
      barcode: '',
      images: [],
      video: '',
      uploadingImages: [],
      uploadingVideo: false,
    }]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length === 1) {
      toast.error('Kamida bitta variant bo\'lishi kerak');
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index: number, field: keyof Variant, value: any) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };

  const handleImageUpload = async (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const variant = variants[index];
    if (variant.images.length + files.length > 5) {
      toast.error('Maksimal 5 ta rasm yuklash mumkin');
      return;
    }

    const newVariants = [...variants];
    const uploadingFlags = [...Array(files.length)].map(() => true);
    newVariants[index].uploadingImages.push(...uploadingFlags);
    setVariants(newVariants);

    try {
      const uploadPromises = Array.from(files).map(async (file, fileIndex) => {
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} juda katta (maksimal 10MB)`);
          return null;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('token', token);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/upload-media?token=${token}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-Seller-Token': token,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || errorData.message || 'Rasm yuklanmadi');
        }

        const data = await response.json();
        return data.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter(url => url !== null) as string[];

      const updatedVariants = [...variants];
      updatedVariants[index].images.push(...validUrls);
      updatedVariants[index].uploadingImages = [];
      setVariants(updatedVariants);

      toast.success(`${validUrls.length} ta rasm yuklandi`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Rasmlarni yuklashda xatolik');
      const updatedVariants = [...variants];
      updatedVariants[index].uploadingImages = [];
      setVariants(updatedVariants);
    }
  };

  const handleVideoUpload = async (index: number, file: File | null) => {
    if (!file) return;

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video hajmi 50MB dan kichik bo\'lishi kerak');
      return;
    }

    const newVariants = [...variants];
    newVariants[index].uploadingVideo = true;
    setVariants(newVariants);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/upload-media?token=${token}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Seller-Token': token,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.message || 'Video yuklanmadi');
      }

      const data = await response.json();
      
      const updatedVariants = [...variants];
      updatedVariants[index].video = data.url;
      updatedVariants[index].uploadingVideo = false;
      setVariants(updatedVariants);

      toast.success('Video yuklandi');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Videoni yuklashda xatolik');
      const updatedVariants = [...variants];
      updatedVariants[index].uploadingVideo = false;
      setVariants(updatedVariants);
    }
  };

  const handleRemoveImage = (variantIndex: number, imageIndex: number) => {
    const newVariants = [...variants];
    newVariants[variantIndex].images.splice(imageIndex, 1);
    setVariants(newVariants);
  };

  const handleRemoveVideo = (index: number) => {
    const newVariants = [...variants];
    newVariants[index].video = '';
    setVariants(newVariants);
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Mahsulot nomini kiriting');
      return;
    }

    if (variants.length === 0) {
      toast.error('Kamida bitta variant qo\'shing');
      return;
    }

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      if (!variant.name.trim()) {
        toast.error(`Variant ${i + 1} nomini kiriting`);
        return;
      }
      if (variant.price <= 0) {
        toast.error(`Variant ${i + 1} narxini kiriting`);
        return;
      }
    }

    const cErr = validateVariantCommissionsClient(
      variants.map((v) => ({ commission: v.commission })),
      'Mahsulot',
    );
    if (cErr) {
      toast.error(cErr);
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('🚀 ===== PRODUCT UPDATE START =====');
      console.log('📦 Product ID:', product.id);
      console.log('📦 Product data:', {
        name: formData.name,
        description: formData.description,
        features: formData.features,
        variantsCount: variants.length,
      });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/products/${product.id}?token=${token}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Seller-Token': token,
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            features: formData.features,
            variants: variants.map(v => ({
              id: v.id,
              name: v.name,
              price: v.price,
              oldPrice: v.oldPrice,
              commission: v.commission,
              stock: v.stock,
              barcode: v.barcode,
              images: v.images,
              video: v.video,
            })),
          }),
        }
      );

      console.log('📥 Response status:', response.status);
      console.log('📥 Response OK:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response (raw):', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
          console.error('❌ Parsed error data:', errorData);
        } catch (parseErr) {
          console.error('❌ Could not parse error JSON:', parseErr);
          errorData = { message: errorText };
        }
        
        const errorMessage = errorData.error || errorData.message || errorText || 'Server xatolik qaytardi';
        console.error('❌ Final error message:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Product updated successfully:', result);

      toast.success('Mahsulot yangilandi!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('❌ ===== PRODUCT UPDATE ERROR =====');
      console.error('❌ Error details:', {
        message: error?.message,
        stack: error?.stack,
      });
      
      const errorMessage = error?.message || 'Mahsulotni yangilashda xatolik. Iltimos, qayta urinib ko\'ring.';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.7)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 flex items-center justify-between p-6 border-b"
          style={{
            background: isDark ? '#0a0a0a' : '#ffffff',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h2 className="text-2xl font-bold">Mahsulotni tahrirlash</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all active:scale-90"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Asosiy ma'lumotlar</h3>
            
            <div>
              <label className="block text-sm font-medium mb-2">Mahsulot nomi *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
                placeholder="Masalan: Samsung Galaxy S24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tavsif</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
                placeholder="Mahsulot haqida qisqacha ma'lumot"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Xususiyatlar</label>
              <div className="flex flex-col gap-2">
                {formData.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm">{feature}</span>
                    <button
                      onClick={() => setFormData({ ...formData, features: formData.features.filter((_, i) => i !== index) })}
                      className="p-1 rounded-full transition-all active:scale-90"
                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newFeature.trim()) {
                        setFormData({ ...formData, features: [...formData.features, newFeature] });
                        setNewFeature('');
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                    placeholder="Masalan: 6.2 dyuymli ekran, 128GB xotira, 5000mAh batareya"
                  />
                  <button
                    onClick={() => {
                      if (newFeature.trim()) {
                        setFormData({ ...formData, features: [...formData.features, newFeature] });
                        setNewFeature('');
                      }
                    }}
                    className="px-4 py-2 rounded-xl font-medium transition-all active:scale-95"
                    style={{ background: `${accentColor.color}20`, color: accentColor.color }}
                  >
                    Qo'shish
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Variants */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Variantlar</h3>
              <button
                onClick={handleAddVariant}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all active:scale-95"
                style={{ background: `${accentColor.color}20`, color: accentColor.color }}
              >
                <Plus className="w-4 h-4" />
                Variant qo'shish
              </button>
            </div>

            {variants.map((variant, index) => (
              <div
                key={variant.id}
                className="p-6 rounded-2xl border space-y-4"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold">Variant {index + 1}</h4>
                  {variants.length > 1 && (
                    <button
                      onClick={() => handleRemoveVariant(index)}
                      className="p-2 rounded-xl transition-all active:scale-90"
                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Variant nomi *</label>
                    <input
                      type="text"
                      value={variant.name}
                      onChange={(e) => handleVariantChange(index, 'name', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                      placeholder="Masalan: 128GB Qora"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Narx (so'm) *</label>
                    <input
                      type="number"
                      value={variant.price || ''}
                      onChange={(e) => handleVariantChange(index, 'price', Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Eski narx (so'm)</label>
                    <input
                      type="number"
                      value={variant.oldPrice || ''}
                      onChange={(e) => handleVariantChange(index, 'oldPrice', Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Berish % (platformaga)</label>
                    <input
                      type="number"
                      value={variant.commission || ''}
                      onChange={(e) =>
                        handleVariantChange(
                          index,
                          'commission',
                          e.target.value === '' ? 0 : Number(e.target.value),
                        )
                      }
                      className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                      placeholder="0–15 (ixtiyoriy)"
                      min={0}
                      max={15}
                    />
                    <p className="text-xs mt-1 opacity-60">{platformCommissionHintUz()}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Omborda</label>
                    <input
                      type="number"
                      value={variant.stock || ''}
                      onChange={(e) => handleVariantChange(index, 'stock', Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Shtrix kod</label>
                    <input
                      type="text"
                      value={variant.barcode}
                      onChange={(e) => handleVariantChange(index, 'barcode', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                      placeholder="1234567890123"
                    />
                  </div>
                </div>

                {/* Images */}
                <div>
                  <label className="block text-sm font-medium mb-2">Rasmlar (maksimal 5 ta)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {variant.images.map((image, imgIndex) => (
                      <div
                        key={imgIndex}
                        className="relative aspect-square w-full max-w-[500px] rounded-xl overflow-hidden group bg-zinc-100 dark:bg-zinc-800/90"
                      >
                        <img src={image} alt="" className="w-full h-full object-contain" />
                        <button
                          onClick={() => handleRemoveImage(index, imgIndex)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: 'rgba(239, 68, 68, 0.9)', color: '#ffffff' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    {variant.uploadingImages.map((_, idx) => (
                      <div
                        key={`uploading-${idx}`}
                        className="aspect-square rounded-xl flex items-center justify-center"
                        style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
                      >
                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor.color }} />
                      </div>
                    ))}

                    {variant.images.length < 5 && (
                      <button
                        onClick={() => fileInputRefs.current[variant.id]?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                        style={{ borderColor: accentColor.color, color: accentColor.color }}
                      >
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-xs font-medium">Yuklash</span>
                      </button>
                    )}
                    
                    <input
                      ref={(el) => fileInputRefs.current[variant.id] = el}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleImageUpload(index, e.target.files)}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Video */}
                <div>
                  <label className="block text-sm font-medium mb-2">Video (ixtiyoriy)</label>
                  {variant.video ? (
                    <div className="relative rounded-xl overflow-hidden group">
                      <video src={variant.video} controls className="w-full rounded-xl" />
                      <button
                        onClick={() => handleRemoveVideo(index)}
                        className="absolute top-2 right-2 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(239, 68, 68, 0.9)', color: '#ffffff' }}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : variant.uploadingVideo ? (
                    <div
                      className="h-40 rounded-xl flex items-center justify-center"
                      style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
                    >
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
                    </div>
                  ) : (
                    <button
                      onClick={() => videoInputRefs.current[variant.id]?.click()}
                      className="w-full h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                      style={{ borderColor: accentColor.color, color: accentColor.color }}
                    >
                      <VideoIcon className="w-8 h-8" />
                      <span className="font-medium">Video yuklash</span>
                      <span className="text-xs opacity-60">Maksimal 50MB</span>
                    </button>
                  )}
                  <input
                    ref={(el) => videoInputRefs.current[variant.id] = el}
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleVideoUpload(index, e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div 
          className="sticky bottom-0 flex items-center justify-end gap-3 p-6 border-t"
          style={{
            background: isDark ? '#0a0a0a' : '#ffffff',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-2xl font-medium transition-all active:scale-95"
            style={{ 
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
            disabled={isSubmitting}
          >
            Bekor qilish
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: accentColor.gradient, color: '#ffffff' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Saqlash
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}