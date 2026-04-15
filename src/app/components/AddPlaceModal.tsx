import { useMemo, useRef, useState, useEffect } from 'react';
import { X, Upload, MapPin, Phone, FileText, Key, Instagram, Youtube, Send, Loader2 } from 'lucide-react';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { placeCategories } from '../data/places';
import { regions, type Region, type District } from '../data/regions';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { compressImageIfNeeded, uploadFormDataWithProgress } from '../utils/uploadWithProgress';

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: Platform;
  onSuccess: () => void;
}

export function AddPlaceModal({ isOpen, onClose, platform, onSuccess }: AddPlaceModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isIOS = platform === 'ios';

  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    region: '',
    district: '',
    phone: '',
    latitude: '',
    longitude: '',
    description: '',
    services: '',
    securityCode: '', // Daily rotating code
    // Working hours
    openingHours: '', // e.g., "09:00-22:00"
    workingDays: [] as string[], // e.g., ['monday', 'tuesday', ...]
    // Social media
    instagram: '',
    youtube: '',
    telegram: '',
  });

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableDistricts, setAvailableDistricts] = useState<District[]>([]);

  // Multiple images state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [perFileProgress, setPerFileProgress] = useState<number[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const overallPct = useMemo(() => {
    if (!perFileProgress.length) return null;
    const avg = perFileProgress.reduce((s, p) => s + p, 0) / perFileProgress.length;
    return Math.max(0, Math.min(100, Math.round(avg)));
  }, [perFileProgress]);

  // Calculate today's code
  const getTodayCode = () => {
    return '0099'; // Fixed secret code
  };

  // Update districts when region changes
  useEffect(() => {
    if (formData.region) {
      const region = regions.find(r => r.id === formData.region);
      setAvailableDistricts(region?.districts || []);
      setFormData(prev => ({ ...prev, district: '' }));
    } else {
      setAvailableDistricts([]);
    }
  }, [formData.region]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMultipleImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files).slice(0, 5); // Maximum 5 images
      
      // Add to existing images if not exceeding limit
      const currentCount = selectedImages.length;
      const availableSlots = 5 - currentCount;
      const newFiles = fileArray.slice(0, availableSlots);
      
      if (newFiles.length === 0) {
        setError('Maksimal 5 ta rasm yuklash mumkin');
        return;
      }
      
      setSelectedImages((prev) => [...prev, ...newFiles]);
      const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
      setImagePreviews((prev) => [...prev, ...newPreviews]);

      // Auto-upload immediately
      void (async () => {
        try {
          setIsUploading(true);
          setUploadProgress(0);
          const startIndex = uploadedImageUrls.length;
          setPerFileProgress((prev) => [...prev, ...newFiles.map(() => 0)]);

          uploadAbortRef.current?.abort();
          const controller = new AbortController();
          uploadAbortRef.current = controller;

          const results: string[] = [];
          for (let i = 0; i < newFiles.length; i++) {
            const file = await compressImageIfNeeded(newFiles[i]);
            const form = new FormData();
            form.append('file', file);

            const { data, status } = await uploadFormDataWithProgress<{ success?: boolean; url?: string; error?: string }>({
              url: `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/upload-place-image`,
              formData: form,
              headers: { Authorization: `Bearer ${publicAnonKey}` },
              abortSignal: controller.signal,
              onProgress: (pct) => {
                setPerFileProgress((prev) => {
                  const next = [...prev];
                  next[startIndex + i] = pct;
                  return next;
                });
              },
            });

            if (status < 200 || status >= 300 || !data?.success || !data?.url) {
              throw new Error(data?.error || `Upload xatolik (${status})`);
            }
            results.push(String(data.url));
          }

          setUploadedImageUrls((prev) => [...prev, ...results].slice(0, 5));
          setUploadProgress(100);
        } catch (err: any) {
          if (err?.name !== 'AbortError') setError(err?.message || 'Rasm yuklashda xatolik');
        } finally {
          setIsUploading(false);
          setTimeout(() => setUploadProgress(null), 800);
        }
      })();
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
    const url = imagePreviews[index];
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
    setUploadedImageUrls((prev) => prev.filter((_, i) => i !== index));
    setPerFileProgress((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate security code first
      const todayCode = getTodayCode().toString();
      if (!formData.securityCode || formData.securityCode !== todayCode) {
        setError(`Noto'g'ri maxfiy kod!`);
        setLoading(false);
        return;
      }

      if (isUploading) {
        setError('Rasmlar yuklanmoqda, iltimos kuting…');
        setLoading(false);
        return;
      }
      const imageUrls = uploadedImageUrls.slice(0, 5);
      const imageUrl = imageUrls[0] || '';

      // Parse services
      const servicesArray = formData.services
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Get region and district names
      const region = regions.find(r => r.id === formData.region);
      const district = region?.districts.find(d => d.id === formData.district);
      const location = district ? `${region?.name} ${district.name}` : region?.name || '';

      console.log('📍 Place location data:', {
        formRegion: formData.region,
        formDistrict: formData.district,
        regionName: region?.name,
        districtName: district?.name,
        location: location
      });

      // Create place
      const placeData = {
        name: formData.name,
        category: placeCategories.find(c => c.id === formData.categoryId)?.name || '',
        categoryId: formData.categoryId,
        image: imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
        images: imageUrls.length > 0 ? imageUrls : undefined,
        region: formData.region,
        district: formData.district,
        location: location,
        phone: formData.phone,
        coordinates: [
          parseFloat(formData.latitude) || 41.311,
          parseFloat(formData.longitude) || 69.279
        ],
        description: formData.description,
        services: servicesArray,
        isOpen: true,
        distance: '0 km',
        securityCode: formData.securityCode,
        // Working hours
        openingHours: formData.openingHours,
        workingDays: formData.workingDays,
        // Social media
        instagram: formData.instagram,
        youtube: formData.youtube,
        telegram: formData.telegram,
      };

      console.log('📦 Sending place data:', {
        name: placeData.name,
        region: placeData.region,
        district: placeData.district,
        categoryId: placeData.categoryId,
        coordinates: placeData.coordinates,
        imagesCount: imageUrls.length
      });

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/places`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(placeData),
        }
      );

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error response:', errorData);
        console.error('❌ Full error:', JSON.stringify(errorData, null, 2));
        throw new Error(errorData.error || 'Joy qo\'shishda xatolik');
      }

      const responseData = await response.json();
      console.log('✅ Success response:', responseData);

      // Success!
      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        name: '',
        categoryId: '',
        region: '',
        district: '',
        phone: '',
        latitude: '',
        longitude: '',
        description: '',
        services: '',
        securityCode: '',
        // Working hours
        openingHours: '',
        workingDays: [],
        // Social media
        instagram: '',
        youtube: '',
        telegram: '',
      });
      setSelectedImage(null);
      setImagePreview('');
      setSelectedImages([]);
      setImagePreviews([]);
      setUploadedImageUrls([]);
      setPerFileProgress([]);
    } catch (err: any) {
      console.error('Error creating place:', err);
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{
        background: isDark 
          ? 'rgba(0, 0, 0, 0.7)' 
          : 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
        // Safe area insets
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        style={{
          background: isDark
            ? (isIOS ? 'rgba(28, 28, 30, 0.98)' : '#1c1c1e')
            : (isIOS ? 'rgba(255, 255, 255, 0.98)' : '#ffffff'),
          backdropFilter: isIOS ? 'blur(40px)' : undefined,
          border: isDark
            ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.1)' : 'none')
            : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.1)' : 'none'),
          boxShadow: isDark
            ? '0 -4px 24px rgba(0, 0, 0, 0.4)'
            : '0 -4px 24px rgba(0, 0, 0, 0.1)',
          // Add margin for safe areas on mobile
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 border-b"
          style={{
            background: isDark
              ? (isIOS ? 'rgba(28, 28, 30, 0.98)' : '#1c1c1e')
              : (isIOS ? 'rgba(255, 255, 255, 0.98)' : '#ffffff'),
            backdropFilter: isIOS ? 'blur(40px)' : undefined,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold"
              style={{
                color: isDark ? '#ffffff' : '#000000',
              }}
            >
              Joy qo'shish
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full transition-all"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                color: isDark ? '#ffffff' : '#000000',
              }}
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl text-sm" style={{ background: '#ff3b3044', color: '#ff3b30' }}>
              {error}
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              📸 Rasmlar (3-5 ta)
            </label>

            {overallPct !== null && (
              <div
                className="mb-3 p-3 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span style={{ color: isDark ? '#fff' : '#111827' }}>
                    {isUploading ? '' : 'Tayyor'}
                  </span>
                  <span style={{ color: accentColor.color }}>{overallPct}%</span>
                </div>
                <div
                  className="mt-2 h-2 rounded-full overflow-hidden"
                  style={{ background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }}
                >
                  <div className="h-full rounded-full transition-all" style={{ width: `${overallPct}%`, background: accentColor.gradient }} />
                </div>
              </div>
            )}
            
            {/* Images Preview Grid */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden group">
                    <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(index);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-all p-2 rounded-full"
                        style={{ background: '#ff3b30' }}
                      >
                        <X className="size-4 text-white" />
                      </button>
                    </div>
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold" style={{ background: accentColor.color, color: '#ffffff' }}>
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            {imagePreviews.length < 5 && (
              <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed cursor-pointer transition-all hover:border-opacity-100"
                style={{
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                }}
              >
                <Upload className="size-8 mb-2" style={{ color: accentColor.color }} />
                <span className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  {imagePreviews.length === 0 ? 'Rasmlarni yuklang' : `Yana ${5 - imagePreviews.length} ta rasm qo'shing`}
                </span>
                <span className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  {imagePreviews.length}/5 rasm yuklangan
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultipleImagesSelect}
                  className="hidden"
                />
              </label>
            )}
            
            {imagePreviews.length >= 5 && (
              <div className="p-3 rounded-xl text-center" style={{ background: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>
                  ✅ Maksimal 5 ta rasm yuklandi
                </p>
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              Nomi *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl transition-all"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                color: isDark ? '#ffffff' : '#000000',
              }}
              placeholder="Masalan: Restoran 'O'zbegim'"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              Kategoriya *
            </label>
            <select
              required
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full px-4 py-3 rounded-xl transition-all"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                color: isDark ? '#ffffff' : '#000000',
              }}
            >
              <option value="" style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}>
                Kategoriya tanlang
              </option>
              {placeCategories.map((category) => (
                <option 
                  key={category.id} 
                  value={category.id}
                  style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}
                >
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Region */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              Viloyat *
            </label>
            <select
              required
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              className="w-full px-4 py-3 rounded-xl transition-all"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                color: isDark ? '#ffffff' : '#000000',
              }}
            >
              <option value="" style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}>
                Viloyat tanlang
              </option>
              {regions.map((region) => (
                <option 
                  key={region.id} 
                  value={region.id}
                  style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}
                >
                  {region.name}
                </option>
              ))}
            </select>
          </div>

          {/* District */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              Tuman *
            </label>
            <select
              required
              value={formData.district}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              disabled={!formData.region}
              className="w-full px-4 py-3 rounded-xl transition-all"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                color: isDark ? '#ffffff' : '#000000',
                opacity: !formData.region ? 0.5 : 1,
              }}
            >
              <option value="" style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}>
                {!formData.region ? 'Avval viloyat tanlang' : 'Tuman tanlang'}
              </option>
              {availableDistricts.map((district) => (
                <option 
                  key={district.id} 
                  value={district.id}
                  style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}
                >
                  {district.name}
                </option>
              ))}
            </select>
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-2"
                style={{ color: isDark ? '#ffffff' : '#000000' }}
              >
                Kenglik (Latitude)
              </label>
              <input
                type="text"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                className="w-full px-4 py-3 rounded-xl transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                  color: isDark ? '#ffffff' : '#000000',
                }}
                placeholder="41.311"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2"
                style={{ color: isDark ? '#ffffff' : '#000000' }}
              >
                Uzunlik (Longitude)
              </label>
              <input
                type="text"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                className="w-full px-4 py-3 rounded-xl transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                  color: isDark ? '#ffffff' : '#000000',
                }}
                placeholder="69.279"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              <Phone className="inline size-4 mr-1" />
              Telefon
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 rounded-xl transition-all"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                color: isDark ? '#ffffff' : '#000000',
              }}
              placeholder="+998 71 123-45-67"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              <FileText className="inline size-4 mr-1" />
              Tavsif
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-xl transition-all resize-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                color: isDark ? '#ffffff' : '#000000',
              }}
              placeholder="Qisqacha ma'lumot..."
            />
          </div>

          {/* Services */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              Xizmatlar (vergul bilan ajrating)
            </label>
            <input
              type="text"
              value={formData.services}
              onChange={(e) => setFormData({ ...formData, services: e.target.value })}
              className="w-full px-4 py-3 rounded-xl transition-all"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                color: isDark ? '#ffffff' : '#000000',
              }}
              placeholder="Wi-Fi, Parking, Yetkazib berish"
            />
          </div>

          {/* Working Hours */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              ⏰ Ish vaqti
            </label>
            <div className="space-y-3">
              {/* 24 Hours Toggle */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, openingHours: formData.openingHours === '24 soat' ? '' : '24 soat' })}
                className="w-full px-4 py-3 rounded-xl font-semibold transition-all"
                style={{
                  background: formData.openingHours === '24 soat'
                    ? accentColor.color
                    : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  color: formData.openingHours === '24 soat'
                    ? '#ffffff'
                    : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                  border: `1px solid ${formData.openingHours === '24 soat' ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)')}`,
                }}
              >
                🕐 24 soat ochiq
              </button>

              {/* Time Selectors */}
              {formData.openingHours !== '24 soat' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      Ochilish
                    </label>
                    <select
                      value={formData.openingHours.split('-')[0] || ''}
                      onChange={(e) => {
                        const closing = formData.openingHours.split('-')[1] || '22:00';
                        setFormData({ ...formData, openingHours: `${e.target.value}-${closing}` });
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-sm transition-all"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                        color: isDark ? '#ffffff' : '#000000',
                      }}
                    >
                      <option value="" style={{ background: isDark ? '#1c1c1e' : '#ffffff' }}>Tanlang</option>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                          <option key={hour} value={`${hour}:00`} style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}>
                            {hour}:00
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      Yopilish
                    </label>
                    <select
                      value={formData.openingHours.split('-')[1] || ''}
                      onChange={(e) => {
                        const opening = formData.openingHours.split('-')[0] || '09:00';
                        setFormData({ ...formData, openingHours: `${opening}-${e.target.value}` });
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-sm transition-all"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                        color: isDark ? '#ffffff' : '#000000',
                      }}
                    >
                      <option value="" style={{ background: isDark ? '#1c1c1e' : '#ffffff' }}>Tanlang</option>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                          <option key={hour} value={`${hour}:00`} style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}>
                            {hour}:00
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Working Days */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              📅 Ish kunlari
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'monday', label: 'Du' },
                { id: 'tuesday', label: 'Se' },
                { id: 'wednesday', label: 'Cho' },
                { id: 'thursday', label: 'Pa' },
                { id: 'friday', label: 'Ju' },
                { id: 'saturday', label: 'Sha' },
                { id: 'sunday', label: 'Ya' },
              ].map((day) => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => {
                    const days = formData.workingDays.includes(day.id)
                      ? formData.workingDays.filter(d => d !== day.id)
                      : [...formData.workingDays, day.id];
                    setFormData({ ...formData, workingDays: days });
                  }}
                  className="px-3 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: formData.workingDays.includes(day.id)
                      ? accentColor.color
                      : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: formData.workingDays.includes(day.id)
                      ? '#ffffff'
                      : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                    border: `1px solid ${formData.workingDays.includes(day.id) ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)')}`,
                  }}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Social Media */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              🌐 Ijtimoiy tarmoqlar
            </label>
            
            {/* Instagram */}
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                }}
              >
                <Instagram className="size-5 text-white" />
              </div>
              <input
                type="text"
                value={formData.instagram?.replace('https://www.instagram.com/', '').replace('https://instagram.com/', '').replace('www.instagram.com/', '').replace('instagram.com/', '') || ''}
                onChange={(e) => {
                  const username = e.target.value.trim();
                  setFormData({ 
                    ...formData, 
                    instagram: username ? `https://www.instagram.com/${username}` : '' 
                  });
                }}
                className="flex-1 px-4 py-3 rounded-xl transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                  color: isDark ? '#ffffff' : '#000000',
                }}
                placeholder="username"
              />
            </div>

            {/* YouTube */}
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: '#FF0000' }}
              >
                <Youtube className="size-5 text-white" />
              </div>
              <input
                type="text"
                value={formData.youtube?.replace('https://www.youtube.com/@', '').replace('https://youtube.com/@', '').replace('www.youtube.com/@', '').replace('youtube.com/@', '').replace('@', '') || ''}
                onChange={(e) => {
                  const username = e.target.value.trim().replace('@', '');
                  setFormData({ 
                    ...formData, 
                    youtube: username ? `https://www.youtube.com/@${username}` : '' 
                  });
                }}
                className="flex-1 px-4 py-3 rounded-xl transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                  color: isDark ? '#ffffff' : '#000000',
                }}
                placeholder="username"
              />
            </div>

            {/* Telegram */}
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: '#0088cc' }}
              >
                <Send className="size-5 text-white" />
              </div>
              <input
                type="text"
                value={formData.telegram?.replace('https://t.me/', '').replace('t.me/', '').replace('@', '') || ''}
                onChange={(e) => {
                  const username = e.target.value.trim().replace('@', '');
                  setFormData({ 
                    ...formData, 
                    telegram: username ? `https://t.me/${username}` : '' 
                  });
                }}
                className="flex-1 px-4 py-3 rounded-xl transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                  color: isDark ? '#ffffff' : '#000000',
                }}
                placeholder="username"
              />
            </div>
          </div>

          {/* Security Code */}
          <div>
            <label className="block text-sm font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}
            >
              <Key className="inline size-4 mr-1" />
              Maxfiy kod *
            </label>
            <input
              type="password"
              required
              value={formData.securityCode}
              onChange={(e) => setFormData({ ...formData, securityCode: e.target.value })}
              className="w-full px-4 py-3 rounded-xl transition-all text-center text-xl font-bold tracking-widest"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                color: isDark ? '#ffffff' : '#000000',
              }}
              placeholder="••••"
              maxLength={4}
            />
            <p className="text-xs mt-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)' }}>
              🔒 Maxfiy kodni kiriting
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              backgroundImage: accentColor.gradient,
              boxShadow: `0 8px 20px ${accentColor.color}44`,
            }}
          >
            {loading && <Loader2 className="w-6 h-6 animate-spin shrink-0" />}
            {loading ? '' : 'Qo\'shish'}
          </button>
        </form>
      </div>
    </div>
  );
}