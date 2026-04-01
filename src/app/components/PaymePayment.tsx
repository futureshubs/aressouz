import { useState, useEffect, useRef, useCallback } from 'react';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL, DEV_API_BASE_URL, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { ExternalLink, Check, X, Loader } from 'lucide-react';

const edgePaymeBase = import.meta.env.DEV ? DEV_API_BASE_URL : API_BASE_URL;

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
}

export default function PaymePayment({
  orderId,
  amount,
  phone,
  items,
  onSuccess,
  onError,
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

    const width = 600;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    const features = `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no`;
    // Noyob target: bir xil nomdagi eski payme.uz oynasiga opener orqali location berish xavfsizlik xatosini beradi.
    const target = `PaymePayment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newWindow = window.open('about:blank', target, features);
    if (!newWindow) {
      toast.error('Pop-up bloklangan — brauzerda ruxsat bering');
      return;
    }
    try {
      newWindow.opener = null;
    } catch {
      /* noop */
    }
    const jsUrl = JSON.stringify(checkoutUrl);
    try {
      const d = newWindow.document;
      d.open();
      d.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"></head><body><script>location.replace(${jsUrl});<\/script></body></html>`,
      );
      d.close();
    } catch {
      try {
        newWindow.location.replace(checkoutUrl);
      } catch {
        newWindow.location.href = checkoutUrl;
      }
    }

    setPaymentWindow(newWindow);
    startPolling();
  };

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
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{
            background: isDark ? 'rgba(0, 170, 203, 0.1)' : 'rgba(0, 170, 203, 0.05)',
          }}
        >
          <svg width="80" height="24" viewBox="0 0 80 24" fill="none">
            <path
              d="M8.5 4.5C8.5 2.29086 10.2909 0.5 12.5 0.5H67.5C69.7091 0.5 71.5 2.29086 71.5 4.5V19.5C71.5 21.7091 69.7091 23.5 67.5 23.5H12.5C10.2909 23.5 8.5 21.7091 8.5 19.5V4.5Z"
              fill="#00AACB"
            />
            <text x="40" y="16" fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">
              Payme
            </text>
          </svg>
        </div>
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
          <Loader className="w-5 h-5 animate-spin" style={{ color: '#00AACB' }} />
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
          <Loader className="w-5 h-5 animate-spin" style={{ color: '#3b82f6' }} />
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
