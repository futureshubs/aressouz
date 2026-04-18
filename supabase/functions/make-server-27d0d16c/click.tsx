// CLICK Payment Integration
// Hujjat: https://docs.click.uz/
//
// -1907 «Недостаточно информации от поставщика» odatda:
//   1) Click kabinetida PREPARE/COMPLETE URL noto‘g‘ri yoki ochilmayapti
//   2) CLICK_SECRET_KEY kabinetdagi kalit bilan mos emas (imzo xato → Click xato beradi)
//   3) CLICK_MERCHANT_USER_ID kabinetdagi foydalanuvchi ID dan boshqa
//   4) service_id / merchant_id boshqa xizmatga tegishli
//
// -2041 «ошибка во время оплаты» — odatda Click/bank to‘lov bosqichida; ba’zan COMPLETE dan noto‘g‘ri javob.
//   Invocations da POST /click/complete va Logs da COMPLETE qatorlarini to‘lov vaqti bilan solishtiring.
//
// Supabase Edge Function uchun to‘liq URL (o‘z project ref ingiz):
//   PREPARE:  https://<PROJECT>.supabase.co/functions/v1/make-server-27d0d16c/click/prepare
//   COMPLETE: https://<PROJECT>.supabase.co/functions/v1/make-server-27d0d16c/click/complete
//   (Ixtiyoriy, alohida funksiya — `verify_jwt` asosiy serverda yoqilganda): payment-webhooks
//   PREPARE:  https://<PROJECT>.supabase.co/functions/v1/payment-webhooks/click/prepare
//   COMPLETE: https://<PROJECT>.supabase.co/functions/v1/payment-webhooks/click/complete
//
// Supabase Dashboard → Edge Functions → make-server-27d0d16c → Secrets (nomlar aynan shunday):
//   CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_MERCHANT_USER_ID, CLICK_SECRET_KEY
//   Boshqa nom (masalan SERVICE_ID yoki "merchant user id") ishlamaydi — qarang: CLICK_SUPABASE_SECRETS.md
//   (ixtiyoriy) CLICK_DEFAULT_RETURN_URL — veb return_url yuborilmasa shu ishlatiladi
//   (ixtiyoriy) CLICK_PAY_BASE_URL — to‘liq pay URL (masalan test): https://test.click.uz/services/pay
//     Bo‘sh bo‘lsa: CLICK_USE_TEST=true yoki KV isTestMode true → test.click (yoki CLICK_FORCE_PRODUCTION → my.click)

import { Hono } from 'npm:hono';
import * as crypto from 'node:crypto';
import * as kv from './kv_store.tsx';
import {
  clickEnvWantsTestMode,
  clickForceProduction,
  coerceKvTestMode,
} from './payment-kv-utils.ts';
import { syncRelationalOrderFromLegacy } from '../_shared/db/orders.ts';

const click = new Hono();

/** `index.ts` dagi `getOrderKeys` bilan bir xil — market buyurtmalar `order:market:id` da */
function orderKvKeysForMainOrder(orderId: string): string[] {
  const raw = String(orderId || '').trim();
  if (!raw) return [];
  if (raw.startsWith('order:market:')) {
    const stripped = raw.slice('order:market:'.length);
    return [raw, `order:${stripped}`];
  }
  if (raw.startsWith('order:')) {
    const stripped = raw.slice('order:'.length);
    return [raw, `order:market:${stripped}`];
  }
  return [`order:${raw}`, `order:market:${raw}`];
}

const CLICK_SERVICE_ID = (Deno.env.get('CLICK_SERVICE_ID') || '').trim();
const CLICK_MERCHANT_ID = (Deno.env.get('CLICK_MERCHANT_ID') || '').trim();
const CLICK_SECRET_KEY = (Deno.env.get('CLICK_SECRET_KEY') || '').trim();
const CLICK_MERCHANT_USER_ID = (Deno.env.get('CLICK_MERCHANT_USER_ID') || '').trim();

function clickMissingEnvKeys(): string[] {
  const miss: string[] = [];
  if (!CLICK_SERVICE_ID) miss.push('CLICK_SERVICE_ID');
  if (!CLICK_MERCHANT_ID) miss.push('CLICK_MERCHANT_ID');
  if (!CLICK_MERCHANT_USER_ID) miss.push('CLICK_MERCHANT_USER_ID');
  if (!CLICK_SECRET_KEY) miss.push('CLICK_SECRET_KEY');
  return miss;
}

function clickInvoiceEnvError(): string | null {
  const miss = clickMissingEnvKeys();
  if (miss.length === 0) return null;
  return `Click sozlanmagan. Supabase secrets: ${miss.join(', ')}. Kabinetdagi service/merchant/user ID va maxfiy kalitni kiriting.`;
}

/**
 * To‘lov sahifasi: prod (`my.click.uz`) standart.
 * `create-invoice` / `create-card-invoice` faqat CLICK_* secretlar bilan ishlaydi — KV dagi admin
 * «test rejim» bayrog‘i prod kalitlarni test.click ga yuborib, sahifani sindirishi mumkin edi.
 * Shuning uchun secretlar to‘liq bo‘lsa, test domen faqat CLICK_USE_TEST / CLICK_TEST_MODE orqali.
 */
async function resolveClickPayBaseUrl(): Promise<string> {
  const envOverride = (Deno.env.get('CLICK_PAY_BASE_URL') || '').trim();
  if (envOverride) return envOverride.replace(/\/$/, '');
  if (clickForceProduction()) {
    return 'https://my.click.uz/services/pay';
  }
  if (clickEnvWantsTestMode()) {
    return 'https://test.click.uz/services/pay';
  }
  const envCredsComplete = clickMissingEnvKeys().length === 0;
  if (envCredsComplete) {
    return 'https://my.click.uz/services/pay';
  }
  try {
    const clickCfg = await kv.get('payment_method:click');
    if (clickCfg && coerceKvTestMode((clickCfg as { isTestMode?: unknown }).isTestMode) === true) {
      return 'https://test.click.uz/services/pay';
    }
  } catch {
    // KV xato — prod
  }
  return 'https://my.click.uz/services/pay';
}

const __clickStartupVerbose = () => {
  const v = Deno.env.get('VERBOSE_SERVER_LOG')?.trim().toLowerCase();
  const d = Deno.env.get('DEBUG_HTTP')?.trim().toLowerCase();
  return v === '1' || v === 'true' || d === '1' || d === 'true';
};

if (__clickStartupVerbose()) {
  // Modul yuklanganda `index.ts` dagi `console.*` noop bo‘lishi mumkin — faqat debug rejimida.
  console.log('🔧 CLICK Configuration loaded:');
  console.log('   Service ID:', CLICK_SERVICE_ID || '❌');
  console.log('   Merchant ID:', CLICK_MERCHANT_ID || '❌');
  console.log('   Merchant User ID:', CLICK_MERCHANT_USER_ID || '❌');
  console.log('   Secret Key:', CLICK_SECRET_KEY ? `${CLICK_SECRET_KEY.substring(0, 5)}***` : '❌ Missing');
  console.log('');
  if (clickInvoiceEnvError()) {
    console.error('⚠️ CLICK:', clickInvoiceEnvError());
  } else {
    console.log('✅ CLICK env to‘liq (invoice yaratish va imzo tekshiruvi ishlaydi)');
  }
  const base = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  if (!base) {
    console.log('📎 CLICK kabinet: PREPARE URL — SUPABASE_URL dan yig‘ib qo‘ling (.../click/prepare)');
  } else {
    const slug = 'make-server-27d0d16c';
    console.log('📎 CLICK kabinetga aynan shu manzillar (copy):');
    console.log('   PREPARE: ', `${base}/functions/v1/${slug}/click/prepare`);
    console.log('   COMPLETE:', `${base}/functions/v1/${slug}/click/complete`);
    console.log(
      '   Eslatma: «env to‘liq» faqat secretlar borligini anglatadi; -1907 Click sizning PREPARE ga muvaffaqiyatli ulanayotganini emas. Invocations’da POST /click/prepare qidiring.',
    );
  }
}

/** Click server odatda form-urlencoded yuboradi; JSON / multipart ham bo‘lishi mumkin */
async function parseClickPostBody(c: {
  req: {
    header: (n: string) => string | undefined;
    text: () => Promise<string>;
    formData: () => Promise<FormData>;
  };
}): Promise<Record<string, string>> {
  const ct = (c.req.header('content-type') || '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    const fd = await c.req.formData();
    const out: Record<string, string> = {};
    fd.forEach((v, k) => {
      out[k] = typeof v === 'string' ? v : '';
    });
    return out;
  }
  const raw = await c.req.text();
  if (!raw?.trim()) return {};
  const t = raw.trim();
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(j).map(([k, v]) => [k, v == null ? '' : String(v)]),
      );
    } catch {
      return {};
    }
  }
  const out: Record<string, string> = {};
  new URLSearchParams(t).forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

/** Oddiy Click: `click_order:`; Click Card: `click_card:` — ilgari faqat birinchi qidirilgan, card oqimi PREPARE da «order topilmadi» berardi. */
async function resolvePendingClickOrder(
  orderId: string,
): Promise<{ storageKey: string; order: Record<string, unknown> } | null> {
  const k1 = `click_order:${orderId}`;
  const o1 = await kv.get(k1);
  if (o1 && typeof o1 === 'object') return { storageKey: k1, order: o1 as Record<string, unknown> };
  const k2 = `click_card:${orderId}`;
  const o2 = await kv.get(k2);
  if (o2 && typeof o2 === 'object') return { storageKey: k2, order: o2 as Record<string, unknown> };
  return null;
}

/** KVda so‘m yoki tiyin; Click prepare `amount` odatda tiyinda */
function clickAmountMatches(stored: number, received: number): boolean {
  if (!Number.isFinite(stored) || !Number.isFinite(received)) return false;
  if (Math.abs(stored - received) < 1) return true;
  if (Math.abs(Math.round(stored * 100) - received) < 1) return true;
  if (Math.abs(stored - received / 100) < 0.01) return true;
  return false;
}

/** Imzo qatorida service_id — Click POST tanasidagi qiymat bo‘lishi kerak (env bilan farq qilsa imzo yiqiladi). */
function serviceIdForSign(params: Record<string, any>): string {
  const fromReq = String(params.service_id ?? '').trim();
  return fromReq || CLICK_SERVICE_ID;
}

// Helper: Generate MD5 hash for CLICK signature
// Prepare (action 0): click_trans_id + service_id + secret + merchant_trans_id + amount + action + sign_time
// Complete (action 1): ... + merchant_prepare_id + ...
// github.com/yetimdasturchi/clickuz-tester bilan bir xil ketma-ketlik
function generateClickSign(params: Record<string, any>): string {
  const action = String(params.action ?? '0');
  const merchantPreparePart = action === '1' ? String(params.merchant_prepare_id ?? '') : '';
  const sid = serviceIdForSign(params);
  const signString =
    `${params.click_trans_id ?? ''}` +
    `${sid}` +
    `${CLICK_SECRET_KEY}` +
    `${params.merchant_trans_id ?? ''}` +
    merchantPreparePart +
    `${params.amount ?? '0'}` +
    action +
    `${params.sign_time ?? ''}`;

  return crypto.createHash('md5').update(signString, 'utf8').digest('hex');
}

// Helper: Validate CLICK signature
function validateClickSign(params: Record<string, any>): boolean {
  const expectedSign = generateClickSign(params);
  const got = String(params.sign_string || '').toLowerCase();
  return got === expectedSign.toLowerCase();
}

/** Faqat raqamlar; uzunligi Number.MAX_SAFE_INTEGER dan oshmasin (Click/JS tomonda aniqlik). */
function newMerchantSideId(): string {
  return `${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
}

function logClickSignMismatch(kind: string, params: Record<string, any>): void {
  const expected = generateClickSign(params);
  const got = String(params.sign_string || '').toLowerCase();
  console.error(`❌ CLICK ${kind}: imzo mos emas`, {
    signMatch: got === expected.toLowerCase(),
    signReceived: got.slice(0, 16) + '…',
    signExpected: expected.toLowerCase().slice(0, 16) + '…',
    service_id_in_body: params.service_id,
    service_id_used: serviceIdForSign(params),
    env_service_id: CLICK_SERVICE_ID,
    action: params.action,
    amount_raw: params.amount,
    merchant_trans_id: params.merchant_trans_id,
  });
}

// 1. Create payment link (for CLICK button)
click.post('/create-invoice', async (c) => {
  try {
    const envErr = clickInvoiceEnvError();
    if (envErr) {
      console.error('❌ CLICK create-invoice:', envErr);
      return c.json({ error: envErr, code: 'CLICK_ENV_INCOMPLETE' }, 503);
    }

    const { amount, orderId, phone, returnUrl } = await c.req.json();

    if (!amount || !orderId) {
      return c.json({ error: 'Amount and orderId required' }, 400);
    }

    const amountSom = Number(amount);
    if (!Number.isFinite(amountSom) || amountSom <= 0) {
      return c.json({ error: 'Invalid amount' }, 400);
    }

    console.log('💳 Creating CLICK invoice:', { amountSom, orderId, phone });

    // Store amount in so'm; prepare callback Click tiyin yuborsa `clickAmountMatches` moslashtiradi
    await kv.set(`click_order:${orderId}`, {
      orderId,
      amount: amountSom,
      phone: phone || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    const payBase = await resolveClickPayBaseUrl();
    console.log('💳 CLICK pay base:', payBase);
    const paymentUrl = new URL(payBase);
    paymentUrl.searchParams.set('service_id', CLICK_SERVICE_ID);
    paymentUrl.searchParams.set('merchant_id', CLICK_MERCHANT_ID);
    paymentUrl.searchParams.set('merchant_user_id', CLICK_MERCHANT_USER_ID); // REQUIRED!
    paymentUrl.searchParams.set('amount', String(amountSom));
    paymentUrl.searchParams.set('transaction_param', orderId);

    const returnTrim = String(returnUrl || '').trim();
    const defaultReturn = (Deno.env.get('CLICK_DEFAULT_RETURN_URL') || '').trim();
    if (returnTrim) {
      paymentUrl.searchParams.set('return_url', returnTrim);
    } else if (defaultReturn) {
      paymentUrl.searchParams.set('return_url', defaultReturn);
    }

    console.log('✅ CLICK invoice created:');
    console.log('   Service ID:', CLICK_SERVICE_ID);
    console.log('   Merchant ID:', CLICK_MERCHANT_ID);
    console.log('   Merchant User ID:', CLICK_MERCHANT_USER_ID);
    console.log('   Amount (so\'m):', amountSom);
    console.log('   Order ID:', orderId);
    console.log('   URL:', paymentUrl.toString());

    return c.json({
      success: true,
      paymentUrl: paymentUrl.toString(),
      orderId,
    });
  } catch (error) {
    console.error('❌ CLICK invoice error:', error);
    return c.json({ error: 'Failed to create invoice', details: String(error) }, 500);
  }
});

// 2. PREPARE endpoint (CLICK calls this before payment)
click.post('/prepare', async (c) => {
  try {
    const params = await parseClickPostBody(c);

    console.log('📥 CLICK PREPARE request:', JSON.stringify(params, null, 2));

    // Validate signature
    if (!validateClickSign(params)) {
      logClickSignMismatch('PREPARE', params);
      return c.json({
        error: -1,
        error_note: 'Invalid signature',
      });
    }

    const orderId = String(params.merchant_trans_id || '').trim();
    const amount = parseFloat(String(params.amount));

    if (!orderId) {
      console.error('❌ PREPARE: merchant_trans_id bo‘sh');
      return c.json({ error: -5, error_note: 'Order not found' });
    }

    const resolved = await resolvePendingClickOrder(orderId);
    if (!resolved) {
      console.error(
        '❌ Order not found (KV):',
        orderId,
        '— create-invoice / create-card-invoice shu orderId bilan chaqirilganmi?',
      );
      return c.json({
        error: -5,
        error_note: 'Order not found',
      });
    }
    const { storageKey, order: orderRaw } = resolved;
    const order = orderRaw;

    const storedAmt = parseFloat(String(order.amount));
    if (!clickAmountMatches(storedAmt, amount)) {
      console.error('❌ Amount mismatch:', { expected: order.amount, received: amount });
      return c.json({
        error: -2,
        error_note: 'Incorrect parameter amount',
      });
    }

    // Check if already paid
    if (order.status === 'paid') {
      console.error('❌ Already paid:', orderId);
      return c.json({
        error: -4,
        error_note: 'Already paid',
      });
    }

    const prepareIdStr = newMerchantSideId();
    await kv.set(storageKey, {
      ...order,
      status: 'prepared',
      clickTransId: params.click_trans_id,
      preparedAt: new Date().toISOString(),
      merchantPrepareId: prepareIdStr,
    });

    console.log('✅ PREPARE successful:', orderId, 'merchant_prepare_id:', prepareIdStr);

    // ID larni string qaytarish — ba’zi Click versiyalari raqam/json tipiga sezgir
    return c.json({
      error: 0,
      error_note: 'Success',
      click_trans_id: String(params.click_trans_id ?? ''),
      merchant_trans_id: orderId,
      merchant_prepare_id: prepareIdStr,
    });
  } catch (error) {
    console.error('❌ PREPARE error:', error);
    return c.json({
      error: -9,
      error_note: 'System error: ' + String(error),
    });
  }
});

// 3. COMPLETE endpoint (CLICK calls this after successful payment)
click.post('/complete', async (c) => {
  try {
    const params = await parseClickPostBody(c);

    console.log('📥 CLICK COMPLETE request:', JSON.stringify(params, null, 2));

    // Validate signature
    if (!validateClickSign(params)) {
      logClickSignMismatch('COMPLETE', params);
      return c.json({
        error: -1,
        error_note: 'Invalid signature',
      });
    }

    const orderId = String(params.merchant_trans_id || '').trim();
    const amount = parseFloat(String(params.amount));

    const resolvedC = await resolvePendingClickOrder(orderId);
    if (!resolvedC) {
      console.error('❌ Order not found (COMPLETE):', orderId);
      return c.json({
        error: -5,
        error_note: 'Order not found',
      });
    }
    const { storageKey: storageKeyC, order: orderCRaw } = resolvedC;
    const order = orderCRaw;

    const storedAmtComplete = parseFloat(String(order.amount));
    if (!clickAmountMatches(storedAmtComplete, amount)) {
      console.error('❌ Amount mismatch:', { expected: order.amount, received: amount });
      return c.json({
        error: -2,
        error_note: 'Incorrect parameter amount',
      });
    }

    // Check if already completed
    if (order.status === 'paid') {
      console.log('⚠️ Already completed:', orderId);
      const mc = order.merchantConfirmId != null ? String(order.merchantConfirmId) : newMerchantSideId();
      return c.json({
        error: 0,
        error_note: 'Success',
        click_trans_id: String(params.click_trans_id ?? ''),
        merchant_trans_id: orderId,
        merchant_confirm_id: mc,
      });
    }

    // Check if not prepared (action should be 1 for complete)
    if (String(params.action) !== '1') {
      console.error('❌ Invalid action:', params.action);
      return c.json({
        error: -3,
        error_note: 'Action not found',
      });
    }

    const prepFromClick = String(params.merchant_prepare_id ?? '').trim();
    const prepStored =
      order.merchantPrepareId != null && order.merchantPrepareId !== ''
        ? String(order.merchantPrepareId).trim()
        : '';
    if (prepStored && prepFromClick && prepFromClick !== prepStored) {
      console.error('❌ COMPLETE merchant_prepare_id mos emas', {
        fromClick: prepFromClick,
        stored: prepStored,
        orderId,
      });
      return c.json({
        error: -8,
        error_note: 'Invalid merchant_prepare_id',
      });
    }

    // Mark as paid
    const merchantConfirmId = newMerchantSideId();
    const paidAtIso = new Date().toISOString();
    await kv.set(storageKeyC, {
      ...order,
      status: 'paid',
      clickTransId: params.click_trans_id,
      merchantConfirmId,
      paidAt: paidAtIso,
      error: params.error || 0,
    });

    const txRecord = await kv.get(`transaction:${orderId}`);
    if (txRecord && typeof txRecord === 'object') {
      await kv.set(`transaction:${orderId}`, {
        ...(txRecord as Record<string, unknown>),
        status: 'paid',
        paidAt: paidAtIso,
      });
    }

    const purpose = String((order as { purpose?: string }).purpose || '');
    if (purpose === 'listing_fee') {
      const uId = (order as { listingFeeUserId?: string }).listingFeeUserId;
      const pNorm = (order as { listingFeePhoneNorm?: string }).listingFeePhoneNorm;
      const amt = parseFloat(String(order.amount));
      if (uId && pNorm) {
        await kv.set(`listing_fee_credit:${orderId}`, {
          userId: String(uId),
          phoneNorm: String(pNorm),
          amount: Number.isFinite(amt) ? amt : 0,
          paidAt: paidAtIso,
        });
        console.log('✅ Listing fee credit granted:', orderId);
      }
    }

    // Update main order (shop `order:id` va market `order:market:id`)
    let syncedMain: Record<string, unknown> | null = null;
    for (const orderKey of orderKvKeysForMainOrder(orderId)) {
      const mainOrder = await kv.get(orderKey);
      if (mainOrder && typeof mainOrder === 'object') {
        const mo = mainOrder as Record<string, unknown>;
        const hist = Array.isArray(mo.statusHistory) ? [...(mo.statusHistory as unknown[])] : [];
        const prevPaid = ['paid', 'completed', 'success'].includes(
          String(mo.paymentStatus || '').toLowerCase().trim(),
        );
        if (!prevPaid) {
          hist.push({
            status: mo.status,
            timestamp: paidAtIso,
            note: 'Onlayn to‘lov tasdiqlandi (Click)',
          });
        }
        syncedMain = {
          ...mo,
          paymentStatus: 'paid',
          paymentCompletedAt: paidAtIso,
          paymentRequiresVerification: false,
          clickTransId: params.click_trans_id,
          paidAt: paidAtIso,
          updatedAt: paidAtIso,
          statusHistory: hist,
        };
        await kv.set(orderKey, syncedMain);
        break;
      }
    }
    if (syncedMain) {
      await syncRelationalOrderFromLegacy({
        legacyOrderId: String(syncedMain.id ?? orderId),
        kvStatus: String(syncedMain.status ?? ''),
        kvPaymentStatus: 'paid',
        paymentRequiresVerification: false,
      });
    }

    console.log('✅ COMPLETE successful:', orderId);

    return c.json({
      error: 0,
      error_note: 'Success',
      click_trans_id: String(params.click_trans_id ?? ''),
      merchant_trans_id: orderId,
      merchant_confirm_id: merchantConfirmId,
    });
  } catch (error) {
    console.error('❌ COMPLETE error:', error);
    return c.json({
      error: -9,
      error_note: 'System error: ' + String(error),
    });
  }
});

// 4. Check payment status
click.get('/status/:orderId', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    
    console.log('🔍 Checking payment status for orderId:', orderId);
    
    if (!orderId) {
      console.error('❌ OrderId not provided');
      return c.json({ 
        success: false,
        error: 'OrderId majburiy' 
      }, 400);
    }

    const resolved = await resolvePendingClickOrder(orderId);
    if (!resolved) {
      console.log('⚠️ Order not found in CLICK records:', orderId);
      return c.json({
        success: false,
        error: 'To\'lov topilmadi',
        orderId,
        status: 'not_found',
      }, 404);
    }
    const order = resolved.order;

    console.log('✅ Order found:', {
      orderId: order.orderId,
      status: order.status,
      amount: order.amount,
    });

    return c.json({
      success: true,
      orderId,
      status: order.status,
      amount: order.amount,
      clickTransId: order.clickTransId || null,
      paidAt: order.paidAt || null,
    });
  } catch (error: any) {
    console.error('❌ Status check error:', error);
    return c.json({ 
      success: false,
      error: 'Status tekshirishda xatolik', 
      details: error.message 
    }, 500);
  }
});

// 5. Create card payment link (for CLICK Pay by Card)
click.post('/create-card-invoice', async (c) => {
  try {
    const envErr = clickInvoiceEnvError();
    if (envErr) {
      console.error('❌ CLICK create-card-invoice:', envErr);
      return c.json({ error: envErr, code: 'CLICK_ENV_INCOMPLETE' }, 503);
    }

    const { amount, orderId, description, returnUrl } = await c.req.json();

    if (!amount || !orderId) {
      return c.json({ error: 'Amount and orderId required' }, 400);
    }

    const amountSom = Number(amount);
    if (!Number.isFinite(amountSom) || amountSom <= 0) {
      return c.json({ error: 'Invalid amount' }, 400);
    }

    // Store order info
    await kv.set(`click_card:${orderId}`, {
      orderId,
      amount: amountSom,
      description: description || 'Payment',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // CLICK Pay by Card — xuddi shu pay domeni (test/prod)
    const payBaseCard = await resolveClickPayBaseUrl();
    const paymentUrl = new URL(payBaseCard);
    paymentUrl.searchParams.set('service_id', CLICK_SERVICE_ID);
    paymentUrl.searchParams.set('merchant_id', CLICK_MERCHANT_ID);
    paymentUrl.searchParams.set('merchant_user_id', CLICK_MERCHANT_USER_ID);
    paymentUrl.searchParams.set('amount', String(amountSom));
    paymentUrl.searchParams.set('transaction_param', orderId);

    const returnTrimCard = String(returnUrl || '').trim();
    const defaultReturnCard = (Deno.env.get('CLICK_DEFAULT_RETURN_URL') || '').trim();
    if (returnTrimCard) {
      paymentUrl.searchParams.set('return_url', returnTrimCard);
    } else if (defaultReturnCard) {
      paymentUrl.searchParams.set('return_url', defaultReturnCard);
    }

    console.log('✅ CLICK card invoice created:', { orderId, amountSom, url: paymentUrl.toString() });

    return c.json({
      success: true,
      paymentUrl: paymentUrl.toString(),
      orderId,
    });
  } catch (error) {
    console.error('❌ CLICK card invoice error:', error);
    return c.json({ error: 'Failed to create card invoice', details: String(error) }, 500);
  }
});

/** Bir yo‘la tekshirish: JWT yoqilgan bo‘lsa Bearer anon kerak. */
click.get('/ping', async (c) => {
  const missing = clickMissingEnvKeys();
  const base = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const slug = 'make-server-27d0d16c';
  const prepareUrl = base ? `${base}/functions/v1/${slug}/click/prepare` : null;
  const completeUrl = base ? `${base}/functions/v1/${slug}/click/complete` : null;
  const sk = CLICK_SECRET_KEY;
  const payBase = await resolveClickPayBaseUrl();
  return c.json({
    ok: true,
    env: {
      allSet: missing.length === 0,
      missing,
    },
    deployed: {
      serviceId: CLICK_SERVICE_ID || null,
      merchantId: CLICK_MERCHANT_ID || null,
      merchantUserId: CLICK_MERCHANT_USER_ID || null,
      secretKeyPrefix: sk ? `${sk.substring(0, Math.min(5, sk.length))}***` : null,
      payBaseUrl: payBase,
    },
    urls: { preparePost: prepareUrl, completePost: completeUrl },
    hints: {
      jwt:
        'Agar Click to‘lovda -1907 bo‘lsa: Supabase da shu funksiya uchun JWT o‘chirilganmi tekshiring — Click PREPARE da Bearer yubormaydi.',
      prepare401:
        'Invocations da POST /click/prepare status 401 bo‘lsa, verify_jwt o‘chiring (Dashboard yoki supabase/config.toml + deploy).',
    },
    message:
      'Kabinetdagi ID lar bilan solishtiring. PREPARE/COMPLETE faqat POST; pay sahifasi payBaseUrl da.',
  });
});

export default click;