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

/** Eskiz.uz panelidagi tasdiqlangan shablon (my.eskiz.uz). */
export const ESKIZ_OTP_TEMPLATE_DEFAULT =
  "Aresso.app platformasiga kirish tasdiqlash kodi: {{code}}. Kodni hech kimga bermang.";

function resolveOtpTemplateRaw(): string {
  return Deno.env.get("ESKIZ_OTP_MESSAGE")?.trim() || ESKIZ_OTP_TEMPLATE_DEFAULT;
}

/** Eskiz’ga yuboriladigan tayyor SMS matni */
export function buildSimpleVerificationSmsMessage(code: string): string {
  return fillOtpTemplate(resolveOtpTemplateRaw(), code);
}

/** WebOTP: `@host #code` — faqat Eskiz’da shu matn shablon sifatida tasdiqlanganda (ESKIZ_SMS_WEBOTP=1). */
export function buildWebOtpVerificationSmsMessage(code: string, otpHost?: string): string {
  const host = normalizeSmsOtpHost(otpHost);
  const c = String(code || "").replace(/\D/g, "").slice(0, 6);
  return `${buildSimpleVerificationSmsMessage(c)}\n@${host} #${c}`;
}

export function buildVerificationSmsMessage(code: string, otpHost?: string): string {
  if (Deno.env.get("ESKIZ_SMS_WEBOTP") === "1") {
    return buildWebOtpVerificationSmsMessage(code, otpHost);
  }
  return buildSimpleVerificationSmsMessage(code);
}

function isEskizTemplateOrTextError(msg: string): boolean {
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("шаблон") ||
    m.includes("shablon") ||
    m.includes("template") ||
    m.includes("текст") ||
    m.includes("matn") ||
    m.includes("my.eskiz") ||
    m.includes("личный кабинет") ||
    m.includes("cabinet") ||
    m.includes("ro'yxat") ||
    m.includes("royxat")
  );
}

async function parseEskizJson(response: Response): Promise<EskizSMSResponse & Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as EskizSMSResponse & Record<string, unknown>;
  } catch {
    return { message: text.slice(0, 500), status: String(response.status) };
  }
}

/** Eskiz tasdiqlangan shablon matniga kodni qo‘yish */
export function fillOtpTemplate(
  template: string,
  code: string,
  otpHost?: string,
): string {
  const c = String(code || "").replace(/\D/g, "").slice(0, 6);
  const host = normalizeSmsOtpHost(otpHost);
  let msg = String(template || "");
  const replacements: [RegExp, string][] = [
    [/\{\{\s*code\s*\}\}/gi, c],
    [/\{\s*code\s*\}/gi, c],
    [/%code%/gi, c],
    [/#code#/gi, c],
    [/XXXXXX/gi, c],
    [/######/g, c],
    [/\b000000\b/g, c],
    [/\b123456\b/g, c],
  ];
  for (const [re, val] of replacements) {
    msg = msg.replace(re, val);
  }
  if (Deno.env.get("ESKIZ_SMS_WEBOTP") === "1" && !msg.includes(`@${host}`)) {
    msg = `${msg.trim()}\n@${host} #${c}`;
  }
  return msg.trim();
}

type EskizTemplateRow = { id?: number | string; template?: string; text?: string; status?: string };

async function fetchEskizTemplates(token: string): Promise<EskizTemplateRow[]> {
  try {
    const response = await fetch(`${ESKIZ_API_URL}/user/templates`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseEskizJson(response);
    if (!response.ok) {
      console.error("Eskiz templates list error:", data);
      return [];
    }
    const raw = (data as { data?: unknown }).data ?? (data as { result?: unknown }).result ?? data;
    if (Array.isArray(raw)) return raw as EskizTemplateRow[];
    if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
      return (raw as { data: EskizTemplateRow[] }).data;
    }
    return [];
  } catch (e) {
    console.error("Eskiz templates fetch exception:", e);
    return [];
  }
}

function pickOtpTemplateRow(rows: EskizTemplateRow[]): EskizTemplateRow | null {
  const wantedId = Deno.env.get("ESKIZ_OTP_TEMPLATE_ID")?.trim();
  const approved = rows.filter((r) => {
    const st = String(r.status || "").toLowerCase();
    return !st || st === "approved" || st === "service" || st === "moderation" || st === "accepted";
  });
  if (wantedId) {
    const hit = approved.find((r) => String(r.id) === wantedId);
    if (hit) return hit;
  }
  const otpLike = approved.find((r) => {
    const t = String(r.template || r.text || "").toLowerCase();
    return t.includes("kod") || t.includes("code") || t.includes("aresso") || t.includes("kirish");
  });
  return otpLike || approved[0] || null;
}

async function buildMessagesToTry(code: string, otpHost?: string): Promise<string[]> {
  const c = String(code || "").replace(/\D/g, "").slice(0, 6);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (m: string) => {
    const t = m.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  push(fillOtpTemplate(resolveOtpTemplateRaw(), c, otpHost));

  try {
    const token = await getAuthToken();
    const rows = await fetchEskizTemplates(token);
    const picked = pickOtpTemplateRow(rows);
    if (picked) {
      const raw = String(picked.template || picked.text || "");
      if (raw) push(fillOtpTemplate(raw, c, otpHost));
    }
    for (const row of rows) {
      const raw = String(row.template || row.text || "").trim();
      if (!raw) continue;
      push(fillOtpTemplate(raw, c, otpHost));
    }
  } catch (e) {
    console.error("Eskiz template pick error:", e);
  }

  push(buildSimpleVerificationSmsMessage(c));
  if (Deno.env.get("ESKIZ_SMS_WEBOTP") === "1") {
    push(buildWebOtpVerificationSmsMessage(c, otpHost));
  }

  return out;
}

/**
 * Send SMS via Eskiz.uz
 * @param phone - Phone number in format: 998901234567
 * @param code - Verification code
 * @param otpHost - Sayt hosti (WebOTP: `@host #code`)
 */
async function sendSmsWithMessage(
  phone: string,
  message: string,
  retryAuth = true,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = await getAuthToken();
  const from = Deno.env.get("ESKIZ_SENDER") || "4546";
  const formData = new FormData();
  formData.append("mobile_phone", phone);
  formData.append("message", message);
  formData.append("from", from);

  const response = await fetch(`${ESKIZ_API_URL}/message/sms/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const data = await parseEskizJson(response);

  if (!response.ok) {
    console.error("Eskiz SMS error:", data);
    if (response.status === 401 && retryAuth) {
      authToken = null;
      tokenExpiry = 0;
      return sendSmsWithMessage(phone, message, false);
    }
    return {
      success: false,
      error: String(data.message || "SMS yuborishda xatolik"),
    };
  }

  return { success: true, messageId: data.id };
}

export async function sendVerificationSMS(
  phone: string,
  code: string,
  otpHost?: string,
): Promise<{ success: boolean; messageId?: string; error?: string; devLogged?: boolean }> {
  try {
    if (Deno.env.get("ESKIZ_SMS_DEV_BYPASS") === "1") {
      console.log(`[ESKIZ_SMS_DEV_BYPASS] OTP ${phone}: ${code}`);
      return { success: true, messageId: "dev-bypass", devLogged: true };
    }

    const candidates = await buildMessagesToTry(code, otpHost);
    let lastError = "SMS yuborishda xatolik";

    for (const message of candidates) {
      const result = await sendSmsWithMessage(phone, message);
      if (result.success) return result;
      lastError = result.error || lastError;
      if (!isEskizTemplateOrTextError(lastError)) {
        return result;
      }
      console.log("Eskiz: template rejected, try next variant");
    }

    if (isEskizTemplateOrTextError(lastError)) {
      return {
        success: false,
        error:
          "SMS shabloni Eskiz’da tasdiqlanmagan. Shablon matni: «Aresso.app platformasiga kirish tasdiqlash kodi: {{code}}. Kodni hech kimga bermang.»",
      };
    }

    return { success: false, error: lastError };
  } catch (error: any) {
    console.error("Send SMS exception:", error);
    return {
      success: false,
      error: error.message || "SMS yuborishda xatolik",
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

    const data = await parseEskizJson(response);
    if (!response.ok) {
      if (response.status === 401) {
        authToken = null;
        tokenExpiry = 0;
        return sendCustomSMS(phone, message);
      }
      return { success: false, error: String(data.message || 'SMS yuborishda xatolik') };
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
