/**
 * Eskiz.uz SMS Integration
 * https://notify.eskiz.uz/api/documentation
 */

const ESKIZ_EMAIL = Deno.env.get('ESKIZ_EMAIL');
const ESKIZ_PASSWORD = Deno.env.get('ESKIZ_PASSWORD');
const ESKIZ_API_URL = 'https://notify.eskiz.uz/api';

let authToken: string | null = null;
let tokenExpiry: number = 0;

interface EskizAuthResponse {
  message: string;
  data: {
    token: string;
  };
}

interface EskizSMSResponse {
  message: string;
  status: string;
  id?: string;
}

/**
 * Get auth token (cached)
 */
async function getAuthToken(): Promise<string> {
  // Return cached token if still valid
  if (authToken && Date.now() < tokenExpiry) {
    return authToken;
  }

  if (!ESKIZ_EMAIL || !ESKIZ_PASSWORD) {
    throw new Error('Eskiz.uz credentials sozlanmagan. ESKIZ_EMAIL va ESKIZ_PASSWORD kerak.');
  }

  try {
    const formData = new FormData();
    formData.append('email', ESKIZ_EMAIL);
    formData.append('password', ESKIZ_PASSWORD);

    const response = await fetch(`${ESKIZ_API_URL}/auth/login`, {
      method: 'POST',
      body: formData,
    });

    const data: EskizAuthResponse = await response.json();

    if (!response.ok || !data.data?.token) {
      console.error('Eskiz auth error:', data);
      throw new Error('Eskiz.uz autentifikatsiyasida xatolik');
    }

    authToken = data.data.token;
    // Token 29 kun amal qiladi, lekin 25 kun keyin yangilaymiz
    tokenExpiry = Date.now() + (25 * 24 * 60 * 60 * 1000);

    return authToken;
  } catch (error: any) {
    console.error('Eskiz auth exception:', error);
    throw new Error(`Eskiz.uz ga ulanishda xatolik: ${error.message}`);
  }
}

/**
 * Send SMS via Eskiz.uz
 * @param phone - Phone number in format: 998901234567
 * @param code - Verification code
 */
export async function sendVerificationSMS(
  phone: string,
  code: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = await getAuthToken();

    // Format message
    const message = `Aresso.app platformasiga kirish tasdiqlash kodi: ${code}. Kodni hech kimga bermang.`;

    // Prepare form data
    const formData = new FormData();
    formData.append('mobile_phone', phone);
    formData.append('message', message);
    formData.append('from', '4546'); // Eskiz default sender

    const response = await fetch(`${ESKIZ_API_URL}/message/sms/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data: EskizSMSResponse = await response.json();

    if (!response.ok) {
      console.error('Eskiz SMS error:', data);
      
      // If token expired, refresh and retry
      if (response.status === 401) {
        authToken = null;
        tokenExpiry = 0;
        // Retry once
        return sendVerificationSMS(phone, code);
      }

      return {
        success: false,
        error: data.message || 'SMS yuborishda xatolik',
      };
    }

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error: any) {
    console.error('Send SMS exception:', error);
    return {
      success: false,
      error: error.message || 'SMS yuborishda xatolik',
    };
  }
}

/**
 * Generate 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Check if Eskiz is configured
 */
export function isEskizConfigured(): boolean {
  return !!(ESKIZ_EMAIL && ESKIZ_PASSWORD);
}
