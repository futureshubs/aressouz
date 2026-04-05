import { useState, useEffect, useRef } from 'react';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL, publicAnonKey } from '../../../utils/supabase/info';
import { openExternalUrl } from '../utils/openExternalUrl';
import { toast } from 'sonner';
import { ExternalLink, Check, X, Loader, CreditCard } from 'lucide-react';
import { PaymentMethodLogoFrame } from './payment/PaymentMethodLogoFrame';

const ATMOS_BRAND = '#007AFF';

function AtmosBrandMark({ isDark }: { isDark: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex justify-center">
      <PaymentMethodLogoFrame brandColor={ATMOS_BRAND} isDark={isDark}>
        {broken ? (
          <svg
            className="max-h-full w-auto max-w-full"
            width="100"
            height="32"
            viewBox="0 0 100 32"
            fill="none"
            aria-hidden
          >
            <rect width="100" height="32" rx="12" fill={ATMOS_BRAND} />
            <text x="50" y="21" fontSize="14" fontWeight="bold" fill="white" textAnchor="middle">
              Atmos
            </text>
          </svg>
        ) : (
          <img
            src="/payments/atmos-logo.png?v=2"
            alt="Atmos"
            className="block max-h-full w-auto max-w-full object-contain object-center"
            decoding="async"
            onError={() => setBroken(true)}
          />
        )}
      </PaymentMethodLogoFrame>
    </div>
  );
}

interface AtmosPaymentProps {
  orderId: string;
  amount: number;
  phone: string;
  customerName?: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  /** Tranzaksiya tayyor bo‘lgach Atmos oynasini avtomatik ochish */
  autoOpenCheckout?: boolean;
}

export default function AtmosPayment({ 
  orderId, 
  amount, 
  phone,
  customerName,
  onSuccess,
  onError,
  autoOpenCheckout = false,
}: AtmosPaymentProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  /** Payme bilan bir xil: to‘g‘ridan Supabase URL (CORS yoqilgan); Vite proxy 400 berishi mumkin */
  const apiBase = API_BASE_URL;

  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  onErrorRef.current = onError;
  onSuccessRef.current = onSuccess;
  
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'success' | 'failed'>('pending');
  const [paymentWindow, setPaymentWindow] = useState<Window | null>(null);
  
  const pollingInterval = useRef<number | null>(null);
  const checkCount = useRef(0);
  const paymentWindowRef = useRef<Window | null>(null);
  const atmosAutoOpenDoneRef = useRef(false);
  const openAtmosWindowRef = useRef<() => void>(() => {});

  /** Edge cold start + Atmos 2 bosqich */
  const EDGE_TIMEOUT_MS = 120000;

  useEffect(() => {
    let alive = true;
    /** Faqat timer tugaganda abort bo‘lsa — foydalanuvchiga xabar (yopilganda emas) */
    let clientTimedOut = false;
    const ctrl = new AbortController();
    const tid = window.setTimeout(() => {
      clientTimedOut = true;
      ctrl.abort();
    }, EDGE_TIMEOUT_MS);

    const run = async () => {
      setIsCreating(true);
      try {
        const response = await fetch(`${apiBase}/atmos/create-transaction`, {
          method: 'POST',
          signal: ctrl.signal,
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            apikey: publicAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            orderId,
            customerPhone: phone,
            customerName,
          }),
        });

        const text = await response.text();
        let data: Record<string, unknown> = {};
        try {
          data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
          const msg = (text && text.slice(0, 200)) || 'Server javobi JSON emas';
          if (!alive) return;
          onErrorRef.current(msg);
          return;
        }

        if (!alive) return;

        if (response.ok && data.success === true) {
          setTransactionId(String(data.transactionId ?? ''));
          setRedirectUrl(String(data.redirectUrl ?? ''));
          toast.success('Atmos tranzaksiyasi yaratildi');
        } else {
          const code = data.code != null ? ` [${String(data.code)}]` : '';
          const err = String(data.error || 'Tranzaksiya yaratishda xatolik') + code;
          console.warn('[Atmos create-transaction]', response.status, data);
          onErrorRef.current(err);
        }
      } catch (e: unknown) {
        if (!alive) return;
        const aborted = e instanceof Error && e.name === 'AbortError';
        if (aborted) {
          if (clientTimedOut) {
            const msg = `Edge funksiya javob bermadi (${EDGE_TIMEOUT_MS / 1000}s). Internet, loyiha URL yoki Supabase Functions → Logs ni tekshiring.`;
            console.error('Atmos create-transaction: client timeout');
            onErrorRef.current(msg);
          }
          return;
        }
        const msg = e instanceof Error ? e.message : 'Tarmoq xatoligi';
        console.error('Atmos create-transaction:', e);
        onErrorRef.current(msg);
      } finally {
        window.clearTimeout(tid);
        if (alive) setIsCreating(false);
      }
    };

    void run();

    return () => {
      alive = false;
      window.clearTimeout(tid);
      ctrl.abort();
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      if (paymentWindowRef.current && !paymentWindowRef.current.closed) {
        paymentWindowRef.current.close();
      }
    };
  }, [apiBase, amount, orderId, phone, customerName]);

  useEffect(() => {
    atmosAutoOpenDoneRef.current = false;
  }, [orderId]);

  const openPaymentWindow = () => {
    if (!redirectUrl) return;
    void openExternalUrl(redirectUrl);
    setPaymentWindow(null);
    paymentWindowRef.current = null;
    startPolling();
  };

  openAtmosWindowRef.current = openPaymentWindow;

  useEffect(() => {
    if (!autoOpenCheckout || atmosAutoOpenDoneRef.current) return;
    if (!redirectUrl || isCreating || paymentStatus !== 'pending') return;
    atmosAutoOpenDoneRef.current = true;
    const t = window.setTimeout(() => openAtmosWindowRef.current(), 450);
    return () => clearTimeout(t);
  }, [autoOpenCheckout, redirectUrl, isCreating, paymentStatus]);

  const checkPaymentStatus = async () => {
    if (!transactionId || isChecking) return;
    
    setIsChecking(true);
    checkCount.current += 1;
    
    console.log(`💳 Checking Atmos payment status (attempt ${checkCount.current})`);
    
    try {
      const response = await fetch(`${apiBase}/atmos/check-transaction`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionId }),
      });

      const text = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        return;
      }

      if (response.ok && data.success) {
        console.log('💳 Transaction status:', data.status);
        
        if (data.isPaid) {
          // Payment completed (COMPLETED)
          setPaymentStatus('success');
          stopPolling();
          
          if (paymentWindowRef.current && !paymentWindowRef.current.closed) {
            paymentWindowRef.current.close();
          }
          
          toast.success('To\'lov muvaffaqiyatli amalga oshirildi! ✅');
          onSuccessRef.current();
        } else if (data.isRejected) {
          // Payment rejected or cancelled
          setPaymentStatus('failed');
          stopPolling();
          
          toast.error('To\'lov rad etildi yoki bekor qilindi');
          onErrorRef.current('To\'lov rad etildi');
        } else if (data.isApproved) {
          // Payment approved (waiting for completion)
          setPaymentStatus('checking');
          toast.info('To\'lov tasdiqlandi, yakunlanishi kutilmoqda...');
        } else {
          // Still pending
          setPaymentStatus('checking');
        }
      }
    } catch (error: any) {
      console.error('Check payment error:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const checkPaymentStatusRef = useRef(checkPaymentStatus);
  checkPaymentStatusRef.current = checkPaymentStatus;
  useVisibilityRefetch(() => {
    void checkPaymentStatusRef.current();
  });

  const startPolling = () => {
    // Check immediately
    checkPaymentStatus();
    
    // Then check every 5 seconds
    pollingInterval.current = window.setInterval(() => {
      checkPaymentStatus();
      
      // Stop after 10 minutes (120 attempts)
      if (checkCount.current >= 120) {
        stopPolling();
        toast.warning('To\'lov tekshirish vaqti tugadi');
        onErrorRef.current('Vaqt tugadi');
      }
    }, 5000);
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const handleCancelPayment = () => {
    stopPolling();
    
    if (paymentWindowRef.current && !paymentWindowRef.current.closed) {
      paymentWindowRef.current.close();
    }
    
    toast.info('To\'lov bekor qilindi');
    onErrorRef.current('Foydalanuvchi bekor qildi');
  };

  return (
    <div className="space-y-4">
      {/* Atmos Logo & Info */}
      <div className="text-center">
        <AtmosBrandMark isDark={isDark} />
        <p className="text-sm mt-2 font-semibold" style={{ color: '#007AFF' }}>
          Xavfsiz bank kartasi to'lovi
        </p>
        <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
          Uzcard va Humo kartalari bilan to'lang
        </p>
      </div>

      {/* Status */}
      {isCreating && (
        <div
          className="p-4 rounded-xl border flex items-center gap-3"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <Loader className="w-5 h-5 animate-spin" style={{ color: '#007AFF' }} />
          <span>Tranzaksiya yaratilmoqda...</span>
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

      {/* Amount */}
      <div
        className="p-4 rounded-xl border"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
          To'lov miqdori
        </p>
        <p className="text-2xl font-bold mt-1">{amount.toLocaleString()} so'm</p>
      </div>

      {/* Payment Info */}
      <div
        style={{
          padding: '20px',
          borderRadius: '16px',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
        }}
      >
        <h3 className="font-semibold mb-3">
          Atmos orqali to'lash
        </h3>
        
        <div className="space-y-2 text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
          <p className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span>Bank kartangiz bilan xavfsiz to'lang</span>
          </p>
          <p className="flex items-center gap-2">
            <Check className="w-4 h-4" style={{ color: accentColor }} />
            <span>Uzcard, Humo kartalari qo'llab-quvvatlanadi</span>
          </p>
          <p className="flex items-center gap-2">
            <Check className="w-4 h-4" style={{ color: accentColor }} />
            <span>To'lov ma'lumotlari shifrlangan</span>
          </p>
        </div>
      </div>

      {/* Payment Button */}
      {redirectUrl && paymentStatus === 'pending' && !isCreating && (
        <button
          onClick={openPaymentWindow}
          className="w-full py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #007AFF 0%, #0051D5 100%)',
            color: '#ffffff',
          }}
        >
          <ExternalLink className="w-5 h-5" />
          <span>Atmos orqali to'lash</span>
        </button>
      )}

      {/* Cancel Button */}
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

      {/* Info Banner */}
      <div
        style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: isDark ? 'rgba(0, 122, 255, 0.1)' : 'rgba(0, 122, 255, 0.05)',
          border: `1px solid ${isDark ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.1)'}`,
        }}
      >
        <p>ℹ️ Atmos.uz - bu O'zbekistonda xavfsiz bank kartasi to'lovlari uchun platforma.</p>
        <p>✅ Uzcard va Humo kartalari qabul qilinadi.</p>
        <p>🔒 Xavfsiz va qulay to'lov tizimi.</p>
      </div>
    </div>
  );
}