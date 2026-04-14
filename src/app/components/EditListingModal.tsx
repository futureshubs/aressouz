import { useMemo, useRef, useEffect, useState } from 'react';
import { X, Upload, Plus, Trash2, Home, Car, ChevronRight, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { houseCategories } from '../data/houses';
import { carCategories } from '../data/cars';
import { regions } from '../data/regions';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { compressImageIfNeeded, uploadFormDataWithProgress } from '../utils/uploadWithProgress';
import { useVisibilityTick } from '../utils/visibilityRefetch';

interface EditListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: any; // The listing to edit
  accessToken: string;
  onSuccess: () => void;
}

export function EditListingModal({ isOpen, onClose, listing, accessToken, onSuccess }: EditListingModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const visibilityRefetchTick = useVisibilityTick();
  
  // Form state - initialized with listing data
  const [title, setTitle] = useState(listing?.title || '');
  const [description, setDescription] = useState(listing?.description || '');
  const [price, setPrice] = useState(listing?.price?.toString() || '');
  const [currency, setCurrency] = useState<'USD' | 'UZS'>(listing?.currency || 'UZS');
  const [categoryId, setCategoryId] = useState(listing?.categoryId || '');
  const [existingImages, setExistingImages] = useState<string[]>(listing?.images || []);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [uploadedNewImageUrls, setUploadedNewImageUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);
  
  const listingType = listing?.type; // 'house' or 'car'
  
  // House specific
  const [region, setRegion] = useState(listing?.region || '');
  const [district, setDistrict] = useState(listing?.district || '');
  const [address, setAddress] = useState(listing?.address || '');
  const [rooms, setRooms] = useState(listing?.rooms?.toString() || '');
  const [bathrooms, setBathrooms] = useState(listing?.bathrooms?.toString() || '');
  const [area, setArea] = useState(listing?.area?.toString() || '');
  const [floor, setFloor] = useState(listing?.floor?.toString() || '');
  const [totalFloors, setTotalFloors] = useState(listing?.totalFloors?.toString() || '');
  const [condition, setCondition] = useState<'yangi' | 'ta\'mirlangan' | 'oddiy'>(listing?.condition || 'oddiy');
  
  // Payment options
  const [paymentType, setPaymentType] = useState<'naqd' | 'kredit' | 'ipoteka' | 'barchasi'>(listing?.paymentType || 'barchasi');
  const [creditAvailable, setCreditAvailable] = useState(listing?.creditAvailable || false);
  const [mortgageAvailable, setMortgageAvailable] = useState(listing?.mortgageAvailable || false);
  const [creditTerm, setCreditTerm] = useState(listing?.creditTerm?.toString() || '');
  const [creditInterestRate, setCreditInterestRate] = useState(listing?.creditInterestRate?.toString() || '');
  const [initialPayment, setInitialPayment] = useState(listing?.initialPayment?.toString() || '');
  
  // Car specific
  const [brand, setBrand] = useState(listing?.brand || '');
  const [model, setModel] = useState(listing?.model || '');
  const [year, setYear] = useState(listing?.year?.toString() || '');
  const [color, setColor] = useState(listing?.color || '');
  const [mileage, setMileage] = useState(listing?.mileage?.toString() || '');
  const [fuelType, setFuelType] = useState(listing?.fuelType || '');
  const [transmission, setTransmission] = useState(listing?.transmission || '');
  const [seats, setSeats] = useState(listing?.seats?.toString() || '');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update form when listing changes
  useEffect(() => {
    if (listing) {
      setTitle(listing.title || '');
      setDescription(listing.description || '');
      setPrice(listing.price?.toString() || '');
      setCurrency(listing.currency || 'UZS');
      setCategoryId(listing.categoryId || '');
      setExistingImages(listing.images || []);
      setNewImagePreviews([]);
      setUploadedNewImageUrls([]);
      setUploadProgress([]);
      
      if (listing.type === 'house') {
        setRegion(listing.region || '');
        setDistrict(listing.district || '');
        setAddress(listing.address || '');
        setRooms(listing.rooms?.toString() || '');
        setBathrooms(listing.bathrooms?.toString() || '');
        setArea(listing.area?.toString() || '');
        setFloor(listing.floor?.toString() || '');
        setTotalFloors(listing.totalFloors?.toString() || '');
        setCondition(listing.condition || 'oddiy');
        setPaymentType(listing.paymentType || 'barchasi');
        setCreditAvailable(listing.creditAvailable || false);
        setMortgageAvailable(listing.mortgageAvailable || false);
        setCreditTerm(listing.creditTerm?.toString() || '');
        setCreditInterestRate(listing.creditInterestRate?.toString() || '');
        setInitialPayment(listing.initialPayment?.toString() || '');
      } else if (listing.type === 'car') {
        setBrand(listing.brand || '');
        setModel(listing.model || '');
        setYear(listing.year?.toString() || '');
        setColor(listing.color || '');
        setMileage(listing.mileage?.toString() || '');
        setFuelType(listing.fuelType || '');
        setTransmission(listing.transmission || '');
        setSeats(listing.seats?.toString() || '');
      }
    }
  }, [listing, visibilityRefetchTick]);

  const overallUploadPct = useMemo(() => {
    if (!uploadProgress.length) return null;
    const avg = uploadProgress.reduce((s, p) => s + p, 0) / uploadProgress.length;
    return Math.max(0, Math.min(100, Math.round(avg)));
  }, [uploadProgress]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (existingImages.length + newImagePreviews.length + files.length > 10) {
      setError('Maksimum 10 ta rasm yuklash mumkin');
      return;
    }
    
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    const startIndex = uploadedNewImageUrls.length;
    setNewImagePreviews((prev) => [...prev, ...newPreviews]);
    setUploadProgress((prev) => [...prev, ...files.map(() => 0)]);

    void (async () => {
      try {
        setIsUploadingImages(true);
        uploadAbortRef.current?.abort();
        const controller = new AbortController();
        uploadAbortRef.current = controller;

        const urls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = await compressImageIfNeeded(files[i]);
          const formData = new FormData();
          formData.append('file', file);
          formData.append('type', listingType === 'house' ? 'house' : 'car');
          formData.append('accessToken', accessToken);

          const { data, status } = await uploadFormDataWithProgress<{ url?: string; error?: string; message?: string }>({
            url: `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/upload-image`,
            formData,
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              'X-Access-Token': accessToken,
            },
            abortSignal: controller.signal,
            onProgress: (pct) => {
              setUploadProgress((prev) => {
                const next = [...prev];
                next[startIndex + i] = pct;
                return next;
              });
            },
          });

          if (status < 200 || status >= 300 || !data?.url) {
            throw new Error(data?.error || data?.message || `Rasm yuklashda xatolik (${status})`);
          }
          urls.push(String(data.url));
        }

        setUploadedNewImageUrls((prev) => [...prev, ...urls].slice(0, 10));
      } catch (err: any) {
        if (err?.name !== 'AbortError') setError(err?.message || 'Rasm yuklashda xatolik');
      } finally {
        setIsUploadingImages(false);
      }
    })();
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    const url = newImagePreviews[index];
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setUploadedNewImageUrls((prev) => prev.filter((_, i) => i !== index));
    setUploadProgress((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || !description || !price || !categoryId) {
      setError('Barcha majburiy maydonlarni to\'ldiring');
      return;
    }

    if (existingImages.length + uploadedNewImageUrls.length === 0) {
      setError('Kamida 1 ta rasm bo\'lishi kerak');
      return;
    }

    if (listingType === 'house' && (!region || !district || !rooms || !area)) {
      setError('Uy uchun barcha maydonlarni to\'ldiring');
      return;
    }

    if (listingType === 'car' && (!brand || !model || !year || !color)) {
      setError('Moshina uchun barcha maydonlarni to\'ldiring');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      console.log('🔄 ===== UPDATING LISTING =====');
      console.log('📋 Listing ID:', listing.id);
      if (isUploadingImages) {
        throw new Error('Rasmlar yuklanmoqda, iltimos kuting…');
      }

      // Combine existing and new images
      const allImageUrls = [...existingImages, ...uploadedNewImageUrls];

      // Update listing
      const updatedData = {
        title,
        description,
        price: parseFloat(price),
        currency,
        categoryId,
        images: allImageUrls,
        ...(listingType === 'house' ? {
          region,
          district,
          address,
          rooms: parseInt(rooms),
          bathrooms: parseInt(bathrooms),
          area: parseFloat(area),
          floor: parseInt(floor),
          totalFloors: parseInt(totalFloors),
          condition,
          paymentType,
          creditAvailable,
          mortgageAvailable,
          creditTerm: creditTerm ? parseInt(creditTerm) : undefined,
          creditInterestRate: creditInterestRate ? parseFloat(creditInterestRate) : undefined,
          initialPayment: initialPayment ? parseFloat(initialPayment) : undefined,
        } : {
          brand,
          model,
          year: parseInt(year),
          color,
          mileage: mileage ? parseInt(mileage) : undefined,
          fuelType,
          transmission,
          seats: parseInt(seats),
          condition: condition === 'yangi' ? 'Yangi' : 'Ishlatilgan',
        }),
      };

      console.log('📝 Updating with data:', updatedData);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/listings/${listing.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedData),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Update failed:', errorText);
        throw new Error('E\'lonni yangilashda xatolik');
      }

      const result = await res.json();
      console.log('✅ Listing updated:', result);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating listing:', err);
      setError(err.message || 'E\'lonni yangilashda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCategory = listingType === 'house' 
    ? houseCategories.find(c => c.id === categoryId)
    : carCategories.find(c => c.id === categoryId);

  const selectedRegion = regions.find(r => r.name === region);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)' }}
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[90vh] rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(26, 26, 26, 0.98), rgba(18, 18, 18, 0.98))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.98))',
          backdropFilter: 'blur(40px)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark 
            ? '0 25px 80px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 20px 60px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }}
        >
          <h2 className="text-xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
            E'lonni tahrirlash
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <X className="size-5" style={{ color: isDark ? '#ffffff' : '#374151' }} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
              Sarlavha *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl outline-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                color: isDark ? '#ffffff' : '#111827',
              }}
              placeholder="Masalan: 3 xonali kvartira..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
              Ta'rif *
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl outline-none resize-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                color: isDark ? '#ffffff' : '#111827',
              }}
              placeholder="Batafsil ma'lumot..."
            />
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                Narx *
              </label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                  color: isDark ? '#ffffff' : '#111827',
                }}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                Valyuta *
              </label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as 'USD' | 'UZS')}
                className="w-full px-4 py-3 rounded-xl outline-none"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                  color: isDark ? '#ffffff' : '#111827',
                }}
              >
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
              Kategoriya *
            </label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl outline-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                color: isDark ? '#ffffff' : '#111827',
              }}
            >
              <option value="">Tanlang...</option>
              {(listingType === 'house' ? houseCategories : carCategories).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* House specific fields */}
          {listingType === 'house' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    Viloyat *
                  </label>
                  <select
                    value={region}
                    onChange={e => {
                      setRegion(e.target.value);
                      setDistrict('');
                    }}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  >
                    <option value="">Tanlang...</option>
                    {regions.map(r => (
                      <option key={r.name} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    Tuman *
                  </label>
                  <select
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    disabled={!region}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#111827',
                      opacity: !region ? 0.5 : 1,
                    }}
                  >
                    <option value="">Tanlang...</option>
                    {selectedRegion?.districts.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    Xonalar *
                  </label>
                  <input
                    type="number"
                    value={rooms}
                    onChange={e => setRooms(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    Maydon (m²) *
                  </label>
                  <input
                    type="number"
                    value={area}
                    onChange={e => setArea(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="65"
                  />
                </div>
              </div>
            </>
          )}

          {/* Car specific fields */}
          {listingType === 'car' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    Marka *
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="Toyota"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    Model *
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="Camry"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    Yil *
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="2020"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    Rang *
                  </label>
                  <input
                    type="text"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                    placeholder="Qora"
                  />
                </div>
              </div>
            </>
          )}

          {/* Images */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
              Rasmlar * (maksimum 10 ta)
            </label>

            {overallUploadPct !== null && (
              <div
                className="mb-3 p-3 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span style={{ color: isDark ? '#fff' : '#111827' }}>
                    {isUploadingImages ? 'Yuklanmoqda…' : 'Tayyor'}
                  </span>
                  <span style={{ color: accentColor.color }}>{overallUploadPct}%</span>
                </div>
                <div
                  className="mt-2 h-2 rounded-full overflow-hidden"
                  style={{ background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }}
                >
                  <div className="h-full rounded-full transition-all" style={{ width: `${overallUploadPct}%`, background: accentColor.gradient }} />
                </div>
              </div>
            )}
            
            {/* Existing Images */}
            {existingImages.length > 0 && (
              <div className="mb-3">
                <p className="text-xs mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Mavjud rasmlar:
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {existingImages.map((img, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden group">
                      <img src={img} alt={`Rasm ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeExistingImage(index)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Images */}
            {newImagePreviews.length > 0 && (
              <div className="mb-3">
                <p className="text-xs mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Yangi rasmlar:
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {newImagePreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden group">
                      <img src={preview} alt={`Yangi rasm ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeNewImage(index)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Button */}
            {existingImages.length + newImagePreviews.length < 10 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 rounded-xl border-2 border-dashed transition-all active:scale-98"
                style={{
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="size-6" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                  <p className="text-sm font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    Rasm qo'shish
                  </p>
                </div>
              </button>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/50">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-4 border-t flex gap-3"
          style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl font-semibold transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? '#ffffff' : '#374151',
            }}
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isUploadingImages}
            className="flex-1 py-3 px-4 rounded-xl font-semibold transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              backgroundImage: accentColor.gradient,
              color: '#ffffff',
              boxShadow: isDark 
                ? `0 4px 16px ${accentColor.color}66` 
                : `0 3px 12px ${accentColor.color}4d`,
            }}
          >
            {isSubmitting && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
            {isSubmitting ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
