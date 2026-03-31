import React, { useMemo, useRef, useState } from 'react';
import { X, User, Calendar, Users, Loader2, Camera, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { WheelDatePicker } from './WheelDatePicker';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { compressImageIfNeeded, uploadFormDataWithProgress } from '../utils/uploadWithProgress';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userData: any;
  accessToken: string;
  accentColor: any;
  isDark: boolean;
}

export function ProfileEditModal({
  isOpen,
  onClose,
  onSuccess,
  userData,
  accessToken,
  accentColor,
  isDark,
}: ProfileEditModalProps) {
  const [firstName, setFirstName] = useState(userData?.firstName || '');
  const [lastName, setLastName] = useState(userData?.lastName || '');
  const [birthDate, setBirthDate] = useState(userData?.birthDate || '');
  const [gender, setGender] = useState<'male' | 'female'>(userData?.gender || 'male');
  const [profileImage, setProfileImage] = useState(userData?.profileImage || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(userData?.profileImage || '');
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Faqat rasm fayllari yuklash mumkin');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Rasm hajmi 10MB dan oshmasligi kerak');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setImageFile(file);
    setError('');

    // Auto-upload immediately
    void (async () => {
      setUploadingImage(true);
      setUploadPct(0);
      try {
        const compressed = await compressImageIfNeeded(file);
        const formData = new FormData();
        formData.append('file', compressed);

        const { data, status } = await uploadFormDataWithProgress<{ url?: string; error?: string }>({
          url: `${API_BASE_URL}/api/upload`,
          formData,
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'X-Access-Token': accessToken,
          },
          onProgress: (pct) => setUploadPct(pct),
        });

        if (status < 200 || status >= 300 || !data?.url) {
          throw new Error(data?.error || `Upload xatolik (${status})`);
        }
        setProfileImage(String(data.url));
        setUploadPct(100);
      } catch (err: any) {
        setError(err?.message || 'Rasm yuklashda xatolik');
      } finally {
        setUploadingImage(false);
        setTimeout(() => setUploadPct(null), 800);
      }
    })();
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !birthDate) {
      setError('Barcha maydonlarni to\'ldiring');
      return;
    }

    // Check minimum age (16 years)
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age < 16) {
      setError('Kamida 16 yoshda bo\'lishingiz kerak');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (uploadingImage) {
        setError('Rasm yuklanmoqda, iltimos kuting…');
        setLoading(false);
        return;
      }

      // Update profile in backend (single source of truth)
      console.log('💾 Updating profile in backend...');
      
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': accessToken,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          birthDate,
          gender,
          profileImage: profileImage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Profilni yangilashda xatolik');
      }

      console.log('✅ Profile updated successfully in backend!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Update profile error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-all z-10"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Content */}
        <div className="p-8 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">
              Profilni tahrirlash
            </h2>
            <p className="text-white/60">
              Ma'lumotlaringizni yangilang
            </p>
          </div>

          {/* Profile Image Upload */}
          <div className="flex flex-col items-center mb-6">
            <div 
              className="relative w-28 h-28 rounded-full mb-4 cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
              style={{
                backgroundImage: accentColor.gradient,
                boxShadow: isDark 
                  ? `0 12px 40px ${accentColor.color}80, 0 6px 20px rgba(0, 0, 0, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.3)`
                  : `0 8px 32px ${accentColor.color}4d, 0 4px 16px ${accentColor.color}33, inset 0 2px 0 rgba(255, 255, 255, 0.5)`,
                border: `3px solid ${accentColor.color}4d`,
              }}
            >
              {imagePreview ? (
                <img 
                  src={imagePreview} 
                  alt="Profile" 
                  className="absolute inset-0 w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 rounded-full flex items-center justify-center">
                  <User className="size-16 text-white" strokeWidth={1.5} />
                </div>
              )}
              
              {/* Upload Overlay */}
              <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="size-8 text-white" />
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
              style={{ color: accentColor.color }}
            >
              <Upload className="size-4" />
              Rasm yuklash
            </button>
          </div>

          {uploadPct !== null && (
            <div
              className="mb-5 p-3 rounded-2xl border"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-white/80">{uploadingImage ? 'Yuklanmoqda…' : 'Tayyor'}</span>
                <span style={{ color: accentColor.color }}>{uploadPct}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.10)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${uploadPct}%`, background: accentColor.gradient }} />
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/80 mb-2 text-sm font-medium">
                  Ism
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ismingiz"
                  className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-2xl text-white focus:border-[var(--accent-color)] focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-white/80 mb-2 text-sm font-medium">
                  Familya
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Familyangiz"
                  className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-2xl text-white focus:border-[var(--accent-color)] focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Birth Date */}
            <div>
              <label className="block text-white/80 mb-2 text-sm font-medium">
                Tug'ilgan kun
              </label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <WheelDatePicker
                  value={birthDate}
                  onChange={(date) => setBirthDate(date)}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border-2 border-white/10 rounded-2xl text-white focus:border-[var(--accent-color)] focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-white/80 mb-2 text-sm font-medium">
                Jins
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`py-3 px-4 rounded-2xl font-medium transition-all ${
                    gender === 'male'
                      ? 'bg-[var(--accent-color)] text-white shadow-lg'
                      : 'bg-white/5 text-white/60 border-2 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Users className="w-5 h-5" />
                    Erkak
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`py-3 px-4 rounded-2xl font-medium transition-all ${
                    gender === 'female'
                      ? 'bg-[var(--accent-color)] text-white shadow-lg'
                      : 'bg-white/5 text-white/60 border-2 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Users className="w-5 h-5" />
                    Ayol
                  </div>
                </button>
              </div>
            </div>

            {/* Phone (Read-only) */}
            <div>
              <label className="block text-white/80 mb-2 text-sm font-medium">
                Telefon raqam
              </label>
              <input
                type="tel"
                value={userData?.phone || ''}
                disabled
                className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-2xl text-white/40 cursor-not-allowed"
              />
              <p className="text-xs text-white/40 mt-1">
                Telefon raqamni o'zgartirish mumkin emas
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center"
              >
                {error}
              </motion.div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || uploadingImage}
              className="w-full py-4 bg-[var(--accent-color)] text-white rounded-2xl font-semibold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition-all"
            >
              {loading || uploadingImage ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {uploadingImage ? 'Rasm yuklanmoqda...' : 'Saqlanmoqda...'}
                </span>
              ) : (
                'Saqlash'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}