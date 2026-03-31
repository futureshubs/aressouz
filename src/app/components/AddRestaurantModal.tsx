import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { X, Upload, Image as ImageIcon, Send, Store, Phone, Clock, MapPin, DollarSign, Truck, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { regions, getDistrictsByRegionId } from '../data/regions';

const RESTAURANT_TYPES = [
  'Milliy taomlar',
  'Fast food',
  'Italia taomlari',
  'Xitoy taomlari',
  'Yapon taomlari',
  'Boshqa'
];

interface AddRestaurantModalProps {
  branchId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddRestaurantModal({ branchId, onClose, onSuccess }: AddRestaurantModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    banner: '',
    // Restoran uchun to'lov QR rasm (kassa tasdiqlashda ishlatiladi)
    paymentQrImage: '',
    type: RESTAURANT_TYPES[0],
    workTime: '09:00 - 22:00',
    contact: {
      address: '',
      phone: '',
      workHours: '09:00 - 22:00'
    },
    minOrderPrice: 0,
    deliveryTime: '30-40 daqiqa',
    description: '',
    region: regions[0].name,
    district: regions[0].districts[0].name,
    telegramChatId: '',
    login: '',
    password: ''
  });
  
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);

  // Get selected region object
  const selectedRegion = regions.find(r => r.name === formData.region);
  const availableDistricts = selectedRegion?.districts || [];

  const handleImageUpload = async (type: 'logo' | 'banner' | 'paymentQrImage', file: File) => {
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
        setFormData(prev => ({ ...prev, [type]: result.url }));
        const label = type === 'logo' ? 'Logo' : type === 'banner' ? 'Banner' : "To'lov QR";
        toast.success(`${label} yuklandi!`);
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
    
    if (!formData.name || !formData.contact.phone || !formData.login || !formData.password) {
      toast.error('Barcha majburiy maydonlarni to\'ldiring!');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            ...formData,
            branchId: branchId // Add branchId to request
          })
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success('Restoran muvaffaqiyatli qo\'shildi! 🎉');
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || 'Xatolik yuz berdi!');
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Xatolik yuz berdi!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!formData.telegramChatId) {
      toast.error('Chat ID kiriting!');
      return;
    }

    try {
      setTestingTelegram(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/telegram/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ 
            chatId: formData.telegramChatId,
            type: 'restaurant'
          })
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message || 'Test xabari yuborildi! ✅');
      } else {
        toast.error(result.error || 'Xatolik yuz berdi!');
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Xatolik yuz berdi!');
    } finally {
      setTestingTelegram(false);
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
        className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl md:max-h-[90vh] z-[101] rounded-3xl overflow-hidden animate-slideUp"
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
              <Store className="w-6 h-6" style={{ color: accentColor.color }} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Restoran qo'shish</h2>
              <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                Yangi restoran ro'yxatdan o'tkazish
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
            {/* Images */}
            <div className="grid grid-cols-2 gap-4">
              {/* Logo */}
              <div>
                <label className="block text-sm font-bold mb-2">Logo *</label>
                <div 
                  className="relative w-full h-32 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden"
                  style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                >
                  {formData.logo ? (
                    <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: accentColor.color }} />
                      <p className="text-xs">Logo yuklash</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload('logo', e.target.files[0])}
                  />
                </div>
              </div>

              {/* Banner */}
              <div>
                <label className="block text-sm font-bold mb-2">Banner</label>
                <div 
                  className="relative w-full h-32 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden"
                  style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                >
                  {formData.banner ? (
                    <img src={formData.banner} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: accentColor.color }} />
                      <p className="text-xs">Banner yuklash</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload('banner', e.target.files[0])}
                  />
                </div>
              </div>
            </div>

            {/* Payment QR */}
            <div>
              <label className="block text-sm font-bold mb-2">To'lov QR rasm</label>
              <div
                className="relative w-full h-32 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden"
                style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                onClick={() => document.getElementById('restaurant-payment-qr-upload')?.click()}
              >
                <input
                  id="restaurant-payment-qr-upload"
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload('paymentQrImage', e.target.files[0])}
                />
                {formData.paymentQrImage ? (
                  <div className="space-y-3">
                    <img
                      src={formData.paymentQrImage}
                      alt="Payment QR"
                      className="w-full h-full object-contain bg-white/5"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData((prev) => ({ ...prev, paymentQrImage: '' }));
                      }}
                      className="px-4 py-2 rounded-lg text-sm"
                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                    >
                      O'chirish
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: accentColor.color }} />
                    <p className="text-xs">To'lov QR yuklash</p>
                  </div>
                )}
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Restoran nomi *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="Masalan: Milliy taomlar"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Turi</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                >
                  {RESTAURANT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Telefon *
                </label>
                <input
                  type="tel"
                  value={formData.contact.phone}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    contact: { ...prev.contact, phone: e.target.value }
                  }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="+998 90 123 45 67"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Ish vaqti
                </label>
                <input
                  type="text"
                  value={formData.workTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, workTime: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="09:00 - 22:00"
                />
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Viloyat</label>
                <select
                  value={formData.region}
                  onChange={(e) => {
                    const newRegion = e.target.value;
                    const newRegionObj = regions.find(r => r.name === newRegion);
                    setFormData(prev => ({ 
                      ...prev, 
                      region: newRegion,
                      district: newRegionObj?.districts[0]?.name || ''
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
                      key={region.name} 
                      value={region.name}
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
                <label className="block text-sm font-bold mb-2">Tuman</label>
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
                      key={district.name} 
                      value={district.name}
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

            <div>
              <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Manzil
              </label>
              <input
                type="text"
                value={formData.contact.address}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  contact: { ...prev.contact, address: e.target.value }
                }))}
                className="w-full px-4 py-3 rounded-xl"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                }}
                placeholder="To'liq manzil"
              />
            </div>

            {/* Delivery Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Minimal buyurtma narxi (so'm)
                </label>
                <input
                  type="number"
                  value={formData.minOrderPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, minOrderPrice: Number(e.target.value) }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Yetkazish vaqti
                </label>
                <input
                  type="text"
                  value={formData.deliveryTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, deliveryTime: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="30-40 daqiqa"
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
                placeholder="Restoran haqida qisqacha ma'lumot"
              />
            </div>

            {/* Telegram Integration */}
            <div 
              className="p-4 rounded-xl space-y-3"
              style={{ 
                background: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'}`
              }}
            >
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5" style={{ color: '#3b82f6' }} />
                <h3 className="font-bold">Telegram integratsiya</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={formData.telegramChatId}
                  onChange={(e) => setFormData(prev => ({ ...prev, telegramChatId: e.target.value }))}
                  className="px-4 py-2.5 rounded-lg text-sm"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="Chat ID"
                />
                <button
                  type="button"
                  disabled={testingTelegram}
                  onClick={handleTestTelegram}
                  className="px-4 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: '#3b82f6', color: '#ffffff' }}
                >
                  {testingTelegram ? 'Test qilinmoqda...' : 'Test qilish'}
                </button>
              </div>
            </div>

            {/* Login Credentials */}
            <div 
              className="p-4 rounded-xl space-y-3"
              style={{ 
                background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'}`
              }}
            >
              <h3 className="font-bold">Kirish ma'lumotlari *</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={formData.login}
                  onChange={(e) => setFormData(prev => ({ ...prev, login: e.target.value }))}
                  className="px-4 py-2.5 rounded-lg"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="Login"
                  required
                />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="px-4 py-2.5 rounded-lg"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="Parol"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50"
              style={{ background: accentColor.color, color: '#ffffff' }}
            >
              {isSubmitting ? 'Saqlanmoqda...' : 'Restoran qo\'shish'}
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