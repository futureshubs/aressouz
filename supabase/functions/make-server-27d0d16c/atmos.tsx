/**
 * Atmos.uz Merchant API (OAuth2 client_credentials)
 * https://docs.atmos.uz/
 *
 * Supabase Secrets (yoki admin KV `payment_method:atmos` → config):
 *   ATMOS_STORE_ID, ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET
 *   ATMOS_API_URL — ixtiyoriy. Host `apigw` bo‘lsa rasmiy API (docs.atmos.uz): /token, /merchant/pay/create
 *     Eski host: https://api.atmos.uz yoki https://sandbox-api.atmos.uz (/oauth2/token, /merchant-api/...)
 *   ATMOS_TERMINAL_ID — ixtiyoriy (apigw create da terminal_id)
 *   ATMOS_USE_SANDBOX=true — bo‘sh API URL da sandbox uchun `https://sandbox-api.atmos.uz`
 *
 *   ATMOS_OAUTH_TIMEOUT_MS — token so‘rovi (default 60000). Edge → Atmos ba’zan 22s dan uzoq kutadi.
 *   ATMOS_FETCH_TIMEOUT_MS — tranzaksiya/check (default 45000)
 *
 * KV config: storeId, consumerKey, consumerSecret, apiBaseUrl, terminalId (ixtiyoriy)
 *
 * URL (asosiy Edge): `.../functions/v1/make-server-27d0d16c/atmos/create-transaction`
 * URL (ixtiyoriy `payment-webhooks`): `.../functions/v1/payment-webhooks/atmos/create-transaction`
 */

import { coerceKvTestMode } from './payment-kv-utils.ts';

const ENV_STORE = (Deno.env.get('ATMOS_STORE_ID') || '').trim();
const ENV_KEY = (Deno.env.get('ATMOS_CONSUMER_KEY') || '').trim();
const ENV_SECRET = (Deno.env.get('ATMOS_CONSUMER_SECRET') || '').trim();
const ENV_API_URL = (Deno.env.get('ATMOS_API_URL') || '').trim().replace(/\/$/, '');
const ENV_TERMINAL_ID = (Deno.env.get('ATMOS_TERMINAL_ID') || '').trim();
const ENV_SANDBOX_FLAG = ['1', 'true', 'yes'].includes(
  (Deno.env.get('ATMOS_USE_SANDBOX') || '').toLowerCase().trim(),
);

/** Prod default: legacy — Supabase Edge → apigw ba’zan 22–60s kutib javobsiz; rasmiy apigw: Secret/KV da URL qo‘ying */
const DEFAULT_API_PROD = 'https://api.atmos.uz';
const DEFAULT_API_SANDBOX = 'https://sandbox-api.atmos.uz';
const LEGACY_FALLBACK_BASE = 'https://api.atmos.uz';

export type AtmosKvConfig = {
  storeId?: string;
  consumerKey?: string;
  consumerSecret?: string;
  apiBaseUrl?: string;
  terminalId?: string;
};

export type AtmosRuntime = {
  storeId: string;
  consumerKey: string;
  consumerSecret: string;
  apiBaseUrl: string;
  terminalId?: string;
  cacheKey: string;
};

/** docs.atmos.uz — apigw; eski integratsiya — api.atmos.uz / sandbox-api.atmos.uz */
function atmosApiStyle(apiBaseUrl: string): 'apigw' | 'legacy' {
  try {
    return new URL(apiBaseUrl).hostname.includes('apigw') ? 'apigw' : 'legacy';
  } catch {
    return 'legacy';
  }
}

function storeIdForJson(storeId: string): number | string {
  const n = parseInt(storeId, 10);
  if (Number.isFinite(n) && String(n) === storeId.trim()) return n;
  return storeId.trim();
}

function formatAtmosError(data: Record<string, unknown>): string {
  const res = data.result;
  if (res && typeof res === 'object') {
    const o = res as Record<string, unknown>;
    const desc = o.description ?? o.message;
    const code = o.code;
    if (typeof desc === 'string' && desc.trim()) return desc.trim();
    if (code != null && String(code) !== 'OK') return String(code);
  }
  return String(
    data.message || data.error || data.error_description || data.detail || 'Atmos javobi',
  );
}

function defaultApiBaseUrl(useSandbox: boolean): string {
  return useSandbox ? DEFAULT_API_SANDBOX : DEFAULT_API_PROD;
}

/** `payment_method:atmos` KV yoki null (faqat env) */
export function parseAtmosKvConfig(row: unknown): AtmosKvConfig | null {
  if (!row || typeof row !== 'object') return null;
  const cfg = (row as { config?: Record<string, unknown> }).config;
  if (!cfg || typeof cfg !== 'object') return null;
  const storeId = String(cfg.storeId ?? '').trim();
  const consumerKey = String(
    cfg.consumerKey ?? (cfg as Record<string, unknown>).consumer_key ?? '',
  ).trim();
  const consumerSecret = String(
    cfg.consumerSecret ?? (cfg as Record<string, unknown>).consumer_secret ?? '',
  ).trim();
  const apiBaseUrl = String(cfg.apiBaseUrl ?? (cfg as Record<string, unknown>).api_url ?? '')
    .trim()
    .replace(/\/$/, '');
  const terminalId = String(
    cfg.terminalId ?? (cfg as Record<string, unknown>).terminal_id ?? '',
  ).trim();
  if (!storeId && !consumerKey && !consumerSecret && !apiBaseUrl) return null;
  return {
    storeId: storeId || undefined,
    consumerKey: consumerKey || undefined,
    consumerSecret: consumerSecret || undefined,
    apiBaseUrl: apiBaseUrl || undefined,
    terminalId: terminalId || undefined,
  };
}

function useSandboxFromRow(row: unknown | null): boolean {
  if (row && typeof row === 'object' && 'isTestMode' in row) {
    const c = coerceKvTestMode((row as { isTestMode?: unknown }).isTestMode);
    if (c === true) return true;
    if (c === false) return false;
  }
  return ENV_SANDBOX_FLAG;
}

/**
 * Env + KV (KV ustunlik: maydon bo‘sh bo‘lmasa)
 */
export function resolveAtmosRuntime(row: unknown | null): AtmosRuntime | null {
  const kv = parseAtmosKvConfig(row);
  const sandbox = useSandboxFromRow(row);

  const storeId = (kv?.storeId || ENV_STORE).trim();
  const consumerKey = (kv?.consumerKey || ENV_KEY).trim();
  const consumerSecret = (kv?.consumerSecret || ENV_SECRET).trim();

  let apiBaseUrl = (kv?.apiBaseUrl || ENV_API_URL).trim().replace(/\/$/, '');
  if (!apiBaseUrl) {
    apiBaseUrl = defaultApiBaseUrl(sandbox);
  }

  if (!storeId || !consumerKey || !consumerSecret) return null;

  const terminalId = (kv?.terminalId || ENV_TERMINAL_ID).trim() || undefined;

  const cacheKey = `${apiBaseUrl}|${consumerKey.slice(0, 6)}|${consumerSecret.slice(0, 4)}`;
  return { storeId, consumerKey, consumerSecret, apiBaseUrl, terminalId, cacheKey };
}

export function isAtmosConfigured(row?: unknown | null): boolean {
  return resolveAtmosRuntime(row ?? null) !== null;
}

const ATMOS_OAUTH_TIMEOUT_MS = Math.min(
  Math.max(Number(Deno.env.get('ATMOS_OAUTH_TIMEOUT_MS') || '60000'), 15000),
  120000,
);

const ATMOS_FETCH_TIMEOUT_MS = Math.min(
  Math.max(Number(Deno.env.get('ATMOS_FETCH_TIMEOUT_MS') || '45000'), 10000),
  120000,
);

function isAbortError(e: unknown): boolean {
  if (e instanceof Error && e.name === 'AbortError') return true;
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';
}

async function atmosFetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

async function atmosFetch(url: string, init: RequestInit): Promise<Response> {
  return atmosFetchWithTimeout(url, init, ATMOS_FETCH_TIMEOUT_MS);
}

async function readJsonResponse(res: Response): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const text = await res.text();
  if (!text.trim()) {
    return { ok: res.ok, data: {} };
  }
  try {
    return { ok: res.ok, data: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      data: { message: `JSON emas (${res.status}): ${text.slice(0, 160)}` },
    };
  }
}

// Token cache (per OAuth client / API host)
let tokenCacheKey = '';
let cachedToken: string | null = null;
let tokenExpiry = 0;

/** apigw dan token kelmasa (vaqt / tarmoq) — bir marta api.atmos.uz sinash */
function shouldTryLegacyAfterApigwTokenFailure(errorMsg: string): boolean {
  const e = errorMsg.toLowerCase();
  return (
    e.includes('vaqt tugadi') ||
    e.includes('javob bermadi') ||
    e.includes('fetch failed') ||
    e.includes('tarmoq xatoligi') ||
    e.includes('network') ||
    e.includes('econnreset') ||
    e.includes('connection refused')
  );
}

async function obtainAccessTokenWithFallback(
  origRt: AtmosRuntime,
): Promise<{ success: true; token: string; rt: AtmosRuntime } | { success: false; error: string }> {
  let r = await getAccessToken(origRt);
  if (r.success && r.token) return { success: true, token: r.token, rt: origRt };

  const err0 = r.error || '';
  if (
    atmosApiStyle(origRt.apiBaseUrl) === 'apigw' &&
    shouldTryLegacyAfterApigwTokenFailure(err0)
  ) {
    const legacyRt: AtmosRuntime = {
      ...origRt,
      apiBaseUrl: LEGACY_FALLBACK_BASE,
      cacheKey: `${origRt.cacheKey}|legacyfb`,
    };
    console.warn('💳 apigw token xato, legacy sinanmoqda:', LEGACY_FALLBACK_BASE);
    r = await getAccessToken(legacyRt);
    if (r.success && r.token) return { success: true, token: r.token, rt: legacyRt };
  }

  return { success: false, error: r.error || err0 || 'Token olishda xatolik' };
}

async function getAccessToken(rt: AtmosRuntime): Promise<{ success: boolean; token?: string; error?: string }> {
  const now = Date.now();
  if (tokenCacheKey === rt.cacheKey && cachedToken && tokenExpiry > now + 5 * 60 * 1000) {
    console.log('💳 Using cached Atmos token');
    return { success: true, token: cachedToken };
  }

  const style = atmosApiStyle(rt.apiBaseUrl);
  const tokenPath = style === 'apigw' ? '/token' : '/oauth2/token';
  console.log('💳 Requesting new Atmos access token...', { api: rt.apiBaseUrl, style, tokenPath });

  try {
    const credentials = `${rt.consumerKey}:${rt.consumerSecret}`;
    const base64Credentials = btoa(credentials);

    const response = await atmosFetchWithTimeout(
      `${rt.apiBaseUrl}${tokenPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${base64Credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      },
      ATMOS_OAUTH_TIMEOUT_MS,
    );

    const { data } = await readJsonResponse(response);
    console.log('💳 Atmos Token Response:', { ok: response.ok, error: data.error });

    const accessToken = data.access_token;
    if (response.ok && typeof accessToken === 'string' && accessToken.length > 0) {
      tokenCacheKey = rt.cacheKey;
      cachedToken = accessToken;
      tokenExpiry = now + (Number(data.expires_in) || 3600) * 1000;
      return { success: true, token: cachedToken };
    }
    console.error('❌ Atmos token error:', data);
    return {
      success: false,
      error: formatAtmosError(data) || 'Token olishda xatolik',
    };
  } catch (error: unknown) {
    console.error('❌ Atmos token request error:', error);
    if (isAbortError(error)) {
      return {
        success: false,
        error: `Atmos OAuth vaqt tugadi (${ATMOS_OAUTH_TIMEOUT_MS / 1000}s): ${rt.apiBaseUrl} javob bermadi. Tarmoq yoki firewall; KV/Secret da apiBaseUrl=https://api.atmos.uz (legacy) yoki ATMOS_OAUTH_TIMEOUT_MS ni oshiring.`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Tarmoq xatoligi',
    };
  }
}

export async function createTransaction(
  amount: number,
  orderId: string,
  customerPhone: string,
  customerName: string | undefined,
  paymentMethodRow: unknown | null,
) {
  const rt = resolveAtmosRuntime(paymentMethodRow);
  if (!rt) {
    return { success: false as const, error: 'Atmos sozlanmagan (Secrets yoki admin KV)' };
  }

  console.log('💳 Creating Atmos transaction:', { amount, orderId, customerPhone, configApi: rt.apiBaseUrl });

  const tokenResult = await obtainAccessTokenWithFallback(rt);
  if (!tokenResult.success) {
    return { success: false as const, error: tokenResult.error || 'Token olishda xatolik' };
  }

  const { token, rt: workRt } = tokenResult;

  const amountInTiyin = Math.round(Number(amount) * 100);
  if (!Number.isFinite(amountInTiyin) || amountInTiyin <= 0) {
    return { success: false as const, error: 'Noto‘g‘ri summa' };
  }

  let cleanPhone = String(customerPhone || '').replace(/[\s+\-()]/g, '');
  if (cleanPhone.startsWith('998')) {
    /* ok */
  } else if (cleanPhone.startsWith('0')) {
    cleanPhone = '998' + cleanPhone.slice(1);
  } else {
    cleanPhone = '998' + cleanPhone;
  }

  const style = atmosApiStyle(workRt.apiBaseUrl);

  try {
    let response: Response;
    let transactionData: Record<string, unknown>;

    if (style === 'apigw') {
      transactionData = {
        amount: amountInTiyin,
        account: orderId,
        store_id: storeIdForJson(workRt.storeId),
        lang: 'uz',
      };
      if (workRt.terminalId) transactionData.terminal_id = workRt.terminalId;
      if (customerName?.trim()) transactionData.user_name = customerName.trim();

      response = await atmosFetch(`${workRt.apiBaseUrl}/merchant/pay/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });
    } else {
      transactionData = {
        store_id: storeIdForJson(workRt.storeId),
        amount: amountInTiyin,
        phone: cleanPhone,
        order_id: orderId,
      };
      if (customerName?.trim()) transactionData.user_name = customerName.trim();

      response = await atmosFetch(`${workRt.apiBaseUrl}/merchant-api/transaction`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });
    }

    const { data } = await readJsonResponse(response);
    console.log('💳 Atmos Transaction Response:', {
      api: workRt.apiBaseUrl,
      style,
      ok: response.ok,
      keys: Object.keys(data || {}),
    });

    const txId = data.transaction_id ?? data.transactionId;
    const resultBlock = data.result as Record<string, unknown> | undefined;
    const rc = resultBlock?.code != null ? String(resultBlock.code) : '';
    const resultBad = rc !== '' && rc !== 'OK';

    if (response.ok && txId && !resultBad) {
      const redirectUrl =
        data.redirect_url ||
        data.redirectUrl ||
        `https://atmos.uz/pay/${txId}`;
      return {
        success: true as const,
        transactionId: String(txId),
        redirectUrl: String(redirectUrl),
        status: data.status,
      };
    }

    if (response.ok && txId && resultBad) {
      return {
        success: false as const,
        error: formatAtmosError(data) || 'Tranzaksiya yaratishda xatolik',
      };
    }

    console.error('❌ Atmos transaction error:', data);
    return {
      success: false as const,
      error: formatAtmosError(data) || 'Tranzaksiya yaratishda xatolik',
    };
  } catch (error: unknown) {
    console.error('❌ Atmos transaction request error:', error);
    if (isAbortError(error)) {
      return {
        success: false as const,
        error: `Atmos tranzaksiya so‘rovi vaqt tugadi (${ATMOS_FETCH_TIMEOUT_MS / 1000}s)`,
      };
    }
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Tarmoq xatoligi',
    };
  }
}

export async function checkTransaction(transactionId: string, paymentMethodRow: unknown | null) {
  const rt = resolveAtmosRuntime(paymentMethodRow);
  if (!rt) {
    return { success: false as const, error: 'Atmos sozlanmagan' };
  }

  const tokenResult = await obtainAccessTokenWithFallback(rt);
  if (!tokenResult.success) {
    return { success: false as const, error: tokenResult.error || 'Token olishda xatolik' };
  }

  const { token, rt: workRt } = tokenResult;

  try {
    const response = await atmosFetch(
      `${workRt.apiBaseUrl}/merchant-api/transaction/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const { data } = await readJsonResponse(response);
    if (response.ok) {
      const status = data.status;
      return {
        success: true as const,
        transaction: data,
        status,
        isPaid: status === 'COMPLETED',
        isApproved: status === 'APPROVED',
        isRejected: status === 'REJECTED' || status === 'CANCELLED',
      };
    }
    return {
      success: false as const,
      error: String(data.message || data.error || 'Tranzaksiya holatini olishda xatolik'),
    };
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return {
        success: false as const,
        error: `Atmos holat so‘rovi vaqt tugadi (${ATMOS_FETCH_TIMEOUT_MS / 1000}s)`,
      };
    }
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Tarmoq xatoligi',
    };
  }
}

export async function cancelTransaction(transactionId: string, paymentMethodRow: unknown | null) {
  const rt = resolveAtmosRuntime(paymentMethodRow);
  if (!rt) {
    return { success: false as const, error: 'Atmos sozlanmagan' };
  }

  const tokenResult = await obtainAccessTokenWithFallback(rt);
  if (!tokenResult.success) {
    return { success: false as const, error: tokenResult.error || 'Token olishda xatolik' };
  }

  const { token, rt: workRt } = tokenResult;
  const style = atmosApiStyle(workRt.apiBaseUrl);

  try {
    let response = await atmosFetch(
      `${workRt.apiBaseUrl}/merchant-api/transaction/${transactionId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok && style === 'apigw') {
      const tid = parseInt(transactionId, 10);
      response = await atmosFetch(`${workRt.apiBaseUrl}/merchant/pay/reverse`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id: Number.isFinite(tid) ? tid : transactionId,
          store_id: storeIdForJson(workRt.storeId),
          reason: 'cancel',
        }),
      });
    }

    const { data } = await readJsonResponse(response);
    if (response.ok) {
      const res = data.result as Record<string, unknown> | undefined;
      if (style === 'apigw' && res?.code && String(res.code) !== 'OK') {
        return {
          success: false as const,
          error: formatAtmosError(data) || 'Tranzaksiyani bekor qilishda xatolik',
        };
      }
      return { success: true as const, message: 'Tranzaksiya bekor qilindi' };
    }
    return {
      success: false as const,
      error: formatAtmosError(data) || 'Tranzaksiyani bekor qilishda xatolik',
    };
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return {
        success: false as const,
        error: `Atmos bekor qilish vaqt tugadi (${ATMOS_FETCH_TIMEOUT_MS / 1000}s)`,
      };
    }
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Tarmoq xatoligi',
    };
  }
}

export default {
  isAtmosConfigured,
  resolveAtmosRuntime,
  createTransaction,
  checkTransaction,
  cancelTransaction,
};
