import { useState, useEffect } from 'react';
import { Plus, Building, Percent, Calendar, Phone, Mail, Edit2, Trash2, Upload, X, Check, MapPin, MessageCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

// O'zbekiston viloyatlari va tumanlari
const REGIONS = {
  'Toshkent shahar': ['Bektemir', 'Chilonzor', 'Yashnobod', 'Mirobod', 'Mirzo Ulug\'bek', 'Sergeli', 'Olmazor', 'Uchtepa', 'Shayxontohur', 'Yakkasaroy', 'Yunusobod'],
  'Toshkent viloyati': ['Angren', 'Bekobod', 'Bo\'ka', 'Bo\'stonliq', 'Chinoz', 'Qibray', 'Ohangaron', 'Oqqo\'rg\'on', 'Parkent', 'Piskent', 'Quyi Chirchiq', 'O\'rta Chirchiq', 'Yangiyo\'l', 'Yuqori Chirchiq', 'Zangiota'],
  'Andijon': ['Andijon', 'Asaka', 'Baliqchi', 'Bo\'z', 'Buloqboshi', 'Jalaquduq', 'Izboskan', 'Qo\'rg\'ontepa', 'Marhamat', 'Oltinko\'l', 'Paxtaobod', 'Shahrixon', 'Ulug\'nor', 'Xo\'jaobod'],
  'Buxoro': ['Buxoro', 'Kogon', 'G\'ijduvon', 'Jondor', 'Olot', 'Peshku', 'Qorako\'l', 'Qorovulbozor', 'Romitan', 'Shofirkon', 'Vobkent'],
  'Farg\'ona': ['Farg\'ona', 'Beshariq', 'Bog\'dod', 'Buvayda', 'Dang\'ara', 'Farg\'ona', 'Furqat', 'O\'zbekiston', 'Qo\'qon', 'Qo\'shtepa', 'Quva', 'Rishton', 'So\'x', 'Toshloq', 'Uchko\'prik', 'Yozyovon'],
  'Jizzax': ['Jizzax', 'Arnasoy', 'Baxmal', 'Do\'stlik', 'Forish', 'G\'allaorol', 'Sharof Rashidov', 'Mirzacho\'l', 'Paxtakor', 'Yangiobod', 'Zomin', 'Zafarobod'],
  'Namangan': ['Namangan', 'Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq', 'Norin', 'Pop', 'To\'raqo\'rg\'on', 'Uchqo\'rg\'on', 'Uychi', 'Yangiqo\'rg\'on'],
  'Navoiy': ['Navoiy', 'Konimex', 'Karmana', 'Qiziltepa', 'Xatirchi', 'Navbahor', 'Nurota', 'Tomdi', 'Uchquduq'],
  'Qashqadaryo': ['Qarshi', 'Chiroqchi', 'Dehqonobod', 'G\'uzor', 'Kasbi', 'Kitob', 'Koson', 'Mirishkor', 'Muborak', 'Nishon', 'Qamashi', 'Shahrisabz', 'Yakkabog\''],
  'Qoraqalpog\'iston': ['Nukus', 'Amudaryo', 'Beruniy', 'Chimboy', 'Ellikqal\'a', 'Kegeyli', 'Mo\'ynoq', 'Nukus', 'Qonliko\'l', 'Qo\'ng\'irot', 'Shumanay', 'Taxtako\'pir', 'To\'rtko\'l', 'Xo\'jayli'],
  'Samarqand': ['Samarqand', 'Bulung\'ur', 'Ishtixon', 'Jomboy', 'Kattaqo\'rg\'on', 'Narpay', 'Nurobod', 'Oqdaryo', 'Paxtachi', 'Payariq', 'Pastdarg\'om', 'Qo\'shrabot', 'Samarqand', 'Toyloq', 'Urgut'],
  'Sirdaryo': ['Guliston', 'Boyovut', 'Guliston', 'Mirzaobod', 'Oqoltin', 'Sardoba', 'Sayxunobod', 'Sirdaryo', 'Xovos'],
  'Surxondaryo': ['Termiz', 'Angor', 'Boysun', 'Denov', 'Jarqo\'rg\'on', 'Qiziriq', 'Qo\'mqo\'rg\'on', 'Muzrabot', 'Oltinsoy', 'Sariosiyo', 'Sherobod', 'Sho\'rchi', 'Termiz', 'Uzun'],
  'Xorazm': ['Urganch', 'Bog\'ot', 'Gurlan', 'Xonqa', 'Xazorasp', 'Qo\'shko\'pir', 'Shovot', 'Urganch', 'Yangiariq', 'Yangibozor']
};

interface Bank {
  id: string;
  name: string;
  logo: string;
  mortgagePercent: number;
  minDownPayment: number;
  maxPeriod: number;
  contactPhone: string;
  contactEmail: string;
  description: string;
  telegramChatId: string;
  viloyat: string;
  tuman: string;
  createdAt: string;
}

interface BankManagementProps {
  branchId: string;
  branchInfo: any;
}

export function BankManagement({ branchId, branchInfo }: BankManagementProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    mortgagePercent: '',
    minDownPayment: '',
    maxPeriod: '',
    contactPhone: '',
    contactEmail: '',
    description: '',
    telegramChatId: '',
    viloyat: '',
    tuman: '',
  });
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadBanks();
  }, [branchId, visibilityRefetchTick]);

  const loadBanks = async () => {
    try {
      setIsLoading(true);
      
      const params = new URLSearchParams();
      params.append('branchId', branchId);
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banks?${params}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (!response.ok) throw new Error('Failed to load banks');
      
      const data = await response.json();
      setBanks(data.banks || []);
    } catch (error) {
      console.error('Load banks error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setLogoPreview(base64);
      setFormData({ ...formData, logo: base64 });
    };
    reader.readAsDataURL(file);
  };

  const openAddModal = () => {
    setEditingBank(null);
    setFormData({
      name: '',
      logo: '',
      mortgagePercent: '',
      minDownPayment: '',
      maxPeriod: '',
      contactPhone: '',
      contactEmail: '',
      description: '',
      telegramChatId: '',
      viloyat: '',
      tuman: '',
    });
    setLogoPreview('');
    setShowModal(true);
  };

  const openEditModal = (bank: Bank) => {
    setEditingBank(bank);
    setFormData({
      name: bank.name,
      logo: bank.logo,
      mortgagePercent: bank.mortgagePercent.toString(),
      minDownPayment: bank.minDownPayment.toString(),
      maxPeriod: bank.maxPeriod.toString(),
      contactPhone: bank.contactPhone,
      contactEmail: bank.contactEmail,
      description: bank.description,
      telegramChatId: bank.telegramChatId || '',
      viloyat: bank.viloyat || '',
      tuman: bank.tuman || '',
    });
    setLogoPreview(bank.logo);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.mortgagePercent) {
      alert('Iltimos, bank nomi va ipoteka foizini kiriting!');
      return;
    }

    setSaving(true);
    try {
      const url = editingBank
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banks/${editingBank.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banks`;

      const bankData = {
        branchId,
        name: formData.name,
        logo: formData.logo,
        mortgagePercent: parseFloat(formData.mortgagePercent),
        minDownPayment: parseFloat(formData.minDownPayment) || 20,
        maxPeriod: parseInt(formData.maxPeriod) || 20,
        contactPhone: formData.contactPhone,
        contactEmail: formData.contactEmail,
        description: formData.description,
        telegramChatId: formData.telegramChatId,
        viloyat: formData.viloyat,
        tuman: formData.tuman,
      };

      const response = await fetch(url, {
        method: editingBank ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(bankData),
      });

      if (!response.ok) throw new Error('Failed to save bank');

      await loadBanks();
      setShowModal(false);
    } catch (error) {
      console.error('Save bank error:', error);
      alert('Xatolik yuz berdi!');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bankId: string) => {
    if (!confirm('Rostdan ham bu bankni o\'chirmoqchimisiz?')) return;

    setDeleteBusyId(bankId);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banks/${bankId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) throw new Error('Failed to delete bank');

      await loadBanks();
    } catch (error) {
      console.error('Delete bank error:', error);
      alert('Xatolik yuz berdi!');
    } finally {
      setDeleteBusyId(null);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black mb-1" style={{ color: isDark ? '#ffffff' : '#111827' }}>
            Banklar
          </h1>
          <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Ipoteka banklarini boshqarish
          </p>
        </div>
        
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-white transition-all hover:scale-105"
          style={{
            background: accentColor.color,
            boxShadow: `0 8px 24px ${accentColor.color}40`,
          }}
        >
          <Plus className="size-5" strokeWidth={2.5} />
          <span>Bank qo'shish</span>
        </button>
      </div>

      {/* Banks List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div
            className="inline-block size-8 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: `${accentColor.color} transparent transparent transparent` }}
          />
        </div>
      ) : banks.length === 0 ? (
        <div className="text-center py-12">
          <Building className="size-16 mx-auto mb-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }} />
          <p className="text-lg font-bold mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
            Hali banklar yo'q
          </p>
          <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}>
            Birinchi bankni qo'shing
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banks.map((bank) => (
            <div
              key={bank.id}
              className="p-4 rounded-2xl border transition-all hover:scale-105"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Logo */}
              {bank.logo && (
                <img
                  src={bank.logo}
                  alt={bank.name}
                  className="w-full h-32 object-contain rounded-xl mb-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                />
              )}

              {/* Name */}
              <h3 className="text-lg font-black mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                {bank.name}
              </h3>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <Percent className="size-4" style={{ color: accentColor.color }} strokeWidth={2} />
                  <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    Foiz: <strong>{bank.mortgagePercent}%</strong>
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="size-4" style={{ color: accentColor.color }} strokeWidth={2} />
                  <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    Muddat: <strong>{bank.maxPeriod} yil</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Building className="size-4" style={{ color: accentColor.color }} strokeWidth={2} />
                  <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    Min to'lov: <strong>{bank.minDownPayment}%</strong>
                  </span>
                </div>

                {bank.viloyat && bank.tuman && (
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4" style={{ color: accentColor.color }} strokeWidth={2} />
                    <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      <strong>{bank.viloyat}, {bank.tuman}</strong>
                    </span>
                  </div>
                )}

                {bank.telegramChatId && (
                  <div className="flex items-center gap-2">
                    <MessageCircle className="size-4" style={{ color: accentColor.color }} strokeWidth={2} />
                    <span className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                      Telegram bog'langan
                    </span>
                  </div>
                )}

                {bank.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-4" style={{ color: accentColor.color }} strokeWidth={2} />
                    <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      {bank.contactPhone}
                    </span>
                  </div>
                )}

                {bank.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="size-4" style={{ color: accentColor.color }} strokeWidth={2} />
                    <span className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                      {bank.contactEmail}
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {bank.description && (
                <p className="text-xs mb-4 line-clamp-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  {bank.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(bank)}
                  disabled={deleteBusyId !== null || saving}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: `${accentColor.color}20`,
                    color: accentColor.color,
                  }}
                >
                  <Edit2 className="size-4" strokeWidth={2.5} />
                  <span>Tahrirlash</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => void handleDelete(bank.id)}
                  disabled={deleteBusyId !== null}
                  className="px-3 py-2 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px]"
                  style={{
                    background: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                  }}
                >
                  {deleteBusyId === bank.id ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                  ) : (
                    <Trash2 className="size-4" strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 app-safe-pad z-[100] flex items-center justify-center p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => {
            if (!saving) setShowModal(false);
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, #1a1a1a, #0a0a0a)'
                : 'linear-gradient(145deg, #ffffff, #f5f5f5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                {editingBank ? 'Bankni tahrirlash' : 'Yangi bank qo\'shish'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="p-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <X className="size-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Logo */}
              <div>
                <label className="block text-sm font-medium mb-2">Bank logotipi</label>
                
                {logoPreview ? (
                  <div className="relative group">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-full h-40 object-contain rounded-xl"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLogoPreview('');
                        setFormData({ ...formData, logo: '' });
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label 
                    className="h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:border-opacity-100"
                    style={{ 
                      borderColor: `${accentColor.color}40`,
                      background: `${accentColor.color}10`
                    }}
                  >
                    <Upload className="w-8 h-8 mb-2" style={{ color: accentColor.color }} />
                    <span className="text-sm font-medium" style={{ color: accentColor.color }}>
                      Logo yuklash
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Bank Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Bank nomi *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Masalan: Ipoteka Bank"
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Ipoteka foizi % *</label>
                  <input
                    type="number"
                    value={formData.mortgagePercent}
                    onChange={e => setFormData({ ...formData, mortgagePercent: e.target.value })}
                    placeholder="18"
                    step="0.1"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Min boshlang'ich %</label>
                  <input
                    type="number"
                    value={formData.minDownPayment}
                    onChange={e => setFormData({ ...formData, minDownPayment: e.target.value })}
                    placeholder="20"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Max muddat (yil)</label>
                  <input
                    type="number"
                    value={formData.maxPeriod}
                    onChange={e => setFormData({ ...formData, maxPeriod: e.target.value })}
                    placeholder="20"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Telefon raqami</label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="info@bank.uz"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Tavsif</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Bank haqida qo'shimcha ma'lumot..."
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>

              {/* Telegram Chat ID */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <MessageCircle className="size-4" style={{ color: accentColor.color }} />
                  Telegram Chat ID *
                </label>
                <input
                  type="text"
                  value={formData.telegramChatId}
                  onChange={e => setFormData({ ...formData, telegramChatId: e.target.value })}
                  placeholder="Masalan: 123456789"
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
                <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                  Ariza kelganda xabar yuboriladi
                </p>
              </div>

              {/* Viloyat va Tuman */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <MapPin className="size-4" style={{ color: accentColor.color }} />
                    Viloyat *
                  </label>
                  <select
                    value={formData.viloyat}
                    onChange={e => setFormData({ ...formData, viloyat: e.target.value, tuman: '' })}
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  >
                    <option value="">Viloyatni tanlang</option>
                    {Object.keys(REGIONS).map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <MapPin className="size-4" style={{ color: accentColor.color }} />
                    Tuman *
                  </label>
                  <select
                    value={formData.tuman}
                    onChange={e => setFormData({ ...formData, tuman: e.target.value })}
                    disabled={!formData.viloyat}
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all disabled:opacity-50"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  >
                    <option value="">Tumanni tanlang</option>
                    {formData.viloyat && REGIONS[formData.viloyat as keyof typeof REGIONS]?.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: accentColor.color,
                    boxShadow: `0 8px 24px ${accentColor.color}40`,
                  }}
                >
                  {saving ? (
                    <Loader2 className="size-5 animate-spin shrink-0" strokeWidth={2.5} />
                  ) : (
                    <Check className="size-5 shrink-0" strokeWidth={2.5} />
                  )}
                  <span>{saving ? '' : editingBank ? 'Saqlash' : 'Qo\'shish'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}