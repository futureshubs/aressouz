import React, { useState, useRef, useEffect } from 'react';
import { X, Phone, ArrowLeft, Loader2, CheckCircle2, User, Calendar, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { projectId, publicAnonKey, API_BASE_URL } from '/utils/supabase/info';
import { WheelDatePicker } from './WheelDatePicker';

const API_URL = API_BASE_URL; // Use local backend in development

interface SMSAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any, session: any) => void;
}

type AuthStep = 'phone' | 'code' | 'details' | 'loading' | 'success';
type AuthMode = 'signin' | 'signup';

export function SMSAuthModal({ isOpen, onClose, onSuccess }: SMSAuthModalProps) {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false); // Track if user is new
  
  const codeInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('phone');
        setPhone('');
        setCode(['', '', '', '', '', '']);
        setFirstName('');
        setLastName('');
        setBirthDate('');
        setGender('male');
        setError('');
        setLoading(false);
        setCountdown(0);
        setIsNewUser(false);
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatPhoneDisplay = (value: string) => {
    // Format: +998 (XX) XXX-XX-XX
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 0) return '+998 ';
    if (cleaned.length <= 3) return `+998 `;
    if (cleaned.length <= 5) return `+998 (${cleaned.slice(3)})`;
    if (cleaned.length <= 8) return `+998 (${cleaned.slice(3, 5)}) ${cleaned.slice(5)}`;
    return `+998 (${cleaned.slice(3, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8, 10)}-${cleaned.slice(10, 12)}`;
  };

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('998')) {
      setPhone(cleaned);
    } else if (cleaned.length > 0) {
      setPhone('998' + cleaned);
    } else {
      setPhone('998');
    }
  };

  const sendSMS = async () => {
    setError('');
    
    if (phone.length !== 12) {
      setError('Telefon raqam to\'liq emas');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey,
        },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'SMS yuborishda xatolik');
      }

      setStep('code');
      setCountdown(300); // 5 minutes
      setTimeout(() => codeInputsRef.current[0]?.focus(), 100);
    } catch (err: any) {
      console.error('Send SMS error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow numeric input
    if (!/^\d*$/.test(value)) {
      return;
    }

    if (value.length > 1) {
      value = value[0];
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      codeInputsRef.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (index === 5 && value && newCode.every(c => c !== '')) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputsRef.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async (codeValue?: string) => {
    const fullCode = codeValue || code.join('');
    
    if (fullCode.length !== 6) {
      setError('Kodni to\'liq kiriting');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // First, try to sign in
      const response = await fetch(`${API_URL}/auth/sms/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey,
        },
        body: JSON.stringify({ phone, code: fullCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If user doesn't exist, switch to signup mode
        if (data.error?.includes('ro\'yxatdan o\'tmagan')) {
          setIsNewUser(true);
          setStep('details');
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Kirishda xatolik');
      }

      // Sign in successful - show success animation
      setStep('loading');
      setTimeout(() => {
        setStep('success');
        setTimeout(() => {
          onSuccess(data.user, data.session);
          onClose();
        }, 2000);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDetails = async () => {
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
      setError('Ro\'yxatdan o\'tish uchun kamida 16 yoshda bo\'lishingiz kerak');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/sms/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey,
        },
        body: JSON.stringify({
          phone,
          code: code.join(''),
          firstName,
          lastName,
          birthDate,
          gender,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ro\'yxatdan o\'tishda xatolik');
      }

      // Show loading animation
      setStep('loading');
      setTimeout(() => {
        setStep('success');
        setTimeout(() => {
          onSuccess(data.user, data.session);
          onClose();
        }, 2000);
      }, 4000);
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderPhoneStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center">
          <Phone className="w-10 h-10 text-[var(--accent-color)]" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">
          {isNewUser ? 'Ro\'yxatdan o\'tish' : 'Kirish'}
        </h2>
        <p className="text-white/60">
          Telefon raqamingizni kiriting
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-white/80 mb-2 text-sm font-medium">
            Telefon raqam
          </label>
          <input
            type="tel"
            value={formatPhoneDisplay(phone)}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="+998 (XX) XXX-XX-XX"
            className="w-full px-4 py-4 bg-white/5 border-2 border-white/10 rounded-2xl text-white text-lg text-center tracking-wider focus:border-[var(--accent-color)] focus:outline-none transition-all"
            maxLength={20}
          />
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
          onClick={sendSMS}
          disabled={loading || phone.length !== 12}
          className="w-full py-4 bg-[var(--accent-color)] text-white rounded-2xl font-semibold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Yuborilmoqda...
            </span>
          ) : (
            'SMS yuborish'
          )}
        </button>
      </div>
    </motion.div>
  );

  const renderCodeStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <button
        onClick={() => setStep('phone')}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Orqaga
      </button>

      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center">
          <Phone className="w-10 h-10 text-[var(--accent-color)]" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">
          Kodni kiriting
        </h2>
        <p className="text-white/60">
          {formatPhoneDisplay(phone)} raqamiga yuborilgan 6 raqamli kodni kiriting
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-center gap-2">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={el => codeInputsRef.current[index] = el}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleCodeKeyDown(index, e)}
              className="w-12 h-14 bg-white/5 border-2 border-white/10 rounded-2xl text-white text-2xl text-center focus:border-[var(--accent-color)] focus:outline-none transition-all"
            />
          ))}
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

        {countdown > 0 && (
          <div className="text-center text-white/40 text-sm">
            Qayta yuborish: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
          </div>
        )}

        <button
          onClick={() => sendSMS()}
          disabled={loading || countdown > 0}
          className="w-full py-3 text-[var(--accent-color)] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:underline transition-all"
        >
          Kodni qayta yuborish
        </button>

        <button
          onClick={() => handleVerifyCode()}
          disabled={loading || code.some(c => c === '')}
          className="w-full py-4 bg-[var(--accent-color)] text-white rounded-2xl font-semibold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Tekshirilmoqda...
            </span>
          ) : (
            'Davom etish'
          )}
        </button>
      </div>
    </motion.div>
  );

  const renderDetailsStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <button
        onClick={() => setStep('code')}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Orqaga
      </button>

      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center">
          <User className="w-10 h-10 text-[var(--accent-color)]" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">
          Ma'lumotlarni to'ldiring
        </h2>
        <p className="text-white/60">
          Iltimos, shaxsiy ma'lumotlaringizni kiriting
        </p>
      </div>

      <div className="space-y-4">
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
          onClick={handleSubmitDetails}
          disabled={loading}
          className="w-full py-4 bg-[var(--accent-color)] text-white rounded-2xl font-semibold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Ro'yxatdan o'tilmoqda...
            </span>
          ) : (
            'Ro\'yxatdan o\'tish'
          )}
        </button>
      </div>
    </motion.div>
  );

  const renderLoadingStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12"
    >
      <motion.div
        animate={{
          rotate: 360,
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="w-24 h-24 rounded-full border-4 border-[var(--accent-color)]/20 border-t-[var(--accent-color)] mb-6"
      />
      <h3 className="text-2xl font-bold text-white mb-2">
        {isNewUser ? 'Ro\'yxatdan o\'tilmoqda...' : 'Kirilmoqda...'}
      </h3>
      <p className="text-white/60 text-center">
        Iltimos, kuting
      </p>
    </motion.div>
  );

  const renderSuccessStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 15,
        }}
        className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6"
      >
        <CheckCircle2 className="w-16 h-16 text-green-500" />
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold text-white mb-2"
      >
        Xush kelibsiz! 🎉
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-white/60 text-center"
      >
        Muvaffaqiyatli {isNewUser ? 'ro\'yxatdan o\'tdingiz' : 'kirdingiz'}
      </motion.p>
    </motion.div>
  );

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
          {step === 'phone' && renderPhoneStep()}
          {step === 'code' && renderCodeStep()}
          {step === 'details' && renderDetailsStep()}
          {step === 'loading' && renderLoadingStep()}
          {step === 'success' && renderSuccessStep()}
        </div>
      </motion.div>
    </motion.div>
  );
}