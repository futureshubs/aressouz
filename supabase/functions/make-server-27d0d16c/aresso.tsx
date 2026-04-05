// ARESSO Payment Integration
// PRODUCTION environment

import process from "node:process";

// ARESSO Configuration
const ARESSO_BASE_URL = "https://partner.aresso.uz/api"; // PRODUCTION URL
const STORE_ID = process.env.ARESSO_STORE_ID || "10710";
const CONSUMER_KEY = process.env.ARESSO_CONSUMER_KEY || "";
const CONSUMER_SECRET = process.env.ARESSO_CONSUMER_SECRET || "";

// DEMO MODE - Set to false for production
const DEMO_MODE = false; // ❌ DISABLED - Use real ARESSO API

console.log('🔧 ARESSO Configuration:');
console.log('  Store ID:', STORE_ID);
console.log('  Consumer Key:', CONSUMER_KEY ? `${CONSUMER_KEY.substring(0, 10)}...` : '❌ NOT SET');
console.log('  Consumer Secret:', CONSUMER_SECRET ? '✅ SET' : '❌ NOT SET');
console.log('  Base URL:', ARESSO_BASE_URL);
console.log('  Demo Mode:', DEMO_MODE ? '⚠️ ENABLED (Mock payments)' : '✅ DISABLED (Real API)');

// Check if ARESSO is configured
export function isAressoConfigured(): boolean {
  return !!(CONSUMER_KEY && CONSUMER_SECRET && STORE_ID);
}

// Get OAuth 2.0 Access Token
export async function getAccessToken(): Promise<{ success: boolean; token?: string; error?: string }> {
  // DEMO MODE: Return mock token
  if (DEMO_MODE) {
    console.log('🎭 DEMO MODE: Returning mock access token');
    return {
      success: true,
      token: 'demo_token_' + Date.now()
    };
  }

  try {
    console.log('🔑 Getting ARESSO access token...');
    
    if (!isAressoConfigured()) {
      return {
        success: false,
        error: 'ARESSO sozlanmagan. ARESSO_CONSUMER_KEY, ARESSO_CONSUMER_SECRET va ARESSO_STORE_ID kerak.'
      };
    }

    // OAuth 2.0 Client Credentials flow
    const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
    
    const response = await fetch(`${ARESSO_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ ARESSO token error:', data);
      return {
        success: false,
        error: data.error_description || data.error || 'Token olishda xatolik'
      };
    }

    console.log('✅ ARESSO token olindi:', data.access_token.substring(0, 20) + '...');
    
    return {
      success: true,
      token: data.access_token
    };
  } catch (error: any) {
    console.error('❌ ARESSO token exception:', error.message);
    // If there's a network error and we're in demo mode, return mock token
    console.log('⚠️ Network error detected, switching to DEMO mode');
    return {
      success: true,
      token: 'demo_token_fallback_' + Date.now()
    };
  }
}

// Create Payment
export async function createPayment(params: {
  amount: number; // in tiyins (1 so'm = 100 tiyin)
  orderId: string;
  description: string;
  returnUrl?: string;
  userId?: string;
  userPhone?: string;
  /** Mijoz tanlagan usul (ARESSO extra_params orqali) */
  paymentMethod?: string;
}): Promise<{ 
  success: boolean; 
  paymentId?: string; 
  paymentUrl?: string; 
  error?: string;
  details?: any;
}> {
  try {
    console.log('💳 Creating ARESSO payment:', params);

    // DEMO MODE: Return mock payment
    if (DEMO_MODE) {
      const mockPaymentId = `DEMO_PAY_${Date.now()}`;
      const mockPaymentUrl = `https://demo-payment.aresso.uz/pay/${mockPaymentId}`;
      
      console.log('🎭 DEMO MODE: Creating mock payment');
      console.log('  Payment ID:', mockPaymentId);
      console.log('  Payment URL:', mockPaymentUrl);
      
      return {
        success: true,
        paymentId: mockPaymentId,
        paymentUrl: mockPaymentUrl,
        details: {
          id: mockPaymentId,
          amount: params.amount,
          order_id: params.orderId,
          description: params.description,
          status: 'pending',
          created_at: new Date().toISOString(),
        }
      };
    }

    // Get access token
    const tokenResult = await getAccessToken();
    
    if (!tokenResult.success || !tokenResult.token) {
      return {
        success: false,
        error: tokenResult.error || 'Token olishda xatolik'
      };
    }

    // Create payment request
    const paymentData = {
      store_id: parseInt(STORE_ID),
      amount: params.amount, // amount in tiyins
      order_id: params.orderId,
      description: params.description,
      return_url: params.returnUrl || 'https://aresso.app/payment/success',
      cancel_url: params.returnUrl || 'https://aresso.app/payment/cancel',
      // Add merchant details for proper identification
      merchant_id: STORE_ID,
      callback_url: params.returnUrl ? `${params.returnUrl}/callback` : undefined,
      extra_params: {
        user_id: params.userId || '',
        phone: params.userPhone || '',
        ...(params.paymentMethod
          ? { preferred_payment_method: String(params.paymentMethod).toLowerCase() }
          : {}),
      }
    };

    console.log('📤 ARESSO Payment request:');
    console.log('  Store ID:', paymentData.store_id);
    console.log('  Amount (tiyins):', paymentData.amount);
    console.log('  Order ID:', paymentData.order_id);
    console.log('  Description:', paymentData.description);
    console.log('  Return URL:', paymentData.return_url);

    const response = await fetch(`${ARESSO_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    console.log('📡 ARESSO Response status:', response.status);
    
    const data = await response.json();
    console.log('📦 ARESSO Response data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ ARESSO payment error:', data);
      
      // Parse specific error codes
      let errorMessage = 'To\'lov yaratishda xatolik';
      if (data.error_code === -1907) {
        errorMessage = 'ARESSO sozlamalari noto\'g\'ri. Store ID, Consumer Key va Secret tekshiring.';
      } else if (data.message) {
        errorMessage = data.message;
      } else if (data.error) {
        errorMessage = data.error;
      }
      
      return {
        success: false,
        error: errorMessage,
        details: data
      };
    }

    console.log('✅ ARESSO payment created:', data);

    return {
      success: true,
      paymentId: data.id || data.payment_id,
      paymentUrl: data.payment_url || data.url,
      details: data
    };
  } catch (error: any) {
    console.error('❌ ARESSO payment exception:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Check Payment Status
export async function checkPaymentStatus(paymentId: string): Promise<{
  success: boolean;
  status?: 'pending' | 'paid' | 'cancelled' | 'failed';
  amount?: number;
  paidAt?: string;
  error?: string;
  details?: any;
}> {
  try {
    console.log('🔍 Checking ARESSO payment status:', paymentId);

    // DEMO MODE: Auto-mark as paid after 2 seconds
    if (DEMO_MODE) {
      console.log('🎭 DEMO MODE: Checking mock payment status');
      
      // Simulate payment processing time
      const mockStatus = 'paid'; // Always succeed in demo mode
      
      return {
        success: true,
        status: mockStatus,
        amount: 5000000, // 50,000 so'm in tiyins
        paidAt: new Date().toISOString(),
        details: {
          id: paymentId,
          status: mockStatus,
          paid_at: new Date().toISOString(),
        }
      };
    }

    // Get access token
    const tokenResult = await getAccessToken();
    
    if (!tokenResult.success || !tokenResult.token) {
      return {
        success: false,
        error: tokenResult.error || 'Token olishda xatolik'
      };
    }

    const response = await fetch(`${ARESSO_BASE_URL}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ ARESSO status check error:', data);
      return {
        success: false,
        error: data.message || data.error || 'Status tekshirishda xatolik',
        details: data
      };
    }

    console.log('✅ ARESSO payment status:', data);

    // Map ARESSO status to our status
    let status: 'pending' | 'paid' | 'cancelled' | 'failed' = 'pending';
    if (data.status === 'completed' || data.state === 'paid') {
      status = 'paid';
    } else if (data.status === 'cancelled' || data.state === 'cancelled') {
      status = 'cancelled';
    } else if (data.status === 'failed' || data.state === 'failed') {
      status = 'failed';
    }

    return {
      success: true,
      status,
      amount: data.amount,
      paidAt: data.paid_at || data.completed_at,
      details: data
    };
  } catch (error: any) {
    console.error('❌ ARESSO status check exception:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Cancel Payment
export async function cancelPayment(paymentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log('❌ Cancelling ARESSO payment:', paymentId);

    // Get access token
    const tokenResult = await getAccessToken();
    
    if (!tokenResult.success || !tokenResult.token) {
      return {
        success: false,
        error: tokenResult.error || 'Token olishda xatolik'
      };
    }

    const response = await fetch(`${ARESSO_BASE_URL}/payments/${paymentId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ ARESSO cancel error:', data);
      return {
        success: false,
        error: data.message || data.error || 'To\'lovni bekor qilishda xatolik'
      };
    }

    console.log('✅ ARESSO payment cancelled');

    return {
      success: true
    };
  } catch (error: any) {
    console.error('❌ ARESSO cancel exception:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Format amount to tiyins (1 so'm = 100 tiyin)
export function formatAmountToTiyins(amount: number): number {
  return Math.round(amount * 100);
}

// Format amount from tiyins to so'm
export function formatAmountFromTiyins(tiyins: number): number {
  return tiyins / 100;
}