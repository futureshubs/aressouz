import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  MapPin, 
  Phone, 
  Clock,
  Image as ImageIcon,
  Loader2,
  Save,
  X,
  Star,
  Eye,
  Upload,
  FileText,
  Key,
  Instagram,
  Youtube,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

// Dynamic place categories state
interface PlaceCategory {
  id: string;
  name: string;
  icon: string;
}

interface Place {
  id: string;
  branchId: string;
  name: string;
  categoryId: string;
  description: string;
  phone: string;
  address: string;
  region: string;
  district: string;
  workingHours: string;
  image: string;
  images?: string[];
  rating?: number;
  reviews?: number;
  coordinates?: number[];
  services?: string[];
  openingHours?: string;
  workingDays?: string[];
  instagram?: string;
  youtube?: string;
  telegram?: string;
  createdAt: string;
  updatedAt: string;
}

interface PlacesManagementProps {
  branchId: string;
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
  };
}

export default function PlacesManagement({ branchId, branchInfo }: PlacesManagementProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    description: '',
    phone: branchInfo?.phone || '',
    address: '',
    services: '',
    latitude: '',
    longitude: '',
    openingHours: '',
    workingDays: [] as string[],
    instagram: '',
    youtube: '',
    telegram: '',
  });

  // Images state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [localImagePreviews, setLocalImagePreviews] = useState<string[]>([]);
  const [remoteImageUrls, setRemoteImageUrls] = useState<string[]>([]);
  const [uploadItems, setUploadItems] = useState<
    {
      id: string;
      name: string;
      previewUrl: string;
      file: File;
      size: number;
      progress: number; // 0..100
      status: 'uploading' | 'error';
      error?: string;
    }[]
  >([]);
  const [placeCategories, setPlaceCategories] = useState<PlaceCategory[]>([]);
  const visibilityRefetchTick = useVisibilityTick();

  const allImagePreviews = [...remoteImageUrls, ...localImagePreviews];
  const uploadXhrsRef = useRef<Record<string, XMLHttpRequest>>({});
  const isUploading = uploadItems.some((it) => it.status === 'uploading');

  const overallUploadProgress = useMemo(() => {
    const items = uploadItems.filter((it) => it.status === 'uploading');
    if (items.length === 0) return null;
    const totalBytes = items.reduce((sum, it) => sum + (it.size || 0), 0) || 1;
    const loadedBytes = items.reduce((sum, it) => sum + (it.size * (it.progress / 100)), 0);
    return Math.max(0, Math.min(100, Math.round((loadedBytes / totalBytes) * 100)));
  }, [uploadItems]);

  const revokeLocalPreviewUrl = (url: string) => {
    try {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const compressImageIfNeeded = async (file: File) => {
    // Skip tiny images
    if (file.size <= 600_000) return file;
    if (!file.type.startsWith('image/')) return file;

    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    if (!blob) return file;
    const compressed = new File([blob], file.name.replace(/\.(png|webp|jpeg|jpg)$/i, '.jpg'), { type: 'image/jpeg' });
    return compressed.size < file.size ? compressed : file;
  };

  const uploadPlaceImage = async (file: File) => {
    const form = new FormData();
    form.append('file', file);

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/upload-place-image`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Rasm yuklashda xatolik (${response.status}) ${text}`);
    }
    const data = await response.json();
    if (!data?.success || !data?.url) {
      throw new Error('Rasm yuklashda xatolik');
    }
    return String(data.url);
  };

  const uploadPlaceImageWithProgress = async (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    uploadXhrsRef.current[id] = xhr;

    const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/upload-place-image`;

    const promise = new Promise<string>((resolve, reject) => {
      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
        setUploadItems((prev) => prev.map((it) => (it.id === id ? { ...it, progress: pct } : it)));
      };

      xhr.onerror = () => reject(new Error('Rasm yuklashda tarmoq xatoligi'));
      xhr.onabort = () => reject(new Error('Bekor qilindi'));
      xhr.onload = () => {
        try {
          const ok = xhr.status >= 200 && xhr.status < 300;
          if (!ok) {
            reject(new Error(`Rasm yuklashda xatolik (${xhr.status})`));
            return;
          }
          const json = JSON.parse(xhr.responseText || '{}');
          if (!json?.success || !json?.url) {
            reject(new Error('Rasm yuklashda xatolik'));
            return;
          }
          resolve(String(json.url));
        } catch (e: any) {
          reject(new Error(e?.message || 'Rasm yuklashda xatolik'));
        }
      };
    });

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${publicAnonKey}`);
    xhr.send(form);

    return promise.finally(() => {
      delete uploadXhrsRef.current[id];
    });
  };

  const uploadImagesWithConcurrency = async (files: File[], concurrency = 3) => {
    const results: string[] = [];
    let idx = 0;

    const workers = Array.from({ length: Math.min(concurrency, files.length) }).map(async () => {
      while (idx < files.length) {
        const current = files[idx];
        idx += 1;
        const compressed = await compressImageIfNeeded(current);
        const url = await uploadPlaceImage(compressed);
        results.push(url);
      }
    });

    await Promise.all(workers);
    return results;
  };

  const startUploadQueue = async (items: { id: string; file: File; previewUrl: string }[], concurrency = 3) => {
    let idx = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }).map(async () => {
      while (idx < items.length) {
        const current = items[idx];
        idx += 1;

        try {
          const compressed = await compressImageIfNeeded(current.file);
          const remoteUrl = await uploadPlaceImageWithProgress(current.id, compressed);

          setRemoteImageUrls((prev) => (prev.length >= 5 ? prev : [...prev, remoteUrl].slice(0, 5)));
          setUploadItems((prev) => prev.filter((it) => it.id !== current.id));
          setLocalImagePreviews((prev) => {
            revokeLocalPreviewUrl(current.previewUrl);
            return prev.filter((p) => p !== current.previewUrl);
          });
          setSelectedImages((prev) => prev.filter((f) => f !== current.file));
        } catch (err: any) {
          setUploadItems((prev) =>
            prev.map((it) =>
              it.id === current.id ? { ...it, status: 'error', error: err?.message || 'Upload xatolik' } : it
            )
          );
        }
      }
    });
    await Promise.all(workers);
  };

  // Load place categories from API
  const loadPlaceCategories = async () => {
    try {
      console.log('🏢 Loading place categories for branch:', branchId);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/place-categories`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // Mock data fallback
        const mockPlaceCategories: PlaceCategory[] = [
          {
            id: 'place_cat_1',
            name: 'Restoranlar',
            icon: '🍽️'
          },
          {
            id: 'place_cat_2',
            name: 'Qahvaxonalar',
            icon: '☕'
          },
          {
            id: 'place_cat_3',
            name: 'Fast Food',
            icon: '🍔'
          },
          {
            id: 'place_cat_4',
            name: 'Shirinlik do\'konlari',
            icon: '🧁'
          },
          {
            id: 'place_cat_5',
            name: 'Ichkilik do\'konlari',
            icon: '🍺'
          },
          {
            id: 'place_cat_6',
            name: 'Qovunqoratxona',
            icon: '🏪'
          }
        ];
        
        setPlaceCategories([]);
        console.error('❌ Place categories API response not ok:', response.status, response.statusText);
        toast.error('Joy kategoriyalarini yuklashda xatolik');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setPlaceCategories(data.data);
        console.log('✅ Place categories loaded from API:', data.data);
      }
    } catch (error) {
      console.error('❌ Error loading place categories:', error);
      // Don't show error toast for now since we're using mock data
      // toast.error('Joy kategoriyalarini yuklashda xatolik');
    }
  };

  // Load places
  useEffect(() => {
    loadPlaceCategories();
    loadPlaces();
  }, [branchId, visibilityRefetchTick]);

  const loadPlaces = async () => {
    try {
      setIsLoading(true);
      
      console.log('📍 Loading places for branch:', {
        branchId,
        region: branchInfo?.region,
        district: branchInfo?.district
      });
      
      // Load all places in this region/district, not just branch places
      const params = new URLSearchParams();
      if (branchInfo?.region) params.append('region', branchInfo.region);
      if (branchInfo?.district) params.append('district', branchInfo.district);
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/places?${params}`;
      
      console.log('🔗 Fetching from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Joylarni yuklashda xatolik');
      }

      const data = await response.json();
      console.log('📦 Places loaded:', data.places?.length || 0);
      console.log('📍 Sample place:', data.places?.[0]);
      
      setPlaces(data.places || []);
    } catch (error) {
      console.error('❌ Load places error:', error);
      toast.error('Joylarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMultipleImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files).slice(0, 5);
    const currentCount = remoteImageUrls.length + localImagePreviews.length;
    const availableSlots = 5 - currentCount;
    const newFiles = fileArray.slice(0, availableSlots);

    if (newFiles.length === 0) {
      setError('Maksimal 5 ta rasm yuklash mumkin');
      return;
    }

    const items = newFiles.map((file) => {
      const id = `upl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const previewUrl = URL.createObjectURL(file);
      return { id, file, previewUrl };
    });

    setSelectedImages((prev) => [...prev, ...items.map((i) => i.file)]);
    setLocalImagePreviews((prev) => [...prev, ...items.map((i) => i.previewUrl)]);
    setUploadItems((prev) => [
      ...prev,
      ...items.map((i) => ({
        id: i.id,
        name: i.file.name,
        previewUrl: i.previewUrl,
        file: i.file,
        size: i.file.size,
        progress: 0,
        status: 'uploading' as const,
      })),
    ]);

    // Start uploading immediately (do NOT wait for Save)
    void startUploadQueue(items, 3);
  };

  const removeImage = (index: number) => {
    if (index < remoteImageUrls.length) {
      setRemoteImageUrls((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    const localIndex = index - remoteImageUrls.length;
    const previewUrl = localImagePreviews[localIndex];
    if (previewUrl) {
      const item = uploadItems.find((it) => it.previewUrl === previewUrl);
      if (item) {
        const xhr = uploadXhrsRef.current[item.id];
        if (xhr) xhr.abort();
        setUploadItems((prev) => prev.filter((it) => it.id !== item.id));
        setSelectedImages((prev) => prev.filter((f) => f !== item.file));
      }
      setLocalImagePreviews((prev) => {
        revokeLocalPreviewUrl(previewUrl);
        return prev.filter((p) => p !== previewUrl);
      });
    }
  };

  const handleSubmit = async () => {
    setError('');
    
    // Validation
    if (!formData.name || !formData.categoryId) {
      setError('Nom va kategoriya majburiy');
      return;
    }

    if (!branchInfo?.region || !branchInfo?.district) {
      setError('Filial ma\'lumotlarida viloyat/tuman ko\'rsatilmagan');
      return;
    }

    if (isUploading) {
      setError('Rasmlar yuklanmoqda. Iltimos, yuklash tugashini kuting.');
      return;
    }

    try {
      setIsSaving(true);

      // Upload local images to storage first (fast, no base64 JSON)
      const imageUrls = [...remoteImageUrls].slice(0, 5);

      // Parse services
      const servicesArray = formData.services
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const placeData = {
        branchId,
        name: formData.name,
        categoryId: formData.categoryId,
        description: formData.description,
        phone: formData.phone,
        address: formData.address,
        region: branchInfo.region,
        district: branchInfo.district,
        workingHours: formData.openingHours,
        image: imageUrls[0] || '',
        images: imageUrls,
        coordinates: [
          parseFloat(formData.latitude) || 41.311,
          parseFloat(formData.longitude) || 69.279
        ],
        services: servicesArray,
        openingHours: formData.openingHours,
        workingDays: formData.workingDays,
        instagram: formData.instagram,
        youtube: formData.youtube,
        telegram: formData.telegram,
      };

      const url = editingId
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-places/${editingId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-places`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(placeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Joy saqlashda xatolik');
      }

      toast.success(editingId ? 'Joy yangilandi' : 'Joy yaratildi');
      setIsModalOpen(false);
      resetForm();
      loadPlaces();
    } catch (err: any) {
      console.error('Save place error:', err);
      setError(err.message || 'Joy saqlashda xatolik');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (place: Place) => {
    setEditingId(place.id);
    setFormData({
      name: place.name,
      categoryId: place.categoryId,
      description: place.description || '',
      phone: place.phone || '',
      address: place.address || '',
      services: place.services?.join(', ') || '',
      latitude: place.coordinates?.[0]?.toString() || '',
      longitude: place.coordinates?.[1]?.toString() || '',
      openingHours: place.openingHours || '',
      workingDays: place.workingDays || [],
      instagram: place.instagram || '',
      youtube: place.youtube || '',
      telegram: place.telegram || '',
    });
    
    // Remote images (already uploaded URLs)
    const remote = place.images && place.images.length > 0
      ? place.images
      : (place.image ? [place.image] : []);
    setRemoteImageUrls(remote.slice(0, 5));
    // Reset local selections
    selectedImages.forEach(() => {});
    localImagePreviews.forEach(revokeLocalPreviewUrl);
    setSelectedImages([]);
    setLocalImagePreviews([]);
    
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Joy o\'chirilsinmi?')) return;

    const prevPlaces = places;
    setPlaces((prev) => prev.filter((p) => p.id !== id));

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-places/${id}?branchId=${branchId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Joy o\'chirishda xatolik');
      }

      toast.success('Joy o\'chirildi');
    } catch (error: any) {
      console.error('Delete place error:', error);
      setPlaces(prevPlaces);
      toast.error(error.message || 'Joy o\'chirishda xatolik');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      categoryId: '',
      description: '',
      phone: branchInfo?.phone || '',
      address: '',
      services: '',
      latitude: '',
      longitude: '',
      openingHours: '',
      workingDays: [],
      instagram: '',
      youtube: '',
      telegram: '',
    });
    setSelectedImages([]);
    localImagePreviews.forEach(revokeLocalPreviewUrl);
    setLocalImagePreviews([]);
    setRemoteImageUrls([]);
    setError('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Atrof Joylar</h2>
          <p 
            className="text-sm mt-1"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            Hududingizdagi joylarni qo'shing
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
          <span>Joy qo'shish</span>
        </button>
      </div>

      {/* Places Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
        </div>
      ) : places.length === 0 ? (
        <div
          className="text-center py-16 rounded-3xl border"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="text-4xl mb-4">📍</div>
          <h3 className="text-xl font-bold mb-2">Hali joylar yo'q</h3>
          <p 
            className="text-sm"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            Birinchi joyni qo'shish uchun "Joy qo'shish" tugmasini bosing
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {places.map((place) => {
            const category = placeCategories.find(c => c.id === place.categoryId);
            return (
              <div
                key={place.id}
                className="rounded-3xl border overflow-hidden"
                style={{
                  background: isDark 
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                    : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* Image */}
                {place.image ? (
                  <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 relative">
                    <img 
                      src={place.image} 
                      alt={place.name}
                      className="w-full h-full object-cover"
                    />
                    {place.images && place.images.length > 1 && (
                      <div 
                        className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-xs font-bold text-white"
                        style={{ background: 'rgba(0, 0, 0, 0.7)' }}
                      >
                        +{place.images.length - 1}
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
                  {category && (
                    <div 
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold mb-3"
                      style={{ background: `${accentColor.color}20`, color: accentColor.color }}
                    >
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                    </div>
                  )}

                  {/* Name */}
                  <h3 className="font-bold text-lg mb-2">
                    {place.name}
                  </h3>

                  {/* Description */}
                  {place.description && (
                    <p 
                      className="text-sm mb-3 line-clamp-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      {place.description}
                    </p>
                  )}

                  {/* Address */}
                  {place.address && (
                    <div 
                      className="flex items-center gap-2 text-sm mb-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{place.address}</span>
                    </div>
                  )}

                  {/* Phone */}
                  {place.phone && (
                    <div 
                      className="flex items-center gap-2 text-sm mb-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      <Phone className="w-4 h-4" />
                      <span>{place.phone}</span>
                    </div>
                  )}

                  {/* Working Hours */}
                  {place.openingHours && (
                    <div 
                      className="flex items-center gap-2 text-sm mb-3"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      <Clock className="w-4 h-4" />
                      <span>{place.openingHours}</span>
                    </div>
                  )}

                  {/* Stats */}
                  {(place.rating || place.reviews) && (
                    <div 
                      className="flex items-center gap-4 mb-3 text-sm"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      {place.rating && place.rating > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span>{place.rating.toFixed(1)}</span>
                        </div>
                      )}
                      {place.reviews !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-4 h-4" />
                          <span>{place.reviews} sharh</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions - Show for all places */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(place)}
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
                      onClick={() => handleDelete(place.id)}
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
                  
                  {/* Badge for this branch's places */}
                  {place.branchId === branchId && (
                    <div className="mt-3">
                      <div 
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
                        style={{ background: `${accentColor.color}15`, color: accentColor.color }}
                      >
                        <span>✓</span>
                        <span>Sizning joyingiz</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 app-safe-pad z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[95vh] rounded-3xl overflow-hidden flex flex-col"
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
                {editingId ? 'Joy tahrirlash' : 'Yangi joy qo\'shish'}
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
              <div className="space-y-4">
                {error && (
                  <div className="p-3 rounded-xl text-sm" style={{ background: '#ff3b3044', color: '#ff3b30' }}>
                    {error}
                  </div>
                )}

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    📸 Rasmlar (3-5 ta)
                  </label>

                  {overallUploadProgress !== null && (
                    <div
                      className="mb-3 p-3 rounded-2xl border"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                      }}
                    >
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span></span>
                        <span>{overallUploadProgress}%</span>
                      </div>
                      <div
                        className="mt-2 h-2 rounded-full overflow-hidden"
                        style={{ background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${overallUploadProgress}%`, background: accentColor.gradient }}
                        />
                      </div>

                      {uploadItems.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {uploadItems.map((it) => (
                            <div key={it.id} className="text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className="truncate"
                                  style={{ color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.70)' }}
                                >
                                  {it.name}
                                </span>
                                <span style={{ color: it.status === 'error' ? '#ff3b30' : accentColor.color }}>
                                  {it.status === 'error' ? 'Xato' : `${it.progress}%`}
                                </span>
                              </div>
                              <div
                                className="mt-1 h-1.5 rounded-full overflow-hidden"
                                style={{ background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }}
                              >
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${it.progress}%`,
                                    background: it.status === 'error' ? '#ff3b30' : accentColor.gradient,
                                  }}
                                />
                              </div>
                              {it.status === 'error' && it.error && (
                                <div className="mt-1" style={{ color: '#ff3b30' }}>
                                  {it.error}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Images Preview Grid */}
                  {allImagePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {allImagePreviews.map((preview, index) => (
                        <div key={index} className="relative aspect-square rounded-xl overflow-hidden group">
                          <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="opacity-0 group-hover:opacity-100 transition-all p-2 rounded-full"
                              style={{ background: '#ff3b30' }}
                            >
                              <X className="w-4 h-4 text-white" />
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
                  {allImagePreviews.length < 5 && (
                    <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed cursor-pointer transition-all"
                      style={{
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      <Upload className="w-8 h-8 mb-2" style={{ color: accentColor.color }} />
                      <span className="text-sm font-semibold">
                        {allImagePreviews.length === 0 ? 'Rasmlarni yuklang' : `Yana ${5 - allImagePreviews.length} ta rasm qo'shing`}
                      </span>
                      <span className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                        {allImagePreviews.length}/5 rasm yuklangan
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
                  
                  {allImagePreviews.length >= 5 && (
                    <div className="p-3 rounded-xl text-center" style={{ background: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>
                        ✅ Maksimal 5 ta rasm yuklandi
                      </p>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Nomi *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Masalan: Restoran 'O'zbegim'"
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                      color: isDark ? '#ffffff' : '#000000',
                    }}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Kategoriya *
                  </label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl outline-none"
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

                {/* Coordinates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Kenglik (Latitude)
                    </label>
                    <input
                      type="text"
                      value={formData.latitude}
                      onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                      placeholder="41.311"
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                        color: isDark ? '#ffffff' : '#000000',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Uzunlik (Longitude)
                    </label>
                    <input
                      type="text"
                      value={formData.longitude}
                      onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                      placeholder="69.279"
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                        color: isDark ? '#ffffff' : '#000000',
                      }}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    <Phone className="inline w-4 h-4 mr-1" />
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+998 71 123-45-67"
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                      color: isDark ? '#ffffff' : '#000000',
                    }}
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    Manzil
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="To'liq manzil..."
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                      color: isDark ? '#ffffff' : '#000000',
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    <FileText className="inline w-4 h-4 mr-1" />
                    Tavsif
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Qisqacha ma'lumot..."
                    className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                      color: isDark ? '#ffffff' : '#000000',
                    }}
                  />
                </div>

                {/* Services */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Xizmatlar (vergul bilan ajrating)
                  </label>
                  <input
                    type="text"
                    value={formData.services}
                    onChange={(e) => setFormData(prev => ({ ...prev, services: e.target.value }))}
                    placeholder="Wi-Fi, Parking, Yetkazib berish"
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                      color: isDark ? '#ffffff' : '#000000',
                    }}
                  />
                </div>

                {/* Working Hours */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    ⏰ Ish vaqti
                  </label>
                  <div className="space-y-3">
                    {/* 24 Hours Toggle */}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, openingHours: prev.openingHours === '24 soat' ? '' : '24 soat' }))}
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
                              setFormData(prev => ({ ...prev, openingHours: `${e.target.value}-${closing}` }));
                            }}
                            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
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
                              setFormData(prev => ({ ...prev, openingHours: `${opening}-${e.target.value}` }));
                            }}
                            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
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
                  <label className="block text-sm font-semibold mb-2">
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
                          setFormData(prev => ({ ...prev, workingDays: days }));
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
                  <label className="block text-sm font-semibold">
                    🌐 Ijtimoiy tarmoqlar
                  </label>
                  
                  {/* Instagram */}
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                      }}
                    >
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                    <input
                      type="text"
                      value={formData.instagram?.replace('https://www.instagram.com/', '').replace('https://instagram.com/', '').replace('www.instagram.com/', '').replace('instagram.com/', '') || ''}
                      onChange={(e) => {
                        const username = e.target.value.trim();
                        setFormData(prev => ({ 
                          ...prev, 
                          instagram: username ? `https://www.instagram.com/${username}` : '' 
                        }));
                      }}
                      placeholder="username"
                      className="flex-1 px-4 py-3 rounded-xl outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                        color: isDark ? '#ffffff' : '#000000',
                      }}
                    />
                  </div>

                  {/* YouTube */}
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: '#FF0000' }}
                    >
                      <Youtube className="w-5 h-5 text-white" />
                    </div>
                    <input
                      type="text"
                      value={formData.youtube?.replace('https://www.youtube.com/@', '').replace('https://youtube.com/@', '').replace('www.youtube.com/@', '').replace('youtube.com/@', '').replace('@', '') || ''}
                      onChange={(e) => {
                        const username = e.target.value.trim().replace('@', '');
                        setFormData(prev => ({ 
                          ...prev, 
                          youtube: username ? `https://www.youtube.com/@${username}` : '' 
                        }));
                      }}
                      placeholder="username"
                      className="flex-1 px-4 py-3 rounded-xl outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                        color: isDark ? '#ffffff' : '#000000',
                      }}
                    />
                  </div>

                  {/* Telegram */}
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: '#0088cc' }}
                    >
                      <Send className="w-5 h-5 text-white" />
                    </div>
                    <input
                      type="text"
                      value={formData.telegram?.replace('https://t.me/', '').replace('t.me/', '').replace('@', '') || ''}
                      onChange={(e) => {
                        const username = e.target.value.trim().replace('@', '');
                        setFormData(prev => ({ 
                          ...prev, 
                          telegram: username ? `https://t.me/${username}` : '' 
                        }));
                      }}
                      placeholder="username"
                      className="flex-1 px-4 py-3 rounded-xl outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                        color: isDark ? '#ffffff' : '#000000',
                      }}
                    />
                  </div>
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
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span></span>
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