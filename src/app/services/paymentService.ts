// ARESSO Payment Service
import { API_BASE_URL, publicAnonKey } from '/utils/supabase/info';
import { openExternalUrl } from '../utils/openExternalUrl';

const API_URL = API_BASE_URL;

export interface PaymentCreateParams {
  amount: number; // in so'm
  orderId: string;
  description?: string;
  returnUrl?: string;
  userId?: string;
  userPhone?: string;
  /** Auksion va boshqalar: payme | click | card | atmos — checkoutga uzatiladi */
  paymentMethod?: string;
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

export type PollUntilPaidResult =
  | { paid: true }
  | { paid: false; reason: 'timeout' | 'cancelled' | 'failed'; error?: string };

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * To‘lov `paid` bo‘lguncha (yoki vaqt tugaguncha) statusni qayta-qayta tekshiradi.
 * Payme/Click oynasi ochilganda foydalanuvchi tashqarida to‘laganidan keyin ham ishlaydi.
 */
export async function pollUntilPaymentPaid(
  paymentId: string,
  options?: {
    intervalMs?: number;
    maxMs?: number;
    signal?: AbortSignal;
  },
): Promise<PollUntilPaidResult> {
  const intervalMs = Math.max(400, options?.intervalMs ?? 2500);
  const maxMs = options?.maxMs ?? 20 * 60 * 1000;
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    if (options?.signal?.aborted) {
      return { paid: false, reason: 'cancelled', error: 'Bekor qilindi' };
    }

    const st = await checkPaymentStatus(paymentId);

    if (st.success && st.status === 'paid') {
      return { paid: true };
    }
    if (st.status === 'failed') {
      return { paid: false, reason: 'failed', error: st.error };
    }
    if (st.status === 'cancelled') {
      return { paid: false, reason: 'cancelled', error: st.error };
    }

    await sleep(intervalMs);
  }

  return { paid: false, reason: 'timeout', error: 'To‘lov ma’lum vaqt ichida tasdiqlanmadi' };
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
      body: JSON.stringify({
        amount: params.amount,
        orderId: params.orderId,
        description: params.description,
        returnUrl: params.returnUrl,
        userId: params.userId,
        userPhone: params.userPhone,
        ...(params.paymentMethod ? { paymentMethod: params.paymentMethod } : {}),
      }),
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

/**
 * To‘lov sahifasini ilova ichidagi popup o‘rniga tizim brauzerida ochamiz (PWA / WebView).
 * Oyna `Window` qaytarmaymiz — status tekshiruvi fon rejimida davom etadi.
 */
export function openPaymentWindow(paymentUrl: string): Window | null {
  void openExternalUrl(paymentUrl);
  return null;
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
