// ARESSO Payment Service
import { API_BASE_URL, publicAnonKey } from '/utils/supabase/info';

const API_URL = API_BASE_URL;

export interface PaymentCreateParams {
  amount: number; // in so'm
  orderId: string;
  description?: string;
  returnUrl?: string;
  userId?: string;
  userPhone?: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentId?: string;
  paymentUrl?: string;
  amount?: number;
  message?: string;
  error?: string;
}

export interface PaymentStatus {
  success: boolean;
  paymentId?: string;
  status?: 'pending' | 'paid' | 'cancelled' | 'failed';
  amount?: number;
  paidAt?: string;
  orderId?: string;
  error?: string;
}

// Create payment
export async function createPayment(params: PaymentCreateParams): Promise<PaymentResponse> {
  try {
    console.log('💳 Creating payment:', params);

    const response = await fetch(`${API_BASE_URL}/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Payment creation failed:', data);
      return {
        success: false,
        error: data.error || 'To\'lov yaratishda xatolik',
      };
    }

    console.log('✅ Payment created:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Payment creation exception:', error);
    return {
      success: false,
      error: error.message || 'To\'lov yaratishda xatolik',
    };
  }
}

// Check payment status
export async function checkPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  try {
    console.log('🔍 Checking payment status:', paymentId);

    const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Status check failed:', data);
      return {
        success: false,
        error: data.error || 'Status tekshirishda xatolik',
      };
    }

    console.log('✅ Payment status:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Status check exception:', error);
    return {
      success: false,
      error: error.message || 'Status tekshirishda xatolik',
    };
  }
}

// Get payment by order ID
export async function getPaymentByOrderId(orderId: string): Promise<any> {
  try {
    console.log('🔍 Getting payment for order:', orderId);

    const response = await fetch(`${API_BASE_URL}/payments/order/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Get payment failed:', data);
      return {
        success: false,
        error: data.error || 'To\'lov olishda xatolik',
      };
    }

    console.log('✅ Payment found:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Get payment exception:', error);
    return {
      success: false,
      error: error.message || 'To\'lov olishda xatolik',
    };
  }
}

// Cancel payment
export async function cancelPayment(paymentId: string): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    console.log('❌ Cancelling payment:', paymentId);

    const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Cancel payment failed:', data);
      return {
        success: false,
        error: data.error || 'To\'lovni bekor qilishda xatolik',
      };
    }

    console.log('✅ Payment cancelled:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Cancel payment exception:', error);
    return {
      success: false,
      error: error.message || 'To\'lovni bekor qilishda xatolik',
    };
  }
}

// Open payment in new window
export function openPaymentWindow(paymentUrl: string): Window | null {
  const width = 600;
  const height = 700;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;

  return window.open(
    paymentUrl,
    'AressoPayment',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

// Format amount for display
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
}

// Format amount with decimals
export function formatAmountDetailed(amount: number): string {
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' so\'m';
}
