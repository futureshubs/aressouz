import React, { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2, Camera, Video, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

interface CreatePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: any;
  accessToken: string;
  onSuccess?: () => void;
  accentColor: any;
  isDark: boolean;
  portfolioToEdit?: any;
  onDelete?: (portfolioId: string) => void;
  onEdit?: (portfolio: any) => void;
}

const regions = [
  'Toshkent shahar',
  'Toshkent viloyati',
  'Andijon',
  'Buxoro',
  'Jizzax',
  'Qashqadaryo',
  'Navoiy',
  'Namangan',
  'Samarqand',
  'Sirdaryo',
  'Surxondaryo',
  'Farg\'ona',
  'Xorazm',
  'Qoraqalpog\'iston',
];

// Districts by region
const districtsByRegion: Record<string, string[]> = {
  'Toshkent shahar': [
    'Bektemir', 'Chilonzor', 'Mirzo Ulug\'bek', 'Mirobod', 'Olmazor', 
    'Sergeli', 'Shayxontohur', 'Uchtepa', 'Yakkasaroy', 'Yashnobod', 
    'Yunusobod', 'Yashnaobod'
  ],
  'Toshkent viloyati': [
    'Toshkent', 'Angren', 'Bekobod', 'Bo\'ka', 'Bo\'stonliq', 'Chinoz',
    'Ohangaron', 'Oqqo\'rg\'on', 'Parkent', 'Piskent', 'Qibray', 
    'Quyi Chirchiq', 'Yangiyo\'l', 'Yuqori Chirchiq', 'Zangiota'
  ],
  'Andijon': [
    'Andijon shahri', 'Xonobod', 'Asaka', 'Baliqchi', 'Bo\'z', 
    'Buloqboshi', 'Izboskan', 'Jalaquduq', 'Xo\'jaobod', 'Qo\'rg\'ontepa',
    'Marhamat', 'Oltinko\'l', 'Paxtaobod', 'Shahrixon', 'Ulug\'nor'
  ],
  'Buxoro': [
    'Buxoro shahri', 'Kogon', 'Buxoro', 'Vobkent', 'G\'ijduvon', 
    'Jondor', 'Kogon', 'Olot', 'Peshku', 'Qorako\'l', 
    'Qorovulbozor', 'Romitan', 'Shofirkon'
  ],
  'Jizzax': [
    'Jizzax shahri', 'Arnasoy', 'Baxmal', 'Do\'stlik', 'Forish',
    'G\'allaorol', 'Sharof Rashidov', 'Mirzacho\'l', 'Paxtakor',
    'Yangiobod', 'Zomin', 'Zarbdor'
  ],
  'Qashqadaryo': [
    'Qarshi shahri', 'Chiroqchi', 'Dehqonobod', 'G\'uzor', 'Kasbi',
    'Kitob', 'Koson', 'Mirishkor', 'Muborak', 'Nishon', 
    'Qamashi', 'Qarshi', 'Shahrisabz', 'Yakkabog\''
  ],
  'Navoiy': [
    'Navoiy shahri', 'Zarafshon', 'Karmana', 'Konimex', 'Navbahor',
    'Nurota', 'Tomdi', 'Uchquduq', 'Xatirchi', 'Qiziltepa'
  ],
  'Namangan': [
    'Namangan shahri', 'Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq',
    'Norin', 'Pop', 'To\'raqo\'rg\'on', 'Uchqo\'rg\'on', 'Uychi',
    'Yangiqo\'rg\'on'
  ],
  'Samarqand': [
    'Samarqand shahri', 'Kattaqo\'rg\'on', 'Bulung\'ur', 'Ishtixon', 
    'Jomboy', 'Kattaqo\'rg\'on', 'Narpay', 'Nurobod', 'Oqdaryo',
    'Paxtachi', 'Payariq', 'Pastdarg\'om', 'Samarqand', 
    'Toyloq', 'Urgut'
  ],
  'Sirdaryo': [
    'Guliston shahri', 'Sirdaryo', 'Oqoltin', 'Boyovut', 'Guliston',
    'Xovos', 'Mirzaobod', 'Sardoba', 'Sayxunobod'
  ],
  'Surxondaryo': [
    'Termiz shahri', 'Angor', 'Boysun', 'Denov', 'Jarqo\'rg\'on',
    'Muzrobod', 'Oltinsoy', 'Qiziriq', 'Qo\'mqo\'rg\'on', 
    'Sho\'rchi', 'Termiz', 'Uzun'
  ],
  'Farg\'ona': [
    'Farg\'ona shahri', 'Marg\'ilon', 'Qo\'qon', 'Beshariq', 'Bog\'dod',
    'Buvayda', 'Dang\'ara', 'Farg\'ona', 'Furqat', 'O\'zbekiston',
    'Qo\'shtepa', 'Quva', 'Rishton', 'So\'x', 'Toshloq', 
    'Uchko\'prik', 'Yozyovon'
  ],
  'Xorazm': [
    'Urganch shahri', 'Xiva', 'Bog\'ot', 'Gurlan', 'Qo\'shko\'pir',
    'Urganch', 'Xazorasp', 'Xonqa', 'Shavot', 'Yangiariq',
    'Yangibozor'
  ],
  'Qoraqalpog\'iston': [
    'Nukus shahri', 'Amudaryo', 'Beruniy', 'Chimboy', 'Ellikqal\'a',
    'Kegeyli', 'Mo\'ynoq', 'Nukus', 'Qanliko\'l', 'Qo\'ng\'irot',
    'Qorao\'zak', 'Shumanay', 'Taxiatosh', 'Taxtako\'pir', 'To\'rtko\'l',
    'Xo\'jayli'
  ],
};

const professions = [
  'Santexnik',
  'Elektrik',
  'Usta (ta\'mirlash)',
  'Bog\'bon',
  'Tozalovchi',
  'Bo\'yoqchi',
  'Duradgor',
  'Temirchi',
  'Haydovchi',
  'Oshpaz',
  'Konditer',
  'Stilist/Sartarosh',
  'Kosmetolog',
  'Massajist',
  'Fotograf',
  'Videograf',
  'Dizayner',
  'Dasturchi',
  'O\'qituvchi',
  'Tarjimon',
  'Boshqa',
];

export function CreatePortfolioModal({ 
  isOpen, 
  onClose, 
  userData, 
  accessToken,
  onSuccess,
  accentColor,
  isDark,
  portfolioToEdit,
  onDelete,
  onEdit
}: CreatePortfolioModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Initialize state
  const [profession, setProfession] = useState('');
  const [customProfession, setCustomProfession] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [experience, setExperience] = useState('');
  const [completedProjects, setCompletedProjects] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('');
  const [workDays, setWorkDays] = useState<string[]>([]);
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('18:00');
  const [priceAmount, setPriceAmount] = useState('');
  const [priceType, setPriceType] = useState('soat'); // soat, kun, oy, ish, kv, m2
  const [media, setMedia] = useState<Array<{ url: string; type: 'image' | 'video' }>>([]);

  // Load portfolioToEdit data when modal opens
  useEffect(() => {
    if (isOpen && portfolioToEdit) {
      setProfession(portfolioToEdit.profession || '');
      setCustomProfession(portfolioToEdit.customProfession || '');
      setRegion(portfolioToEdit.region || '');
      setDistrict(portfolioToEdit.district || '');
      setSkills(portfolioToEdit.skills || []);
      setDescription(portfolioToEdit.description || '');
      setExperience(portfolioToEdit.experience?.toString() || '');
      setCompletedProjects(portfolioToEdit.completedProjects?.toString() || '');
      setLanguages(portfolioToEdit.languages || []);
      setWorkDays(portfolioToEdit.workDays || []);
      setWorkStartTime(portfolioToEdit.workStartTime || '09:00');
      setWorkEndTime(portfolioToEdit.workEndTime || '18:00');
      setPriceAmount(portfolioToEdit.priceAmount?.toString() || '');
      setPriceType(portfolioToEdit.priceType || 'soat');
      setMedia(portfolioToEdit.media || []);
    } else if (isOpen && !portfolioToEdit) {
      // Reset form for new portfolio
      setProfession('');
      setCustomProfession('');
      setRegion('');
      setDistrict('');
      setSkills([]);
      setDescription('');
      setExperience('');
      setCompletedProjects('');
      setLanguages([]);
      setWorkDays([]);
      setWorkStartTime('09:00');
      setWorkEndTime('18:00');
      setPriceAmount('');
      setPriceType('soat');
      setMedia([]);
    }
  }, [isOpen, portfolioToEdit]);

  if (!isOpen) return null;

  // Check if user is authenticated
  if (!userData || !accessToken) {
    return (
      <div 
        className="fixed inset-0 app-safe-pad z-50 flex items-center justify-center p-4"
        style={{
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
      >
        <div 
          className="w-full max-w-md rounded-2xl p-6 text-center"
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            boxShadow: isDark 
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' 
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: isDark ? '#fff' : '#000' }}>
            Tizimga kirish talab qilinadi
          </h2>
          <p className="mb-6" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
            Portfolio yaratish uchun avval tizimga kirishingiz kerak.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-semibold transition-all active:scale-[0.98]"
            style={{
              background: accentColor.color,
              color: '#fff',
              boxShadow: `0 4px 12px ${accentColor.color}40`,
            }}
          >
            Yopish
          </button>
        </div>
      </div>
    );
  }

  const weekDays = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];

  const addSkill = () => {
    if (currentSkill.trim() && !skills.includes(currentSkill.trim())) {
      setSkills([...skills, currentSkill.trim()]);
      setCurrentSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const addLanguage = () => {
    if (currentLanguage.trim() && !languages.includes(currentLanguage.trim())) {
      setLanguages([...languages, currentLanguage.trim()]);
      setCurrentLanguage('');
    }
  };

  const removeLanguage = (language: string) => {
    setLanguages(languages.filter(l => l !== language));
  };

  const toggleWorkDay = (day: string) => {
    if (workDays.includes(day)) {
      setWorkDays(workDays.filter(d => d !== day));
    } else {
      setWorkDays([...workDays, day]);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);

    try {
      const uploadedMedia: Array<{ url: string; type: 'image' | 'video' }> = [];

      for (const file of Array.from(files)) {
        // Validate file type
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
          alert('Faqat rasm yoki video yuklash mumkin');
          continue;
        }

        // Validate file size (max 50MB for videos, 10MB for images)
        const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          alert(`Fayl hajmi ${isVideo ? '50MB' : '10MB'} dan oshmasligi kerak`);
          continue;
        }

        // Upload to server
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Access-Token': accessToken || '',
          },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Yuklashda xatolik');
        }

        const data = await response.json();
        uploadedMedia.push({ 
          url: data.url, 
          type: isVideo ? 'video' : 'image' 
        });
      }

      // Add all uploaded media at once
      setMedia([...media, ...uploadedMedia]);
    } catch (error: any) {
      console.error('Media upload error:', error);
      alert(error.message || 'Faylni yuklashda xatolik');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMedia = (index: number) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userData) {
      alert('Iltimos, tizimga kiring');
      return;
    }

    if (!profession || !region || !district || skills.length === 0) {
      alert('Iltimos, barcha majburiy maydonlarni to\'ldiring');
      return;
    }

    setLoading(true);

    try {
      const portfolioData = {
        profession: profession === 'Boshqa' ? customProfession : profession,
        region,
        district,
        skills,
        description,
        experience: experience ? parseInt(experience) : 0,
        completedProjects: completedProjects ? parseInt(completedProjects) : 0,
        languages,
        workDays,
        workStartTime,
        workEndTime,
        priceAmount: priceAmount ? parseFloat(priceAmount) : 0,
        priceType,
        media,
      };

      // Check if we're editing or creating
      const isEdit = !!portfolioToEdit?.id;
      const url = isEdit 
        ? `${API_BASE_URL}/services/portfolio/${portfolioToEdit.id}`
        : `${API_BASE_URL}/services/portfolio`;
      
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': accessToken,
        },
        body: JSON.stringify(portfolioData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Portfolio ${isEdit ? 'yangilashda' : 'yaratishda'} xatolik`);
      }

      alert(`Portfolio muvaffaqiyatli ${isEdit ? 'yangilandi' : 'yaratildi'}!`);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('❌ Portfolio error:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error details:', {
        message: error?.message,
        stack: error?.stack,
        raw: error,
      });
      
      const errorMessage = error?.message || 'Portfolio yaratishda xatolik. Iltimos, qayta urinib ko\'ring.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-50"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={() => {
        if (!loading && !uploadingMedia) onClose();
      }}
    >
      {/* Content Container - Full screen on mobile, centered on desktop */}
      <div className="w-full h-full flex items-start sm:items-center justify-center">
        <div 
          className="w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-2xl sm:rounded-3xl overflow-y-auto"
          style={{
            background: isDark ? '#0a0a0a' : '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Header */}
          <div 
            className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 className="text-xl sm:text-2xl font-bold" style={{ color: isDark ? '#fff' : '#000' }}>
              {portfolioToEdit ? 'Portfolio tahrirlash' : 'Portfolio yaratish'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={loading || uploadingMedia}
              className="p-2.5 sm:p-3 rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              }}
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: isDark ? '#fff' : '#000' }} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 pb-24 sm:pb-6">
            {/* Profession */}
            <div>
              <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                Kasb *
              </label>
              <select
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="w-full px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors text-base"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.98)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#fff' : '#000',
                }}
                required
              >
                <option value="" style={{ 
                  background: isDark ? '#1a1a1a' : '#ffffff',
                  color: isDark ? '#888' : '#666'
                }}>
                  Kasbni tanlang
                </option>
                {professions.map((prof) => (
                  <option 
                    key={prof} 
                    value={prof}
                    style={{ 
                      background: isDark ? '#1a1a1a' : '#ffffff',
                      color: isDark ? '#fff' : '#000',
                      padding: '10px'
                    }}
                  >
                    {prof}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Profession */}
            {profession === 'Boshqa' && (
              <div>
                <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                  Kasb nomini kiriting *
                </label>
                <input
                  type="text"
                  value={customProfession}
                  onChange={(e) => setCustomProfession(e.target.value)}
                  className="w-full px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors text-base"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#fff' : '#000',
                  }}
                  required
                />
              </div>
            )}

            {/* Region */}
            <div>
              <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                Viloyat *
              </label>
              <select
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setDistrict('');
                }}
                className="w-full px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors text-base"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.98)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#fff' : '#000',
                }}
                required
              >
                <option value="" style={{ 
                  background: isDark ? '#1a1a1a' : '#ffffff',
                  color: isDark ? '#888' : '#666'
                }}>
                  Viloyatni tanlang
                </option>
                {regions.map((reg) => (
                  <option 
                    key={reg} 
                    value={reg}
                    style={{ 
                      background: isDark ? '#1a1a1a' : '#ffffff',
                      color: isDark ? '#fff' : '#000',
                      padding: '10px'
                    }}
                  >
                    {reg}
                  </option>
                ))}
              </select>
            </div>

            {/* District */}
            <div>
              <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                Tuman *
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                disabled={!region}
                className="w-full px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.98)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#fff' : '#000',
                }}
                required
              >
                <option value="" style={{ 
                  background: isDark ? '#1a1a1a' : '#ffffff',
                  color: isDark ? '#888' : '#666'
                }}>
                  {region ? 'Tuman tanlang' : 'Avval viloyat tanlang'}
                </option>
                {region && districtsByRegion[region]?.map((dist) => (
                  <option 
                    key={dist} 
                    value={dist}
                    style={{ 
                      background: isDark ? '#1a1a1a' : '#ffffff',
                      color: isDark ? '#fff' : '#000',
                      padding: '10px'
                    }}
                  >
                    {dist}
                  </option>
                ))}
              </select>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                Ko'nikmalar *
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={currentSkill}
                  onChange={(e) => setCurrentSkill(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  placeholder="Ko'nikma kiriting va Enter bosing"
                  className="flex-1 px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors text-base"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#fff' : '#000',
                  }}
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="px-5 py-3.5 sm:py-4 rounded-2xl transition-all active:scale-95"
                  style={{
                    background: accentColor.color,
                    color: '#fff',
                  }}
                >
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <div
                    key={skill}
                    className="flex items-center gap-2 px-4 py-2 rounded-full"
                    style={{
                      background: `${accentColor.color}20`,
                      color: accentColor.color,
                      border: `1px solid ${accentColor.color}40`,
                    }}
                  >
                    <span className="text-sm sm:text-base font-medium">{skill}</span>
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                Tavsif
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="O'zingiz haqingizda qisqacha ma'lumot bering..."
                rows={4}
                className="w-full px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors resize-none text-base"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#fff' : '#000',
                }}
              />
            </div>

            {/* Experience & Hourly Rate */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                  Tajriba (yil)
                </label>
                <input
                  type="number"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  min="0"
                  placeholder="0"
                  className="w-full px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors text-base"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#fff' : '#000',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                  Narx turi
                </label>
                <select
                  value={priceType}
                  onChange={(e) => setPriceType(e.target.value)}
                  className="w-full px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors text-base"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.98)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#fff' : '#000',
                  }}
                >
                  <option value="soat" style={{ background: isDark ? '#1a1a1a' : '#ffffff', color: isDark ? '#fff' : '#000' }}>Soat</option>
                  <option value="kun" style={{ background: isDark ? '#1a1a1a' : '#ffffff', color: isDark ? '#fff' : '#000' }}>Kun</option>
                  <option value="oy" style={{ background: isDark ? '#1a1a1a' : '#ffffff', color: isDark ? '#fff' : '#000' }}>Oy</option>
                  <option value="ish" style={{ background: isDark ? '#1a1a1a' : '#ffffff', color: isDark ? '#fff' : '#000' }}>Ish (loyiha)</option>
                  <option value="kv" style={{ background: isDark ? '#1a1a1a' : '#ffffff', color: isDark ? '#fff' : '#000' }}>Kv (m²)</option>
                  <option value="m2" style={{ background: isDark ? '#1a1a1a' : '#ffffff', color: isDark ? '#fff' : '#000' }}>Metr (m)</option>
                </select>
              </div>
            </div>

            {/* Price Amount */}
            <div>
              <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                Narxi (so'm)
              </label>
              <input
                type="number"
                value={priceAmount}
                onChange={(e) => setPriceAmount(e.target.value)}
                min="0"
                placeholder={
                  priceType === 'soat' ? 'Soatiga narxi' :
                  priceType === 'kun' ? 'Kuniga narxi' :
                  priceType === 'oy' ? 'Oyiga narxi' :
                  priceType === 'ish' ? 'Ish uchun narxi' :
                  priceType === 'kv' ? 'Kvadrat metr uchun narxi' :
                  'Metr uchun narxi'
                }
                className="w-full px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors text-base"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#fff' : '#000',
                }}
              />
              <p className="mt-2 text-xs sm:text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                {priceType === 'soat' && '⏰ Soatlik ish narxi'}
                {priceType === 'kun' && '📅 Kunlik ish narxi'}
                {priceType === 'oy' && '📆 Oylik ish narxi'}
                {priceType === 'ish' && '💼 Har bir ish/loyiha uchun narxi'}
                {priceType === 'kv' && '📐 Kvadrat metr uchun narxi (bo\'yoq, ta\'mir va h.k.)'}
                {priceType === 'm2' && '📏 Metr uchun narxi (chiziqli o\'lcham)'}
              </p>
            </div>

            {/* Completed Projects */}
            <div>
              <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                Yakunlangan loyihalar soni
              </label>
              <input
                type="number"
                value={completedProjects}
                onChange={(e) => setCompletedProjects(e.target.value)}
                min="0"
                placeholder="0"
                className="w-full px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors text-base"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#fff' : '#000',
                }}
              />
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                Til bilish
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={currentLanguage}
                  onChange={(e) => setCurrentLanguage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
                  placeholder="Tilni kiriting va Enter bosing"
                  className="flex-1 px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors text-base"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#fff' : '#000',
                  }}
                />
                <button
                  type="button"
                  onClick={addLanguage}
                  className="px-5 py-3.5 sm:py-4 rounded-2xl transition-all active:scale-95"
                  style={{
                    background: accentColor.color,
                    color: '#fff',
                  }}
                >
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {languages.map((language) => (
                  <div
                    key={language}
                    className="flex items-center gap-2 px-4 py-2 rounded-full"
                    style={{
                      background: `${accentColor.color}20`,
                      color: accentColor.color,
                      border: `1px solid ${accentColor.color}40`,
                    }}
                  >
                    <span className="text-sm sm:text-base font-medium">{language}</span>
                    <button
                      type="button"
                      onClick={() => removeLanguage(language)}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Work Days */}
            <div>
              <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                Ish kunlari
              </label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWorkDay(day)}
                    className="px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95 text-sm sm:text-base"
                    style={{
                      background: workDays.includes(day) ? accentColor.color : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      color: workDays.includes(day) ? '#fff' : isDark ? '#fff' : '#000',
                      border: `2px solid ${workDays.includes(day) ? accentColor.color : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Work Time */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                  Ish boshlash
                </label>
                <input
                  type="time"
                  value={workStartTime}
                  onChange={(e) => setWorkStartTime(e.target.value)}
                  className="w-full px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors text-base"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#fff' : '#000',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                  Ish tugash
                </label>
                <input
                  type="time"
                  value={workEndTime}
                  onChange={(e) => setWorkEndTime(e.target.value)}
                  className="w-full px-4 py-3.5 sm:py-4 rounded-2xl border-2 focus:outline-none transition-colors text-base"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#fff' : '#000',
                  }}
                />
              </div>
            </div>

            {/* Media Upload */}
            <div>
              <label className="block text-sm sm:text-base font-semibold mb-2.5" style={{ color: isDark ? '#fff' : '#000' }}>
                Ish namunalari (rasm/video)
              </label>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {media.map((item, index) => (
                  <div key={index} className="relative aspect-square rounded-2xl overflow-hidden">
                    {item.type === 'image' ? (
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={item.url} className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-2 right-2 p-2 rounded-full transition-all active:scale-95"
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                <label 
                  className="aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95"
                  style={{
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleMediaUpload}
                    className="hidden"
                    disabled={uploadingMedia}
                  />
                  {uploadingMedia ? (
                    <Loader2 className="h-10 w-10 animate-spin shrink-0" style={{ color: accentColor.color }} />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 sm:w-10 sm:h-10 mb-2" style={{ color: accentColor.color, opacity: 0.7 }} />
                      <span className="text-xs sm:text-sm text-center font-medium" style={{ color: accentColor.color, opacity: 0.7 }}>
                        Yuklash
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Submit Button - Sticky at bottom on mobile */}
            <div 
              className="fixed sm:relative bottom-0 left-0 right-0 p-4 sm:p-0 border-t sm:border-0"
              style={{
                background: isDark ? '#0a0a0a' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <button
                type="submit"
                disabled={loading || uploadingMedia}
                className="w-full py-4 sm:py-5 rounded-2xl font-bold transition-all disabled:opacity-50 active:scale-[0.98] text-base sm:text-lg flex items-center justify-center gap-2"
                style={{
                  background: accentColor.color,
                  color: '#fff',
                  boxShadow: `0 8px 24px ${accentColor.color}40`,
                }}
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                {loading ? '' : portfolioToEdit ? 'Portfolio yangilash' : 'Portfolio yaratish'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}