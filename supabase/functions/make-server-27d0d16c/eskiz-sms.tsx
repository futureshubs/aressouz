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

function normalizeSmsOtpHost(host: string | undefined | null): string {
  const raw = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
  if (!raw || raw === "localhost" || raw === "127.0.0.1" || raw.startsWith("192.168.")) {
    return "aresso.app";
  }
  return raw.split(":")[0] || "aresso.app";
}

/** WebOTP / iOS autofill: SMS oxirida `@domain #123456` */
export function buildVerificationSmsMessage(code: string, otpHost?: string): string {
  const host = normalizeSmsOtpHost(otpHost);
  const c = String(code || "").replace(/\D/g, "").slice(0, 6);
  return `Aresso kirish kodi: ${c}. Kodni hech kimga bermang.\n@${host} #${c}`;
}

/**
 * Send SMS via Eskiz.uz
 * @param phone - Phone number in format: 998901234567
 * @param code - Verification code
 * @param otpHost - Sayt hosti (WebOTP: `@host #code`)
 */
export async function sendVerificationSMS(
  phone: string,
  code: string,
  otpHost?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = await getAuthToken();

    const message = buildVerificationSmsMessage(code, otpHost);

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
        return sendVerificationSMS(phone, code, otpHost);
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

/** Ixtiyoriy matnli SMS (qarz, eslatma va h.k.) */
export async function sendCustomSMS(
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append('mobile_phone', phone);
    formData.append('message', String(message || '').trim());
    formData.append('from', '4546');

    const response = await fetch(`${ESKIZ_API_URL}/message/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data: EskizSMSResponse = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        authToken = null;
        tokenExpiry = 0;
        return sendCustomSMS(phone, message);
      }
      return { success: false, error: data.message || 'SMS yuborishda xatolik' };
    }
    return { success: true, messageId: data.id };
  } catch (error: any) {
    console.error('Send custom SMS exception:', error);
    return { success: false, error: error.message || 'SMS yuborishda xatolik' };
  }
}

/**
 * Check if Eskiz is configured
 */
export function isEskizConfigured(): boolean {
  return !!(ESKIZ_EMAIL && ESKIZ_PASSWORD);
}
