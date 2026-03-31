import { coerceKvTestMode } from './payment-kv-utils.ts';

/**
 * Paycom Subscribe API (Payme Business) — cheklar
 * https://developer.help.paycom.uz/metody-subscribe-api/
 *
 * Payme bergan uchta qiymat (Supabase Edge Function → Secrets):
 *   PAYCOM_REGISTER_ID   — ID кассы (Subscribe / Business kabinet, eski «Merchant ID» bilan aralashtirmang)
 *   PAYCOM_SECRET_PROD   — prod kalit
 *   PAYCOM_SECRET_TEST   — test kalit
 *
 * Muhit:
 *   PAYCOM_USE_TEST=true  → test kalit + https://checkout.test.paycom.uz/api
 *   PAYCOM_USE_TEST=false yoki o‘rnatilmasa → prod kalit + https://checkout.paycom.uz/api
 *
 * Admin KV `payment_method:payme` → `config.merchantId` + `config.secretKey` bo‘lsa, ular
 * Supabase Secrets ustidan ustun: X-Auth shu juftlik bilan yuboriladi (admin panel orqali sozlash).
 * `isTestMode` → test/prod API URL (checkout.test vs checkout.paycom).
 * Receipt KV da `useTest` saqlanadi — create/check bir xil muhitda bo‘lsin.
 *
 * Orqaga moslik:
 *   PAYCOM_SECRET_KEY — bitta kalit
 *   PAYME_MERCHANT_ID + PAYME_SECRET_KEY — eski Supabase nomlari
 *
 * PAYCOM_API_URL — ixtiyoriy to‘liq override.
 *
 * X-Auth: <REGISTER_ID>:<tanlangan_kalit>
 */

const PAYME_MERCHANT_ID_LEGACY = (Deno.env.get('PAYME_MERCHANT_ID') || '').trim();
const PAYME_SECRET_KEY_LEGACY = (Deno.env.get('PAYME_SECRET_KEY') || '').trim();

const PAYCOM_REGISTER_ID = (
  Deno.env.get('PAYCOM_REGISTER_ID') ||
  PAYME_MERCHANT_ID_LEGACY ||
  ''
).trim();
const PAYCOM_SECRET_KEY_LEGACY = (Deno.env.get('PAYCOM_SECRET_KEY') || '').trim();
const PAYCOM_SECRET_PROD = (Deno.env.get('PAYCOM_SECRET_PROD') || '').trim();
const PAYCOM_SECRET_TEST = (Deno.env.get('PAYCOM_SECRET_TEST') || '').trim();
const PAYCOM_API_URL_ENV = (Deno.env.get('PAYCOM_API_URL') || '').trim();

/** Env bo‘yicha default test rejimi */
export function paycomDefaultUseTest(): boolean {
  return ['1', 'true', 'yes'].includes(
    (Deno.env.get('PAYCOM_USE_TEST') || '').toLowerCase().trim(),
  );
}

/** @deprecated nomi; `coerceKvTestMode` bilan bir xil */
export function coercePaymeKvTestMode(raw: unknown): boolean | null {
  return coerceKvTestMode(raw);
}

/**
 * KV dan kelgan isTestMode (har qanday tur) yoki env.
 */
export function resolvePaycomUseTest(kvIsTestMode?: unknown): boolean {
  const c = coerceKvTestMode(kvIsTestMode);
  if (c === true) return true;
  if (c === false) return false;
  return paycomDefaultUseTest();
}

/** Admin `payment-methods` POST → `payment_method:payme`.config */
export type PaymeKvCredentials = { merchantId: string; secretKey: string };

export function parsePaymeKvCredentials(paymeConfig: unknown): PaymeKvCredentials | null {
  if (!paymeConfig || typeof paymeConfig !== 'object') return null;
  const cfg = (paymeConfig as { config?: Record<string, unknown> }).config;
  if (!cfg || typeof cfg !== 'object') return null;
  const merchantId = String((cfg as Record<string, unknown>).merchantId ?? '').trim();
  const secretKey = String((cfg as Record<string, unknown>).secretKey ?? '').trim();
  if (!merchantId || !secretKey) return null;
  return { merchantId, secretKey };
}

function resolvePaycomAuth(
  useTest: boolean,
  kvCredentials: PaymeKvCredentials | null | undefined,
): { registerId: string; secret: string } | null {
  if (kvCredentials?.merchantId && kvCredentials?.secretKey) {
    return {
      registerId: kvCredentials.merchantId.trim(),
      secret: kvCredentials.secretKey.trim(),
    };
  }
  const reg = PAYCOM_REGISTER_ID.trim();
  const sec = getPaycomSecretForMode(useTest);
  if (reg && sec) return { registerId: reg, secret: sec };
  return null;
}

function getPaycomSecretForMode(useTest: boolean): string {
  if (useTest) {
    return (PAYCOM_SECRET_TEST || PAYCOM_SECRET_KEY_LEGACY || PAYME_SECRET_KEY_LEGACY).trim();
  }
  return (PAYCOM_SECRET_PROD || PAYCOM_SECRET_KEY_LEGACY || PAYME_SECRET_KEY_LEGACY).trim();
}

function paycomApiUrlForMode(useTest: boolean): string {
  if (PAYCOM_API_URL_ENV) return PAYCOM_API_URL_ENV.replace(/\/$/, '');
  return useTest ? 'https://checkout.test.paycom.uz/api' : 'https://checkout.paycom.uz/api';
}

function paycomCheckoutBaseForMode(useTest: boolean): string {
  if (PAYCOM_API_URL_ENV) {
    const u = PAYCOM_API_URL_ENV.replace(/\/$/, '');
    if (u.includes('test.paycom')) return 'https://checkout.test.paycom.uz';
    return 'https://checkout.paycom.uz';
  }
  return useTest ? 'https://checkout.test.paycom.uz' : 'https://checkout.paycom.uz';
}

export function isPaymeConfiguredForMode(
  useTest: boolean,
  kvCredentials?: PaymeKvCredentials | null,
): boolean {
  return resolvePaycomAuth(useTest, kvCredentials ?? null) !== null;
}

export function isPaymeConfigured(): boolean {
  return isPaymeConfiguredForMode(paycomDefaultUseTest());
}

export type PaycomCallOpts = {
  useTest?: boolean;
  /** Admin KV dagi merchantId + secretKey — bo‘lsa Secrets dan ustun */
  kvCredentials?: PaymeKvCredentials | null;
};

let rpcSeq = 0;
function nextRpcId(): number {
  rpcSeq = (rpcSeq + 1) % 1_000_000_000;
  return Date.now() + rpcSeq;
}

type RpcResult<T> =
  | { success: true; result: T }
  | { success: false; error: string; raw?: unknown };

function augmentPaycomUserError(msg: string): string {
  const m = msg.toLowerCase();
  if (
    m.includes('access denied') ||
    m.includes('доступ запрещ') ||
    m.includes('unauthorized') ||
    m.includes('авторизац')
  ) {
    return `${msg} — Payme API: X-Auth rad etildi. Admin → To‘lovlar → Payme: «Merchant ID» (ID кассы) va «Secret Key» to‘g‘ri va test rejimi kalit bilan mos ekanini tekshiring; yoki Supabase Secrets: PAYCOM_REGISTER_ID + PAYCOM_SECRET_PROD / PAYCOM_SECRET_TEST.`;
  }
  if (
    m.includes('поставщик') ||
    m.includes('provider') ||
    m.includes('заблокирован') ||
    m.includes('blocked')
  ) {
    return `${msg} — Payme: «ID кассы» (PAYCOM_REGISTER_ID / PAYME_MERCHANT_ID) va kalit bir xil muhitda bo‘lsin (test+test kalit yoki prod+prod). Admin «test rejimi» yoki PAYCOM_USE_TEST mosligini tekshiring; eski merchant id касса ID si bilan farq qilishi mumkin.`;
  }
  return msg;
}

async function makePaymeRequest<T = unknown>(
  method: string,
  params: Record<string, unknown>,
  opts?: PaycomCallOpts,
): Promise<RpcResult<T>> {
  const useTest = opts?.useTest !== undefined ? opts.useTest : paycomDefaultUseTest();
  const auth = resolvePaycomAuth(useTest, opts?.kvCredentials ?? null);

  if (!auth) {
    return {
      success: false,
      error: useTest
        ? 'Paycom TEST: Admin panelda Payme «Merchant ID» va «Secret Key» yoki Secrets: PAYCOM_REGISTER_ID + PAYCOM_SECRET_TEST (yoki PAYME_SECRET_KEY)'
        : 'Paycom PROD: Admin panelda Payme «Merchant ID» va «Secret Key» yoki Secrets: PAYCOM_REGISTER_ID + PAYCOM_SECRET_PROD (yoki PAYME_SECRET_KEY)',
    };
  }

  const url = paycomApiUrlForMode(useTest);
  const id = nextRpcId();
  const body = { jsonrpc: '2.0' as const, id, method, params };

  const xAuth = `${auth.registerId}:${auth.secret}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth': xAuth,
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: `Paycom javob JSON emas (${res.status}): ${text.slice(0, 200)}`,
        raw: text,
      };
    }

    if (json.error != null) {
      const msg =
        typeof json.error === 'string'
          ? json.error
          : json.error.message || json.error.msg || JSON.stringify(json.error);
      return { success: false, error: augmentPaycomUserError(String(msg)), raw: json };
    }

    return { success: true, result: json.result as T };
  } catch (e) {
    return { success: false, error: `Tarmoq xatosi: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Telefon: 998XXXXXXXXX (raqamlar) */
export function normalizePaycomPhone(phone: string): string {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 9 && d.startsWith('9')) return `998${d}`;
  if (d.length === 12 && d.startsWith('998')) return d;
  if (d.length === 11 && d.startsWith('998')) return d;
  return d;
}

export type PaymeReceiptItem = {
  title: string;
  price: number; // so'm
  count: number;
  code?: string;
  units?: number;
  vat_percent?: number;
  package_code?: string;
  discount?: number; // tiyin
};

export type CreateReceiptPaycomOpts = PaycomCallOpts;

/**
 * receipts.create
 * https://developer.help.paycom.uz/metody-subscribe-api/receipts.create
 */
export async function createReceipt(
  amount: number,
  orderId: string,
  items: PaymeReceiptItem[],
  phone?: string,
  description?: string,
  paycomOpts?: CreateReceiptPaycomOpts,
) {
  const amountInTiyin = Math.round(Number(amount) * 100);
  if (!Number.isFinite(amountInTiyin) || amountInTiyin <= 0) {
    return { success: false as const, error: 'Noto‘g‘ri summa' };
  }

  const detailItems = items.map((item) => ({
    title: item.title,
    price: Math.round(Number(item.price) * 100),
    count: Number(item.count) || 1,
    code: item.code || '00000000000000000',
    units: item.units ?? 2411,
    vat_percent: item.vat_percent ?? 0,
    package_code: item.package_code || '123456',
    ...(item.discount != null && item.discount > 0 ? { discount: Math.round(item.discount) } : {}),
  }));

  const itemsSum = detailItems.reduce((s, i) => s + i.price * i.count, 0);
  if (Math.abs(itemsSum - amountInTiyin) > 2) {
    console.warn('⚠️ Paycom: detail jami amount bilan deyarli mos emas', {
      itemsSum,
      amountInTiyin,
      orderId,
    });
  }

  const params: Record<string, unknown> = {
    amount: amountInTiyin,
    account: { order_id: String(orderId) },
    detail: {
      receipt_type: 0,
      items: detailItems,
    },
  };
  if (description?.trim()) params.description = description.trim();
  if (phone?.trim()) {
    console.log('💳 Paycom: SMS uchun /payme/send-receipt chaqiring (receiptId + phone)');
  }

  const useTest = paycomOpts?.useTest !== undefined ? paycomOpts.useTest : paycomDefaultUseTest();
  const result = await makePaymeRequest<{ receipt: { _id: string; state?: number } }>(
    'receipts.create',
    params,
    { useTest, kvCredentials: paycomOpts?.kvCredentials },
  );

  if (!result.success) return result;

  const receipt = result.result?.receipt;
  const receiptId = receipt?._id;
  if (!receiptId) {
    return { success: false as const, error: 'Paycom javobida receipt._id yo‘q', raw: result.result };
  }

  const checkoutUrl = `${paycomCheckoutBaseForMode(useTest)}/${receiptId}`;

  return {
    success: true as const,
    receiptId,
    checkoutUrl,
    receipt,
    /** create / check bir xil API da ishlashi uchun */
    _resolvedUseTest: useTest,
  };
}

/** receipts.check — faqat state */
export async function checkReceipt(receiptId: string, paycomOpts?: PaycomCallOpts) {
  const result = await makePaymeRequest<{ state: number }>(
    'receipts.check',
    { id: String(receiptId) },
    paycomOpts,
  );
  if (!result.success) return result;

  const state = Number(result.result?.state);
  const isPaid = state === 4;
  const isCancelled = state === 21 || state === 50 || state === 51;

  return {
    success: true as const,
    state,
    isPaid,
    isCancelled,
    receipt: null as unknown,
  };
}

/** receipts.get — to‘liq chek */
export async function getReceipt(receiptId: string, paycomOpts?: PaycomCallOpts) {
  const result = await makePaymeRequest<{ receipt: unknown }>(
    'receipts.get',
    { id: String(receiptId) },
    paycomOpts,
  );
  if (!result.success) return result;
  return { success: true as const, receipt: result.result?.receipt };
}

/** receipts.cancel */
export async function cancelReceipt(receiptId: string, paycomOpts?: PaycomCallOpts) {
  const result = await makePaymeRequest<{ receipt: unknown }>(
    'receipts.cancel',
    { id: String(receiptId) },
    paycomOpts,
  );
  if (!result.success) return result;
  return { success: true as const, receipt: result.result?.receipt };
}

/**
 * receipts.send — SMS invoice
 * https://developer.help.paycom.uz/metody-subscribe-api/receipts.send
 */
export async function sendReceipt(receiptId: string, phone: string, paycomOpts?: PaycomCallOpts) {
  const p = normalizePaycomPhone(phone);
  if (p.length < 12) {
    return { success: false as const, error: 'Telefon noto‘g‘ri (998XXXXXXXXX)' };
  }
  const result = await makePaymeRequest<{ success?: boolean }>(
    'receipts.send',
    {
      id: String(receiptId),
      phone: p,
    },
    paycomOpts,
  );
  if (!result.success) return result;
  return { success: true as const, sent: result.result?.success !== false };
}

if (isPaymeConfigured()) {
  console.log(
    '🔧 Paycom Subscribe API:',
    paycomApiUrlForMode(paycomDefaultUseTest()),
    '|',
    paycomDefaultUseTest() ? 'TEST' : 'PROD',
    '| register:',
    PAYCOM_REGISTER_ID ? `${PAYCOM_REGISTER_ID.slice(0, 8)}…` : '?',
  );
} else {
  console.log(
    '⚠️ Paycom: default muhit uchun register yoki kalit yetarli emas (PAYCOM_REGISTER_ID; PAYCOM_SECRET_PROD/TEST yoki PAYME_SECRET_KEY)',
  );
}
