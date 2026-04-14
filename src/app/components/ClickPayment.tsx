import { useState, useRef, useEffect } from 'react';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { CreditCard, Loader2, Check, ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { openExternalUrl } from '../utils/openExternalUrl';
import { PaymentMethodLogoFrame } from './payment/PaymentMethodLogoFrame';

const CLICK_BRAND = '#00a650';

function ClickBrandMark({ isDark }: { isDark: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex justify-center">
      <PaymentMethodLogoFrame brandColor={CLICK_BRAND} isDark={isDark}>
        {broken ? (
          <svg width="92" height="30" viewBox="0 0 92 30" fill="none" aria-hidden>
            <rect width="92" height="30" rx="12" fill={CLICK_BRAND} />
            <text x="46" y="20" fontSize="13" fontWeight="bold" fill="white" textAnchor="middle">
              CLICK
            </text>
          </svg>
        ) : (
          <img
            src="/payments/click-logo.png?v=2"
            alt="Click"
            className="block max-h-full w-auto max-w-full object-contain object-center"
            decoding="async"
            onError={() => setBroken(true)}
          />
        )}
      </PaymentMethodLogoFrame>
    </div>
  );
}

interface ClickPaymentProps {
  orderId: string;
  amount: number;
  phone?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  type?: 'click' | 'click_card'; // click = CLICK button, click_card = any card
  /** Tasdiqlashdan keyin avtomatik hisob-faktura yaratish va to‘lov oynasini ochish */
  autoStart?: boolean;
}

export default function ClickPayment({ 
  orderId, 
  amount, 
  phone, 
  onSuccess, 
  onError,
  type = 'click',
  autoStart = false,
}: ClickPaymentProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const handlePaymentRef = useRef<() => Promise<void>>(async () => {});
  const autoStartDoneRef = useRef(false);

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      // Create invoice based on type
      const endpoint = type === 'click_card' 
        ? '/click/create-card-invoice' 
        : '/click/create-invoice';

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId,
            amount,
            phone,
            description: `Buyurtma #${orderId}`,
            returnUrl: window.location.origin,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'To\'lovni yaratishda xatolik');
      }

      const data = await response.json();
      
      if (data.success && data.paymentUrl) {
        setPaymentUrl(data.paymentUrl);
        
        void openExternalUrl(data.paymentUrl);
        
        toast.success('To\'lov sahifasi ochildi', {
          description: 'Yangi oynada to\'lovni amalga oshiring',
          duration: 5000,
        });

        // Start checking payment status
        startStatusCheck(orderId);
      } else {
        throw new Error('To\'lov havolasi olinmadi');
      }
    } catch (error: any) {
      console.error('CLICK payment error:', error);
      toast.error('Xatolik', {
        description: error.message || 'To\'lovni yaratishda xatolik',
      });
      onError?.(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  handlePaymentRef.current = handlePayment;

  useEffect(() => {
    if (!autoStart || autoStartDoneRef.current) return;
    autoStartDoneRef.current = true;
    const t = window.setTimeout(() => void handlePaymentRef.current(), 320);
    return () => clearTimeout(t);
  }, [autoStart]);

  const startStatusCheck = (orderId: string) => {
    setIsCheckingStatus(true);
    
    // Check every 5 seconds for payment completion
    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/click/status/${orderId}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'paid') {
            clearInterval(interval);
            setIsCheckingStatus(false);
            
            toast.success('To\'lov muvaffaqiyatli!', {
              description: 'Buyurtmangiz tasdiqlandi',
              duration: 5000,
            });
            
            onSuccess?.();
          }
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    }, 5000);

    // Stop checking after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
      setIsCheckingStatus(false);
    }, 10 * 60 * 1000);
  };

  const checkStatus = async () => {
    if (!orderId) {
      toast.error('Buyurtma ID topilmadi');
      return;
    }

    setIsCheckingStatus(true);
    
    try {
      console.log('🔍 Checking CLICK payment status for:', orderId);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/click/status/${orderId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      console.log('📡 Status check response:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        console.error('❌ Status check failed:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Payment status:', data);
      
      if (data.success) {
        if (data.status === 'paid') {
          toast.success('To\'lov muvaffaqiyatli!');
          onSuccess?.();
        } else if (data.status === 'pending' || data.status === 'prepared') {
          toast.info('To\'lov kutilmoqda', {
            description: 'To\'lovni amalga oshiring',
          });
        } else {
          toast.warning('To\'lov holati: ' + data.status);
        }
      } else {
        toast.warning(data.error || 'To\'lov holati noma\'lum');
      }
    } catch (error: any) {
      console.error('❌ Status check error:', error);
      toast.error('Holatni tekshirishda xatolik', {
        description: error.message || 'Tarmoq xatoligi'
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const checkStatusRef = useRef(checkStatus);
  checkStatusRef.current = checkStatus;
  useVisibilityRefetch(() => {
    void checkStatusRef.current();
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <ClickBrandMark isDark={isDark} />
        <p
          className="text-xs sm:text-sm"
          style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}
        >
          {type === 'click_card' ? 'Bank kartasi — Click orqali' : 'Click — tezkor to‘lov'}
        </p>
      </div>
      {/* Payment Button */}
      {!paymentUrl ? (
        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full py-4 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            background: isProcessing ? '#64748b' : '#00a650',
            color: '#ffffff',
            boxShadow: '0 10px 30px rgba(0, 166, 80, 0.3)',
          }}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Yuklanmoqda...</span>
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              <span>
                {type === 'click_card' ? 'Kartadan to\'lash' : 'CLICK orqali to\'lash'}
              </span>
            </>
          )}
        </button>
      ) : (
        <div 
          className="p-6 rounded-2xl border space-y-4"
          style={{
            background: isDark ? 'rgba(0, 166, 80, 0.1)' : 'rgba(0, 166, 80, 0.05)',
            borderColor: '#00a650',
          }}
        >
          {/* Success Message */}
          <div className="flex items-center gap-3">
            <div 
              className="p-3 rounded-full"
              style={{ background: '#00a650' }}
            >
              <Check className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">To'lov sahifasi ochildi</h3>
              <p className="text-sm opacity-70">
                Yangi oynada to'lovni amalga oshiring
              </p>
            </div>
          </div>

          {/* Payment Link */}
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold transition-all active:scale-95"
            style={{
              background: '#00a650',
              color: '#ffffff',
            }}
          >
            <ExternalLink className="w-5 h-5" />
            <span>To'lov sahifasini ochish</span>
          </a>

          {/* Status Check */}
          <button
            onClick={checkStatus}
            className="w-full py-3 rounded-xl font-semibold transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            {isCheckingStatus ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Tekshirilmoqda...</span>
              </div>
            ) : (
              'Holatni tekshirish'
            )}
          </button>

          {/* Info */}
          <p className="text-xs text-center opacity-60">
            To'lovdan keyin avtomatik tekshiruv boshlanadi
          </p>
        </div>
      )}
    </div>
  );
}