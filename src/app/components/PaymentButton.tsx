import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { createPayment, openPaymentWindow } from '../services/paymentService';

interface PaymentButtonProps {
  amount: number; // in so'm
  orderId?: string;
  description?: string;
  userId?: string;
  userPhone?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export default function PaymentButton({
  amount,
  orderId,
  description,
  userId,
  userPhone,
  onSuccess,
  onError,
  className = '',
  children,
  disabled = false,
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);

    try {
      // Generate order ID if not provided
      const finalOrderId = orderId || `order_${Date.now()}`;

      console.log('💳 Initiating payment:', {
        amount,
        orderId: finalOrderId,
      });

      // Create payment
      const result = await createPayment({
        amount,
        orderId: finalOrderId,
        description: description || `Buyurtma #${finalOrderId}`,
        returnUrl: `${window.location.origin}/payment?paymentId={paymentId}&orderId=${finalOrderId}`,
        userId,
        userPhone,
      });

      if (!result.success || !result.paymentUrl) {
        throw new Error(result.error || 'To\'lov yaratishda xatolik');
      }

      console.log('✅ Payment created, opening window:', result.paymentUrl);

      // Check if this is a demo payment
      const isDemoPayment = result.paymentUrl?.includes('demo-payment');
      
      if (isDemoPayment) {
        // DEMO MODE: Simulate payment by directly going to success page
        console.log('🎭 DEMO MODE: Simulating instant payment success');
        setIsLoading(false);
        
        // Short delay to show loading state
        setTimeout(() => {
          window.location.href = `/payment?paymentId=${result.paymentId}&orderId=${finalOrderId}`;
        }, 1500);
        
        return;
      }

      // Open payment window for real payments
      const paymentWindow = openPaymentWindow(result.paymentUrl);

      if (!paymentWindow) {
        throw new Error('Pop-up bloklangan. Iltimos, brauzer sozlamalarini tekshiring.');
      }

      // Monitor payment window
      const checkWindow = setInterval(() => {
        if (paymentWindow.closed) {
          clearInterval(checkWindow);
          setIsLoading(false);
          
          // Redirect to payment status page
          window.location.href = `/payment?paymentId=${result.paymentId}&orderId=${finalOrderId}`;
          
          onSuccess?.();
        }
      }, 1000);

    } catch (error: any) {
      console.error('❌ Payment error:', error);
      setIsLoading(false);
      onError?.(error.message || 'To\'lov yaratishda xatolik');
      
      alert(error.message || 'To\'lov yaratishda xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={isLoading || disabled}
      className={`
        flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold
        transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed
        disabled:hover:scale-100
        ${className || 'bg-[#14b8a6] hover:bg-[#0d9488] text-white'}
      `}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>To'lov ochilmoqda...</span>
        </>
      ) : (
        <>
          <CreditCard className="w-5 h-5" />
          <span>{children || 'To\'lov qilish'}</span>
        </>
      )}
    </button>
  );
}