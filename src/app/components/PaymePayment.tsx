import { useState, useEffect, useRef, useCallback } from 'react';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL, DEV_API_BASE_URL, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { ExternalLink, Check, X, Loader2 } from 'lucide-react';
import { openExternalUrl } from '../utils/openExternalUrl';
import {
  PAYMENT_LOGO_FRAME_SKEW_DEG,
  PaymentMethodLogoFrame,
} from './payment/PaymentMethodLogoFrame';

const edgePaymeBase = import.meta.env.DEV ? DEV_API_BASE_URL : API_BASE_URL;

function PaymeBrandMark({ isDark }: { isDark: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex justify-center">
      <PaymentMethodLogoFrame
        brandColor="#00AACB"
        isDark={isDark}
        square
        squareSlotTone="light"
        skewDeg={PAYMENT_LOGO_FRAME_SKEW_DEG * 1.35}
      >
        {broken ? (
          <svg width="88" height="28" viewBox="0 0 88 28" fill="none" aria-hidden>
            <path
              d="M8.5 5C8.5 2.79086 10.2909 1 12.5 1h63C77.7091 1 79.5 2.79086 79.5 5v18c0 2.2091-1.7909 4-4 4h-63c-2.2091 0-4-1.7909-4-4V5Z"
              fill="#00AACB"
            />
            <text x="44" y="18" fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">
              Payme
            </text>
          </svg>
        ) : (
          <img
            src="/payments/payme-official.png?v=2"
            alt="Payme"
            className="block h-full w-full object-contain object-center"
            decoding="async"
            onError={() => setBroken(true)}
          />
        )}
      </PaymentMethodLogoFrame>
    </div>
  );
}

interface PaymePaymentProps {
  orderId: string;
  amount: number;
  phone: string;
  items: Array<{
    title: string;
    price: number;
    count: number;
    code?: string;
    units?: number;
    vat_percent?: number;
    package_code?: string;
  }>;
  onSuccess: () => void;
  onError: (error: string) => void;
  /** Chek tayyor bo‘lishi bilan Payme oynasini avtomatik ochish */
  autoOpenCheckout?: boolean;
}

export default function PaymePayment({
  orderId,
  amount,
  phone,
  items,
  onSuccess,
  onError,
  autoOpenCheckout = false,
}: PaymePaymentProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  onErrorRef.current = onError;
  onSuccessRef.current = onSuccess;

  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'success' | 'failed'>('pending');
  const [paymentWindow, setPaymentWindow] = useState<Window | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [paycomEnvironment, setPaycomEnvironment] = useState<'test' | 'prod' | null>(null);

  const pollingInterval = useRef<number | null>(null);
  const checkCount = useRef(0);
  const paymeAutoOpenDoneRef = useRef(false);
  const openPaymentWindowRef = useRef<() => void>(() => {});
  const itemsRef = useRef(items);
  itemsRef.current = items;
  /** React Strict Mode / tez qayta mount — eski create-receipt javobini e’tiborsiz qoldirish */
  const createResponseTokenRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  const createReceipt = useCallback(async () => {
    const token = ++createResponseTokenRef.current;
    setIsCreating(true);
    setPaycomEnvironment(null);
    setCreateError(null);
    setReceiptId(null);
    setCheckoutUrl(null);
    setPaymentStatus('pending');
    checkCount.current = 0;

    try {
      const returnUrl =
        typeof import.meta.env.VITE_PAYME_RETURN_URL === 'string'
          ? import.meta.env.VITE_PAYME_RETURN_URL.trim()
          : '';

      const response = await fetch(`${edgePaymeBase}/payme/create-receipt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          orderId,
          items: itemsRef.current,
          phone,
          ...(returnUrl ? { returnUrl } : {}),
        }),
      });

      const data = await response.json();

      if (token !== createResponseTokenRef.current) return;

      if (response.status === 409 && data.code === 'PAYCOM_ORDER_ALREADY_PAID') {
        setPaymentStatus('success');
        toast.success('Bu buyurtma allaqachon to‘langan');
        onSuccessRef.current();
        return;
      }

      if (response.ok && data.success) {
        setReceiptId(data.receiptId);
        setCheckoutUrl(data.checkoutUrl);
        if (data.paycomEnvironment === 'test' || data.paycomEnvironment === 'prod') {
          setPaycomEnvironment(data.paycomEnvironment);
        } else if (typeof data.checkoutUrl === 'string' && data.checkoutUrl.includes('test.paycom')) {
          setPaycomEnvironment('test');
        } else {
          setPaycomEnvironment('prod');
        }
        if (import.meta.env.DEV && typeof data.receiptState === 'number') {
          console.log('[Payme] chek state:', data.receiptState, 'muhit:', data.paycomEnvironment ?? '?');
        }
        if (data.idempotentReused) {
          if (import.meta.env.DEV) console.log('[Payme] mavjud chek qayta ishlatildi (idempotency)');
        } else {
          toast.success('Payme cheki yaratildi');
        }
      } else {
        const msg = data.error || 'Chek yaratishda xatolik';
        toast.error(msg);
        setCreateError(msg);
        onErrorRef.current(msg);
      }
    } catch (error: unknown) {
      console.error('Create receipt error:', error);
      if (token !== createResponseTokenRef.current) return;
      const msg = 'Tarmoq xatoligi';
      toast.error(msg);
      setCreateError(msg);
      onErrorRef.current(msg);
    } finally {
      if (token === createResponseTokenRef.current) {
        setIsCreating(false);
      }
    }
  }, [amount, orderId, phone]);

  useEffect(() => {
    paymeAutoOpenDoneRef.current = false;
  }, [orderId]);

  useEffect(() => {
    stopPolling();
    void createReceipt();
    return () => {
      stopPolling();
    };
  }, [orderId, amount, phone, createReceipt, stopPolling]);

  const checkPaymentStatus = useCallback(async () => {
    if (!receiptId || isChecking) return;

    setIsChecking(true);
    checkCount.current += 1;

    try {
      const response = await fetch(`${edgePaymeBase}/payme/check-receipt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiptId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.isPaid) {
          setPaymentStatus('success');
          stopPolling();

          if (paymentWindow && !paymentWindow.closed) {
            paymentWindow.close();
          }

          toast.success('To\'lov muvaffaqiyatli amalga oshirildi! ✅');
          onSuccessRef.current();
        } else if (data.isCancelled) {
          setPaymentStatus('failed');
          stopPolling();
          toast.error('To\'lov bekor qilindi');
          onErrorRef.current('To\'lov bekor qilindi');
        } else {
          setPaymentStatus('checking');
        }
      }
    } catch (error: unknown) {
      console.error('Check payment error:', error);
    } finally {
      setIsChecking(false);
    }
  }, [receiptId, isChecking, paymentWindow, stopPolling]);

  const checkPaymentStatusRef = useRef(checkPaymentStatus);
  checkPaymentStatusRef.current = checkPaymentStatus;
  useVisibilityRefetch(() => {
    void checkPaymentStatusRef.current();
  });

  const startPolling = () => {
    void checkPaymentStatus();
    pollingInterval.current = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void checkPaymentStatusRef.current();
      if (checkCount.current >= 100) {
        stopPolling();
        toast.warning('To\'lov tekshirish vaqti tugadi');
        onErrorRef.current('Vaqt tugadi');
      }
    }, 3000);
  };

  const openPaymentWindow = () => {
    if (!checkoutUrl) return;
    void openExternalUrl(checkoutUrl);
    setPaymentWindow(null);
    startPolling();
  };

  openPaymentWindowRef.current = openPaymentWindow;

  useEffect(() => {
    if (!autoOpenCheckout || paymeAutoOpenDoneRef.current) return;
    if (!checkoutUrl || isCreating || createError || paymentStatus !== 'pending') return;
    paymeAutoOpenDoneRef.current = true;
    const t = window.setTimeout(() => openPaymentWindowRef.current(), 450);
    return () => clearTimeout(t);
  }, [autoOpenCheckout, checkoutUrl, isCreating, createError, paymentStatus]);

  const handleCancelPayment = () => {
    stopPolling();

    if (paymentWindow && !paymentWindow.closed) {
      paymentWindow.close();
    }

    toast.info('To\'lov bekor qilindi');
    onErrorRef.current('Foydalanuvchi bekor qildi');
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <PaymeBrandMark isDark={isDark} />
        <p
          className="text-sm mt-2"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
        >
          Paycom Subscribe / Payme Business
        </p>
      </div>

      {isCreating && (
        <div
          className="p-4 rounded-xl border flex items-center gap-3"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#00AACB' }} />
          <span>Chek yaratilmoqda...</span>
        </div>
      )}

      {createError && !isCreating && (
        <div className="space-y-2">
          <div
            className="p-4 rounded-xl border flex items-center gap-3"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderColor: '#ef4444',
            }}
          >
            <X className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-sm">{createError}</span>
          </div>
          <button
            type="button"
            onClick={() => void createReceipt()}
            className="w-full py-3 rounded-2xl font-bold transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? '#ffffff' : '#111827',
            }}
          >
            Qayta urinish
          </button>
        </div>
      )}

      {paymentStatus === 'success' && (
        <div
          className="p-4 rounded-xl border flex items-center gap-3"
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            borderColor: '#10b981',
          }}
        >
          <Check className="w-5 h-5" style={{ color: '#10b981' }} />
          <span className="font-semibold">To'lov muvaffaqiyatli!</span>
        </div>
      )}

      {paymentStatus === 'checking' && (
        <div
          className="p-4 rounded-xl border flex items-center gap-3"
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            borderColor: '#3b82f6',
          }}
        >
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#3b82f6' }} />
          <span>To'lov tekshirilmoqda... ({checkCount.current})</span>
        </div>
      )}

      {paymentStatus === 'failed' && (
        <div
          className="p-4 rounded-xl border flex items-center gap-3"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: '#ef4444',
          }}
        >
          <X className="w-5 h-5" style={{ color: '#ef4444' }} />
          <span className="font-semibold">To'lov bekor qilindi</span>
        </div>
      )}

      <div
        className="p-4 rounded-xl border"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
          To'lov summasi
        </p>
        <p className="text-2xl font-bold mt-1">{amount.toLocaleString()} so'm</p>
      </div>

      {paycomEnvironment === 'test' && checkoutUrl && !createError && (
        <div
          className="p-3 rounded-xl text-xs border"
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            borderColor: 'rgba(245, 158, 11, 0.45)',
            color: isDark ? 'rgba(255, 255, 255, 0.9)' : '#92400e',
          }}
        >
          <strong>Test rejimi.</strong> Chek{' '}
          <code className="text-[11px] opacity-90">checkout.test.paycom.uz</code> da yaratiladi. Keyingi sahifa{' '}
          <code className="text-[11px] opacity-90">payme.uz</code> ga o‘tishi mumkin — u yerda «Чек не найден» ko‘rinsa,
          haqiqiy to‘lov uchun Supabase’da <code className="text-[10px]">PAYCOM_USE_TEST=false</code> va{' '}
          <strong>prod</strong> kalitlar. Test uchun faqat test kartalar (kabinet bo‘yicha) ishlatiladi.
        </div>
      )}

      {import.meta.env.DEV && (
        <div
          className="p-3 rounded-xl text-xs border"
          style={{
            background: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
            borderColor: isDark ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.25)',
            color: isDark ? 'rgba(255,255,255,0.88)' : '#1e3a5f',
          }}
        >
          <strong>Local test.</strong> API Vite proxy orqali (`/functions/v1/...`). Payme «чек не найден» bo‘lsa: Supabase
          Secret <code className="text-[10px]">PAYME_CHECKOUT_BACK_URL</code> yoki loyiha{' '}
          <code className="text-[10px]">.env</code> da{' '}
          <code className="text-[10px]">VITE_PAYME_RETURN_URL=https://sizning-sayt.uz/</code> (faqat https).{' '}
          <code className="text-[10px]">localhost</code> Payme da ishlamaydi.
        </div>
      )}

      {checkoutUrl && paymentStatus === 'pending' && !isCreating && !createError && (
        <button
          onClick={openPaymentWindow}
          className="w-full py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #00AACB 0%, #008BA3 100%)',
            color: '#ffffff',
          }}
        >
          <ExternalLink className="w-5 h-5" />
          <span>Payme orqali to'lash</span>
        </button>
      )}

      {paymentStatus === 'checking' && (
        <button
          onClick={handleCancelPayment}
          className="w-full py-3 rounded-2xl font-bold transition-all active:scale-95"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          }}
        >
          Bekor qilish
        </button>
      )}

      <div
        className="p-3 rounded-xl text-xs"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
          color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
        }}
      >
        ℹ️ Tugma server qaytargan <code className="text-[10px]">checkoutUrl</code> ni ochadi (avval odatda{' '}
        checkout.paycom.uz yoki checkout.test.paycom.uz). «Chek topilmadi» — odatda test/prod muhiti yoki kalitlar
        mos kelmasa chiqadi; Network → create-receipt javobida <code className="text-[10px]">paycomEnvironment</code>{' '}
        ni tekshiring.
      </div>
    </div>
  );
}
