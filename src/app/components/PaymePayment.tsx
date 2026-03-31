import { useState, useEffect, useRef } from 'react';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { ExternalLink, Check, X, Loader } from 'lucide-react';

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
  onError 
}: PaymePaymentProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'success' | 'failed'>('pending');
  const [paymentWindow, setPaymentWindow] = useState<Window | null>(null);
  
  const pollingInterval = useRef<number | null>(null);
  const checkCount = useRef(0);

  // Create receipt when component mounts
  useEffect(() => {
    createReceipt();
    
    return () => {
      // Cleanup: stop polling and close window
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      if (paymentWindow && !paymentWindow.closed) {
        paymentWindow.close();
      }
    };
  }, []);

  const createReceipt = async () => {
    setIsCreating(true);
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/payme/create-receipt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            orderId,
            items,
            phone,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setReceiptId(data.receiptId);
        setCheckoutUrl(data.checkoutUrl);
        toast.success('Payme cheki yaratildi');
      } else {
        toast.error(data.error || 'Chek yaratishda xatolik');
        onError(data.error || 'Chek yaratishda xatolik');
      }
    } catch (error: any) {
      console.error('Create receipt error:', error);
      toast.error('Tarmoq xatoligi');
      onError('Tarmoq xatoligi');
    } finally {
      setIsCreating(false);
    }
  };

  const openPaymentWindow = () => {
    if (!checkoutUrl) return;

    // Open payment in new window
    const width = 600;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    const newWindow = window.open(
      checkoutUrl,
      'PaymePayment',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no`
    );
    
    setPaymentWindow(newWindow);
    
    // Start polling
    startPolling();
  };

  const checkPaymentStatus = async () => {
    if (!receiptId || isChecking) return;
    
    setIsChecking(true);
    checkCount.current += 1;
    
    console.log(`💳 Checking payment status (attempt ${checkCount.current})`);
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/payme/check-receipt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ receiptId }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('💳 Receipt state:', data.state);
        
        if (data.isPaid) {
          // Payment successful (state = 4)
          setPaymentStatus('success');
          stopPolling();
          
          if (paymentWindow && !paymentWindow.closed) {
            paymentWindow.close();
          }
          
          toast.success('To\'lov muvaffaqiyatli amalga oshirildi! ✅');
          onSuccess();
        } else if (data.isCancelled) {
          // Payment cancelled (state = 50 or 51)
          setPaymentStatus('failed');
          stopPolling();
          
          toast.error('To\'lov bekor qilindi');
          onError('To\'lov bekor qilindi');
        } else {
          // Still processing
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
    
    // Then check every 3 seconds
    pollingInterval.current = window.setInterval(() => {
      checkPaymentStatus();
      
      // Stop after 5 minutes (100 attempts)
      if (checkCount.current >= 100) {
        stopPolling();
        toast.warning('To\'lov tekshirish vaqti tugadi');
        onError('Vaqt tugadi');
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const handleCancelPayment = () => {
    stopPolling();
    
    if (paymentWindow && !paymentWindow.closed) {
      paymentWindow.close();
    }
    
    toast.info('To\'lov bekor qilindi');
    onError('Foydalanuvchi bekor qildi');
  };

  return (
    <div className="space-y-4">
      {/* Payme Logo */}
      <div className="text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{
            background: isDark ? 'rgba(0, 170, 203, 0.1)' : 'rgba(0, 170, 203, 0.05)',
          }}
        >
          <svg width="80" height="24" viewBox="0 0 80 24" fill="none">
            <path d="M8.5 4.5C8.5 2.29086 10.2909 0.5 12.5 0.5H67.5C69.7091 0.5 71.5 2.29086 71.5 4.5V19.5C71.5 21.7091 69.7091 23.5 67.5 23.5H12.5C10.2909 23.5 8.5 21.7091 8.5 19.5V4.5Z" fill="#00AACB"/>
            <text x="40" y="16" fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">
              Payme
            </text>
          </svg>
        </div>
        <p className="text-sm mt-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
          Powered by Payme
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
          <Loader className="w-5 h-5 animate-spin" style={{ color: '#00AACB' }} />
          <span>Chek yaratilmoqda...</span>
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
          To'lov summasi
        </p>
        <p className="text-2xl font-bold mt-1">{amount.toLocaleString()} so'm</p>
      </div>

      {/* Payment Button */}
      {checkoutUrl && paymentStatus === 'pending' && !isCreating && (
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

      {/* Info */}
      <div
        className="p-3 rounded-xl text-xs"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
          color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
        }}
      >
        ℹ️ Yangi oynada Payme to'lov sahifasi ochiladi. To'lovni amalga oshirgandan so'ng, avtomatik tekshiriladi.
      </div>
    </div>
  );
}
