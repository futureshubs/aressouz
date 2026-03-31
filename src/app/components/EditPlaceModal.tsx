import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Phone, Clock, FileText, Tag, Image as ImageIcon, Instagram, Youtube, Send, Key, Navigation } from 'lucide-react';
import { Place, placeCategories } from '../data/places';
import { useTheme } from '../context/ThemeContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { regions } from '../data/regions';
import { toast } from 'sonner';
import { useVisibilityTick } from '../utils/visibilityRefetch';

interface EditPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  place: Place;
  onSuccess: () => void;
}

// Calculate today's code
const getTodayCode = () => {
  return '0099'; // Fixed secret code
};

export function EditPlaceModal({ isOpen, onClose, place, onSuccess }: EditPlaceModalProps) {
  const { theme, accentColor } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: place.name,
    categoryId: place.categoryId,
    phone: place.phone,
    region: place.region || '',
    district: place.district || '',
    latitude: place.latitude || '',
    longitude: place.longitude || '',
    openingHours: place.openingHours || '',
    description: place.description || '',
    services: place.services?.join(', ') || '',
    workingDays: (place as any).workingDays || [],
    instagram: (place as any).instagram || '',
    youtube: (place as any).youtube || '',
    telegram: (place as any).telegram || '',
    securityCode: '',
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(place.image || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isDark = theme === 'dark';
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: place.name,
        categoryId: place.categoryId,
        phone: place.phone,
        region: place.region || '',
        district: place.district || '',
        latitude: place.latitude || '',
        longitude: place.longitude || '',
        openingHours: place.openingHours || '',
        description: place.description || '',
        services: place.services?.join(', ') || '',
        workingDays: (place as any).workingDays || [],
        instagram: (place as any).instagram || '',
        youtube: (place as any).youtube || '',
        telegram: (place as any).telegram || '',
        securityCode: '',
      });
      setImageFile(null);
      setImagePreview(place.image || '');
      setError('');
    }
  }, [isOpen, place, visibilityRefetchTick]);

  if (!isOpen) return null;

  const selectedRegion = regions.find(r => r.id === formData.region);
  const districts = selectedRegion?.districts || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.categoryId || !formData.phone) {
      setError('Barcha majburiy maydonlarni to\'ldiring');
      return;
    }

    const todayCode = getTodayCode().toString();
    if (!formData.securityCode || formData.securityCode !== todayCode) {
      setError(`Noto'g'ri maxfiy kod!`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      let imageUrl = place.image;

      // Convert image to base64 if new image selected
      if (imageFile) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
          });
          imageUrl = base64;
        } catch (imgError) {
          console.error('Error converting image:', imgError);
          throw new Error('Rasmni yuklashda xatolik');
        }
      }

      // Update place in database
      const updatedPlace = {
        name: formData.name,
        categoryId: formData.categoryId,
        phone: formData.phone,
        region: formData.region,
        district: formData.district,
        latitude: formData.latitude,
        longitude: formData.longitude,
        openingHours: formData.openingHours,
        description: formData.description,
        services: formData.services ? formData.services.split(',').map(s => s.trim()) : [],
        workingDays: formData.workingDays,
        instagram: formData.instagram,
        youtube: formData.youtube,
        telegram: formData.telegram,
        image: imageUrl,
        securityCode: formData.securityCode, // Include security code
        updatedAt: new Date().toISOString(),
      };

      console.log('📤 Sending update request for place:', place.id);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/places/${place.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(updatedPlace),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        console.error('❌ Update failed:', responseData);
        throw new Error(responseData.error || 'Saqlashda xatolik');
      }

      console.log('✅ Update successful:', responseData);

      toast.success('✅ Joy muvaffaqiyatli yangilandi!', {
        duration: 3000,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating place:', err);
      setError(err instanceof Error ? err.message : 'Saqlashda xatolik yuz berdi');
      toast.error('❌ Xatolik yuz berdi', {
        description: err instanceof Error ? err.message : 'Qaytadan urinib ko\'ring',
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-2xl overflow-hidden flex flex-col"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(25, 25, 25, 0.98), rgba(15, 15, 15, 0.98))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.98))',
          backdropFilter: 'blur(40px)',
          borderRadius: '32px 32px 0 0',
          maxHeight: 'calc(100vh - 80px)',
          height: 'calc(100vh - 80px)',
          boxShadow: isDark
            ? '0 -4px 64px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 -4px 64px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 sm:p-6 pb-3 sm:pb-4 border-b" style={{
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}>
          <button
            onClick={onClose}
            className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 rounded-xl transition-all active:scale-90 z-10"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <X className="size-5" style={{ color: isDark ? '#ffffff' : '#000000' }} strokeWidth={2.5} />
          </button>

          <h2 
            className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 pr-12"
            style={{ color: isDark ? '#ffffff' : '#000000' }}
          >
            Joyni tahrirlash
          </h2>
          <p 
            className="text-xs sm:text-sm"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            Ma'lumotlarni yangilang
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Joy nomi *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Masalan: Oqtepa Lavash"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                  color: isDark ? '#ffffff' : '#000000',
                  outline: 'none',
                }}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Kategoriya *
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                  color: isDark ? '#ffffff' : '#000000',
                  outline: 'none',
                }}
              >
                {placeCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Telefon *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+998 90 123 45 67"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                  color: isDark ? '#ffffff' : '#000000',
                  outline: 'none',
                }}
              />
            </div>

            {/* Region & District */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <select
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value, district: '' })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                  color: isDark ? '#ffffff' : '#000000',
                  outline: 'none',
                }}
              >
                <option value="">Viloyat</option>
                {regions.map(region => (
                  <option key={region.id} value={region.id}>{region.name}</option>
                ))}
              </select>
              <select
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                disabled={!formData.region}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                  color: isDark ? '#ffffff' : '#000000',
                  outline: 'none',
                  opacity: !formData.region ? 0.5 : 1,
                }}
              >
                <option value="">Tuman</option>
                {districts.map(district => (
                  <option key={district.id} value={district.id}>{district.name}</option>
                ))}
              </select>
            </div>

            {/* Coordinates */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                📍 Koordinatalar
              </label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center" style={{ background: accentColor.color }}>
                    <Navigation className="size-4 sm:size-5" style={{ color: '#ffffff' }} />
                  </div>
                  <input
                    type="text"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="Lat"
                    className="flex-1 px-2 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#000000',
                      outline: 'none',
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center" style={{ background: accentColor.color }}>
                    <MapPin className="size-4 sm:size-5" style={{ color: '#ffffff' }} />
                  </div>
                  <input
                    type="text"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="Lng"
                    className="flex-1 px-2 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#000000',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                🖼️ Rasm
              </label>
              {imagePreview && (
                <div className="relative mb-2 sm:mb-3 rounded-xl sm:rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }}>
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(10px)', color: '#ffffff' }}>
                    {imageFile ? '✨ Yangi' : '📸 Hozirgi'}
                  </div>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: `2px dashed ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'}`,
                  color: isDark ? '#ffffff' : '#000000',
                }}
              >
                <ImageIcon className="size-4 sm:size-5" />
                <span className="text-xs sm:text-sm">{imageFile ? 'Boshqa rasm' : 'Rasm yuklash'}</span>
              </button>
            </div>

            {/* Opening Hours */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                ⏰ Ish vaqti
              </label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, openingHours: formData.openingHours === '24 soat' ? '' : '24 soat' })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: formData.openingHours === '24 soat' ? accentColor.color : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  color: formData.openingHours === '24 soat' ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                  border: `1px solid ${formData.openingHours === '24 soat' ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}`,
                }}
              >
                🕐 24 soat ochiq
              </button>
              {formData.openingHours !== '24 soat' && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2">
                  <select
                    value={formData.openingHours.split('-')[0] || ''}
                    onChange={(e) => {
                      const closing = formData.openingHours.split('-')[1] || '22:00';
                      setFormData({ ...formData, openingHours: `${e.target.value}-${closing}` });
                    }}
                    className="w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#000000',
                      outline: 'none',
                    }}
                  >
                    <option value="" style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}>Ochilish</option>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return <option key={hour} value={`${hour}:00`} style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}>{hour}:00</option>;
                    })}
                  </select>
                  <select
                    value={formData.openingHours.split('-')[1] || ''}
                    onChange={(e) => {
                      const opening = formData.openingHours.split('-')[0] || '09:00';
                      setFormData({ ...formData, openingHours: `${opening}-${e.target.value}` });
                    }}
                    className="w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      color: isDark ? '#ffffff' : '#000000',
                      outline: 'none',
                    }}
                  >
                    <option value="" style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}>Yopilish</option>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return <option key={hour} value={`${hour}:00`} style={{ background: isDark ? '#1c1c1e' : '#ffffff', color: isDark ? '#ffffff' : '#000000' }}>{hour}:00</option>;
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Tavsif
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Joy haqida..."
                rows={2}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm resize-none"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                  color: isDark ? '#ffffff' : '#000000',
                  outline: 'none',
                }}
              />
            </div>

            {/* Services */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Xizmatlar
              </label>
              <input
                type="text"
                value={formData.services}
                onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                placeholder="Wi-Fi, Yetkazib berish..."
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                  color: isDark ? '#ffffff' : '#000000',
                  outline: 'none',
                }}
              />
            </div>

            {/* Working Days */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                📅 Ish kunlari
              </label>
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
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
                    className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold"
                    style={{
                      background: formData.workingDays.includes(day.id) ? accentColor.color : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      color: formData.workingDays.includes(day.id) ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                      border: `1px solid ${formData.workingDays.includes(day.id) ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}`,
                    }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Social Media */}
            <div className="space-y-2 sm:space-y-3">
              <label className="block text-xs sm:text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                🌐 Ijtimoiy tarmoqlar
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}>
                  <Instagram className="size-4 sm:size-5" style={{ color: '#ffffff' }} />
                </div>
                <input
                  type="text"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  placeholder="instagram.com/username"
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                    color: isDark ? '#ffffff' : '#000000',
                    outline: 'none',
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center" style={{ background: '#FF0000' }}>
                  <Youtube className="size-4 sm:size-5" style={{ color: '#ffffff' }} />
                </div>
                <input
                  type="text"
                  value={formData.youtube}
                  onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                  placeholder="youtube.com/@channel"
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                    color: isDark ? '#ffffff' : '#000000',
                    outline: 'none',
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center" style={{ background: '#0088cc' }}>
                  <Send className="size-4 sm:size-5" style={{ color: '#ffffff' }} />
                </div>
                <input
                  type="text"
                  value={formData.telegram}
                  onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                  placeholder="t.me/username"
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                    color: isDark ? '#ffffff' : '#000000',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Security Code */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                ���� Xavfsizlik kodi *
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center" style={{ background: accentColor.color }}>
                  <Key className="size-4 sm:size-5" style={{ color: '#ffffff' }} />
                </div>
                <input
                  type="text"
                  value={formData.securityCode}
                  onChange={(e) => setFormData({ ...formData, securityCode: e.target.value })}
                  placeholder={`Kod: ${getTodayCode()}`}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-mono"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                    color: isDark ? '#ffffff' : '#000000',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-2.5 sm:p-3 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <p className="text-xs sm:text-sm text-red-500 font-semibold">{error}</p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex-shrink-0 p-4 sm:p-6 pt-3 sm:pt-4 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              style={{
                backgroundImage: accentColor.gradient,
                boxShadow: `0 8px 24px ${accentColor.color}44`,
              }}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent" />
                  <span className="text-sm sm:text-base">Saqlanmoqda...</span>
                </>
              ) : (
                <span className="text-sm sm:text-base">Saqlash</span>
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: ${accentColor.color};
            border-radius: 10px;
          }
        }
        @media (max-width: 639px) {
          .custom-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .custom-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        }
      `}</style>
    </div>
  );
}