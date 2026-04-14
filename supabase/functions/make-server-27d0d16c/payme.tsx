import { coerceKvTestMode } from './payment-kv-utils.ts';

/**
 * Paycom Subscribe API (Payme Business) — cheklar
 * https://developer.help.paycom.uz/metody-subscribe-api/
 *
 * Eski Merchant API (CheckPerformTransaction, CreateTransaction, …) — boshqa integratsiya;
 * Subscribe oqimida ularning vazifalari JSON-RPC orqali: receipts.create, receipts.check,
 * receipts.get, receipts.cancel (pastda).
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
 * X-Auth faqat Supabase Secrets: PAYCOM_REGISTER_ID + PAYCOM_SECRET_PROD / PAYCOM_SECRET_TEST.
 * `payment_method:payme` KV da faqat `enabled` (checkoutda ko‘rsatish) — kalitlar saqlanmaydi.
 *
 * Qisqa URL (ixtiyoriy `payment-webhooks` funksiyasi): `.../functions/v1/payment-webhooks/payme/create-receipt`
 * (asosiy server: `.../make-server-27d0d16c/payme/create-receipt`).
 * Test/prod: Secret `PAYCOM_USE_TEST`.
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

function paycomHttpDebug(): boolean {
  return ['1', 'true', 'yes'].includes(
    (Deno.env.get('PAYCOM_DEBUG_LOG') || Deno.env.get('PAYME_HTTP_DEBUG') || '')
      .toLowerCase()
      .trim(),
  );
}

/** Jurnal: detail.items ichidagi uzun matnlarni qisqartiramiz */
function sanitizePaycomRpcParamsForLog(
  method: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  try {
    const p = JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
    const det = p.detail;
    if (det && typeof det === 'object' && det !== null && 'items' in det) {
      const items = (det as { items?: unknown }).items;
      if (Array.isArray(items)) {
        (det as { items: unknown[] }).items = items.map((it: unknown) => {
          if (!it || typeof it !== 'object') return it;
          const o = it as Record<string, unknown>;
          const t = o.title;
          return {
            title: typeof t === 'string' ? `${t.slice(0, 64)}${t.length > 64 ? '…' : ''}` : t,
            price: o.price,
            count: o.count,
            code: o.code,
            units: o.units,
          };
        });
      }
    }
    return { method, params: p };
  } catch {
    return { method, params: '[serialize-failed]' };
  }
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

/**
 * Test/prod faqat Supabase Secret `PAYCOM_USE_TEST` (admin KV endi ishlatilmaydi).
 */
export function resolvePaycomUseTestForPayme(_paymeConfig?: unknown): boolean {
  return paycomDefaultUseTest();
}

function resolvePaycomAuth(
  useTest: boolean,
  _kvCredentials: PaymeKvCredentials | null | undefined,
): { registerId: string; secret: string } | null {
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

/** PAYCOM_API_URL ichida test yoki prod API ekanini aniqlash */
function paycomApiUrlLooksTest(apiUrl: string): boolean {
  const s = apiUrl.toLowerCase();
  try {
    const u = new URL(apiUrl.includes("://") ? apiUrl : `https://${apiUrl}`);
    return u.hostname.includes("test.paycom");
  } catch {
    return s.includes("test.paycom");
  }
}

/**
 * JSON-RPC endpoint — `useTest` bilan majburiy moslik.
 * OLDINGI XATO: PAYCOM_API_URL har doim ishlatilardi → test kalit + prod /api yoki aksincha:
 * chek bir muhitda yaratiladi, checkout boshqasida ochiladi → «Чек не найден или оплачен».
 */
function paycomApiUrlForMode(useTest: boolean): string {
  const defaultTest = "https://checkout.test.paycom.uz/api";
  const defaultProd = "https://checkout.paycom.uz/api";
  if (!PAYCOM_API_URL_ENV) {
    return useTest ? defaultTest : defaultProd;
  }
  const custom = PAYCOM_API_URL_ENV.replace(/\/$/, "");
  const customIsTest = paycomApiUrlLooksTest(custom);
  if (useTest !== customIsTest) {
    console.error(
      "[paycom] ROOT_CAUSE_FIX: PAYCOM_API_URL muhiti useTest bilan zidd — env e’tiborsiz qoldirildi",
      { useTest, PAYCOM_API_URL: custom, forcedUrl: useTest ? defaultTest : defaultProd },
    );
    return useTest ? defaultTest : defaultProd;
  }
  return custom;
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
  /** @deprecated ishlatilmaydi — X-Auth faqat Supabase Secrets */
  kvCredentials?: PaymeKvCredentials | null;
};

/** receipts.create checkout havolasi uchun (faqat https) */
export type CreateReceiptPaycomOpts = PaycomCallOpts & {
  /** payme.uz ga `back=` — localhost bo‘lsa «чек не найден» chiqishi mumkin */
  checkoutBackUrl?: string;
};

/**
 * Admin KV / client: `null`, "null", "undefined", bo‘sh — rad.
 * payme.uz ko‘pincha `back` bo‘lmasa yoki noto‘g‘ri bo‘lsa `back=null` va «чек не найден» beradi.
 */
export function parsePaycomHttpsBackUrl(raw: unknown): string | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  const lower = s.toLowerCase();
  if (lower === "null" || lower === "undefined" || lower === "none" || lower === "nil") {
    return undefined;
  }
  if (!/^https:\/\/.+/i.test(s)) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return undefined;
    if (u.hostname === "localhost" || u.hostname.endsWith(".local")) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/**
 * Har doim yaroqli https `back` — Payme `back=null` holatini oldini olish.
 */
function resolveCheckoutBackUrl(opts?: CreateReceiptPaycomOpts): string {
  // SUPABASE_URL ni `back` sifatida ishlatmaymiz — Payme ba’zan rad qilib `back=null` qiladi.
  const candidates: unknown[] = [
    opts?.checkoutBackUrl,
    Deno.env.get("PAYME_CHECKOUT_BACK_URL"),
    Deno.env.get("PAYCOM_CHECKOUT_BACK_URL"),
    Deno.env.get("PUBLIC_APP_URL"),
    Deno.env.get("SITE_URL"),
    Deno.env.get("APP_URL"),
    Deno.env.get("NEXT_PUBLIC_SITE_URL"),
  ];
  for (const c of candidates) {
    const v = parsePaycomHttpsBackUrl(c);
    if (v) return v;
  }
  console.warn(
    "[paycom] checkout `back`: hech qayerda https URL yo‘q — vaqtincha https://payme.uz/ ishlatiladi. " +
      "Admin → Callback URL (https) yoki Secret PAYME_CHECKOUT_BACK_URL qo‘ying.",
  );
  return "https://payme.uz/";
}

/**
 * Checkout host FAQAT `useTest` dan — PAYCOM_API_URL dan emas (RPC URL bilan chalkashmasin).
 * Path da **faqat** result.receipt._id (Mongo ObjectId), encodeURIComponent ishlatilmaydi (hujjatdagi namuna bilan bir xil).
 */
function buildSubscribeCheckoutUrl(useTest: boolean, receiptId: string, backHttps: string): string {
  const id = String(receiptId).trim();
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    console.warn(
      "[paycom] receiptId Mongo ObjectId formatida emas — baribir davom etamiz",
      { receiptIdPreview: id.slice(0, 32), len: id.length },
    );
  }
  let baseUrl: string;
  if (useTest) {
    baseUrl = `https://checkout.test.paycom.uz/${id}`;
  } else {
    const style = (Deno.env.get("PAYCOM_CHECKOUT_STYLE") || "paycom").trim().toLowerCase();
    if (style === "payme" || style === "direct") {
      console.warn(
        "[paycom] PAYCOM_CHECKOUT_STYLE=payme: payme.uz/checkout — «чек не найден» bo‘lsa paycom stiliga qayting.",
      );
      baseUrl = `https://payme.uz/checkout/${id}`;
    } else {
      baseUrl = `https://checkout.paycom.uz/${id}`;
    }
  }
  try {
    const u = new URL(baseUrl);
    u.searchParams.set("back", backHttps);
    return u.toString();
  } catch {
    return `${baseUrl}?back=${encodeURIComponent(backHttps)}`;
  }
}

/** receipts.create / receipts.get javobidan chek identifikatori (faqat receipt `_id`, order emas) */
function coercePaycomReceiptIdField(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw === "object" && raw !== null && "$oid" in (raw as object)) {
    const oid = (raw as { $oid?: unknown }).$oid;
    if (oid != null && String(oid).trim() !== "") return String(oid).trim();
  }
  return null;
}

export function extractReceiptIdFromSubscribeResult(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const rec = r.receipt;
  if (rec && typeof rec === "object" && rec !== null) {
    const o = rec as Record<string, unknown>;
    const fromUnderscore = coercePaycomReceiptIdField(o._id);
    if (fromUnderscore) return fromUnderscore;
    const fromId = coercePaycomReceiptIdField(o.id);
    if (fromId) return fromId;
  }
  const top = coercePaycomReceiptIdField(r._id) ?? coercePaycomReceiptIdField(r.id);
  return top;
}

function readSubscribeReceiptState(receipt: unknown): number | undefined {
  if (!receipt || typeof receipt !== "object") return undefined;
  const s = (receipt as { state?: unknown }).state;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Tashqi chaqiriqlar: chek havolasi + har doim to‘g‘ri `back=` */
export function buildPaycomCheckoutLink(
  receiptId: string,
  useTest: boolean,
  paycomOpts?: CreateReceiptPaycomOpts,
): string {
  const backHttps = resolveCheckoutBackUrl(paycomOpts);
  return buildSubscribeCheckoutUrl(useTest, receiptId, backHttps);
}

/** receipts.create bilan bir xil jami (tiyin) — idempotency va validatsiya uchun */
export function sumItemsTiyinForPaycom(items: PaymeReceiptItem[]): number {
  let sum = 0;
  for (const item of items) {
    const price = Math.round(Number(item.price) * 100);
    const count = Number(item.count) || 1;
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(count) || count <= 0) continue;
    sum += price * count;
  }
  return sum;
}

/** Supabase Logs — PAYCOM_DEBUG_LOG yoki PAYME_HTTP_DEBUG=true */
function paycomTrace(
  phase: "rpc.request" | "rpc.response" | "rpc.error",
  payload: Record<string, unknown>,
) {
  const verbose = paycomHttpDebug();
  if (!verbose && phase === "rpc.request") return;
  console.log(`[paycom] ${phase}`, payload);
}

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
    return `${msg} — Payme API: X-Auth rad etildi. Supabase Edge Function Secrets: PAYCOM_REGISTER_ID va PAYCOM_SECRET_PROD (yoki test uchun PAYCOM_SECRET_TEST), PAYCOM_USE_TEST mosligi.`;
  }
  if (
    m.includes('поставщик') ||
    m.includes('provider') ||
    m.includes('заблокирован') ||
    m.includes('blocked')
  ) {
    return `${msg} — Payme: ID кассы (PAYCOM_REGISTER_ID) va kalit bir xil muhitda bo‘lsin (test+test yoki prod+prod). PAYCOM_USE_TEST ni tekshiring.`;
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
        ? 'Paycom TEST: Supabase Secrets — PAYCOM_REGISTER_ID + PAYCOM_SECRET_TEST (yoki PAYME_SECRET_KEY)'
        : 'Paycom PROD: Supabase Secrets — PAYCOM_REGISTER_ID + PAYCOM_SECRET_PROD (yoki PAYME_SECRET_KEY)',
    };
  }

  const url = paycomApiUrlForMode(useTest);
  const id = nextRpcId();
  const body = { jsonrpc: '2.0' as const, id, method, params };

  const xAuth = `${auth.registerId}:${auth.secret}`;
  const orderRef =
    params.account && typeof params.account === "object" && params.account !== null &&
      "order_id" in params.account
      ? String((params.account as { order_id?: unknown }).order_id ?? "")
      : "";
  const t0 = Date.now();
  const reqShort = {
    method,
    useTest,
    order_id: orderRef || undefined,
    registerIdTail: auth.registerId.length > 4 ? `…${auth.registerId.slice(-4)}` : "?",
  };
  if (paycomHttpDebug()) {
    paycomTrace("rpc.request", { ...reqShort, ...sanitizePaycomRpcParamsForLog(method, params) });
  } else {
    console.log(`[paycom] rpc → ${method}`, reqShort);
  }

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
      paycomTrace("rpc.error", {
        method,
        ms: Date.now() - t0,
        http: res.status,
        parseError: true,
      });
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
      paycomTrace("rpc.response", {
        method,
        ms: Date.now() - t0,
        ok: false,
        order_id: orderRef || undefined,
        errPreview: String(msg).slice(0, 120),
      });
      return { success: false, error: augmentPaycomUserError(String(msg)), raw: json };
    }

    const r = json?.result;
    const idFromResult = r?.receipt?._id ?? r?.receipt?.id ?? r?.id;
    const idFromParams = params.id != null ? String(params.id) : "";
    const traceId = idFromResult != null && idFromResult !== ""
      ? String(idFromResult)
      : idFromParams;
    const traceState = typeof r?.state === "number" ? r.state : undefined;
    paycomTrace("rpc.response", {
      method,
      ms: Date.now() - t0,
      ok: true,
      order_id: orderRef || undefined,
      receiptId: traceId ? `${traceId.slice(0, 8)}…` : undefined,
      /** receipts.check / receipts.get(id) — natijada state bo‘lishi mumkin */
      state: traceState,
    });
    return { success: true, result: json.result as T };
  } catch (e) {
    paycomTrace("rpc.error", {
      method,
      ms: Date.now() - t0,
      network: e instanceof Error ? e.message : String(e),
    });
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

  const envIkpu = (Deno.env.get("PAYCOM_DEFAULT_ITEM_CODE") || "").trim();
  const envUnitsRaw = (Deno.env.get("PAYCOM_DEFAULT_UNITS") || "").trim();
  const envUnits = envUnitsRaw ? Number(envUnitsRaw) : NaN;
  const defaultUnits = Number.isFinite(envUnits) && envUnits > 0 ? envUnits : 2411;

  const detailItems = items.map((item) => {
    const code = String(item.code || envIkpu || "00000000000000000").trim();
    return {
      title: item.title,
      price: Math.round(Number(item.price) * 100),
      count: Number(item.count) || 1,
      code: code || "00000000000000000",
      units: item.units ?? defaultUnits,
      vat_percent: item.vat_percent ?? 0,
      package_code: item.package_code || "123456",
      ...(item.discount != null && item.discount > 0 ? { discount: Math.round(item.discount) } : {}),
    };
  });
  if (!envIkpu && detailItems.some((d) => d.code === "00000000000000000")) {
    console.warn(
      "[paycom] IKPU (code) nol — checkout «чек не найден» bo‘lishi mumkin. " +
        "Secret PAYCOM_DEFAULT_ITEM_CODE yoki mahsulot `code` (Soliq.uz ИКПУ).",
      { orderId },
    );
  }

  const itemsSumTiyin = detailItems.reduce((s, i) => s + i.price * i.count, 0);
  if (!Number.isFinite(itemsSumTiyin) || itemsSumTiyin <= 0) {
    return { success: false as const, error: 'Mahsulotlar summasi noto‘g‘ri (0 yoki raqam emas)' };
  }

  /** Paycom: params.amount tiyinda === detail.items yig‘indisi. Aks holda chek checkoutda «не найден» berishi mumkin. */
  const requestedTiyin = amountInTiyin;
  if (Math.abs(itemsSumTiyin - requestedTiyin) > 2) {
    return {
      success: false as const,
      error:
        `Summa va mahsulot qatorlari yig‘indisi mos emas (tiyin): yig‘indi=${itemsSumTiyin}, yuborilgan=${requestedTiyin}. ` +
        "Frontend `amount` va `items` ni qayta hisoblang.",
      raw: { itemsSumTiyin, requestedTiyin, orderId },
    };
  }
  const amountForPaycom = itemsSumTiyin;

  const orderIdNorm = String(orderId).trim();
  const params: Record<string, unknown> = {
    amount: amountForPaycom,
    account: { order_id: orderIdNorm },
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
  const rpcBase = paycomApiUrlForMode(useTest);
  console.log("PAYCOM_ENV_TRACE:", {
    useTest,
    rpcBase,
    xAuthSource: "supabase_secrets_only",
    registerIdTail: PAYCOM_REGISTER_ID ? PAYCOM_REGISTER_ID.slice(-6) : "(bo‘sh)",
    PAYCOM_USE_TEST: (Deno.env.get("PAYCOM_USE_TEST") || "").trim() || "(unset→false)",
    PAYCOM_API_URL_set: Boolean(PAYCOM_API_URL_ENV),
    amountTiyin: amountForPaycom,
    itemsSumTiyin,
    account_order_id: orderIdNorm,
  });

  const result = await makePaymeRequest<{ receipt: { _id: string; state?: number } }>(
    'receipts.create',
    params,
    { useTest, kvCredentials: paycomOpts?.kvCredentials },
  );

  if (!result.success) return result;

  const createPayload = result.result;
  try {
    console.log("CREATE RECEIPT RESPONSE:", JSON.stringify(createPayload).slice(0, 15000));
  } catch {
    console.log("CREATE RECEIPT RESPONSE:", String(createPayload).slice(0, 2000));
  }

  const receiptIdRaw = extractReceiptIdFromSubscribeResult(createPayload);
  console.log("RECEIPT_ID:", receiptIdRaw);
  if (!receiptIdRaw) {
    console.error("RECEIPT_CREATE:", { ok: false, reason: "no_receipt_id", rawKeys: createPayload && typeof createPayload === "object" ? Object.keys(createPayload as object) : [] });
    return {
      success: false as const,
      error: "Paycom receipts.create: result.receipt._id topilmadi (noto‘g‘ri maydon yoki javob shakli).",
      raw: createPayload,
    };
  }

  const receiptStub = (createPayload && typeof createPayload === "object"
    ? (createPayload as { receipt?: unknown }).receipt
    : undefined) as Record<string, unknown> | undefined;
  const createState = receiptStub ? readSubscribeReceiptState(receiptStub) : undefined;

  console.log("RECEIPT_CREATE:", {
    ok: true,
    receiptId: receiptIdRaw,
    accountOrderId: orderIdNorm,
    stateFromCreate: createState,
    amountTiyin: amountForPaycom,
    useTest,
  });

  const checkOpts = { useTest, kvCredentials: paycomOpts?.kvCredentials };
  const postCheck = await makePaymeRequest<{ state: number }>(
    "receipts.check",
    { id: String(receiptIdRaw) },
    checkOpts,
  );
  try {
    console.log(
      "CHECK RECEIPT RESPONSE (receipts.check):",
      JSON.stringify(
        postCheck.success ? postCheck.result : { error: postCheck.error, raw: postCheck.raw },
      ).slice(0, 8000),
    );
  } catch {
    console.log("CHECK RECEIPT RESPONSE (receipts.check):", postCheck.success ? postCheck.result : postCheck.error);
  }
  if (postCheck.success) {
    const pst = Number(postCheck.result?.state);
    if (pst === 4) {
      return {
        success: false as const,
        error:
          "Bu chek allaqachon to‘langan (Paycom state=4). Yangi to‘lov uchun boshqa buyurtma / chek yarating.",
        raw: { receiptId: receiptIdRaw, state: pst },
      };
    }
    console.log("[paycom] receipts.check (create keyin)", { receiptId: receiptIdRaw, state: pst });
  } else {
    console.warn("[paycom] receipts.check (create keyin) xato", postCheck.error);
  }

  /** Checkout ochilishidan oldin chek serverda mavjudligini receipts.get bilan tasdiqlaymiz */
  const postGet = await makePaymeRequest<{ receipt: unknown }>(
    "receipts.get",
    { id: String(receiptIdRaw) },
    checkOpts,
  );
  if (!postGet.success) {
    console.error("RECEIPT_CREATE:", { ok: false, phase: "receipts.get", receiptId: receiptIdRaw, error: postGet.error });
    return {
      success: false as const,
      error: `Chek yaratilgan ko‘rinadi, lekin receipts.get tasdiqlamadi: ${postGet.error}`,
      raw: postGet.raw,
    };
  }

  try {
    console.log(
      "GET RECEIPT RESPONSE (receipts.get):",
      JSON.stringify(postGet.result).slice(0, 15000),
    );
  } catch {
    console.log("GET RECEIPT RESPONSE (receipts.get):", String(postGet.result).slice(0, 2000));
  }

  const verifiedId = extractReceiptIdFromSubscribeResult(postGet.result) ?? receiptIdRaw;
  const fullReceipt = postGet.result?.receipt;
  const verifiedState = readSubscribeReceiptState(fullReceipt);

  if (verifiedState === 4) {
    return {
      success: false as const,
      error: "Bu chek allaqachon to‘langan (receipts.get state=4).",
      raw: { receiptId: verifiedId, state: verifiedState },
    };
  }
  if (verifiedState === 21 || verifiedState === 50 || verifiedState === 51) {
    return {
      success: false as const,
      error: `Chek bekor qilingan yoki yaroqsiz (receipts.get state=${verifiedState}).`,
      raw: { receiptId: verifiedId, state: verifiedState },
    };
  }

  console.log("RECEIPT_CREATE:", {
    ok: true,
    phase: "receipts.get_ok",
    receiptId: verifiedId,
    state: verifiedState,
    accountOrderId: orderIdNorm,
  });

  const checkoutUrl = buildPaycomCheckoutLink(verifiedId, useTest, paycomOpts);
  console.log("CHECKOUT_URL:", checkoutUrl);
  if (verifiedId !== receiptIdRaw) {
    console.warn("[paycom] receipts.get dan kelgan id create dan farq qildi", {
      createId: receiptIdRaw,
      getId: verifiedId,
    });
  }

  try {
    const u = new URL(checkoutUrl);
    console.log("[paycom] checkout tayyor", {
      useTest,
      host: u.hostname,
      pathReceiptId: u.pathname.split("/").filter(Boolean).pop(),
      hasBackParam: u.searchParams.has("back"),
    });
  } catch {
    /* noop */
  }

  if (useTest && paycomHttpDebug()) {
    console.log("[paycom] TEST: checkout.test.paycom.uz — prod payme.uz bilan aralashmasin.");
  }

  return {
    success: true as const,
    receiptId: verifiedId,
    checkoutUrl,
    receipt: fullReceipt ?? receiptStub,
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
