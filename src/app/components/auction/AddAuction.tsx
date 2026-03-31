import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { Upload, X, Plus, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { regionsList, getDistricts } from '../../data/regions';

interface AddAuctionProps {
  branchId: string;
  onSuccess?: (auction?: any) => void;
}

const CATEGORIES = [
  { id: 'electronics', label: 'Elektronika', emoji: '📱' },
  { id: 'furniture', label: 'Mebel', emoji: '🛋️' },
  { id: 'vehicles', label: 'Transport', emoji: '🚗' },
  { id: 'real_estate', label: 'Ko\'chmas mulk', emoji: '🏠' },
  { id: 'clothing', label: 'Kiyim-kechak', emoji: '👔' },
  { id: 'jewelry', label: 'Zargarlik', emoji: '💍' },
  { id: 'art', label: 'San\'at', emoji: '🎨' },
  { id: 'other', label: 'Boshqa', emoji: '📦' },
];

export function AddAuction({ branchId, onSuccess }: AddAuctionProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [startPrice, setStartPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [participationFee, setParticipationFee] = useState('');
  const [bidIncrementPercent, setBidIncrementPercent] = useState('10');
  const [durationDays, setDurationDays] = useState('7');
  const [submitting, setSubmitting] = useState(false);

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    setDistrict(''); // Reset district when region changes
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      toast.error('Maksimal 5 ta rasm yuklash mumkin');
      return;
    }

    const newImages = [...images, ...files];
    setImages(newImages);

    // Create previews
    const previews = files.map(file => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...previews]);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !description || !category || !region || !district) {
      toast.error('Barcha maydonlarni to\'ldiring');
      return;
    }

    if (images.length === 0) {
      toast.error('Kamida bitta rasm yuklang');
      return;
    }

    if (!startPrice || !maxPrice || !participationFee) {
      toast.error('Barcha narxlarni kiriting');
      return;
    }

    const startPriceNum = parseFloat(startPrice);
    const maxPriceNum = parseFloat(maxPrice);
    const participationFeeNum = parseFloat(participationFee);

    if (startPriceNum <= 0 || maxPriceNum <= startPriceNum) {
      toast.error('Narxlarni to\'g\'ri kiriting');
      return;
    }

    try {
      setSubmitting(true);
      
      console.log('📤 Submitting auction with', images.length, 'images');

      const formData = new FormData();
      formData.append('branchId', branchId);
      formData.append('name', name);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('region', region);
      formData.append('district', district);
      formData.append('startPrice', startPrice);
      formData.append('maxPrice', maxPrice);
      formData.append('participationFee', participationFee);
      formData.append('bidIncrementPercent', bidIncrementPercent);
      formData.append('durationDays', durationDays);

      // Append each image individually
      images.forEach((image, index) => {
        console.log(`📷 Adding image ${index + 1}:`, image.name, image.size, 'bytes');
        formData.append('images', image, image.name);
      });
      
      console.log('📡 Sending request to server...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );

      console.log('📊 Response status:', response.status);
      const data = await response.json();
      console.log('📦 Response data:', data);

      if (data.success) {
        toast.success('Auksion yaratildi!');
        
        // Reset form
        setName('');
        setDescription('');
        setCategory('');
        setRegion('');
        setDistrict('');
        setImages([]);
        setImagePreviews([]);
        setStartPrice('');
        setMaxPrice('');
        setParticipationFee('');
        setBidIncrementPercent('10');
        setDurationDays('7');

        // Call onSuccess callback
        if (onSuccess) {
          console.log('✅ Calling onSuccess callback');
          onSuccess(data.auction);
        }
      } else {
        console.error('❌ Server error:', data.error, data.details);
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('❌ Error creating auction:', error);
      toast.error('Auksion yaratishda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div
          className="rounded-3xl border p-6"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 className="text-lg font-bold mb-4">Asosiy ma'lumotlar</h3>
          
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Mahsulot nomi <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: iPhone 15 Pro Max"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#000000',
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Ta'rif <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mahsulot haqida batafsil ma'lumot..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#000000',
                }}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Katalog <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className="p-3 rounded-xl border transition-all"
                    style={{
                      background: category === cat.id
                        ? accentColor.gradient
                        : isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : '#ffffff',
                      borderColor: category === cat.id
                        ? accentColor.color
                        : isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.1)',
                      color: category === cat.id ? '#ffffff' : 'inherit',
                    }}
                  >
                    <div className="text-2xl mb-1">{cat.emoji}</div>
                    <div className="text-xs font-medium">{cat.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Region */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" style={{ color: accentColor.color }} />
                  Viloyat <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={region}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#000000',
                  }}
                >
                  <option value="">Viloyatni tanlang</option>
                  {regionsList.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* District */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" style={{ color: accentColor.color }} />
                  Tuman <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={!region}
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#000000',
                  }}
                >
                  <option value="">Tumanni tanlang</option>
                  {region && getDistricts(region).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Images */}
        <div
          className="rounded-3xl border p-6"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 className="text-lg font-bold mb-4">
            Rasmlar <span style={{ color: '#ef4444' }}>*</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative aspect-square rounded-xl overflow-hidden group">
                <img src={preview} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: '#ffffff',
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {images.length < 5 && (
              <label
                className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105"
                style={{
                  borderColor: accentColor.color,
                  background: `${accentColor.color}10`,
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Plus className="w-8 h-8 mb-2" style={{ color: accentColor.color }} />
                <span className="text-xs font-medium" style={{ color: accentColor.color }}>
                  Rasm qo'shish
                </span>
              </label>
            )}
          </div>

          <p
            className="text-xs mt-3"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
          >
            Maksimal 5 ta rasm yuklash mumkin
          </p>
        </div>

        {/* Pricing */}
        <div
          className="rounded-3xl border p-6"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 className="text-lg font-bold mb-4">Narxlar va shartlar</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Price */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Boshlang'ich narx (so'm) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                value={startPrice}
                onChange={(e) => setStartPrice(e.target.value)}
                placeholder="100000"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#000000',
                }}
              />
            </div>

            {/* Max Price */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Maksimal narx (so'm) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="1000000"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#000000',
                }}
              />
            </div>

            {/* Participation Fee */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Qatnashish narxi (so'm) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                value={participationFee}
                onChange={(e) => setParticipationFee(e.target.value)}
                placeholder="10000"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#000000',
                }}
              />
            </div>

            {/* Bid Increment */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Minimal o'sish (%) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                value={bidIncrementPercent}
                onChange={(e) => setBidIncrementPercent(e.target.value)}
                placeholder="10"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#000000',
                }}
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Davomiyligi (kun) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#000000',
                }}
              >
                <option value="1">1 kun</option>
                <option value="3">3 kun</option>
                <option value="7">7 kun</option>
                <option value="14">14 kun</option>
                <option value="30">30 kun</option>
              </select>
            </div>
          </div>

          {/* Preview */}
          {startPrice && bidIncrementPercent && (
            <div
              className="mt-4 p-4 rounded-2xl"
              style={{ background: `${accentColor.color}20` }}
            >
              <p className="text-sm mb-1" style={{ color: accentColor.color }}>
                Namuna: Agar joriy narx {parseFloat(startPrice).toLocaleString()} so'm bo'lsa
              </p>
              <p className="text-lg font-bold" style={{ color: accentColor.color }}>
                Keyingi minimal taklif:{' '}
                {Math.ceil(parseFloat(startPrice) * (1 + parseFloat(bidIncrementPercent) / 100)).toLocaleString()}{' '}
                so'm
              </p>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: accentColor.gradient,
            color: '#ffffff',
          }}
        >
          {submitting ? 'Yuklanmoqda...' : 'Auksion yaratish'}
        </button>
      </form>
    </div>
  );
}