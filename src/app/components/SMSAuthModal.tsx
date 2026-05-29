import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, Loader2, CheckCircle2, User, Calendar, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router';
import { publicAnonKey, API_BASE_URL } from '../../../utils/supabase/info';
import { useTheme } from '../context/ThemeContext';
import {
  otpDigitsToArray,
  parseOtpDigits,
  requestWebSmsOtp,
  smsOtpHostForApi,
} from '../utils/smsOtpAutofill';

const API_URL = API_BASE_URL;

interface SMSAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any, session: any) => void;
}

type AuthStep = 'phone' | 'code' | 'details' | 'loading' | 'success';

function formatPhoneLocal(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 9);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
  if (d.length <= 7) return `${d.slice(0, 2)} ${d.slice(2, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 5)}-${d.slice(5, 7)}-${d.slice(7, 9)}`;
}

function formatPhoneSent(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.length !== 12) return `+${d}`;
  return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

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
  const [isNewUser, setIsNewUser] = useState(false);
  const [kbInsetPx, setKbInsetPx] = useState(0);
  const [focusedOtp, setFocusedOtp] = useState(0);

  const codeInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const otpAutofillInputRef = useRef<HTMLInputElement | null>(null);
  const webOtpAbortRef = useRef<AbortController | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!isOpen) return;

    const root = document.documentElement;
    const vv = window.visualViewport;

    const readInset = () => {
      try {
        const raw = getComputedStyle(root).getPropertyValue('--kb-inset').trim();
        setKbInsetPx(Math.max(0, Math.round(parseFloat(raw) || 0)));
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

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const applyOtpFromAutofill = (raw: string) => {
    const otp = parseOtpDigits(raw);
    if (!otp) {
      setCode(['', '', '', '', '', '']);
      return;
    }
    const digits = otpDigitsToArray(otp);
    setCode(digits);
    setError('');
    if (otp.length === 6) {
      void handleVerifyCode(otp);
    }
  };

  const startWebOtpListener = () => {
    webOtpAbortRef.current?.abort();
    const ac = new AbortController();
    webOtpAbortRef.current = ac;
    void (async () => {
      const otp = await requestWebSmsOtp(ac.signal);
      if (!otp || ac.signal.aborted) return;
      applyOtpFromAutofill(otp);
    })();
  };

  useEffect(() => {
    if (!isOpen || step !== 'code') {
      webOtpAbortRef.current?.abort();
      return;
    }
    startWebOtpListener();
    const t = window.setTimeout(() => {
      otpAutofillInputRef.current?.focus();
    }, 150);
    return () => {
      window.clearTimeout(t);
      webOtpAbortRef.current?.abort();
    };
  }, [isOpen, step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [countdown]);

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
        setFocusedOtp(0);
      }, 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && step === 'phone') {
      setTimeout(() => phoneInputRef.current?.focus(), 120);
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  const phoneLocal = phone.startsWith('998') ? phone.slice(3) : phone.replace(/\D/g, '').slice(3);

  const handlePhoneLocalChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 9);
    setPhone(cleaned.length > 0 ? `998${cleaned}` : '');
    setError('');
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
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
        },
        body: JSON.stringify({ phone, otpHost: smsOtpHostForApi() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'SMS yuborishda xatolik');
      }

      setStep('code');
      setCountdown(300);
      setCode(['', '', '', '', '', '']);
      setTimeout(() => {
        otpAutofillInputRef.current?.focus();
        startWebOtpListener();
      }, 120);
    } catch (err: any) {
      console.error('Send SMS error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const cleared = [...code];
      cleared[index] = '';
      setCode(cleared);
      setError('');
      return;
    }

    if (cleaned.length > 1) {
      const next = [...code];
      let cursor = index;
      for (const ch of cleaned.slice(0, 6 - index)) {
        next[cursor] = ch;
        cursor += 1;
      }
      setCode(next);
      setError('');
      const joined = next.join('');
      if (joined.length === 6) {
        handleVerifyCode(joined);
      } else {
        codeInputsRef.current[Math.min(cursor, 5)]?.focus();
        setFocusedOtp(Math.min(cursor, 5));
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = cleaned;
    setCode(newCode);
    setError('');

    if (index < 5) {
      codeInputsRef.current[index + 1]?.focus();
      setFocusedOtp(index + 1);
    }

    if (index === 5 && newCode.every((c) => c !== '')) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const otp = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!otp) return;
    const digits = [...otp.split(''), ...Array(6).fill('')].slice(0, 6);
    setCode(digits);
    setError('');
    if (otp.length === 6) {
      handleVerifyCode(otp);
    } else {
      codeInputsRef.current[otp.length]?.focus();
      setFocusedOtp(otp.length);
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputsRef.current[index - 1]?.focus();
      setFocusedOtp(index - 1);
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
      const response = await fetch(`${API_URL}/auth/sms/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
        },
        body: JSON.stringify({ phone, code: fullCode }),
      });

      const data = await response.json();

      if (!response.ok) {
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
              ? 'Kod eskirgan yoki yuborilmagan. Qayta so‘rash bilan yangi kod oling.'
              : data.error || 'Kirishda xatolik';
        throw new Error(hint);
      }

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

    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;

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
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
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

  const handleBack = () => {
    setError('');
    if (step === 'code') setStep('phone');
    if (step === 'details') setStep('code');
  };

  const pillBg = isLight ? '#f3f4f6' : 'rgba(255,255,255,0.08)';
  const otpBoxBg = isLight ? '#f3f4f6' : 'rgba(255,255,255,0.1)';

  const renderError = () =>
    error ? (
      <p className={`text-center text-sm ${isLight ? 'text-red-600' : 'text-red-400'}`}>{error}</p>
    ) : null;

  const renderPhoneStep = () => (
    <motion.div
      key="phone"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="mx-auto flex w-full max-w-md flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col justify-center pt-6">
        <h1 className="mb-2 text-center text-[26px] font-bold leading-tight tracking-tight text-foreground">
          Telefon raqamingizni kiriting
        </h1>
        <p className="mb-10 text-center text-[15px] text-muted-foreground">
          Kirish yoki ro&apos;yxatdan o&apos;tish uchun
        </p>

        <div
          className="flex items-center gap-2.5 rounded-[20px] px-4 py-[18px]"
          style={{ background: pillBg }}
        >
          <span className="text-[22px] leading-none" aria-hidden>
            🇺🇿
          </span>
          <span className="shrink-0 text-[17px] font-medium text-foreground">+998</span>
          <input
            ref={phoneInputRef}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={formatPhoneLocal(phoneLocal)}
            onChange={(e) => handlePhoneLocalChange(e.target.value)}
            placeholder="00 000-00-00"
            className="min-w-0 flex-1 bg-transparent text-[17px] font-medium text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </div>

        {renderError()}
      </div>

      <div className="shrink-0 space-y-4 pb-2 pt-6">
        <button
          type="button"
          onClick={sendSMS}
          disabled={loading || phone.length !== 12}
          className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[var(--accent-color)] py-[18px] text-[17px] font-bold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Yuborilmoqda...
            </>
          ) : (
            'Kodni olish'
          )}
        </button>

        <p className="px-2 text-center text-[12px] leading-relaxed text-muted-foreground">
          Tugmani bosish orqali quyidagiga rozilik berasiz:{' '}
          <Link
            to="/docs/terms"
            onClick={onClose}
            className="font-medium underline underline-offset-2"
            style={{ color: 'var(--accent-color)' }}
          >
            savdo maydonchasidan foydalanish qoidalariga rozilik beraman.
          </Link>
        </p>
      </div>
    </motion.div>
  );

  const renderCodeStep = () => (
    <motion.div
      key="code"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="mx-auto flex w-full max-w-md flex-1 flex-col pt-4"
    >
      <div className="flex-1">
        <h1 className="mb-3 text-[26px] font-bold leading-tight tracking-tight text-foreground">
          Sms xabardagi kodni kiriting
        </h1>
        <p className="mb-2 text-[15px] text-muted-foreground">
          <span className="font-medium text-foreground">{formatPhoneSent(phone)}</span> ga yubordik
        </p>
        <p className="mb-8 text-[13px] text-muted-foreground">
          SMS kelganda kod avtomatik yoziladi (telefonda ruxsat bering). Kerak bo‘lsa qo‘lda ham kiritishingiz mumkin.
        </p>

        <div
          className="relative flex items-center justify-between gap-1.5 sm:gap-2"
          onPaste={handleCodePaste}
        >
          {/* iOS / Android: autocomplete="one-time-code" — ustiga shaffof input */}
          <input
            ref={otpAutofillInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="one-time-code"
            maxLength={6}
            value={code.join('')}
            onChange={(e) => applyOtpFromAutofill(e.target.value)}
            onFocus={() => setFocusedOtp(Math.min(code.join('').length, 5))}
            className="absolute inset-0 z-10 h-full w-full cursor-text opacity-[0.02] text-[16px] caret-transparent outline-none"
            style={{ WebkitTextFillColor: 'transparent' }}
            aria-label="SMS tasdiqlash kodi"
          />

          {code.map((digit, index) => (
            <div
              key={index}
              ref={(el) => {
                codeInputsRef.current[index] = el as unknown as HTMLInputElement;
              }}
              role="presentation"
              className="pointer-events-none relative z-0 flex h-[52px] w-[46px] shrink-0 items-center justify-center rounded-[14px] text-[22px] font-semibold text-foreground sm:h-[56px] sm:w-[50px] sm:text-[24px]"
              style={{
                background: otpBoxBg,
                boxShadow:
                  focusedOtp === index || digit
                    ? '0 0 0 2px var(--accent-color)'
                    : 'none',
              }}
            >
              {digit || (focusedOtp === index ? '|' : '')}
            </div>
          ))}

          {loading ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/40">
              <Loader2 className="h-7 w-7 animate-spin text-[var(--accent-color)]" />
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => otpAutofillInputRef.current?.focus()}
          className="mt-4 w-full text-center text-[13px] font-medium text-[var(--accent-color)]"
        >
          Kodni qo‘lda kiritish
        </button>

        <div className="mt-8 text-center">
          {countdown > 0 ? (
            <p className="text-[14px] text-muted-foreground">
              {formatCountdown(countdown)} dan keyin kodni qayta so&apos;rash
            </p>
          ) : (
            <button
              type="button"
              onClick={() => sendSMS()}
              disabled={loading}
              className="text-[14px] font-semibold text-[var(--accent-color)] disabled:opacity-40"
            >
              Kodni qayta so&apos;rash
            </button>
          )}
        </div>

        {renderError()}
      </div>
    </motion.div>
  );

  const fieldClass =
    'w-full rounded-[16px] px-4 py-3.5 text-[16px] outline-none transition-all focus:ring-2 focus:ring-[var(--accent-color)]/25';

  const renderDetailsStep = () => (
    <motion.div
      key="details"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="mx-auto flex w-full max-w-md flex-1 flex-col pt-4"
    >
      <div className="flex-1">
        <h1 className="mb-3 text-[26px] font-bold leading-tight text-foreground">Ma&apos;lumotlaringiz</h1>
        <p className="mb-8 text-[15px] text-muted-foreground">
          Profilni yakunlash uchun shaxsiy ma&apos;lumotlarni kiriting
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-[13px] font-medium text-muted-foreground">Ism</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ismingiz"
                className={fieldClass}
                style={{ background: pillBg }}
              />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-medium text-muted-foreground">Familya</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Familyangiz"
                className={fieldClass}
                style={{ background: pillBg }}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-medium text-muted-foreground">Tug&apos;ilgan kun</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                autoComplete="bday"
                max={new Date().toISOString().slice(0, 10)}
                className={`${fieldClass} pl-12`}
                style={{ background: pillBg }}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-medium text-muted-foreground">Jins</label>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as const).map((value) => {
                const active = gender === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGender(value)}
                    className={`rounded-[16px] px-4 py-3.5 text-[15px] font-semibold transition-all active:scale-[0.98] ${
                      active ? 'bg-[var(--accent-color)] text-white' : 'text-muted-foreground'
                    }`}
                    style={active ? undefined : { background: pillBg }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Users className="h-5 w-5" />
                      {value === 'male' ? 'Erkak' : 'Ayol'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {renderError()}
      </div>

      <div className="shrink-0 pb-2 pt-8">
        <button
          type="button"
          onClick={handleSubmitDetails}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[var(--accent-color)] py-[18px] text-[17px] font-bold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Ro&apos;yxatdan o&apos;tilmoqda...
            </>
          ) : (
            'Ro\'yxatdan o\'tish'
          )}
        </button>
      </div>
    </motion.div>
  );

  const renderLoadingStep = () => (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-1 flex-col items-center justify-center py-16"
    >
      <Loader2 className="mb-6 h-12 w-12 animate-spin text-[var(--accent-color)]" />
      <h2 className="mb-2 text-xl font-bold text-foreground">
        {isNewUser ? 'Ro\'yxatdan o\'tilmoqda...' : 'Kirilmoqda...'}
      </h2>
      <p className="text-muted-foreground">Iltimos, kuting</p>
    </motion.div>
  );

  const renderSuccessStep = () => (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-1 flex-col items-center justify-center py-16"
    >
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
      </div>
      <h2 className="mb-2 text-[26px] font-bold text-foreground">Xush kelibsiz!</h2>
      <p className="text-center text-muted-foreground">
        Muvaffaqiyatli {isNewUser ? 'ro\'yxatdan o\'tdingiz' : 'kirdingiz'}
      </p>
    </motion.div>
  );

  const showNav = step === 'phone' || step === 'code' || step === 'details';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex flex-col bg-background text-foreground"
      style={{
        minHeight: 'var(--app-viewport-height, 100dvh)',
        paddingTop: 'var(--app-safe-top, env(safe-area-inset-top, 0px))',
        paddingBottom: `calc(var(--app-safe-bottom, env(safe-area-inset-bottom, 0px)) + ${kbInsetPx}px)`,
      }}
    >
      {showNav && (
        <header className="flex h-14 shrink-0 items-center justify-between px-4">
          {step === 'code' || step === 'details' ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Orqaga"
              className="flex h-10 w-10 items-center justify-center transition-opacity active:opacity-60"
            >
              <ChevronLeft className="h-7 w-7 text-[var(--accent-color)]" strokeWidth={2.2} />
            </button>
          ) : (
            <span className="w-10" />
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-10 w-10 items-center justify-center transition-opacity active:opacity-60"
          >
            <X className="h-6 w-6 text-[var(--accent-color)]" strokeWidth={2.2} />
          </button>
        </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 sm:px-6 [-webkit-overflow-scrolling:touch]">
        <AnimatePresence mode="wait">
          {step === 'phone' && renderPhoneStep()}
          {step === 'code' && renderCodeStep()}
          {step === 'details' && renderDetailsStep()}
          {step === 'loading' && renderLoadingStep()}
          {step === 'success' && renderSuccessStep()}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
