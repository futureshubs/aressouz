import React, { useState, useRef, useEffect } from 'react';
import { X, Phone, ArrowLeft, Loader2, CheckCircle2, User, Calendar, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { publicAnonKey, API_BASE_URL } from '../../../utils/supabase/info';
import { useThemePalette } from '../hooks/useThemePalette';

const API_URL = API_BASE_URL; // Use local backend in development

interface SMSAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any, session: any) => void;
}

type AuthStep = 'phone' | 'code' | 'details' | 'loading' | 'success';

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
  const [kbInsetPx, setKbInsetPx] = useState(0);
  
  const codeInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const otpHiddenInputRef = useRef<HTMLInputElement | null>(null);
  const { tc, isLight } = useThemePalette('android');

  // Read CSS keyboard inset into React state (for iOS/Telegram alignment).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!isOpen) return;

    const root = document.documentElement;
    const vv = window.visualViewport;

    const readInset = () => {
      try {
        const raw = getComputedStyle(root).getPropertyValue('--kb-inset').trim();
        const px = Math.max(0, Math.round(parseFloat(raw) || 0));
        setKbInsetPx(px);
      } catch {
        setKbInsetPx(0);
      }
    };

    readInset();
    const onResize = () => readInset();
    if (vv) {
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('focusin', onResize);
    window.addEventListener('focusout', onResize);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      }
      window.removeEventListener('resize', onResize);
      window.removeEventListener('focusin', onResize);
      window.removeEventListener('focusout', onResize);
    };
  }, [isOpen]);

  // SMS OTP auto-read (WebOTP on supported browsers)
  useEffect(() => {
    if (!isOpen) return;
    if (step !== 'code') return;

    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    const getOtp: any = nav?.credentials?.get;
    if (typeof getOtp !== 'function') return;

    const ac = new AbortController();
    (async () => {
      try {
        const cred: any = await getOtp.call(nav.credentials, {
          otp: { transport: ['sms'] },
          signal: ac.signal,
        });
        const otp = String(cred?.code || '').replace(/\D/g, '').slice(0, 6);
        if (otp.length !== 6) return;
        const digits = otp.split('');
        setCode(digits);
        // Trigger verify immediately
        handleVerifyCode(otp);
      } catch {
        // ignore (unsupported, cancelled, timeout, or webview limitations)
      }
    })();

    return () => ac.abort();
  }, [isOpen, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
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
      value = value.slice(0, 1);
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
        const notRegistered =
          data.code === 'SMS_USER_NOT_REGISTERED' ||
          String(data.error || '').includes('ro\'yxatdan o\'tmagan') ||
          String(data.error || '').includes('royxatdan o\'tmagan');
        if (notRegistered) {
          setIsNewUser(true);
          setStep('details');
          setLoading(false);
          return;
        }
        const hint =
          data.code === 'SMS_CODE_WRONG'
            ? 'Kod noto‘g‘ri. SMS dagi 6 raqamni tekshiring.'
            : data.code === 'SMS_CODE_EXPIRED' || data.code === 'SMS_CODE_MISSING'
              ? 'Kod eskirgan yoki yuborilmagan. «Qayta yuborish» bilan yangi kod oling.'
              : data.error || 'Kirishda xatolik';
        throw new Error(hint);
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
      <div className="text-center" style={{ color: tc.text.primary }}>
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center">
          <Phone className="w-10 h-10 text-[var(--accent-color)]" />
        </div>
        <h2 className="text-3xl font-bold mb-2" style={{ color: tc.text.primary }}>
          {isNewUser ? 'Ro\'yxatdan o\'tish' : 'Kirish'}
        </h2>
        <p style={{ color: tc.text.secondary }}>Telefon raqamingizni kiriting</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block mb-2 text-sm font-medium" style={{ color: tc.text.secondary }}>
            Telefon raqam
          </label>
          <input
            type="tel"
            value={formatPhoneDisplay(phone)}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="+998 (XX) XXX-XX-XX"
            className="w-full px-4 py-4 border-2 rounded-2xl text-lg text-center tracking-wider focus:border-[var(--accent-color)] focus:outline-none transition-all"
            style={{
              background: tc.input.background,
              borderColor: tc.input.border,
              color: tc.text.primary,
            }}
            maxLength={20}
          />
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-center ${isLight ? 'text-red-600' : 'text-red-400'}`}
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
        type="button"
        onClick={() => setStep('phone')}
        className="flex items-center gap-2 transition-colors"
        style={{ color: tc.text.secondary }}
      >
        <ArrowLeft className="w-5 h-5" />
        Orqaga
      </button>

      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center">
          <Phone className="w-10 h-10 text-[var(--accent-color)]" />
        </div>
        <h2 className="text-3xl font-bold mb-2" style={{ color: tc.text.primary }}>
          Kodni kiriting
        </h2>
        <p style={{ color: tc.text.secondary }}>
          {formatPhoneDisplay(phone)} raqamiga yuborilgan 6 raqamli kodni kiriting
        </p>
      </div>

      <div className="space-y-4">
        {/* Hidden OTP input (iOS/Android autofill hint) */}
        <input
          ref={otpHiddenInputRef}
          value={code.join('')}
          onChange={(e) => {
            const otp = String(e.target.value || '').replace(/\D/g, '').slice(0, 6);
            if (otp.length !== 6) return;
            const digits = otp.split('');
            setCode(digits);
            handleVerifyCode(otp);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-hidden="true"
          tabIndex={-1}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
        />

        <div className="flex justify-center gap-2">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                codeInputsRef.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleCodeKeyDown(index, e)}
              onFocus={() => {
                // Encourage OS OTP autofill to target our hidden one-time-code field
                otpHiddenInputRef.current?.focus();
                // then keep UX on the visible cell
                requestAnimationFrame(() => codeInputsRef.current[index]?.focus());
              }}
              className="w-12 h-14 border-2 rounded-2xl text-2xl text-center focus:border-[var(--accent-color)] focus:outline-none transition-all"
              style={{
                background: tc.input.background,
                borderColor: tc.input.border,
                color: tc.text.primary,
              }}
            />
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-center ${isLight ? 'text-red-600' : 'text-red-400'}`}
          >
            {error}
          </motion.div>
        )}

        {countdown > 0 && (
          <div className="text-center text-sm" style={{ color: tc.text.tertiary }}>
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
        type="button"
        onClick={() => setStep('code')}
        className="flex items-center gap-2 transition-colors"
        style={{ color: tc.text.secondary }}
      >
        <ArrowLeft className="w-5 h-5" />
        Orqaga
      </button>

      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center">
          <User className="w-10 h-10 text-[var(--accent-color)]" />
        </div>
        <h2 className="text-3xl font-bold mb-2" style={{ color: tc.text.primary }}>
          Ma'lumotlarni to'ldiring
        </h2>
        <p style={{ color: tc.text.secondary }}>Iltimos, shaxsiy ma'lumotlaringizni kiriting</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block mb-2 text-sm font-medium" style={{ color: tc.text.secondary }}>
              Ism
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ismingiz"
              className="w-full px-4 py-3 border-2 rounded-2xl focus:border-[var(--accent-color)] focus:outline-none transition-all placeholder:text-gray-400"
              style={{
                background: tc.input.background,
                borderColor: tc.input.border,
                color: tc.text.primary,
              }}
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium" style={{ color: tc.text.secondary }}>
              Familya
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Familyangiz"
              className="w-full px-4 py-3 border-2 rounded-2xl focus:border-[var(--accent-color)] focus:outline-none transition-all placeholder:text-gray-400"
              style={{
                background: tc.input.background,
                borderColor: tc.input.border,
                color: tc.text.primary,
              }}
            />
          </div>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium" style={{ color: tc.text.secondary }}>
            Tug'ilgan kun
          </label>
          <div className="relative pl-12">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10" style={{ color: tc.text.tertiary }} />
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              inputMode="numeric"
              autoComplete="bday"
              max={new Date().toISOString().slice(0, 10)}
              className="w-full px-4 py-3 border-2 rounded-2xl focus:border-[var(--accent-color)] focus:outline-none transition-all"
              style={{
                background: tc.input.background,
                borderColor: tc.input.border,
                color: tc.text.primary,
              }}
            />
          </div>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium" style={{ color: tc.text.secondary }}>
            Jins
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGender('male')}
              className={`py-3 px-4 rounded-2xl font-medium transition-all border-2 ${
                gender === 'male' ? 'bg-[var(--accent-color)] text-white shadow-lg border-transparent' : ''
              }`}
              style={
                gender === 'male'
                  ? undefined
                  : {
                      background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                      borderColor: tc.border.primary,
                      color: tc.text.secondary,
                    }
              }
            >
              <div className="flex items-center justify-center gap-2">
                <Users className="w-5 h-5" />
                Erkak
              </div>
            </button>
            <button
              type="button"
              onClick={() => setGender('female')}
              className={`py-3 px-4 rounded-2xl font-medium transition-all border-2 ${
                gender === 'female' ? 'bg-[var(--accent-color)] text-white shadow-lg border-transparent' : ''
              }`}
              style={
                gender === 'female'
                  ? undefined
                  : {
                      background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                      borderColor: tc.border.primary,
                      color: tc.text.secondary,
                    }
              }
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
            className={`p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-center ${isLight ? 'text-red-600' : 'text-red-400'}`}
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
      <h3 className="text-2xl font-bold mb-2" style={{ color: tc.text.primary }}>
        {isNewUser ? 'Ro\'yxatdan o\'tilmoqda...' : 'Kirilmoqda...'}
      </h3>
      <p className="text-center" style={{ color: tc.text.secondary }}>
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
        className="text-3xl font-bold mb-2"
        style={{ color: tc.text.primary }}
      >
        Xush kelibsiz! 🎉
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center"
        style={{ color: tc.text.secondary }}
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
      className={`fixed inset-0 app-safe-pad z-[100] flex justify-center backdrop-blur-sm p-4 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] ${
        kbInsetPx > 20 ? 'items-start' : 'items-center'
      }`}
      style={{
        background: tc.backdrop,
        // Make the scroll container match the *visible* viewport.
        minHeight: 'var(--app-viewport-height, 100dvh)',
        // Telegram WebApp top bar can be taller than safe-area on some devices.
        paddingTop: 'calc(1rem + var(--app-safe-top, 0px))',
        paddingBottom: 'calc(1rem + var(--kb-inset, 0px) + var(--app-safe-bottom, 0px))',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md rounded-3xl overflow-hidden border"
        style={{
          background: tc.background.modal,
          borderColor: tc.border.primary,
          boxShadow: tc.shadow.xl,
          // Keep modal within the *visible* viewport when keyboard is open.
          maxHeight:
            'min(900px, calc(var(--app-viewport-height, 100dvh) - var(--app-safe-top, 0px) - var(--app-safe-bottom, 0px) - 2rem - var(--kb-inset, 0px)))',
          // When keyboard opens we use items-start; keep transform neutral.
          transform: 'translateY(0px)',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-all z-10"
          style={{
            background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
          }}
        >
          <X className="w-5 h-5" style={{ color: tc.text.primary }} />
        </button>

        {/* Content */}
        <div
          className="p-8 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
          style={{
            maxHeight:
              'calc(var(--app-viewport-height, 100dvh) - var(--app-safe-top, 0px) - var(--app-safe-bottom, 0px) - 120px - var(--kb-inset, 0px))',
            paddingBottom: 'calc(1rem + var(--kb-inset, 0px) + var(--app-safe-bottom, 0px))',
          }}
        >
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