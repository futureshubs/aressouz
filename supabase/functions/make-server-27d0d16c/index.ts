import { Hono, type Context } from "npm:hono";
// import { cors } from "npm:hono/cors"; // replaced with manual headers to avoid runtime boot errors
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as r2 from "./r2-storage.tsx";
import * as eskiz from "./eskiz-sms.tsx";
import * as houseSeed from "./house-seed.tsx";
import * as carSeed from "./car-seed.tsx";
import * as telegram from "./telegram.tsx";
import restaurantRoutes from "./restaurants.tsx";
import rentalRoutes from "./rentals.tsx";
import auctionRoutes from "./auction.tsx";
import bonusRoutes, { deductBonusForOrderPurchase, getUserBonusData } from "./bonus.tsx";
import bannerRoutes from "./banners.tsx";
import * as aresso from "./aresso.tsx";
import * as businessHours from "./businessHours.ts";
import clickRoutes from "./click.tsx";
import {
  buildPaycomCheckoutLink,
  cancelReceipt as paymeCancelReceipt,
  checkReceipt as paymeCheckReceipt,
  createReceipt as paymeCreateReceipt,
  getReceipt as paymeGetReceipt,
  isPaymeConfigured,
  isPaymeConfiguredForMode,
  parsePaycomHttpsBackUrl,
  paycomDefaultUseTest,
  resolvePaycomUseTestForPayme,
  sendReceipt as paymeSendReceipt,
  sumItemsTiyinForPaycom,
  type PaymeReceiptItem,
} from "./payme.tsx";
import {
  clearPaycomOrderPending,
  resolvePaycomCreateIdempotency,
  savePaycomOrderPending,
} from "./paycom-idempotency.ts";
import {
  coerceKvTestMode,
  normalizeKvTestModeForSave,
  resolveClickIsTestForInvoice,
} from "./payment-kv-utils.ts";

async function paycomCallOptsForReceiptId(receiptId: string) {
  try {
    const meta = (await kv.get(`paycom_receipt:${receiptId}`)) as { useTest?: boolean } | null;
    return typeof meta?.useTest === "boolean" ? { useTest: meta.useTest } : undefined;
  } catch (e) {
    console.error("[paycom] paycom_receipt KV o‘qilmadi, PAYCOM_USE_TEST ishlatiladi:", e);
    return undefined;
  }
}

async function paycomCallOptsForReceiptIdWithKv(receiptId: string) {
  const fromReceipt = await paycomCallOptsForReceiptId(receiptId);
  const useTest =
    typeof fromReceipt?.useTest === "boolean"
      ? fromReceipt.useTest
      : paycomDefaultUseTest();
  return { useTest };
}

const paymeCheckoutOrderKvKey = (orderId: string) =>
  `payme_checkout_order:${String(orderId).trim()}`;

function logPaymeHttp(tag: string, raw: Record<string, unknown>) {
  console.log(`[payme/http] ${tag}`, {
    orderId: raw.orderId,
    amount: raw.amount,
    itemsCount: Array.isArray(raw.items) ? raw.items.length : 0,
    phone: raw.phone ? "[set]" : undefined,
    returnUrlPreview:
      typeof raw.returnUrl === "string" ? String(raw.returnUrl).slice(0, 80) : undefined,
  });
}

import * as atmos from "./atmos.tsx";
import preparersRoutes from "./preparers.tsx";
import twoFactorRoutes from "./twoFactor.tsx";
import {
  assertBranch2FANotLocked,
  branchRequiresTwoFactor,
  clearBranch2FALoginLockout,
  getBranch2FALockoutMeta,
  recordBranch2FALoginFailure,
  verifyBranchTwoFactorLogin,
} from "./twoFactor.tsx";
import relationalRoutes from "./relational-routes.ts";
import { createCourierBagStore } from "./courier-bags-db.ts";
import { syncRelationalOrderFromLegacy } from "../_shared/db/orders.ts";
import {
  normalizeBranchId,
  mapMethodToUI,
  mapOrderToPaymentUIStatus,
  resolveOrderOperationalStatus,
  pickQrImage,
  resolveCreatedTimestamp,
  computeCashierAmount,
  extractRestaurantIdFromOrder,
  toIsoSafe,
  toIsoSafeOrNow,
} from "./services/payments-logic.ts";
import {
  DEFAULT_MARKET_CATALOGS,
  MARKET_CATALOG_SEED_FLAG,
  MARKET_CATALOG_SEED_VERSION,
  MARKET_CATALOG_SEED_VERSION_KEY,
  mergeMarketCatalogTrees,
} from "./market-catalog-seeds.ts";
import {
  clampPlatformCommissionPercent,
  isPlatformCommissionRequired,
  validateVariantCommissionsForSave,
} from "./platform-commission.ts";

const app = new Hono();

// Supabase invokes this function with the path AFTER /functions/v1/{slug}/ (e.g. /courier-bags).
// Ba'zan to'liq yo'l keladi: /functions/v1/make-server-27d0d16c/community/... — noto'g'ri qo'shish 404 beradi.
// Barcha route'lar /make-server-27d0d16c/... ostida.
app.use("*", async (c, next) => {
  const p = c.req.path;
  // For CORS preflight OPTIONS, don't rewrite/forward the request.
  // Some Supabase routing edge-cases can make `c.req.path` differ, which may lead to recursion/boot failures.
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }
  const marker = "/make-server-27d0d16c";
  let normalized = p;
  if (p.startsWith(marker)) {
    normalized = p;
  } else {
    const idx = p.indexOf(marker);
    if (idx !== -1) {
      normalized = p.slice(idx);
    } else {
      normalized = p === "/" ? marker : `${marker}${p}`;
    }
  }
  if (normalized !== p) {
    const u = new URL(c.req.url);
    u.pathname = normalized;
    return app.fetch(new Request(u.toString(), c.req.raw));
  }
  try {
    await next();
  } catch (error: any) {
    console.error("Auth gate next() error:", error);
    return c.json(
      { success: false, code: "NEXT_ERROR", error: error?.message || String(error) },
      500,
    );
  }
});

// (preflight OPTIONS is handled earlier via CORS middleware + explicit options handler below)

// Log environment variables on startup
console.log('\n🚀 ===== SERVER STARTING v2.1 =====');
console.log('⏰ Server Start Time:', new Date().toISOString());
console.log('🔧 Environment Variables:');
console.log('  SUPABASE_URL:', Deno.env.get('SUPABASE_URL'));
console.log('  SUPABASE_SERVICE_ROLE_KEY exists:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
console.log('  SUPABASE_ANON_KEY exists:', !!Deno.env.get('SUPABASE_ANON_KEY'));
console.log('📦 R2 Configuration:');
console.log('  R2_ACCOUNT_ID:', Deno.env.get('R2_ACCOUNT_ID') ? '✅ SET' : '❌ MISSING');
console.log('  R2_ACCESS_KEY_ID:', Deno.env.get('R2_ACCESS_KEY_ID') ? '✅ SET' : '❌ MISSING');
console.log('  R2_SECRET_ACCESS_KEY:', Deno.env.get('R2_SECRET_ACCESS_KEY') ? '✅ SET' : '❌ MISSING');
console.log('  R2_BUCKET_NAME:', Deno.env.get('R2_BUCKET_NAME') || 'online-shop-images');
console.log('📢 Features:');
console.log('  ✅ Banner System');
console.log('  ✅ Restaurant System');
console.log('  ✅ Rentals System');
console.log('  ✅ Auction System');
console.log('  ✅ Bonus System');
console.log('🚀 ==========================================================\n');

// Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const courierBagDb = createCourierBagStore(supabase);

// Enable logger
app.use('*', logger(console.log));

// Authentication gate (SaaS-grade): require some auth on protected endpoints.
// NOTE: Detailed authorization is still enforced per-route (admin/user/branch/courier tokens).
app.use("*", async (c, next) => {
  const path = c.req.path;
  const method = c.req.method;

  // Always allow CORS preflight
  if (method === "OPTIONS") {
    await next();
    return;
  }

  // Public endpoints (no auth required)
  const publicPrefixes = [
    "/make-server-27d0d16c/health",
    "/make-server-27d0d16c/test-deployment",
    "/make-server-27d0d16c/public/",
    "/make-server-27d0d16c/payment-methods",
    "/make-server-27d0d16c/auth/",
    "/make-server-27d0d16c/branch/session",
    "/make-server-27d0d16c/courier/login",
    "/make-server-27d0d16c/click",
    "/make-server-27d0d16c/payme",
    "/make-server-27d0d16c/atmos",
  ];

  const isPublic = publicPrefixes.some((p) => path === p || path.startsWith(p));
  if (isPublic) {
    await next();
    return;
  }

  const hasAnyAuthHeader = Boolean(
    c.req.header("Authorization") ||
      c.req.header("authorization") ||
      c.req.header("X-Access-Token") ||
      c.req.header("x-access-token") ||
      c.req.header("X-Branch-Token") ||
      c.req.header("x-branch-token") ||
      c.req.header("X-Admin-Code") ||
      c.req.header("x-admin-code") ||
      c.req.header("X-Courier-Token") ||
      c.req.header("x-courier-token") ||
      c.req.header("X-Seller-Token") ||
      c.req.header("x-seller-token") ||
      c.req.header("X-Accountant-Token") ||
      c.req.header("x-accountant-token"),
  );

  if (!hasAnyAuthHeader) {
    // Allow courier endpoints authenticated via `?token=...` query param.
    // This helps avoid CORS preflight issues for Authorization/custom headers.
    const isCourierPath = path.includes("/courier/");
    const queryToken = c.req.query("token");
    if (isCourierPath && queryToken) {
      await next();
      return;
    }

    return c.json(
      { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
      401,
    );
  }

  await next();
});

// Enable CORS for all routes.
// Using `hono/cors` here appears to trigger runtime boot errors when Authorization headers are present.
// Minimal manual CORS headers keep the server stable and still satisfy browser CORS requirements.
app.use("/*", async (c, next) => {
  await next();
  // Always allow from any origin (frontend is not sending credentials).
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  c.res.headers.set(
    "Access-Control-Allow-Headers",
    [
      "Content-Type",
      "Authorization",
      "X-Access-Token",
      "x-access-token",
      "X-Seller-Token",
      "x-seller-token",
      "X-Courier-Token",
      "x-courier-token",
      "X-Admin-Code",
      "x-admin-code",
      "X-Admin-Session",
      "x-admin-session",
      "X-Admin-Login-Token",
      "x-admin-login-token",
      "X-Admin-Device-Id",
      "x-admin-device-id",
      "X-Branch-Token",
      "x-branch-token",
      "X-Branch-Supabase-Jwt",
      "x-branch-supabase-jwt",
      "X-Accountant-Token",
      "x-accountant-token",
      "X-Request-ID",
      "x-request-id",
      "apikey",
    ].join(", "),
  );
  c.res.headers.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Type, X-Request-ID",
  );
  c.res.headers.set("Access-Control-Max-Age", "600");
});

// Log all incoming requests for debugging
app.use('*', async (c, next) => {
  console.log('\n🔥 ==== NEW REQUEST ====');
  console.log('📍 Method:', c.req.method);
  console.log('📍 Path:', c.req.path);
  console.log('📍 URL:', c.req.url);
  
  // Log headers for OPTIONS and POST requests
  if (c.req.method === 'OPTIONS' || c.req.method === 'POST') {
    const allHeaders: Record<string, string> = {};
    c.req.raw.headers.forEach((value: string, key: string) => {
      allHeaders[key] = value;
    });
    console.log('📋 Request Headers:', JSON.stringify(allHeaders, null, 2));
  }
  
  console.log('🔥 ====================\n');
  await next();
});

// Handle OPTIONS requests (CORS preflight)
app.options('*', (c) => {
  console.log('✅ OPTIONS request handled');
  return c.text('OK', 200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Token, x-access-token, X-Seller-Token, x-seller-token, X-Courier-Token, x-courier-token, X-Admin-Code, x-admin-code, X-Admin-Session, x-admin-session, X-Admin-Login-Token, x-admin-login-token, X-Admin-Device-Id, x-admin-device-id, X-Request-ID, x-request-id, X-Branch-Token, x-branch-token, X-Branch-Supabase-Jwt, x-branch-supabase-jwt, X-Accountant-Token, x-accountant-token, apikey',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, X-Request-ID',
    'Access-Control-Max-Age': '600',
  });
});

// ==================== HELPER FUNCTIONS ====================

// Extract and validate access token from custom header or Authorization header
async function validateAccessToken(c: any, formData?: FormData) {
  console.log('🔐 ===== validateAccessToken START =====');
  console.log('📍 Request URL:', c.req.url);
  console.log('📍 Request Method:', c.req.method);
  
  // Get all headers for debugging
  const allHeaders: Record<string, string> = {};
  c.req.raw.headers.forEach((value: string, key: string) => {
    allHeaders[key] = value;
  });
  console.log('📋 All Request Headers:', JSON.stringify(allHeaders, null, 2));
  
  // Try multiple ways to get the token - Hono headers are case-insensitive but let's be extra safe
  let customToken = c.req.header('X-Access-Token') || 
                    c.req.header('x-access-token') ||
                    c.req.raw.headers.get('X-Access-Token') ||
                    c.req.raw.headers.get('x-access-token');
  
  let authHeader = c.req.header('Authorization') || 
                   c.req.header('authorization') ||
                   c.req.raw.headers.get('Authorization') ||
                   c.req.raw.headers.get('authorization');
  
  // Extract token from Authorization header if present
  let authToken = null;
  if (authHeader) {
    // Handle "Bearer TOKEN" format
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      authToken = parts[1];
    } else if (parts.length === 1) {
      // Handle direct token without "Bearer" prefix
      authToken = parts[0];
    }
  }
  
  // Try FormData as fallback (for multipart/form-data requests)
  let formToken = null;
  if (formData) {
    formToken = formData.get('accessToken');
    if (formToken && typeof formToken === 'string') {
      console.log('🔑 Found token in FormData:', formToken.substring(0, 20) + '...');
    }
  }
  
  const accessToken = customToken || authToken || formToken;
  
  console.log('🔑 Custom Token (X-Access-Token):', customToken ? `${customToken.substring(0, 20)}...` : 'MISSING');
  console.log('🔑 Auth Header:', authHeader ? `${authHeader.substring(0, 30)}...` : 'MISSING');
  console.log('���� Extracted Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
  
  if (!accessToken) {
    console.log('❌ No access token found');
    console.log('🔐 ===== validateAccessToken END (FAILED) =====\n');
    return { success: false, error: 'Avtorizatsiya kerak. Iltimos, tizimga kiring.', userId: null };
  }

  // First, try to validate with custom access token in KV
  console.log('🔍 Checking KV store for custom token...');
  console.log('🔑 KV key will be:', `access_token:${accessToken}`);
  
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  
  const customTokenData = await kv.get(`access_token:${accessToken}`);
  
  if (!customTokenData) {
    console.log('⚠️ Token not found in KV store');
    // Debug: Query database directly to list all access tokens
    try {
      const { data: allTokensData, error: queryError } = await supabaseClient
        .from('kv_store_27d0d16c')
        .select('key, value')
        .like('key', 'access_token:%')
        .limit(10);
      
      console.log('📋 Sample access tokens in database:', allTokensData?.length || 0);
      if (queryError) {
        console.error('❌ Error querying tokens:', queryError);
      }
      if (allTokensData && allTokensData.length > 0) {
        allTokensData.forEach((item: any, index: number) => {
          const tokenFromKey = item.key.replace('access_token:', '');
          console.log(`  Token ${index + 1}:`, {
            keyPreview: item.key.substring(0, 30) + '...',
            tokenPreview: tokenFromKey.substring(0, 30) + '...',
            fullTokenLength: tokenFromKey.length,
            providedTokenLength: accessToken.length,
            tokensMatch: tokenFromKey === accessToken ? '✅ MATCH!' : '❌ NO MATCH',
            userId: item.value?.userId,
            phone: item.value?.phone,
            expiresAt: item.value?.expiresAt ? new Date(item.value.expiresAt).toISOString() : 'N/A'
          });
        });
        
        // Try to find exact match
        const exactMatch = allTokensData.find((item: any) => {
          const tokenFromKey = item.key.replace('access_token:', '');
          return tokenFromKey === accessToken;
        });
        
        if (exactMatch) {
          console.log('✅ FOUND EXACT MATCH IN DATABASE BUT KV.GET FAILED');
          console.log('✅ Using token from database directly');
          
          // Use the token data from database
          if (Date.now() > exactMatch.value?.expiresAt) {
            console.log('❌ Token expired');
            console.log('🔐 ===== validateAccessToken END (EXPIRED) =====\n');
            return { success: false, error: 'Token muddati tugagan', userId: null };
          }
          
          console.log('✅ Token valid, userId:', exactMatch.value?.userId);
          console.log('🔐 ===== validateAccessToken END (SUCCESS) =====\n');
          return { success: true, userId: exactMatch.value?.userId, error: null };
        }
      } else {
        console.log('  No tokens found in database!');
      }
    } catch (err) {
      console.error('Error listing tokens:', err);
    }
  }
  
  if (customTokenData) {
    console.log('✅ Custom token found in KV store:', customTokenData);
    // Custom token found - check expiry
    if (Date.now() > customTokenData.expiresAt) {
      console.log('❌ Custom token expired at:', new Date(customTokenData.expiresAt).toISOString());
      console.log('🔐 ===== validateAccessToken END (EXPIRED) =====\n');
      return { success: false, error: 'Token muddati tugagan', userId: null };
    }
    
    console.log('✅ Custom token valid, userId:', customTokenData.userId);
    console.log('🔐 ===== validateAccessToken END (SUCCESS) =====\n');
    return { success: true, userId: customTokenData.userId, error: null };
  }

  // Token not found in KV store - this is an error
  console.log('❌ Custom token not found in KV store');
  console.log('🔐 ===== validateAccessToken END (TOKEN NOT FOUND) =====\n');
  return { success: false, error: 'Token noto\'g\'ri yoki muddati tugagan. Qaytadan kiring.', userId: null };
}

const ONLINE_PAYMENT_METHODS = new Set(['online', 'click', 'click_card', 'payme', 'atmos']);

/** POST /orders: Checkout yuboradigan `paymentStatus` (paid / pending) */
function normalizeIncomingOrderCreatePaymentStatus(raw: unknown): 'paid' | 'pending' | 'failed' | 'refunded' {
  const s = String(raw ?? '').toLowerCase().trim();
  if (
    ['paid', 'completed', 'complete', 'success', 'succeeded', 'successful', 'captured', 'settled', 'paid_out'].includes(
      s,
    )
  ) {
    return 'paid';
  }
  if (['failed', 'error', 'declined', 'rejected', 'expired'].includes(s)) return 'failed';
  if (['refunded', 'partially_refunded', 'partial_refund'].includes(s)) return 'refunded';
  return 'pending';
}

const normalizePhoneValue = (value: unknown) =>
  String(value || '').replace(/[^\d]/g, '');

/** rentals / profil bilan mos: bir xil raqam turli formatda bir xil kalitga tushsin */
const normalizeListingPhoneForLimit = (value: unknown): string => {
  const d = normalizePhoneValue(value);
  if (!d) return '';
  if (d.length === 9 && d.startsWith('9')) return `998${d}`;
  if (d.startsWith('998')) return d;
  return d;
};

const listingContactPhoneForLimit = (listing: any): string => {
  const raw =
    listing?.ownerPhone ?? listing?.contactPhone ?? listing?.phone ?? '';
  return normalizeListingPhoneForLimit(raw);
};

/** E'lon rasmlari: bir xil URL takrorlanmasin, tartib saqlansin (client xato / parallel yuklash). */
function normalizeListingImageUrls(raw: unknown, max = 10): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const s = String(x ?? "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * `house:` / `car:` ba'zan `listing:userId:id` bilan sinxron bo'lmay qoladi — katalogda noto'g'ri / eski rasm.
 * Profil `listing:` dan o'qiydi. Katalog javobida listingdagi `images` ustuvor qilinadi.
 */
async function mergeCatalogRowImagesFromListing(row: any): Promise<any> {
  if (!row || typeof row !== "object") return row;
  const uid = row.userId != null ? String(row.userId).trim() : "";
  const id = row.id != null ? String(row.id).trim() : "";
  if (!uid || !id) return row;
  try {
    const listing = await kv.get(`listing:${uid}:${id}`);
    if (!listing || typeof listing !== "object") return row;
    const li = listing as Record<string, unknown>;
    const fromListing = normalizeListingImageUrls(li.images, 10);
    if (fromListing.length === 0) return row;
    return {
      ...row,
      images: fromListing,
      image: fromListing[0] || (row as { image?: string }).image,
    };
  } catch {
    return row;
  }
}

/** Bitta telefon bo‘yicha bepul e’lonlar soni; undan keyin har biri uchun LISTING_FEE_UZS. */
const FREE_LISTINGS_PER_PHONE = 2;
/** Vaqtincha test: prodga chiqarishdan oldin 10_000 ga qaytaring. */
const LISTING_FEE_UZS = 1_000;

/**
 * Profil (`listing:`), katalog (`house:` / `car:`) va yashirin yo‘llar (`POST /houses`, `/cars`)
 * bir xil e’lonni ikki marta sanamaslik uchun id bo‘yicha birlashtiriladi.
 * Profildan faqat `listing:` o‘chirilib `house:` qolsa ham e’lon hali ham hisoblanadi.
 */
async function countUniqueListingsWithPhone(phoneNormalized: string): Promise<number> {
  if (!phoneNormalized) return 0;
  const seen = new Set<string>();

  const ingest = (key: string, value: any) => {
    if (!value || typeof value !== 'object') return;
    const st = String(value.status || 'active').toLowerCase();
    if (st === 'deleted' || st === 'cancelled' || st === 'removed') return;
    const p = listingContactPhoneForLimit(value);
    if (!p || p !== phoneNormalized) return;
    let id = String(value.id ?? '').trim();
    if (!id && key.startsWith('listing:')) {
      const rest = key.slice('listing:'.length);
      const colon = rest.indexOf(':');
      id = colon >= 0 ? rest.slice(colon + 1) : rest;
    } else if (!id && key.startsWith('house:')) {
      id = key.slice('house:'.length);
    } else if (!id && key.startsWith('car:')) {
      id = key.slice('car:'.length);
    }
    if (id) seen.add(id);
  };

  for (const { key, value } of await kv.getByPrefixWithKeys('listing:')) {
    ingest(key, value);
  }
  for (const { key, value } of await kv.getByPrefixWithKeys('house:')) {
    ingest(key, value);
  }
  for (const { key, value } of await kv.getByPrefixWithKeys('car:')) {
    ingest(key, value);
  }

  return seen.size;
}

const listingLifetimeSlotKey = (phoneNorm: string) =>
  `listing_lifetime_slot:${String(phoneNorm || "").trim()}`;

/**
 * Telefon bo‘yicha KV dagi barcha uy/avto/listing yozuvlari (o‘chirilgan statusdagi qatorlar ham),
 * id takrorlanmasin — bepul limit “umrbod”: fizik o‘chirishdan keyin ham slot qaytmasligi uchun
 * alohida `listing_lifetime_slot:*` sanasi ishlatiladi.
 */
async function countUniqueListingsWithPhoneAnyStatus(phoneNormalized: string): Promise<number> {
  if (!phoneNormalized) return 0;
  const seen = new Set<string>();

  const ingest = (key: string, value: any) => {
    if (!value || typeof value !== "object") return;
    const p = listingContactPhoneForLimit(value);
    if (!p || p !== phoneNormalized) return;
    let id = String(value.id ?? "").trim();
    if (!id && key.startsWith("listing:")) {
      const rest = key.slice("listing:".length);
      const colon = rest.indexOf(":");
      id = colon >= 0 ? rest.slice(colon + 1) : rest;
    } else if (!id && key.startsWith("house:")) {
      id = key.slice("house:".length);
    } else if (!id && key.startsWith("car:")) {
      id = key.slice("car:".length);
    }
    if (id) seen.add(id);
  };

  for (const { key, value } of await kv.getByPrefixWithKeys("listing:")) {
    ingest(key, value);
  }
  for (const { key, value } of await kv.getByPrefixWithKeys("house:")) {
    ingest(key, value);
  }
  for (const { key, value } of await kv.getByPrefixWithKeys("car:")) {
    ingest(key, value);
  }

  return seen.size;
}

/** Bir marta KV ga yoziladi — keyin faqat increment (o‘chirish kamaytirmaydi). */
async function ensureListingLifetimeSlotInitialized(phoneNorm: string): Promise<number> {
  const k = listingLifetimeSlotKey(phoneNorm);
  const raw = await kv.get(k);
  if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  const boot = await countUniqueListingsWithPhoneAnyStatus(phoneNorm);
  await kv.set(k, boot);
  return boot;
}

async function getLifetimeListingSlotsUsed(phoneNorm: string): Promise<number> {
  return ensureListingLifetimeSlotInitialized(phoneNorm);
}

async function incrementLifetimeListingSlotsUsed(phoneNorm: string): Promise<void> {
  const n = await ensureListingLifetimeSlotInitialized(phoneNorm);
  await kv.set(listingLifetimeSlotKey(phoneNorm), n + 1);
}

/** Fizik o‘chirishdan oldin chaqiring — KV dan yo‘qoladigan yozuv ham “sarflangan slot” hisobida qoladi. */
async function touchListingLifetimeBeforeHardDelete(record: unknown): Promise<void> {
  if (!record || typeof record !== "object") return;
  const r = record as Record<string, unknown>;
  const phoneNorm = normalizeListingPhoneForLimit(
    (r.ownerPhone ?? r.phone ?? r.contactPhone ?? "") as string,
  );
  if (!phoneNorm) return;
  await ensureListingLifetimeSlotInitialized(phoneNorm);
}

type ListingFeeGateResult =
  | { ok: true; consumeId: string | null }
  | { ok: false; status: number; error: string; code: string };

async function gateListingByPhoneAndFee(
  authUserId: string,
  ownerPhoneNorm: string,
  listingFeeTransactionId: unknown,
  /** Shu nomerga bugungacha sarflangan bepul slotlar (o‘chirilgan e‘lonlar ham hisobda qoladi). */
  lifetimeSlotsUsed: number,
): Promise<ListingFeeGateResult> {
  if (lifetimeSlotsUsed < FREE_LISTINGS_PER_PHONE) {
    return { ok: true, consumeId: null };
  }
  const tid = String(listingFeeTransactionId ?? "").trim();
  if (!tid) {
    return {
      ok: false,
      status: 400,
      code: "LISTING_FEE_REQUIRED",
      error:
        `Bu telefon raqami bo‘yicha ${FREE_LISTINGS_PER_PHONE} tadan ortiq bepul e‘lon joylashtirish mumkin emas. Keyingi har bir e‘lon uchun ${LISTING_FEE_UZS.toLocaleString("uz-UZ")} so‘m to‘lang (Click yoki Payme).`,
    };
  }
  const credit = (await kv.get(`listing_fee_credit:${tid}`)) as {
    userId?: string;
    phoneNorm?: string;
    amount?: number;
  } | null;
  if (!credit || String(credit.userId) !== String(authUserId)) {
    return {
      ok: false,
      status: 400,
      code: "LISTING_FEE_INVALID",
      error:
        "To‘lov tasdiqlanmagan yoki bu akkauntga tegishli emas. Click orqali qayta to‘lang.",
    };
  }
  const creditAmt = Number(credit.amount);
  if (!Number.isFinite(creditAmt) || creditAmt !== LISTING_FEE_UZS) {
    return {
      ok: false,
      status: 400,
      code: "LISTING_FEE_AMOUNT",
      error: "To‘lov summasi noto‘g‘ri",
    };
  }
  const cPhone = String(credit.phoneNorm || "").trim();
  if (!cPhone || cPhone !== ownerPhoneNorm) {
    return {
      ok: false,
      status: 400,
      code: "LISTING_FEE_PHONE_MISMATCH",
      error:
        "To‘lov boshqa telefon raqami uchun. E‘londagi aloqa telefoni bilan mos kelishi kerak.",
    };
  }
  return { ok: true, consumeId: tid };
}

const getConfiguredAdminPhones = () =>
  new Set(
    (Deno.env.get('ADMIN_PHONE_NUMBERS') || '')
      .split(',')
      .map((item) => normalizePhoneValue(item))
      .filter(Boolean)
  );

/** Admin panel maxfiy kodi (KV, paneldan o‘zgartiriladi). */
const ADMIN_PANEL_KV_SECONDARY = 'admin_panel:secondary_code';
/** Bitta admin panel uchun TOTP (login «Ali» bilan bog‘liq emas). */
const ADMIN_2FA_KV_KEY = 'admin2fa:panel';
const ADMIN_LOGIN_USER = (Deno.env.get('ADMIN_PANEL_LOGIN_USER') || 'Ali').trim();
const ADMIN_LOGIN_PASS = String(Deno.env.get('ADMIN_PANEL_LOGIN_PASS') || 'Ali');
const ADMIN_TEMP_LOGIN_MS = 10 * 60 * 1000;
const ADMIN_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_LOCKOUT_DURATIONS_MS = [
  24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000,
  365 * 24 * 60 * 60 * 1000,
];

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function adminLoginFingerprint(c: any): Promise<string> {
  const ip =
    c.req.header('cf-connecting-ip') ||
    c.req.header('CF-Connecting-IP') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';
  const ua = c.req.header('user-agent') || '';
  const dev = c.req.header('x-admin-device-id') || c.req.header('X-Admin-Device-Id') || '';
  return await sha256Hex(`${ip}|${ua}|${dev}`);
}

async function getAdminSecondaryCode(): Promise<string> {
  const row = await kv.get(ADMIN_PANEL_KV_SECONDARY);
  if (row && typeof row === 'object' && row.value != null) {
    const v = String(row.value).trim();
    if (v) return v;
  }
  if (typeof row === 'string' && row.trim()) return row.trim();
  return '0099';
}

async function assertAdminLoginAllowed(c: any) {
  const fpKey = `admin_login_lockout:${await adminLoginFingerprint(c)}`;
  const defaults = { failures: 0, lockUntil: null as string | null, tier: 0 };
  const raw = await kv.get(fpKey);
  const rec = { ...defaults, ...(raw && typeof raw === 'object' ? raw : {}) };
  const now = Date.now();
  const until = rec.lockUntil ? new Date(rec.lockUntil).getTime() : 0;
  if (until > now) {
    return { ok: false as const, blockedUntil: rec.lockUntil as string, fpKey };
  }
  if (rec.lockUntil && until <= now) {
    rec.lockUntil = null;
    await kv.set(fpKey, rec);
  }
  return { ok: true as const, rec, fpKey };
}

async function adminLoginRecordFailure(c: any, fpKey: string) {
  const defaults = { failures: 0, lockUntil: null as string | null, tier: 0 };
  const raw = await kv.get(fpKey);
  const rec = { ...defaults, ...(raw && typeof raw === 'object' ? raw : {}) };
  rec.failures = (Number(rec.failures) || 0) + 1;
  if (rec.failures >= 5) {
    const idx = Math.min(Number(rec.tier) || 0, 3);
    rec.lockUntil = new Date(Date.now() + ADMIN_LOCKOUT_DURATIONS_MS[idx]).toISOString();
    rec.tier = Math.min((Number(rec.tier) || 0) + 1, 3);
    rec.failures = 0;
  }
  await kv.set(fpKey, rec);
}

async function adminLoginClearFailures(fpKey: string) {
  const raw = await kv.get(fpKey);
  if (!raw || typeof raw !== 'object') return;
  await kv.set(fpKey, { ...raw, failures: 0 });
}

async function getAdmin2faRecord(): Promise<any> {
  let rec = await kv.get(ADMIN_2FA_KV_KEY);
  if (rec) return rec;
  const legacy = await kv.get('admin2fa:code:0099');
  if (legacy) {
    await kv.set(ADMIN_2FA_KV_KEY, legacy);
    return legacy;
  }
  return null;
}

async function validateAdminAccess(c: any) {
  const sessionTok =
    c.req.header('X-Admin-Session') ||
    c.req.header('x-admin-session') ||
    c.req.query('adminSession');
  if (sessionTok) {
    const tok = String(sessionTok).trim();
    if (tok) {
      const srow = await kv.get(`admin_session:${tok}`);
      const exp = srow?.expiresAt ? new Date(srow.expiresAt).getTime() : 0;
      if (exp > Date.now()) {
        return { success: true, mode: 'session', userId: null, adminCode: null, sessionToken: tok };
      }
    }
  }

  const auth = await validateAccessToken(c);
  if (!auth.success || !auth.userId) {
    return { success: false, error: 'Admin ruxsati talab qilinadi' };
  }

  const profile = await kv.get(`user:${auth.userId}`);
  const adminPhones = getConfiguredAdminPhones();
  const normalizedPhone = normalizePhoneValue(profile?.phone);
  const hasAdminRole =
    profile?.role === 'admin' ||
    profile?.isAdmin === true ||
    (normalizedPhone && adminPhones.has(normalizedPhone));

  if (!hasAdminRole) {
    return { success: false, error: 'Admin ruxsati talab qilinadi' };
  }

  return { success: true, mode: 'user', userId: auth.userId, profile };
}

async function validateAdminPanelGate(c: any) {
  const admin = await validateAdminAccess(c);
  if (admin.success && admin.mode === 'session') {
    return { ok: true as const, kind: 'session' as const };
  }
  const tempTok = String(
    c.req.header('X-Admin-Login-Token') || c.req.header('x-admin-login-token') || '',
  ).trim();
  if (tempTok) {
    const row = await kv.get(`admin_temp_login:${tempTok}`);
    const exp = row?.expiresAt ? new Date(row.expiresAt).getTime() : 0;
    if (row?.valid === true && exp > Date.now()) {
      return { ok: true as const, kind: 'temp' as const };
    }
  }
  return { ok: false as const, error: 'Admin tasdiqlash kerak' };
}

// ==================== ADMIN 2FA (TOTP) ====================
// Minimal TOTP implementation (RFC 6238 compatible, HMAC-SHA1, 30s step, 6 digits)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Encode = (bytes: Uint8Array) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
};

const base32Decode = (input: string) => {
  const clean = String(input || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
};

const timingSafeEqualStr = (a: string, b: string) => {
  const aa = new TextEncoder().encode(String(a));
  const bb = new TextEncoder().encode(String(b));
  const len = Math.max(aa.length, bb.length);
  let diff = 0;
  for (let i = 0; i < len; i++) {
    diff |= (aa[i] || 0) ^ (bb[i] || 0);
  }
  return diff === 0 && aa.length === bb.length;
};

const totpNow = async (secretBase32: string, opts?: { step?: number; digits?: number; skew?: number }) => {
  const step = opts?.step ?? 30;
  const digits = opts?.digits ?? 6;
  const skew = opts?.skew ?? 1;
  const keyBytes = base32Decode(secretBase32);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);

  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / step);

  const makeCodeForCounter = async (ctr: number) => {
    const msg = new Uint8Array(8);
    const view = new DataView(msg.buffer);
    // big-endian 64-bit counter
    view.setUint32(0, Math.floor(ctr / 0x100000000));
    view.setUint32(4, ctr >>> 0);

    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msg));
    const offset = mac[mac.length - 1] & 0x0f;
    const binCode =
      ((mac[offset] & 0x7f) << 24) |
      ((mac[offset + 1] & 0xff) << 16) |
      ((mac[offset + 2] & 0xff) << 8) |
      (mac[offset + 3] & 0xff);
    const mod = 10 ** digits;
    const otp = String(binCode % mod).padStart(digits, '0');
    return otp;
  };

  const codes: string[] = [];
  for (let i = -skew; i <= skew; i++) {
    codes.push(await makeCodeForCounter(counter + i));
  }
  return codes;
};

// Alohida sub-app: `app.route('/make-server-27d0d16c', restaurantRoutes)` barcha /make-server-27d0d16c/* ni
// restoran routeriga berib yuboradi — u yerda /admin/2fa yo'q bo'lib 404 chiqardi.
// Shuning uchun admin 2FA ni aniqroq prefix bilan mount qilamiz (restoran mountidan OLDIN).
const admin2faApp = new Hono();

admin2faApp.get('/status', async (c) => {
  try {
    const gate = await validateAdminPanelGate(c);
    if (!gate.ok) {
      return c.json({ success: false, error: gate.error }, 403);
    }
    const record = await getAdmin2faRecord();
    return c.json({
      success: true,
      enabled: Boolean(record?.enabled),
      createdAt: record?.createdAt || null,
    });
  } catch (e) {
    console.error('admin 2fa status error', e);
    return c.json({ success: false, error: '2FA holatini olishda xatolik' }, 500);
  }
});

admin2faApp.post('/setup', async (c) => {
  try {
    const gate = await validateAdminPanelGate(c);
    if (!gate.ok) {
      return c.json({ success: false, error: gate.error }, 403);
    }

    const existing = await getAdmin2faRecord();
    if (existing?.secretBase32) {
      const issuer = encodeURIComponent('Aresso Admin');
      const label = encodeURIComponent('admin-panel');
      const otpauthUrl = `otpauth://totp/${label}?secret=${existing.secretBase32}&issuer=${issuer}&digits=6&period=30`;
      return c.json({
        success: true,
        secretBase32: existing.secretBase32,
        otpauthUrl,
        enabled: Boolean(existing.enabled),
      });
    }

    const bytes = crypto.getRandomValues(new Uint8Array(20));
    const secretBase32 = base32Encode(bytes);
    const nowIso = new Date().toISOString();
    await kv.set(ADMIN_2FA_KV_KEY, { enabled: false, secretBase32, createdAt: nowIso, updatedAt: nowIso });

    const issuer = encodeURIComponent('Aresso Admin');
    const label = encodeURIComponent('admin-panel');
    const otpauthUrl = `otpauth://totp/${label}?secret=${secretBase32}&issuer=${issuer}&digits=6&period=30`;
    return c.json({ success: true, secretBase32, otpauthUrl, enabled: false });
  } catch (e) {
    console.error('admin 2fa setup error', e);
    return c.json({ success: false, error: '2FA sozlashda xatolik' }, 500);
  }
});

admin2faApp.post('/enable', async (c) => {
  try {
    const gate = await validateAdminPanelGate(c);
    if (!gate.ok) {
      return c.json({ success: false, error: gate.error }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const token = String(body?.token || '').trim();
    if (!token) return c.json({ success: false, error: 'token kerak' }, 400);

    const record = await getAdmin2faRecord();
    if (!record?.secretBase32) return c.json({ success: false, error: '2FA setup qilinmagan' }, 400);

    const expected = await totpNow(record.secretBase32, { skew: 1 });
    const ok = expected.some((code) => timingSafeEqualStr(code, token));
    if (!ok) {
      if (gate.kind === 'temp') {
        const g = await assertAdminLoginAllowed(c);
        if (g.ok) await adminLoginRecordFailure(c, g.fpKey);
      }
      return c.json({ success: false, error: 'Kod noto‘g‘ri' }, 401);
    }

    const nowIso = new Date().toISOString();
    await kv.set(ADMIN_2FA_KV_KEY, { ...record, enabled: true, updatedAt: nowIso });
    return c.json({ success: true, enabled: true });
  } catch (e) {
    console.error('admin 2fa enable error', e);
    return c.json({ success: false, error: '2FA yoqishda xatolik' }, 500);
  }
});

/** Yangi TOTP kalit (faqat kirgan admin; keyin qayta yoqish kerak) */
admin2faApp.post('/regenerate', async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success || admin.mode !== 'session') {
      return c.json({ success: false, error: 'Faqat admin panel sessiyasi' }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const token = String(body?.totp || body?.token || '').trim();
    if (!token) return c.json({ success: false, error: 'TOTP kerak' }, 400);
    const record = await getAdmin2faRecord();
    if (!record?.secretBase32) return c.json({ success: false, error: '2FA topilmadi' }, 400);
    const expected = await totpNow(record.secretBase32, { skew: 1 });
    if (!expected.some((code) => timingSafeEqualStr(code, token))) {
      return c.json({ success: false, error: 'Kod noto‘g‘ri' }, 401);
    }
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    const secretBase32 = base32Encode(bytes);
    const nowIso = new Date().toISOString();
    await kv.set(ADMIN_2FA_KV_KEY, {
      enabled: false,
      secretBase32,
      createdAt: nowIso,
      updatedAt: nowIso,
      rotatedAt: nowIso,
    });
    const issuer = encodeURIComponent('Aresso Admin');
    const label = encodeURIComponent('admin-panel');
    const otpauthUrl = `otpauth://totp/${label}?secret=${secretBase32}&issuer=${issuer}&digits=6&period=30`;
    return c.json({ success: true, secretBase32, otpauthUrl, enabled: false });
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Xatolik' }, 500);
  }
});

const adminAuthApp = new Hono();

adminAuthApp.post('/credentials', async (c) => {
  try {
    const gate = await assertAdminLoginAllowed(c);
    if (!gate.ok) {
      return c.json(
        {
          success: false,
          error: 'Juda ko‘p muvaffaqiyatsiz urinish. Bloklangan.',
          blockedUntil: gate.blockedUntil,
        },
        429,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const user = String(body?.username ?? '').trim();
    const pass = String(body?.password ?? '');
    const sec = String(body?.secondaryCode ?? '').trim();
    const want = await getAdminSecondaryCode();

    const okUser = timingSafeEqualStr(user, ADMIN_LOGIN_USER);
    const okPass = timingSafeEqualStr(pass, ADMIN_LOGIN_PASS);
    const okSec = timingSafeEqualStr(sec, want);

    if (!okUser || !okPass || !okSec) {
      await adminLoginRecordFailure(c, gate.fpKey);
      return c.json(
        { success: false, error: "Login, parol yoki maxfiy kod noto‘g‘ri" },
        401,
      );
    }

    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const temp = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const exp = new Date(Date.now() + ADMIN_TEMP_LOGIN_MS).toISOString();
    await kv.set(`admin_temp_login:${temp}`, { valid: true, expiresAt: exp });

    const rec = await getAdmin2faRecord();
    return c.json({
      success: true,
      tempToken: temp,
      twoFaEnabled: Boolean(rec?.enabled),
    });
  } catch (e: any) {
    console.error('admin auth credentials error', e);
    return c.json({ success: false, error: e?.message || 'Xatolik' }, 500);
  }
});

adminAuthApp.post('/finish', async (c) => {
  try {
    const gate = await assertAdminLoginAllowed(c);
    if (!gate.ok) {
      return c.json(
        {
          success: false,
          error: 'Bloklangan',
          blockedUntil: gate.blockedUntil,
        },
        429,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const temp = String(body?.tempToken ?? '').trim();
    const token = String(body?.token ?? '').trim();
    if (!temp || !token) {
      return c.json({ success: false, error: 'tempToken va token majburiy' }, 400);
    }

    const row = await kv.get(`admin_temp_login:${temp}`);
    const texp = row?.expiresAt ? new Date(row.expiresAt).getTime() : 0;
    if (!row?.valid || texp <= Date.now()) {
      return c.json({ success: false, error: 'Vaqtinchalik sessiya tugagan. Qayta kiring.' }, 401);
    }

    const record = await getAdmin2faRecord();
    if (!record?.enabled || !record?.secretBase32) {
      return c.json({ success: false, error: '2FA yoqilmagan' }, 400);
    }

    const expected = await totpNow(record.secretBase32, { skew: 1 });
    const ok = expected.some((code) => timingSafeEqualStr(code, token));
    if (!ok) {
      await adminLoginRecordFailure(c, gate.fpKey);
      return c.json({ success: false, error: 'Kod noto‘g‘ri' }, 401);
    }

    await kv.del(`admin_temp_login:${temp}`);

    const sessBytes = crypto.getRandomValues(new Uint8Array(32));
    const sessionToken = Array.from(sessBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const expiresAt = new Date(Date.now() + ADMIN_SESSION_MS).toISOString();
    await kv.set(`admin_session:${sessionToken}`, {
      createdAt: new Date().toISOString(),
      expiresAt,
    });
    await adminLoginClearFailures(gate.fpKey);

    return c.json({ success: true, sessionToken, expiresAt });
  } catch (e: any) {
    console.error('admin auth finish error', e);
    return c.json({ success: false, error: e?.message || 'Xatolik' }, 500);
  }
});

const adminSecurityApp = new Hono();

adminSecurityApp.get('/status', async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success || admin.mode !== 'session') {
      return c.json({ success: false, error: 'Faqat admin panel sessiyasi' }, 403);
    }
    const sec = await getAdminSecondaryCode();
    const rec = await getAdmin2faRecord();
    return c.json({
      success: true,
      secondaryCodeLength: sec.length,
      twoFaEnabled: Boolean(rec?.enabled),
    });
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Xatolik' }, 500);
  }
});

adminSecurityApp.post('/secondary-code', async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success || admin.mode !== 'session') {
      return c.json({ success: false, error: 'Faqat admin panel sessiyasi' }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const newCode = String(body?.newSecondaryCode ?? '').trim();
    const totp = String(body?.totp ?? '').trim();
    if (!/^\d{4,12}$/.test(newCode)) {
      return c.json({ success: false, error: 'Yangi kod 4–12 raqam bo‘lishi kerak' }, 400);
    }
    const rec = await getAdmin2faRecord();
    if (!rec?.enabled || !rec?.secretBase32) {
      return c.json({ success: false, error: '2FA yoqilmagan' }, 400);
    }
    const expected = await totpNow(rec.secretBase32, { skew: 1 });
    if (!expected.some((code) => timingSafeEqualStr(code, totp))) {
      return c.json({ success: false, error: 'Authenticator kodi noto‘g‘ri' }, 401);
    }
    await kv.set(ADMIN_PANEL_KV_SECONDARY, {
      value: newCode,
      updatedAt: new Date().toISOString(),
    });
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Xatolik' }, 500);
  }
});

async function validateShopMutationAccess(c: any, options: { branchId?: string | null; shopId?: string | null } = {}) {
  const admin = await validateAdminAccess(c);
  if (admin.success) {
    return { success: true, mode: 'admin', userId: admin.userId };
  }

  const seller = await validateSellerSession(c);
  if (!seller.success) {
    return { success: false, error: seller.error || admin.error || 'Ruxsat yo\'q' };
  }

  if (options.shopId && seller.shopId && seller.shopId !== options.shopId) {
    return { success: false, error: 'Bu do\'konni boshqarish ruxsati yo\'q' };
  }

  if (options.branchId && seller.branchId && seller.branchId !== options.branchId) {
    return { success: false, error: 'Bu filial uchun amal bajarishga ruxsat yo\'q' };
  }

  return {
    success: true,
    mode: 'seller',
    userId: null,
    shopId: seller.shopId,
    branchId: seller.branchId,
  };
}

const buildOrderKey = (order: any) =>
  order?.orderType === 'market' ? `order:market:${order.id}` : `order:${order.id}`;

const getOrderKeys = (orderId: string) => {
  const raw = String(orderId || '').trim();
  if (!raw) return [];

  // Accept both canonical IDs and full KV keys.
  // Examples:
  // - "restaurant:123:456" -> ["order:restaurant:123:456", "order:market:restaurant:123:456"]
  // - "order:restaurant:123:456" -> ["order:restaurant:123:456", "order:market:restaurant:123:456"]
  // - "order:market:abc" -> ["order:market:abc", "order:abc"]
  if (raw.startsWith('order:market:')) {
    const stripped = raw.slice('order:market:'.length);
    return [raw, `order:${stripped}`];
  }
  if (raw.startsWith('order:')) {
    const stripped = raw.slice('order:'.length);
    return [raw, `order:market:${stripped}`];
  }
  return [`order:${raw}`, `order:market:${raw}`];
};

const normalizeZoneIpToken = (value: any) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const ipv4 = raw.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0] || '';
  return ipv4 || raw;
};

async function getOrderRecord(orderId: string) {
  for (const key of getOrderKeys(orderId)) {
    const order = await kv.get(key);
    if (order) {
      return { key, order };
    }
  }

  return null;
}

/** Payme check-receipt / Click COMPLETE: asosiy `order:` / `order:market:` yozuvida to‘lovni «paid» qilish va v2 Postgres bilan sinxronlash */
async function markKvOrderPaidFromGateway(
  orderId: string,
  extras: { paymeReceiptId?: string; clickTransId?: string | number },
): Promise<void> {
  const record = await getOrderRecord(orderId);
  if (!record) {
    console.warn('[gateway-paid] buyurtma KV da topilmadi:', orderId);
    return;
  }
  const o = record.order as Record<string, unknown>;
  const nowIso = new Date().toISOString();
  const legacyId = String(o.id ?? orderId);
  const prevPaid = ['paid', 'completed', 'success'].includes(
    String(o.paymentStatus || '').toLowerCase().trim(),
  );
  const statusHistory = Array.isArray(o.statusHistory) ? [...(o.statusHistory as unknown[])] : [];
  if (!prevPaid) {
    statusHistory.push({
      status: o.status,
      timestamp: nowIso,
      note: 'Onlayn to‘lov tasdiqlandi (Payme/Click)',
    });
  }
  const updatedOrder = {
    ...record.order,
    paymentStatus: 'paid',
    paymentCompletedAt: nowIso,
    paymentRequiresVerification: false,
    updatedAt: nowIso,
    ...(extras.paymeReceiptId ? { paymeReceiptId: extras.paymeReceiptId } : {}),
    ...(extras.clickTransId != null ? { clickTransId: extras.clickTransId } : {}),
    statusHistory,
  };
  await kv.set(record.key, updatedOrder);

  try {
    const txKey = `transaction:${legacyId}`;
    const tx = await kv.get(txKey);
    if (tx && typeof tx === 'object') {
      await kv.set(txKey, { ...tx, status: 'paid', paidAt: nowIso });
    }
  } catch (txErr: unknown) {
    console.warn('[gateway-paid] transaction KV:', txErr);
  }

  await syncRelationalOrderFromLegacy({
    legacyOrderId: legacyId,
    kvStatus: String(o.status ?? ''),
    kvPaymentStatus: 'paid',
    paymentRequiresVerification: false,
  });
}

async function validateOrderOwnership(c: any, order: any) {
  const admin = await validateAdminAccess(c);
  if (admin.success) {
    return { success: true, mode: 'admin', userId: admin.userId };
  }

  const branchAuth = await validateBranchSession(c);
  if (branchAuth.success && order) {
    let orderBranch = normalizeBranchId(order.branchId || '');
    if (!orderBranch) {
      orderBranch = normalizeBranchId(await inferOrderBranchId(order));
    }
    const sessionBranch = normalizeBranchId(branchAuth.branchId || '');
    if (orderBranch && sessionBranch && orderBranch === sessionBranch) {
      return { success: true, mode: 'branch', branchId: branchAuth.branchId };
    }
  }

  const auth = await validateAccessToken(c);
  if (!auth.success || !auth.userId) {
    return { success: false, error: 'Avtorizatsiya kerak' };
  }

  if (!order?.userId || order.userId !== auth.userId) {
    return { success: false, error: 'Bu buyurtma uchun ruxsat yo\'q' };
  }

  return { success: true, mode: 'owner', userId: auth.userId };
}

/** Filial bekorida qator mahsulotlari uchun ~24 soat KV yozuvi (keyinroq katalog API bilan «tugagan» filtri). */
async function applyOrderCancelOneDayLineCooldown(order: any) {
  try {
    const bid = String(order?.branchId || '').trim();
    if (!bid || !Array.isArray(order?.items)) return;
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const ot = String(order.orderType || order.type || '').toLowerCase();
    const isFoodish = ot === 'food' || ot === 'restaurant';
    for (const it of order.items) {
      if (!it || typeof it !== 'object') continue;
      const line = it as Record<string, unknown>;
      let lineKey = '';
      if (ot === 'market') {
        lineKey = String(line.productUuid || line.productId || line.id || '').trim();
      } else if (ot === 'shop') {
        lineKey = String(line.id || line.productId || line.shopProductId || '').trim();
      } else if (isFoodish) {
        lineKey = String(line.dishId || line.id || '').trim();
      }
      if (!lineKey || lineKey.length < 2) continue;
      const safeKey = lineKey.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 200);
      await kv.set(`branch_line_cooldown_v1:${bid}:${ot || 'x'}:${safeKey}`, {
        until,
        createdAt: new Date().toISOString(),
        sourceOrderId: String(order.id || order.orderId || ''),
      });
    }
  } catch (e) {
    console.warn('[cooldown] applyOrderCancelOneDayLineCooldown:', e);
  }
}

const buildCommunityRoomId = (regionId: string, districtId: string) =>
  `community_${regionId}_${districtId}`;

const buildCommunityRoomKey = (roomId: string) => `community_room:${roomId}`;
const buildCommunityMemberKey = (roomId: string, userId: string) => `community_member:${roomId}:${userId}`;
const buildCommunityMessageKey = (roomId: string, messageId: string) => `community_message:${roomId}:${messageId}`;
const buildCommunityMessagePrefix = (roomId: string) => `community_message:${roomId}:`;
const buildCommunityMemberPrefix = (roomId: string) => `community_member:${roomId}:`;
const buildCommunityBlockKey = (roomId: string, userId: string) => `community_block:${roomId}:${userId}`;

function extractCommunityR2KeyFromUrl(url: string, ownerUserId: string): string | null {
  const u = String(url || '').trim();
  if (!u || (!u.startsWith('http://') && !u.startsWith('https://'))) return null;
  try {
    const parsed = new URL(u);
    const key = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!key || !key.startsWith(`community/${ownerUserId}/`)) return null;
    return key;
  } catch {
    return null;
  }
}

async function deleteCommunityMediaFromR2IfOwned(mediaUrl: string, ownerUserId: string) {
  const key = extractCommunityR2KeyFromUrl(mediaUrl, ownerUserId);
  if (!key) return;
  try {
    const r2Config = r2.checkR2Config();
    if (!r2Config.configured) return;
    await r2.deleteFromR2(key);
  } catch (e) {
    console.error('Community R2 delete (non-fatal):', e);
  }
}

/** HTTP(S) media URLs from a KV record (shallow + common nested shapes). */
function collectHttpMediaUrls(obj: unknown): Set<string> {
  const urls = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && (v.startsWith("http://") || v.startsWith("https://"))) {
      urls.add(v.trim());
    }
  };
  if (!obj || typeof obj !== "object") return urls;
  const o = obj as Record<string, unknown>;
  if (Array.isArray(o.images)) for (const x of o.images) add(x);
  add(o.image);
  add(o.logo);
  add(o.photo);
  add(o.profileImage);
  add(o.avatar);
  add(o.avatarUrl);
  add(o.coverImage);
  add(o.cover);
  add(o.bannerImage);
  add(o.thumbnail);
  add(o.thumbnailUrl);
  add(o.coverPhoto);
  add(o.backgroundImage);
  add(o.featuredImage);
  if (Array.isArray(o.gallery)) for (const x of o.gallery) add(x);
  if (Array.isArray(o.media)) for (const x of o.media) add(x);
  if (Array.isArray(o.variants)) {
    for (const v of o.variants) {
      if (v && typeof v === "object") {
        const x = v as Record<string, unknown>;
        add(x.image);
        add(x.photo);
        add(x.picture);
      }
    }
  }
  const scenes = o.panoramaScenes;
  if (Array.isArray(scenes)) {
    for (const s of scenes) {
      if (s && typeof s === "object") {
        const x = s as Record<string, unknown>;
        add(x.url);
        add(x.imageUrl);
        if (typeof x.preview === "string" && x.preview.startsWith("http")) add(x.preview);
      }
    }
  }
  return urls;
}

async function purgeRemovedR2Urls(before: unknown, after: unknown) {
  const oldU = collectHttpMediaUrls(before);
  const newU = collectHttpMediaUrls(after);
  for (const url of oldU) {
    if (!newU.has(url)) await r2.deleteManagedR2UrlIfKnown(url);
  }
}

async function purgeAllManagedR2UrlsInRecord(obj: unknown) {
  for (const url of collectHttpMediaUrls(obj)) {
    await r2.deleteManagedR2UrlIfKnown(url);
  }
}

async function deleteListingRecordMediaFromR2(listing: Record<string, unknown> | null | undefined) {
  await purgeAllManagedR2UrlsInRecord(listing);
}

function communityReplyPreviewFromMessage(m: any): string {
  if (!m) return '';
  const t = m.type || 'text';
  if (t === 'image') return m.content ? `📷 ${String(m.content).slice(0, 80)}` : '📷 Rasm';
  if (t === 'voice') return '🎤 Ovozli xabar';
  if (t === 'location') return m.locationLabel ? `📍 ${String(m.locationLabel).slice(0, 80)}` : '📍 Joylashuv';
  return String(m.content || '').slice(0, 140);
}

async function refreshCommunityRoomLastMessage(roomId: string) {
  const roomRow = await getCommunityRoomById(roomId);
  if (!roomRow) return;
  const raw = await kv.getByPrefix(buildCommunityMessagePrefix(roomId));
  const sorted = raw
    .filter((m: any) => m && m.id)
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const last = sorted[sorted.length - 1];
  const memberCount = await countCommunityMembers(roomId);
  if (!last) {
    await kv.set(buildCommunityRoomKey(roomId), {
      ...roomRow,
      memberCount,
      lastMessageAt: null,
      lastMessagePreview: '',
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  const lt = last.type || 'text';
  let preview = String(last.content || '').slice(0, 120);
  if (lt === 'image') preview = last.content ? `📷 ${String(last.content).slice(0, 100)}` : '📷 Rasm';
  if (lt === 'voice') preview = '🎤 Ovozli xabar';
  if (lt === 'location') {
    preview = last.locationLabel ? `📍 ${String(last.locationLabel).slice(0, 100)}` : '📍 Joylashuv';
  }
  await kv.set(buildCommunityRoomKey(roomId), {
    ...roomRow,
    memberCount,
    lastMessageAt: last.createdAt,
    lastMessagePreview: preview,
    updatedAt: new Date().toISOString(),
  });
}

type CommunityToxicDecision = {
  blocked: boolean;
  reason: string;
  scores?: Record<string, number>;
};

const getCommunityRoomById = async (roomId: string) => {
  return await kv.get(buildCommunityRoomKey(roomId));
};

const countCommunityMembers = async (roomId: string) => {
  const members = await kv.getByPrefix(buildCommunityMemberPrefix(roomId));
  return members.length;
};

const countCommunityMessages = async (roomId: string) => {
  const messages = await kv.getByPrefix(buildCommunityMessagePrefix(roomId));
  return messages.length;
};

const createOrGetCommunityRoom = async ({
  regionId,
  districtId,
  regionName,
  districtName,
}: {
  regionId: string;
  districtId: string;
  regionName: string;
  districtName: string;
}) => {
  const roomId = buildCommunityRoomId(regionId, districtId);
  const existingRoom = await getCommunityRoomById(roomId);

  if (existingRoom) {
    return existingRoom;
  }

  const newRoom = {
    id: roomId,
    name: `${districtName} Community`,
    description: `${districtName}, ${regionName} hududidagi foydalanuvchilar uchun yopiq community chat`,
    regionId,
    districtId,
    regionName,
    districtName,
    type: 'district',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastMessageAt: null,
    lastMessagePreview: '',
    memberCount: 0,
  };

  await kv.set(buildCommunityRoomKey(roomId), newRoom);
  return newRoom;
};

const ensureCommunityRoomAccess = async ({
  roomId,
  userId,
  regionId,
  districtId,
}: {
  roomId: string;
  userId: string;
  regionId?: string;
  districtId?: string;
}) => {
  const room = await getCommunityRoomById(roomId);

  if (!room) {
    return { success: false, status: 404, error: 'Community xonasi topilmadi', room: null, member: null };
  }

  if (regionId && room.regionId !== regionId) {
    return { success: false, status: 403, error: 'Siz faqat tanlangan hudud community xonasiga kira olasiz', room, member: null };
  }

  if (districtId && room.districtId !== districtId) {
    return { success: false, status: 403, error: 'Siz faqat tanlangan hudud community xonasiga kira olasiz', room, member: null };
  }

  const member = await kv.get(buildCommunityMemberKey(roomId, userId));
  if (!member) {
    return { success: false, status: 403, error: 'Avval ushbu community xonaga qo\'shiling', room, member: null };
  }

  return { success: true, status: 200, error: null, room, member };
};

const normalizeCommunityText = (text: string) => {
  // Normalize: trim + collapse spaces + lower-case.
  return String(text || '')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    // Remove apostrophe-like chars and hyphens so `la'nat` -> `lanat`
    // and `la-nat` -> `lanat` matching becomes easier.
    .replace(/'/g, '')
    .replace(/-/g, '');
};

const BASIC_BAD_WORD_REGEXES: RegExp[] = [
  // Common profanity (latin translit / sms-style)
  /\b(fuck|shit|bitch|asshole|dick|cunt|dumb|idiot|moron|stupid)\b/i,
  // Elongated/obfuscated variants (handles: suuuuka, blaaa...ya, kurvva...)
  /(?:^|[^a-z])s+u+k+a+(?:$|[^a-z])/i, // suka*
  /(?:^|[^a-z])k+u+r+v+[a-z]*(?:$|[^a-z])/i, // kurv*
  /(?:^|[^a-z])bl+y+a+(?:$|[^a-z])/i, // blya*
  /(?:^|[^a-z])bl+y+a+t+(?:$|[^a-z])/i, // blyat*
  /(?:^|[^a-z])x+u+y+(?:$|[^a-z])/i, // xuy*
  /(?:^|[^a-z])x+u+j+(?:$|[^a-z])/i, // xuj*
  /(?:^|[^a-z])h+u+i+(?:$|[^a-z])/i, // hui*
  /(?:^|[^a-z])h+u+j+(?:$|[^a-z])/i, // huj*
  // Uzbek/Russian variants (latin + basic)
  // Narrow ambiguous roots to avoid false positives like "pizza" (matches "piz..." but not "pizd...")
  /\b(kurva|kurvya|pidar[a-z]*|pizd[a-z]*|eb[a-z]*|jeb[a-z]*|hui[a-z]*|xuj[a-z]*|xuy[a-z]*)\b/i,
  /\b(lanat|jilov|johil|ahmoq|tentak|qargish|qargash|qargishlar)\b/i,
  // Cyrillic profanity (basic)
  /\b(сука|курва|блядь|бля|пидор|пидар)\b/i,
  /\b(хуй|хер|пизда|пизд)\w*\b/i,
  /\b(еб*ать|ебать|еблан)\b/i,
];

async function moderateCommunityTextAI(text: string): Promise<CommunityToxicDecision> {
  const normalized = normalizeCommunityText(text);
  if (!normalized) return { blocked: false, reason: 'empty' };

  // 1) Fast word-list fallback (even if AI is configured).
  const matched =
    BASIC_BAD_WORD_REGEXES.some((re) => re.test(normalized)) ||
    (lettersOnly && BASIC_BAD_WORD_REGEXES.some((re) => re.test(lettersOnly)));

  if (matched) {
    return { blocked: true, reason: 'bad_words' };
  }

  // 2) Optional OpenAI moderation (if key exists).
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    return { blocked: false, reason: 'no_ai_key' };
  }

  try {
    // Avoid long hangs in Edge runtime: if OpenAI is slow/unreachable,
    // moderation must never break chat sending.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800); // 1.8s

    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'text-moderation-latest',
        input: normalized,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return { blocked: false, reason: 'ai_error' };
    }

    const data = await res.json();
    const result = data?.results?.[0];
    const flagged = Boolean(result?.flagged);
    const categories = result?.categories || {};
    const scores = result?.category_scores || {};

    const harassment = Boolean(categories?.harassment || categories?.harassment_threatening);
    const hate = Boolean(categories?.hate || categories?.hate_harassment);
    const violence = Boolean(categories?.violence || categories?.threat || categories?.self_harm);

    // Reduce false positives: only block if it's clearly harassment/hate/violence.
    if (flagged && (harassment || hate || violence)) {
      return {
        blocked: true,
        reason: 'ai_moderation',
        scores,
      };
    }

    return { blocked: false, reason: 'ok', scores };
  } catch {
    return { blocked: false, reason: 'ai_exception' };
  }
}

function isCommunityBadLanguageByRegex(text: string): boolean {
  const normalized = normalizeCommunityText(text);
  if (!normalized) return false;

  const lettersOnly = normalized.replace(/[^a-zа-яё0-9]/gi, '');
  return BASIC_BAD_WORD_REGEXES.some((re) => {
    if (re.test(normalized)) return true;
    if (lettersOnly && re.test(lettersOnly)) return true;
    return false;
  });
}

function getCommunityBanDurationMs(warningsCount: number): number {
  // Escalation: 1st offense -> 1 hour, 2nd -> 6 hours, 3rd+ -> 24 hours.
  if (warningsCount <= 1) return 60 * 60 * 1000;
  if (warningsCount === 2) return 6 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

/** SMS: barcha KV kalitlari uchun bir xil 998XXXXXXXXX */
function normalizeSmsPhoneInput(raw: unknown): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (/^998\d{9}$/.test(d)) return d;
  if (/^9\d{8}$/.test(d)) return `998${d}`;
  return null;
}

function smsOtpMatches(stored: unknown, input: unknown): boolean {
  return String(stored ?? "").trim() === String(input ?? "").trim();
}

function smsOtpStillValid(stored: { expiresAt?: unknown }): boolean {
  const exp = Number(stored?.expiresAt);
  if (!Number.isFinite(exp)) return false;
  return Date.now() <= exp;
}

/** KV `user_phone` yo‘qolgan; Supabase Auth da `998...@aresso.app` bo‘lsa KV ni tiklash */
async function ensureSmsUserKvFromAuth(
  normalizedPhone: string,
): Promise<{ userId: string; userProfile: Record<string, unknown> } | null> {
  const existingPhone = await kv.get(`user_phone:${normalizedPhone}`);
  if (existingPhone?.userId) {
    const prof = await kv.get(`user:${existingPhone.userId}`);
    if (prof && typeof prof === "object") {
      return { userId: String(existingPhone.userId), userProfile: prof as Record<string, unknown> };
    }
  }

  const wantEmail = `${normalizedPhone}@aresso.app`.toLowerCase();
  let page = 1;
  const perPage = 1000;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("SMS KV repair: listUsers", error);
      return null;
    }
    const users = data?.users ?? [];
    const hit = users.find((u: { email?: string | null; id?: string }) =>
      String(u?.email ?? "").toLowerCase() === wantEmail
    );
    if (hit?.id) {
      const { data: userData, error: guErr } = await supabase.auth.admin.getUserById(hit.id);
      if (guErr || !userData?.user) return null;
      const u = userData.user;
      const meta = (u.user_metadata || {}) as Record<string, unknown>;
      const userProfile: Record<string, unknown> = {
        id: u.id,
        phone: normalizedPhone,
        firstName: String(meta.firstName ?? meta.first_name ?? ""),
        lastName: String(meta.lastName ?? meta.last_name ?? ""),
        birthDate: meta.birthDate ?? meta.birth_date ?? "",
        gender: meta.gender ?? "male",
        email: u.email ?? wantEmail,
        createdAt: u.created_at ?? new Date().toISOString(),
      };
      await kv.set(`user:${u.id}`, userProfile);
      await kv.set(`user_phone:${normalizedPhone}`, { userId: u.id, phone: normalizedPhone });
      return { userId: u.id, userProfile };
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

// ==================== AUTH ROUTES ====================

// ==================== SMS AUTH ROUTES ====================

// Send SMS verification code
app.post("/make-server-27d0d16c/auth/sms/send", async (c) => {
  try {
    const { phone } = await c.req.json();

    const normalizedPhone = normalizeSmsPhoneInput(phone);
    if (!normalizedPhone) {
      return c.json({
        error: 'Telefon raqam noto\'g\'ri formatda (masalan: 998901234567)',
        code: 'SMS_PHONE_INVALID',
      }, 400);
    }

    // Check if Eskiz is configured
    if (!eskiz.isEskizConfigured()) {
      return c.json({ 
        error: 'SMS xizmati sozlanmagan. ESKIZ_EMAIL va ESKIZ_PASSWORD environment variables kerak.' 
      }, 500);
    }

    // Generate verification code
    const code = eskiz.generateVerificationCode();

    // Store code with 5 minutes expiry
    await kv.set(`sms_code:${normalizedPhone}`, {
      code,
      phone: normalizedPhone,
      expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
      createdAt: new Date().toISOString(),
    });

    // Send SMS
    const result = await eskiz.sendVerificationSMS(normalizedPhone, code);

    if (!result.success) {
      return c.json({ error: result.error || 'SMS yuborishda xatolik' }, 500);
    }

    return c.json({ 
      success: true,
      message: 'SMS yuborildi',
      expiresIn: 300 // 5 minutes
    });
  } catch (error: any) {
    console.log('Send SMS exception:', error);
    return c.json({ error: `SMS yuborishda xatolik: ${error.message}` }, 500);
  }
});

// Verify SMS code and sign up
app.post("/make-server-27d0d16c/auth/sms/signup", async (c) => {
  try {
    const { phone, code, firstName, lastName, birthDate, gender } = await c.req.json();

    if (!phone || !code || !firstName || !lastName) {
      return c.json({ error: 'Barcha maydonlar majburiy' }, 400);
    }

    const normalizedPhone = normalizeSmsPhoneInput(phone);
    if (!normalizedPhone) {
      return c.json({
        error: 'Telefon raqam noto\'g\'ri formatda',
        code: 'SMS_PHONE_INVALID',
      }, 400);
    }

    // Get stored code
    const storedData = await kv.get(`sms_code:${normalizedPhone}`);
    
    if (!storedData) {
      return c.json({ error: 'Kod topilmadi yoki muddati tugagan', code: 'SMS_CODE_MISSING' }, 400);
    }

    // Check expiry
    if (!smsOtpStillValid(storedData)) {
      await kv.del(`sms_code:${normalizedPhone}`);
      return c.json({ error: 'Kod muddati tugagan', code: 'SMS_CODE_EXPIRED' }, 400);
    }

    // Verify code
    if (!smsOtpMatches(storedData.code, code)) {
      return c.json({ error: 'Kod noto\'g\'ri', code: 'SMS_CODE_WRONG' }, 400);
    }

    // Check if user already exists
    const existingUser = await kv.get(`user_phone:${normalizedPhone}`);
    
    if (existingUser) {
      return c.json({ error: 'Bu raqam allaqachon ro\'yxatdan o\'tgan' }, 400);
    }

    // Create user with Supabase Auth (using phone as email)
    const email = `${normalizedPhone}@aresso.app`; // Virtual email
    const password = `${normalizedPhone}-${Date.now()}`; // Auto-generated password

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        firstName,
        lastName,
        birthDate,
        gender,
        phone: normalizedPhone,
      },
      email_confirm: true
    });

    if (authError) {
      console.log('Signup auth error:', authError);
      return c.json({ error: authError.message }, 400);
    }

    // Create user profile in KV store
    const userProfile = {
      id: authData.user.id,
      phone: normalizedPhone,
      firstName,
      lastName,
      birthDate,
      gender,
      email,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`user:${authData.user.id}`, userProfile);
    await kv.set(`user_phone:${normalizedPhone}`, {
      userId: authData.user.id,
      phone: normalizedPhone,
    });

    // Delete verification code
    await kv.del(`sms_code:${normalizedPhone}`);

    // ALWAYS create custom access token (not Supabase JWT)
    // This ensures consistent token format that works with KV store
    const accessToken = `${authData.user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🔑 ===== SIGNUP: CREATING ACCESS TOKEN =====');
    console.log('🔑 Generated token:', accessToken);
    console.log('🔑 Token format: custom (not JWT)');
    console.log('🔑 KV key:', `access_token:${accessToken}`);
    console.log('🔑 User ID:', authData.user.id);
    
    // Store the access token in KV for validation
    const tokenData = {
      userId: authData.user.id,
      phone: normalizedPhone,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    };
    
    await kv.set(`access_token:${accessToken}`, tokenData);
    console.log('✅ Token stored in KV:', tokenData);
    
    // Verify it was stored correctly
    const verification = await kv.get(`access_token:${accessToken}`);
    console.log('✅ Token verification read:', verification ? 'SUCCESS' : 'FAILED');
    if (verification) {
      console.log('✅ Verified data:', verification);
    }
    console.log('🔑 ===== SIGNUP: TOKEN CREATION COMPLETE =====');

    return c.json({ 
      success: true,
      user: userProfile,
      session: {
        access_token: accessToken,
        expires_at: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
      },
      message: 'Ro\'yxatdan muvaffaqiyatli o\'tdingiz!' 
    });
  } catch (error: any) {
    console.log('SMS signup exception:', error);
    return c.json({ error: `Ro\'yxatdan o\'tishda xatolik: ${error.message}` }, 500);
  }
});

// Verify SMS code and sign in
app.post("/make-server-27d0d16c/auth/sms/signin", async (c) => {
  try {
    const { phone, code } = await c.req.json();

    if (!phone || !code) {
      return c.json({ error: 'Telefon va kod majburiy', code: 'SMS_FIELDS_MISSING' }, 400);
    }

    const normalizedPhone = normalizeSmsPhoneInput(phone);
    if (!normalizedPhone) {
      return c.json({
        error: 'Telefon raqam noto\'g\'ri formatda',
        code: 'SMS_PHONE_INVALID',
      }, 400);
    }

    // Get stored code (kalit har doim normalizatsiyalangan telefon)
    const storedData = await kv.get(`sms_code:${normalizedPhone}`);
    
    if (!storedData) {
      return c.json({ error: 'Kod topilmadi yoki muddati tugagan', code: 'SMS_CODE_MISSING' }, 400);
    }

    if (!smsOtpStillValid(storedData)) {
      await kv.del(`sms_code:${normalizedPhone}`);
      return c.json({ error: 'Kod muddati tugagan', code: 'SMS_CODE_EXPIRED' }, 400);
    }

    if (!smsOtpMatches(storedData.code, code)) {
      return c.json({ error: 'Kod noto\'g\'ri', code: 'SMS_CODE_WRONG' }, 400);
    }

    const repaired = await ensureSmsUserKvFromAuth(normalizedPhone);
    if (!repaired) {
      return c.json({
        error: 'Bu raqam ro\'yxatdan o\'tmagan. Iltimos, avval ro\'yxatdan o\'ting.',
        code: 'SMS_USER_NOT_REGISTERED',
      }, 400);
    }

    const { userId, userProfile } = repaired;

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !userData.user) {
      console.log('Get user error:', userError);
      return c.json({ error: 'Foydalanuvchi topilmadi', code: 'SMS_AUTH_USER_MISSING' }, 404);
    }

    const accessToken = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🔑 ===== CREATING ACCESS TOKEN =====');
    console.log('🔑 Generated token:', accessToken);
    console.log('🔑 KV key:', `access_token:${accessToken}`);
    console.log('🔑 User ID:', userId);
    
    const tokenData = {
      userId,
      phone: normalizedPhone,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    };
    
    await kv.set(`access_token:${accessToken}`, tokenData);
    console.log('✅ Token stored in KV:', tokenData);
    
    const verification = await kv.get(`access_token:${accessToken}`);
    console.log('✅ Token verification read:', verification ? 'SUCCESS' : 'FAILED');
    if (verification) {
      console.log('✅ Verified data:', verification);
    }
    console.log('🔑 ===== TOKEN CREATION COMPLETE =====');

    await kv.del(`sms_code:${normalizedPhone}`);

    return c.json({ 
      success: true,
      user: userProfile,
      session: {
        access_token: accessToken,
        expires_at: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
      },
      message: 'Muvaffaqiyatli kirdingiz!' 
    });
  } catch (error: any) {
    console.log('SMS signin exception:', error);
    return c.json({ error: `Kirishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== OLD AUTH ROUTES (Keep for compatibility) ====================

// Sign up
app.post("/make-server-27d0d16c/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    if (!email || !password || !name) {
      return c.json({ error: 'Email, password va ism majburiy' }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    // Create user profile in KV store
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email: data.user.email,
      name,
      createdAt: new Date().toISOString(),
    });

    return c.json({ 
      user: data.user,
      message: 'Foydalanuvchi muvaffaqiyatli ro\'yxatdan o\'tdi' 
    });
  } catch (error) {
    console.log('Signup exception:', error);
    return c.json({ error: 'Ro\'yxatdan o\'tishda xatolik yuz berdi' }, 500);
  }
});

// Sign in
app.post("/make-server-27d0d16c/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email va password majburiy' }, 400);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('Signin error:', error);
      return c.json({ error: error.message }, 401);
    }

    return c.json({ 
      session: data.session,
      user: data.user,
      message: 'Muvaffaqiyatli kirildi' 
    });
  } catch (error) {
    console.log('Signin exception:', error);
    return c.json({ error: 'Kirishda xatolik yuz berdi' }, 500);
  }
});

// Get current user
app.get("/make-server-27d0d16c/auth/user", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Token topilmadi' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: 'Noto\'g\'ri token' }, 401);
    }

    // Get user profile from KV store
    const profile = await kv.get(`user:${user.id}`);

    return c.json({ 
      user: {
        ...user,
        profile
      }
    });
  } catch (error) {
    console.log('Get user exception:', error);
    return c.json({ error: 'Foydalanuvchini olishda xatolik' }, 500);
  }
});

// ==================== USER PROFILE ROUTES ====================

// Shared upload handler for both /upload and /api/upload
async function handleUpload(c: any) {
  console.log('🚀 UPLOAD ENDPOINT HIT');
  
  try {
    // Try custom header first, then Authorization
    const customToken = c.req.header('X-Access-Token') || 
                        c.req.header('x-access-token') ||
                        c.req.raw.headers.get('X-Access-Token') ||
                        c.req.raw.headers.get('x-access-token');
    const authHeader = c.req.header('Authorization') || 
                       c.req.header('authorization') ||
                       c.req.raw.headers.get('Authorization') ||
                       c.req.raw.headers.get('authorization');
    
    // Extract token from Authorization header if present
    let authToken = null;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        authToken = parts[1];
      } else if (parts.length === 1) {
        authToken = parts[0];
      }
    }
    
    const accessToken = customToken || authToken;
    
    console.log('🔑 Access token found:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
    
    if (!accessToken) {
      console.log('❌ No access token provided');
      return c.json({ 
        code: 401, 
        message: 'Avtorizatsiya kerak. Iltimos, tizimga kiring.' 
      }, 401);
    }

    // Validate token - FIRST check custom token
    console.log('🔍 Checking token in KV store...');
    const customTokenData = await kv.get(`access_token:${accessToken}`);
    
    let userId;
    
    if (customTokenData) {
      console.log('✅ Custom token found in KV store');
      // Custom token found - check expiry
      if (Date.now() > customTokenData.expiresAt) {
        console.log('❌ Token expired');
        await kv.del(`access_token:${accessToken}`);
        return c.json({ 
          code: 401, 
          message: 'Token muddati tugagan. Iltimos, qaytadan kiring.' 
        }, 401);
      }
      userId = customTokenData.userId;
      console.log('✅ Token valid, userId:', userId);
    } else {
      console.log('⚠️ Custom token not found, trying Supabase token...');
      // Try Supabase token
      try {
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);

        if (error || !user) {
          console.log('❌ Invalid Supabase token:', error?.message);
          console.log('❌ This is likely a custom token that doesn\'t exist in KV store');
          return c.json({ 
            code: 401, 
            message: 'Token noto\'g\'ri yoki muddati tugagan. Iltimos, tizimga qaytadan kiring.' 
          }, 401);
        }
        userId = user.id;
        console.log('✅ Valid Supabase token, userId:', userId);
      } catch (authError: any) {
        console.log('❌ Error validating Supabase token:', authError.message);
        return c.json({ 
          code: 401, 
          message: 'Token noto\'g\'ri yoki muddati tugagan. Iltimos, tizimga qaytadan kiring.' 
        }, 401);
      }
    }

    // Parse multipart form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: 'Fayl topilmadi' }, 400);
    }

    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return c.json({ error: 'Faqat rasm va video fayllarini yuklash mumkin' }, 400);
    }

    // Validate file size (max 50MB for videos, 10MB for images)
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: `Fayl hajmi ${isVideo ? '50MB' : '10MB'} dan oshmasligi kerak` }, 400);
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
    const folder = isVideo ? 'videos' : 'profiles';
    const filename = `${folder}/${userId}-${Date.now()}.${ext}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Check R2 configuration
    const r2Config = r2.checkR2Config();
    
    if (!r2Config.configured) {
      return c.json({ error: r2Config.message }, 500);
    }

    // Upload to R2
    const uploadResult = await r2.uploadFile(buffer, filename, file.type);

    if (!uploadResult.success) {
      return c.json({ error: uploadResult.error || 'Faylni yuklashda xatolik' }, 500);
    }

    return c.json({
      success: true,
      url: uploadResult.url,
      filename: filename,
    });
  } catch (error: any) {
    console.error('Upload exception:', error);
    return c.json({ error: `Faylni yuklashda xatolik: ${error.message}` }, 500);
  }
}

// Upload image to R2 - New path (requires auth)
app.post("/make-server-27d0d16c/api/upload", handleUpload);

// Upload image to R2 - Legacy path for backward compatibility (requires auth)
app.post("/make-server-27d0d16c/upload", handleUpload);

// Public upload endpoint (no auth required) - for places, reviews, etc.
app.post("/make-server-27d0d16c/public/upload", async (c) => {
  console.log('🚀 PUBLIC UPLOAD ENDPOINT HIT');
  
  try {
    // Parse multipart form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: 'Fayl topilmadi' }, 400);
    }

    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return c.json({ error: 'Faqat rasm va video fayllarini yuklash mumkin' }, 400);
    }

    // Validate file size (max 50MB for videos, 10MB for images)
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: `Fayl hajmi ${isVideo ? '50MB' : '10MB'} dan oshmasligi kerak` }, 400);
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
    const folder = isVideo ? 'videos' : 'places';
    const filename = `${folder}/public-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Check R2 configuration
    const r2Config = r2.checkR2Config();
    
    if (!r2Config.configured) {
      return c.json({ error: r2Config.message }, 500);
    }

    // Upload to R2
    console.log('📤 Uploading to R2:', filename);
    const uploadResult = await r2.uploadFile(buffer, filename, file.type);

    if (!uploadResult.success) {
      console.error('❌ Upload failed:', uploadResult.error);
      return c.json({ error: uploadResult.error || 'Faylni yuklashda xatolik' }, 500);
    }

    console.log('✅ Upload successful:', uploadResult.url);
    return c.json({
      success: true,
      url: uploadResult.url,
      filename: filename,
    });
  } catch (error: any) {
    console.error('❌ Public upload exception:', error);
    return c.json({ error: `Faylni yuklashda xatolik: ${error.message}` }, 500);
  }
});

// R2 upload endpoint for rental products (no auth required)
app.post("/make-server-27d0d16c/upload/r2", async (c) => {
  console.log('🚀 R2 UPLOAD ENDPOINT FOR RENTALS');
  
  try {
    // Parse multipart form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('❌ No file in request');
      return c.json({ error: 'Fayl topilmadi' }, 400);
    }

    console.log('📁 File info:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('❌ Invalid file type:', file.type);
      return c.json({ error: 'Faqat rasm fayllarini yuklash mumkin' }, 400);
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      console.error('❌ File too large:', file.size);
      return c.json({ error: 'Fayl hajmi 10MB dan oshmasligi kerak' }, 400);
    }

    // Generate unique filename for rentals
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `rentals/rental-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Check R2 configuration
    const r2Config = r2.checkR2Config();
    
    if (!r2Config.configured) {
      console.error('❌ R2 not configured');
      return c.json({ error: r2Config.message }, 500);
    }

    // Upload to R2
    console.log('📤 Uploading to R2:', filename);
    const uploadResult = await r2.uploadFile(buffer, filename, file.type);

    if (!uploadResult.success) {
      console.error('❌ Upload failed:', uploadResult.error);
      return c.json({ error: uploadResult.error || 'Faylni yuklashda xatolik' }, 500);
    }

    console.log('✅ Upload successful:', uploadResult.url);
    return c.json({
      success: true,
      url: uploadResult.url,
      filename: filename,
    });
  } catch (error: any) {
    console.error('❌ R2 upload exception:', error);
    return c.json({ error: `Yuklashda xatolik: ${error.message}` }, 500);
  }
});

// Get user profile (requires auth)
app.get("/make-server-27d0d16c/user/profile", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    // Get user profile from KV store
    const profile = await kv.get(`user:${auth.userId}`);

    if (!profile) {
      return c.json({ error: 'Profil topilmadi' }, 404);
    }

    return c.json({ 
      fullName: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      birthDate: profile.birthDate,
      gender: profile.gender,
      email: profile.email,
      profileImage: profile.profileImage,
      createdAt: profile.createdAt,
    });
  } catch (error) {
    console.log('Get profile exception:', error);
    return c.json({ error: 'Profilni olishda xatolik' }, 500);
  }
});

// Update user profile (requires auth)
app.put("/make-server-27d0d16c/user/profile", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    // Get existing profile
    const existingProfile = await kv.get(`user:${auth.userId}`);

    if (!existingProfile) {
      return c.json({ error: 'Profil topilmadi' }, 404);
    }

    // Get update data
    const { firstName, lastName, birthDate, gender, profileImage } = await c.req.json();

    // Validate required fields
    if (!firstName || !lastName) {
      return c.json({ error: 'Ism va familya majburiy' }, 400);
    }

    // Check minimum age if birthDate is being updated
    if (birthDate) {
      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      if (age < 16) {
        return c.json({ error: 'Kamida 16 yoshda bo\'lishingiz kerak' }, 400);
      }
    }

    // Update profile (phone cannot be changed)
    const updatedProfile = {
      ...existingProfile,
      firstName,
      lastName,
      birthDate: birthDate || existingProfile.birthDate,
      gender: gender || existingProfile.gender,
      profileImage: profileImage !== undefined ? profileImage : existingProfile.profileImage,
      updatedAt: new Date().toISOString(),
    };

    await purgeRemovedR2Urls(existingProfile, updatedProfile);
    await kv.set(`user:${auth.userId}`, updatedProfile);

    return c.json({ 
      success: true,
      profile: {
        fullName: `${updatedProfile.firstName} ${updatedProfile.lastName}`.trim(),
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        phone: updatedProfile.phone,
        birthDate: updatedProfile.birthDate,
        gender: updatedProfile.gender,
        email: updatedProfile.email,
        profileImage: updatedProfile.profileImage,
        createdAt: updatedProfile.createdAt,
        updatedAt: updatedProfile.updatedAt,
      },
      message: 'Profil muvaffaqiyatli yangilandi' 
    });
  } catch (error) {
    console.log('Update profile exception:', error);
    return c.json({ error: 'Profilni yangilashda xatolik' }, 500);
  }
});

// ==================== COMMUNITY CHAT ROUTES ====================

app.get("/make-server-27d0d16c/community/rooms", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const rooms = await kv.getByPrefix('community_room:');

    const roomSummaries = await Promise.all(
      rooms.map(async (room: any) => {
        const memberCount = await countCommunityMembers(room.id);
        const messageCount = await countCommunityMessages(room.id);
        const member = await kv.get(buildCommunityMemberKey(room.id, auth.userId));

        return {
          ...room,
          memberCount,
          messageCount,
          joined: !!member,
        };
      })
    );

    roomSummaries.sort((first: any, second: any) => {
      const secondTime = new Date(second.lastMessageAt || second.updatedAt || 0).getTime();
      const firstTime = new Date(first.lastMessageAt || first.updatedAt || 0).getTime();
      return secondTime - firstTime;
    });

    return c.json({
      success: true,
      rooms: roomSummaries,
    });
  } catch (error: any) {
    console.error('Get community rooms error:', error);
    return c.json({ error: `Community chatlar ro'yxatini olishda xatolik: ${error.message}` }, 500);
  }
});

app.get("/make-server-27d0d16c/community/room", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const regionId = c.req.query('regionId') || '';
    const districtId = c.req.query('districtId') || '';
    const regionName = c.req.query('regionName') || '';
    const districtName = c.req.query('districtName') || '';

    if (!regionId || !districtId || !regionName || !districtName) {
      return c.json({ error: 'Viloyat va tuman tanlanishi majburiy' }, 400);
    }

    const room = await createOrGetCommunityRoom({
      regionId,
      districtId,
      regionName,
      districtName,
    });

    const member = await kv.get(buildCommunityMemberKey(room.id, auth.userId));
    const memberCount = await countCommunityMembers(room.id);
    const roomWithCount = {
      ...room,
      memberCount,
    };

    await kv.set(buildCommunityRoomKey(room.id), roomWithCount);

    return c.json({
      success: true,
      room: roomWithCount,
      joined: !!member,
    });
  } catch (error: any) {
    console.error('Get community room error:', error);
    return c.json({ error: `Community xonasini olishda xatolik: ${error.message}` }, 500);
  }
});

app.post("/make-server-27d0d16c/community/room/:roomId/join", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const roomId = c.req.param('roomId');
    const { regionId, districtId, regionName, districtName } = await c.req.json();

    if (!regionId || !districtId || !regionName || !districtName) {
      return c.json({ error: 'Viloyat va tuman ma\'lumotlari majburiy' }, 400);
    }

    const room = await createOrGetCommunityRoom({
      regionId,
      districtId,
      regionName,
      districtName,
    });

    if (room.id !== roomId) {
      return c.json({ error: 'Tanlangan room va hudud mos emas' }, 403);
    }

    const profile = await kv.get(`user:${auth.userId}`);
    if (!profile) {
      return c.json({ error: 'Foydalanuvchi profili topilmadi' }, 404);
    }

    const memberKey = buildCommunityMemberKey(roomId, auth.userId);
    const existingMember = await kv.get(memberKey);

    const member = existingMember || {
      roomId,
      userId: auth.userId,
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phone: profile.phone || '',
      joinedAt: new Date().toISOString(),
    };

    await kv.set(memberKey, member);

    const updatedProfile = {
      ...profile,
      communityRegionId: regionId,
      communityDistrictId: districtId,
      communityRegionName: regionName,
      communityDistrictName: districtName,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`user:${auth.userId}`, updatedProfile);

    const memberCount = await countCommunityMembers(roomId);
    const updatedRoom = {
      ...room,
      memberCount,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(buildCommunityRoomKey(roomId), updatedRoom);

    return c.json({
      success: true,
      room: updatedRoom,
      joined: true,
      member,
    });
  } catch (error: any) {
    console.error('Join community room error:', error);
    return c.json({ error: `Community xonaga qo'shilishda xatolik: ${error.message}` }, 500);
  }
});

app.get("/make-server-27d0d16c/community/room/:roomId/messages", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const roomId = c.req.param('roomId');
    const regionId = c.req.query('regionId') || undefined;
    const districtId = c.req.query('districtId') || undefined;
    const limit = Math.min(Math.max(Number(c.req.query('limit') || '60'), 1), 150);

    const access = await ensureCommunityRoomAccess({
      roomId,
      userId: auth.userId,
      regionId,
      districtId,
    });

    if (!access.success) {
      return c.json({ error: access.error }, access.status as 400 | 401 | 403 | 404);
    }

    const messages = await kv.getByPrefix(buildCommunityMessagePrefix(roomId));
    const communityMessagePassesModerationFilter = (m: any) => {
      const t = m?.type || 'text';
      if (t === 'voice') return true;
      if (t === 'image') return !isCommunityBadLanguageByRegex(String(m?.content || ''));
      if (t === 'location') {
        return !isCommunityBadLanguageByRegex(String(m?.locationLabel || m?.content || ''));
      }
      return !isCommunityBadLanguageByRegex(String(m?.content || ''));
    };
    const sortedMessages = messages
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-limit)
      .filter(communityMessagePassesModerationFilter);

    return c.json({
      success: true,
      room: access.room,
      messages: sortedMessages,
    });
  } catch (error: any) {
    console.error('Get community messages error:', error);
    return c.json({ error: `Xabarlarni olishda xatolik: ${error.message}` }, 500);
  }
});

app.post("/make-server-27d0d16c/community/upload-media", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ error: auth.error }, 401);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'Fayl topilmadi' }, 400);
    }

    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    if (!isImage && !isAudio) {
      return c.json({ error: 'Faqat rasm yoki audio fayl yuklash mumkin' }, 400);
    }

    const maxSize = isImage ? 8 * 1024 * 1024 : 6 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json(
        { error: isImage ? 'Rasm hajmi 8MB dan oshmasligi kerak' : 'Audio hajmi 6MB dan oshmasligi kerak' },
        400,
      );
    }

    const ext = file.name.split('.').pop() || (isImage ? 'jpg' : 'webm');
    const filename = `community/${auth.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const r2Config = r2.checkR2Config();
    if (!r2Config.configured) {
      return c.json({ error: r2Config.message }, 500);
    }

    const uploadResult = await r2.uploadFile(buffer, filename, file.type);
    if (!uploadResult.success) {
      return c.json({ error: uploadResult.error || 'Faylni yuklashda xatolik' }, 500);
    }

    return c.json({
      success: true,
      url: uploadResult.url,
      contentType: file.type,
    });
  } catch (error: any) {
    console.error('Community upload-media error:', error);
    return c.json({ error: error.message || 'Faylni yuklashda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/community/room/:roomId/messages", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const roomId = c.req.param('roomId');
    const body = await c.req.json();
    const {
      content: rawContent,
      regionId,
      districtId,
      type: rawType,
      mediaUrl: rawMediaUrl,
      durationSec: rawDuration,
      lat: rawLat,
      lng: rawLng,
      locationLabel: rawLocationLabel,
      replyToMessageId: rawReplyToId,
    } = body;

    const replyToMessageId = rawReplyToId != null ? String(rawReplyToId).trim() : '';

    const msgType = String(rawType || 'text').toLowerCase();
    const allowedTypes = ['text', 'image', 'voice', 'location'];
    if (!allowedTypes.includes(msgType)) {
      return c.json({ error: 'Noto‘g‘ri xabar turi' }, 400);
    }

    const access = await ensureCommunityRoomAccess({
      roomId,
      userId: auth.userId,
      regionId,
      districtId,
    });

    if (!access.success) {
      return c.json({ error: access.error }, access.status as 400 | 401 | 403 | 404);
    }

    const profile = await kv.get(`user:${auth.userId}`);
    if (!profile) {
      return c.json({ error: 'Foydalanuvchi profili topilmadi' }, 404);
    }

    const moderateIfText = async (text: string) => {
      const t = String(text || '').trim();
      if (!t) return { ok: true as const };
      let decision: CommunityToxicDecision = { blocked: false, reason: 'unknown' };
      try {
        decision = await moderateCommunityTextAI(t);
      } catch (_e) {
        decision = { blocked: false, reason: 'moderation_fail' };
      }
      if (decision.blocked) {
        return { ok: false as const };
      }
      return { ok: true as const };
    };

    let content = '';
    let mediaUrl = '';
    let durationSec: number | undefined;
    let lat: number | undefined;
    let lng: number | undefined;
    let locationLabel = '';

    if (msgType === 'text') {
      if (!rawContent || !String(rawContent).trim()) {
        return c.json({ error: 'Xabar matni majburiy' }, 400);
      }
      content = String(rawContent).trim();
      if (content.length > 1000) {
        return c.json({ error: 'Xabar 1000 ta belgidan oshmasligi kerak' }, 400);
      }
      const mod = await moderateIfText(content);
      if (!mod.ok) {
        return c.json({ error: 'Noto‘g‘ri so‘z ishlatildi.', code: 'community_bad_language' }, 400);
      }
    } else if (msgType === 'image') {
      mediaUrl = String(rawMediaUrl || '').trim();
      if (!mediaUrl.startsWith('https://') && !mediaUrl.startsWith('http://')) {
        return c.json({ error: 'Rasm havolasi noto‘g‘ri' }, 400);
      }
      content = rawContent != null ? String(rawContent).trim() : '';
      if (content.length > 500) {
        return c.json({ error: 'Izoh 500 belgidan oshmasligi kerak' }, 400);
      }
      if (content) {
        const mod = await moderateIfText(content);
        if (!mod.ok) {
          return c.json({ error: 'Noto‘g‘ri so‘z ishlatildi.', code: 'community_bad_language' }, 400);
        }
      }
    } else if (msgType === 'voice') {
      mediaUrl = String(rawMediaUrl || '').trim();
      if (!mediaUrl.startsWith('https://') && !mediaUrl.startsWith('http://')) {
        return c.json({ error: 'Audio havolasi noto‘g‘ri' }, 400);
      }
      const d = Number(rawDuration);
      if (Number.isFinite(d) && d > 0) {
        durationSec = Math.min(600, Math.round(d));
      }
    } else if (msgType === 'location') {
      lat = Number(rawLat);
      lng = Number(rawLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return c.json({ error: 'Joylashuv koordinatalari majburiy' }, 400);
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return c.json({ error: 'Joylashuv koordinatalari noto‘g‘ri' }, 400);
      }
      locationLabel = rawLocationLabel != null ? String(rawLocationLabel).trim().slice(0, 200) : '';
      if (locationLabel) {
        const mod = await moderateIfText(locationLabel);
        if (!mod.ok) {
          return c.json({ error: 'Noto‘g‘ri so‘z ishlatildi.', code: 'community_bad_language' }, 400);
        }
      }
      content = locationLabel || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    const messageId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const message: Record<string, unknown> = {
      id: messageId,
      roomId,
      userId: auth.userId,
      type: msgType,
      content,
      senderName: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.phone || 'Foydalanuvchi',
      senderAvatar: profile.profileImage || '',
      regionId: access.room.regionId,
      districtId: access.room.districtId,
      createdAt: new Date().toISOString(),
    };

    if (mediaUrl) message.mediaUrl = mediaUrl;
    if (durationSec != null) message.durationSec = durationSec;
    if (msgType === 'location') {
      message.lat = lat;
      message.lng = lng;
      if (locationLabel) message.locationLabel = locationLabel;
    }

    if (replyToMessageId) {
      const parentKey = buildCommunityMessageKey(roomId, replyToMessageId);
      const parent: any = await kv.get(parentKey);
      if (parent && String(parent.roomId) === String(roomId)) {
        const replyTo: Record<string, unknown> = {
          messageId: String(parent.id),
          userId: String(parent.userId || ''),
          senderName: String(parent.senderName || 'Foydalanuvchi'),
          type: parent.type || 'text',
          preview: communityReplyPreviewFromMessage(parent),
        };
        if ((parent.type || 'text') === 'image' && parent.mediaUrl) {
          replyTo.mediaUrl = String(parent.mediaUrl);
        }
        message.replyTo = replyTo;
      }
    }

    let lastMessagePreview = content.slice(0, 120);
    if (msgType === 'image') lastMessagePreview = content ? `📷 ${content.slice(0, 100)}` : '📷 Rasm';
    if (msgType === 'voice') lastMessagePreview = '🎤 Ovozli xabar';
    if (msgType === 'location') lastMessagePreview = locationLabel ? `📍 ${locationLabel.slice(0, 100)}` : '📍 Joylashuv';

    await kv.set(buildCommunityMessageKey(roomId, messageId), message);

    const memberCount = await countCommunityMembers(roomId);
    await kv.set(buildCommunityRoomKey(roomId), {
      ...access.room,
      memberCount,
      lastMessageAt: message.createdAt,
      lastMessagePreview,
      updatedAt: message.createdAt,
    });

    return c.json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error('Send community message error:', error);
    return c.json({ error: `Xabar yuborishda xatolik: ${error.message}` }, 500);
  }
});

app.delete("/make-server-27d0d16c/community/room/:roomId/messages/:messageId", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ error: auth.error }, 401);
    }

    const roomId = String(c.req.param('roomId') || '').trim();
    const rawParam = c.req.param('messageId');
    let messageId = String(rawParam || '').trim();
    try {
      messageId = decodeURIComponent(messageId).trim();
    } catch {
      /* keep messageId as trimmed raw */
    }
    const regionId = c.req.query('regionId') || undefined;
    const districtId = c.req.query('districtId') || undefined;

    const access = await ensureCommunityRoomAccess({
      roomId,
      userId: auth.userId,
      regionId,
      districtId,
    });

    if (!access.success) {
      return c.json({ error: access.error }, access.status as 400 | 401 | 403 | 404);
    }

    let storageKey = buildCommunityMessageKey(roomId, messageId);
    let existing: any = await kv.get(storageKey);

    // Agar URL/param bilan KV kalitining oxirgi segmenti mos kelmasa (eski ma'lumot, kodlash),
    // xonadagi barcha xabarlardan `id` bo‘yicha topib, haqiqiy kalit bilan o‘chiramiz.
    if (!existing) {
      const rows = await kv.getByPrefixWithKeys(buildCommunityMessagePrefix(roomId));
      const hit = rows.find((r) => {
        const v = r.value;
        if (!v || typeof v !== 'object') return false;
        const id = String((v as any).id ?? '').trim();
        const rid = String((v as any).roomId ?? '').trim();
        return id === messageId && (!rid || rid === roomId);
      });
      if (hit) {
        storageKey = hit.key;
        existing = hit.value;
      }
    }

    if (!existing) {
      return c.json({ error: 'Xabar topilmadi' }, 404);
    }

    const ownerId = String(existing.userId ?? existing.authorId ?? '').trim();
    const requesterId = String(auth.userId).trim();
    if (!ownerId || ownerId !== requesterId) {
      return c.json({ error: 'Faqat o‘z xabaringizni o‘chira olasiz' }, 403);
    }

    const t = existing.type || 'text';
    if ((t === 'image' || t === 'voice') && existing.mediaUrl) {
      await deleteCommunityMediaFromR2IfOwned(String(existing.mediaUrl), auth.userId);
    }

    await kv.del(storageKey);
    await refreshCommunityRoomLastMessage(roomId);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete community message error:', error);
    return c.json({ error: `Xabarni o‘chirishda xatolik: ${error.message}` }, 500);
  }
});

// Get user by ID (requires auth)
app.get("/make-server-27d0d16c/user/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    
    if (!userId) {
      return c.json({ error: 'User ID majburiy' }, 400);
    }

    // /user/chats must not be handled as userId "chats" (would 404 as missing user)
    if (userId === 'chats') {
      return await userChatsHandler(c);
    }

    // /user/order-reviews must not hit KV user:order-reviews (buyurtma sharxi API)
    if (userId === 'order-reviews') {
      try {
        const auth = await validateAccessToken(c);
        if (!auth.success || !auth.userId) {
          return c.json({ success: false, error: auth.error }, 401);
        }
        const orderId = String(c.req.query('orderId') || '').trim();
        if (!orderId) {
          return c.json({ success: false, error: 'orderId kerak' }, 400);
        }
        const reviewKey = `user:${auth.userId}:order_review:${orderId}`;
        const review = await kv.get(reviewKey);
        return c.json({ success: true, review: review || null });
      } catch (e: any) {
        console.error('order-reviews GET (user/:userId branch):', e);
        return c.json({ success: false, error: 'Sharxni olishda xatolik' }, 500);
      }
    }

    // Get user profile from KV store
    const profile = await kv.get(`user:${userId}`);

    if (!profile) {
      return c.json({ error: 'Foydalanuvchi topilmadi' }, 404);
    }

    return c.json({ 
      user: {
        id: profile.id,
        fullName: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        birthDate: profile.birthDate,
        gender: profile.gender,
        email: profile.email,
        profileImage: profile.profileImage,
        createdAt: profile.createdAt,
      }
    });
  } catch (error) {
    console.log('Get user by ID exception:', error);
    return c.json({ error: 'Foydalanuvchini olishda xatolik' }, 500);
  }
});

// Generate presigned upload URL (requires auth)
app.post("/make-server-27d0d16c/upload/presigned-url", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const { fileName, contentType } = await c.req.json();

    if (!fileName || !contentType) {
      return c.json({ error: 'fileName va contentType majburiy' }, 400);
    }

    // Validate file type
    if (!contentType.startsWith('image/')) {
      return c.json({ error: 'Faqat rasm fayllari yuklash mumkin' }, 400);
    }

    // Generate unique filename
    const ext = fileName.split('.').pop() || 'jpg';
    const uniqueFileName = `profiles/${auth.userId}-${Date.now()}.${ext}`;

    // Generate presigned URL for upload
    const presignedUrl = await r2.generatePresignedUploadUrl(uniqueFileName, contentType);

    // Generate download URL (what will be saved in profile)
    const downloadUrl = await r2.getSignedUrlFromR2(uniqueFileName, 31536000); // 1 year

    return c.json({
      success: true,
      uploadUrl: presignedUrl,
      downloadUrl: downloadUrl,
      fileName: uniqueFileName,
    });
  } catch (error: any) {
    console.log('Generate presigned URL error:', error);
    return c.json({ error: error.message || 'Presigned URL yaratishda xatolik' }, 500);
  }
});

// ==================== PRODUCTS ROUTES ====================

// Helper function to calculate sold this week for a product variant
async function calculateSoldThisWeek(productId: string, variantId?: string): Promise<number> {
  try {
    const orders = await kv.getByPrefix('order:');
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    let soldCount = 0;
    
    for (const order of orders) {
      // Only count completed orders from this week
      if (order.status !== 'completed') continue;
      if (!order.createdAt || new Date(order.createdAt).getTime() < oneWeekAgo) continue;
      
      // Check order items
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          if (item.productId === productId) {
            // If variantId is specified, match it; otherwise count all
            if (!variantId || item.variantId === variantId) {
              soldCount += item.quantity || 1;
            }
          }
        }
      }
    }
    
    return soldCount;
  } catch (error) {
    console.error('Calculate soldThisWeek error:', error);
    return 0;
  }
}

/**
 * Do‘kon mahsuloti (KV): har variantda `stock` va `stockQuantity` bir xil raqam bo‘lsin;
 * `stockQuantity` (mahsulot darajasi) — barcha variantlar yig‘indisi (seller panel «Ombor» bilan mos).
 * Oldin faqat birinchi variant olinardi — qolganlari 0 ko‘rinib «Tugagan» chiqarardi.
 */
function normalizeShopProductForPublicResponse(product: any): { base: any; totalStock: number } {
  const rawVars = Array.isArray(product?.variants) ? product.variants : [];
  if (rawVars.length === 0) {
    const t = Math.max(
      0,
      Math.floor(Number(product?.stock ?? product?.stockQuantity ?? product?.stockCount ?? 0)),
    );
    return { base: { ...product }, totalStock: Number.isFinite(t) ? t : 0 };
  }
  const normalizedVariants = rawVars.map((v: any) => {
    const st = Math.max(
      0,
      Math.floor(Number(v?.stock ?? v?.stockQuantity ?? v?.stockCount ?? 0)),
    );
    const n = Number.isFinite(st) ? st : 0;
    return { ...v, stock: n, stockQuantity: n };
  });
  const totalStock = normalizedVariants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  return { base: { ...product, variants: normalizedVariants }, totalStock };
}

// Get all products (Market + Shops combined)
app.get("/make-server-27d0d16c/products", async (c) => {
  try {
    const region = c.req.query('region');
    const district = c.req.query('district');
    
    console.log('📦 Loading ALL products (Market + Shops)...');
    console.log(`📍 Filter - Region: ${region}, District: ${district}`);
    
    // Get both Market products and Shop products
    const marketProducts = await kv.getByPrefix('product:');
    const shopProducts = await kv.getByPrefix('shop_product:');
    const allReviews = await kv.getByPrefix('review:product:');
    const reviewStats = new Map<string, { total: number; count: number }>();
    for (const review of allReviews) {
      if (!review || review.hidden) continue;
      const productId = String(review.productId || '').trim();
      if (!productId) continue;
      const current = reviewStats.get(productId) || { total: 0, count: 0 };
      current.total += Number(review.rating || 0);
      current.count += 1;
      reviewStats.set(productId, current);
    }
    
    console.log(`📦 Market products: ${marketProducts.length}`);
    console.log(`📦 Shop products: ${shopProducts.length}`);
    
    // Format Market products with region filter
    const formattedMarketProducts = marketProducts
      .filter((product: any) => {
        // Filter by region and district
        if (region && product.region && product.region !== region) return false;
        if (district && product.district && product.district !== district) return false;
        return true;
      })
      .map((product: any) => {
      const stats = reviewStats.get(String(product.id || ''));
      const rating = stats?.count ? Number((stats.total / stats.count).toFixed(1)) : Number(product.rating || 0);
      const reviewCount = stats?.count || Number(product.reviewCount || 0);
      return {
        ...product,
        source: 'market',
        price: product.price || 0,
        oldPrice: product.oldPrice || null,
        image: product.image || product.images?.[0] || null,
        stockQuantity: product.stock || 0,
        category: product.category || 'Market',
        rating,
        reviewCount,
        isNew: product.createdAt && new Date(product.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        isBestseller: product.isBestseller || false,
      };
    });
    
    // Format Shop products with region filter
    const formattedShopProducts = shopProducts
      .filter((p: any) => {
        if (!p || p.deleted) return false;
        // Filter by region and district
        if (region && p.region && p.region !== region) return false;
        if (district && p.district && p.district !== district) return false;
        return true;
      })
      .map((product: any) => {
        const { base, totalStock } = normalizeShopProductForPublicResponse(product);
        const firstVariant = base.variants?.[0];
        const stats = reviewStats.get(String(base.id || ''));
        const rating = stats?.count ? Number((stats.total / stats.count).toFixed(1)) : Number(base.rating || 0);
        const reviewCount = stats?.count || Number(base.reviewCount || 0);
        
        return {
          ...base,
          source: 'shop',
          price: firstVariant?.price || 0,
          oldPrice: firstVariant?.oldPrice || null,
          image: firstVariant?.images?.[0] || null,
          stockQuantity: totalStock,
          variantsCount: base.variants?.length || 0,
          category: base.category || 'Do\'kon',
          shopName: base.shopName || null, // Add shop name for display
          rating,
          reviewCount,
          isNew: base.createdAt && new Date(base.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          isBestseller: false,
        };
      });
    
    // Combine all products
    const allProducts = [...formattedMarketProducts, ...formattedShopProducts];
    
    console.log(`✅ Total products: ${allProducts.length} (${formattedMarketProducts.length} market + ${formattedShopProducts.length} shop)`);
    
    if (allProducts.length > 0) {
      console.log('📦 Sample product:', allProducts[0]);
    }

    return c.json({ success: true, products: allProducts });
  } catch (error: any) {
    console.error('Get all products error:', error);
    return c.json({ error: 'Mahsulotlarni olishda xatolik' }, 500);
  }
});

// Get single product
app.get("/make-server-27d0d16c/products/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const product = await kv.get(`product:${id}`);
    
    if (!product) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }

    return c.json({ product });
  } catch (error) {
    console.log('Get product error:', error);
    return c.json({ error: 'Mahsulotni olishda xatolik' }, 500);
  }
});

// Get product reviews
app.get("/make-server-27d0d16c/products/:id/reviews", async (c) => {
  try {
    const id = c.req.param('id');
    const reviews = await kv.getByPrefix(`review:product:${id}:`);
    const sorted = (Array.isArray(reviews) ? reviews : []).sort(
      (a: any, b: any) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
    );
    const includeHidden = String(c.req.query('includeHidden') || '') === '1';

    let listForResponse = sorted;
    if (!includeHidden) {
      listForResponse = sorted.filter((r: any) => !r?.hidden);
    } else {
      const admin = await validateAdminAccess(c);
      if (!admin.success) {
        return c.json({ success: false, error: admin.error || 'Admin ruxsati talab qilinadi' }, 403);
      }
    }

    const reviewCount = listForResponse.length;
    const averageRating = reviewCount
      ? Number((listForResponse.reduce((sum: number, r: any) => sum + Number(r?.rating || 0), 0) / reviewCount).toFixed(1))
      : 0;

    return c.json({ success: true, reviews: listForResponse, reviewCount, averageRating });
  } catch (error: any) {
    console.error('Get product reviews error:', error);
    return c.json({ success: false, error: 'Sharhlarni olishda xatolik' }, 500);
  }
});

// Create product review
app.post("/make-server-27d0d16c/products/:id/reviews", async (c) => {
  try {
    const id = c.req.param('id');
    const auth = await validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ success: false, error: auth.error || 'Avtorizatsiya talab qilinadi' }, 401);
    }
    const body = await c.req.json();
    const rating = Number(body?.rating);
    const text = String(body?.text || '').trim();
    const userProfile = await kv.get(`user:${auth.userId}`);
    const userName = String(
      body?.userName || userProfile?.name || userProfile?.firstName || userProfile?.phone || 'Foydalanuvchi'
    );

    if (!text) {
      return c.json({ success: false, error: 'Sharh matni bo‘sh bo‘lmasligi kerak' }, 400);
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return c.json({ success: false, error: 'Baholash 1 dan 5 gacha bo‘lishi kerak' }, 400);
    }

    const allOrders = await kv.getByPrefix('order:');
    const hasPurchased = (Array.isArray(allOrders) ? allOrders : []).some((order: any) => {
      if (!order || order.userId !== auth.userId) return false;
      if (String(order.status || '').toLowerCase() === 'cancelled') return false;
      const items = Array.isArray(order.items) ? order.items : [];
      return items.some((item: any) => String(item?.id || item?.productId || '') === String(id));
    });
    if (!hasPurchased) {
      return c.json({ success: false, error: 'Sharh yozish uchun mahsulotni oldin xarid qilgan bo‘lishingiz kerak' }, 403);
    }

    const now = new Date();
    const review = {
      id: Date.now(),
      productId: id,
      userName,
      userAvatar: '👤',
      rating,
      text,
      date: now.toISOString().split('T')[0],
      createdAt: now.toISOString(),
      likes: 0,
      dislikes: 0,
      replies: [],
      hidden: false,
      createdBy: auth.userId,
    };

    await kv.set(`review:product:${id}:${review.id}`, review);
    return c.json({ success: true, review });
  } catch (error: any) {
    console.error('Create product review error:', error);
    return c.json({ success: false, error: 'Sharh yuborishda xatolik' }, 500);
  }
});

// Admin review moderation
app.patch("/make-server-27d0d16c/products/:productId/reviews/:reviewId/moderate", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ success: false, error: admin.error }, 403);
    }
    const productId = c.req.param('productId');
    const reviewId = c.req.param('reviewId');
    const body = await c.req.json();
    const action = String(body?.action || '').toLowerCase(); // hide | restore | delete

    const key = `review:product:${productId}:${reviewId}`;
    const existing = await kv.get(key);
    if (!existing) {
      return c.json({ success: false, error: 'Sharh topilmadi' }, 404);
    }

    if (action === 'delete') {
      await kv.del(key);
      return c.json({ success: true, message: 'Sharh o‘chirildi' });
    }

    const hidden = action === 'hide' ? true : action === 'restore' ? false : null;
    if (hidden === null) {
      return c.json({ success: false, error: 'action: hide | restore | delete bo‘lishi kerak' }, 400);
    }

    const updated = {
      ...existing,
      hidden,
      moderatedAt: new Date().toISOString(),
      moderatedBy: admin.adminCode,
    };
    await kv.set(key, updated);
    return c.json({ success: true, review: updated });
  } catch (error: any) {
    console.error('Moderate review error:', error);
    return c.json({ success: false, error: 'Sharh moderatsiyasida xatolik' }, 500);
  }
});

// Create product (requires auth)
app.post("/make-server-27d0d16c/products", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: 'Avtorizatsiya talab qilinadi' }, 401);
    }

    const productData = await c.req.json();
    const productId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const product = {
      id: productId,
      ...productData,
      userId: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`product:${productId}`, product);

    return c.json({ product, message: 'Mahsulot qo\'shildi' });
  } catch (error) {
    console.log('Create product error:', error);
    return c.json({ error: 'Mahsulot qo\'shishda xatolik' }, 500);
  }
});

// Delete product (shop_product)
app.delete("/make-server-27d0d16c/products/:id", async (c) => {
  try {
    const id = c.req.param('id');
    
    console.log(`🗑️ Deleting product: ${id}`);
    
    // Try to find product in shop_product
    const shopProduct = await kv.get(`shop_product:${id}`);
    
    if (shopProduct) {
      const access = await validateShopMutationAccess(c, {
        branchId: shopProduct.branchId || null,
        shopId: shopProduct.shopId || null,
      });
      if (!access.success) {
        return c.json({ error: access.error }, 403);
      }

      await purgeAllManagedR2UrlsInRecord(shopProduct);
      await kv.del(`shop_product:${id}`);
      console.log('✅ Shop product deleted successfully');
      return c.json({ success: true, message: 'Mahsulot o\'chirildi' });
    }
    
    // If not found in shop_product, try branch product
    const branchProduct = await kv.get(`branchproduct:${id}`);
    
    if (branchProduct) {
      const admin = await validateAdminAccess(c);
      if (!admin.success) {
        return c.json({ error: admin.error }, 403);
      }

      await purgeAllManagedR2UrlsInRecord(branchProduct);
      await kv.del(`branchproduct:${id}`);
      console.log('✅ Branch product deleted successfully');
      return c.json({ success: true, message: 'Mahsulot o\'chirildi' });
    }
    
    // Product not found
    return c.json({ error: 'Mahsulot topilmadi' }, 404);
  } catch (error: any) {
    console.error('Delete product error:', error);
    return c.json({ error: 'Mahsulotni o\'chirishda xatolik' }, 500);
  }
});

// ==================== FOODS ROUTES ====================

// Get all foods
app.get("/make-server-27d0d16c/foods", async (c) => {
  try {
    const category = c.req.query('category');
    const foods = await kv.getByPrefix('food:');
    
    let filteredFoods = foods;
    if (category && category !== 'all') {
      filteredFoods = foods.filter((f: any) => f.category === category);
    }

    return c.json({ foods: filteredFoods });
  } catch (error) {
    console.log('Get foods error:', error);
    return c.json({ error: 'Taomlarni olishda xatolik' }, 500);
  }
});

// Get single food
app.get("/make-server-27d0d16c/foods/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const food = await kv.get(`food:${id}`);
    
    if (!food) {
      return c.json({ error: 'Taom topilmadi' }, 404);
    }

    return c.json({ food });
  } catch (error) {
    console.log('Get food error:', error);
    return c.json({ error: 'Taomni olishda xatolik' }, 500);
  }
});

// Create food (requires auth)
app.post("/make-server-27d0d16c/foods", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: 'Avtorizatsiya talab qilinadi' }, 401);
    }

    const foodData = await c.req.json();
    const foodId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const food = {
      id: foodId,
      ...foodData,
      userId: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`food:${foodId}`, food);

    return c.json({ food, message: 'Taom qo\'shildi' });
  } catch (error) {
    console.log('Create food error:', error);
    return c.json({ error: 'Taom qo\'shishda xatolik' }, 500);
  }
});

// ==================== BRANCHES ROUTES ====================

// Get all branches
app.get("/make-server-27d0d16c/branches", async (c) => {
  try {
    console.log('��� Fetching all branches...');
    const branches = await kv.getByPrefix('branch:');
    console.log(`✅ Found ${branches.length} branches`);
    return c.json({ branches });
  } catch (error) {
    console.log('Get branches error:', error);
    return c.json({ error: 'Filiallarni olishda xatolik' }, 500);
  }
});

// Get branches by region/district
app.get("/make-server-27d0d16c/branches/location", async (c) => {
  try {
    const regionId = c.req.query('regionId');
    const districtId = c.req.query('districtId');
    
    console.log(`🔍 Fetching branches for region: ${regionId}, district: ${districtId}`);
    
    const branches = await kv.getByPrefix('branch:');
    
    const filteredBranches = branches.filter((b: any) => {
      if (!b) return false;
      if (regionId && b.regionId !== regionId) return false;
      if (districtId && b.districtId !== districtId) return false;
      return true;
    });

    console.log(`✅ Found ${filteredBranches.length} branches in location`);
    return c.json({ branches: filteredBranches });
  } catch (error) {
    console.log('Get branches by location error:', error);
    return c.json({ error: 'Filiallarni olishda xatolik' }, 500);
  }
});

// Get single branch
app.get("/make-server-27d0d16c/branches/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`🔍 Fetching branch: ${id}`);
    
    const branch = await kv.get(`branch:${id}`);
    
    if (!branch) {
      return c.json({ error: 'Filial topilmadi' }, 404);
    }
    
    console.log(`✅ Branch found: ${branch.name}`);
    return c.json({ branch });
  } catch (error) {
    console.log('Get branch error:', error);
    return c.json({ error: 'Filialni olishda xatolik' }, 500);
  }
});

// Create branch (admin only)
app.post("/make-server-27d0d16c/branches", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    const body = await c.req.json();
    const { 
      name, 
      login, 
      password, 
      branchName, 
      regionId, 
      regionName, 
      districtId, 
      districtName,
      phone,
      managerName,
      openDate,
      coordinates,
      paymentQrImage,
    } = body;
    
    console.log('📝 Creating branch:', name);
    console.log('📞 Phone:', phone);
    console.log('👤 Manager:', managerName);
    
    // Generate unique ID
    const branchId = `branch_${Date.now()}`;
    
    const branch = {
      id: branchId,
      name,
      login,
      password,
      branchName,
      regionId,
      regionName,
      districtId,
      districtName,
      phone: phone || '',
      managerName: managerName || '',
      openDate: openDate || '',
      coordinates: coordinates || { lat: 0, lng: 0 },
      paymentQrImage: String(paymentQrImage || '').trim(),
      createdAt: new Date().toISOString(),
    };

    await kv.set(`branch:${branchId}`, branch);
    
    console.log(`✅ Branch created: ${branchId}`, branch);
    return c.json({ branch, message: 'Filial qo\'shildi' });
  } catch (error) {
    console.log('Create branch error:', error);
    return c.json({ error: 'Filial qo\'shishda xatolik' }, 500);
  }
});

// Update branch
app.put("/make-server-27d0d16c/branches/:id", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    
    console.log(`📝 Updating branch: ${id}`);
    
    const existingBranch = await kv.get(`branch:${id}`);
    
    if (!existingBranch) {
      return c.json({ error: 'Filial topilmadi' }, 404);
    }
    
    const updatedBranch = {
      ...existingBranch,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`branch:${id}`, updatedBranch);
    
    console.log(`✅ Branch updated: ${id}`);
    return c.json({ branch: updatedBranch, message: 'Filial yangilandi' });
  } catch (error) {
    console.log('Update branch error:', error);
    return c.json({ error: 'Filialni yangilashda xatolik' }, 500);
  }
});

// Delete branch
app.delete("/make-server-27d0d16c/branches/:id", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    const id = c.req.param('id');
    
    console.log(`🗑️ Deleting branch and all related data: ${id}`);
    
    const branch = await kv.get(`branch:${id}`);
    
    if (!branch) {
      return c.json({ error: 'Filial topilmadi' }, 404);
    }
    
    // 1. Delete all branch products (Market products)
    console.log('🗑️ Step 1: Deleting branch products (Market)...');
    const allBranchProducts = await kv.getByPrefix('branchproduct:');
    const branchProducts = allBranchProducts.filter((p: any) => p.branchId === id);
    
    for (const product of branchProducts) {
      await purgeAllManagedR2UrlsInRecord(product);
      await kv.del(`branchproduct:${product.id}`);
    }
    console.log(`✅ Deleted ${branchProducts.length} branch products`);
    
    // 2. Get all shops belonging to this branch
    console.log('🗑️ Step 2: Finding shops belonging to this branch...');
    const allShops = await kv.getByPrefix('shop:');
    const branchShops = allShops.filter((s: any) => s.branchId === id);
    console.log(`📍 Found ${branchShops.length} shops for this branch`);
    
    // 3. Delete all shop products and orders for each shop
    let totalShopProducts = 0;
    let totalShopOrders = 0;
    
    for (const shop of branchShops) {
      console.log(`🗑️ Step 3: Deleting data for shop: ${shop.id} (${shop.name})...`);
      
      // Delete shop products
      const allShopProducts = await kv.getByPrefix('shop_product:');
      const shopProducts = allShopProducts.filter((p: any) => p.shopId === shop.id);
      
      for (const product of shopProducts) {
        await purgeAllManagedR2UrlsInRecord(product);
        await kv.del(`shop_product:${product.id}`);
        totalShopProducts++;
      }
      
      // Delete shop orders
      const allShopOrders = await kv.getByPrefix('shop_order:');
      const shopOrders = allShopOrders.filter((o: any) => o.shopId === shop.id);
      
      for (const order of shopOrders) {
        await kv.del(`shop_order:${order.id}`);
        totalShopOrders++;
      }
      
      console.log(`  ✅ Shop ${shop.id}: Deleted ${shopProducts.length} products, ${shopOrders.length} orders`);
    }
    
    // 4. Delete all shops
    console.log('🗑️ Step 4: Deleting shops...');
    for (const shop of branchShops) {
      await purgeAllManagedR2UrlsInRecord(shop);
      await kv.del(`shop:${shop.id}`);
    }
    console.log(`✅ Deleted ${branchShops.length} shops`);
    
    // 5. Delete the branch itself
    console.log('🗑️ Step 5: Deleting branch...');
    await purgeAllManagedR2UrlsInRecord(branch);
    await kv.del(`branch:${id}`);
    
    const summary = {
      branchId: id,
      branchName: branch.name,
      deleted: {
        branchProducts: branchProducts.length,
        shops: branchShops.length,
        shopProducts: totalShopProducts,
        shopOrders: totalShopOrders,
      }
    };
    
    console.log('✅ ========================================');
    console.log('✅ BRANCH DELETION COMPLETE');
    console.log('✅ Summary:', JSON.stringify(summary, null, 2));
    console.log('✅ ========================================');
    
    return c.json({ 
      success: true,
      message: 'Filial va barcha bog\'liq ma\'lumotlar o\'chirildi',
      summary 
    });
  } catch (error) {
    console.log('Delete branch error:', error);
    return c.json({ error: 'Filialni o\'chirishda xatolik' }, 500);
  }
});

// ==================== BRANCH PRODUCTS ROUTES ====================

// Get all branch products
app.get("/make-server-27d0d16c/branch-products", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    const regionId = c.req.query('regionId');
    const districtId = c.req.query('districtId');
    const includeSold = c.req.query('includeSold') === 'true';
    
    console.log('📦 Fetching branch products...', { branchId, regionId, districtId });
    
    let products = await kv.getByPrefix('branchproduct:');
    
    if (branchId) {
      products = products.filter((p: any) => p.branchId === branchId);
    }
    
    if (regionId || districtId) {
      const branches = await kv.getByPrefix('branch:');
      const localBranches = branches.filter((b: any) => {
        if (regionId && b.regionId !== regionId) return false;
        if (districtId && b.districtId !== districtId) return false;
        return true;
      });
      
      const localBranchIds = localBranches.map((b: any) => b.id);
      products = products.filter((p: any) => localBranchIds.includes(p.branchId));
      
      console.log(`✅ Found ${products.length} products from ${localBranches.length} branches in location`);
    }
    
    if (includeSold) {
      // Calculate soldThisWeek only when explicitly requested.
      for (const product of products) {
        if (product.variants && Array.isArray(product.variants)) {
          for (const variant of product.variants) {
            variant.soldThisWeek = await calculateSoldThisWeek(product.id, variant.id);
          }
        }
      }
    } else {
      for (const product of products) {
        if (product.variants && Array.isArray(product.variants)) {
          for (const variant of product.variants) {
            variant.soldThisWeek = Number(variant.soldThisWeek || 0);
          }
        }
      }
    }
    
    console.log(`✅ Found ${products.length} branch products`);
    return c.json({ products });
  } catch (error) {
    console.log('Get branch products error:', error);
    return c.json({ error: 'Mahsulotlarni olishda xatolik' }, 500);
  }
});

// Get single branch product
app.get("/make-server-27d0d16c/branch-products/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const includeSold = c.req.query('includeSold') === 'true';
    console.log(`🔍 Fetching product: ${id}`);
    
    const product = await kv.get(`branchproduct:${id}`);
    
    if (!product) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }
    
    if (product.variants && Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        variant.soldThisWeek = includeSold
          ? await calculateSoldThisWeek(id, variant.id)
          : Number(variant.soldThisWeek || 0);
      }
    }
    
    console.log(`✅ Product found: ${product.name}`);
    return c.json({ product });
  } catch (error) {
    console.log('Get product error:', error);
    return c.json({ error: 'Mahsulotni olishda xatolik' }, 500);
  }
});

// Create branch product
app.post("/make-server-27d0d16c/branch-products", async (c) => {
  try {
    const body = await c.req.json();
    const { name, catalogId, categoryId, branchId, branchName, description, recommendation, variants } = body;
    
    console.log('📝 Creating product:', name);
    
    const productId = `prod_${Date.now()}`;
    
    const product = {
      id: productId,
      name,
      catalogId,
      categoryId,
      branchId,
      branchName,
      description: description || '',
      recommendation: recommendation || '',
      variants: variants || [],
      createdAt: new Date().toISOString(),
    };

    await kv.set(`branchproduct:${productId}`, product);
    
    console.log(`✅ Product created: ${productId}`);
    return c.json({ product, message: 'Mahsulot qo\'shildi' });
  } catch (error) {
    console.log('Create product error:', error);
    return c.json({ error: 'Mahsulot qo\'shishda xatolik' }, 500);
  }
});

// Update branch product
app.put("/make-server-27d0d16c/branch-products/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    console.log(`📝 Updating product: ${id}`);
    
    const existingProduct = await kv.get(`branchproduct:${id}`);
    
    if (!existingProduct) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }
    
    const updatedProduct = {
      ...existingProduct,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };

    await purgeRemovedR2Urls(existingProduct, updatedProduct);
    await kv.set(`branchproduct:${id}`, updatedProduct);
    
    console.log(`✅ Product updated: ${id}`);
    return c.json({ product: updatedProduct, message: 'Mahsulot yangilandi' });
  } catch (error) {
    console.log('Update product error:', error);
    return c.json({ error: 'Mahsulotni yangilashda xatolik' }, 500);
  }
});

// Delete branch product
app.delete("/make-server-27d0d16c/branch-products/:id", async (c) => {
  try {
    const id = c.req.param('id');
    
    console.log(`🗑️ Deleting product: ${id}`);
    
    const product = await kv.get(`branchproduct:${id}`);
    
    if (!product) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }
    
    await purgeAllManagedR2UrlsInRecord(product);
    await kv.del(`branchproduct:${id}`);
    
    console.log(`✅ Product deleted: ${id}`);
    return c.json({ message: 'Mahsulot o\'chirildi' });
  } catch (error) {
    console.log('Delete product error:', error);
    return c.json({ error: 'Mahsulotni o\'chirishda xatolik' }, 500);
  }
});

// Update product stock
app.patch("/make-server-27d0d16c/branch-products/:id/stock", async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { variantId, stockQuantity } = body;
    
    console.log(`📦 Updating stock for product: ${id}, variant: ${variantId}, newQuantity: ${stockQuantity}`);
    
    const product = await kv.get(`branchproduct:${id}`);
    
    if (!product) {
      console.error(`❌ Product not found: ${id}`);
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }
    
    const updatedVariants = product.variants.map((v: any) => {
      if (v.id === variantId) {
        console.log(`📦 Updating variant ${variantId}: ${v.stockQuantity} → ${stockQuantity}`);
        return { ...v, stockQuantity };
      }
      return v;
    });
    
    const updatedProduct = {
      ...product,
      variants: updatedVariants,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`branchproduct:${id}`, updatedProduct);
    
    console.log(`✅ Stock updated for product: ${id}`);
    return c.json({ product: updatedProduct, message: 'Ombor yangilandi' });
  } catch (error) {
    console.error('❌ Update stock error:', error);
    return c.json({ error: 'Omborni yangilashda xatolik' }, 500);
  }
});

// ==================== ADMIN USERS ROUTES ====================

const ADMIN_USER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLegacyUserProfileKvKey(key: string): boolean {
  const k = String(key || "");
  const parts = k.split(":");
  return parts.length === 2 && parts[0] === "user" && Boolean(parts[1]);
}

function relationalAccountStatusToAdminStatus(
  status: string | null | undefined,
  kvBlocked?: boolean,
): "active" | "blocked" {
  if (kvBlocked) return "blocked";
  const s = String(status || "").toLowerCase();
  if (s === "suspended" || s === "archived" || s === "inactive") {
    return "blocked";
  }
  return "active";
}

function normalizeAdminUserNames(profile: any, rel?: any) {
  const firstName =
    profile?.firstName ||
    profile?.first_name ||
    rel?.first_name ||
    (typeof profile?.name === "string"
      ? String(profile.name).trim().split(/\s+/)[0]
      : "") ||
    (rel?.display_name
      ? String(rel.display_name).trim().split(/\s+/)[0]
      : "") ||
    "";
  const lastName =
    profile?.lastName ||
    profile?.last_name ||
    rel?.last_name ||
    (typeof profile?.name === "string"
      ? String(profile.name).trim().split(/\s+/).slice(1).join(" ")
      : "") ||
    (rel?.display_name
      ? String(rel.display_name).trim().split(/\s+/).slice(1).join(" ")
      : "") ||
    "";
  return { firstName, lastName };
}

async function fetchOrderAggregatesByRelationalUserId(): Promise<
  Map<string, { ordersCount: number; paidTotal: number }>
> {
  const map = new Map<string, { ordersCount: number; paidTotal: number }>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("orders")
      .select("user_id, total_amount, status, payment_status")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("admin users: orders aggregate error", error);
      break;
    }
    if (!data?.length) break;
    for (const row of data as any[]) {
      const uid = String(row.user_id || "");
      if (!uid) continue;
      const st = String(row.status || "");
      const pay = String(row.payment_status || "");
      const cur = map.get(uid) || { ordersCount: 0, paidTotal: 0 };
      if (st !== "cancelled" && st !== "refunded") {
        cur.ordersCount += 1;
      }
      if (
        pay === "paid" ||
        pay === "authorized" ||
        pay === "partially_refunded"
      ) {
        cur.paidTotal += Number(row.total_amount) || 0;
      }
      map.set(uid, cur);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

// Get all users (admin only)
app.get("/make-server-27d0d16c/admin/users", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    console.log("👥 Fetching all users for admin (KV + relational)...");

    const orderAgg = await fetchOrderAggregatesByRelationalUserId();

    const { data: relUsers, error: relErr } = await supabase
      .from("users")
      .select(
        "id, legacy_kv_key, phone, email, first_name, last_name, display_name, status, role, created_at, updated_at, user_profiles(bonus_balance)",
      )
      .is("deleted_at", null)
      .eq("role", "buyer");

    if (relErr) {
      console.error("admin users: relational users error", relErr);
    }

    const relByLegacyKey = new Map<string, any>();
    for (const row of relUsers || []) {
      const lk = row?.legacy_kv_key ? String(row.legacy_kv_key).trim() : "";
      if (lk) relByLegacyKey.set(lk, row);
    }

    const kvRows = await kv.getByPrefixWithKeys("user:");
    const profileRows = kvRows.filter((r) => isLegacyUserProfileKvKey(r.key));

    const seenLegacyKeys = new Set<string>();
    const enrichedUsers: any[] = [];

    for (const { key, value: rawProfile } of profileRows) {
      const bareId = key.slice("user:".length);
      const legacyKey = `user:${bareId}`;
      seenLegacyKeys.add(legacyKey);

      const profile = {
        ...(typeof rawProfile === "object" && rawProfile ? rawProfile : {}),
        id: bareId,
      };

      const rel = relByLegacyKey.get(legacyKey);
      const relId = rel?.id ? String(rel.id) : "";
      const pgBonus = Number(rel?.user_profiles?.bonus_balance ?? NaN);
      const bonusData = (await kv.get(`user:${bareId}:bonus`)) || {
        balance: 0,
        totalEarned: 0,
      };

      const purchases = await kv.getByPrefix(`user:${bareId}:purchase:`);
      let kvSpent = 0;
      purchases.forEach((purchase: any) => {
        kvSpent += Number(purchase?.amount) || 0;
      });

      const agg = relId ? orderAgg.get(relId) : undefined;
      const pgCount = agg?.ordersCount ?? 0;
      const pgPaid = agg?.paidTotal ?? 0;

      const { firstName, lastName } = normalizeAdminUserNames(profile, rel);

      enrichedUsers.push({
        ...profile,
        firstName,
        lastName,
        phone: profile.phone || rel?.phone || "",
        email: profile.email || rel?.email || "",
        bonusBalance: Number.isFinite(pgBonus) && pgBonus > 0
          ? pgBonus
          : Number(bonusData.balance) || 0,
        totalBonusEarned: Number(bonusData.totalEarned) || 0,
        purchasesCount: pgCount + purchases.length,
        totalSpent: pgPaid + kvSpent,
        status: relationalAccountStatusToAdminStatus(
          rel?.status,
          Boolean(profile.blocked),
        ),
        createdAt:
          profile.createdAt ||
          rel?.created_at ||
          new Date().toISOString(),
        updatedAt: profile.updatedAt || rel?.updated_at,
        relationalUserId: relId || undefined,
      });
    }

    for (const rel of relUsers || []) {
      const lk = rel?.legacy_kv_key ? String(rel.legacy_kv_key).trim() : "";
      if (lk && seenLegacyKeys.has(lk)) continue;

      const relId = String(rel.id || "");
      if (!relId) continue;

      const agg = orderAgg.get(relId) || { ordersCount: 0, paidTotal: 0 };
      const pgBonus = Number(rel?.user_profiles?.bonus_balance ?? 0);

      const { firstName, lastName } = normalizeAdminUserNames({}, rel);

      enrichedUsers.push({
        id: relId,
        phone: rel.phone || "",
        email: rel.email || "",
        firstName,
        lastName,
        profileImage: undefined,
        bonusBalance: Number.isFinite(pgBonus) ? pgBonus : 0,
        totalBonusEarned: 0,
        purchasesCount: agg.ordersCount,
        totalSpent: agg.paidTotal,
        status: relationalAccountStatusToAdminStatus(rel.status, false),
        createdAt: rel.created_at || new Date().toISOString(),
        updatedAt: rel.updated_at,
        relationalOnly: true,
        relationalUserId: relId,
      });
    }

    enrichedUsers.sort((a: any, b: any) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });

    console.log(`✅ Found ${enrichedUsers.length} users`);
    return c.json({
      success: true,
      users: enrichedUsers,
      total: enrichedUsers.length,
    });
  } catch (error: any) {
    console.error("Get users error:", error);
    return c.json({ error: "Foydalanuvchilarni olishda xatolik" }, 500);
  }
});

// Get user details (admin only)
app.get("/make-server-27d0d16c/admin/users/:userId", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    const userId = c.req.param("userId");
    console.log("👤 Fetching user details:", userId);

    let kvBareId = userId;
    let user: any = await kv.get(`user:${userId}`);

    let rel: any = null;
    if (ADMIN_USER_UUID_RE.test(userId)) {
      const { data: relRow } = await supabase
        .from("users")
        .select(
          "id, legacy_kv_key, phone, email, first_name, last_name, display_name, status, role, created_at, updated_at, user_profiles(bonus_balance)",
        )
        .eq("id", userId)
        .maybeSingle();
      rel = relRow;
    }

    if (!user && rel?.legacy_kv_key) {
      const legacy = String(rel.legacy_kv_key).trim();
      const bare = legacy.startsWith("user:")
        ? legacy.slice("user:".length)
        : legacy;
      if (bare) {
        kvBareId = bare;
        user = await kv.get(`user:${bare}`);
      }
    }

    if (!user && rel && String(rel.role || "") === "buyer") {
      const { firstName, lastName } = normalizeAdminUserNames({}, rel);
      const pgBonus = Number(rel?.user_profiles?.bonus_balance ?? 0);
      const { data: orderRows } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, payment_status, total_amount, created_at, item_count",
        )
        .eq("user_id", rel.id)
        .order("created_at", { ascending: false });

      const purchases = (orderRows || []).map((o: any) => ({
        productName: `Buyurtma ${o.order_number || String(o.id).slice(0, 8)}`,
        amount: Number(o.total_amount) || 0,
        date: o.created_at,
        orderId: o.id,
        status: o.status,
        paymentStatus: o.payment_status,
        itemCount: o.item_count,
      }));

      let totalSpent = 0;
      purchases.forEach((p: any) => {
        if (
          p.paymentStatus === "paid" ||
          p.paymentStatus === "authorized" ||
          p.paymentStatus === "partially_refunded"
        ) {
          totalSpent += Number(p.amount) || 0;
        }
      });

      const userDetails = {
        id: String(rel.id),
        phone: rel.phone || "",
        email: rel.email || "",
        firstName,
        lastName,
        profileImage: undefined,
        bonus: {
          balance: Number.isFinite(pgBonus) ? pgBonus : 0,
          earnedToday: 0,
          totalEarned: 0,
          tapCount: 0,
        },
        favorites: [],
        cart: [],
        purchases,
        purchasesCount: purchases.filter((p: any) =>
          p.status !== "cancelled" && p.status !== "refunded"
        ).length,
        totalSpent,
        status: relationalAccountStatusToAdminStatus(rel.status, false),
        createdAt: rel.created_at,
        updatedAt: rel.updated_at,
        relationalOnly: true,
      };

      console.log("✅ User details loaded (relational)");
      return c.json({ success: true, user: userDetails });
    }

    if (!user) {
      return c.json({ error: "Foydalanuvchi topilmadi" }, 404);
    }

    const bonusData = (await kv.get(`user:${kvBareId}:bonus`)) || {
      balance: 0,
      earnedToday: 0,
      totalEarned: 0,
      tapCount: 0,
    };

    const favorites = (await kv.get(`user:${kvBareId}:favorites`)) || [];
    const cart = (await kv.get(`user:${kvBareId}:cart`)) || [];

    const purchases = await kv.getByPrefix(`user:${kvBareId}:purchase:`);

    let kvSpent = 0;
    purchases.forEach((purchase: any) => {
      kvSpent += Number(purchase?.amount) || 0;
    });

    purchases.sort((a: any, b: any) => {
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    });

    const legacyKey = `user:${kvBareId}`;
    if (!rel && legacyKey) {
      const { data: relRow } = await supabase
        .from("users")
        .select(
          "id, legacy_kv_key, phone, email, first_name, last_name, display_name, status, user_profiles(bonus_balance)",
        )
        .eq("legacy_kv_key", legacyKey)
        .maybeSingle();
      rel = relRow;
    }

    const relId = rel?.id ? String(rel.id) : "";
    let pgPurchases: any[] = [];
    let pgPaidTotal = 0;
    let pgOrderCount = 0;
    if (relId) {
      const { data: orderRows } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, payment_status, total_amount, created_at, item_count",
        )
        .eq("user_id", relId)
        .order("created_at", { ascending: false });
      pgPurchases = (orderRows || []).map((o: any) => ({
        productName: `Buyurtma ${o.order_number || String(o.id).slice(0, 8)}`,
        amount: Number(o.total_amount) || 0,
        date: o.created_at,
        orderId: o.id,
        status: o.status,
        paymentStatus: o.payment_status,
        itemCount: o.item_count,
        source: "relational",
      }));
      for (const p of pgPurchases) {
        if (p.status !== "cancelled" && p.status !== "refunded") {
          pgOrderCount += 1;
        }
        if (
          p.paymentStatus === "paid" ||
          p.paymentStatus === "authorized" ||
          p.paymentStatus === "partially_refunded"
        ) {
          pgPaidTotal += Number(p.amount) || 0;
        }
      }
    }

    const mergedPurchases = [...pgPurchases, ...purchases].sort(
      (a: any, b: any) =>
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
    );

    const pgBonus = Number(rel?.user_profiles?.bonus_balance ?? NaN);
    const mergedBonus = {
      ...bonusData,
      balance: Number.isFinite(pgBonus) && pgBonus > 0
        ? pgBonus
        : Number(bonusData.balance) || 0,
    };

    const { firstName, lastName } = normalizeAdminUserNames(user, rel);

    const userDetails = {
      ...user,
      id: kvBareId,
      firstName,
      lastName,
      phone: user.phone || rel?.phone || "",
      email: user.email || rel?.email || "",
      bonus: mergedBonus,
      favorites,
      cart,
      purchases: mergedPurchases,
      purchasesCount: pgOrderCount + purchases.length,
      totalSpent: pgPaidTotal + kvSpent,
      status: relationalAccountStatusToAdminStatus(
        rel?.status,
        Boolean(user.blocked),
      ),
    };

    console.log("✅ User details loaded");
    return c.json({
      success: true,
      user: userDetails,
    });
  } catch (error: any) {
    console.error("Get user details error:", error);
    return c.json(
      { error: "Foydalanuvchi ma'lumotlarini olishda xatolik" },
      500,
    );
  }
});

// Block/Unblock user (admin only)
app.patch("/make-server-27d0d16c/admin/users/:userId/status", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    const userId = c.req.param("userId");
    const { blocked } = await c.req.json();

    console.log(`🔒 ${blocked ? "Blocking" : "Unblocking"} user:`, userId);

    const user = await kv.get(`user:${userId}`);

    if (user) {
      const updatedUser = {
        ...user,
        blocked: blocked,
        blockedAt: blocked ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`user:${userId}`, updatedUser);

      const legacyKey = `user:${userId}`;
      const { data: relRow } = await supabase
        .from("users")
        .select("id")
        .eq("legacy_kv_key", legacyKey)
        .maybeSingle();
      if (relRow?.id) {
        const newStatus = blocked ? "suspended" : "active";
        await supabase
          .from("users")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", relRow.id);
      }

      console.log(`✅ User ${blocked ? "blocked" : "unblocked"} (KV)`);
      return c.json({
        success: true,
        user: updatedUser,
        message: blocked
          ? "Foydalanuvchi bloklandi"
          : "Foydalanuvchi aktivlashtirildi",
      });
    }

    let relationalId: string | null = null;
    if (ADMIN_USER_UUID_RE.test(userId)) {
      relationalId = userId;
    } else {
      const { data: relByLegacy } = await supabase
        .from("users")
        .select("id")
        .eq("legacy_kv_key", `user:${userId}`)
        .maybeSingle();
      relationalId = relByLegacy?.id ? String(relByLegacy.id) : null;
    }

    if (relationalId) {
      const newStatus = blocked ? "suspended" : "active";
      const { data: updated, error: upErr } = await supabase
        .from("users")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", relationalId)
        .eq("role", "buyer")
        .select(
          "id, phone, email, first_name, last_name, display_name, status, created_at, updated_at",
        )
        .maybeSingle();

      if (upErr || !updated) {
        return c.json({ error: "Foydalanuvchi topilmadi" }, 404);
      }

      const { firstName, lastName } = normalizeAdminUserNames({}, updated);
      console.log(`✅ User ${blocked ? "blocked" : "unblocked"} (relational)`);
      return c.json({
        success: true,
        user: {
          id: String(updated.id),
          firstName,
          lastName,
          phone: updated.phone || "",
          email: updated.email || "",
          status: relationalAccountStatusToAdminStatus(updated.status, false),
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
          relationalOnly: true,
        },
        message: blocked
          ? "Foydalanuvchi bloklandi"
          : "Foydalanuvchi aktivlashtirildi",
      });
    }

    return c.json({ error: "Foydalanuvchi topilmadi" }, 404);
  } catch (error: any) {
    console.error("Update user status error:", error);
    return c.json(
      { error: "Foydalanuvchi holatini o'zgartirishda xatolik" },
      500,
    );
  }
});

// Delete user (admin only)
app.delete("/make-server-27d0d16c/admin/users/:userId", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    const userId = c.req.param('userId');
    
    console.log('🗑️ Deleting user and all related data:', userId);
    
    // Get user profile
    const user = await kv.get(`user:${userId}`);
    
    if (!user) {
      return c.json({ error: 'Foydalanuvchi topilmadi' }, 404);
    }
    
    // Delete user profile
    await kv.del(`user:${userId}`);
    
    // Delete phone mapping
    if (user.phone) {
      await kv.del(`user_phone:${user.phone}`);
    }
    
    // Delete all user-related data
    await kv.del(`user:${userId}:favorites`);
    await kv.del(`user:${userId}:cart`);
    await kv.del(`user:${userId}:bonus`);
    await kv.del(`user:${userId}:settings`);
    
    // Delete all purchase history
    const purchases = await kv.getByPrefix(`user:${userId}:purchase:`);
    for (const purchase of purchases) {
      await kv.del(`user:${userId}:purchase:${purchase.id}`);
    }
    
    // Delete all access tokens
    const allTokens = await kv.getByPrefix('access_token:');
    for (const token of allTokens) {
      if (token.userId === userId) {
        const tokenKey = `access_token:${token.id}`;
        await kv.del(tokenKey);
      }
    }
    
    console.log(`✅ User deleted: ${userId}`);
    return c.json({ 
      success: true,
      message: 'Foydalanuvchi va barcha ma\'lumotlar o\'chirildi',
    });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return c.json({ error: 'Foydalanuvchini o\'chirishda xatolik' }, 500);
  }
});

// ==================== INVENTORY HISTORY ROUTES ====================

// Get inventory history
app.get("/make-server-27d0d16c/inventory-history", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    const productId = c.req.query('productId');
    
    console.log('📦 Fetching inventory history...', { branchId, productId });
    
    let history = await kv.getByPrefix('inventory_history:');
    
    if (branchId) {
      history = history.filter((h: any) => h.branchId === branchId);
    }
    
    if (productId) {
      history = history.filter((h: any) => h.productId === productId);
    }
    
    // Sort by date (newest first)
    history.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`✅ Found ${history.length} inventory history records`);
    return c.json({ history });
  } catch (error) {
    console.log('Get inventory history error:', error);
    return c.json({ error: 'Ombor tarixini olishda xatolik' }, 500);
  }
});

// Add inventory history record
app.post("/make-server-27d0d16c/inventory-history", async (c) => {
  try {
    const body = await c.req.json();
    const { branchId, productId, productName, variantId, variantName, type, quantity, reason, note } = body;
    
    console.log('📝 Adding inventory history:', { productName, type, quantity });
    
    const historyId = `inv_hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const history = {
      id: historyId,
      branchId,
      productId,
      productName,
      variantId,
      variantName,
      type, // 'add' | 'remove' | 'sale' | 'return' | 'adjust'
      quantity,
      reason: reason || '',
      note: note || '',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`inventory_history:${historyId}`, history);
    
    console.log(`✅ Inventory history added: ${historyId}`);
    return c.json({ history, message: 'Tarix qo\'shildi' });
  } catch (error) {
    console.log('Create inventory history error:', error);
    return c.json({ error: 'Tarix qo\'shishda xatolik' }, 500);
  }
});

// ==================== SALES HISTORY ROUTES ====================

// Get sales history
app.get("/make-server-27d0d16c/sales-history", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    const productId = c.req.query('productId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    
    console.log('💰 Fetching sales history...', { branchId, productId, startDate, endDate });
    
    let sales = await kv.getByPrefix('sale:');
    
    if (branchId) {
      sales = sales.filter((s: any) => s.branchId === branchId);
    }
    
    if (productId) {
      sales = sales.filter((s: any) => {
        return s.items?.some((item: any) => item.productId === productId);
      });
    }
    
    if (startDate) {
      sales = sales.filter((s: any) => new Date(s.createdAt) >= new Date(startDate));
    }
    
    if (endDate) {
      sales = sales.filter((s: any) => new Date(s.createdAt) <= new Date(endDate));
    }
    
    // Sort by date (newest first)
    sales.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`✅ Found ${sales.length} sales records`);
    return c.json({ sales });
  } catch (error) {
    console.log('Get sales history error:', error);
    return c.json({ error: 'Sotuv tarixini olishda xatolik' }, 500);
  }
});

// Create sale
app.post("/make-server-27d0d16c/sales", async (c) => {
  try {
    const body = await c.req.json();
    const { branchId, branchName, items, subtotal, tax, total, paymentMethod, customerInfo, type } = body;
    
    console.log('💰 Creating sale:', { branchName, total, itemCount: items?.length, type: type || 'offline' });
    
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    const now = new Date();
    
    const sale = {
      id: saleId,
      branchId,
      branchName,
      items, // Array of { productId, productName, variantId, variantName, quantity, price, total }
      subtotal,
      tax: tax || 0,
      total,
      paymentMethod, // 'cash' | 'card' | 'transfer' | 'click' | 'payme' | 'uzum' | 'humo'
      type: type || 'offline', // 'online' | 'offline'
      customerInfo: customerInfo || null,
      date: now.toLocaleDateString('uz-UZ'),
      timestamp: timestamp,
      createdAt: new Date().toISOString(),
    };

    console.log('💾 Saving sale to KV:', { id: saleId, type: sale.type, timestamp, date: sale.date });
    await kv.set(`sale:${saleId}`, sale);
    
    // Update inventory for each item
    for (const item of items) {
      const product = await kv.get(`branchproduct:${item.productId}`);
      if (product) {
        const updatedVariants = product.variants.map((v: any) => {
          if (v.id === item.variantId) {
            return { ...v, stockQuantity: (v.stockQuantity || 0) - item.quantity };
          }
          return v;
        });
        
        await kv.set(`branchproduct:${item.productId}`, {
          ...product,
          variants: updatedVariants,
          updatedAt: new Date().toISOString(),
        });
        
        // Add inventory history
        const historyId = `inv_hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await kv.set(`inventory_history:${historyId}`, {
          id: historyId,
          branchId,
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId,
          variantName: item.variantName,
          type: 'sale',
          quantity: item.quantity,
          reason: 'Sotuv',
          note: `Sotuv ID: ${saleId}`,
          createdAt: new Date().toISOString(),
        });
      }
    }
    
    console.log(`✅ Sale created: ${saleId}`);
    return c.json({ sale, message: 'Sotuv muvaffaqiyatli amalga oshirildi' });
  } catch (error) {
    console.log('Create sale error:', error);
    return c.json({ error: 'Sotuv amalga oshirishda xatolik' }, 500);
  }
});

// Get sale statistics
app.get("/make-server-27d0d16c/sales/stats", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    
    console.log('📊 Fetching sales stats...', { branchId, startDate, endDate });
    
    let sales = await kv.getByPrefix('sale:');
    
    if (branchId) {
      sales = sales.filter((s: any) => s.branchId === branchId);
    }
    
    if (startDate) {
      sales = sales.filter((s: any) => new Date(s.createdAt) >= new Date(startDate));
    }
    
    if (endDate) {
      sales = sales.filter((s: any) => new Date(s.createdAt) <= new Date(endDate));
    }
    
    const stats = {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0),
      totalTax: sales.reduce((sum: number, s: any) => sum + (s.tax || 0), 0),
      totalSubtotal: sales.reduce((sum: number, s: any) => sum + (s.subtotal || 0), 0),
      averageSale: sales.length > 0 ? sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0) / sales.length : 0,
      paymentMethods: {} as Record<string, number>,
    };
    
    // Count payment methods
    sales.forEach((s: any) => {
      const method = s.paymentMethod || 'unknown';
      stats.paymentMethods[method] = (stats.paymentMethods[method] || 0) + 1;
    });
    
    console.log(`✅ Stats calculated for ${sales.length} sales`);
    return c.json({ stats });
  } catch (error) {
    console.log('Get sales stats error:', error);
    return c.json({ error: 'Statistikani olishda xatolik' }, 500);
  }
});

// ==================== PORTFOLIO ROUTES ====================

// Get all portfolios with optimized filtering
app.get("/make-server-27d0d16c/services/portfolios", async (c) => {
  try {
    const region = c.req.query('region');
    const district = c.req.query('district');
    const profession = c.req.query('profession');
    
    console.log(`🔍 Fetching portfolios with filters - region: ${region || 'all'}, district: ${district || 'all'}, profession: ${profession || 'all'}`);
    
    const portfolios = await kv.getByPrefix('portfolio:');
    
    // Optimized filtering - single pass
    const filteredPortfolios = portfolios.filter((p: any) => {
      if (!p) return false;
      if (region && p.region !== region) return false;
      if (district && p.district !== district) return false;
      if (profession && p.profession !== profession) return false;
      return true;
    });

    console.log(`✅ Filtered portfolios: ${filteredPortfolios.length} out of ${portfolios.length}`);
    return c.json({ portfolios: filteredPortfolios });
  } catch (error) {
    console.log('Get portfolios error:', error);
    return c.json({ error: 'Portfolio\'larni olishda xatolik' }, 500);
  }
});

// Get my portfolios (requires auth) - MUST BE BEFORE DYNAMIC ROUTE
app.get("/make-server-27d0d16c/services/my-portfolios", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    // Get all portfolios and filter by userId
    const allPortfolios = await kv.getByPrefix('portfolio:');
    const myPortfolios = allPortfolios.filter((p: any) => p.userId === auth.userId);

    console.log(`✅ Found ${myPortfolios.length} portfolios for user ${auth.userId}`);
    return c.json({ portfolios: myPortfolios });
  } catch (error) {
    console.log('Get my portfolios error:', error);
    return c.json({ error: 'Portfolio\'larni olishda xatolik' }, 500);
  }
});

// Get my listings (requires auth)
app.get("/make-server-27d0d16c/listings/my", async (c) => {
  try {
    console.log('📋 ===== GET MY LISTINGS =====');
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      console.log('❌ Auth failed:', auth.error);
      return c.json({ error: auth.error }, 401);
    }

    console.log('✅ Auth successful, userId:', auth.userId);
    
    // Get all listings for this user
    const userListings = await kv.getByPrefix(`listing:${auth.userId}:`);
    
    console.log(`✅ Found ${userListings.length} listings for user ${auth.userId}`);

    const listingsNormalized = userListings.map((L: any) => {
      const fromArr = normalizeListingImageUrls(L?.images, 10);
      const fallback =
        fromArr.length > 0
          ? fromArr
          : typeof L?.image === "string" && L.image.trim()
            ? [L.image.trim()]
            : [];
      return { ...L, images: fallback, image: fallback[0] || L?.image };
    });

    return c.json({
      success: true,
      listings: listingsNormalized,
      count: listingsNormalized.length,
    });
  } catch (error: any) {
    console.error('❌ Get my listings error:', error);
    return c.json({ error: 'E\'lonlarni olishda xatolik' }, 500);
  }
});

// Delete listing (requires auth)
app.delete("/make-server-27d0d16c/listings/:id", async (c) => {
  try {
    console.log('🗑️ ===== DELETE LISTING =====');
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      console.log('❌ Auth failed:', auth.error);
      return c.json({ error: auth.error }, 401);
    }

    const listingId = c.req.param('id');
    console.log('🔑 Listing ID:', listingId);
    console.log('👤 User ID:', auth.userId);
    
    // Get the listing to verify ownership
    const listing = await kv.get(`listing:${auth.userId}:${listingId}`);
    
    if (!listing) {
      console.log('❌ Listing not found');
      return c.json({ error: 'E\'lon topilmadi' }, 404);
    }

    // Verify ownership
    if (listing.userId !== auth.userId) {
      console.log('❌ Ownership verification failed');
      return c.json({ error: 'Bu e\'lon sizga tegishli emas' }, 403);
    }

    await touchListingLifetimeBeforeHardDelete(listing);
    await deleteListingRecordMediaFromR2(listing as Record<string, unknown>);
    // Delete the listing
    await kv.del(`listing:${auth.userId}:${listingId}`);
    
    console.log('✅ Listing deleted successfully');
    
    return c.json({ 
      success: true,
      message: 'E\'lon muvaffaqiyatli o\'chirildi'
    });
  } catch (error: any) {
    console.error('❌ Delete listing error:', error);
    return c.json({ error: `E\'lonni o\'chirishda xatolik: ${error.message}` }, 500);
  }
});

// Update listing (requires auth)
app.put("/make-server-27d0d16c/listings/:id", async (c) => {
  try {
    console.log('🔄 ===== UPDATE LISTING =====');
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      console.log('❌ Auth failed:', auth.error);
      return c.json({ error: auth.error }, 401);
    }

    const listingId = c.req.param('id');
    console.log('🔑 Listing ID:', listingId);
    console.log('👤 User ID:', auth.userId);
    
    // Get the existing listing to verify ownership
    const existingListing = await kv.get(`listing:${auth.userId}:${listingId}`);
    
    if (!existingListing) {
      console.log('❌ Listing not found');
      return c.json({ error: 'E\'lon topilmadi' }, 404);
    }

    // Verify ownership
    if (existingListing.userId !== auth.userId) {
      console.log('❌ Ownership verification failed');
      return c.json({ error: 'Bu e\'lon sizga tegishli emas' }, 403);
    }

    // Get updated data from request
    const updatedData = await c.req.json();
    console.log('📝 Update data received:', updatedData);

    // Merge with existing listing (keep some fields unchanged)
    const updatedListing: Record<string, unknown> = {
      ...existingListing,
      ...updatedData,
      id: listingId, // Keep original ID
      userId: auth.userId, // Keep original userId
      updatedAt: new Date().toISOString(),
    };

    if (Array.isArray(updatedData.images)) {
      updatedListing.images = normalizeListingImageUrls(updatedData.images, 10);
    }

    await purgeRemovedR2Urls(existingListing, updatedListing);
    // Save updated listing
    await kv.set(`listing:${auth.userId}:${listingId}`, updatedListing);

    // Katalog `GET /houses` `house:` dan o‘qiydi — tahrirdan keyin rasmlar mos bo‘lishi uchun sinxronlash
    try {
      const houseRow: any = await kv.get(`house:${listingId}`);
      if (houseRow && typeof houseRow === "object" && Array.isArray(updatedListing.images)) {
        const imgs = updatedListing.images as string[];
        await kv.set(`house:${listingId}`, {
          ...houseRow,
          images: imgs,
          image: imgs[0] || houseRow.image,
          updatedAt: updatedListing.updatedAt,
        });
      }
    } catch (syncErr) {
      console.warn("[listings PUT] house: sinxronlash:", syncErr);
    }
    
    console.log('✅ Listing updated successfully');
    
    return c.json({ 
      success: true,
      listing: updatedListing,
      message: 'E\'lon muvaffaqiyatli yangilandi'
    });
  } catch (error: any) {
    console.error('❌ Update listing error:', error);
    return c.json({ error: `E\'lonni yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Get single portfolio - DYNAMIC ROUTE MUST BE LAST
app.get("/make-server-27d0d16c/services/portfolios/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const portfolio = await kv.get(`portfolio:${id}`);
    
    if (!portfolio) {
      return c.json({ error: 'Portfolio topilmadi' }, 404);
    }

    return c.json({ portfolio });
  } catch (error) {
    console.log('Get portfolio error:', error);
    return c.json({ error: 'Portfolio\'ni olishda xatolik' }, 500);
  }
});

// Create portfolio (requires auth)
app.post("/make-server-27d0d16c/services/portfolio", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const portfolioData = await c.req.json();
    const portfolioId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get user profile
    const userProfile = await kv.get(`user:${auth.userId}`);
    
    const portfolio = {
      id: portfolioId,
      userId: auth.userId,
      userName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Anonim',
      userPhone: userProfile?.phone || '',
      ...portfolioData,
      rating: 5.0,
      reviewsCount: 0,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`portfolio:${portfolioId}`, portfolio);

    return c.json({ success: true, portfolio, message: 'Portfolio muvaffaqiyatli yaratildi' });
  } catch (error: any) {
    console.log('Create portfolio error:', error);
    return c.json({ error: `Portfolio yaratishda xatolik: ${error.message}` }, 500);
  }
});

// Update portfolio (requires auth)
app.put("/make-server-27d0d16c/services/portfolio/:id", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const existingPortfolio = await kv.get(`portfolio:${id}`);
    
    if (!existingPortfolio) {
      return c.json({ error: 'Portfolio topilmadi' }, 404);
    }

    // Check ownership
    if (existingPortfolio.userId !== auth.userId) {
      return c.json({ error: 'Bu portfolio sizga tegishli emas' }, 403);
    }

    const updates = await c.req.json();
    
    const updatedPortfolio = {
      ...existingPortfolio,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await purgeRemovedR2Urls(existingPortfolio, updatedPortfolio);
    await kv.set(`portfolio:${id}`, updatedPortfolio);

    return c.json({ success: true, portfolio: updatedPortfolio, message: 'Portfolio yangilandi' });
  } catch (error: any) {
    console.log('Update portfolio error:', error);
    return c.json({ error: `Portfolio yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Delete portfolio (requires auth)
app.delete("/make-server-27d0d16c/services/portfolio/:id", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const existingPortfolio = await kv.get(`portfolio:${id}`);
    
    if (!existingPortfolio) {
      return c.json({ error: 'Portfolio topilmadi' }, 404);
    }

    // Check ownership
    if (existingPortfolio.userId !== auth.userId) {
      return c.json({ error: 'Bu portfolio sizga tegishli emas' }, 403);
    }

    try {
      const projectsData = await kv.getByPrefix(`project:${id}:`);
      for (const p of projectsData || []) {
        await purgeAllManagedR2UrlsInRecord(p);
        const pid = (p as { id?: string })?.id;
        if (pid) await kv.del(`project:${id}:${pid}`);
      }
    } catch (e) {
      console.warn('[services portfolio delete] loyihalar R2/KV:', e);
    }
    await purgeAllManagedR2UrlsInRecord(existingPortfolio);
    await kv.del(`portfolio:${id}`);

    return c.json({ success: true, message: 'Portfolio o\'chirildi' });
  } catch (error: any) {
    console.log('Delete portfolio error:', error);
    return c.json({ error: `Portfolio o\'chirishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== COMPLETED PROJECTS ROUTES ====================

// Get completed projects for a portfolio
app.get("/make-server-27d0d16c/services/portfolio/:id/projects", async (c) => {
  try {
    const portfolioId = c.req.param('id');
    
    console.log('🔍 Fetching projects for portfolio:', portfolioId);
    
    // Get all projects for this portfolio
    const projectsData = await kv.getByPrefix(`project:${portfolioId}:`);
    
    console.log('📦 Raw projectsData from DB:', projectsData);
    console.log('📊 Projects count:', projectsData.length);
    projectsData.forEach((p, idx) => {
      console.log(`  Project ${idx}:`, p);
    });
    
    const projects = projectsData
      .filter(p => p !== null && p !== undefined) // Filter out null values
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log('✅ Filtered projects:', projects);

    return c.json({ success: true, projects });
  } catch (error: any) {
    console.log('❌ Get projects error:', error);
    return c.json({ error: `Loyihalarni olishda xatolik: ${error.message}` }, 500);
  }
});

// Add completed project (requires auth)
app.post("/make-server-27d0d16c/services/portfolio/:id/projects", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const portfolioId = c.req.param('id');
    
    // Verify portfolio exists and user owns it
    const portfolio = await kv.get(`portfolio:${portfolioId}`);
    if (!portfolio) {
      return c.json({ error: 'Portfolio topilmadi' }, 404);
    }

    if (portfolio.userId !== auth.userId) {
      return c.json({ error: 'Bu portfolio sizga tegishli emas' }, 403);
    }

    const { title, description, images } = await c.req.json();

    if (!images || images.length === 0) {
      return c.json({ error: 'Kamida bitta rasm yuklang' }, 400);
    }

    const projectId = `${portfolioId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const project = {
      id: projectId,
      portfolioId,
      userId: auth.userId,
      title: title || 'Yakunlangan loyiha',
      description: description || '',
      images,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`project:${portfolioId}:${projectId}`, project);

    return c.json({ success: true, project, message: 'Loyiha qo\'shildi' });
  } catch (error: any) {
    console.log('Add project error:', error);
    return c.json({ error: `Loyiha qo\'shishda xatolik: ${error.message}` }, 500);
  }
});

// Delete completed project (requires auth)
app.delete("/make-server-27d0d16c/services/portfolio/:id/projects/:projectId", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const portfolioId = c.req.param('id');
    const projectId = c.req.param('projectId');
    
    const project = await kv.get(`project:${portfolioId}:${projectId}`);
    
    if (!project) {
      return c.json({ error: 'Loyiha topilmadi' }, 404);
    }

    if (project.userId !== auth.userId) {
      return c.json({ error: 'Bu loyiha sizga tegishli emas' }, 403);
    }

    await purgeAllManagedR2UrlsInRecord(project);
    await kv.del(`project:${portfolioId}:${projectId}`);

    return c.json({ success: true, message: 'Loyiha o\'chirildi' });
  } catch (error: any) {
    console.log('Delete project error:', error);
    return c.json({ error: `Loyiha o\'chirishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== REVIEWS ROUTES ====================

// ==================== LISTING ROUTES (HOUSE & CAR) ====================

// Telefon bo‘yicha bepul limit va keyingi e‘lon uchun to‘lov kerakligi
app.get("/make-server-27d0d16c/check-listing-quota", async (c) => {
  try {
    const auth = await validateAccessToken(c);

    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const phoneRaw = c.req.query("phone") || c.req.query("ownerPhone");
    const phoneNorm = normalizeListingPhoneForLimit(phoneRaw);
    if (!phoneNorm) {
      return c.json(
        { error: "So‘rovda telefon raqami (phone) kiriting", code: "PHONE_REQUIRED" },
        400,
      );
    }

    const phoneListingCount = await getLifetimeListingSlotsUsed(phoneNorm);
    const requiresFeeForNext = phoneListingCount >= FREE_LISTINGS_PER_PHONE;
    const remainingFreeSlots = Math.max(0, FREE_LISTINGS_PER_PHONE - phoneListingCount);

    return c.json({
      phoneListingCount,
      freeLimit: FREE_LISTINGS_PER_PHONE,
      feeAmountUzs: LISTING_FEE_UZS,
      requiresFeeForNext,
      remainingFreeSlots,
      canPostWithoutFee: !requiresFeeForNext,
      message: requiresFeeForNext
        ? `Keyingi har bir e‘lon uchun ${LISTING_FEE_UZS.toLocaleString("uz-UZ")} so‘m (Click yoki Payme).`
        : `Bepul qolgan joylar: ${remainingFreeSlots} (shu telefon bo‘yicha jami ${FREE_LISTINGS_PER_PHONE} ta; o‘chirilgan e‘lonlar ham hisoblanadi).`,
    });
  } catch (error: any) {
    console.error("Check listing quota error:", error);
    return c.json({ error: "Tekshirishda xatolik" }, 500);
  }
});

/** Click invoice: KV `payment_method:click` yoki Supabase secrets (CLICK_SERVICE_ID, …) — `click.tsx` bilan bir xil. */
function clickListingFeeCredentialsFromEnv(): {
  serviceId: string;
  merchantId: string;
  merchantUserId: string;
} | null {
  const serviceId = (Deno.env.get("CLICK_SERVICE_ID") || "").trim();
  const merchantId = (Deno.env.get("CLICK_MERCHANT_ID") || "").trim();
  const merchantUserId = (Deno.env.get("CLICK_MERCHANT_USER_ID") || "").trim();
  if (!serviceId || !merchantId || !merchantUserId) return null;
  return { serviceId, merchantId, merchantUserId };
}

async function resolveClickInvoiceCredentials(): Promise<
  | {
      ok: true;
      serviceId: string;
      merchantId: string;
      merchantUserId: string;
      clickIsTest: boolean;
    }
  | { ok: false; error: string; code: string }
> {
  const clickConfig = (await kv.get("payment_method:click")) as {
    enabled?: unknown;
    config?: Record<string, unknown>;
    isTestMode?: unknown;
  } | null;

  const cfg = (clickConfig?.config || {}) as Record<string, unknown>;
  const fromKv = {
    serviceId: String(cfg.serviceId ?? "").trim(),
    merchantId: String(cfg.merchantId ?? "").trim(),
    merchantUserId: String(cfg.merchantUserId ?? cfg.merchant_user_id ?? "").trim(),
  };
  const kvEnabled = Boolean(clickConfig?.enabled);

  if (kvEnabled && fromKv.serviceId && fromKv.merchantId && fromKv.merchantUserId) {
    return {
      ok: true,
      ...fromKv,
      clickIsTest: resolveClickIsTestForInvoice({
        clickKv: clickConfig,
        credentialsFromKv: true,
      }),
    };
  }

  const fromEnv = clickListingFeeCredentialsFromEnv();
  if (fromEnv) {
    return {
      ok: true,
      ...fromEnv,
      clickIsTest: resolveClickIsTestForInvoice({
        clickKv: clickConfig,
        credentialsFromKv: false,
      }),
    };
  }

  if (!clickConfig || !kvEnabled) {
    return { ok: false, error: "Click to‘lov usuli faol emas", code: "CLICK_DISABLED" };
  }
  return {
    ok: false,
    error:
      "Click konfiguratsiyasi to‘liq emas. Supabase secrets: CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_MERCHANT_USER_ID yoki Admin.",
    code: "CLICK_CONFIG_INCOMPLETE",
  };
}

// E‘lon uchun Click hisob-faktura (10 000 so‘m) — to‘lovdan keyin `listing_fee_credit` COMPLETE da yoziladi
app.post("/make-server-27d0d16c/listings/fee/click-create", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const body = await c.req.json();
    const phoneNorm = normalizeListingPhoneForLimit(body.phone ?? body.ownerPhone);
    if (!phoneNorm) {
      return c.json({ error: "Telefon raqami kiriting", code: "PHONE_REQUIRED" }, 400);
    }

    const resolved = await resolveClickInvoiceCredentials();
    if (!resolved.ok) {
      return c.json({ error: resolved.error, code: resolved.code }, 400);
    }
    const { serviceId, merchantId, merchantUserId, clickIsTest } = resolved;

    const transactionId = `click_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const transaction = {
      id: transactionId,
      orderId: transactionId,
      userId: auth.userId,
      amount: LISTING_FEE_UZS,
      method: "click",
      purpose: "listing_fee",
      status: "pending",
      listingFeePhoneNorm: phoneNorm,
      isTestMode: clickIsTest,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`transaction:${transactionId}`, transaction);
    await kv.set(`click_order:${transactionId}`, {
      orderId: transactionId,
      amount: LISTING_FEE_UZS,
      phone: "",
      status: "pending",
      createdAt: new Date().toISOString(),
      purpose: "listing_fee",
      listingFeeUserId: auth.userId,
      listingFeePhoneNorm: phoneNorm,
    });

    const basePay = clickIsTest
      ? "https://test.click.uz/services/pay"
      : "https://my.click.uz/services/pay";
    const payUrl = new URL(basePay);
    payUrl.searchParams.set("service_id", serviceId);
    payUrl.searchParams.set("merchant_id", merchantId);
    payUrl.searchParams.set("merchant_user_id", merchantUserId);
    payUrl.searchParams.set("amount", String(LISTING_FEE_UZS));
    payUrl.searchParams.set("transaction_param", transactionId);

    return c.json({
      success: true,
      transaction,
      listingFeeTransactionId: transactionId,
      paymentUrl: payUrl.toString(),
      feeAmountUzs: LISTING_FEE_UZS,
    });
  } catch (error: any) {
    console.error("Listing fee Click create error:", error);
    return c.json({ error: "Click hisob-fakturasini yaratishda xatolik" }, 500);
  }
});

// E‘lon uchun Payme cheki — to‘lov Paycom da tasdiqlangach `listings/fee/verify` server orqali kredit yozadi
app.post("/make-server-27d0d16c/listings/fee/payme-create", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const body = await c.req.json();
    const phoneNorm = normalizeListingPhoneForLimit(body.phone ?? body.ownerPhone);
    if (!phoneNorm) {
      return c.json({ error: "Telefon raqami kiriting", code: "PHONE_REQUIRED" }, 400);
    }

    const paymeConfig = await kv.get("payment_method:payme");
    const resolvedTest = resolvePaycomUseTestForPayme(paymeConfig);
    if (!isPaymeConfiguredForMode(resolvedTest, null)) {
      return c.json(
        {
          error: resolvedTest
            ? "Paycom TEST: Supabase Secrets — PAYCOM_REGISTER_ID va PAYCOM_SECRET_TEST."
            : "Paycom PROD: Supabase Secrets — PAYCOM_REGISTER_ID va PAYCOM_SECRET_PROD.",
          code: "PAYCOM_ENV_MISSING",
        },
        503,
      );
    }
    if (paymeConfig && paymeConfig.enabled === false) {
      return c.json({ error: "Payme to‘lov usuli faol emas", code: "PAYME_DISABLED" }, 400);
    }

    const transactionId = `payme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const items = [
      {
        title: "E‘lon joylashtirish to‘lovi",
        price: LISTING_FEE_UZS,
        count: 1,
        code: "00000000000000000",
        vat_percent: 0,
        package_code: "123456",
        units: 2411,
      },
    ];

    const created = await paymeCreateReceipt(
      LISTING_FEE_UZS,
      transactionId,
      items,
      undefined,
      `E‘lon to‘lovi`,
      { useTest: resolvedTest, checkoutBackUrl: undefined },
    );

    if (!created.success) {
      return c.json(
        { error: created.error || "Payme cheki yaratilmadi", code: "PAYME_RECEIPT_FAILED" },
        400,
      );
    }

    const transaction = {
      id: transactionId,
      orderId: transactionId,
      userId: auth.userId,
      amount: LISTING_FEE_UZS,
      method: "payme",
      purpose: "listing_fee",
      status: "pending",
      receiptId: created.receiptId,
      listingFeePhoneNorm: phoneNorm,
      listingFeeUserId: auth.userId,
      isTestMode: resolvedTest,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`transaction:${transactionId}`, transaction);
    if (created.receiptId) {
      await kv.set(`paycom_receipt:${created.receiptId}`, {
        transactionId,
        orderId: transactionId,
        useTest: resolvedTest,
        purpose: "listing_fee",
      });
    }

    return c.json({
      success: true,
      transaction,
      listingFeeTransactionId: transactionId,
      paymentUrl: created.checkoutUrl,
      checkoutUrl: created.checkoutUrl,
      receiptId: created.receiptId,
      feeAmountUzs: LISTING_FEE_UZS,
    });
  } catch (error: any) {
    console.error("Listing fee Payme create error:", error);
    return c.json({ error: "Payme chekini yaratishda xatolik" }, 500);
  }
});

/** Click COMPLETE dan keyin yozilgan `listing_fee_credit` — frontend polling / «Tekshirish» uchun */
app.get("/make-server-27d0d16c/listings/fee/verify/:transactionId", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const transactionId = String(c.req.param("transactionId") || "").trim();
    if (!transactionId) {
      return c.json({ ok: false, code: "MISSING_ID" });
    }

    const phoneQuery = normalizeListingPhoneForLimit(c.req.query("phone") || "");
    const credit = (await kv.get(`listing_fee_credit:${transactionId}`)) as {
      userId?: string;
      phoneNorm?: string;
      amount?: number;
    } | null;

    if (!credit) {
      const tx = (await kv.get(`transaction:${transactionId}`)) as Record<string, unknown> | null;
      if (
        tx &&
        String(tx.purpose || "") === "listing_fee" &&
        String(tx.method || "") === "payme" &&
        String(tx.status || "") !== "paid"
      ) {
        const receiptId = String(tx.receiptId || "").trim();
        if (receiptId) {
          try {
            const paycomOpts = await paycomCallOptsForReceiptIdWithKv(receiptId);
            const chk = await paymeCheckReceipt(receiptId, paycomOpts);
            if (chk.success && chk.isPaid) {
              const paidAtIso = new Date().toISOString();
              const uId = String(tx.listingFeeUserId ?? tx.userId ?? "").trim();
              const pNorm = String(tx.listingFeePhoneNorm ?? "").trim();
              await kv.set(`transaction:${transactionId}`, {
                ...tx,
                status: "paid",
                paidAt: paidAtIso,
              });
              if (uId && pNorm) {
                await kv.set(`listing_fee_credit:${transactionId}`, {
                  userId: uId,
                  phoneNorm: pNorm,
                  amount: LISTING_FEE_UZS,
                  paidAt: paidAtIso,
                });
              }
              return c.json({ ok: true, transactionId, feeAmountUzs: LISTING_FEE_UZS });
            }
          } catch (e) {
            console.error("listing fee payme verify:", e);
          }
        }
      }
      return c.json({ ok: false, code: "NO_CREDIT" });
    }
    if (String(credit.userId) !== String(auth.userId)) {
      return c.json({ ok: false, code: "WRONG_USER" });
    }
    const creditAmt = Number(credit.amount);
    if (!Number.isFinite(creditAmt) || creditAmt !== LISTING_FEE_UZS) {
      return c.json({ ok: false, code: "BAD_AMOUNT" });
    }
    const cPhone = String(credit.phoneNorm || "").trim();
    if (phoneQuery && (!cPhone || cPhone !== phoneQuery)) {
      return c.json({ ok: false, code: "PHONE_MISMATCH" });
    }

    return c.json({ ok: true, transactionId, feeAmountUzs: LISTING_FEE_UZS });
  } catch (error: any) {
    console.error("Listing fee verify error:", error);
    return c.json({ error: "Tekshirishda xatolik" }, 500);
  }
});

// Upload image for listing (no auth required for places)
app.post("/make-server-27d0d16c/upload-image", async (c) => {
  console.log('📸 ===== UPLOAD IMAGE ENDPOINT =====');
  
  try {
    console.log('📦 Parsing form data...');
    const formData = await c.req.formData();
    
    const file = formData.get('file');
    const type = formData.get('type') || 'place'; // 'house', 'car', 'place'
    
    console.log('📁 File:', file ? 'EXISTS' : 'MISSING');
    console.log('🏷️ Type:', type);

    if (!file || !(file instanceof File)) {
      console.log('❌ No file found in form data');
      return c.json({ error: 'Fayl topilmadi' }, 400);
    }
    
    console.log('📄 File name:', file.name);
    console.log('📏 File size:', file.size);
    console.log('📋 File type:', file.type);

    // Check R2 configuration
    const r2Config = r2.checkR2Config();
    console.log('⚙️ R2 Config:', r2Config);
    
    if (!r2Config.configured) {
      console.log('❌ R2 not configured:', r2Config.message);
      return c.json({ error: r2Config.message }, 500);
    }

    // Generate unique filename
    console.log('🔤 Generating filename...');
    const filename = r2.generateFileName(file.name);
    const prefixedFilename = `${type || 'place'}/${filename}`;
    console.log('📝 Generated filename:', prefixedFilename);

    // Convert to buffer
    console.log('🔄 Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    console.log('✅ Buffer created, size:', buffer.length);

    // Upload to R2
    console.log('☁️ Uploading to R2...');
    const url = await r2.uploadToR2(prefixedFilename, buffer, file.type);
    console.log('✅ Upload successful, URL:', url);

    return c.json({ success: true, url });
  } catch (error: any) {
    console.error('❌ Upload image error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return c.json({ error: `Rasm yuklashda xatolik: ${error.message}` }, 500);
  }
});

// Upload image for places (no auth required)
app.post("/make-server-27d0d16c/upload-place-image", async (c) => {
  console.log('📸 ===== UPLOAD PLACE IMAGE (NO AUTH) =====');
  
  try {
    console.log('📦 Parsing form data...');
    const formData = await c.req.formData();
    
    const file = formData.get('file');
    
    console.log('📁 File:', file ? 'EXISTS' : 'MISSING');

    if (!file || !(file instanceof File)) {
      console.log('❌ No file found in form data');
      return c.json({ error: 'Fayl topilmadi' }, 400);
    }
    
    console.log('📄 File name:', file.name);
    console.log('📏 File size:', file.size);
    console.log('📋 File type:', file.type);

    // Check R2 configuration
    const r2Config = r2.checkR2Config();
    console.log('⚙️ R2 Config:', r2Config);
    
    if (!r2Config.configured) {
      console.log('❌ R2 not configured:', r2Config.message);
      return c.json({ error: r2Config.message }, 500);
    }

    // Generate unique filename
    console.log('🔤 Generating filename...');
    const filename = r2.generateFileName(file.name);
    const prefixedFilename = `place/${filename}`;
    console.log('📝 Generated filename:', prefixedFilename);

    // Convert to buffer
    console.log('🔄 Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    console.log('✅ Buffer created, size:', buffer.length);

    // Upload to R2
    console.log('☁️ Uploading to R2...');
    const url = await r2.uploadToR2(prefixedFilename, buffer, file.type);
    console.log('✅ Upload successful, URL:', url);

    return c.json({ success: true, url });
  } catch (error: any) {
    console.error('❌ Upload place image error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return c.json({ error: `Rasm yuklashda xatolik: ${error.message}` }, 500);
  }
});

// Create house listing
app.post("/make-server-27d0d16c/create-house", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const data = await c.req.json();

    const images = normalizeListingImageUrls(data.images, 10);
    // Validate required fields
    if (!data.title || !data.price || !data.categoryId || images.length === 0) {
      return c.json({ error: 'Majburiy maydonlarni to\'ldiring' }, 400);
    }

    const ownerPhoneNorm = normalizeListingPhoneForLimit(data.ownerPhone);
    if (!ownerPhoneNorm) {
      return c.json({ error: 'Aloqa uchun telefon raqami kiriting' }, 400);
    }
    const lifetimeSlotsHouse = await getLifetimeListingSlotsUsed(ownerPhoneNorm);
    const feeGateHouse = await gateListingByPhoneAndFee(
      auth.userId,
      ownerPhoneNorm,
      data.listingFeeTransactionId,
      lifetimeSlotsHouse,
    );
    if (!feeGateHouse.ok) {
      return c.json({ error: feeGateHouse.error, code: feeGateHouse.code }, feeGateHouse.status);
    }

    const houseId = `house-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const house = {
      id: houseId,
      userId: auth.userId,
      type: 'house',
      categoryId: data.categoryId,
      title: data.title,
      description: data.description,
      price: data.price,
      currency: data.currency,
      images,
      region: data.region,
      district: data.district,
      address: data.address || '',
      rooms: data.rooms,
      bathrooms: data.bathrooms || 1,
      area: data.area,
      floor: data.floor || 1,
      totalFloors: data.totalFloors || 1,
      buildYear: data.buildYear || new Date().getFullYear(),
      condition: data.condition || 'oddiy',
      features: data.features || [],
      hasParking: data.hasParking || false,
      hasFurniture: data.hasFurniture || false,
      hasHalalInstallment: data.hasHalalInstallment || false,
      halalInstallmentMonths: data.halalInstallmentMonths || 0,
      halalInstallmentBank: data.halalInstallmentBank || '0',
      halalDownPayment: data.halalDownPayment || 0,
      creditAvailable: data.creditAvailable || false,
      mortgageAvailable: data.mortgageAvailable || false,
      ownerName: data.ownerName,
      ownerPhone: data.ownerPhone,
      createdAt: new Date().toISOString(),
      status: 'active',
      isPaid: lifetimeSlotsHouse >= FREE_LISTINGS_PER_PHONE,
    };

    await kv.set(`listing:${auth.userId}:${houseId}`, house);
    await kv.set(`house:${houseId}`, house);
    if (feeGateHouse.consumeId) {
      await kv.del(`listing_fee_credit:${feeGateHouse.consumeId}`);
    }
    await incrementLifetimeListingSlotsUsed(ownerPhoneNorm);

    return c.json({ success: true, house, message: 'Uy e\'loni joylashtirildi' });
  } catch (error: any) {
    console.error('Create house error:', error);
    return c.json({ error: `E\'lon joylashtishda xatolik: ${error.message}` }, 500);
  }
});

// Create car listing
app.post("/make-server-27d0d16c/create-car", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const data = await c.req.json();
    
    console.log('🚗 Creating car listing for user:', auth.userId);
    console.log('📦 Car data:', {
      title: data.title,
      brand: data.brand,
      model: data.model,
      price: data.price,
      hasAutoCredit: data.hasAutoCredit,
      hasHalalInstallment: data.hasHalalInstallment,
    });
    
    // Validate required fields (rasmlar keyinroq normalize qilinadi)
    if (!data.title || !data.price || !data.categoryId || !data.images || data.images.length === 0) {
      return c.json({ error: 'Majburiy maydonlarni to\'ldiring' }, 400);
    }

    const ownerPhoneNormCar = normalizeListingPhoneForLimit(data.ownerPhone);
    if (!ownerPhoneNormCar) {
      return c.json({ error: 'Aloqa uchun telefon raqami kiriting' }, 400);
    }
    const lifetimeSlotsCar = await getLifetimeListingSlotsUsed(ownerPhoneNormCar);
    const feeGateCar = await gateListingByPhoneAndFee(
      auth.userId,
      ownerPhoneNormCar,
      data.listingFeeTransactionId,
      lifetimeSlotsCar,
    );
    if (!feeGateCar.ok) {
      return c.json({ error: feeGateCar.error, code: feeGateCar.code }, feeGateCar.status);
    }

    const carId = `car-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Upload images if provided as base64
    let finalImageUrls: string[] = [];
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      for (let i = 0; i < data.images.length; i++) {
        const imageData = data.images[i];
        
        if (typeof imageData === 'string' && imageData.startsWith('http')) {
          // Already uploaded URL
          finalImageUrls.push(imageData);
        } else if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
          // Base64 image - upload to R2
          try {
            console.log(`📸 Uploading car image ${i + 1}/${data.images.length}...`);
            const imageUrl = await r2.uploadImage(imageData, `user-car-${carId}-${i}`);
            finalImageUrls.push(imageUrl);
            console.log(`✅ Image ${i + 1} uploaded:`, imageUrl);
          } catch (uploadError: any) {
            console.error(`❌ Failed to upload image ${i + 1}:`, uploadError);
          }
        }
      }
    }

    const imagesNorm = normalizeListingImageUrls(
      finalImageUrls.length > 0 ? finalImageUrls : data.images,
      10,
    );
    if (imagesNorm.length === 0) {
      return c.json({ error: 'Kamida bitta to‘g‘ri rasm URL kerak' }, 400);
    }

    const car = {
      id: carId,
      userId: auth.userId,
      type: 'car',
      name: data.title,
      categoryId: data.categoryId,
      category: data.categoryId,
      image: imagesNorm[0] || '',
      images: imagesNorm,
      year: data.year,
      brand: data.brand,
      model: data.model,
      fuelType: data.fuelType || 'Benzin',
      transmission: data.transmission || 'Avtomat',
      seats: data.seats || 5,
      color: data.color,
      mileage: data.mileage || '0 km',
      bodyType: data.bodyType || 'Sedan',
      driveType: data.driveType || 'Old',
      engineVolume: data.engineVolume || 2.0,
      features: data.features || [],
      paymentTypes: (() => {
        const types = ['cash'];
        if (data.hasAutoCredit || data.creditAvailable) types.push('credit');
        if (data.mortgageAvailable) types.push('mortgage');
        if (data.hasHalalInstallment) types.push('installment');
        return types;
      })(),
      rating: 0,
      reviews: 0,
      location: `${data.region || 'Toshkent'}, ${data.district || ''}`,
      region: data.region,
      district: data.district,
      owner: data.ownerName,
      seller: data.ownerName,
      ownerPhone: data.ownerPhone,
      phone: data.ownerPhone,
      contactName: data.ownerName,
      contactPhone: data.ownerPhone,
      available: true,
      price: data.price,
      currency: data.currency,
      description: data.description,
      condition: data.condition,
      paymentType: data.paymentType || 'naqd',
      // Auto Credit fields
      hasAutoCredit: data.hasAutoCredit || false,
      autoCreditBank: data.autoCreditBank || '',
      autoCreditPercent: data.autoCreditPercent || 0,
      autoCreditPeriod: data.autoCreditPeriod || 0,
      // Halol Installment fields
      hasHalalInstallment: data.hasHalalInstallment || false,
      halalInstallmentMonths: data.halalInstallmentMonths || 0,
      halalInstallmentBank: data.halalInstallmentBank || '',
      halalDownPayment: data.halalDownPayment || 0,
      // Legacy fields
      creditAvailable: data.creditAvailable || data.hasAutoCredit || false,
      mortgageAvailable: data.mortgageAvailable || false,
      creditTerm: data.creditTerm || '',
      creditInterestRate: data.creditInterestRate || '',
      initialPayment: data.initialPayment || '',
      // Panorama scenes
      panoramaScenes: data.panoramaScenes || [],
      views: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      isPaid: lifetimeSlotsCar >= FREE_LISTINGS_PER_PHONE,
    };

    // Handle panorama scenes if provided
    if (data.panoramaScenes && Array.isArray(data.panoramaScenes) && data.panoramaScenes.length > 0) {
      const finalPanoramaScenes = [];
      
      for (let i = 0; i < data.panoramaScenes.length; i++) {
        const scene = data.panoramaScenes[i];
        
        if (scene.preview && scene.preview.startsWith('data:image')) {
          try {
            console.log(`🌐 Uploading panorama scene ${i + 1}...`);
            const panoramaUrl = await r2.uploadImage(scene.preview, `user-car-panorama-${carId}-${i}`);
            finalPanoramaScenes.push({
              id: scene.id,
              title: scene.title,
              url: panoramaUrl,
              hotspots: scene.hotspots || [],
            });
            console.log(`✅ Panorama ${i + 1} uploaded`);
          } catch (uploadError: any) {
            console.error(`❌ Failed to upload panorama ${i + 1}:`, uploadError);
          }
        } else if (scene.url) {
          finalPanoramaScenes.push(scene);
        }
      }
      
      if (finalPanoramaScenes.length > 0) {
        car.panoramaScenes = finalPanoramaScenes;
        console.log(`✅ Total ${finalPanoramaScenes.length} panorama scenes added`);
      }
    }

    await kv.set(`listing:${auth.userId}:${carId}`, car);
    await kv.set(`car:${carId}`, car);
    if (feeGateCar.consumeId) {
      await kv.del(`listing_fee_credit:${feeGateCar.consumeId}`);
    }
    await incrementLifetimeListingSlotsUsed(ownerPhoneNormCar);

    return c.json({ success: true, car, message: 'Moshina e\'loni joylashtirildi' });
  } catch (error: any) {
    console.error('Create car error:', error);
    return c.json({ error: `E\'lon joylashtishda xatolik: ${error.message}` }, 500);
  }
});

// Get my listings (requires auth)
app.get("/make-server-27d0d16c/my-listings", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const listings = await kv.getByPrefix(`listing:${auth.userId}:`);
    
    // Sort by creation date
    const sortedListings = listings.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return c.json({ listings: sortedListings });
  } catch (error: any) {
    console.error('Get my listings error:', error);
    return c.json({ error: 'E\'lonlarni olishda xatolik' }, 500);
  }
});

// Delete listing (requires auth)
app.delete("/make-server-27d0d16c/listing/:id", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const listingId = c.req.param('id');
    
    console.log('🗑️ Deleting listing:', listingId);
    console.log('👤 User ID:', auth.userId);
    
    // Get listing
    const listing = await kv.get(`listing:${auth.userId}:${listingId}`);
    
    if (!listing) {
      console.log('❌ Listing not found');
      return c.json({ error: 'E\'lon topilmadi' }, 404);
    }

    console.log('✅ Listing found, type:', listing.type);

    await touchListingLifetimeBeforeHardDelete(listing);
    await deleteListingRecordMediaFromR2(listing as Record<string, unknown>);
    // Delete from both places
    await kv.del(`listing:${auth.userId}:${listingId}`);
    console.log('✅ Deleted from profile: listing:' + auth.userId + ':' + listingId);
    
    await kv.del(`${listing.type}:${listingId}`);
    console.log('✅ Deleted from public: ' + listing.type + ':' + listingId);

    return c.json({ success: true, message: 'E\'lon o\'chirildi' });
  } catch (error: any) {
    console.error('Delete listing error:', error);
    return c.json({ error: 'E\'lonni o\'chirishda xatolik' }, 500);
  }
});

// ==================== REVIEWS ROUTES (CONTINUE) ====================

// Get reviews for a portfolio
app.get("/make-server-27d0d16c/services/portfolio/:id/reviews", async (c) => {
  try {
    const portfolioId = c.req.param('id');
    
    console.log('💬 Fetching reviews for portfolio:', portfolioId);
    
    // Get all reviews for this portfolio
    const reviewsData = await kv.getByPrefix(`review:${portfolioId}:`);
    
    console.log('📦 Raw reviewsData from DB:', reviewsData);
    console.log('📊 Reviews count:', reviewsData.length);
    reviewsData.forEach((r, idx) => {
      console.log(`  Review ${idx}:`, r);
    });
    
    // getByPrefix already returns values, not {key, value} objects
    const reviews = reviewsData
      .filter(r => r !== null && r !== undefined) // Filter out null values
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log('✅ Filtered reviews:', reviews);

    return c.json({ success: true, reviews });
  } catch (error: any) {
    console.log('❌ Get reviews error:', error);
    return c.json({ error: `Sharhlarni olishda xatolik: ${error.message}` }, 500);
  }
});

// Add review (requires auth, cannot review own portfolio)
app.post("/make-server-27d0d16c/services/portfolio/:id/reviews", async (c) => {
  try {
    console.log('📝 Add review endpoint called');
    
    const auth = await validateAccessToken(c);
    console.log('🔐 Auth result:', auth);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const portfolioId = c.req.param('id');
    console.log('📋 Portfolio ID:', portfolioId);
    
    // Verify portfolio exists
    const portfolio = await kv.get(`portfolio:${portfolioId}`);
    if (!portfolio) {
      return c.json({ error: 'Portfolio topilmadi' }, 404);
    }

    // Cannot review own portfolio
    if (portfolio.userId === auth.userId) {
      return c.json({ error: 'O\'z portfolio\'ingizga sharh yoza olmaysiz' }, 403);
    }

    console.log('📦 About to parse request body...');
    console.log('📦 Content-Type:', c.req.header('Content-Type'));
    
    let requestBody;
    try {
      // Try to get the raw body first
      const rawBody = await c.req.text();
      console.log('📦 Raw body:', rawBody);
      
      // Parse it manually
      requestBody = JSON.parse(rawBody);
      console.log('📦 Parsed request body:', requestBody);
    } catch (parseError) {
      console.log('❌ Parse error:', parseError);
      return c.json({ error: 'Noto\'g\'ri ma\'lumot formati' }, 400);
    }
    
    console.log('📦 Request body keys:', Object.keys(requestBody || {}));
    
    const { rating, comment } = requestBody || {};
    console.log('⭐ Rating:', rating, 'Type:', typeof rating);
    console.log('💬 Comment:', comment, 'Type:', typeof comment);

    if (!rating || rating < 1 || rating > 5) {
      return c.json({ error: 'Baho 1 dan 5 gacha bo\'lishi kerak' }, 400);
    }

    if (!comment || comment.trim().length === 0) {
      return c.json({ error: 'Sharh matni majburiy' }, 400);
    }

    // Get reviewer info
    const reviewer = await kv.get(`user:${auth.userId}`);

    const reviewId = `${portfolioId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const review = {
      id: reviewId,
      portfolioId,
      userId: auth.userId,
      userName: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : 'Foydalanuvchi',
      userPhone: reviewer?.phone || '',
      rating,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
    };

    await kv.set(`review:${portfolioId}:${reviewId}`, review);

    console.log('✅ Review saved to DB');

    // Update portfolio rating
    console.log('📊 Updating portfolio rating...');
    const reviewsData = await kv.getByPrefix(`review:${portfolioId}:`);
    console.log('📦 All reviews from DB:', reviewsData);
    console.log('📊 Reviews count:', reviewsData.length);
    
    const allReviews = reviewsData.filter(r => r !== null && r !== undefined);
    console.log('📊 Filtered reviews:', allReviews);
    
    // Debug each review rating
    allReviews.forEach((r: any, idx: number) => {
      console.log(`  Review ${idx + 1} rating:`, r.rating, 'Type:', typeof r.rating);
    });
    
    const totalRating = allReviews.reduce((sum: number, r: any) => {
      const ratingValue = Number(r.rating) || 0;
      console.log(`  Adding rating: ${ratingValue} to sum: ${sum}`);
      return sum + ratingValue;
    }, 0);
    
    console.log('📊 Total rating sum:', totalRating);
    const avgRating = allReviews.length > 0 ? totalRating / allReviews.length : 5.0;
    console.log('📊 Average rating:', avgRating);
    console.log('📊 Rounded rating:', Math.round(avgRating * 10) / 10);

    const updatedPortfolio = {
      ...portfolio,
      rating: Math.round(avgRating * 10) / 10,
      reviewsCount: allReviews.length,
    };
    
    console.log('💾 Saving updated portfolio:', updatedPortfolio);
    await kv.set(`portfolio:${portfolioId}`, updatedPortfolio);

    console.log('✅ Review added successfully:', review);

    return c.json({ success: true, review, message: 'Sharh qo\'shildi' });
  } catch (error: any) {
    console.log('❌ Add review error:', error);
    console.log('❌ Error stack:', error.stack);
    return c.json({ error: `Sharh qo'shishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== HOUSES ROUTES ====================

// Seed houses endpoint - PUBLIC for testing
app.post("/make-server-27d0d16c/houses/seed", async (c) => {
  try {
    console.log('��� Seeding houses...');
    const houses = await houseSeed.seedHouses();
    console.log(`✅ Successfully seeded ${houses.length} houses`);
    return c.json({ 
      success: true, 
      message: `${houses.length} ta uy muvaffaqiyatli qo'shildi`,
      count: houses.length 
    });
  } catch (error: any) {
    console.error('❌ Seed houses error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return c.json({ error: `Seed qilishda xatolik: ${error.message}` }, 500);
  }
});

// Clear houses endpoint - PUBLIC for testing
app.delete("/make-server-27d0d16c/houses/clear", async (c) => {
  try {
    console.log('🗑️ Clearing houses...');
    await houseSeed.clearHouses();
    return c.json({ 
      success: true, 
      message: 'Barcha uylar o\'chirildi' 
    });
  } catch (error: any) {
    console.log('Clear houses error:', error);
    return c.json({ error: `O'chirishda xatolik: ${error.message}` }, 500);
  }
});

// Get all houses (including properties from branches)
app.get("/make-server-27d0d16c/houses", async (c) => {
  try {
    const region = c.req.query('region');
    const district = c.req.query('district');
    const category = c.req.query('category');
    
    console.log(`🏠 Fetching houses with filters - region: ${region || 'all'}, district: ${district || 'all'}, category: ${category || 'all'}`);
    
    // Get both old houses and new properties
    const [oldHouses, newProperties] = await Promise.all([
      kv.getByPrefix('house:'),
      kv.getByPrefix('property:')
    ]);
    
    console.log(`📦 Found ${oldHouses.length} old houses and ${newProperties.length} properties`);
    
    // Map properties to house format
    const mappedProperties = newProperties.map((p: any) => {
      const propertyImages = p.images && p.images.length > 0 
        ? p.images 
        : ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800'];
      
      return {
        ...p,
        // Add house-compatible fields
        categoryId: p.propertyType || 'apartment', // Map propertyType to categoryId
        title: p.name,
        image: propertyImages[0],
        images: propertyImages,
        userId: p.branchId, // Branch ID as user ID
        bathrooms: p.bathrooms || 1,
        area: p.area || 0,
        condition: p.condition || 'normal',
        // Ensure all required fields exist
        region: p.region || '',
        district: p.district || '',
        address: p.address || '',
      };
    });
    
    // Combine both arrays
    const allHouses = [...oldHouses, ...mappedProperties];

    // Bir xil `id` ikki marta kelsa (masalan house: + property:), React key takrorlanib
    // bitta kartochkada bir xil rasm/tarkib qolib ketishi mumkin — birinchi yozuvni saqlaymiz.
    const seenHouseIds = new Set<string>();
    const uniqueHouses = allHouses.filter((h: any) => {
      if (!h) return false;
      const hid = h.id != null ? String(h.id).trim() : '';
      if (!hid) return true;
      if (seenHouseIds.has(hid)) return false;
      seenHouseIds.add(hid);
      return true;
    });
    
    // Optimized filtering - single pass (case-insensitive)
    const filteredHouses = uniqueHouses.filter((h: any) => {
      if (!h) return false;
      if (region && (!h.region || h.region.toLowerCase() !== region.toLowerCase())) return false;
      if (district && (!h.district || h.district.toLowerCase() !== district.toLowerCase())) return false;
      if (category && h.categoryId !== category) return false;
      return true;
    });

    console.log(`✅ Filtered houses: ${filteredHouses.length} out of ${allHouses.length}`);
    const mergedHouses = await Promise.all(
      filteredHouses.map((h: any) => mergeCatalogRowImagesFromListing(h)),
    );
    const housesOut = mergedHouses.map((h: any) =>
      h && typeof h === "object"
        ? { ...h, images: normalizeListingImageUrls(h.images, 10) }
        : h,
    );
    return c.json({ houses: housesOut });
  } catch (error) {
    console.log('Get houses error:', error);
    return c.json({ error: 'Uylarni olishda xatolik' }, 500);
  }
});

// Get single house
app.get("/make-server-27d0d16c/houses/:id", async (c) => {
  try {
    const id = c.req.param('id');
    let house = await kv.get(`house:${id}`);
    
    if (!house) {
      return c.json({ error: 'Uy topilmadi' }, 404);
    }

    house = await mergeCatalogRowImagesFromListing(house);
    const houseOut =
      house && typeof house === "object"
        ? { ...house, images: normalizeListingImageUrls((house as any).images, 10) }
        : house;
    return c.json({ house: houseOut });
  } catch (error) {
    console.log('Get house error:', error);
    return c.json({ error: 'Uyni olishda xatolik' }, 500);
  }
});

// Create house (requires auth)
app.post("/make-server-27d0d16c/houses", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const houseData = await c.req.json();
    const housePhoneNorm = normalizeListingPhoneForLimit(
      houseData.ownerPhone ?? houseData.phone ?? houseData.contactPhone,
    );
    if (!housePhoneNorm) {
      return c.json({ error: 'Aloqa uchun telefon raqami kiriting' }, 400);
    }
    const lifetimeSlotsHousePost = await getLifetimeListingSlotsUsed(housePhoneNorm);
    const feeGateHousePost = await gateListingByPhoneAndFee(
      auth.userId,
      housePhoneNorm,
      houseData.listingFeeTransactionId,
      lifetimeSlotsHousePost,
    );
    if (!feeGateHousePost.ok) {
      return c.json({ error: feeGateHousePost.error, code: feeGateHousePost.code }, feeGateHousePost.status);
    }

    const houseId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const imagesPost = normalizeListingImageUrls(houseData?.images, 10);
    const house = {
      id: houseId,
      ...houseData,
      ...(imagesPost.length > 0 ? { images: imagesPost } : {}),
      userId: auth.userId,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`house:${houseId}`, house);
    if (feeGateHousePost.consumeId) {
      await kv.del(`listing_fee_credit:${feeGateHousePost.consumeId}`);
    }
    await incrementLifetimeListingSlotsUsed(housePhoneNorm);

    return c.json({ success: true, house, message: 'Uy qo\'shildi' });
  } catch (error: any) {
    console.log('Create house error:', error);
    return c.json({ error: `Uy qo'shishda xatolik: ${error.message}` }, 500);
  }
});

// Update house (requires auth)
app.put("/make-server-27d0d16c/houses/:id", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const existingHouse = await kv.get(`house:${id}`);
    
    if (!existingHouse) {
      return c.json({ error: 'Uy topilmadi' }, 404);
    }

    // Check ownership
    if (existingHouse.userId !== auth.userId) {
      return c.json({ error: 'Bu uy sizga tegishli emas' }, 403);
    }

    const updates = await c.req.json();
    
    const updatedHouse = {
      ...existingHouse,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await purgeRemovedR2Urls(existingHouse, updatedHouse);
    await kv.set(`house:${id}`, updatedHouse);

    return c.json({ success: true, house: updatedHouse, message: 'Uy yangilandi' });
  } catch (error: any) {
    console.log('Update house error:', error);
    return c.json({ error: `Uy yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Delete house (requires auth)
app.delete("/make-server-27d0d16c/houses/:id", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const existingHouse = await kv.get(`house:${id}`);
    
    if (!existingHouse) {
      return c.json({ error: 'Uy topilmadi' }, 404);
    }

    // Check ownership
    if (existingHouse.userId !== auth.userId) {
      return c.json({ error: 'Bu uy sizga tegishli emas' }, 403);
    }

    await touchListingLifetimeBeforeHardDelete(existingHouse);
    await purgeAllManagedR2UrlsInRecord(existingHouse);
    await kv.del(`house:${id}`);

    return c.json({ success: true, message: 'Uy o\'chirildi' });
  } catch (error: any) {
    console.log('Delete house error:', error);
    return c.json({ error: `Uy o'chirishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== CARS ROUTES ====================

// Seed cars endpoint - PUBLIC for testing
app.post("/make-server-27d0d16c/cars/seed", async (c) => {
  try {
    console.log('🌱 Seeding cars...');
    const cars = await carSeed.seedCars();
    console.log(`✅ Successfully seeded ${cars.length} cars`);
    return c.json({ 
      success: true, 
      message: `${cars.length} ta test avtomobil qo'shildi`,
      cars 
    });
  } catch (error: any) {
    console.log('Seed cars error:', error);
    return c.json({ error: `Seed qilishda xatolik: ${error.message}` }, 500);
  }
});

// Clear cars endpoint - PUBLIC for testing
app.delete("/make-server-27d0d16c/cars/clear", async (c) => {
  try {
    console.log('🗑️ Clearing cars...');
    await carSeed.clearCars();
    return c.json({ 
      success: true, 
      message: 'Barcha avtomobillar o\'chirildi' 
    });
  } catch (error: any) {
    console.log('Clear cars error:', error);
    return c.json({ error: `O'chirishda xatolik: ${error.message}` }, 500);
  }
});

// Get all cars
app.get("/make-server-27d0d16c/cars", async (c) => {
  try {
    const region = c.req.query('region');
    const district = c.req.query('district');
    const category = c.req.query('category');
    
    let allCars = await kv.getByPrefix('car:');
    
    // Filter by region
    if (region) {
      allCars = allCars.filter((car: any) => car.region === region);
    }
    
    // Filter by district
    if (district) {
      allCars = allCars.filter((car: any) => car.district === district);
    }
    
    // Filter by category
    if (category) {
      allCars = allCars.filter((car: any) => car.categoryId === category);
    }

    const mergedCars = await Promise.all(
      allCars.map((car: any) => mergeCatalogRowImagesFromListing(car)),
    );
    return c.json({ success: true, cars: mergedCars });
  } catch (error: any) {
    console.log('Get cars error:', error);
    return c.json({ error: 'Avtomobillarni olishda xatolik' }, 500);
  }
});

// Get single car
app.get("/make-server-27d0d16c/cars/:id", async (c) => {
  try {
    const id = c.req.param('id');
    let car = await kv.get(`car:${id}`);
    
    if (!car) {
      return c.json({ error: 'Avtomobil topilmadi' }, 404);
    }

    car = await mergeCatalogRowImagesFromListing(car);
    return c.json({ success: true, car });
  } catch (error: any) {
    console.log('Get car error:', error);
    return c.json({ error: 'Avtomobilni olishda xatolik' }, 500);
  }
});

// Create car (requires auth)
app.post("/make-server-27d0d16c/cars", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const carData = await c.req.json();
    const carPhoneNorm = normalizeListingPhoneForLimit(
      carData.ownerPhone ?? carData.phone ?? carData.contactPhone,
    );
    if (!carPhoneNorm) {
      return c.json({ error: 'Aloqa uchun telefon raqami kiriting' }, 400);
    }
    const lifetimeSlotsCarPost = await getLifetimeListingSlotsUsed(carPhoneNorm);
    const feeGateCarPost = await gateListingByPhoneAndFee(
      auth.userId,
      carPhoneNorm,
      carData.listingFeeTransactionId,
      lifetimeSlotsCarPost,
    );
    if (!feeGateCarPost.ok) {
      return c.json({ error: feeGateCarPost.error, code: feeGateCarPost.code }, feeGateCarPost.status);
    }

    const carId = `car-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newCar = {
      ...carData,
      id: carId,
      userId: auth.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`car:${carId}`, newCar);
    if (feeGateCarPost.consumeId) {
      await kv.del(`listing_fee_credit:${feeGateCarPost.consumeId}`);
    }
    await incrementLifetimeListingSlotsUsed(carPhoneNorm);

    return c.json({ success: true, car: newCar, message: 'Avtomobil qo\'shildi' });
  } catch (error: any) {
    console.log('Create car error:', error);
    return c.json({ error: `Avtomobil qo'shishda xatolik: ${error.message}` }, 500);
  }
});

// Update car (requires auth)
app.put("/make-server-27d0d16c/cars/:id", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const existingCar = await kv.get(`car:${id}`);
    
    if (!existingCar) {
      return c.json({ error: 'Avtomobil topilmadi' }, 404);
    }

    // Check ownership
    if (existingCar.userId !== auth.userId) {
      return c.json({ error: 'Bu avtomobil sizga tegishli emas' }, 403);
    }

    const updateData = await c.req.json();
    const updatedCar = {
      ...existingCar,
      ...updateData,
      id,
      userId: auth.userId,
      createdAt: existingCar.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await purgeRemovedR2Urls(existingCar, updatedCar);
    await kv.set(`car:${id}`, updatedCar);

    return c.json({ success: true, car: updatedCar, message: 'Avtomobil yangilandi' });
  } catch (error: any) {
    console.log('Update car error:', error);
    return c.json({ error: `Avtomobil yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Delete car (requires auth)
app.delete("/make-server-27d0d16c/cars/:id", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const existingCar = await kv.get(`car:${id}`);
    
    if (!existingCar) {
      return c.json({ error: 'Avtomobil topilmadi' }, 404);
    }

    // Check ownership
    if (existingCar.userId !== auth.userId) {
      return c.json({ error: 'Bu avtomobil sizga tegishli emas' }, 403);
    }

    await touchListingLifetimeBeforeHardDelete(existingCar);
    await purgeAllManagedR2UrlsInRecord(existingCar);
    await kv.del(`car:${id}`);

    return c.json({ success: true, message: 'Avtomobil o\'chirildi' });
  } catch (error: any) {
    console.log('Delete car error:', error);
    return c.json({ error: `Avtomobil o'chirishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== PLACES ROUTES ====================

// Get all places
app.get("/make-server-27d0d16c/places", async (c) => {
  try {
    const region = c.req.query('region');
    const district = c.req.query('district');
    const category = c.req.query('category');
    
    console.log('📍 Fetching places with filters:', { region, district, category });
    
    const places = await kv.getByPrefix('place:');
    
    console.log(`📦 Total places found: ${places.length}`);
    
    // Calculate real-time rating and reviews count for each place
    const placesWithRatings = await Promise.all(
      places.map(async (place: any) => {
        const reviews = await kv.getByPrefix(`review:${place.id}:`);
        const reviewCount = reviews.length;
        const averageRating = reviewCount > 0
          ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewCount
          : 0;
        
        return {
          ...place,
          // Ensure coordinates exist (default to Tashkent center if missing)
          coordinates: place.coordinates || [41.311, 69.279],
          rating: parseFloat(averageRating.toFixed(1)),
          reviews: reviewCount,
        };
      })
    );
    
    console.log(`📊 Places with ratings calculated: ${placesWithRatings.length}`);
    
    let filteredPlaces = placesWithRatings;
    if (region) {
      console.log(`🔍 Filtering by region: ${region}`);
      filteredPlaces = filteredPlaces.filter((p: any) => {
        console.log(`  - Place "${p.name}": region="${p.region}", match=${p.region === region}`);
        return p.region === region;
      });
      console.log(`  ✅ After region filter: ${filteredPlaces.length} places`);
    }
    if (district) {
      console.log(`🔍 Filtering by district: ${district}`);
      filteredPlaces = filteredPlaces.filter((p: any) => {
        console.log(`  - Place "${p.name}": district="${p.district}", match=${p.district === district}`);
        return p.district === district;
      });
      console.log(`  ✅ After district filter: ${filteredPlaces.length} places`);
    }
    if (category) {
      console.log(`🔍 Filtering by category: ${category}`);
      filteredPlaces = filteredPlaces.filter((p: any) => p.categoryId === category);
      console.log(`  ✅ After category filter: ${filteredPlaces.length} places`);
    }
    
    console.log(`✅ Found ${filteredPlaces.length} places with real-time ratings`);
    return c.json({ places: filteredPlaces });
  } catch (error: any) {
    console.log('Get places error:', error);
    return c.json({ error: 'Joylarni olishda xatolik' }, 500);
  }
});

// Get my places (requires auth)
app.get("/make-server-27d0d16c/places/my", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const allPlaces = await kv.getByPrefix('place:');
    const myPlaces = allPlaces.filter((place: any) => place.userId === auth.userId);
    
    // Calculate real-time rating and reviews count for each place
    const placesWithRatings = await Promise.all(
      myPlaces.map(async (place: any) => {
        const reviews = await kv.getByPrefix(`review:${place.id}:`);
        const reviewCount = reviews.length;
        const averageRating = reviewCount > 0
          ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewCount
          : 0;
        
        return {
          ...place,
          // Ensure coordinates exist (default to Tashkent center if missing)
          coordinates: place.coordinates || [41.311, 69.279],
          rating: parseFloat(averageRating.toFixed(1)),
          reviews: reviewCount,
        };
      })
    );
    
    return c.json({ places: placesWithRatings });
  } catch (error: any) {
    console.log('Get my places error:', error);
    return c.json({ error: 'Joylarni olishda xatolik' }, 500);
  }
});

// Get single place
app.get("/make-server-27d0d16c/places/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const place = await kv.get(`place:${id}`);
    
    if (!place) {
      return c.json({ error: 'Joy topilmadi' }, 404);
    }
    
    // Calculate real-time rating and reviews count
    const reviews = await kv.getByPrefix(`review:${id}:`);
    const reviewCount = reviews.length;
    const averageRating = reviewCount > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewCount
      : 0;
    
    const placeWithRating = {
      ...place,
      // Ensure coordinates exist (default to Tashkent center if missing)
      coordinates: place.coordinates || [41.311, 69.279],
      rating: parseFloat(averageRating.toFixed(1)),
      reviews: reviewCount,
    };
    
    return c.json({ place: placeWithRating });
  } catch (error: any) {
    console.log('Get place error:', error);
    return c.json({ error: 'Joyni olishda xatolik' }, 500);
  }
});

// Create place (requires daily security code)
app.post("/make-server-27d0d16c/places", async (c) => {
  try {
    console.log('📥 Creating new place...');
    const data = await c.req.json();
    console.log('📦 Data received, keys:', Object.keys(data));
    console.log('📏 Image data length:', data.image?.length || 0);
    console.log('📷 Images array length:', data.images?.length || 0);
    
    const SECRET_CODE = await getAdminSecondaryCode();

    if (!data.securityCode || String(data.securityCode).trim() !== SECRET_CODE) {
      console.log(`❌ Invalid security code. Expected: (panel KV), Got: ${data.securityCode}`);
      return c.json({ 
        error: `Noto'g'ri maxfiy kod!` 
      }, 403);
    }
    
    console.log('✅ Security code validated');

    // Handle base64 image upload if provided (single image for backward compatibility)
    let finalImageUrl = data.image;
    
    if (data.image && data.image.startsWith('data:image/')) {
      console.log('📸 Uploading base64 image to R2...');
      
      try {
        // Extract base64 data and content type
        const matches = data.image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const contentType = matches[1];
          const base64Data = matches[2];
          
          // Convert base64 to buffer
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Generate filename
          const extension = contentType.split('/')[1] || 'jpg';
          const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
          const prefixedFilename = `place/${filename}`;
          
          console.log('📝 Generated filename:', prefixedFilename);
          
          // Upload to R2
          const url = await r2.uploadToR2(prefixedFilename, bytes, contentType);
          finalImageUrl = url;
          
          console.log('✅ Image uploaded to R2:', url);
        }
      } catch (uploadError: any) {
        console.error('⚠️ Image upload failed:', uploadError);
        console.error('⚠️ Upload error message:', uploadError.message);
        console.error('⚠️ Upload error stack:', uploadError.stack);
        // Continue with original URL if upload fails
      }
    }

    // Handle multiple images upload
    const finalImageUrls: string[] = [];
    
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      console.log(`📸 Uploading ${data.images.length} images to R2...`);
      
      for (let i = 0; i < data.images.length; i++) {
        const imageData = data.images[i];
        
        if (imageData && imageData.startsWith('data:image/')) {
          try {
            // Extract base64 data and content type
            const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const contentType = matches[1];
              const base64Data = matches[2];
              
              // Convert base64 to buffer
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              
              // Generate filename
              const extension = contentType.split('/')[1] || 'jpg';
              const filename = `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
              const prefixedFilename = `place/${filename}`;
              
              console.log(`📝 Generated filename for image ${i + 1}:`, prefixedFilename);
              
              // Upload to R2
              const url = await r2.uploadToR2(prefixedFilename, bytes, contentType);
              finalImageUrls.push(url);
              
              console.log(`✅ Image ${i + 1}/${data.images.length} uploaded to R2:`, url);
            }
          } catch (uploadError: any) {
            console.error(`⚠️ Image ${i + 1} upload failed:`, uploadError);
            console.error('⚠️ Upload error message:', uploadError.message);
            // Continue with next image if one fails
          }
        } else if (imageData && (imageData.startsWith('http://') || imageData.startsWith('https://'))) {
          // Already a URL, just add it
          finalImageUrls.push(imageData);
          console.log(`✅ Image ${i + 1} already a URL:`, imageData);
        }
      }
      
      console.log(`✅ Uploaded ${finalImageUrls.length}/${data.images.length} images successfully`);
    }

    const id = `place-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Remove security code from stored data
    const { securityCode, image, images, ...placeData } = data;
    
    const place = {
      ...placeData,
      image: finalImageUrl, // Use uploaded URL or original
      images: finalImageUrls.length > 0 ? finalImageUrls : undefined, // Multiple images
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rating: 4.5,
      reviews: Math.floor(Math.random() * 100) + 10,
    };

    await kv.set(`place:${id}`, place);

    console.log('✅ Place created:', id);
    console.log('✅ Images saved:', finalImageUrls.length);
    return c.json({ success: true, place, message: 'Joy muvaffaqiyatli qo\'shildi' });
  } catch (error: any) {
    console.error('❌ Create place error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return c.json({ error: `Joy qo'shishda xatolik: ${error.message}` }, 500);
  }
});

// Update place (requires security code, not auth)
app.put("/make-server-27d0d16c/places/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log('🔄 ===== UPDATE PLACE START =====');
    console.log('📍 Place ID:', id);
    
    const existingPlace = await kv.get(`place:${id}`);
    
    if (!existingPlace) {
      console.log('❌ Place not found:', id);
      return c.json({ error: 'Joy topilmadi' }, 404);
    }

    console.log('✅ Existing place found:', existingPlace.name);

    console.log('📥 Parsing request body...');
    let data;
    try {
      data = await c.req.json();
      console.log('✅ Request body parsed successfully');
      console.log('📦 Update data received:', JSON.stringify(data, null, 2));
    } catch (parseError: any) {
      console.error('❌ Failed to parse request body:', parseError.message);
      return c.json({ error: 'Noto\'g\'ri ma\'lumot formati' }, 400);
    }

    const SECRET_CODE = await getAdminSecondaryCode();

    console.log('🔐 Security code validation:');
    console.log('  Expected code:', '(panel KV)');
    console.log('  Received code:', data.securityCode);

    if (!data.securityCode || String(data.securityCode).trim() !== SECRET_CODE) {
      console.log('❌ Invalid security code');
      return c.json({ error: `Noto'g'ri maxfiy kod!` }, 403);
    }

    console.log('✅ Security code validated');

    // Remove security code from stored data
    const { securityCode, ...updateData } = data;

    console.log('🖼️ Checking image in update data...');
    console.log('🖼️ Image exists:', !!updateData.image);
    console.log('🖼️ Image type:', typeof updateData.image);
    console.log('🖼️ Image starts with data:image:', updateData.image?.startsWith('data:image/'));
    console.log('🖼️ Image length:', updateData.image?.length || 0);

    // Handle image upload to R2 if base64 image provided
    let finalImageUrl = updateData.image || existingPlace.image;
    
    if (updateData.image && updateData.image.startsWith('data:image/')) {
      console.log('📤 Base64 image detected, uploading to R2...');
      try {
        // Check R2 configuration
        const r2Config = r2.checkR2Config();
        console.log('🔧 R2 configured:', r2Config.configured);
        console.log('🔧 R2 message:', r2Config.message);
        
        if (r2Config.configured) {
          // Extract base64 data
          const matches = updateData.image.match(/^data:image\/(\w+);base64,(.+)$/);
          console.log('🔍 Regex match result:', !!matches);
          
          if (matches) {
            const extension = matches[1];
            const base64Data = matches[2];
            
            console.log('📝 Extension:', extension);
            console.log('📝 Base64 data length:', base64Data.length);
            
            // Convert base64 to buffer
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            console.log('📦 Converted to bytes, size:', bytes.length);
            
            // Generate filename
            const filename = `places/place-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
            
            // Upload to R2
            console.log('📤 Uploading to R2:', filename);
            const uploadResult = await r2.uploadFile(bytes, filename, `image/${extension}`);
            
            console.log('📡 Upload result:', JSON.stringify(uploadResult));
            
            if (uploadResult.success && uploadResult.url) {
              finalImageUrl = uploadResult.url;
              console.log('✅ Image uploaded to R2:', finalImageUrl);
            } else {
              console.warn('⚠️ R2 upload failed, keeping base64:', uploadResult.error);
              // Keep base64 as fallback
            }
          } else {
            console.warn('⚠️ Invalid base64 format, keeping original');
            console.warn('⚠️ Image preview:', updateData.image.substring(0, 100));
          }
        } else {
          console.warn('⚠️ R2 not configured, keeping base64:', r2Config.message);
        }
      } catch (uploadError: any) {
        console.error('⚠️ Error uploading to R2, keeping base64:', uploadError.message);
        console.error('⚠️ Error stack:', uploadError.stack);
        // Keep base64 as fallback
      }
    } else {
      console.log('ℹ️ No new image or not base64, using existing image');
    }

    console.log('🖼️ Final image URL type:', finalImageUrl?.startsWith('http') ? 'R2 URL' : (finalImageUrl?.startsWith('data:') ? 'BASE64' : 'OTHER'));
    console.log('🖼️ Final image URL preview:', finalImageUrl?.substring(0, 100));

    const updatedPlace = {
      ...existingPlace,
      ...updateData,
      image: finalImageUrl, // Use R2 URL or fallback to base64
      id,
      userId: existingPlace.userId, // Keep original userId
      createdAt: existingPlace.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await purgeRemovedR2Urls(existingPlace, updatedPlace);
    console.log('💾 Saving updated place to KV...');
    await kv.set(`place:${id}`, updatedPlace);
    console.log('✅ Place updated successfully in KV');
    console.log('🔄 ===== UPDATE PLACE END (SUCCESS) =====\n');

    return c.json({ success: true, place: updatedPlace, message: 'Joy yangilandi' });
  } catch (error: any) {
    console.error('❌ ===== UPDATE PLACE ERROR =====');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ ===== UPDATE PLACE END (FAILED) =====\n');
    return c.json({ error: `Joy yangilashda xatolik: ${error.message}` }, 500);
  }
});

// ==================== REVIEWS ROUTES ====================

// Get reviews for a place
app.get("/make-server-27d0d16c/places/:id/reviews", async (c) => {
  try {
    const placeId = c.req.param('id');
    console.log('📝 Fetching reviews for place:', placeId);
    
    // Get all reviews for this place
    const allReviews = await kv.getByPrefix(`review:${placeId}:`);
    
    // Sort by creation date (newest first)
    const sortedReviews = allReviews.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    console.log(`✅ Found ${sortedReviews.length} reviews`);
    return c.json({ reviews: sortedReviews });
  } catch (error: any) {
    console.error('Get reviews error:', error);
    return c.json({ error: 'Sharhlarni olishda xatolik' }, 500);
  }
});

// Add review for a place
app.post("/make-server-27d0d16c/places/:id/reviews", async (c) => {
  try {
    const placeId = c.req.param('id');
    const data = await c.req.json();
    console.log('📝 Adding review for place:', placeId);
    
    // Validate required fields
    if (!data.rating || !data.comment || !data.userName || !data.userId) {
      return c.json({ error: 'Barcha maydonlar majburiy' }, 400);
    }
    
    // Validate rating (1-5)
    if (data.rating < 1 || data.rating > 5) {
      return c.json({ error: 'Baho 1 dan 5 gacha bo\'lishi kerak' }, 400);
    }
    
    // Check if place exists
    const place = await kv.get(`place:${placeId}`);
    if (!place) {
      return c.json({ error: 'Joy topilmadi' }, 404);
    }
    
    // Create review
    const reviewId = crypto.randomUUID();
    const review = {
      id: reviewId,
      placeId,
      userId: data.userId,
      userName: data.userName,
      rating: data.rating,
      comment: data.comment.trim(),
      createdAt: new Date().toISOString(),
    };
    
    // Save review
    await kv.set(`review:${placeId}:${reviewId}`, review);
    
    // Update place rating and review count
    const allReviews = await kv.getByPrefix(`review:${placeId}:`);
    const totalRating = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
    const averageRating = totalRating / allReviews.length;
    
    const updatedPlace = {
      ...place,
      rating: parseFloat(averageRating.toFixed(1)),
      reviews: allReviews.length,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`place:${placeId}`, updatedPlace);
    
    console.log('✅ Review added successfully');
    console.log(`📊 Updated rating: ${updatedPlace.rating} (${updatedPlace.reviews} reviews)`);
    
    return c.json({ 
      success: true, 
      review,
      place: updatedPlace,
      message: 'Sharh muvaffaqiyatli qo\'shildi' 
    });
  } catch (error: any) {
    console.error('Add review error:', error);
    return c.json({ error: `Sharh qo'shishda xatolik: ${error.message}` }, 500);
  }
});

// Delete place (no auth required - protected by frontend secret code)
app.delete("/make-server-27d0d16c/places/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const existingPlace = await kv.get(`place:${id}`);
    
    if (!existingPlace) {
      return c.json({ error: 'Joy topilmadi' }, 404);
    }

    await purgeAllManagedR2UrlsInRecord(existingPlace);
    await kv.del(`place:${id}`);

    return c.json({ success: true, message: 'Joy o\'chirildi' });
  } catch (error: any) {
    console.log('Delete place error:', error);
    return c.json({ error: `Joy o'chirishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== BRANCH PLACES ROUTES ====================

// Get places by branch
app.get("/make-server-27d0d16c/branch-places", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    
    console.log('📍 Fetching branch places:', branchId);
    
    if (!branchId) {
      return c.json({ error: 'Branch ID majburiy' }, 400);
    }
    
    const allPlaces = await kv.getByPrefix('place:');
    const branchPlaces = allPlaces.filter((place: any) => place.branchId === branchId);
    
    // Calculate real-time rating and reviews count
    const placesWithRatings = await Promise.all(
      branchPlaces.map(async (place: any) => {
        const reviews = await kv.getByPrefix(`review:${place.id}:`);
        const reviewCount = reviews.length;
        const averageRating = reviewCount > 0
          ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewCount
          : 0;
        
        return {
          ...place,
          // Ensure coordinates exist (default to Tashkent center if missing)
          coordinates: place.coordinates || [41.311, 69.279],
          rating: parseFloat(averageRating.toFixed(1)),
          reviews: reviewCount,
        };
      })
    );
    
    console.log(`✅ Found ${placesWithRatings.length} places for branch ${branchId}`);
    return c.json({ places: placesWithRatings });
  } catch (error: any) {
    console.log('Get branch places error:', error);
    return c.json({ error: 'Joylarni olishda xatolik' }, 500);
  }
});

// Create place for branch
app.post("/make-server-27d0d16c/branch-places", async (c) => {
  try {
    const data = await c.req.json();
    const {
      branchId,
      name,
      categoryId,
      description,
      phone,
      address,
      region,
      district,
      workingHours,
      image,
      images,
    } = data;
    
    console.log('📝 Creating branch place:', { branchId, name, categoryId });
    
    // Validation
    if (!branchId || !name || !categoryId || !region || !district) {
      return c.json({ error: 'Majburiy maydonlarni to\'ldiring' }, 400);
    }
    
    // Upload main image if base64
    let finalImageUrl = image;
    if (image && image.startsWith('data:image/')) {
      try {
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const contentType = matches[1];
          const base64Data = matches[2];
          
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const extension = contentType.split('/')[1] || 'jpg';
          const filename = `place/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
          
          const url = await r2.uploadToR2(filename, bytes, contentType);
          finalImageUrl = url;
        }
      } catch (uploadError: any) {
        console.error('Image upload failed:', uploadError);
      }
    }
    
    // Upload multiple images if base64
    const finalImageUrls: string[] = [];
    if (images && Array.isArray(images) && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        
        if (imageData && imageData.startsWith('data:image/')) {
          try {
            const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const contentType = matches[1];
              const base64Data = matches[2];
              
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              
              const extension = contentType.split('/')[1] || 'jpg';
              const filename = `place/${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
              
              const url = await r2.uploadToR2(filename, bytes, contentType);
              finalImageUrls.push(url);
            }
          } catch (uploadError: any) {
            console.error(`Image ${i + 1} upload failed:`, uploadError);
          }
        } else if (imageData && (imageData.startsWith('http://') || imageData.startsWith('https://'))) {
          finalImageUrls.push(imageData);
        }
      }
    }
    
    const placeId = `place-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const place = {
      id: placeId,
      branchId,
      name,
      categoryId,
      description: description || '',
      phone: phone || '',
      address: address || '',
      region,
      district,
      workingHours: workingHours || data.openingHours || '',
      coordinates: data.coordinates || [41.311, 69.279],
      services: data.services || [],
      openingHours: data.openingHours || '',
      workingDays: data.workingDays || [],
      instagram: data.instagram || '',
      youtube: data.youtube || '',
      telegram: data.telegram || '',
      image: finalImageUrl,
      images: finalImageUrls.length > 0 ? finalImageUrls : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`place:${placeId}`, place);
    
    console.log(`✅ Branch place created: ${placeId}`);
    return c.json({ place, message: 'Joy yaratildi' });
  } catch (error: any) {
    console.log('Create branch place error:', error);
    return c.json({ error: `Joy yaratishda xatolik: ${error.message}` }, 500);
  }
});

// Update branch place
app.put("/make-server-27d0d16c/branch-places/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const data = await c.req.json();
    
    console.log('📝 Updating branch place:', id);
    console.log('📦 Update data branchId:', data.branchId);
    
    const existingPlace = await kv.get(`place:${id}`);
    
    if (!existingPlace) {
      return c.json({ error: 'Joy topilmadi' }, 404);
    }
    
    console.log('🔍 Existing place branchId:', existingPlace.branchId);
    
    // Verify that this place belongs to the requesting branch (only if both have branchId)
    if (existingPlace.branchId && data.branchId && existingPlace.branchId !== data.branchId) {
      console.log('❌ branchId mismatch:', existingPlace.branchId, '!==', data.branchId);
      return c.json({ error: 'Siz faqat o\'z joylaringizni tahrirlay olasiz' }, 403);
    }
    
    // Upload new main image if provided as base64
    let finalImageUrl = data.image || existingPlace.image;
    if (data.image && data.image.startsWith('data:image/')) {
      try {
        const matches = data.image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const contentType = matches[1];
          const base64Data = matches[2];
          
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const extension = contentType.split('/')[1] || 'jpg';
          const filename = `place/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
          
          const url = await r2.uploadToR2(filename, bytes, contentType);
          finalImageUrl = url;
        }
      } catch (uploadError: any) {
        console.error('Image upload failed:', uploadError);
      }
    }
    
    // Upload new multiple images if provided as base64
    let finalImageUrls = data.images || existingPlace.images || [];
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < data.images.length; i++) {
        const imageData = data.images[i];
        
        if (imageData && imageData.startsWith('data:image/')) {
          try {
            const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const contentType = matches[1];
              const base64Data = matches[2];
              
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              
              const extension = contentType.split('/')[1] || 'jpg';
              const filename = `place/${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
              
              const url = await r2.uploadToR2(filename, bytes, contentType);
              uploadedUrls.push(url);
            }
          } catch (uploadError: any) {
            console.error(`Image ${i + 1} upload failed:`, uploadError);
          }
        } else if (imageData && (imageData.startsWith('http://') || imageData.startsWith('https://'))) {
          uploadedUrls.push(imageData);
        }
      }
      
      finalImageUrls = uploadedUrls;
    }
    
    const updatedPlace = {
      ...existingPlace,
      ...data,
      id: existingPlace.id,
      branchId: existingPlace.branchId,
      createdAt: existingPlace.createdAt,
      image: finalImageUrl,
      images: finalImageUrls,
      updatedAt: new Date().toISOString(),
    };
    
    await purgeRemovedR2Urls(existingPlace, updatedPlace);
    await kv.set(`place:${id}`, updatedPlace);
    
    console.log(`✅ Branch place updated: ${id}`);
    return c.json({ place: updatedPlace, message: 'Joy yangilandi' });
  } catch (error: any) {
    console.log('Update branch place error:', error);
    return c.json({ error: `Joy yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Delete branch place
app.delete("/make-server-27d0d16c/branch-places/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const branchId = c.req.query('branchId');
    
    console.log('🗑️ Deleting branch place:', id);
    console.log('📦 Delete request branchId:', branchId);
    
    const existingPlace = await kv.get(`place:${id}`);
    
    if (!existingPlace) {
      return c.json({ error: 'Joy topilmadi' }, 404);
    }
    
    console.log('🔍 Existing place branchId:', existingPlace.branchId);
    
    // Verify that this place belongs to the requesting branch (only if both have branchId)
    if (existingPlace.branchId && branchId && existingPlace.branchId !== branchId) {
      console.log('❌ branchId mismatch:', existingPlace.branchId, '!==', branchId);
      return c.json({ error: 'Siz faqat o\'z joylaringizni o\'chira olasiz' }, 403);
    }
    
    await purgeAllManagedR2UrlsInRecord(existingPlace);
    await kv.del(`place:${id}`);
    
    // Also delete all reviews for this place
    const reviews = await kv.getByPrefix(`review:${id}:`);
    await Promise.all(reviews.map((review: any) => kv.del(`review:${id}:${review.id}`)));
    
    console.log(`✅ Branch place deleted: ${id}`);
    return c.json({ success: true, message: 'Joy o\'chirildi' });
  } catch (error: any) {
    console.log('Delete branch place error:', error);
    return c.json({ error: `Joy o'chirishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== SHARE ROUTES ====================

// Generate share link for a place
app.post("/make-server-27d0d16c/places/:id/share", async (c) => {
  try {
    const placeId = c.req.param('id');
    console.log('🔗 ===== GENERATE SHARE LINK START =====');
    console.log('📍 Place ID:', placeId);
    
    // Check if place exists
    const place = await kv.get(`place:${placeId}`);
    if (!place) {
      console.log('❌ Place not found');
      return c.json({ error: 'Joy topilmadi' }, 404);
    }
    
    // Generate unique share code (8 characters)
    const shareCode = Math.random().toString(36).substring(2, 10);
    console.log('🎯 Generated share code:', shareCode);
    
    // Save share mapping
    const shareData = {
      shareCode,
      placeId,
      placeName: place.name,
      createdAt: new Date().toISOString(),
      clicks: 0,
    };
    
    await kv.set(`share:${shareCode}`, shareData);
    console.log('💾 Share mapping saved');
    
    // Generate share URL
    const shareUrl = `https://aresso.app/place/${shareCode}`;
    console.log('✅ Share URL generated:', shareUrl);
    console.log('🔗 ===== GENERATE SHARE LINK END =====\n');
    
    return c.json({ 
      success: true, 
      shareUrl,
      shareCode,
      message: 'Ulashish linki yaratildi' 
    });
  } catch (error: any) {
    console.error('❌ Generate share link error:', error);
    return c.json({ error: `Link yaratishda xatolik: ${error.message}` }, 500);
  }
});

// Get place by share code (PUBLIC - no auth)
app.get("/make-server-27d0d16c/share/:shareCode", async (c) => {
  try {
    const shareCode = c.req.param('shareCode');
    console.log('🔍 ===== GET PLACE BY SHARE CODE START =====');
    console.log('🎯 Share code:', shareCode);
    
    // Get share mapping
    const shareData = await kv.get(`share:${shareCode}`);
    if (!shareData) {
      console.log('❌ Share code not found');
      return c.json({ error: 'Link topilmadi' }, 404);
    }
    
    console.log('📍 Place ID from share:', shareData.placeId);
    
    // Increment click count
    shareData.clicks = (shareData.clicks || 0) + 1;
    await kv.set(`share:${shareCode}`, shareData);
    console.log('📊 Click count updated:', shareData.clicks);
    
    // Get place data
    const place = await kv.get(`place:${shareData.placeId}`);
    if (!place) {
      console.log('❌ Place not found');
      return c.json({ error: 'Joy topilmadi' }, 404);
    }
    
    console.log('✅ Place found:', place.name);
    console.log('🔍 ===== GET PLACE BY SHARE CODE END =====\n');
    
    return c.json({ 
      success: true, 
      place,
      shareData: {
        clicks: shareData.clicks,
        createdAt: shareData.createdAt,
      }
    });
  } catch (error: any) {
    console.error('❌ Get place by share code error:', error);
    return c.json({ error: `Ma'lumot olishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== BRANCH PROPERTIES (UY) ROUTES ====================

// Get properties by branch (with region/district filtering)
app.get("/make-server-27d0d16c/branch-properties", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    const region = c.req.query('region');
    const district = c.req.query('district');
    
    console.log('🏠 Getting branch properties:', { branchId, region, district });
    
    // Get ALL properties from BOTH sources: property: AND house:
    const branchProperties = await kv.getByPrefix('property:');
    const userHouses = await kv.getByPrefix('house:');
    const allProperties = [...branchProperties, ...userHouses];
    
    console.log(`📦 Total properties in DB: ${allProperties.length} (property: ${branchProperties.length} + house: ${userHouses.length})`);
    
    if (allProperties.length === 0) {
      console.warn('⚠️ Database is empty! No properties found.');
      console.warn('💡 To add test data, call: POST /make-server-27d0d16c/houses/seed');
      console.warn('💡 Or create properties through the UI');
    }
    
    // DEBUG: Show first 3 properties' region/district
    if (allProperties.length > 0) {
      console.log('🔍 Sample properties region/district:');
      allProperties.slice(0, 3).forEach((p: any, idx: number) => {
        console.log(`  ${idx + 1}. ${p.name}:`, {
          region: p.region,
          district: p.district,
          branchId: p.branchId,
          source: p.id?.startsWith('property:') ? 'FILIAL' : 'FOYDALANUVCHI'
        });
      });
    }
    
    // Filter by branchId if provided (filial faqat o'z propertylarini ko'radi)
    let filteredProperties = allProperties;
    
    if (branchId) {
      filteredProperties = filteredProperties.filter((p: any) => p.branchId === branchId);
      console.log(`🏢 After branchId filter (${branchId}): ${filteredProperties.length}`);
    } else {
      console.log('⚠️ NO branchId provided - showing ALL properties (filtered by region/district only)');
    }
    
    // Filter by region and district (agar PUBLIC qidiruv bo'lsa) - case-insensitive
    if (region) {
      const beforeCount = filteredProperties.length;
      filteredProperties = filteredProperties.filter((p: any) => 
        p.region && p.region.toLowerCase() === region.toLowerCase()
      );
      console.log(`📍 After region filter (${region}): ${filteredProperties.length} (was ${beforeCount})`);
      
      if (filteredProperties.length === 0 && beforeCount > 0) {
        console.warn(`⚠️ Region filter removed all ${beforeCount} properties!`);
        console.warn(`   📍 Looking for region: "${region}"`);
        console.warn(`   💡 Available regions in database:`, [...new Set(allProperties.map((p: any) => p.region).filter(Boolean))]);
      }
    }
    
    if (district) {
      const beforeCount = filteredProperties.length;
      filteredProperties = filteredProperties.filter((p: any) => 
        p.district && p.district.toLowerCase() === district.toLowerCase()
      );
      console.log(`📍 After district filter (${district}): ${filteredProperties.length} (was ${beforeCount})`);
      
      if (filteredProperties.length === 0 && beforeCount > 0) {
        console.warn(`⚠️ District filter removed all ${beforeCount} properties!`);
        console.warn(`   📍 Looking for district: "${district}"`);
        console.warn(`   💡 Available districts in database:`, [...new Set(allProperties.map((p: any) => p.district).filter(Boolean))]);
      }
    }
    
    // Ensure coordinates have default values
    const propertiesWithCoordinates = filteredProperties.map((property: any) => ({
      ...property,
      coordinates: property.coordinates || [41.311, 69.279], // Default Toshkent coordinates
      mortgageAvailable: property.mortgageAvailable !== undefined ? property.mortgageAvailable : property.hasMortgage || false, // Sync for old data
    }));
    
    console.log(`✅ Returning ${propertiesWithCoordinates.length} properties`);
    
    return c.json({ properties: propertiesWithCoordinates });
  } catch (error: any) {
    console.log('Get branch properties error:', error);
    return c.json({ error: 'Ko\'chmas mulklarni olishda xatolik' }, 500);
  }
});

// Create branch property
app.post("/make-server-27d0d16c/branch-properties", async (c) => {
  try {
    const data = await c.req.json();
    
    console.log('🏗️ Creating branch property:', data.name);
    console.log('📦 Branch ID:', data.branchId);
    
    if (!data.branchId) {
      return c.json({ error: 'Branch ID majburiy' }, 400);
    }
    
    if (!data.name || !data.price || !data.propertyType) {
      return c.json({ error: 'Majburiy maydonlarni to\'ldiring' }, 400);
    }
    
    const propertyId = `property-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Upload images if provided as base64
    let finalImageUrls: string[] = [];
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      for (let i = 0; i < data.images.length; i++) {
        const imageData = data.images[i];
        
        if (imageData && imageData.startsWith('data:image/')) {
          try {
            const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const contentType = matches[1];
              const base64Data = matches[2];
              
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              
              const extension = contentType.split('/')[1] || 'jpg';
              const filename = `property/${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
              
              const url = await r2.uploadToR2(filename, bytes, contentType);
              finalImageUrls.push(url);
            }
          } catch (uploadError: any) {
            console.error(`Image ${i + 1} upload failed:`, uploadError);
          }
        } else if (imageData && (imageData.startsWith('http://') || imageData.startsWith('https://'))) {
          finalImageUrls.push(imageData);
        }
      }
    }
    
    const property = {
      id: propertyId,
      branchId: data.branchId,
      userId: data.userId || data.branchId, // Store creator's userId
      name: data.name,
      propertyType: data.propertyType, // 'apartment', 'house', 'commercial', etc.
      description: data.description || '',
      price: data.price,
      priceType: data.priceType || 'sale', // 'sale' or 'rent'
      currency: data.currency || 'UZS',
      region: data.region ? data.region.toLowerCase() : '',
      district: data.district ? data.district.toLowerCase() : '',
      address: data.address || '',
      coordinates: data.coordinates || [41.311, 69.279],
      rooms: data.rooms || 1,
      bathrooms: data.bathrooms || 1,
      area: data.area || 0,
      floor: data.floor || 1,
      totalFloors: data.totalFloors || 1,
      buildYear: data.buildYear || new Date().getFullYear(),
      condition: data.condition || 'normal', // 'new', 'normal', 'renovation'
      hasParking: data.hasParking || false,
      hasFurniture: data.hasFurniture || false,
      hasElevator: data.hasElevator || false,
      hasBalcony: data.hasBalcony || false,
      hasMortgage: data.hasMortgage || false, // Ipoteka
      mortgageAvailable: data.hasMortgage || false, // Ipoteka - for frontend compatibility
      mortgageBank: data.mortgageBank || '',
      mortgagePercent: data.mortgagePercent || 0,
      mortgagePeriod: data.mortgagePeriod || 0,
      hasHalalInstallment: data.hasHalalInstallment || false, // Xalol Nasiya
      halalInstallmentBank: data.halalInstallmentBank || '',
      halalInstallmentMonths: data.halalInstallmentMonths || 0,
      halalDownPayment: data.halalDownPayment || 0,
      images: finalImageUrls,
      features: data.features || [],
      contactName: data.contactName || '',
      contactPhone: data.contactPhone || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Upload 360 panorama images if provided
    if (data.panoramaScenes && Array.isArray(data.panoramaScenes) && data.panoramaScenes.length > 0) {
      console.log(`📸 Uploading ${data.panoramaScenes.length} panorama scenes...`);
      const finalPanoramaScenes = [];
      
      for (let i = 0; i < data.panoramaScenes.length; i++) {
        const scene = data.panoramaScenes[i];
        
        if (scene.imageUrl && scene.imageUrl.startsWith('data:image/')) {
          try {
            const matches = scene.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const contentType = matches[1];
              const base64Data = matches[2];
              
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              
              const extension = contentType.split('/')[1] || 'jpg';
              const filename = `panorama/${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
              
              const url = await r2.uploadToR2(filename, bytes, contentType);
              
              finalPanoramaScenes.push({
                id: scene.id || `scene-${i}`,
                title: scene.title || `Xona ${i + 1}`,
                imageUrl: url,
                hotSpots: scene.hotSpots || [],
              });
              
              console.log(`✅ Panorama scene ${i + 1} uploaded:`, url);
            }
          } catch (uploadError: any) {
            console.error(`Panorama scene ${i + 1} upload failed:`, uploadError);
          }
        } else if (scene.imageUrl && (scene.imageUrl.startsWith('http://') || scene.imageUrl.startsWith('https://'))) {
          // Already uploaded, keep URL
          finalPanoramaScenes.push(scene);
        }
      }
      
      if (finalPanoramaScenes.length > 0) {
        property.panoramaScenes = finalPanoramaScenes;
        console.log(`✅ Total ${finalPanoramaScenes.length} panorama scenes added`);
      }
    }
    
    await kv.set(`property:${propertyId}`, property);
    
    console.log(`✅ Branch property created: ${propertyId}`);
    return c.json({ property, message: 'Ko\'chmas mulk qo\'shildi' });
  } catch (error: any) {
    console.log('Create branch property error:', error);
    return c.json({ error: `Ko'chmas mulk yaratishda xatolik: ${error.message}` }, 500);
  }
});

// Update branch property
app.put("/make-server-27d0d16c/branch-properties/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const data = await c.req.json();
    
    console.log('📝 Updating branch property:', id);
    console.log('📦 Update data branchId:', data.branchId);
    
    // Try both prefixes: property: (filial) and house: (foydalanuvchi)
    let existingProperty = await kv.get(`property:${id}`);
    let propertyKey = `property:${id}`;
    
    if (!existingProperty) {
      // Try house: prefix for user-created houses
      existingProperty = await kv.get(`house:${id}`);
      propertyKey = `house:${id}`;
      console.log('🔄 Property not found with property: prefix, trying house: prefix...');
    }
    
    if (!existingProperty) {
      console.log('❌ Property not found with either prefix:', id);
      return c.json({ error: 'Ko\'chmas mulk topilmadi' }, 404);
    }
    
    console.log('✅ Found property with key:', propertyKey);
    console.log('🔍 Existing property branchId:', existingProperty.branchId);
    console.log('🔍 Existing property userId:', existingProperty.userId);
    console.log('🔍 Request userId:', data.userId);
    
    // Verify ownership: check userId first, then fallback to branchId
    if (existingProperty.userId && data.userId) {
      // If both have userId, check userId match (user can only edit their own properties)
      if (existingProperty.userId !== data.userId) {
        console.log('❌ userId mismatch:', existingProperty.userId, '!==', data.userId);
        return c.json({ error: 'Siz faqat o\'z e\'lonlaringizni tahrirlay olasiz' }, 403);
      }
    } else if (existingProperty.branchId && data.branchId) {
      // Fallback to branchId check for old data without userId
      if (existingProperty.branchId !== data.branchId) {
        console.log('❌ branchId mismatch:', existingProperty.branchId, '!==', data.branchId);
        return c.json({ error: 'Siz faqat o\'z ko\'chmas mulklaringizni tahrirlay olasiz' }, 403);
      }
    }
    
    // Upload new images if provided as base64
    let finalImageUrls = data.images || existingProperty.images || [];
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < data.images.length; i++) {
        const imageData = data.images[i];
        
        if (imageData && imageData.startsWith('data:image/')) {
          try {
            const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const contentType = matches[1];
              const base64Data = matches[2];
              
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              
              const extension = contentType.split('/')[1] || 'jpg';
              const filename = `property/${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
              
              const url = await r2.uploadToR2(filename, bytes, contentType);
              uploadedUrls.push(url);
            }
          } catch (uploadError: any) {
            console.error(`Image ${i + 1} upload failed:`, uploadError);
          }
        } else if (imageData && (imageData.startsWith('http://') || imageData.startsWith('https://'))) {
          uploadedUrls.push(imageData);
        }
      }
      
      finalImageUrls = uploadedUrls;
    }
    
    const updatedProperty = {
      ...existingProperty,
      ...data,
      id: existingProperty.id,
      branchId: existingProperty.branchId,
      userId: existingProperty.userId || data.userId || existingProperty.branchId, // Preserve userId
      createdAt: existingProperty.createdAt,
      images: finalImageUrls,
      updatedAt: new Date().toISOString(),
      coordinates: data.coordinates || existingProperty.coordinates || [41.311, 69.279],
      mortgageAvailable: data.hasMortgage || false, // Sync with hasMortgage for frontend
      region: data.region ? data.region.toLowerCase() : existingProperty.region,
      district: data.district ? data.district.toLowerCase() : existingProperty.district,
    };
    
    // Upload 360 panorama images if provided
    if (data.panoramaScenes && Array.isArray(data.panoramaScenes)) {
      console.log(`📸 Updating ${data.panoramaScenes.length} panorama scenes...`);
      const finalPanoramaScenes = [];
      
      for (let i = 0; i < data.panoramaScenes.length; i++) {
        const scene = data.panoramaScenes[i];
        
        if (scene.imageUrl && scene.imageUrl.startsWith('data:image/')) {
          try {
            const matches = scene.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const contentType = matches[1];
              const base64Data = matches[2];
              
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              
              const extension = contentType.split('/')[1] || 'jpg';
              const filename = `panorama/${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
              
              const url = await r2.uploadToR2(filename, bytes, contentType);
              
              finalPanoramaScenes.push({
                id: scene.id || `scene-${i}`,
                title: scene.title || `Xona ${i + 1}`,
                imageUrl: url,
                hotSpots: scene.hotSpots || [],
              });
              
              console.log(`✅ Panorama scene ${i + 1} uploaded:`, url);
            }
          } catch (uploadError: any) {
            console.error(`Panorama scene ${i + 1} upload failed:`, uploadError);
          }
        } else if (scene.imageUrl && (scene.imageUrl.startsWith('http://') || scene.imageUrl.startsWith('https://'))) {
          // Already uploaded, keep URL
          finalPanoramaScenes.push(scene);
        }
      }
      
      if (finalPanoramaScenes.length > 0) {
        updatedProperty.panoramaScenes = finalPanoramaScenes;
        console.log(`✅ Total ${finalPanoramaScenes.length} panorama scenes updated`);
      } else {
        // If empty array provided, remove panorama scenes
        delete updatedProperty.panoramaScenes;
      }
    } else if (data.panoramaScenes === undefined) {
      // Keep existing panorama scenes if not provided in update
      updatedProperty.panoramaScenes = existingProperty.panoramaScenes;
    }
    
    await purgeRemovedR2Urls(existingProperty, updatedProperty);
    // Update using the correct key (property: or house:)
    await kv.set(propertyKey, updatedProperty);
    
    console.log(`✅ Branch property updated: ${propertyKey}`);
    return c.json({ property: updatedProperty, message: 'Ko\'chmas mulk yangilandi' });
  } catch (error: any) {
    console.log('Update branch property error:', error);
    return c.json({ error: `Ko'chmas mulk yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Delete branch property
app.delete("/make-server-27d0d16c/branch-properties/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const branchId = c.req.query('branchId');
    const userId = c.req.query('userId');
    
    console.log('🗑️ Deleting branch property:', id);
    console.log('📦 Delete request branchId:', branchId);
    console.log('👤 Delete request userId:', userId);
    
    // Try both prefixes: property: (filial) and house: (foydalanuvchi)
    let existingProperty = await kv.get(`property:${id}`);
    let propertyKey = `property:${id}`;
    
    if (!existingProperty) {
      // Try house: prefix for user-created houses
      existingProperty = await kv.get(`house:${id}`);
      propertyKey = `house:${id}`;
      console.log('🔄 Property not found with property: prefix, trying house: prefix...');
    }
    
    if (!existingProperty) {
      console.log('❌ Property not found with either prefix:', id);
      return c.json({ error: 'Ko\'chmas mulk topilmadi' }, 404);
    }
    
    console.log('✅ Found property with key:', propertyKey);
    console.log('🔍 Existing property branchId:', existingProperty.branchId);
    console.log('🔍 Existing property userId:', existingProperty.userId);
    
    // Verify ownership: check userId first, then fallback to branchId
    if (existingProperty.userId && userId) {
      // If both have userId, check userId match (user can only delete their own properties)
      if (existingProperty.userId !== userId) {
        console.log('❌ userId mismatch:', existingProperty.userId, '!==', userId);
        return c.json({ error: 'Siz faqat o\'z e\'lonlaringizni o\'chira olasiz' }, 403);
      }
    } else if (existingProperty.branchId && branchId) {
      // Fallback to branchId check for old data without userId
      if (existingProperty.branchId !== branchId) {
        console.log('❌ branchId mismatch:', existingProperty.branchId, '!==', branchId);
        return c.json({ error: 'Siz faqat o\'z ko\'chmas mulklaringizni o\'chira olasiz' }, 403);
      }
    }
    
    await purgeAllManagedR2UrlsInRecord(existingProperty);
    // Delete using the correct key (property: or house:)
    await kv.del(propertyKey);
    
    console.log(`✅ Branch property deleted: ${propertyKey}`);
    return c.json({ success: true, message: 'Ko\'chmas mulk o\'chirildi' });
  } catch (error: any) {
    console.log('Delete branch property error:', error);
    return c.json({ error: `Ko'chmas mulk o'chirishda xatolik: ${error.message}` }, 500);
  }
});

// Seed test properties
app.post("/make-server-27d0d16c/branch-properties/seed", async (c) => {
  try {
    console.log('🌱 Seeding test properties...');
    
    const testProperties = [
      {
        id: `property-${Date.now()}-1`,
        branchId: 'branch_1773383925094',
        name: '3-xonali kvartira',
        propertyType: 'apartment',
        description: 'Shahrixon tumanida, qulay joyda 3-xonali kvartira',
        price: 250000000,
        priceType: 'sale',
        currency: 'UZS',
        region: 'andijon',
        district: 'shahrixon',
        address: 'Mustaqillik ko\'chasi 12',
        coordinates: [40.7425, 72.3489],
        rooms: 3,
        bathrooms: 2,
        area: 85,
        floor: 5,
        totalFloors: 9,
        buildYear: 2020,
        condition: 'normal',
        hasParking: true,
        hasFurniture: false,
        hasElevator: true,
        hasBalcony: true,
        hasMortgage: true,
        mortgageBank: 'Ipoteka Bank',
        mortgagePercent: 18,
        mortgagePeriod: 15,
        images: [
          'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
          'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'
        ],
        features: ['Wi-Fi', 'Konditsioner', 'Oshxona jihozlari'],
        contactName: 'Ali Oripov',
        contactPhone: '+998 90 123 45 67',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `property-${Date.now()}-2`,
        branchId: 'branch_1773383925094',
        name: '2-xonali uy',
        propertyType: 'house',
        description: 'Shahrixon markazida hovlisi bilan 2-xonali uy',
        price: 180000000,
        priceType: 'sale',
        currency: 'UZS',
        region: 'andijon',
        district: 'shahrixon',
        address: 'Navoi ko\'chasi 45',
        coordinates: [40.7425, 72.3489],
        rooms: 2,
        bathrooms: 1,
        area: 120,
        floor: 1,
        totalFloors: 1,
        buildYear: 2018,
        condition: 'normal',
        hasParking: true,
        hasFurniture: false,
        hasElevator: false,
        hasBalcony: false,
        hasMortgage: false,
        images: [
          'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
          'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800'
        ],
        features: ['Hovli', 'Garaj', 'Bog\''],
        contactName: 'Vali Karimov',
        contactPhone: '+998 91 234 56 78',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];
    
    for (const property of testProperties) {
      await kv.set(`property:${property.id}`, property);
      console.log(`✅ Created: ${property.name}`);
    }
    
    console.log(`🎉 Seeded ${testProperties.length} properties`);
    return c.json({ 
      success: true, 
      message: `${testProperties.length} ta test property qo'shildi`,
      properties: testProperties 
    });
  } catch (error: any) {
    console.error('❌ Seed error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Clear all test properties
app.delete("/make-server-27d0d16c/branch-properties/clear", async (c) => {
  try {
    console.log('🗑️ Clearing all properties...');
    
    const allProperties = await kv.getByPrefix('property:');
    console.log(`📦 Found ${allProperties.length} properties to delete`);
    
    if (allProperties.length === 0) {
      console.log('ℹ️ No properties to delete');
      return c.json({ 
        success: true, 
        message: 'Hech qanday property topilmadi' 
      });
    }
    
    for (const property of allProperties) {
      try {
        await kv.del(`property:${property.id}`);
        console.log(`🗑️ Deleted: ${property.name || property.id}`);
      } catch (delError: any) {
        console.error(`❌ Failed to delete property ${property.id}:`, delError);
      }
    }
    
    console.log(`✅ Cleared ${allProperties.length} properties`);
    return c.json({ 
      success: true, 
      message: `${allProperties.length} ta property o'chirildi` 
    });
  } catch (error: any) {
    console.error('❌ Clear error:', error);
    return c.json({ error: error.message || 'O\'chirishda xatolik yuz berdi' }, 500);
  }
});

// ==================== BRANCH VEHICLES (MASHINA) ROUTES ====================

// Get vehicles by branch (with filtering)
app.get("/make-server-27d0d16c/branch-vehicles", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    const brand = c.req.query('brand');
    const fuelType = c.req.query('fuelType');
    
    console.log('🚗 Getting branch vehicles:', { branchId, brand, fuelType });
    
    // Get ALL vehicles from BOTH sources: vehicle: AND car:
    const branchVehicles = await kv.getByPrefix('vehicle:');
    const userCars = await kv.getByPrefix('car:');
    const allVehicles = [...branchVehicles, ...userCars];
    
    console.log(`📦 Total vehicles in DB: ${allVehicles.length} (vehicle: ${branchVehicles.length} + car: ${userCars.length})`);
    
    let filteredVehicles = allVehicles;
    
    // Filter by branchId if provided
    if (branchId) {
      filteredVehicles = filteredVehicles.filter((v: any) => v.branchId === branchId);
      console.log(`🔍 Filtered by branchId ${branchId}: ${filteredVehicles.length} vehicles`);
    }
    
    // Filter by brand if provided
    if (brand && brand !== 'all') {
      filteredVehicles = filteredVehicles.filter((v: any) => 
        v.brand?.toLowerCase() === brand.toLowerCase()
      );
      console.log(`🔍 Filtered by brand ${brand}: ${filteredVehicles.length} vehicles`);
    }
    
    // Filter by fuel type if provided
    if (fuelType && fuelType !== 'all') {
      filteredVehicles = filteredVehicles.filter((v: any) => 
        v.fuelType?.toLowerCase() === fuelType.toLowerCase()
      );
      console.log(`🔍 Filtered by fuelType ${fuelType}: ${filteredVehicles.length} vehicles`);
    }
    
    console.log(`✅ Returning ${filteredVehicles.length} vehicles`);
    
    return c.json({ vehicles: filteredVehicles });
  } catch (error: any) {
    console.log('Get branch vehicles error:', error);
    return c.json({ error: 'Mashinalarni olishda xatolik' }, 500);
  }
});

// Create branch vehicle
app.post("/make-server-27d0d16c/branch-vehicles", async (c) => {
  try {
    const data = await c.req.json();
    
    console.log('🚗 Creating branch vehicle:', data.name);
    console.log('📦 Branch ID:', data.branchId);
    
    if (!data.branchId) {
      return c.json({ error: 'Branch ID majburiy' }, 400);
    }
    
    if (!data.name || !data.price || !data.brand) {
      return c.json({ error: 'Majburiy maydonlarni to\'ldiring' }, 400);
    }
    
    const vehicleId = `vehicle-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Upload images if provided as base64
    let finalImageUrls: string[] = [];
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      for (let i = 0; i < data.images.length; i++) {
        const imageData = data.images[i];
        
        if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
          try {
            console.log(`📸 Uploading vehicle image ${i + 1}/${data.images.length}...`);
            const imageUrl = await r2.uploadImage(imageData, `vehicle-${vehicleId}-${i}`);
            finalImageUrls.push(imageUrl);
            console.log(`✅ Image ${i + 1} uploaded:`, imageUrl);
          } catch (uploadError: any) {
            console.error(`❌ Failed to upload image ${i + 1}:`, uploadError);
          }
        } else if (typeof imageData === 'string' && imageData.startsWith('http')) {
          finalImageUrls.push(imageData);
        }
      }
    }
    
    const vehicle = {
      id: vehicleId,
      ...data,
      images: finalImageUrls.length > 0 ? finalImageUrls : data.images || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Handle panorama scenes
    if (data.panoramaScenes && Array.isArray(data.panoramaScenes) && data.panoramaScenes.length > 0) {
      const finalPanoramaScenes = [];
      
      for (let i = 0; i < data.panoramaScenes.length; i++) {
        const scene = data.panoramaScenes[i];
        
        if (scene.preview && scene.preview.startsWith('data:image')) {
          try {
            console.log(`🌐 Uploading panorama scene ${i + 1}...`);
            const panoramaUrl = await r2.uploadImage(scene.preview, `vehicle-panorama-${vehicleId}-${i}`);
            finalPanoramaScenes.push({
              ...scene,
              url: panoramaUrl,
              preview: undefined,
            });
            console.log(`✅ Panorama ${i + 1} uploaded`);
          } catch (uploadError: any) {
            console.error(`❌ Failed to upload panorama ${i + 1}:`, uploadError);
          }
        } else if (scene.url) {
          finalPanoramaScenes.push(scene);
        }
      }
      
      if (finalPanoramaScenes.length > 0) {
        vehicle.panoramaScenes = finalPanoramaScenes;
        console.log(`✅ Total ${finalPanoramaScenes.length} panorama scenes added`);
      }
    }
    
    await kv.set(`vehicle:${vehicleId}`, vehicle);
    
    console.log(`✅ Branch vehicle created: ${vehicleId}`);
    return c.json({ vehicle, message: 'Mashina qo\'shildi' });
  } catch (error: any) {
    console.log('Create branch vehicle error:', error);
    return c.json({ error: `Mashina yaratishda xatolik: ${error.message}` }, 500);
  }
});

// Update branch vehicle
app.put("/make-server-27d0d16c/branch-vehicles/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const data = await c.req.json();
    
    console.log('📝 Updating branch vehicle:', id);
    console.log('📦 Update data branchId:', data.branchId);
    
    // Try both prefixes: vehicle: (filial) and car: (foydalanuvchi)
    let existingVehicle = await kv.get(`vehicle:${id}`);
    let vehicleKey = `vehicle:${id}`;
    
    if (!existingVehicle) {
      existingVehicle = await kv.get(`car:${id}`);
      vehicleKey = `car:${id}`;
      console.log('🔄 Vehicle not found with vehicle: prefix, trying car: prefix...');
    }
    
    if (!existingVehicle) {
      console.log('❌ Vehicle not found with either prefix:', id);
      return c.json({ error: 'Mashina topilmadi' }, 404);
    }
    
    console.log('✅ Existing vehicle found:', vehicleKey);
    
    // Upload new images if provided as base64
    let finalImageUrls: string[] = [];
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      for (let i = 0; i < data.images.length; i++) {
        const imageData = data.images[i];
        
        if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
          try {
            console.log(`📸 Uploading new vehicle image ${i + 1}/${data.images.length}...`);
            const imageUrl = await r2.uploadImage(imageData, `vehicle-${id}-${i}-${Date.now()}`);
            finalImageUrls.push(imageUrl);
            console.log(`✅ Image ${i + 1} uploaded:`, imageUrl);
          } catch (uploadError: any) {
            console.error(`❌ Failed to upload image ${i + 1}:`, uploadError);
          }
        } else if (typeof imageData === 'string' && imageData.startsWith('http')) {
          finalImageUrls.push(imageData);
        }
      }
    }
    
    const updatedVehicle = {
      ...existingVehicle,
      ...data,
      id,
      images: finalImageUrls.length > 0 ? finalImageUrls : (data.images || existingVehicle.images || []),
      updatedAt: new Date().toISOString(),
    };
    
    // Handle panorama scenes
    if (data.panoramaScenes && Array.isArray(data.panoramaScenes)) {
      if (data.panoramaScenes.length > 0) {
        const finalPanoramaScenes = [];
        
        for (let i = 0; i < data.panoramaScenes.length; i++) {
          const scene = data.panoramaScenes[i];
          
          if (scene.preview && scene.preview.startsWith('data:image')) {
            try {
              console.log(`🌐 Uploading new panorama scene ${i + 1}...`);
              const panoramaUrl = await r2.uploadImage(scene.preview, `vehicle-panorama-${id}-${i}-${Date.now()}`);
              finalPanoramaScenes.push({
                ...scene,
                url: panoramaUrl,
                preview: undefined,
              });
              console.log(`✅ Panorama ${i + 1} uploaded`);
            } catch (uploadError: any) {
              console.error(`❌ Failed to upload panorama ${i + 1}:`, uploadError);
            }
          } else if (scene.url) {
            finalPanoramaScenes.push(scene);
          }
        }
        
        if (finalPanoramaScenes.length > 0) {
          updatedVehicle.panoramaScenes = finalPanoramaScenes;
        }
      } else {
        delete updatedVehicle.panoramaScenes;
      }
    } else if (data.panoramaScenes === undefined) {
      updatedVehicle.panoramaScenes = existingVehicle.panoramaScenes;
    }
    
    await purgeRemovedR2Urls(existingVehicle, updatedVehicle);
    await kv.set(vehicleKey, updatedVehicle);
    
    console.log(`✅ Branch vehicle updated: ${vehicleKey}`);
    return c.json({ vehicle: updatedVehicle, message: 'Mashina yangilandi' });
  } catch (error: any) {
    console.log('Update branch vehicle error:', error);
    return c.json({ error: `Mashina yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Delete branch vehicle
app.delete("/make-server-27d0d16c/branch-vehicles/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const branchId = c.req.query('branchId');
    const userId = c.req.query('userId');
    
    console.log('🗑️ Deleting branch vehicle:', id);
    console.log('📦 Delete request branchId:', branchId);
    console.log('👤 Delete request userId:', userId);
    
    // Try both prefixes: vehicle: (filial) and car: (foydalanuvchi)
    let existingVehicle = await kv.get(`vehicle:${id}`);
    let vehicleKey = `vehicle:${id}`;
    
    if (!existingVehicle) {
      existingVehicle = await kv.get(`car:${id}`);
      vehicleKey = `car:${id}`;
      console.log('🔄 Vehicle not found with vehicle: prefix, trying car: prefix...');
    }
    
    if (!existingVehicle) {
      console.log('❌ Vehicle not found with either prefix:', id);
      return c.json({ error: 'Mashina topilmadi' }, 404);
    }
    
    console.log('✅ Existing vehicle found:', vehicleKey);
    
    // Check authorization
    if (existingVehicle.userId && userId) {
      if (existingVehicle.userId !== userId) {
        console.log('❌ userId mismatch:', existingVehicle.userId, '!==', userId);
        return c.json({ error: 'Siz faqat o\'z mashinalaringizni o\'chira olasiz' }, 403);
      }
    } else if (existingVehicle.branchId && branchId) {
      if (existingVehicle.branchId !== branchId) {
        console.log('❌ branchId mismatch:', existingVehicle.branchId, '!==', branchId);
        return c.json({ error: 'Siz faqat o\'z mashinalaringizni o\'chira olasiz' }, 403);
      }
    }
    
    await purgeAllManagedR2UrlsInRecord(existingVehicle);
    await kv.del(vehicleKey);
    
    console.log(`✅ Branch vehicle deleted: ${vehicleKey}`);
    return c.json({ success: true, message: 'Mashina o\'chirildi' });
  } catch (error: any) {
    console.log('Delete branch vehicle error:', error);
    return c.json({ error: `Mashina o'chirishda xatolik: ${error.message}` }, 500);
  }
});

// Clear all vehicles for branch
app.delete("/make-server-27d0d16c/branch-vehicles", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    
    console.log('🗑️ Clearing all vehicles for branch:', branchId);
    
    if (!branchId) {
      return c.json({ error: 'Branch ID majburiy' }, 400);
    }
    
    const allVehicles = await kv.getByPrefix('vehicle:');
    const vehiclesToDelete = allVehicles.filter((v: any) => v.branchId === branchId);
    
    console.log(`🗑️ Deleting ${vehiclesToDelete.length} vehicles...`);
    
    for (const vehicle of vehiclesToDelete) {
      await purgeAllManagedR2UrlsInRecord(vehicle);
      await kv.del(`vehicle:${vehicle.id}`);
    }
    
    console.log(`✅ ${vehiclesToDelete.length} vehicles deleted`);
    
    return c.json({ 
      success: true, 
      message: `${vehiclesToDelete.length} ta mashina o'chirildi` 
    });
  } catch (error: any) {
    console.error('❌ Clear error:', error);
    return c.json({ error: error.message || 'O\'chirishda xatolik yuz berdi' }, 500);
  }
});

// PUBLIC FAVORITES ENDPOINT - No auth required
app.get("/make-server-27d0d16c/favorites", async (c) => {
  try {
    console.log('📚 PUBLIC: Fetching favorites...');
    
    // Mock favorites data
    const mockFavorites = [
      {
        id: 'fav_1',
        type: 'product',
        itemId: 'product_1',
        name: 'Mock Product 1',
        price: 299000,
        image: '/mock-images/product1.jpg',
        createdAt: new Date().toISOString()
      },
      {
        id: 'fav_2',
        type: 'branch',
        itemId: 'branch_1',
        name: 'Test Branch 1',
        location: 'Tashkent',
        createdAt: new Date().toISOString()
      }
    ];

    console.log(`✅ PUBLIC: Found ${mockFavorites.length} favorites`);
    return c.json({ 
      success: true,
      favorites: mockFavorites,
      message: 'Favorites loaded (mock)'
    });
  } catch (error) {
    console.log('PUBLIC Get favorites error:', error);
    return c.json({ error: 'Favorites olishda xatolik' }, 500);
  }
});

// Health check endpoint
app.get("/make-server-27d0d16c/health", (c) => {
  const r2Config = r2.checkR2Config();
  
  return c.json({ 
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Server ishlamoqda",
    r2: r2Config,
    features: {
      banners: true,
      restaurants: true,
      rentals: true,
      auctions: true,
      bonus: true
    }
  });
});

// Alias for environments where Supabase strips the function slug from the path.
// This prevents auth-gate+rewrite mismatches from turning public endpoints into runtime errors.
app.get("/health", (c) => {
  const r2Config = r2.checkR2Config();
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Server ishlamoqda",
    r2: r2Config,
    features: {
      banners: true,
      restaurants: true,
      rentals: true,
      auctions: true,
      bonus: true,
    },
  });
});

// PUBLIC TEST ENDPOINT - No auth required
app.get("/make-server-27d0d16c/test-deployment", (c) => {
  console.log('\n🧪 ============ PUBLIC TEST DEPLOYMENT ENDPOINT ============');
  console.log('✅ This endpoint is PUBLIC - no auth required');
  console.log('🧪 ========================================================\n');
  
  return c.json({
    success: true,
    message: '✅ Edge Functions are working!',
    timestamp: new Date().toISOString(),
    endpoints: {
      public: ['/health', '/test-deployment', '/public/branches', '/favorites'],
      auth: ['/auth/sms/send', '/auth/sms/signup', '/auth/sms/signin'],
      user: ['/user/profile', '/upload'],
      products: ['/products', '/foods']
    }
  });
});

app.get("/test-deployment", (c) => {
  console.log('\n🧪 ============ PUBLIC TEST DEPLOYMENT ENDPOINT (alias) ============');
  return c.json({
    success: true,
    message: '✅ Edge Functions are working!',
    timestamp: new Date().toISOString(),
    endpoints: {
      public: ['/health', '/test-deployment', '/public/branches', '/favorites'],
      auth: ['/auth/sms/send', '/auth/sms/signup', '/auth/sms/signin'],
      user: ['/user/profile', '/upload'],
      products: ['/products', '/foods'],
    },
  });
});

// PUBLIC BRANCHES ENDPOINT - No auth required
app.get("/make-server-27d0d16c/public/branches", async (c) => {
  try {
    console.log('🌐 PUBLIC: Fetching all branches...');
    const branches = await kv.getByPrefix('branch:');
    console.log(`✅ PUBLIC: Found ${branches.length} branches`);
    return c.json({ branches });
  } catch (error) {
    console.log('PUBLIC Get branches error:', error);
    return c.json({ error: 'Filiallarni olishda xatolik' }, 500);
  }
});

// PUBLIC BRANCHES LOCATION ENDPOINT - No auth required
app.get("/make-server-27d0d16c/public/branches/location", async (c) => {
  try {
    const regionId = c.req.query('regionId');
    const districtId = c.req.query('districtId');
    
    console.log(`🌐 PUBLIC: Fetching branches for region: ${regionId}, district: ${districtId}`);
    
    const branches = await kv.getByPrefix('branch:');
    
    const filteredBranches = branches.filter((b: any) => {
      if (!b) return false;
      if (regionId && b.regionId !== regionId) return false;
      if (districtId && b.districtId !== districtId) return false;
      return true;
    });

    console.log(`✅ PUBLIC: Found ${filteredBranches.length} branches in location`);
    return c.json({ branches: filteredBranches });
  } catch (error) {
    console.log('PUBLIC Get branches by location error:', error);
    return c.json({ error: 'Filiallarni olishda xatolik' }, 500);
  }
});

// ==================== PAYMENT METHODS ROUTES ====================

function sanitizePaymentMethodsForPublic(methods: any[]) {
  return (Array.isArray(methods) ? methods : []).map((m: any) => ({
    type: String(m?.type || ''),
    enabled: Boolean(m?.enabled),
    isTestMode: normalizeKvTestModeForSave(m?.isTestMode),
    updatedAt: m?.updatedAt ?? null,
  }));
}

/** Payme: ID/kalit faqat Supabase Secrets — KV/admin javobida chiqmasin */
function redactPaymePaymentMethodForResponse(method: unknown) {
  if (!method || typeof method !== "object") return method;
  const m = method as Record<string, unknown>;
  if (String(m.type) !== "payme") return method;
  return { ...m, config: {}, isTestMode: false };
}

// Get all payment methods configuration (admin: to‘liq; boshqa: faqat type/enabled/test — maxfiy kalitsiz)
app.get("/make-server-27d0d16c/payment-methods", async (c) => {
  try {
    console.log('💳 Fetching payment methods configuration...');

    const methods = await kv.getByPrefix('payment_method:');
    const admin = await validateAdminAccess(c);

    console.log(`✅ Found ${methods.length} payment methods (admin=${admin.success})`);
    const outMethods = admin.success
      ? methods.map((m) => redactPaymePaymentMethodForResponse(m))
      : sanitizePaymentMethodsForPublic(methods);
    return c.json({
      success: true,
      methods: outMethods,
    });
  } catch (error: any) {
    console.error('Get payment methods error:', error);
    return c.json({ error: 'To\'lov usullarini olishda xatolik' }, 500);
  }
});

// Save or update payment method configuration
app.post("/make-server-27d0d16c/payment-methods", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error || 'Admin ruxsati talab qilinadi' }, 403);
    }

    const { type, enabled, isTestMode, config } = await c.req.json();

    console.log(`💾 Saving payment method: ${type}`);

    if (!type) {
      return c.json({ error: 'To\'lov turi majburiy' }, 400);
    }

    const encryptedConfig: Record<string, unknown> = {};
    if (type !== "payme") {
      for (const [key, value] of Object.entries(config || {})) {
        if (typeof value === "string") {
          encryptedConfig[key] = value;
        }
      }
    }

    const methodData = {
      type,
      enabled: enabled || false,
      isTestMode: type === "payme" ? false : normalizeKvTestModeForSave(isTestMode),
      config: type === "payme" ? {} : encryptedConfig,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`payment_method:${type}`, methodData);
    
    console.log(`✅ Payment method saved: ${type}`);
    return c.json({ 
      success: true,
      method: methodData,
      message: 'To\'lov usuli saqlandi',
    });
  } catch (error: any) {
    console.error('Save payment method error:', error);
    return c.json({ error: 'To\'lov usulini saqlashda xatolik' }, 500);
  }
});

// Get specific payment method configuration
app.get("/make-server-27d0d16c/payment-methods/:type", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error || 'Admin ruxsati talab qilinadi' }, 403);
    }

    const type = c.req.param('type');
    console.log(`💳 Fetching payment method: ${type}`);

    const method = await kv.get(`payment_method:${type}`);

    if (!method) {
      return c.json({ error: 'To\'lov usuli topilmadi' }, 404);
    }

    console.log(`✅ Payment method found: ${type}`);
    const outMethod = type === "payme" ? redactPaymePaymentMethodForResponse(method) : method;
    return c.json({
      success: true,
      method: outMethod,
    });
  } catch (error: any) {
    console.error('Get payment method error:', error);
    return c.json({ error: 'To\'lov usulini olishda xatolik' }, 500);
  }
});

// Delete payment method configuration
app.delete("/make-server-27d0d16c/payment-methods/:type", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error || 'Admin ruxsati talab qilinadi' }, 403);
    }

    const type = c.req.param('type');
    console.log(`🗑️ Deleting payment method: ${type}`);

    await kv.del(`payment_method:${type}`);
    
    console.log(`✅ Payment method deleted: ${type}`);
    return c.json({ 
      success: true,
      message: 'To\'lov usuli o\'chirildi',
    });
  } catch (error: any) {
    console.error('Delete payment method error:', error);
    return c.json({ error: 'To\'lov usulini o\'chirishda xatolik' }, 500);
  }
});

// ==================== PAYMENT PROCESSING ROUTES ====================

// Payme: Subscribe API — receipts.create (bitta pozitsiya; batafsil chek uchun /payme/create-receipt)
app.post("/make-server-27d0d16c/payments/payme/create", async (c) => {
  try {
    const { amount, orderId, userId } = await c.req.json();

    console.log('💳 Creating Payme receipt (payments/payme/create):', { amount, orderId, userId });

    const paymeConfig = await kv.get('payment_method:payme');

    const resolvedTest = resolvePaycomUseTestForPayme(paymeConfig);
    if (!isPaymeConfiguredForMode(resolvedTest, null)) {
      return c.json(
        {
          error: resolvedTest
            ? "Paycom TEST: Supabase Secrets — PAYCOM_REGISTER_ID va PAYCOM_SECRET_TEST."
            : "Paycom PROD: Supabase Secrets — PAYCOM_REGISTER_ID va PAYCOM_SECRET_PROD.",
          code: "PAYCOM_ENV_MISSING",
        },
        503,
      );
    }
    if (paymeConfig && paymeConfig.enabled === false) {
      return c.json({ error: 'Payme to\'lov usuli faol emas' }, 400);
    }

    /** Paycom account.order_id va tranzaksiya ID bir xil bo‘lsin — aralash ID «чек не найден» izohlarini kamaytiradi */
    const fallbackId = `payme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const oid = String(orderId || "").trim() || fallbackId;
    const transactionId = oid;
    const amountNum = Number(amount);
    const items = [
      {
        title: 'To\'lov',
        price: amountNum,
        count: 1,
        code: '00000000000000000',
        vat_percent: 0,
        package_code: '123456',
        units: 2411,
      },
    ];

    const created = await paymeCreateReceipt(amountNum, oid, items, undefined, `Buyurtma ${oid}`, {
      useTest: resolvedTest,
      checkoutBackUrl: undefined,
    });

    if (!created.success) {
      return c.json(
        { error: created.error || 'Paycom chek yaratilmadi', code: 'PAYCOM_RECEIPT_FAILED' },
        400,
      );
    }

    const transaction = {
      id: transactionId,
      orderId: oid,
      userId,
      amount: amountNum,
      method: 'payme',
      status: 'pending',
      receiptId: created.receiptId,
      isTestMode: resolvedTest,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`transaction:${transactionId}`, transaction);
    if (created.receiptId) {
      await kv.set(`paycom_receipt:${created.receiptId}`, {
        transactionId,
        orderId: oid,
        useTest: resolvedTest,
      });
    }

    return c.json({
      success: true,
      transaction,
      paymentUrl: created.checkoutUrl,
      receiptId: created.receiptId,
    });
  } catch (error: any) {
    console.error('Payme create transaction error:', error);
    return c.json({ error: 'Payme tranzaksiyasini yaratishda xatolik' }, 500);
  }
});

// Click: Create invoice
app.post("/make-server-27d0d16c/payments/click/create", async (c) => {
  try {
    const { amount, orderId, userId } = await c.req.json();
    
    console.log('💳 Creating Click invoice:', { amount, orderId, userId });

    const amountSom = Number(amount);
    if (!Number.isFinite(amountSom) || amountSom <= 0) {
      return c.json({ error: 'Noto\'g\'ri summa' }, 400);
    }

    const resolvedClick = await resolveClickInvoiceCredentials();
    if (!resolvedClick.ok) {
      return c.json(
        {
          error: resolvedClick.code === 'CLICK_CONFIG_INCOMPLETE'
            ? 'Click konfiguratsiyasi to‘liq emas. Supabase secrets yoki Admin: serviceId, merchantId, merchantUserId (kabinetdagi foydalanuvchi ID).'
            : resolvedClick.error,
          code: resolvedClick.code,
        },
        400,
      );
    }
    const { serviceId, merchantId, merchantUserId, clickIsTest } = resolvedClick;

    const transactionId = `click_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const transaction = {
      id: transactionId,
      orderId,
      userId,
      amount: amountSom,
      method: 'click',
      status: 'pending',
      isTestMode: clickIsTest,
      createdAt: new Date().toISOString(),
    };
    
    await kv.set(`transaction:${transactionId}`, transaction);
    // PREPARE `click_order:${transaction_param}` bo‘yicha qidiradi (summa so‘m; tiyin moslash `click.tsx`)
    await kv.set(`click_order:${transactionId}`, {
      orderId,
      amount: amountSom,
      phone: '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    
    const basePay = clickIsTest
      ? 'https://test.click.uz/services/pay'
      : 'https://my.click.uz/services/pay';
    const payUrl = new URL(basePay);
    payUrl.searchParams.set('service_id', serviceId);
    payUrl.searchParams.set('merchant_id', merchantId);
    payUrl.searchParams.set('merchant_user_id', merchantUserId);
    payUrl.searchParams.set('amount', String(amountSom));
    payUrl.searchParams.set('transaction_param', transactionId);
    
    console.log(`✅ Click invoice created: ${transactionId}`);
    return c.json({ 
      success: true,
      transaction,
      paymentUrl: payUrl.toString(),
    });
  } catch (error: any) {
    console.error('Click create invoice error:', error);
    return c.json({ error: 'Click invoice yaratishda xatolik' }, 500);
  }
});

// Generic payment webhook/callback handler
app.post("/make-server-27d0d16c/payments/callback/:method", async (c) => {
  try {
    const method = c.req.param('method');
    const body = await c.req.json();
    
    console.log(`📞 Payment callback received from ${method}:`, body);
    
    // Verify signature and process callback
    // This should be implemented based on each payment provider's specification
    
    console.log(`✅ Callback processed for ${method}`);
    return c.json({ 
      success: true,
      message: 'Callback processed',
    });
  } catch (error: any) {
    console.error('Payment callback error:', error);
    return c.json({ error: 'Callback qayta ishlashda xatolik' }, 500);
  }
});

// Check transaction status
app.get("/make-server-27d0d16c/payments/transaction/:id", async (c) => {
  try {
    const transactionId = c.req.param('id');
    console.log(`🔍 Checking transaction status: ${transactionId}`);
    
    const transaction = await kv.get(`transaction:${transactionId}`);
    
    if (!transaction) {
      return c.json({ error: 'Tranzaksiya topilmadi' }, 404);
    }
    
    console.log(`✅ Transaction found: ${transactionId}`);
    return c.json({ 
      success: true,
      transaction,
    });
  } catch (error: any) {
    console.error('Check transaction error:', error);
    return c.json({ error: 'Tranzaksiya holatini tekshirishda xatolik' }, 500);
  }
});

// ==================== USER DATA ROUTES ====================

// Get user favorites
app.get("/make-server-27d0d16c/user/:userId/favorites", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log('📚 Getting favorites for user:', userId);
    
    const favorites = await kv.get(`user:${userId}:favorites`) || [];
    
    console.log(`✅ Found ${favorites.length} favorites`);
    return c.json({ favorites });
  } catch (error: any) {
    console.error('Get favorites error:', error);
    return c.json({ error: 'Sevimlilarni olishda xatolik' }, 500);
  }
});

// Set user favorites
app.post("/make-server-27d0d16c/user/:userId/favorites", async (c) => {
  try {
    const userId = c.req.param('userId');
    const { favorites } = await c.req.json();
    console.log('💾 Saving favorites for user:', userId, favorites.length);
    
    await kv.set(`user:${userId}:favorites`, favorites);
    
    console.log('✅ Favorites saved');
    return c.json({ success: true, message: 'Sevimlilar saqlandi' });
  } catch (error: any) {
    console.error('Save favorites error:', error);
    return c.json({ error: 'Sevimlilarni saqlashda xatolik' }, 500);
  }
});

// Get user cart
app.get("/make-server-27d0d16c/user/:userId/cart", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log('🛒 Getting cart for user:', userId);
    
    const cart = await kv.get(`user:${userId}:cart`) || [];
    
    console.log(`✅ Found ${cart.length} cart items`);
    return c.json({ cart });
  } catch (error: any) {
    console.error('Get cart error:', error);
    return c.json({ error: 'Savatni olishda xatolik' }, 500);
  }
});

// Set user cart
app.post("/make-server-27d0d16c/user/:userId/cart", async (c) => {
  try {
    const userId = c.req.param('userId');
    const { cart } = await c.req.json();
    console.log('💾 Saving cart for user:', userId, cart.length);
    
    await kv.set(`user:${userId}:cart`, cart);
    
    console.log('✅ Cart saved');
    return c.json({ success: true, message: 'Savat saqlandi' });
  } catch (error: any) {
    console.error('Save cart error:', error);
    return c.json({ error: 'Savatni saqlashda xatolik' }, 500);
  }
});

// Get user bonus
app.get("/make-server-27d0d16c/user/:userId/bonus", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log('💰 Getting bonus for user:', userId);
    
    const bonusData = await kv.get(`user:${userId}:bonus`) || {
      balance: 0,
      earnedToday: 0,
      lastReset: new Date().toISOString().split('T')[0],
      tapCount: 0,
      totalEarned: 0,
    };
    
    console.log('✅ Bonus data:', bonusData);
    return c.json({ bonus: bonusData });
  } catch (error: any) {
    console.error('Get bonus error:', error);
    return c.json({ error: 'Bonusni olishda xatolik' }, 500);
  }
});

// Set user bonus
app.post("/make-server-27d0d16c/user/:userId/bonus", async (c) => {
  try {
    const userId = c.req.param('userId');
    const { bonus } = await c.req.json();
    console.log('💾 Saving bonus for user:', userId, bonus);
    
    await kv.set(`user:${userId}:bonus`, bonus);
    
    console.log('✅ Bonus saved');
    return c.json({ success: true, message: 'Bonus saqlandi' });
  } catch (error: any) {
    console.error('Save bonus error:', error);
    return c.json({ error: 'Bonusni saqlashda xatolik' }, 500);
  }
});

// Get user settings (theme, etc.)
app.get("/make-server-27d0d16c/user/:userId/settings", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log('⚙️ Getting settings for user:', userId);
    
    const settings = await kv.get(`user:${userId}:settings`) || {
      theme: 'dark',
      accentColor: '#14b8a6',
    };
    
    console.log('✅ Settings:', settings);
    return c.json({ settings });
  } catch (error: any) {
    console.error('Get settings error:', error);
    return c.json({ error: 'Sozlamalarni olishda xatolik' }, 500);
  }
});

// Set user settings
app.post("/make-server-27d0d16c/user/:userId/settings", async (c) => {
  try {
    const userId = c.req.param('userId');
    const { settings } = await c.req.json();
    console.log('💾 Saving settings for user:', userId, settings);
    
    await kv.set(`user:${userId}:settings`, settings);
    
    console.log('✅ Settings saved');
    return c.json({ success: true, message: 'Sozlamalar saqlandi' });
  } catch (error: any) {
    console.error('Save settings error:', error);
    return c.json({ error: 'Sozlamalarni saqlashda xatolik' }, 500);
  }
});

// Get user purchase history
app.get("/make-server-27d0d16c/user/:userId/purchases", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log('📜 Getting purchase history for user:', userId);
    
    const purchases = await kv.getByPrefix(`user:${userId}:purchase:`);
    
    // Sort by date (newest first)
    const sortedPurchases = purchases.sort((a: any, b: any) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    
    console.log(`✅ Found ${sortedPurchases.length} purchases`);
    return c.json({ purchases: sortedPurchases });
  } catch (error: any) {
    console.error('Get purchases error:', error);
    return c.json({ error: 'Xaridlar tarixini olishda xatolik' }, 500);
  }
});

// Add purchase to history
app.post("/make-server-27d0d16c/user/:userId/purchases", async (c) => {
  try {
    const userId = c.req.param('userId');
    const purchaseData = await c.req.json();
    
    const purchaseId = `purchase-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    console.log('💾 Saving purchase for user:', userId, purchaseId);
    
    const purchase = {
      id: purchaseId,
      ...purchaseData,
      createdAt: new Date().toISOString(),
    };
    
    await kv.set(`user:${userId}:purchase:${purchaseId}`, purchase);
    
    console.log('✅ Purchase saved');
    return c.json({ success: true, purchase, message: 'Xarid saqlandi' });
  } catch (error: any) {
    console.error('Save purchase error:', error);
    return c.json({ error: 'Xaridni saqlashda xatolik' }, 500);
  }
});

// ==================== SHOPS (DO'KONLAR) ROUTES ====================

// Get all shops
app.get("/make-server-27d0d16c/shops", async (c) => {
  try {
    const region = c.req.query('region');
    const district = c.req.query('district');
    
    console.log(`📍 Get shops filter - Region: ${region}, District: ${district}`);
    
    const shops = await kv.getByPrefix('shop:');
    
    // Filter out deleted shops and add services/products count
    const activeShops = shops
      .filter((shop: any) => {
        if (!shop || shop.deleted) return false;
        
        // Filter by region and district if provided
        if (region && shop.region && shop.region !== region) {
          console.log(`  ❌ Shop ${shop.id} (${shop.name}) filtered out - region mismatch: ${shop.region} !== ${region}`);
          return false;
        }
        if (district && shop.district && shop.district !== district) {
          console.log(`  ❌ Shop ${shop.id} (${shop.name}) filtered out - district mismatch: ${shop.district} !== ${district}`);
          return false;
        }
        
        console.log(`  ✅ Shop ${shop.id} (${shop.name}) passed filter (region: ${shop.region}, district: ${shop.district})`);
        return true;
      })
      .map((shop: any) => ({
        ...shop,
        servicesCount: shop.services?.length || 0,
        productsCount: shop.productsCount || 0,
      }));
    
    console.log(`📦 Returning ${activeShops.length} shops for region: ${region}, district: ${district}`);
    
    return c.json({ success: true, shops: activeShops });
  } catch (error: any) {
    console.log('Get shops error:', error);
    return c.json({ error: 'Do\'konlarni olishda xatolik' }, 500);
  }
});

// ==================== COURIERS ROUTES ====================

const buildCourierKey = (courierId: string) => `courier:${courierId}`;
const buildCourierSessionKey = (token: string) => `courier_session:${token}`;
const buildBranchSessionKey = (token: string) => `branch_session:${token}`;

const COURIER_BAG_STATUSES = new Set([
  'available_in_branch',
  'assigned_empty',
  'occupied',
  'return_pending',
  'maintenance',
  'lost',
  'inactive',
]);

/** Kuryerga biriktirilgan, hali yakunlanmagan buyurtma IDlari (bir vaqtning o‘zida bir nechtasi bo‘lishi mumkin). */
const listUndeliveredOrderIdsForCourier = async (courierId: string): Promise<string[]> => {
  const all = (await kv.getByPrefix('order:')).filter((o: any) => !o.deleted);
  return all
    .filter((o: any) => {
      if (o.assignedCourierId !== courierId) return false;
      const s = String(o.status || '').toLowerCase().trim();
      return s !== 'delivered' && s !== 'cancelled' && s !== 'awaiting_receipt';
    })
    .map((o: any) => o.id);
};

const normalizeCourierRecord = (courier: any) => ({
  id: courier.id,
  branchId: courier.branchId || '',
  name: courier.name || '',
  phone: courier.phone || '',
  email: courier.email || '',
  login: courier.login || '',
  pin: courier.pin || '',
  vehicleType: courier.vehicleType || 'bike',
  vehicleNumber: courier.vehicleNumber || '',
  status: courier.status || 'inactive',
  isAvailable: courier.isAvailable !== false,
  serviceRadiusKm: Number(courier.serviceRadiusKm || 5),
  serviceZoneIds: Array.isArray(courier.serviceZoneIds) ? courier.serviceZoneIds.map((id: any) => String(id).trim()).filter(Boolean) : [],
  serviceZoneNames: Array.isArray(courier.serviceZoneNames) ? courier.serviceZoneNames.map((name: any) => String(name).trim()).filter(Boolean) : [],
  serviceIps: Array.isArray(courier.serviceIps) ? courier.serviceIps.map((ip: any) => String(ip).trim()).filter(Boolean) : [],
  serviceZoneId: String(courier.serviceZoneId || '').trim(),
  serviceZoneName: String(courier.serviceZoneName || '').trim(),
  serviceIp: String(courier.serviceIp || '').trim(),
  ...(() => {
    const fromArr = Array.isArray(courier.activeOrderIds)
      ? courier.activeOrderIds.map((id: any) => String(id).trim()).filter(Boolean)
      : [];
    const one = courier.activeOrderId ? String(courier.activeOrderId).trim() : '';
    const merged = [...new Set([...fromArr, ...(one ? [one] : [])])];
    return {
      activeOrderIds: merged,
      activeOrderId: merged.length ? merged[0] : null,
    };
  })(),
  rating: Number(courier.rating || 0),
  totalDeliveries: Number(courier.totalDeliveries || 0),
  completedDeliveries: Number(courier.completedDeliveries || 0),
  cancelledDeliveries: Number(courier.cancelledDeliveries || 0),
  averageDeliveryTime: Number(courier.averageDeliveryTime || 0),
  totalEarnings: Number(courier.totalEarnings || 0),
  balance: Number(courier.balance || 0),
  lastDeliveryEarning: Number(courier.lastDeliveryEarning || 0),
  currentLocation: courier.currentLocation || null,
  workingHours: {
    start: courier.workingHours?.start || '09:00',
    end: courier.workingHours?.end || '18:00',
  },
  joinedAt: courier.joinedAt || new Date().toISOString(),
  lastActive: courier.lastActive || new Date().toISOString(),
  documents: {
    driverLicense: courier.documents?.driverLicense || '',
    vehicleRegistration: courier.documents?.vehicleRegistration || '',
    insurance: courier.documents?.insurance || '',
  },
  createdAt: courier.createdAt || new Date().toISOString(),
  updatedAt: courier.updatedAt || new Date().toISOString(),
  deleted: Boolean(courier.deleted),
});

const normalizeCourierBagRecord = (bag: any) => ({
  id: bag.id,
  branchId: bag.branchId || '',
  bagNumber: String(bag.bagNumber || '').trim(),
  bagCode: String(bag.bagCode || '').trim(),
  qrCode: String(bag.qrCode || '').trim(),
  bagType: String(bag.bagType || 'standard').trim() || 'standard',
  capacityLevel: String(bag.capacityLevel || 'single_order').trim() || 'single_order',
  status: COURIER_BAG_STATUSES.has(bag.status) ? bag.status : 'available_in_branch',
  notes: String(bag.notes || '').trim(),
  currentCourierId: bag.currentCourierId || null,
  currentOrderId: bag.currentOrderId || null,
  createdAt: bag.createdAt || new Date().toISOString(),
  updatedAt: bag.updatedAt || new Date().toISOString(),
  deleted: Boolean(bag.deleted),
});

const listCourierBags = async () => await courierBagDb.listBags();

const listCourierBagAssignments = async () => {
  const rows = await courierBagDb.listAssignments();
  return rows.map((a: any) => ({
    id: a.id,
    bagId: a.bagId,
    branchId: a.branchId,
    courierId: a.courierId,
    assignedAt: a.assignedAt,
    releasedAt: a.releasedAt,
    isActive: a.isActive,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }));
};

const listCourierBagOrderLinks = async () => {
  const rows = await courierBagDb.listOrderLinks();
  return rows.map((link: any) => ({
    id: link.id,
    bagId: link.bagId,
    orderId: link.orderId,
    courierId: link.courierId,
    attachedAt: link.attachedAt,
    detachedAt: link.detachedAt,
    isActive: link.isActive,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  }));
};

const buildBagIdentifier = (branchId: string, bagNumber: string) =>
  `${String(branchId || '').trim()}::${String(bagNumber || '').trim().toLowerCase()}`;

const buildBagCode = (branchId: string, bagNumber: string) =>
  `BAG-${String(branchId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}-${String(bagNumber || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;

const parseOptionalJsonBody = async (c: any) => {
  const contentType = String(
    c.req.header("content-type") ||
      c.req.header("Content-Type") ||
      c.req.raw?.headers?.get?.("content-type") ||
      "",
  ).toLowerCase();

  if (contentType.includes("application/x-www-form-urlencoded")) {
    try {
      const text = await c.req.text();
      const params = new URLSearchParams(text);
      const obj: Record<string, unknown> = {};
      for (const [key, value] of params.entries()) {
        obj[key] = value;
      }
      return obj;
    } catch {
      // fall through
    }
  }

  try {
    return await c.req.json();
  } catch {
    // Fallback for `application/x-www-form-urlencoded` / `multipart/form-data`.
    try {
      const formData = await c.req.formData();
      const obj: Record<string, unknown> = {};
      for (const [key, value] of formData.entries()) {
        // formData values are strings/files; we only need scalar primitives for our API.
        obj[key] = typeof value === "string" ? value : "";
      }
      return obj;
    } catch {
      return {};
    }
  }
};

const logCourierBagHistory = async (payload: {
  bagId: string;
  branchId?: string;
  courierId?: string | null;
  orderId?: string | null;
  actorType: string;
  actorId?: string | null;
  fromStatus?: string | null;
  toStatus: string;
  note: string;
}) => {
  const historyId = `bag_history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await courierBagDb.insertHistory({
    id: historyId,
    bagId: payload.bagId,
    branchId: payload.branchId || '',
    courierId: payload.courierId ?? null,
    orderId: payload.orderId ?? null,
    actorType: payload.actorType,
    actorId: payload.actorId ?? null,
    fromStatus: payload.fromStatus ?? null,
    toStatus: payload.toStatus,
    note: payload.note,
    createdAt: new Date().toISOString(),
  });
};

const getActiveBagAssignmentForBag = async (bagId: string) => {
  const assignments = await listCourierBagAssignments();
  return assignments.find((assignment: any) => assignment.bagId === bagId && assignment.isActive !== false && !assignment.releasedAt) || null;
};

const getActiveBagAssignmentsForCourier = async (courierId: string) => {
  const assignments = await listCourierBagAssignments();
  return assignments.filter((assignment: any) => assignment.courierId === courierId && assignment.isActive !== false && !assignment.releasedAt);
};

const getActiveBagOrderLinkByBag = async (bagId: string) => {
  const links = await listCourierBagOrderLinks();
  return links.find((link: any) => link.bagId === bagId && link.isActive !== false && !link.detachedAt) || null;
};

const getActiveBagOrderLinkByOrder = async (orderId: string) => {
  const links = await listCourierBagOrderLinks();
  return links.find((link: any) => link.orderId === orderId && link.isActive !== false && !link.detachedAt) || null;
};

/** So‘mka `capacity_level` — bir so‘mkada parallel nechta buyurtma bo‘lishi mumkin. */
const bagMaxSlots = (nb: { capacityLevel?: string }) => {
  const raw = String(nb.capacityLevel || 'single_order').trim().toLowerCase();
  if (raw === 'single_order' || raw === 'single' || raw === '1') return 1;
  if (raw === 'double' || raw === '2') return 2;
  if (raw === 'triple' || raw === '3') return 3;
  if (raw === 'quad' || raw === '4') return 4;
  const m = raw.match(/^(?:multi|max)[_:\s-]?(\d+)$/);
  if (m) return Math.min(20, Math.max(1, parseInt(m[1], 10)));
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return Math.min(20, n);
  return 1;
};

const countActiveOrderLinksForBagId = async (bagId: string): Promise<number> => {
  const links = await listCourierBagOrderLinks();
  return links.filter(
    (l: any) => l.bagId === bagId && l.isActive !== false && !l.detachedAt,
  ).length;
};

const bagFreeSlotsForBagId = async (bagId: string): Promise<number> => {
  const bag = await courierBagDb.getBagById(bagId);
  if (!bag || bag.deleted) return 0;
  const nb = normalizeCourierBagRecord(bag);
  const cap = bagMaxSlots(nb);
  const used = await countActiveOrderLinksForBagId(bagId);
  return Math.max(0, cap - used);
};

/** Kuryer sig‘im hisobida qatnashadigan so‘mka IDlari (biriktirish yoki currentCourierId). */
const getCourierCapacityBagIds = async (courierId: string): Promise<string[]> => {
  const fromAss = (await getActiveBagAssignmentsForCourier(courierId)).map((a: any) => String(a.bagId));
  const uniq = new Set(fromAss.filter(Boolean));
  if (uniq.size > 0) {
    return [...uniq];
  }
  const all = await courierBagDb.listBags();
  return all.filter((b) => !b.deleted && b.currentCourierId === courierId).map((b) => b.id);
};

const sumCourierBagFreeSlots = async (courierId: string): Promise<number> => {
  const bagIds = await getCourierCapacityBagIds(courierId);
  let s = 0;
  for (const bid of bagIds) {
    s += await bagFreeSlotsForBagId(bid);
  }
  return s;
};

const buildCourierBagSlotsPayload = async (courierId: string) => {
  const bagIds = await getCourierCapacityBagIds(courierId);
  let total = 0;
  let used = 0;
  for (const bid of bagIds) {
    const bag = await courierBagDb.getBagById(bid);
    if (!bag || bag.deleted) continue;
    const nb = normalizeCourierBagRecord(bag);
    total += bagMaxSlots(nb);
    used += await countActiveOrderLinksForBagId(bid);
  }
  const free = Math.max(0, total - used);
  return { total, used, free };
};

const buildCourierBagPayload = async (bag: any) => {
  const normalizedBag = normalizeCourierBagRecord(bag);
  const [courier, orderRecord] = await Promise.all([
    normalizedBag.currentCourierId ? kv.get(buildCourierKey(normalizedBag.currentCourierId)) : null,
    normalizedBag.currentOrderId ? getOrderRecord(normalizedBag.currentOrderId) : null,
  ]);

  return {
    ...normalizedBag,
    courierName: courier?.name || '',
    courierPhone: courier?.phone || '',
    orderNumber: orderRecord?.order?.orderNumber || orderRecord?.order?.id || '',
    orderStatus: orderRecord?.order?.status || '',
  };
};

const detachBagFromOrderInternal = async (orderId: string, options: {
  actorType: string;
  actorId?: string | null;
  note: string;
}) => {
  const link = await getActiveBagOrderLinkByOrder(orderId);
  if (!link) {
    return null;
  }

  const bag = await courierBagDb.getBagById(link.bagId);
  if (!bag || bag.deleted) {
    return null;
  }

  const normalizedBag = normalizeCourierBagRecord(bag);
  const detachedAt = new Date().toISOString();

  await courierBagDb.updateOrderLink(link.id, {
    isActive: false,
    detachedAt,
    updatedAt: detachedAt,
  });

  const linksAfter = await listCourierBagOrderLinks();
  const remainingOnBag = linksAfter.filter(
    (l: any) =>
      l.bagId === normalizedBag.id && l.isActive !== false && !l.detachedAt && l.orderId !== orderId,
  );
  const nextCurrentOrderId = remainingOnBag[0]?.orderId ?? null;
  const nextStatus = nextCurrentOrderId
    ? 'occupied'
    : normalizedBag.currentCourierId
      ? 'assigned_empty'
      : 'available_in_branch';

  const updatedBag = normalizeCourierBagRecord({
    ...normalizedBag,
    status: nextStatus,
    currentOrderId: nextCurrentOrderId,
    updatedAt: detachedAt,
  });

  const orderRecord = await getOrderRecord(orderId);
  if (orderRecord) {
    await kv.set(orderRecord.key, {
      ...orderRecord.order,
      assignedBagId: null,
      assignedBagNumber: null,
      assignedBagCode: null,
      updatedAt: detachedAt,
    });
  }

  await courierBagDb.updateBag(updatedBag);

  await logCourierBagHistory({
    bagId: updatedBag.id,
    branchId: updatedBag.branchId,
    courierId: updatedBag.currentCourierId,
    orderId,
    actorType: options.actorType,
    actorId: options.actorId || null,
    fromStatus: normalizedBag.status,
    toStatus: updatedBag.status,
    note: options.note,
  });

  return updatedBag;
};

const calculateCourierDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
};

const normalizeLocationValue = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[`'’‘ʻʼ-]/g, '')
    .replace(/\s+/g, '');

const resolveBranchIdFromLocation = async (regionValue?: unknown, districtValue?: unknown) => {
  const normalizedRegion = normalizeLocationValue(regionValue);
  const normalizedDistrict = normalizeLocationValue(districtValue);

  if (!normalizedRegion && !normalizedDistrict) {
    return null;
  }

  const branches = await kv.getByPrefix('branch:');
  const exactMatches = branches.filter((branch: any) => {
    const branchRegionValues = [
      branch?.regionId,
      branch?.regionName,
      branch?.region,
    ].map(normalizeLocationValue).filter(Boolean);
    const branchDistrictValues = [
      branch?.districtId,
      branch?.districtName,
      branch?.district,
    ].map(normalizeLocationValue).filter(Boolean);

    const regionMatches = !normalizedRegion || branchRegionValues.some((value: string) =>
      value === normalizedRegion || value.includes(normalizedRegion) || normalizedRegion.includes(value)
    );
    const districtMatches = !normalizedDistrict || branchDistrictValues.some((value: string) =>
      value === normalizedDistrict || value.includes(normalizedDistrict) || normalizedDistrict.includes(value)
    );

    return regionMatches && districtMatches;
  });

  if (exactMatches.length === 1) {
    return exactMatches[0].id;
  }

  if (exactMatches.length > 1) {
    const namedExactMatch = exactMatches.find((branch: any) =>
      normalizeLocationValue(branch?.districtId) === normalizedDistrict ||
      normalizeLocationValue(branch?.districtName) === normalizedDistrict
    );
    return namedExactMatch?.id || exactMatches[0].id;
  }

  return null;
};

const resolveBranchIdFromRestaurant = async (restaurantId: string) => {
  const raw = String(restaurantId || "").trim();
  if (!raw) return null;
  const key = raw.startsWith("restaurant:") ? raw : `restaurant:${raw}`;
  const restaurant = await kv.get(key);
  if (!restaurant) {
    return null;
  }

  const direct =
    restaurant.branchId ||
    restaurant.branchID ||
    restaurant.branch_id ||
    restaurant.branch?.id ||
    restaurant.branch?.branchId;
  if (direct) {
    return String(direct).trim() || null;
  }

  return await resolveBranchIdFromLocation(restaurant.region, restaurant.district);
};

const resolveBranchIdFromShop = async (shopId: string) => {
  const raw = String(shopId || "").trim();
  if (!raw) return null;
  const key = raw.startsWith("shop:") ? raw : `shop:${raw}`;
  const shop = await kv.get(key);
  if (!shop) return null;
  if (shop.branchId || shop.branchID || shop.branch_id) {
    return String(shop.branchId || shop.branchID || shop.branch_id).trim() || null;
  }
  return await resolveBranchIdFromLocation(shop.region, shop.district);
};

const inferOrderBranchId = async (payload: any) => {
  const directBranchId =
    payload?.branchId ||
    payload?.branchID ||
    payload?.branch_id ||
    payload?.branch?.id ||
    payload?.branch?.branchId;
  if (directBranchId) return directBranchId;

  // Food/restaurant orders may store restaurantId at top-level.
  const restaurantIdCandidate =
    payload?.restaurantId ||
    payload?.restaurant?.id ||
    payload?.restaurant?.restaurantId;
  if (restaurantIdCandidate) {
    const restaurantBranchId = await resolveBranchIdFromRestaurant(restaurantIdCandidate);
    if (restaurantBranchId) {
      return restaurantBranchId;
    }
  }

  const shopIdCandidate = payload?.shopId || payload?.shop?.id || payload?.shop?.shopId;
  if (shopIdCandidate) {
    const shopBranchId = await resolveBranchIdFromShop(shopIdCandidate);
    if (shopBranchId) {
      return shopBranchId;
    }
  }

  // Some legacy IDs embed restaurantId: order:restaurant:restaurant:<restaurantId>:<orderId>
  const rawId = String(payload?.id || payload?.orderId || "").trim();
  if (rawId.startsWith("order:restaurant:restaurant:")) {
    const restPart = rawId.slice("order:restaurant:restaurant:".length);
    const restId = restPart.split(":")[0];
    if (restId) {
      const restaurantBranchId = await resolveBranchIdFromRestaurant(restId);
      if (restaurantBranchId) {
        return restaurantBranchId;
      }
    }
  }

  // Generic fallback: find `restaurant:<id>` substring in id/orderId.
  const restMatch = rawId.match(/restaurant:(\d{6,})/i);
  if (restMatch?.[1]) {
    const restaurantBranchId = await resolveBranchIdFromRestaurant(restMatch[1]);
    if (restaurantBranchId) return restaurantBranchId;
  }

  if (Array.isArray(payload?.items)) {
    const firstItem = payload.items.find((item: any) =>
      item?.branchId ||
      item?.shopBranchId ||
      item?.branch?.id ||
      item?.restaurantBranchId ||
      item?.dishDetails?.branchId ||
      item?.restaurantId
    );

    const directBranchId =
      firstItem?.branchId ||
      firstItem?.shopBranchId ||
      firstItem?.branch?.id ||
      firstItem?.restaurantBranchId ||
      firstItem?.dishDetails?.branchId;

    if (directBranchId) {
      return directBranchId;
    }

    if (firstItem?.restaurantId) {
      const restaurantBranchId = await resolveBranchIdFromRestaurant(firstItem.restaurantId);
      if (restaurantBranchId) {
        return restaurantBranchId;
      }
    }

    const itemShopId = firstItem?.shopId || firstItem?.product?.shopId || firstItem?.variant?.shopId;
    if (itemShopId) {
      const shopBranchId = await resolveBranchIdFromShop(itemShopId);
      if (shopBranchId) return shopBranchId;
    }

    const locationBranchId = await resolveBranchIdFromLocation(
      firstItem?.restaurantRegion || firstItem?.region || payload?.region || payload?.regionId,
      firstItem?.restaurantDistrict || firstItem?.district || payload?.district || payload?.districtId
    );

    if (locationBranchId) {
      return locationBranchId;
    }
  }

  return null;
};

/** Mijoz savatidagi filial mahsuloti uchun `branchproduct:` KV kaliti (asosan productUuid). */
const resolveMarketCartBranchProductStorageId = (line: any): string => {
  const fromUuid = String(line?.productUuid ?? line?.product?.productUuid ?? "").trim();
  if (fromUuid) return fromUuid;
  const alt = String(line?.productId ?? "").trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(alt)
  ) {
    return alt;
  }
  return "";
};

/** Savat qatori onlayn do‘kon mahsuloti (KV `shop_product:...`). */
const isShopProductCartLine = (line: any): boolean => {
  if (String(line?.source || "").toLowerCase().trim() === "shop") return true;
  const pid = String(line?.id ?? line?.productId ?? "").trim();
  if (!pid) return false;
  if (pid.startsWith("shop_product:")) return true;
  return pid.startsWith("shop_product-");
};

const resolveShopProductVariantForOrder = (product: any, variantId: string) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variantId === "__first__") return variants[0] || null;
  const sv = String(variantId);
  const byId = variants.find((v: any) => String(v?.id) === sv);
  if (byId) return byId;
  const idx = Number(sv);
  if (Number.isInteger(idx) && idx >= 0 && idx < variants.length) return variants[idx] || null;
  return null;
};

const orderLineVariantKey = (line: any): string => {
  const vidRaw = line?.selectedVariantId ?? line?.variantId;
  return vidRaw != null && String(vidRaw).trim() !== "" ? String(vidRaw).trim() : "__first__";
};

async function resolveDishRecordForFoodLine(line: any): Promise<any | null> {
  const idLike = String(line?.id ?? "").trim();
  const idIfDish = idLike.startsWith("dish:") ? idLike : "";
  const raw = String(line?.dishDetails?.dishId ?? line?.dishId ?? idIfDish ?? "").trim();
  if (!raw) return null;
  const keys = raw.startsWith("dish:") ? [raw] : [raw, `dish:${raw}`];
  for (const k of keys) {
    const d = await kv.get(k);
    if (d && !d.deleted) return d;
  }
  return null;
}

/** Do‘kon/taom qatorlari uchun platforma ulushi (buyurtmada snapshot). */
async function enrichOrderItemsWithPlatformCommission(
  items: any[],
  orderType: string,
): Promise<
  | {
      ok: true;
      items: any[];
      platformCommissionTotalUzs: number;
      merchantGoodsPayoutUzs: number;
      commissionableItemsSubtotalUzs: number;
      /** Filial market mahsulotlari: variantdagi foida narx × miqdor (faqat filial analitikasi). */
      branchMarketProfitTotalUzs: number;
    }
  | { ok: false; error: string }
> {
  const required = isPlatformCommissionRequired();
  const ot = String(orderType || "").toLowerCase().trim();
  let platformTotal = 0;
  let commissionableSubtotal = 0;
  let branchMarketProfitTotalUzs = 0;
  const out: any[] = [];

  for (const line of items) {
    const qty = Math.max(1, Math.floor(Number(line?.quantity ?? 1)));
    const qtyMarket = Math.max(0, Math.floor(Number(line?.quantity ?? 1)));
    const unitPrice = Number(line?.price ?? line?.unitPrice ?? 0);
    const lineSubtotal = Math.max(0, unitPrice * qty);
    let pct = 0;
    let appliesCommission = false;
    let marketProfitFields: Record<string, number> = {};

    if (ot === "market" && !isShopProductCartLine(line) && qtyMarket > 0) {
      const storageId = resolveMarketCartBranchProductStorageId(line);
      if (storageId) {
        const bp = await kv.get(`branchproduct:${storageId}`);
        const variant = bp
          ? resolveShopProductVariantForOrder(bp, orderLineVariantKey(line))
          : null;
        const perUnit = Math.max(
          0,
          Math.round(Number(variant?.profitPrice ?? variant?.profit_price ?? 0)),
        );
        const lineProfit = Math.round(perUnit * qtyMarket);
        branchMarketProfitTotalUzs += lineProfit;
        marketProfitFields = {
          branchMarketProfitPerUnitUzs: perUnit,
          branchMarketProfitLineUzs: lineProfit,
        };
      }
    }

    if (isShopProductCartLine(line) || ot === "shop") {
      appliesCommission = true;
      const pid = String(line?.id ?? line?.productId ?? "").trim();
      const key = shopProductKvKeyFromPid(pid);
      if (key) {
        const product = await kv.get(key);
        const variant = product
          ? resolveShopProductVariantForOrder(product, orderLineVariantKey(line))
          : null;
        pct = clampPlatformCommissionPercent(variant?.commission);
      }
    } else if (ot === "food" || ot === "restaurant") {
      appliesCommission = true;
      const dish = await resolveDishRecordForFoodLine(line);
      const variant = dish
        ? resolveShopProductVariantForOrder(
            { variants: Array.isArray(dish.variants) ? dish.variants : [] },
            orderLineVariantKey(line),
          )
        : null;
      pct = clampPlatformCommissionPercent(
        variant?.commission ?? dish?.platformCommissionPercent,
      );
    }

    if (appliesCommission && required && pct < 1) {
      return {
        ok: false,
        error:
          "Platformaga berish % kamida 1% bo‘lishi kerak (har bir do‘kon/taom varianti). Sozlamalar: 2026-06-01 dan keyin majburiy.",
      };
    }

    const linePlatform = Math.round((lineSubtotal * pct) / 100);
    platformTotal += linePlatform;
    if (appliesCommission) commissionableSubtotal += lineSubtotal;

    out.push({
      ...line,
      ...(appliesCommission
        ? {
            platformCommissionPercent: pct,
            platformCommissionUzs: linePlatform,
            merchantLinePayoutUzs: Math.max(0, lineSubtotal - linePlatform),
          }
        : {}),
      ...marketProfitFields,
    });
  }

  return {
    ok: true,
    items: out,
    platformCommissionTotalUzs: platformTotal,
    commissionableItemsSubtotalUzs: commissionableSubtotal,
    merchantGoodsPayoutUzs: Math.max(0, commissionableSubtotal - platformTotal),
    branchMarketProfitTotalUzs,
  };
}

const shopProductKvKeyFromPid = (pid: string): string => {
  const p = String(pid || "").trim();
  if (!p) return "";
  return p.startsWith("shop_product:") ? p : `shop_product:${p}`;
};

/** Variantda jami sotilgan soni (buyurtma: +, bekor: -). */
const adjustVariantSoldCount = (variant: any, delta: number) => {
  if (!variant || !Number.isFinite(delta)) return;
  const d = Math.trunc(delta);
  if (d === 0) return;
  const cur = Math.max(0, Math.floor(Number(variant.soldCount ?? variant.soldThisWeek ?? 0)));
  variant.soldCount = Math.max(0, cur + d);
};

/**
 * Buyurtma bekor qilinganda sotilgan miqdorni omborga qaytarish (bir marta).
 * Avval `inventoryRestoredOnCancel` tekshiriladi.
 */
const restoreInventoryFromOrder = async (order: any) => {
  if (!order || order.inventoryRestoredOnCancel === true) return;
  const items = Array.isArray(order.items) ? order.items : [];
  for (const line of items) {
    const qty = Math.max(0, Math.floor(Number(line?.quantity ?? 1)));
    if (qty <= 0) continue;
    const vk = orderLineVariantKey(line);
    const pid = String(line?.id ?? line?.productId ?? "").trim();
    const isShopLine =
      isShopProductCartLine(line) ||
      (String(order?.shopId || "").trim() !== "" &&
        !!pid &&
        !resolveMarketCartBranchProductStorageId(line) &&
        String(order?.orderType || "").toLowerCase().trim() !== "market");

    if (isShopLine) {
      const productKey = shopProductKvKeyFromPid(pid);
      if (!productKey) continue;
      const product = await kv.get(productKey);
      if (!product || product.deleted) continue;
      const variant = resolveShopProductVariantForOrder(product, vk);
      if (!variant) continue;
      const cur = Math.floor(Number(variant.stock ?? variant.stockQuantity ?? 0));
      const next = cur + qty;
      variant.stock = next;
      variant.stockQuantity = next;
      adjustVariantSoldCount(variant, -qty);
      product.updatedAt = new Date().toISOString();
      await kv.set(productKey, product);
      continue;
    }

    const branchId = resolveMarketCartBranchProductStorageId(line);
    if (branchId) {
      const productKey = `branchproduct:${branchId}`;
      const product = await kv.get(productKey);
      if (!product || product.deleted) continue;
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      const variant =
        vk === "__first__"
          ? variants[0] || null
          : variants.find((v: any) => String(v?.id) === String(vk)) || null;
      if (!variant) continue;
      const cur = Math.floor(
        Number(variant.stock ?? variant.stockQuantity ?? variant.stockCount ?? 0),
      );
      const next = cur + qty;
      variant.stock = next;
      variant.stockQuantity = next;
      variant.stockCount = next;
      adjustVariantSoldCount(variant, -qty);
      product.updatedAt = new Date().toISOString();
      await kv.set(productKey, product);
    }
  }
};

const isPaidLikeStatus = (raw: unknown) => {
  const ps = String(raw || "").toLowerCase().trim();
  return ps === "paid" || ps === "completed" || ps === "success";
};

/** Filial / bekor — naqd usullar */
function isCashLikePaymentMethodRaw(pmRaw: unknown): boolean {
  const pmNorm = String(pmRaw ?? "").toLowerCase().trim();
  const pmCompact = pmNorm.replace(/\s+/g, "");
  if (
    pmCompact === "cash" ||
    pmCompact === "naqd" ||
    pmCompact === "naqdpul" ||
    pmCompact === "cod"
  ) {
    return true;
  }
  if (pmNorm.includes("naqd") || pmNorm.includes("naqt")) return true;
  if (pmNorm.includes("cash")) return true;
  return false;
}

/** Taom: `order:id` bilan restoran ro'yxati kalitini sinxronlash */
async function syncFoodOrderMirrorKv(order: any): Promise<void> {
  const mk = order?.foodOrderMirrorKey;
  if (typeof mk !== "string" || !mk.trim()) return;
  try {
    await kv.set(mk.trim(), order);
  } catch (e) {
    console.warn("[foodOrderMirror] sync failed:", e);
  }
}

/**
 * Tayyorlovchi `ready` qilgach market/ijara kuryerga chiqishi uchun:
 * to‘langan yoki naqd (pending) + onlayn tasdiq talab qilinmasa.
 */
const isCourierPaymentOkForReadyMarketRental = (order: any) => {
  const ot = String(order?.orderType || "").toLowerCase().trim();
  if (ot !== "market" && ot !== "rental") return false;
  if (String(order?.status || "").toLowerCase().trim() !== "ready") return false;
  const ps = String(order?.paymentStatus || "").toLowerCase().trim();
  if (isPaidLikeStatus(ps)) return true;
  const pm = String(order?.paymentMethod || "").toLowerCase().trim();
  const needsOnlinePaid =
    Boolean(order?.paymentRequiresVerification) ||
    pm === "qr" ||
    pm === "qrcode" ||
    pm.includes("qr") ||
    ["click", "payme", "uzum", "atmos", "humo", "apple", "google"].some((x) => pm.includes(x));
  if (ps === "pending" || ps === "" || ps === "unpaid") {
    if (needsOnlinePaid) return false;
    return true;
  }
  return false;
};

/** Kuryer “mavjud buyurtmalar” / qabul qilish: do‘kon/oshxona to‘lovdan keyin status oshxonaga o‘tishi mumkin. */
const isCourierMerchantPickupEligibleStatus = (orderType: unknown, status: unknown) => {
  const s = String(status || "").toLowerCase().trim();
  const ot = String(orderType || "").toLowerCase().trim();
  if (s === "accepted" || s === "confirmed") return true;
  if ((ot === "food" || ot === "restaurant" || ot === "shop") && (s === "preparing" || s === "ready")) return true;
  if ((ot === "market" || ot === "rental") && s === "ready") return true;
  return false;
};

const extractCustomerLocation = (payload: any) => {
  if (payload?.customerLocation != null) {
    const lat = Number(payload.customerLocation.lat);
    const lng = Number(payload.customerLocation.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  if (payload?.address != null && typeof payload.address === 'object') {
    const lat = Number(payload.address.lat);
    const lng = Number(payload.address.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return null;
};

/** Manzil qatoridagi lat,lng juftligi (checkout ba'zan faqat matn saqlaydi). */
const parseCoordsFromAddressText = (text: string): { lat: number; lng: number } | null => {
  const t = String(text || '').trim();
  const m = t.match(/(-?\d+\.?\d*)\s*[,;]\s*(-?\d+\.?\d*)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

/** Telegram / matn: oxiridagi «(lat, lng)» qavsini olib tashlash — to‘liq manzil matni qolsin. */
const stripTrailingCoordinateParen = (text: string): string => {
  return String(text || '')
    .replace(/\s*\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)\s*$/u, '')
    .trim();
};

/**
 * Buyurtma: mijoz manzilini Telegram va ko‘rsatish uchun — street/building/apartment/note + addressText;
 * kordinatalar chiqarilmaydi (order.customerLocation / address.lat saqlanadi).
 */
function formatHumanOrderAddressForTelegram(order: any): string {
  const oa = order?.address;
  const chunks: string[] = [];
  if (oa && typeof oa === 'object' && !Array.isArray(oa)) {
    for (const k of ['street', 'building', 'apartment', 'note'] as const) {
      const p = String((oa as any)[k] ?? '')
        .trim()
        .replace(/\s*[\r\n]+\s*/g, ', ')
        .replace(/\s{2,}/g, ' ');
      if (p) chunks.push(p);
    }
  }
  const fromObj = chunks.join(', ').trim();
  const at = stripTrailingCoordinateParen(String(order?.addressText ?? '').trim());
  if (fromObj && at) {
    if (fromObj.includes(at) || at.includes(fromObj)) {
      return fromObj.length >= at.length ? fromObj : at;
    }
    return `${at}, ${fromObj}`;
  }
  const ca = stripTrailingCoordinateParen(String(order?.customerAddress ?? '').trim());
  return fromObj || at || ca || 'Ko‘rsatilmagan';
}

function formatCustomerAddressForTelegram(customer: any): string {
  if (customer == null) return 'Ko‘rsatilmagan';
  if (typeof customer === 'string') {
    return stripTrailingCoordinateParen(customer) || 'Ko‘rsatilmagan';
  }
  if (typeof customer !== 'object') return 'Ko‘rsatilmagan';
  const rawAddr = (customer as any).address;
  if (typeof rawAddr === 'string' && rawAddr.trim()) {
    return stripTrailingCoordinateParen(rawAddr.trim()) || 'Ko‘rsatilmagan';
  }
  if (rawAddr && typeof rawAddr === 'object' && !Array.isArray(rawAddr)) {
    return formatHumanOrderAddressForTelegram({
      address: rawAddr,
      addressText: (customer as any).addressText,
    });
  }
  return formatHumanOrderAddressForTelegram({
    address: {
      street: (customer as any).street,
      building: (customer as any).building,
      apartment: (customer as any).apartment,
      note: (customer as any).note,
    },
    addressText: (customer as any).addressText,
  });
}

const tryParseCustomerCoordsFromOrderText = (order: any) => {
  const parts = [order.customerAddress, order.addressText, typeof order.address === 'string' ? order.address : ''].map(
    (s: unknown) => String(s || ''),
  );
  for (const text of parts) {
    const p = parseCoordsFromAddressText(text);
    if (p) return p;
  }
  return null;
};

const getZoneCenter = (zone: any) => {
  if (!zone?.polygon || !Array.isArray(zone.polygon) || zone.polygon.length === 0) {
    return null;
  }

  const validPoints = zone.polygon.filter((point: any) =>
    point &&
    typeof point.lat === 'number' &&
    typeof point.lng === 'number'
  );

  if (validPoints.length === 0) {
    return null;
  }

  const center = validPoints.reduce(
    (acc: { lat: number; lng: number }, point: { lat: number; lng: number }) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: Number((center.lat / validPoints.length).toFixed(6)),
    lng: Number((center.lng / validPoints.length).toFixed(6)),
  };
};

const resolveOrderCustomerLocation = async (order: any) => {
  const directLocation = order.customerLocation || extractCustomerLocation(order);
  if (directLocation != null) {
    const lat = Number(directLocation.lat);
    const lng = Number(directLocation.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  const fromText = tryParseCustomerCoordsFromOrderText(order);
  if (fromText) {
    return fromText;
  }

  if (order?.deliveryZone) {
    const zone = await kv.get(`delivery-zone:${order.deliveryZone}`);
    const zoneCenter = getZoneCenter(zone);
    if (zoneCenter) {
      return zoneCenter;
    }
  }

  return null;
};

const buildCourierVisibleOrder = async (
  order: any,
  options?: {
    branch?: any;
    customerLocation?: { lat: number; lng: number } | null;
  }
) => {
  const branch = options?.branch ?? (order.branchId ? await kv.get(`branch:${order.branchId}`) : null);
  const customerLocation = options?.customerLocation ?? await resolveOrderCustomerLocation(order);

  const ot = String(order.orderType || "").toLowerCase().trim();
  let restaurantName = String(order.restaurantName || "").trim();
  let shopName = String(order.shopName || "").trim();
  try {
    if (!restaurantName && (ot === "food" || ot === "restaurant") && order.restaurantId) {
      const rk = String(order.restaurantId).startsWith("restaurant:")
        ? String(order.restaurantId)
        : `restaurant:${order.restaurantId}`;
      const r = await kv.get(rk);
      restaurantName = String(r?.name || "").trim();
    }
    if (!shopName && ot === "shop" && order.shopId) {
      const sk = String(order.shopId).startsWith("shop:") ? String(order.shopId) : `shop:${order.shopId}`;
      const s = await kv.get(sk);
      shopName = String(s?.name || "").trim();
    }
  } catch {
    // ignore
  }

  const deliveryPrice =
    Number(order.deliveryPrice ?? order.deliveryFee ?? order.delivery_fee ?? 0) || 0;
  const finalTotal =
    Number(
      order.finalTotal ??
        order.totalAmount ??
        order.totalPrice ??
        order.total ??
        order.grandTotal ??
        0,
    ) || 0;

  const paymentMethod = String(
    order.paymentMethod ?? order.payment_method ?? '',
  ).trim();
  const paymentStatus = String(
    order.paymentStatus ?? order.payment_status ?? 'pending',
  ).trim();

  return {
    ...order,
    paymentMethod,
    paymentStatus,
    orderId: order.orderNumber || order.id,
    customerAddress:
      order.customerAddress ||
      order.addressText ||
      order.address?.street ||
      (typeof order.address === "string" ? order.address : "") ||
      (order.deliveryZone ? `Zona: ${order.deliveryZone}` : "") ||
      (customerLocation ? `${Number(customerLocation.lat).toFixed(5)}, ${Number(customerLocation.lng).toFixed(5)}` : ""),
    customerLocation,
    branchName: order.branchName || branch?.branchName || branch?.name || "Filial",
    branchAddress: branch?.address || "",
    branchCoordinates: order.branchCoordinates || branch?.coordinates || null,
    deliveryPrice,
    finalTotal,
    restaurantName: restaurantName || undefined,
    shopName: shopName || undefined,
    merchantName: restaurantName || shopName || undefined,
    assignedBagId: order.assignedBagId || null,
    assignedBagNumber: order.assignedBagNumber || null,
    assignedBagCode: order.assignedBagCode || null,
    preparedBagId: order.preparedBagId || null,
    preparedBagNumber: order.preparedBagNumber || null,
    preparedBagCode: order.preparedBagCode || null,
  };
};

async function validateCourierSession(c: any) {
  const token =
    c.req.header('X-Courier-Token') ||
    c.req.header('x-courier-token') ||
    c.req.raw.headers.get('X-Courier-Token') ||
    c.req.raw.headers.get('x-courier-token') ||
    c.req.query('token');

  if (!token) {
    return { success: false, error: 'Kuryer sessiyasi topilmadi' };
  }

  const session = await kv.get(buildCourierSessionKey(token));
  if (!session) {
    return { success: false, error: 'Kuryer sessiyasi topilmadi' };
  }

  if (Date.now() > Number(session.expiresAt || 0)) {
    await kv.del(buildCourierSessionKey(token));
    return { success: false, error: 'Kuryer sessiyasi muddati tugagan' };
  }

  const courier = await kv.get(buildCourierKey(session.courierId));
  if (!courier || courier.deleted) {
    return { success: false, error: 'Kuryer topilmadi' };
  }

  return {
    success: true,
    token,
    courier: normalizeCourierRecord(courier),
  };
}

async function validateBranchSession(c: any) {
  // Legacy branch token (KV) support
  const legacyToken =
    c.req.header("X-Branch-Token") ||
    c.req.header("x-branch-token") ||
    c.req.raw.headers.get("X-Branch-Token") ||
    c.req.raw.headers.get("x-branch-token") ||
    c.req.query("branchToken");

  if (legacyToken) {
    const session = await kv.get(buildBranchSessionKey(legacyToken));
    if (!session) {
      return { success: false as const, error: "Filial sessiyasi topilmadi" };
    }

    if (Date.now() > Number(session.expiresAt || 0)) {
      await kv.del(buildBranchSessionKey(legacyToken));
      return {
        success: false as const,
        error: "Filial sessiyasi muddati tugagan",
      };
    }

    const branchId = String(session.branchId || "");
    const branchRecord = branchId ? await kv.get(`branch:${branchId}`) : null;
    if (!branchRecord) {
      return { success: false as const, error: "Filial topilmadi" };
    }

    return {
      success: true as const,
      token: legacyToken,
      branchId,
      branch: branchRecord,
      authMode: "legacy" as const,
    };
  }

  // SaaS mode: Supabase Auth JWT → users → branch_staff_memberships
  const anonKey = String(Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  const branchSupabaseJwt = String(
    c.req.header("X-Branch-Supabase-Jwt") ||
      c.req.header("x-branch-supabase-jwt") ||
      "",
  ).trim();

  const authHeader =
    c.req.header("Authorization") ||
    c.req.header("authorization") ||
    c.req.raw.headers.get("Authorization") ||
    c.req.raw.headers.get("authorization") ||
    "";
  const authBearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  const bearer =
    branchSupabaseJwt ||
    (authBearer && authBearer !== anonKey ? authBearer : "");

  if (!bearer) {
    return { success: false as const, error: "Filial sessiyasi topilmadi" };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(bearer);

  if (authError || !user) {
    return { success: false as const, error: "Noto‘g‘ri token" };
  }

  // Ensure relational user exists (idempotent)
  const { data: existingUser, error: existingUserErr } = await supabase
    .from("users")
    .select("id, auth_user_id, role, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existingUserErr) {
    return {
      success: false as const,
      error: `User resolve error: ${existingUserErr.message}`,
    };
  }

  let relationalUserId = existingUser?.id as string | undefined;
  if (!relationalUserId) {
    const { data: inserted, error: insErr } = await supabase
      .from("users")
      .insert({
        auth_user_id: user.id,
        email: user.email || null,
        phone: (user.phone as string | null) || null,
        display_name:
          (user.user_metadata && (user.user_metadata.name as string)) ||
          user.email ||
          user.phone ||
          "Filial xodimi",
        role: "branch_staff",
        status: "active",
      })
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      return {
        success: false as const,
        error: insErr?.message || "Failed to create relational user",
      };
    }
    relationalUserId = inserted.id as string;
  }

  // Find active membership
  const { data: membership, error: memErr } = await supabase
    .from("branch_staff_memberships")
    .select("branch_id, branch_kv_id, role, status")
    .eq("user_id", relationalUserId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return {
      success: false as const,
      error: `Membership resolve error: ${memErr.message}`,
    };
  }

  const kvBranchId = membership?.branch_kv_id ? String(membership.branch_kv_id).trim() : "";
  const relationalBranchId = membership?.branch_id ? String(membership.branch_id).trim() : "";

  if (!kvBranchId && !relationalBranchId) {
    return {
      success: false as const,
      error: "Siz filialga biriktirilmagansiz (membership yo‘q)",
    };
  }

  let branchId = kvBranchId || relationalBranchId;
  let branchRecord: any = null;

  if (kvBranchId) {
    branchRecord = await kv.get(`branch:${kvBranchId}`);
    if (!branchRecord) {
      return { success: false as const, error: "Filial topilmadi" };
    }
  } else {
    const { data: branchRow, error: branchErr } = await supabase
      .from("branches")
      .select("id, name, phone, region_id, district_id, address_line1, address_line2, latitude, longitude")
      .eq("id", relationalBranchId)
      .maybeSingle();

    if (branchErr || !branchRow) {
      return { success: false as const, error: "Filial topilmadi" };
    }

    branchId = String(branchRow.id);
    branchRecord = {
      id: branchRow.id,
      name: branchRow.name,
      branchName: branchRow.name,
      phone: branchRow.phone || "",
      regionId: branchRow.region_id || "",
      districtId: branchRow.district_id || "",
      address:
        [branchRow.address_line1, branchRow.address_line2].filter(Boolean).join(", "),
      coordinates:
        branchRow.latitude != null && branchRow.longitude != null
          ? { lat: Number(branchRow.latitude), lng: Number(branchRow.longitude) }
          : null,
    };
  }

  return {
    success: true as const,
    token: `jwt:${user.id}`,
    branchId,
    relationalBranchId: relationalBranchId || undefined,
    branch: branchRecord,
    authMode: "jwt" as const,
    authUserId: user.id,
    userId: relationalUserId,
    role: membership.role || "staff",
  };
}

/** Postgres `order_groups.branch_id` is uuid; session `branchId` may be legacy `branch_*`. */
const POSTGRES_BRANCH_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolvePostgresBranchId(branchAuth: {
  branchId: string;
  relationalBranchId?: string;
}): Promise<string | null> {
  const rel = String(branchAuth.relationalBranchId || "").trim();
  if (POSTGRES_BRANCH_UUID_RE.test(rel)) return rel;
  const bid = String(branchAuth.branchId || "").trim();
  if (POSTGRES_BRANCH_UUID_RE.test(bid)) return bid;
  if (!bid) return null;
  const { data, error } = await supabase
    .from("branches")
    .select("id")
    .eq("legacy_kv_key", bid)
    .maybeSingle();
  if (error) {
    console.error("resolvePostgresBranchId:", error);
    return null;
  }
  return data?.id ? String(data.id) : null;
}

const sanitizeBranchSessionPayload = (branch: any) => ({
  id: branch.id,
  branchName: branch.name || branch.branchName,
  name: branch.name || branch.branchName,
  login: branch.login,
  region: branch.regionName || branch.region || '',
  district: branch.districtName || branch.district || '',
  phone: branch.phone || '',
  managerName: branch.managerName || 'Manager',
  coordinates: branch.coordinates || { lat: 0, lng: 0 },
  openDate: branch.openDate || branch.createdAt || '',
});

// SaaS branch staff: resolve current branch from Supabase JWT + membership.
app.get("/make-server-27d0d16c/branch/staff/me", async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json(
        { success: false, error: branchAuth.error || "Unauthorized" },
        401,
      );
    }

    return c.json({
      success: true,
      branchId: branchAuth.branchId,
      branch: sanitizeBranchSessionPayload(branchAuth.branch),
      authMode: (branchAuth as any).authMode || "legacy",
      role: (branchAuth as any).role || null,
      userId: (branchAuth as any).userId || null,
      authUserId: (branchAuth as any).authUserId || null,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error?.message || "Xatolik" }, 500);
  }
});

app.get("/make-server-27d0d16c/branch/dashboard/stats", async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json(
        { success: false, error: branchAuth.error || "Unauthorized" },
        401,
      );
    }

    const branchId = String(branchAuth.branchId || "");
    const allOrders = (await kv.getByPrefix("order:")).filter((o: any) => o && !o.deleted);
    const branchOrders = allOrders.filter((o: any) => String(o.branchId || "") === branchId);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();

    const todayOrders = branchOrders.filter((o: any) => {
      const t = new Date(o.createdAt || o.updatedAt || 0).getTime();
      return Number.isFinite(t) && t >= startMs;
    });

    const revenueToday = todayOrders
      .filter((o: any) => String(o.paymentStatus || "").toLowerCase() === "paid")
      .reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);

    const platformCommissionToday = todayOrders
      .filter((o: any) => String(o.paymentStatus || "").toLowerCase() === "paid")
      .reduce((sum: number, o: any) => sum + Number(o.platformCommissionTotalUzs || 0), 0);

    const platformCommissionAllTime = branchOrders
      .filter((o: any) => String(o.paymentStatus || "").toLowerCase() === "paid")
      .reduce((sum: number, o: any) => sum + Number(o.platformCommissionTotalUzs || 0), 0);

    const paidMarketToday = todayOrders.filter(
      (o: any) =>
        String(o.orderType || "").toLowerCase() === "market" &&
        String(o.paymentStatus || "").toLowerCase() === "paid",
    );
    const paidMarketAll = branchOrders.filter(
      (o: any) =>
        String(o.orderType || "").toLowerCase() === "market" &&
        String(o.paymentStatus || "").toLowerCase() === "paid",
    );
    const marketBranchProfitToday = paidMarketToday.reduce(
      (sum: number, o: any) => sum + Number(o.branchMarketProfitTotalUzs || 0),
      0,
    );
    const marketBranchProfitAllTime = paidMarketAll.reduce(
      (sum: number, o: any) => sum + Number(o.branchMarketProfitTotalUzs || 0),
      0,
    );

    const uniqueUsersToday = new Set(
      todayOrders.map((o: any) => String(o.userId || "")).filter(Boolean),
    ).size;

    const products = (await kv.getByPrefix("branchproduct:")).filter((p: any) => p && !p.deleted);
    const branchProducts = products.filter((p: any) => String(p.branchId || "") === branchId);

    return c.json({
      success: true,
      stats: {
        todayOrders: todayOrders.length,
        totalProducts: branchProducts.length,
        activeUsersToday: uniqueUsersToday,
        revenueToday,
        platformCommissionToday,
        platformCommissionAllTime,
        marketBranchProfitToday,
        marketBranchProfitAllTime,
      },
    });
  } catch (error: any) {
    console.error("branch dashboard stats error:", error);
    return c.json({ success: false, error: "Statistika olishda xatolik" }, 500);
  }
});

app.post("/make-server-27d0d16c/branch/session", async (c) => {
  try {
    const body = await parseOptionalJsonBody(c);
    const login = String(body.login || '').trim();
    const password = String(body.password || '').trim();
    const twoFactorToken = body.twoFactorToken != null ? String(body.twoFactorToken).trim() : '';

    if (!login || !password) {
      return c.json({ error: 'Login va parol majburiy' }, 400);
    }

    const branches = await kv.getByPrefix('branch:');
    const branch = branches.find(
      (b: any) => b && b.login === login && b.password === password && !b.deleted,
    );

    if (!branch) {
      return c.json({ error: 'Login yoki parol noto‘g‘ri' }, 401);
    }

    const branchId = branch.id;
    if (await branchRequiresTwoFactor(branchId)) {
      const lockPreview = await getBranch2FALockoutMeta(branchId);
      if (!twoFactorToken) {
        if (lockPreview.locked && lockPreview.lockedUntil) {
          return c.json(
            {
              success: false,
              needsTwoFactor: true,
              branchId,
              lockout: true,
              twoFactorLockedUntil: lockPreview.lockedUntil,
              twoFactorLockoutMessage: lockPreview.message,
            },
            200,
          );
        }
        return c.json({ success: false, needsTwoFactor: true, branchId }, 200);
      }

      const lock = await assertBranch2FANotLocked(branchId);
      if (!lock.ok) {
        return c.json(
          {
            error: lock.error,
            lockout: true,
            lockedUntil: lock.lockedUntil,
            retryAfterMs: lock.retryAfterMs,
          },
          423,
        );
      }

      const twoFa = await verifyBranchTwoFactorLogin(branchId, twoFactorToken);
      if (!twoFa.ok) {
        const rec = await recordBranch2FALoginFailure(branchId);
        return c.json(
          {
            error: twoFa.error || "2FA kod noto‘g‘ri",
            attemptsRemaining: rec.attemptsRemaining,
            ...(rec.justLocked && rec.lockedUntil
              ? { lockout: true, lockedUntil: rec.lockedUntil }
              : {}),
          },
          401,
        );
      }

      await clearBranch2FALoginLockout(branchId);
    }

    const token = `branch-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await kv.set(buildBranchSessionKey(token), {
      branchId,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    return c.json({
      success: true,
      token,
      branch: sanitizeBranchSessionPayload(branch),
    });
  } catch (error: any) {
    console.error('Branch session error:', error);
    return c.json({ error: 'Filial sessiyasida xatolik' }, 500);
  }
});

// ==================== ACCOUNTANT AUTH + HISTORY (VIEW-ONLY) ====================
// Bogalter panel: filial bo'yicha sotuv/ombor tarixini ko'rish.
const buildAccountantSessionKey = (token: string) => `accountant_session:${token}`;

async function validateAccountantSession(c: any) {
  const token =
    c.req.header('X-Accountant-Token') ||
    c.req.header('x-accountant-token') ||
    c.req.raw.headers.get('X-Accountant-Token') ||
    c.req.raw.headers.get('x-accountant-token') ||
    c.req.query('token');

  if (!token) {
    return { success: false as const, error: 'Bogalter sessiyasi topilmadi' };
  }

  const session = await kv.get(buildAccountantSessionKey(token));
  if (!session) {
    return { success: false as const, error: 'Bogalter sessiyasi topilmadi' };
  }

  if (Date.now() > Number(session.expiresAt || 0)) {
    await kv.del(buildAccountantSessionKey(token));
    return { success: false as const, error: 'Bogalter sessiyasi muddati tugagan' };
  }

  const branchId = String(session.branchId || '');
  if (!branchId) {
    return { success: false as const, error: 'Filial topilmadi' };
  }

  return { success: true as const, token, branchId };
}

// Accountant login: hozircha filial login/parol bilan ishlaydi (alohida bogalter user jadvali kiritilmagan).
app.post("/make-server-27d0d16c/accountant/login", async (c) => {
  try {
    const body = await parseOptionalJsonBody(c);
    const login = String(body.login || '').trim();
    const password = String(body.password || '').trim();

    if (!login || !password) {
      return c.json({ error: 'Login va parol majburiy' }, 400);
    }

    // Filial (branch) login/parolini bogalter login uchun ham ishlatamiz.
    const branches = await kv.getByPrefix('branch:');
    const branch = branches.find((b: any) => b && b.login === login && b.password === password && !b.deleted);

    if (!branch) {
      return c.json({ error: 'Login yoki parol noto‘g‘ri' }, 401);
    }

    const token = `accountant-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await kv.set(buildAccountantSessionKey(token), {
      branchId: branch.id,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    return c.json({
      success: true,
      token,
      branch: sanitizeBranchSessionPayload(branch),
      message: 'Bogalter muvaffaqiyatli kirildi',
    });
  } catch (error: any) {
    console.error('Accountant login error:', error);
    return c.json({ error: 'Bogalter login xatoligi' }, 500);
  }
});

// Sales history (accountant only)
app.get("/make-server-27d0d16c/accountant/sales-history", async (c) => {
  try {
    const auth = await validateAccountantSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const branchId = auth.branchId;
    const productId = c.req.query('productId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    let sales = await kv.getByPrefix('sale:');
    sales = sales.filter((s: any) => s && s.branchId === branchId);

    if (productId) {
      sales = sales.filter((s: any) => s.items?.some((item: any) => item.productId === productId));
    }

    if (startDate) {
      sales = sales.filter((s: any) => new Date(s.createdAt) >= new Date(startDate));
    }

    if (endDate) {
      sales = sales.filter((s: any) => new Date(s.createdAt) <= new Date(endDate));
    }

    sales.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ sales });
  } catch (error) {
    console.log('Accountant sales-history error:', error);
    return c.json({ error: 'Sotuv tarixini olishda xatolik' }, 500);
  }
});

// Inventory history (accountant only)
app.get("/make-server-27d0d16c/accountant/inventory-history", async (c) => {
  try {
    const auth = await validateAccountantSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const branchId = auth.branchId;
    const productId = c.req.query('productId');

    let history = await kv.getByPrefix('inventory_history:');
    history = history.filter((h: any) => h && h.branchId === branchId);

    if (productId) {
      history = history.filter((h: any) => h.productId === productId);
    }

    history.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ history });
  } catch (error) {
    console.log('Accountant inventory-history error:', error);
    return c.json({ error: 'Ombor tarixini olishda xatolik' }, 500);
  }
});

// ==================== BRANCH STAFF (Xodim) AUTH + REGISTRATION ====================
type StaffRole = 'warehouse' | 'operator' | 'cashier' | 'accountant' | 'support';

const buildStaffKey = (staffId: string) => `staff:${staffId}`;

function normalizeStaffRole(input: any): StaffRole | null {
  const role = String(input || '').toLowerCase().trim();
  // Backend role normalization: UI names -> internal roles
  if (['1', 'omborchi', 'warehouse', 'ombor'].includes(role)) return 'warehouse';
  if (['2', 'operator', 'opetar', 'opertor'].includes(role)) return 'operator';
  if (['3', 'cashier', 'kassa'].includes(role)) return 'cashier';
  if (['4', 'accountant', 'bogalter', 'bogal', 'buchgalter'].includes(role)) return 'accountant';
  if (['5', 'support', 'suppot', "qo'llab-quvvatlash"].includes(role)) return 'support';
  // Also accept direct internal role strings
  if (role === 'warehouse' || role === 'operator' || role === 'cashier' || role === 'accountant' || role === 'support') return role as StaffRole;
  return null;
}

async function listAllBranches() {
  const branches = await kv.getByPrefix('branch:');
  return branches.filter((b: any) => b && !b.deleted).map((b: any) => ({
    id: b.id,
    name: b.name || b.branchName,
    branchName: b.branchName || b.name || b.branchName,
  }));
}

app.get("/make-server-27d0d16c/staff", async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ error: branchAuth.error }, 403);
    }

    const branchId = c.req.query('branchId') ? String(c.req.query('branchId')).trim() : branchAuth.branchId;
    if (!branchId) {
      return c.json({ error: 'branchId kerak' }, 400);
    }
    if (branchAuth.branchId !== branchId) {
      return c.json({ error: "Bu filialga ruxsat yo'q" }, 403);
    }

    let staff = await kv.getByPrefix('staff:');
    staff = staff
      .filter((s: any) => s && !s.deleted)
      .filter((s: any) => s.branchId === branchId);

    staff.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const payload = staff.map((s: any) => {
      const { password: _pw, ...safe } = s || {};
      return { ...safe, role: s.role };
    });
    return c.json({ success: true, staff: payload });
  } catch (error: any) {
    console.log('Get staff error:', error);
    return c.json({ error: 'Xodimlarni olishda xatolik' }, 500);
  }
});

// Staff registration (branch manager/filial panel)
app.post("/make-server-27d0d16c/staff/register", async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ error: branchAuth.error }, 403);
    }

    const body = await c.req.json();
    const role = normalizeStaffRole(body.role);
    const login = String(body.login || '').trim();
    const password = String(body.password || '').trim();
    const firstName = String(body.firstName || body.ism || '').trim();
    const lastName = String(body.lastName || body.familya || '').trim();
    const phone = String(body.phone || body.telefon || '').trim();
    const address = String(body.address || body.manzil || '').trim();
    const gender = String(body.gender || body.jins || '').trim();
    const birthDate = String(body.birthDate || body.birth || body.tugilganKun || body.tugulganKun || '').trim();

    const monthlySalary = Number(body.monthlySalary ?? body.salary ?? body.maosh ?? body.oylik);
    if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
      return c.json({ error: "Oylik maosh noto'g'ri (0 yoki musbat son)" }, 400);
    }

    const normalizeWorkTimeHHMM = (raw: unknown): string => {
      const s = String(raw ?? '').trim();
      if (!s) return '';
      const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*[AaPp][Mm])?/);
      if (!m) return '';
      let h = Number(m[1]);
      let min = Number(m[2]);
      if (!Number.isFinite(h) || !Number.isFinite(min)) return '';
      h = Math.min(23, Math.max(0, Math.floor(h)));
      min = Math.min(59, Math.max(0, Math.floor(min)));
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    const wsIn = body.workSchedule && typeof body.workSchedule === 'object' ? body.workSchedule : null;
    let workStart = normalizeWorkTimeHHMM(wsIn?.start ?? body.workStart ?? body.ishBoshlanishi);
    let workEnd = normalizeWorkTimeHHMM(wsIn?.end ?? body.workEnd ?? body.ishTugashi);
    if (!workStart) workStart = '09:00';
    if (!workEnd) workEnd = '18:00';
    const daysRaw = Array.isArray(wsIn?.days) ? wsIn.days : Array.isArray(body.workDays) ? body.workDays : [];
    const workDays = daysRaw.map((d: any) => String(d).toLowerCase().trim()).filter(Boolean);
    if (!workDays.length) {
      return c.json({ error: 'Ish kunlari kamida bittasi tanlanishi kerak' }, 400);
    }

    if (!role || !login || !password || !firstName || !lastName || !phone || !address || !gender || !birthDate) {
      return c.json({ error: "To'liq ma'lumot majburiy" }, 400);
    }

    if (password.length < 4) {
      return c.json({ error: 'Parol juda qisqa' }, 400);
    }

    // Uniqueness: (branchId + login)
    const allStaff = await kv.getByPrefix('staff:');
    const existing = allStaff.find((s: any) => s && !s.deleted && s.branchId === branchAuth.branchId && s.login === login);
    if (existing) {
      return c.json({ error: 'Bu login band' }, 400);
    }

    const staffId = `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await kv.set(buildStaffKey(staffId), {
      id: staffId,
      branchId: branchAuth.branchId,
      role,
      firstName,
      lastName,
      login,
      password,
      phone,
      address,
      gender,
      birthDate,
      monthlySalary,
      workSchedule: { start: workStart, end: workEnd, days: workDays },
      status: 'active',
      deleted: false,
      createdAt: now,
      updatedAt: now,
    });

    return c.json({ success: true, staffId, message: "Xodim ro'yxatga olindi" });
  } catch (error: any) {
    console.log('Staff register error:', error);
    return c.json({ error: "Xodim ro'yxatga olishda xatolik" }, 500);
  }
});

// Staff update (filial paneli)
app.put("/make-server-27d0d16c/staff/:id", async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ error: branchAuth.error }, 403);
    }

    const staffId = String(c.req.param('id') || '').trim();
    if (!staffId) {
      return c.json({ error: 'staffId kerak' }, 400);
    }

    const existing = await kv.get(buildStaffKey(staffId));
    if (!existing || existing.deleted || existing.branchId !== branchAuth.branchId) {
      return c.json({ error: 'Xodim topilmadi' }, 404);
    }

    const body = await c.req.json();

    const roleIn = body.role !== undefined ? normalizeStaffRole(body.role) : (existing.role as StaffRole);
    if (!roleIn) {
      return c.json({ error: 'Rol noto‘g‘ri' }, 400);
    }

    const firstName = body.firstName !== undefined ? String(body.firstName).trim() : existing.firstName;
    const lastName = body.lastName !== undefined ? String(body.lastName).trim() : existing.lastName;
    const phone = body.phone !== undefined ? String(body.phone).trim() : existing.phone;
    const address = body.address !== undefined ? String(body.address).trim() : existing.address;
    const gender = body.gender !== undefined ? String(body.gender).trim() : existing.gender;
    const birthDate = body.birthDate !== undefined ? String(body.birthDate).trim() : existing.birthDate;
    const login = body.login !== undefined ? String(body.login).trim() : existing.login;

    if (!firstName || !lastName || !phone || !address || !gender || !birthDate || !login) {
      return c.json({ error: "To'liq ma'lumot majburiy" }, 400);
    }

    let monthlySalary = existing.monthlySalary;
    if (body.monthlySalary !== undefined || body.salary !== undefined || body.maosh !== undefined) {
      const n = Number(body.monthlySalary ?? body.salary ?? body.maosh ?? existing.monthlySalary);
      if (!Number.isFinite(n) || n < 0) {
        return c.json({ error: "Oylik maosh noto'g'ri" }, 400);
      }
      monthlySalary = n;
    }

    let workSchedule = existing.workSchedule || { start: '', end: '', days: [] };
    if (body.workSchedule && typeof body.workSchedule === 'object') {
      const start = String(body.workSchedule.start || '').trim();
      const end = String(body.workSchedule.end || '').trim();
      const days = Array.isArray(body.workSchedule.days)
        ? body.workSchedule.days.map((d: any) => String(d).toLowerCase().trim()).filter(Boolean)
        : workSchedule.days;
      workSchedule = {
        start: start || workSchedule.start,
        end: end || workSchedule.end,
        days: days.length ? days : workSchedule.days,
      };
    } else if (body.workStart !== undefined || body.workEnd !== undefined || body.workDays !== undefined) {
      const start = body.workStart !== undefined ? String(body.workStart).trim() : workSchedule.start;
      const end = body.workEnd !== undefined ? String(body.workEnd).trim() : workSchedule.end;
      const days =
        Array.isArray(body.workDays) && body.workDays.length
          ? body.workDays.map((d: any) => String(d).toLowerCase().trim()).filter(Boolean)
          : workSchedule.days;
      workSchedule = { start, end, days };
    }

    const defaultDays = ['mon', 'tue', 'wed', 'thu', 'fri'];
    if (!workSchedule.start) workSchedule.start = '09:00';
    if (!workSchedule.end) workSchedule.end = '18:00';
    if (!Array.isArray(workSchedule.days) || !workSchedule.days.length) {
      workSchedule.days = defaultDays;
    }

    const allStaff = await kv.getByPrefix('staff:');
    const loginTaken = allStaff.some(
      (s: any) => s && !s.deleted && s.branchId === branchAuth.branchId && s.login === login && s.id !== staffId,
    );
    if (loginTaken) {
      return c.json({ error: 'Bu login band' }, 400);
    }

    const newPassword = body.password !== undefined ? String(body.password).trim() : '';
    if (newPassword && newPassword.length < 4) {
      return c.json({ error: 'Yangi parol juda qisqa' }, 400);
    }

    const now = new Date().toISOString();
    const updated = {
      ...existing,
      role: roleIn,
      firstName,
      lastName,
      phone,
      address,
      gender,
      birthDate,
      login,
      monthlySalary,
      workSchedule,
      updatedAt: now,
      ...(newPassword ? { password: newPassword } : {}),
    };

    await kv.set(buildStaffKey(staffId), updated);
    const { password: _p, ...safe } = updated;
    return c.json({ success: true, staff: safe });
  } catch (error: any) {
    console.log('Staff update error:', error);
    return c.json({ error: "Xodimni yangilashda xatolik" }, 500);
  }
});

// Staff delete (soft)
app.delete("/make-server-27d0d16c/staff/:id", async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ error: branchAuth.error }, 403);
    }

    const staffId = String(c.req.param('id') || '').trim();
    if (!staffId) {
      return c.json({ error: 'staffId kerak' }, 400);
    }

    const existing = await kv.get(buildStaffKey(staffId));
    if (!existing || existing.deleted || existing.branchId !== branchAuth.branchId) {
      return c.json({ error: 'Xodim topilmadi' }, 404);
    }

    const now = new Date().toISOString();
    await kv.set(buildStaffKey(staffId), {
      ...existing,
      deleted: true,
      status: 'inactive',
      updatedAt: now,
    });

    return c.json({ success: true, message: "Xodim o'chirildi" });
  } catch (error: any) {
    console.log('Staff delete error:', error);
    return c.json({ error: "Xodimni o'chirishda xatolik" }, 500);
  }
});

// Staff login
app.post("/make-server-27d0d16c/staff/login", async (c) => {
  try {
    const body = await c.req.json();
    const login = String(body.login || '').trim();
    const password = String(body.password || '').trim();
    const requestedBranchId = body.branchId ? String(body.branchId).trim() : '';

    if (!login || !password) {
      return c.json({ error: 'Login va parol majburiy' }, 400);
    }

    let allStaff = await kv.getByPrefix('staff:');
    allStaff = allStaff.filter((s: any) => s && !s.deleted && s.login === login && s.password === password);

    if (!allStaff.length) {
      return c.json({ error: "Login yoki parol noto'g'ri" }, 401);
    }

    // If multiple records exist with same login/pass, take the newest active one
    allStaff.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const staff = allStaff[0];

    const role = staff.role as StaffRole;

    // Accountant/Bogalter: allow selecting a branch at login
    if (role === 'accountant') {
      const branches = await listAllBranches();
      const branchOptions = branches.map((b: any) => ({ id: b.id, name: b.branchName || b.name }));

      if (!requestedBranchId) {
        return c.json({
          success: true,
          role,
          needsBranchSelect: true,
          branchOptions: branchOptions,
          message: 'Filialni tanlang',
        });
      }

      const branchExists = branches.some((b: any) => b.id === requestedBranchId);
      if (!branchExists) {
        return c.json({ error: 'Filial topilmadi' }, 404);
      }

      const token = `accountant-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      await kv.set(buildAccountantSessionKey(token), {
        branchId: requestedBranchId,
        staffId: staff.id,
        createdAt: new Date().toISOString(),
        expiresAt,
      });

      const branchRecord = await kv.get(`branch:${requestedBranchId}`);
      return c.json({
        success: true,
        token,
        staff: {
          id: staff.id,
          role,
          firstName: staff.firstName,
          lastName: staff.lastName,
          phone: staff.phone,
        },
        branch: sanitizeBranchSessionPayload(branchRecord),
        message: 'Bogalter kirildi',
      });
    }

    // Other staff roles: create branch session token automatically (role-based UI restriction on frontend)
    const branchId = staff.branchId;
    const branchRecord = await kv.get(`branch:${branchId}`);
    if (!branchRecord) {
      return c.json({ error: 'Filial topilmadi' }, 404);
    }

    const branchToken = `branch-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await kv.set(buildBranchSessionKey(branchToken), {
      branchId,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    return c.json({
      success: true,
      role,
      branch: sanitizeBranchSessionPayload(branchRecord),
      branchToken,
      staff: {
        id: staff.id,
        role,
        firstName: staff.firstName,
        lastName: staff.lastName,
        phone: staff.phone,
      },
    });
  } catch (error: any) {
    console.log('Staff login error:', error);
    return c.json({ error: 'Bogalter login xatoligi' }, 500);
  }
});

app.get("/make-server-27d0d16c/couriers", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    const status = c.req.query('status');
    const search = (c.req.query('search') || '').trim().toLowerCase();

    let couriers = await kv.getByPrefix('courier:');
    couriers = couriers
      .map(normalizeCourierRecord)
      .filter((courier: any) => !courier.deleted);

    if (branchId) {
      couriers = couriers.filter((courier: any) => courier.branchId === branchId);
    }

    if (status) {
      couriers = couriers.filter((courier: any) => courier.status === status);
    }

    if (search) {
      couriers = couriers.filter((courier: any) =>
        courier.name.toLowerCase().includes(search) ||
        courier.phone.toLowerCase().includes(search) ||
        courier.email.toLowerCase().includes(search) ||
        courier.vehicleNumber.toLowerCase().includes(search)
      );
    }

    couriers.sort((a: any, b: any) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

    return c.json({ success: true, couriers });
  } catch (error: any) {
    console.error('Get couriers error:', error);
    return c.json({ error: 'Kuryerlarni olishda xatolik' }, 500);
  }
});

app.get("/make-server-27d0d16c/couriers/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const courier = await kv.get(buildCourierKey(id));

    if (!courier || courier.deleted) {
      return c.json({ error: 'Kuryer topilmadi' }, 404);
    }

    return c.json({ success: true, courier: normalizeCourierRecord(courier) });
  } catch (error: any) {
    console.error('Get courier error:', error);
    return c.json({ error: 'Kuryerni olishda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/couriers", async (c) => {
  try {
    const body = await c.req.json();

    if (!body.branchId || !body.name || !body.phone || !body.login || !body.pin) {
      return c.json({ error: 'branchId, name, phone, login va pin majburiy' }, 400);
    }

    const allCouriers = await kv.getByPrefix('courier:');
    const loginExists = allCouriers.some((courier: any) =>
      courier.login === body.login && !courier.deleted
    );
    if (loginExists) {
      return c.json({ error: 'Bu login band, boshqa login tanlang' }, 400);
    }

    const courierId = `courier_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const courier = normalizeCourierRecord({
      id: courierId,
      branchId: body.branchId,
      name: body.name,
      phone: body.phone,
      email: body.email,
      login: body.login,
      pin: String(body.pin),
      vehicleType: body.vehicleType,
      vehicleNumber: body.vehicleNumber,
      status: body.status || 'active',
      isAvailable: body.isAvailable !== false,
      serviceRadiusKm: Number(body.serviceRadiusKm || 5),
      serviceZoneIds: Array.isArray(body.serviceZoneIds) ? body.serviceZoneIds : [],
      serviceZoneNames: Array.isArray(body.serviceZoneNames) ? body.serviceZoneNames : [],
      serviceIps: Array.isArray(body.serviceIps) ? body.serviceIps : [],
      serviceZoneId: String(body.serviceZoneId || '').trim(),
      serviceZoneName: String(body.serviceZoneName || '').trim(),
      serviceIp: String(body.serviceIp || '').trim(),
      activeOrderId: null,
      activeOrderIds: [],
      rating: 0,
      totalDeliveries: 0,
      completedDeliveries: 0,
      cancelledDeliveries: 0,
      averageDeliveryTime: 0,
      totalEarnings: 0,
      balance: 0,
      lastDeliveryEarning: 0,
      currentLocation: body.currentLocation || null,
      workingHours: body.workingHours,
      documents: body.documents,
      joinedAt: now,
      lastActive: now,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    });

    await kv.set(buildCourierKey(courierId), courier);

    return c.json({ success: true, courier });
  } catch (error: any) {
    console.error('Create courier error:', error);
    return c.json({ error: 'Kuryerni qo\'shishda xatolik' }, 500);
  }
});

app.put("/make-server-27d0d16c/couriers/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const existingCourier = await kv.get(buildCourierKey(id));

    if (!existingCourier || existingCourier.deleted) {
      return c.json({ error: 'Kuryer topilmadi' }, 404);
    }

    const body = await c.req.json();
    if (body.login && body.login !== existingCourier.login) {
      const allCouriers = await kv.getByPrefix('courier:');
      const loginExists = allCouriers.some((courier: any) =>
        courier.login === body.login && courier.id !== id && !courier.deleted
      );

      if (loginExists) {
        return c.json({ error: 'Bu login band, boshqa login tanlang' }, 400);
      }
    }

    const updatedCourier = normalizeCourierRecord({
      ...existingCourier,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
      lastActive: body.status === 'active' || body.status === 'busy'
        ? new Date().toISOString()
        : existingCourier.lastActive,
    });

    await kv.set(buildCourierKey(id), updatedCourier);

    return c.json({ success: true, courier: updatedCourier });
  } catch (error: any) {
    console.error('Update courier error:', error);
    return c.json({ error: 'Kuryerni yangilashda xatolik' }, 500);
  }
});

app.delete("/make-server-27d0d16c/couriers/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const branchId = c.req.query('branchId');
    const existingCourier = await kv.get(buildCourierKey(id));

    if (!existingCourier || existingCourier.deleted) {
      return c.json({ error: 'Kuryer topilmadi' }, 404);
    }

    if (branchId && existingCourier.branchId && existingCourier.branchId !== branchId) {
      return c.json({ error: 'Bu kuryerni o\'chirishga ruxsat yo\'q' }, 403);
    }

    await kv.set(buildCourierKey(id), {
      ...existingCourier,
      deleted: true,
      status: 'inactive',
      updatedAt: new Date().toISOString(),
    });

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete courier error:', error);
    return c.json({ error: 'Kuryerni o\'chirishda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/courier/login", async (c) => {
  try {
    const body = await parseOptionalJsonBody(c);
    const login = String(body?.login || '').trim();
    const pin = String(body?.pin || '').trim();
    if (!login || !pin) {
      return c.json({ error: 'Login va PIN majburiy' }, 400);
    }

    const allCouriers = await kv.getByPrefix('courier:');
    const courier = allCouriers
      .map(normalizeCourierRecord)
      .find((item: any) => item.login === login && item.pin === String(pin) && !item.deleted);

    if (!courier) {
      return c.json({ error: 'Login yoki PIN noto‘g‘ri' }, 401);
    }

    const branch = courier.branchId ? await kv.get(`branch:${courier.branchId}`) : null;
    const token = `courier-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    await kv.set(buildCourierSessionKey(token), {
      courierId: courier.id,
      branchId: courier.branchId,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000),
    });

    return c.json({
      success: true,
      session: {
        token,
        courierId: courier.id,
        branchId: courier.branchId,
        name: courier.name,
        branchName: branch?.branchName || branch?.name || '',
      },
    });
  } catch (error: any) {
    console.error('Courier login error:', error);
    return c.json({ error: 'Kuryer loginida xatolik' }, 500);
  }
});

app.get("/make-server-27d0d16c/courier/me", async (c) => {
  try {
    const auth = await validateCourierSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const branch = auth.courier.branchId ? await kv.get(`branch:${auth.courier.branchId}`) : null;
    const assignedBags = await Promise.all(
      (await getActiveBagAssignmentsForCourier(auth.courier.id)).map(async (assignment: any) => {
        const bag = await courierBagDb.getBagById(assignment.bagId);
        return bag ? buildCourierBagPayload(bag) : null;
      })
    );
    const bags = assignedBags.filter(Boolean);
    const bagSlots = await buildCourierBagSlotsPayload(auth.courier.id);
    return c.json({
      success: true,
      courier: {
        ...auth.courier,
        pin: undefined,
        branchName: branch?.branchName || branch?.name || '',
        bags,
        emptyBags: bags.filter((bag: any) => bag.status === 'assigned_empty'),
        occupiedBags: bags.filter((bag: any) => bag.status === 'occupied'),
        bagSlots,
      },
    });
  } catch (error: any) {
    console.error('Courier me error:', error);
    return c.json({ error: 'Kuryer ma’lumotini olishda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/courier/location", async (c) => {
  try {
    const auth = await validateCourierSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const body = await parseOptionalJsonBody(c);
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    const address = String(body?.address || '').trim();
    if (!latitude || !longitude) {
      return c.json({ error: 'latitude va longitude majburiy' }, 400);
    }

    const updatedCourier = normalizeCourierRecord({
      ...auth.courier,
      currentLocation: {
        latitude,
        longitude,
        address: address || auth.courier.currentLocation?.address || '',
      },
      lastActive: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status:
        (Array.isArray(auth.courier.activeOrderIds) && auth.courier.activeOrderIds.length > 0) ||
        auth.courier.activeOrderId
          ? 'busy'
          : auth.courier.status === 'offline'
            ? 'offline'
            : 'active',
    });

    await kv.set(buildCourierKey(auth.courier.id), updatedCourier);
    return c.json({ success: true, courier: updatedCourier });
  } catch (error: any) {
    console.error('Courier location error:', error);
    return c.json({ error: 'Lokatsiyani yangilashda xatolik' }, 500);
  }
});

app.get("/make-server-27d0d16c/courier/orders/available", async (c) => {
  try {
    const auth = await validateCourierSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const courier = auth.courier;
    const debugMode = String(c.req.query('debug') || '').trim() === '1';
    const debugCounts: Record<string, number> = {};
    const debugSamples: any[] = [];
    const bump = (reason: string, sample?: any) => {
      debugCounts[reason] = (debugCounts[reason] || 0) + 1;
      if (sample && debugSamples.length < 60) {
        debugSamples.push({ reason, ...sample });
      }
    };

    if (courier.isAvailable === false || courier.status === 'offline') {
      if (debugMode) {
        return c.json({
          success: true,
          orders: [],
          debug: {
            blockedByCourierState: true,
            courier: {
              id: courier.id,
              branchId: courier.branchId,
              status: courier.status,
              activeOrderId: courier.activeOrderId || null,
              activeOrderIds: Array.isArray(courier.activeOrderIds) ? courier.activeOrderIds : [],
              isAvailable: courier.isAvailable,
            },
          },
        });
      }
      return c.json({ success: true, orders: [] });
    }

    const rawOrders = (await kv.getByPrefix('order:')).filter((order: any) => !order.deleted);
    const normalizeBranchId = (raw: unknown) => String(raw || '').trim().replace(/^branch:/, '');
    const branchCache = new Map<string, any>();
    const maxRadius = Number(courier.serviceRadiusKm || 5);

    const visibleOrders: any[] = [];
    for (const order of rawOrders) {
      const branchId = order.branchId || await inferOrderBranchId(order);
      const orderBranchId = normalizeBranchId(branchId);
      const courierBranchId = normalizeBranchId(courier.branchId);
      if (!orderBranchId || orderBranchId !== courierBranchId) {
        if (debugMode) {
          bump('branch_mismatch', {
            id: order?.id || order?.orderId || order?.orderNumber || null,
            orderType: order?.orderType || null,
            branchId: order?.branchId || null,
            inferredBranchId: branchId || null,
            restaurantId: order?.restaurantId || order?.restaurant?.id || null,
            shopId: order?.shopId || order?.shop?.id || null,
            items0: Array.isArray(order?.items) ? order.items?.[0] : null,
            orderBranchId,
            courierBranchId,
          });
        }
        continue;
      }
      const orderType = String(order.orderType || '').toLowerCase().trim();
      if (!isCourierMerchantPickupEligibleStatus(orderType, order.status)) {
        if (debugMode) bump('status_not_eligible', { id: order.id, status: order.status });
        continue;
      }
      const isRestaurantFlow =
        String(order.orderType || '').toLowerCase().trim() === 'food' ||
        String(order.orderType || '').toLowerCase().trim() === 'restaurant';

      const pm = String(order.paymentMethod || '').toLowerCase().trim();
      const ps = String(order.paymentStatus || '').toLowerCase().trim();
      const needsVerification =
        Boolean(order.paymentRequiresVerification) ||
        pm === 'qr' ||
        pm === 'qrcode' ||
        pm.includes('qr');
      // Do‘kon/taom: asosan to‘langan; market/ijara tayyor bo‘lgach naqd (pending) ham kuryerga chiqadi.
      if (!isPaidLikeStatus(ps) && !isCourierPaymentOkForReadyMarketRental(order)) {
        if (debugMode) bump('not_paid', { id: order.id, paymentStatus: ps, paymentMethod: pm });
        continue;
      }
      const courierZoneIds = Array.isArray(courier.serviceZoneIds) ? courier.serviceZoneIds : [];
      const courierZoneNames = Array.isArray((courier as any).serviceZoneNames) ? (courier as any).serviceZoneNames : [];
      const orderDeliveryZone = String(order.deliveryZone || '').trim();
      const hasZoneRestriction =
        courierZoneIds.length > 0 || Boolean(courier.serviceZoneId) || courierZoneNames.length > 0;
      const zoneMatch =
        !orderDeliveryZone
          ? true
          : courierZoneIds.length > 0
            ? courierZoneIds.includes(orderDeliveryZone)
            : String(courier.serviceZoneId || '').trim() === orderDeliveryZone;
      const courierIps = Array.isArray(courier.serviceIps)
        ? courier.serviceIps.map((ip: any) => normalizeZoneIpToken(ip)).filter(Boolean)
        : [];
      const zoneRecordForIp =
        !order.zoneIp && order.deliveryZone
          ? await kv.get(`delivery-zone:${order.deliveryZone}`)
          : null;
      const orderIpToken = normalizeZoneIpToken(order.zoneIp || zoneRecordForIp?.zoneIp);
      const hasIpRestriction = courierIps.length > 0 || Boolean(courier.serviceIp);
      const ipMatch =
        !orderIpToken
          ? true
          : courierIps.length > 0
            ? courierIps.includes(orderIpToken)
            : orderIpToken === normalizeZoneIpToken(courier.serviceIp);

      // If both restrictions exist, allow order when at least one matches.
      if (hasZoneRestriction && hasIpRestriction) {
        if (!zoneMatch && !ipMatch) {
          if (debugMode) bump('zone_ip_no_match', { id: order.id, deliveryZone: orderDeliveryZone, orderIpToken });
          continue;
        }
      } else if (hasZoneRestriction) {
        if (!zoneMatch) {
          if (debugMode) bump('zone_no_match', { id: order.id, deliveryZone: orderDeliveryZone });
          continue;
        }
      } else if (hasIpRestriction) {
        if (!ipMatch) {
          if (debugMode) bump('ip_no_match', { id: order.id, orderIpToken });
          continue;
        }
      }
      if (
        order.assignedCourierId ||
        order.courierAcceptedAt ||
        order.status === 'delivering' ||
        order.status === 'delivered' ||
        order.status === 'awaiting_receipt' ||
        order.status === 'cancelled'
      ) {
        if (debugMode) bump('already_assigned_or_done', { id: order.id, status: order.status, assignedCourierId: order.assignedCourierId || null });
        continue;
      }

      const preparedBagId = String(order.preparedBagId || '').trim();
      if (preparedBagId && !isRestaurantFlow) {
        const pb = await courierBagDb.getBagById(preparedBagId);
        if (!pb || pb.deleted || pb.branchId !== branchId) {
          if (debugMode) bump('prepared_bag_mismatch', { id: order.id, preparedBagId });
          continue;
        }
        const nb = normalizeCourierBagRecord(pb);
        if (nb.status !== 'occupied') {
          if (debugMode) bump('prepared_bag_not_occupied', { id: order.id, preparedBagStatus: nb.status });
          continue;
        }
        if (!nb.currentOrderId || nb.currentOrderId !== order.id) {
          if (debugMode) bump('prepared_bag_order_mismatch', { id: order.id, bagOrderId: nb.currentOrderId || null });
          continue;
        }
      }

      const customerLocation = await resolveOrderCustomerLocation(order);
      let distanceKm: number | null = null;
      const cLat = Number(courier.currentLocation?.latitude);
      const cLng = Number(courier.currentLocation?.longitude);
      const oLat = customerLocation != null ? Number(customerLocation.lat) : NaN;
      const oLng = customerLocation != null ? Number(customerLocation.lng) : NaN;
      const canCalculateDistance =
        Number.isFinite(cLat) &&
        Number.isFinite(cLng) &&
        Number.isFinite(oLat) &&
        Number.isFinite(oLng);

      if (canCalculateDistance) {
        distanceKm = calculateCourierDistance(cLat, cLng, oLat, oLng);

        // If courier has explicit zone/IP restrictions, those rules are authoritative.
        // Radius filter applies only when no zone/IP restriction configured.
        if (!hasZoneRestriction && !hasIpRestriction && distanceKm > maxRadius) {
          if (debugMode) bump('radius_too_far', { id: order.id, distanceKm, maxRadius });
          continue;
        }
      }

      let branch = null;
      if (branchId) {
        if (branchCache.has(orderBranchId)) {
          branch = branchCache.get(orderBranchId);
        } else {
          branch = await kv.get(`branch:${orderBranchId}`);
          branchCache.set(orderBranchId, branch);
        }
      }

      visibleOrders.push({
        ...(await buildCourierVisibleOrder({
          ...order,
          branchId: orderBranchId,
        }, {
          branch,
          customerLocation,
        })),
        distanceKm,
      });

      if (visibleOrders.length >= 50) {
        break;
      }
    }

    visibleOrders.sort((a, b) => {
      const da = a.distanceKm;
      const db = b.distanceKm;
      const na = da == null || !Number.isFinite(da) ? 1e9 : da;
      const nb = db == null || !Number.isFinite(db) ? 1e9 : db;
      return na - nb || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    if (debugMode) {
      return c.json({
        success: true,
        orders: visibleOrders,
        debug: {
          totalOrders: rawOrders.length,
          visible: visibleOrders.length,
          dropped: debugCounts,
          samples: debugSamples,
          courier: {
            id: courier.id,
            branchId: courier.branchId,
            status: courier.status,
            activeOrderId: courier.activeOrderId || null,
            activeOrderIds: Array.isArray(courier.activeOrderIds) ? courier.activeOrderIds : [],
            isAvailable: courier.isAvailable,
            serviceZoneIds: Array.isArray(courier.serviceZoneIds) ? courier.serviceZoneIds : [],
            serviceZoneNames: Array.isArray((courier as any).serviceZoneNames) ? (courier as any).serviceZoneNames : [],
            serviceIps: Array.isArray(courier.serviceIps) ? courier.serviceIps : [],
            serviceZoneId: courier.serviceZoneId || '',
            serviceIp: courier.serviceIp || '',
          },
        },
      });
    }
    return c.json({ success: true, orders: visibleOrders });
  } catch (error: any) {
    console.error('Courier available orders error:', error);
    return c.json({ error: 'Yaqin buyurtmalarni olishda xatolik' }, 500);
  }
});

app.get("/make-server-27d0d16c/courier/orders/active", async (c) => {
  try {
    const auth = await validateCourierSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const allOrders = (await kv.getByPrefix('order:')).filter((item: any) => !item.deleted);
    const activeRows = allOrders.filter((item: any) => {
      if (item.assignedCourierId !== auth.courier.id) return false;
      const s = String(item.status || '').toLowerCase().trim();
      return s !== 'delivered' && s !== 'cancelled' && s !== 'awaiting_receipt';
    });

    activeRows.sort(
      (a: any, b: any) =>
        new Date(a.courierAcceptedAt || a.createdAt || 0).getTime() -
        new Date(b.courierAcceptedAt || b.createdAt || 0).getTime(),
    );

    const orders = await Promise.all(activeRows.map((o: any) => buildCourierVisibleOrder(o)));

    return c.json({
      success: true,
      orders,
      order: orders[0] || null,
    });
  } catch (error: any) {
    console.error('Courier active order error:', error);
    return c.json({ error: 'Aktiv buyurtmani olishda xatolik' }, 500);
  }
});

app.get("/make-server-27d0d16c/courier/orders/history", async (c) => {
  try {
    const auth = await validateCourierSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') || 100)));
    const allOrders = (await kv.getByPrefix('order:')).filter((item: any) => !item.deleted);
    const delivered = allOrders
      .filter((order: any) => {
        if (order.assignedCourierId !== auth.courier.id) return false;
        const s = String(order.status || '').toLowerCase().trim();
        return s === 'delivered' || s === 'awaiting_receipt' || s === 'cancelled' || s === 'canceled';
      })
      .sort((a: any, b: any) => new Date(b.deliveredAt || b.updatedAt || 0).getTime() - new Date(a.deliveredAt || a.updatedAt || 0).getTime())
      .slice(0, limit);

    const orders = await Promise.all(delivered.map((order: any) => buildCourierVisibleOrder(order)));
    return c.json({ success: true, orders });
  } catch (error: any) {
    console.error('Courier history error:', error);
    return c.json({ error: 'Buyurtmalar tarixini olishda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/courier/orders/:id/accept", async (c) => {
  try {
    const auth = await validateCourierSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const orderId = c.req.param('id');
    const orderRecord = await getOrderRecord(orderId);
    if (!orderRecord) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }

    const body = await parseOptionalJsonBody(c);

    const normalizeBranchId = (raw: unknown) => String(raw || '').trim().replace(/^branch:/, '');
    const branchId = orderRecord.order.branchId || await inferOrderBranchId(orderRecord.order);
    const orderBranchId = normalizeBranchId(branchId);
    const courierBranchId = normalizeBranchId(auth.courier.branchId);
    const isRestaurantFlow =
      String(orderRecord.order.orderType || '').toLowerCase().trim() === 'food' ||
      String(orderRecord.order.orderType || '').toLowerCase().trim() === 'restaurant';
    if (!orderBranchId || orderBranchId !== courierBranchId) {
      return c.json({ error: 'Bu buyurtma sizga tegishli emas' }, 403);
    }
    const courierZoneIds = Array.isArray(auth.courier.serviceZoneIds) ? auth.courier.serviceZoneIds : [];
    const orderDeliveryZone = String(orderRecord.order.deliveryZone || '').trim();
    const hasZoneRestriction = courierZoneIds.length > 0 || Boolean(auth.courier.serviceZoneId);
    const zoneMatch =
      !orderDeliveryZone
        ? true
        : courierZoneIds.length > 0
          ? courierZoneIds.includes(orderDeliveryZone)
          : String(auth.courier.serviceZoneId || '').trim() === orderDeliveryZone;
    const courierIps = Array.isArray(auth.courier.serviceIps)
      ? auth.courier.serviceIps.map((ip: any) => normalizeZoneIpToken(ip)).filter(Boolean)
      : [];
    const orderZoneRecordForIp =
      !orderRecord.order.zoneIp && orderRecord.order.deliveryZone
        ? await kv.get(`delivery-zone:${orderRecord.order.deliveryZone}`)
        : null;
    const orderIpToken = normalizeZoneIpToken(orderRecord.order.zoneIp || orderZoneRecordForIp?.zoneIp);
    const hasIpRestriction = courierIps.length > 0 || Boolean(auth.courier.serviceIp);
    const ipMatch =
      !orderIpToken
        ? true
        : courierIps.length > 0
          ? courierIps.includes(orderIpToken)
          : orderIpToken === normalizeZoneIpToken(auth.courier.serviceIp);

    if (hasZoneRestriction && hasIpRestriction) {
      if (!zoneMatch && !ipMatch) {
        return c.json({ error: 'Bu buyurtma sizning zona/IP birikmangizga tegishli emas' }, 403);
      }
    } else if (hasZoneRestriction) {
      if (!zoneMatch) {
        return c.json({ error: 'Bu buyurtma sizning zona birikmangizga tegishli emas' }, 403);
      }
    } else if (hasIpRestriction) {
      if (!ipMatch) {
        return c.json({ error: 'Bu buyurtma sizning IP zonangizga tegishli emas' }, 403);
      }
    }

    if (orderRecord.order.assignedCourierId || orderRecord.order.courierAcceptedAt) {
      return c.json({ error: 'Buyurtmani boshqa kuryer oldi' }, 409);
    }

    const orderType = String(orderRecord.order.orderType || '').toLowerCase().trim();
    const orderStatus = String(orderRecord.order.status || '').toLowerCase().trim();
    if (!isCourierMerchantPickupEligibleStatus(orderType, orderStatus)) {
      return c.json({ error: 'Bu holatdagi buyurtma kuryer uchun ochilmagan yoki tayyor emas' }, 403);
    }

    const ps = String(orderRecord.order.paymentStatus || '').toLowerCase().trim();
    if (!isPaidLikeStatus(ps) && !isCourierPaymentOkForReadyMarketRental(orderRecord.order)) {
      return c.json({ error: 'To\'lov hali tasdiqlanmadi' }, 403);
    }

    const preparedBagId = String(orderRecord.order.preparedBagId || '').trim();

    if (!preparedBagId) {
      const sumFree = await sumCourierBagFreeSlots(auth.courier.id);
      let branchBonus = 0;
      const requestedEarly = String(body?.bagId || '').trim();
      if (requestedEarly) {
        const rb = await courierBagDb.getBagById(requestedEarly);
        if (rb && !rb.deleted) {
          const nb = normalizeCourierBagRecord(rb);
          if (nb.status === 'available_in_branch') branchBonus = 1;
        }
      }
      if (sumFree + branchBonus < 1) {
        return c.json(
          {
            error:
              'So‘mkalaringiz to‘liq band. Yangi buyurtma olish uchun kamida bitta bo‘sh slot kerak (yoki filialdan yangi so‘mka oling).',
          },
          403,
        );
      }
    }

    let selectedBag = null as any;
    const now = new Date().toISOString();
    if (preparedBagId && !isRestaurantFlow) {
      const preparedBag = await courierBagDb.getBagById(preparedBagId);
      if (!preparedBag || preparedBag.deleted) {
        return c.json({ error: 'Tayyorlangan so‘mka topilmadi' }, 400);
      }
      const normalizedPrepared = normalizeCourierBagRecord(preparedBag);
      if (normalizeBranchId(normalizedPrepared.branchId) !== orderBranchId) {
        return c.json({ error: 'Tayyorlangan so‘mka bu filialga tegishli emas' }, 400);
      }
      if (normalizedPrepared.status !== 'occupied' || normalizedPrepared.currentOrderId !== orderId) {
        return c.json({
          error: 'Buyurtma hali filial so‘mkasiga qadoqlanmagan yoki so‘mka holati noto‘g‘ri',
        }, 400);
      }
      selectedBag = normalizedPrepared;
    } else {
      const requestedBagId = String(body.bagId || '').trim();
      if (requestedBagId) {
        const requested = await courierBagDb.getBagById(requestedBagId);
        if (!requested || requested.deleted) {
          return c.json({ error: 'Tanlangan so‘mka topilmadi' }, 400);
        }
        const normalizedRequested = normalizeCourierBagRecord(requested);
        if (normalizeBranchId(normalizedRequested.branchId) !== orderBranchId) {
          return c.json({ error: 'Tanlangan so‘mka bu filialga tegishli emas' }, 400);
        }
        const isMine = normalizedRequested.currentCourierId === auth.courier.id;
        const freeHere = await bagFreeSlotsForBagId(requested.id);
        const okBranch =
          normalizedRequested.status === 'available_in_branch' && !normalizedRequested.currentOrderId;
        const okMyEmpty = normalizedRequested.status === 'assigned_empty' && isMine && freeHere >= 1;
        const okMyPartial = normalizedRequested.status === 'occupied' && isMine && freeHere >= 1;
        if (!okBranch && !okMyEmpty && !okMyPartial) {
          return c.json(
            { error: 'Tanlangan so‘mka bo‘sh emas yoki sizga tegishli emas' },
            400,
          );
        }
        selectedBag = normalizedRequested;
      }
    }

    const updatedOrder = {
      ...orderRecord.order,
      branchId,
      assignedCourierId: auth.courier.id,
      assignedCourierName: auth.courier.name,
      assignedCourierPhone: auth.courier.phone,
      assignedBagId: selectedBag?.id || null,
      assignedBagNumber: selectedBag?.bagNumber || null,
      assignedBagCode: selectedBag?.bagCode || null,
      courierAcceptedAt: new Date().toISOString(),
      courierWorkflowStatus: 'accepted',
      updatedAt: new Date().toISOString(),
      statusHistory: [
        ...(Array.isArray(orderRecord.order.statusHistory) ? orderRecord.order.statusHistory : []),
        { status: orderRecord.order.status, timestamp: new Date().toISOString(), note: `${auth.courier.name} buyurtmani qabul qildi` },
      ],
    };

    const linkId = `bag_order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await kv.set(orderRecord.key, updatedOrder);

    const activeIdsAfterAccept = await listUndeliveredOrderIdsForCourier(auth.courier.id);
    const updatedCourier = normalizeCourierRecord({
      ...auth.courier,
      status: activeIdsAfterAccept.length ? 'busy' : 'active',
      activeOrderIds: activeIdsAfterAccept,
      activeOrderId: activeIdsAfterAccept[0] ?? null,
      isAvailable: true,
      updatedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    });

    await kv.set(buildCourierKey(auth.courier.id), updatedCourier);
    if (selectedBag) {
      const updatedBag = normalizeCourierBagRecord({
        ...selectedBag,
        status: 'occupied',
        currentCourierId: auth.courier.id,
        currentOrderId: orderId,
        updatedAt: now,
      });

      await courierBagDb.updateBag(updatedBag);
      await courierBagDb.insertOrderLink({
        id: linkId,
        bagId: selectedBag.id,
        orderId,
        courierId: auth.courier.id,
        attachedAt: now,
        detachedAt: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await logCourierBagHistory({
        bagId: selectedBag.id,
        branchId: branchId,
        courierId: auth.courier.id,
        orderId,
        actorType: 'courier',
        actorId: auth.courier.id,
        fromStatus: selectedBag.status,
        toStatus: 'occupied',
        note: `${orderRecord.order.orderNumber || orderId} buyurtmasiga biriktirildi`,
      });
    }

    return c.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Courier accept error:', error);
    return c.json({ error: 'Buyurtmani qabul qilishda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/courier/orders/:id/pickup", async (c) => {
  try {
    const auth = await validateCourierSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const orderId = c.req.param('id');
    const orderRecord = await getOrderRecord(orderId);
    if (!orderRecord || orderRecord.order.assignedCourierId !== auth.courier.id) {
      return c.json({ error: 'Buyurtma topilmadi yoki sizga biriktirilmagan' }, 404);
    }

    // Block pickup until cashier confirms payment for merchant orders (non-market/non-rental)
    const pm = String(orderRecord.order.paymentMethod || '').toLowerCase().trim();
    const ps = String(orderRecord.order.paymentStatus || '').toLowerCase().trim();
    const orderType = String(orderRecord.order.orderType || '').toLowerCase().trim();
    const baseRequiresVerification =
      Boolean(orderRecord.order.paymentRequiresVerification) || pm === 'qr' || pm === 'qrcode';

    let merchantQrExists = false;
    try {
      if (orderType === 'shop' && orderRecord.order.shopId) {
        const shopId = String(orderRecord.order.shopId);
        const shop = await kv.get(shopId.startsWith('shop:') ? shopId : `shop:${shopId}`);
        merchantQrExists = Boolean(shop?.paymentQrImage);
      }
      if ((orderType === 'food' || orderType === 'restaurant') && orderRecord.order.restaurantId) {
        const restaurantId = String(orderRecord.order.restaurantId);
        const restaurant = await kv.get(restaurantId.startsWith('restaurant:') ? restaurantId : `restaurant:${restaurantId}`);
        merchantQrExists = Boolean(restaurant?.paymentQrImage);
      }
      if (!merchantQrExists && orderType !== 'market' && orderType !== 'rental') {
        const branchId = String(orderRecord.order.branchId || '').trim();
        if (branchId) {
          const branch = await kv.get(branchId.startsWith('branch:') ? branchId : `branch:${branchId}`);
          merchantQrExists = Boolean(branch?.paymentQrImage);
        }
      }
    } catch {
      // ignore
    }

    const requiresVerification =
      baseRequiresVerification || Boolean(orderRecord.order.merchantPaymentQrUrl) || merchantQrExists;

    if (requiresVerification && ps !== 'paid' && ps !== 'completed' && ps !== 'success') {
      return c.json({ error: 'To‘lov tasdiqlanmagan. Avval kassa chekni yuborib tasdiqlasin.' }, 409);
    }

    const updatedOrder = {
      ...orderRecord.order,
      status: 'delivering',
      courierWorkflowStatus: 'picked_up',
      courierPickedUpAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        ...(Array.isArray(orderRecord.order.statusHistory) ? orderRecord.order.statusHistory : []),
        { status: 'delivering', timestamp: new Date().toISOString(), note: 'Kuryer buyurtmani olib yo‘lga chiqdi' },
      ],
    };

    await kv.set(orderRecord.key, updatedOrder);
    const pickupRackId = String(orderRecord.order.pickupRackId || '').trim();
    const pickupRackBranchId = String(orderRecord.order.branchId || '').trim();
    let freedRack = false;

    if (pickupRackId && pickupRackBranchId) {
      const rackKey = `pickup_rack:${pickupRackBranchId}:${pickupRackId}`;
      const rack = await kv.get(rackKey);
      if (rack) {
        await kv.set(rackKey, {
          ...rack,
          status: 'available',
          currentOrderId: null,
          updatedAt: new Date().toISOString(),
        });
        freedRack = true;
      }
    }

    // Fallback: if order doesn't have pickupRackId (or stale data), free rack by currentOrderId.
    if (!freedRack && pickupRackBranchId) {
      const allRacks = await kv.getByPrefix(`pickup_rack:${pickupRackBranchId}:`);
      const matchedRack = allRacks.find((rack: any) =>
        rack &&
        !rack.deleted &&
        String(rack.currentOrderId || '').trim() === orderId
      );
      if (matchedRack?.id) {
        const rackKey = `pickup_rack:${pickupRackBranchId}:${matchedRack.id}`;
        await kv.set(rackKey, {
          ...matchedRack,
          status: 'available',
          currentOrderId: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return c.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Courier pickup error:', error);
    return c.json({ error: 'Pickup holatini yangilashda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/courier/orders/:id/arrived", async (c) => {
  try {
    const auth = await validateCourierSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const orderId = decodeURIComponent(String(c.req.param('id') || '').trim());
    const orderRecord = await getOrderRecord(orderId);
    if (!orderRecord || orderRecord.order.assignedCourierId !== auth.courier.id) {
      return c.json({ error: 'Buyurtma topilmadi yoki sizga biriktirilmagan' }, 404);
    }

    const customerLocation = await resolveOrderCustomerLocation(orderRecord.order);
    if (!customerLocation?.lat || !customerLocation?.lng) {
      return c.json({ error: 'Mijoz lokatsiyasi topilmadi' }, 400);
    }

    const rawBody = await parseOptionalJsonBody(c);
    const liveLat = Number(rawBody?.latitude ?? rawBody?.lat ?? 0);
    const liveLng = Number(rawBody?.longitude ?? rawBody?.lng ?? 0);
    const useLiveGps =
      Number.isFinite(liveLat) &&
      Number.isFinite(liveLng) &&
      Math.abs(liveLat) <= 90 &&
      Math.abs(liveLng) <= 180 &&
      !(liveLat === 0 && liveLng === 0);

    let courierLat: number;
    let courierLng: number;
    if (useLiveGps) {
      courierLat = liveLat;
      courierLng = liveLng;
    } else {
      courierLat = Number(auth.courier?.currentLocation?.latitude || 0);
      courierLng = Number(auth.courier?.currentLocation?.longitude || 0);
    }
    if (!courierLat || !courierLng) {
      return c.json({ error: 'Kuryer lokatsiyasi topilmadi, lokatsiyani yoqing' }, 400);
    }

    const distanceKm = calculateCourierDistance(
      courierLat,
      courierLng,
      Number(customerLocation.lat),
      Number(customerLocation.lng),
    );
    /** GPS shovqin va manzil aniqligi uchun (oldingi 0.35 km juda qattiq edi). */
    const arrivedDistanceThresholdKm = 1.25;
    if (distanceKm > arrivedDistanceThresholdKm) {
      return c.json({
        error: `Siz hali manzilga yetib kelmadingiz (${distanceKm.toFixed(2)} km, ruxsat: ${arrivedDistanceThresholdKm} km).`,
      }, 400);
    }

    const updatedOrder = {
      ...orderRecord.order,
      courierWorkflowStatus: 'arrived',
      courierArrivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        ...(Array.isArray(orderRecord.order.statusHistory) ? orderRecord.order.statusHistory : []),
        { status: orderRecord.order.status, timestamp: new Date().toISOString(), note: 'Kuryer mijoz manziliga yetib keldi' },
      ],
    };

    await kv.set(orderRecord.key, updatedOrder);
    return c.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Courier arrived error:', error);
    return c.json({ error: 'Yetib kelish holatini yangilashda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/courier/orders/:id/delivered", async (c) => {
  try {
    const auth = await validateCourierSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const orderId = c.req.param('id');
    const orderRecord = await getOrderRecord(orderId);
    if (!orderRecord || orderRecord.order.assignedCourierId !== auth.courier.id) {
      return c.json({ error: 'Buyurtma topilmadi yoki sizga biriktirilmagan' }, 404);
    }

    const deliveredAt = new Date().toISOString();
    const earningAmount = Number(orderRecord.order.deliveryPrice || 0);
    const completedDeliveries = Number(auth.courier.completedDeliveries || 0);
    const completionMinutes = orderRecord.order.courierAcceptedAt
      ? Math.max(
          1,
          Math.round(
            (new Date(deliveredAt).getTime() - new Date(orderRecord.order.courierAcceptedAt).getTime()) / 60000
          )
        )
      : auth.courier.averageDeliveryTime || 0;

    const pmRaw = String(orderRecord.order.paymentMethod || '').toLowerCase().trim();
    const isCashLike =
      pmRaw === 'cash' ||
      pmRaw.includes('naqd') ||
      pmRaw.includes('naqt') ||
      pmRaw.includes('cash');
    const finalTotalNum =
      Number(
        orderRecord.order.finalTotal ??
          orderRecord.order.totalAmount ??
          orderRecord.order.totalPrice ??
          orderRecord.order.total ??
          orderRecord.order.grandTotal ??
          0,
      ) || 0;
    const deliveryFeeNum =
      Number(
        orderRecord.order.deliveryPrice ??
          orderRecord.order.deliveryFee ??
          orderRecord.order.delivery_fee ??
          0,
      ) || 0;
    /** Naqd: kuryer yetkazish haqini o‘zi saqlaydi, qolgani kassaga topshiriladi. */
    const courierCashHandoffExpectedUzs = isCashLike ? Math.max(0, finalTotalNum - deliveryFeeNum) : 0;
    const courierCashHandoffStatus = isCashLike ? 'pending_cashier' : 'not_applicable';

    const updatedOrder = {
      ...orderRecord.order,
      /** Mijoz mahsulotni ko‘rib tasdiqlaguncha yakuniy holat — keyin `delivered`. */
      status: 'awaiting_receipt',
      courierWorkflowStatus: 'delivered',
      handedToCustomerAt: deliveredAt,
      courierCashHandoffExpectedUzs,
      courierCashHandoffStatus,
      courierCashHandedToCashierAt: isCashLike ? null : orderRecord.order.courierCashHandedToCashierAt ?? null,
      // Naqd: to‘lov mijoz buyurtmani tasdiqlaguncha pending (bekor qilsa — to‘lanmagan hisoblanadi).
      paymentStatus: isCashLike
        ? String(orderRecord.order.paymentStatus || '').toLowerCase().trim() === 'paid'
          ? 'paid'
          : 'pending'
        : orderRecord.order.paymentStatus,
      deliveredAt,
      updatedAt: deliveredAt,
      statusHistory: [
        ...(Array.isArray(orderRecord.order.statusHistory) ? orderRecord.order.statusHistory : []),
        {
          status: 'awaiting_receipt',
          timestamp: deliveredAt,
          note: 'Kuryer buyurtmani topshirdi — mijoz tekshiruvi kutilmoqda',
        },
      ],
    };

    const activeIdsAfterDeliver = await listUndeliveredOrderIdsForCourier(auth.courier.id);
    const updatedCourier = normalizeCourierRecord({
      ...auth.courier,
      status: activeIdsAfterDeliver.length ? 'busy' : 'active',
      isAvailable: true,
      activeOrderIds: activeIdsAfterDeliver,
      activeOrderId: activeIdsAfterDeliver[0] ?? null,
      totalDeliveries: Number(auth.courier.totalDeliveries || 0) + 1,
      completedDeliveries: completedDeliveries + 1,
      averageDeliveryTime: completedDeliveries > 0
        ? Math.round(((Number(auth.courier.averageDeliveryTime || 0) * completedDeliveries) + completionMinutes) / (completedDeliveries + 1))
        : completionMinutes,
      totalEarnings: Number(auth.courier.totalEarnings || 0) + earningAmount,
      balance: Number(auth.courier.balance || 0) + earningAmount,
      lastDeliveryEarning: earningAmount,
      updatedAt: deliveredAt,
      lastActive: deliveredAt,
    });

    await kv.set(orderRecord.key, updatedOrder);
    await kv.set(buildCourierKey(auth.courier.id), updatedCourier);

    // Sync Postgres marketplace status (courier delivers -> fulfilled; payment becomes "paid" when applicable)
    await syncRelationalOrderFromLegacy({
      legacyOrderId: orderId,
      kvStatus: String(updatedOrder.status || ''),
      kvPaymentStatus: String(updatedOrder.paymentStatus || 'pending'),
      paymentRequiresVerification:
        updatedOrder.paymentStatus === 'paid' ? false : Boolean(updatedOrder.paymentRequiresVerification),
    });

    await detachBagFromOrderInternal(orderId, {
      actorType: 'courier',
      actorId: auth.courier.id,
      note: 'Buyurtma yetkazilgach so‘mka bo‘shatildi',
    });

    const buyerId = String(updatedOrder.userId || updatedOrder.customerId || '').trim();
    if (buyerId) {
      void notifyUserExpoPush(
        buyerId,
        'Buyurtma yetkazildi',
        'Kuryer buyurtmani topshirdi. Mahsulotni tekshirib, profilda «Qabul qildim» ni bosing.',
        { type: 'order_awaiting_receipt', orderId: String(orderId) },
      );
    }

    return c.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Courier delivered error:', error);
    return c.json({ error: 'Buyurtmani yakunlashda xatolik' }, 500);
  }
});

app.get("/make-server-27d0d16c/courier-bags", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    const branchAuth = await validateBranchSession(c);
    const branchId = c.req.query('branchId');
    const status = c.req.query('status');
    const search = String(c.req.query('search') || '').trim().toLowerCase();

    if (!admin.success && !branchId) {
      return c.json({ error: 'branchId yoki admin ruxsati kerak' }, 403);
    }

    if (branchId && !admin.success) {
      if (!branchAuth.success || branchAuth.branchId !== branchId) {
        return c.json({ error: 'Filial sessiyasi (X-Branch-Token) kerak yoki noto‘g‘ri' }, 403);
      }
    }

    let bags = await listCourierBags();
    if (branchId) {
      bags = bags.filter((bag: any) => bag.branchId === branchId);
    }
    if (status) {
      bags = bags.filter((bag: any) => bag.status === status);
    }
    if (search) {
      bags = bags.filter((bag: any) =>
        bag.bagNumber.toLowerCase().includes(search) ||
        bag.bagCode.toLowerCase().includes(search) ||
        bag.qrCode.toLowerCase().includes(search)
      );
    }

    const payload = await Promise.all(bags.map(buildCourierBagPayload));
    payload.sort((a: any, b: any) => a.bagNumber.localeCompare(b.bagNumber, 'uz'));
    return c.json({ success: true, bags: payload });
  } catch (error: any) {
    console.error('Get courier bags error:', error);
    return c.json({ error: 'So‘mkalarni olishda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/courier-bags", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    const branchAuth = await validateBranchSession(c);
    if (!admin.success && !branchAuth.success) {
      return c.json({ error: 'Admin yoki filial sessiyasi (X-Branch-Token) kerak' }, 403);
    }

    const body = await c.req.json();
    const branchId = String(body.branchId || '').trim();
    const bagNumber = String(body.bagNumber || '').trim();
    if (!branchId || !bagNumber) {
      return c.json({ error: 'branchId va bagNumber majburiy' }, 400);
    }
    if (!admin.success && branchAuth.branchId !== branchId) {
      return c.json({ error: 'Bu filialga so‘mka qo‘shish ruxsati yo‘q' }, 403);
    }

    const branch = await kv.get(`branch:${branchId}`);
    if (!branch) {
      return c.json({ error: 'Filial topilmadi' }, 404);
    }

    const allBags = await listCourierBags();
    const duplicate = allBags.find((bag: any) => buildBagIdentifier(bag.branchId, bag.bagNumber) === buildBagIdentifier(branchId, bagNumber));
    if (duplicate) {
      return c.json({ error: 'Bu filialda shu so‘mka raqami band' }, 409);
    }

    const now = new Date().toISOString();
    const bagId = `bag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const bag = normalizeCourierBagRecord({
      id: bagId,
      branchId,
      bagNumber,
      bagCode: String(body.bagCode || '').trim() || buildBagCode(branchId, bagNumber),
      qrCode: String(body.qrCode || '').trim() || `QR-${buildBagCode(branchId, bagNumber)}`,
      bagType: body.bagType || 'standard',
      capacityLevel: 'single_order',
      status: body.status || 'available_in_branch',
      notes: body.notes || '',
      currentCourierId: null,
      currentOrderId: null,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    });

    await courierBagDb.insertBag(bag);
    await logCourierBagHistory({
      bagId: bag.id,
      branchId: bag.branchId,
      actorType: admin.success ? 'admin' : 'branch',
      actorId: admin.success ? admin.userId || null : branchAuth.branchId || null,
      fromStatus: null,
      toStatus: bag.status,
      note: admin.success ? 'So‘mka yaratildi' : 'So‘mka filial tomonidan yaratildi',
    });

    return c.json({ success: true, bag: await buildCourierBagPayload(bag) });
  } catch (error: any) {
    console.error('Create courier bag error:', error);
    return c.json({ error: 'So‘mka qo‘shishda xatolik' }, 500);
  }
});

app.put("/make-server-27d0d16c/courier-bags/:id", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    const branchAuth = await validateBranchSession(c);
    if (!admin.success && !branchAuth.success) {
      return c.json({ error: 'Admin yoki filial sessiyasi (X-Branch-Token) kerak' }, 403);
    }

    const bagId = c.req.param('id');
    const existingBag = await courierBagDb.getBagById(bagId);
    if (!existingBag || existingBag.deleted) {
      return c.json({ error: 'So‘mka topilmadi' }, 404);
    }
    const normalizedExistingBag = normalizeCourierBagRecord(existingBag);
    if (!admin.success && branchAuth.branchId !== normalizedExistingBag.branchId) {
      return c.json({ error: 'Bu so‘mkani tahrirlash ruxsati yo‘q' }, 403);
    }

    const body = await c.req.json();
    const nextBagNumber = String(body.bagNumber || normalizedExistingBag.bagNumber).trim();
    const nextBranchId = admin.success
      ? String(body.branchId || normalizedExistingBag.branchId).trim()
      : normalizedExistingBag.branchId;
    const nextStatus = String(body.status || normalizedExistingBag.status).trim();
    if (!COURIER_BAG_STATUSES.has(nextStatus)) {
      return c.json({ error: 'Noto‘g‘ri so‘mka holati' }, 400);
    }

    const allBags = await listCourierBags();
    const duplicate = allBags.find((bag: any) =>
      bag.id !== bagId &&
      buildBagIdentifier(bag.branchId, bag.bagNumber) === buildBagIdentifier(nextBranchId, nextBagNumber)
    );
    if (duplicate) {
      return c.json({ error: 'Bu filialda shu so‘mka raqami band' }, 409);
    }

    const updatedBag = normalizeCourierBagRecord({
      ...normalizedExistingBag,
      branchId: nextBranchId,
      bagNumber: nextBagNumber,
      bagCode: String(body.bagCode || normalizedExistingBag.bagCode).trim() || buildBagCode(nextBranchId, nextBagNumber),
      qrCode: String(body.qrCode || normalizedExistingBag.qrCode).trim(),
      bagType: body.bagType || normalizedExistingBag.bagType,
      status: nextStatus,
      notes: body.notes ?? normalizedExistingBag.notes,
      updatedAt: new Date().toISOString(),
    });

    await courierBagDb.updateBag(updatedBag);
    if (updatedBag.status !== normalizedExistingBag.status) {
      await logCourierBagHistory({
        bagId: bagId,
        branchId: updatedBag.branchId,
        courierId: updatedBag.currentCourierId,
        orderId: updatedBag.currentOrderId,
        actorType: admin.success ? 'admin' : 'branch',
        actorId: admin.success ? admin.userId || null : branchAuth.branchId || null,
        fromStatus: normalizedExistingBag.status,
        toStatus: updatedBag.status,
        note: admin.success ? 'So‘mka holati admin tomonidan yangilandi' : 'So‘mka holati filial tomonidan yangilandi',
      });
    }

    return c.json({ success: true, bag: await buildCourierBagPayload(updatedBag) });
  } catch (error: any) {
    console.error('Update courier bag error:', error);
    return c.json({ error: 'So‘mkani yangilashda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/courier-bags/:id/assign-courier", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    const branchAuth = await validateBranchSession(c);
    const bagId = c.req.param('id');
    const body = await c.req.json();
    const branchId = String(body.branchId || '').trim();
    const courierId = String(body.courierId || '').trim();
    if (!branchId || !courierId) {
      return c.json({ error: 'branchId va courierId majburiy' }, 400);
    }

    if (!admin.success && !branchAuth.success) {
      return c.json({ error: 'Admin yoki filial sessiyasi (X-Branch-Token) kerak' }, 403);
    }
    if (!admin.success && branchAuth.branchId !== branchId) {
      return c.json({ error: 'Filial sessiyasi ushbu filialga tegishli emas' }, 403);
    }

    const bag = await courierBagDb.getBagById(bagId);
    if (!bag || bag.deleted) {
      return c.json({ error: 'So‘mka topilmadi' }, 404);
    }

    const courier = await kv.get(buildCourierKey(courierId));
    if (!courier || courier.deleted) {
      return c.json({ error: 'Kuryer topilmadi' }, 404);
    }

    const normalizedBag = normalizeCourierBagRecord(bag);
    const normalizedCourier = normalizeCourierRecord(courier);
    if (normalizedBag.branchId !== branchId || normalizedCourier.branchId !== branchId) {
      return c.json({ error: 'So‘mka va kuryer bir xil filialga tegishli bo‘lishi kerak' }, 400);
    }
    if (['maintenance', 'lost', 'inactive', 'occupied'].includes(normalizedBag.status)) {
      return c.json({ error: 'Bu so‘mkani biriktirib bo‘lmaydi' }, 400);
    }

    const existingAssignment = await getActiveBagAssignmentForBag(bagId);
    if (existingAssignment) {
      return c.json({ error: 'So‘mka allaqachon kuryerga biriktirilgan' }, 409);
    }
    const courierAssignments = await getActiveBagAssignmentsForCourier(courierId);
    if (courierAssignments.length > 0) {
      return c.json({ error: 'Har bir kuryerga faqat bitta so‘mka biriktiriladi' }, 409);
    }

    const now = new Date().toISOString();
    const assignmentId = `bag_assign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const updatedBag = normalizeCourierBagRecord({
      ...normalizedBag,
      status: 'assigned_empty',
      currentCourierId: courierId,
      currentOrderId: null,
      updatedAt: now,
    });

    await courierBagDb.updateBag(updatedBag);
    await courierBagDb.insertAssignment({
      id: assignmentId,
      bagId,
      branchId,
      courierId,
      assignedAt: now,
      releasedAt: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await logCourierBagHistory({
      bagId,
      branchId,
      courierId,
      actorType: admin.success ? 'admin' : 'branch',
      actorId: admin.success ? admin.userId || null : branchAuth.branchId || null,
      fromStatus: normalizedBag.status,
      toStatus: updatedBag.status,
      note: `${normalizedCourier.name} ga biriktirildi`,
    });

    return c.json({ success: true, bag: await buildCourierBagPayload(updatedBag) });
  } catch (error: any) {
    console.error('Assign courier bag error:', error);
    return c.json({ error: 'So‘mkani kuryerga biriktirishda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/courier-bags/:id/release-courier", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    const branchAuth = await validateBranchSession(c);
    const bagId = c.req.param('id');
    const body = await parseOptionalJsonBody(c);
    const branchId = String(body.branchId || c.req.query('branchId') || '').trim();

    const bag = await courierBagDb.getBagById(bagId);
    if (!bag || bag.deleted) {
      return c.json({ error: 'So‘mka topilmadi' }, 404);
    }

    const normalizedBag = normalizeCourierBagRecord(bag);
    if (!admin.success && !branchAuth.success) {
      return c.json({ error: 'Admin yoki filial sessiyasi (X-Branch-Token) kerak' }, 403);
    }
    if (!admin.success && (!branchId || branchAuth.branchId !== branchId || normalizedBag.branchId !== branchId)) {
      return c.json({ error: 'Bu filial uchun ruxsat yo‘q' }, 403);
    }
    if (normalizedBag.currentOrderId) {
      return c.json({ error: 'Band so‘mkani qaytarib bo‘lmaydi' }, 409);
    }

    const activeAssignment = await getActiveBagAssignmentForBag(bagId);
    if (!activeAssignment) {
      return c.json({ error: 'So‘mka hech kimga biriktirilmagan' }, 400);
    }

    const now = new Date().toISOString();
    const updatedBag = normalizeCourierBagRecord({
      ...normalizedBag,
      status: 'available_in_branch',
      currentCourierId: null,
      currentOrderId: null,
      updatedAt: now,
    });

    await courierBagDb.updateBag(updatedBag);
    await courierBagDb.updateAssignment(activeAssignment.id, {
      isActive: false,
      releasedAt: now,
      updatedAt: now,
    });
    await logCourierBagHistory({
      bagId,
      branchId: updatedBag.branchId,
      courierId: activeAssignment.courierId,
      actorType: admin.success ? 'admin' : 'branch',
      actorId: admin.success ? admin.userId || null : branchAuth.branchId || null,
      fromStatus: normalizedBag.status,
      toStatus: updatedBag.status,
      note: 'So‘mka filialga qaytarildi',
    });

    return c.json({ success: true, bag: await buildCourierBagPayload(updatedBag) });
  } catch (error: any) {
    console.error('Release courier bag error:', error);
    return c.json({ error: 'So‘mkani bo‘shatishda xatolik' }, 500);
  }
});

app.get("/make-server-27d0d16c/courier/bags/me", async (c) => {
  try {
    const auth = await validateCourierSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const assignments = await getActiveBagAssignmentsForCourier(auth.courier.id);
    const bags = await Promise.all(
      assignments.map(async (assignment: any) => {
        const bag = await courierBagDb.getBagById(assignment.bagId);
        return bag ? buildCourierBagPayload(bag) : null;
      })
    );

    const normalizedBags = bags.filter(Boolean);
    const emptyBags = normalizedBags.filter((bag: any) => bag.status === 'assigned_empty');
    const occupiedBags = normalizedBags.filter((bag: any) => bag.status === 'occupied');

    return c.json({
      success: true,
      bags: normalizedBags,
      emptyBags,
      occupiedBags,
    });
  } catch (error: any) {
    console.error('Courier me bags error:', error);
    return c.json({ error: 'Kuryer so‘mkalarini olishda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/courier/bags/verify-scan", async (c) => {
  try {
    const auth = await validateCourierSession(c);
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const body = await parseOptionalJsonBody(c);
    const scan = String(body.scan || body.qr || '').trim();
    if (!scan) {
      return c.json({ error: 'scan maydoni majburiy' }, 400);
    }

    const bag = await courierBagDb.findBagByBranchAndCode(auth.courier.branchId, scan);
    if (!bag) {
      return c.json({ error: 'So‘mka topilmadi' }, 404);
    }

    const assignments = await getActiveBagAssignmentsForCourier(auth.courier.id);
    const linked = assignments.some((a: any) => a.bagId === bag.id);
    if (!linked) {
      return c.json({ error: 'Bu so‘mka sizga biriktirilmagan' }, 403);
    }

    if (bag.status !== 'assigned_empty' || bag.currentOrderId) {
      return c.json({ error: 'So‘mka bo‘sh emas yoki allaqachon band' }, 400);
    }

    return c.json({ success: true, bag: await buildCourierBagPayload(bag) });
  } catch (error: any) {
    console.error('Courier bag verify-scan error:', error);
    return c.json({ error: 'So‘mkani tekshirishda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/courier-bags/lookup", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    const branchAuth = await validateBranchSession(c);
    const body = await parseOptionalJsonBody(c);
    const branchId = String(body.branchId || '').trim();
    const scan = String(body.scan || '').trim();
    if (!branchId || !scan) {
      return c.json({ error: 'branchId va scan majburiy' }, 400);
    }

    if (!admin.success && !branchAuth.success) {
      return c.json({ error: 'Admin yoki filial sessiyasi kerak' }, 403);
    }
    if (!admin.success && branchAuth.branchId !== branchId) {
      return c.json({ error: 'Filial sessiyasi mos kelmaydi' }, 403);
    }

    const bag = await courierBagDb.findBagByBranchAndCode(branchId, scan);
    if (!bag) {
      return c.json({ error: 'So‘mka topilmadi' }, 404);
    }

    return c.json({ success: true, bag: await buildCourierBagPayload(bag) });
  } catch (error: any) {
    console.error('Courier bag lookup error:', error);
    return c.json({ error: 'So‘mkani qidirishda xatolik' }, 500);
  }
});

app.get("/make-server-27d0d16c/pickup-racks", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    const branchAuth = await validateBranchSession(c);
    const branchId = String(c.req.query('branchId') || '').trim();
    if (!branchId) {
      return c.json({ error: 'branchId majburiy' }, 400);
    }
    if (!admin.success && (!branchAuth.success || branchAuth.branchId !== branchId)) {
      return c.json({ error: 'Admin yoki mos filial sessiyasi kerak' }, 403);
    }
    const racks = (await kv.getByPrefix('pickup_rack:'))
      .filter((rack: any) => rack && !rack.deleted && rack.branchId === branchId);

    const nonRackStatuses = new Set(['with_courier', 'delivering', 'delivered', 'cancelled']);
    const healedRacks: any[] = [];
    for (const rack of racks) {
      let nextRack = rack;
      const linkedOrderId = String(rack.currentOrderId || '').trim();
      if (linkedOrderId) {
        const linkedOrder = await getOrderRecord(linkedOrderId);
        const shouldFree = !linkedOrder || nonRackStatuses.has(String(linkedOrder.order?.status || '').trim());
        if (shouldFree) {
          nextRack = {
            ...rack,
            status: 'available',
            currentOrderId: null,
            updatedAt: new Date().toISOString(),
          };
          await kv.set(`pickup_rack:${branchId}:${rack.id}`, nextRack);
        }
      }
      healedRacks.push(nextRack);
    }

    healedRacks.sort((a: any, b: any) => String(a.number || '').localeCompare(String(b.number || ''), 'uz'));
    return c.json({ success: true, racks: healedRacks });
  } catch (error: any) {
    console.error('Get pickup racks error:', error);
    return c.json({ error: 'Rastalarni olishda xatolik' }, 500);
  }
});

app.post("/make-server-27d0d16c/pickup-racks", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    const branchAuth = await validateBranchSession(c);
    if (!admin.success && !branchAuth.success) {
      return c.json({ error: 'Admin yoki filial sessiyasi kerak' }, 403);
    }
    const body = await parseOptionalJsonBody(c);
    const branchId = String(body.branchId || '').trim();
    const name = String(body.name || '').trim();
    const number = String(body.number || '').trim();
    if (!branchId || !name || !number) {
      return c.json({ error: 'branchId, name, number majburiy' }, 400);
    }
    if (!admin.success && branchAuth.branchId !== branchId) {
      return c.json({ error: 'Bu filial uchun ruxsat yo‘q' }, 403);
    }
    const existing = (await kv.getByPrefix('pickup_rack:')).find((rack: any) =>
      rack && !rack.deleted && rack.branchId === branchId && String(rack.number || '').toLowerCase() === number.toLowerCase()
    );
    if (existing) {
      return c.json({ error: 'Bu raqamli rasta allaqachon mavjud' }, 409);
    }
    const now = new Date().toISOString();
    const id = `rack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const rack = {
      id,
      branchId,
      name,
      number,
      status: 'available',
      currentOrderId: null,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await kv.set(`pickup_rack:${branchId}:${id}`, rack);
    return c.json({ success: true, rack });
  } catch (error: any) {
    console.error('Create pickup rack error:', error);
    return c.json({ error: 'Rasta qo‘shishda xatolik' }, 500);
  }
});

app.put("/make-server-27d0d16c/pickup-racks/:id", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    const branchAuth = await validateBranchSession(c);
    if (!admin.success && !branchAuth.success) {
      return c.json({ error: 'Admin yoki filial sessiyasi kerak' }, 403);
    }
    const rackId = c.req.param('id');
    const body = await parseOptionalJsonBody(c);
    const branchId = String(body.branchId || '').trim();
    if (!branchId) return c.json({ error: 'branchId majburiy' }, 400);
    if (!admin.success && branchAuth.branchId !== branchId) {
      return c.json({ error: 'Bu filial uchun ruxsat yo‘q' }, 403);
    }
    const key = `pickup_rack:${branchId}:${rackId}`;
    const existing = await kv.get(key);
    if (!existing || existing.deleted) {
      return c.json({ error: 'Rasta topilmadi' }, 404);
    }
    const updated = {
      ...existing,
      name: String(body.name || existing.name || '').trim(),
      number: String(body.number || existing.number || '').trim(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(key, updated);
    return c.json({ success: true, rack: updated });
  } catch (error: any) {
    console.error('Update pickup rack error:', error);
    return c.json({ error: 'Rastani yangilashda xatolik' }, 500);
  }
});

app.delete("/make-server-27d0d16c/pickup-racks/:id", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    const branchAuth = await validateBranchSession(c);
    if (!admin.success && !branchAuth.success) {
      return c.json({ error: 'Admin yoki filial sessiyasi kerak' }, 403);
    }

    const rackId = c.req.param('id');
    const branchId = String(c.req.query('branchId') || '').trim();
    if (!branchId) return c.json({ error: 'branchId majburiy' }, 400);
    if (!admin.success && branchAuth.branchId !== branchId) {
      return c.json({ error: 'Bu filial uchun ruxsat yo‘q' }, 403);
    }

    const key = `pickup_rack:${branchId}:${rackId}`;
    const existing = await kv.get(key);
    if (!existing || existing.deleted) {
      return c.json({ error: 'Rasta topilmadi' }, 404);
    }
    if (existing.status === 'occupied' || existing.currentOrderId) {
      return c.json({ error: 'Band rastani o‘chirib bo‘lmaydi' }, 400);
    }

    await kv.set(key, {
      ...existing,
      deleted: true,
      updatedAt: new Date().toISOString(),
    });

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete pickup rack error:', error);
    return c.json({ error: 'Rastani o‘chirishda xatolik' }, 500);
  }
});

// Get single shop
app.get("/make-server-27d0d16c/shops/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const shop = await kv.get(`shop:${id}`);
    
    if (!shop || shop.deleted) {
      return c.json({ error: 'Do\'kon topilmadi' }, 404);
    }
    
    return c.json({ success: true, shop });
  } catch (error: any) {
    console.log('Get shop error:', error);
    return c.json({ error: 'Do\'konni olishda xatolik' }, 500);
  }
});

// Create shop (requires branch auth)
app.post("/make-server-27d0d16c/shops", async (c) => {
  try {
    const shopData = await c.req.json();
    const access = await validateShopMutationAccess(c, { branchId: shopData.branchId || null });
    if (!access.success) {
      return c.json({ error: access.error }, 403);
    }

    const shopId = `shop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate required fields
    if (!shopData.name || !shopData.branchId || !shopData.login || !shopData.password) {
      return c.json({ error: 'Do\'kon nomi, filial, login va parol majburiy' }, 400);
    }

    // Check if login already exists
    const existingShops = await kv.getByPrefix('shop:');
    const loginExists = existingShops.some((shop: any) => 
      shop.login === shopData.login && !shop.deleted
    );

    if (loginExists) {
      return c.json({ error: 'Bu login band, boshqa login tanlang' }, 400);
    }
    
    const newShop = {
      id: shopId,
      name: shopData.name,
      description: shopData.description || '',
      branchId: shopData.branchId,
      // Do'kon uchun to'lov QR rasm (kassa tasdiqlashda ishlatiladi)
      paymentQrImage: shopData.paymentQrImage || '',
      delivery: shopData.delivery || false,
      deliveryTime: shopData.deliveryTime || '30', // delivery time in minutes
      minOrder: shopData.minOrder || 0,
      phone: shopData.phone || '',
      address: shopData.address || '',
      workingHours: shopData.workingHours || '',
      region: shopData.region || '',
      district: shopData.district || '',
      services: shopData.services || [],
      login: shopData.login,
      password: shopData.password, // In production, hash this!
      logo: shopData.logo || '',
      banner: shopData.banner || '',
      telegramChatId: String(shopData.telegramChatId ?? shopData.telegram_chat_id ?? '').trim(),
      productsCount: 0,
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`shop:${shopId}`, newShop);

    return c.json({ 
      success: true, 
      shop: newShop, 
      message: 'Do\'kon muvaffaqiyatli qo\'shildi' 
    });
  } catch (error: any) {
    console.error('Create shop error:', error);
    return c.json({ error: `Do'konni qo'shishda xatolik: ${error.message}` }, 500);
  }
});

// Update shop
app.put("/make-server-27d0d16c/shops/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const existingShop = await kv.get(`shop:${id}`);
    
    if (!existingShop || existingShop.deleted) {
      return c.json({ error: 'Do\'kon topilmadi' }, 404);
    }

    const access = await validateShopMutationAccess(c, {
      branchId: existingShop.branchId || null,
      shopId: id,
    });
    if (!access.success) {
      return c.json({ error: access.error }, 403);
    }

    const updateData = await c.req.json();

    // If login is being updated, check for duplicates
    if (updateData.login && updateData.login !== existingShop.login) {
      const existingShops = await kv.getByPrefix('shop:');
      const loginExists = existingShops.some((shop: any) => 
        shop.login === updateData.login && shop.id !== id && !shop.deleted
      );

      if (loginExists) {
        return c.json({ error: 'Bu login band, boshqa login tanlang' }, 400);
      }
    }
    
    const updatedShop = {
      ...existingShop,
      ...updateData,
      id, // Keep original ID
      updatedAt: new Date().toISOString(),
    };

    await purgeRemovedR2Urls(existingShop, updatedShop);
    await kv.set(`shop:${id}`, updatedShop);

    return c.json({ 
      success: true, 
      shop: updatedShop, 
      message: 'Do\'kon yangilandi' 
    });
  } catch (error: any) {
    console.error('Update shop error:', error);
    return c.json({ error: 'Do\'konni yangilashda xatolik' }, 500);
  }
});

// Delete shop (soft delete)
app.delete("/make-server-27d0d16c/shops/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const shop = await kv.get(`shop:${id}`);
    
    if (!shop) {
      return c.json({ error: 'Do\'kon topilmadi' }, 404);
    }

    const access = await validateShopMutationAccess(c, {
      branchId: shop.branchId || null,
      shopId: id,
    });
    if (!access.success) {
      return c.json({ error: access.error }, 403);
    }

    const deletedShop = {
      ...shop,
      deleted: true,
      deletedAt: new Date().toISOString(),
    };

    await kv.set(`shop:${id}`, deletedShop);

    return c.json({ 
      success: true, 
      message: 'Do\'kon o\'chirildi' 
    });
  } catch (error: any) {
    console.error('Delete shop error:', error);
    return c.json({ error: 'Do\'konni o\'chirishda xatolik' }, 500);
  }
});

// ==================== SELLER AUTH ====================

// Seller login
app.post("/make-server-27d0d16c/seller/login", async (c) => {
  try {
    const { login, password } = await c.req.json();

    if (!login || !password) {
      return c.json({ error: 'Login va parol majburiy' }, 400);
    }

    // Find shop with matching credentials
    const allShops = await kv.getByPrefix('shop:');
    const shop = allShops.find((s: any) => 
      s.login === login && s.password === password && !s.deleted
    );

    if (!shop) {
      return c.json({ error: 'Login yoki parol noto\'g\'ri' }, 401);
    }

    // Create seller session token
    // IMPORTANT: Don't use shop.id directly because it contains 'shop-' prefix
    // Use timestamp and random string only for clean token format
    const sessionToken = `seller-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🔑 ===== CREATING SELLER SESSION =====');
    console.log('🔑 Generated token:', sessionToken);
    console.log('🔑 Token format: seller-{timestamp}-{random}');
    console.log('🔑 Shop ID:', shop.id);
    console.log('🔑 Shop Name:', shop.name);
    
    const sessionData = {
      shopId: shop.id,
      login: shop.login,
      shopName: shop.name,
      branchId: shop.branchId,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    };

    await kv.set(`seller_session:${sessionToken}`, sessionData);
    
    console.log('✅ Session created in KV store');
    console.log('🔑 KV key:', `seller_session:${sessionToken}`);
    console.log('✅ Session data:', sessionData);
    
    // Verify it was stored correctly
    const verification = await kv.get(`seller_session:${sessionToken}`);
    console.log('✅ Session verification read:', verification ? 'SUCCESS' : 'FAILED');
    if (verification) {
      console.log('✅ Verified data:', verification);
    }
    console.log('🔑 ===== SELLER SESSION CREATION COMPLETE =====\n');

    return c.json({ 
      success: true,
      session: {
        token: sessionToken,
        shop: {
          id: shop.id,
          name: shop.name,
          branchId: shop.branchId,
        },
      },
      message: 'Muvaffaqiyatli kirdingiz!' 
    });
  } catch (error: any) {
    console.error('Seller login error:', error);
    return c.json({ error: `Kirishda xatolik: ${error.message}` }, 500);
  }
});

// Validate seller session
async function validateSellerSession(c: any) {
  console.log('🔐 ===== validateSellerSession START =====');
  
  // Get all headers for debugging
  const allHeaders: Record<string, string> = {};
  c.req.raw.headers.forEach((value: string, key: string) => {
    allHeaders[key] = value;
  });
  console.log('📋 All Request Headers:', JSON.stringify(allHeaders, null, 2));
  
  const xSellerToken = c.req.header('X-Seller-Token') || 
                       c.req.header('x-seller-token') ||
                       c.req.raw.headers.get('X-Seller-Token') ||
                       c.req.raw.headers.get('x-seller-token');
  
  const authHeader = c.req.header('Authorization') || 
                     c.req.header('authorization') ||
                     c.req.raw.headers.get('Authorization') ||
                     c.req.raw.headers.get('authorization');
  
  console.log('🔑 X-Seller-Token:', xSellerToken ? `${xSellerToken.substring(0, 20)}...` : 'MISSING');
  console.log('🔑 Authorization header:', authHeader ? `${authHeader.substring(0, 30)}...` : 'MISSING');
  
  // Extract token from Authorization header (remove "Bearer " prefix if present)
  let authToken = null;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      authToken = parts[1];
    } else if (parts.length === 1) {
      authToken = parts[0];
    }
  }
  
  // Also check query parameters (fallback for CORS issues)
  const queryToken = c.req.query('token');
  console.log('🔑 Query token:', queryToken ? `${queryToken.substring(0, 20)}...` : 'MISSING');
  
  // Try to extract from URL manually (backup for c.req.query)
  let urlToken = null;
  try {
    const url = new URL(c.req.url);
    urlToken = url.searchParams.get('token');
    console.log('🔑 URL token (manual):', urlToken ? `${urlToken.substring(0, 20)}...` : 'MISSING');
  } catch (e) {
    console.log('⚠️ Failed to parse URL manually');
  }
  
  const token = xSellerToken || authToken || queryToken || urlToken;
  
  console.log('🔑 Final extracted token:', token ? `${token.substring(0, 20)}...` : 'MISSING');
  console.log('🔑 Token length:', token ? token.length : 0);
  
  if (!token) {
    console.log('❌ No token found');
    console.log('🔐 ===== validateSellerSession END (NO TOKEN) =====\n');
    return { success: false, error: 'Session topilmadi' };
  }

  console.log('🔍 Looking for seller session in KV store...');
  console.log('🔑 KV key will be:', `seller_session:${token}`);
  
  const session = await kv.get(`seller_session:${token}`);
  
  console.log('🔍 Session lookup result:', session ? 'FOUND' : 'NOT FOUND');
  
  if (!session) {
    console.log('❌ Session not found in KV store');
    
    // Debug: List all seller sessions
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      
      const { data: allSessions, error: queryError } = await supabaseClient
        .from('kv_store_27d0d16c')
        .select('key, value')
        .like('key', 'seller_session:%')
        .limit(10);
      
      console.log('📋 Sample seller sessions in database:', allSessions?.length || 0);
      if (allSessions && allSessions.length > 0) {
        allSessions.forEach((item: any, index: number) => {
          const sessionTokenFromKey = item.key.replace('seller_session:', '');
          console.log(`  Session ${index + 1}:`, {
            keyPreview: item.key.substring(0, 40) + '...',
            tokenPreview: sessionTokenFromKey.substring(0, 30) + '...',
            providedToken: token.substring(0, 30) + '...',
            tokensMatch: sessionTokenFromKey === token ? '✅ MATCH!' : '❌ NO MATCH',
            shopId: item.value?.shopId,
            shopName: item.value?.shopName,
            expiresAt: item.value?.expiresAt ? new Date(item.value.expiresAt).toISOString() : 'N/A'
          });
        });
        
        // Try to find exact match
        const exactMatch = allSessions.find((item: any) => {
          const sessionTokenFromKey = item.key.replace('seller_session:', '');
          return sessionTokenFromKey === token;
        });
        
        if (exactMatch) {
          console.log('✅ FOUND EXACT MATCH IN DATABASE BUT KV.GET FAILED');
          console.log('✅ Using session from database directly');
          
          // Check expiry
          if (Date.now() > exactMatch.value?.expiresAt) {
            console.log('❌ Session expired');
            console.log('🔐 ===== validateSellerSession END (EXPIRED) =====\n');
            return { success: false, error: 'Session muddati tugagan' };
          }
          
          console.log('✅ Session valid, shopId:', exactMatch.value?.shopId);
          console.log('🔐 ===== validateSellerSession END (SUCCESS) =====\n');
          return { success: true, shopId: exactMatch.value?.shopId, branchId: exactMatch.value?.branchId };
        }
      } else {
        console.log('  No seller sessions found in database!');
      }
    } catch (err) {
      console.error('Error listing seller sessions:', err);
    }
    
    console.log('🔐 ===== validateSellerSession END (NOT FOUND) =====\n');
    return { success: false, error: 'Session noto\'g\'ri yoki muddati tugagan' };
  }

  console.log('✅ Session found:', session);
  
  if (Date.now() > session.expiresAt) {
    console.log('❌ Session expired at:', new Date(session.expiresAt).toISOString());
    await kv.del(`seller_session:${token}`);
    console.log('🔐 ===== validateSellerSession END (EXPIRED) =====\n');
    return { success: false, error: 'Session muddati tugagan' };
  }

  console.log('✅ Session valid, shopId:', session.shopId, 'branchId:', session.branchId);
  console.log('🔐 ===== validateSellerSession END (SUCCESS) =====\n');
  return { success: true, shopId: session.shopId, branchId: session.branchId };
}

// ==================== SHOP PRODUCTS (SELLER PANEL) ====================

// Get shop products (for seller)
app.get("/make-server-27d0d16c/seller/products", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const products = await kv.getByPrefix('shop_product:');
    const shopProducts = products.filter(
      (p: any) => sellerShopIdsMatch(p.shopId, auth.shopId) && !p.deleted,
    );

    // Calculate soldThisWeek for each product's variants
    for (const product of shopProducts) {
      if (product.variants && Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          variant.soldThisWeek = await calculateSoldThisWeek(product.id, variant.id);
        }
      }
    }

    return c.json({ success: true, products: shopProducts });
  } catch (error: any) {
    console.error('Get shop products error:', error);
    return c.json({ error: 'Mahsulotlarni olishda xatolik' }, 500);
  }
});

// Add product to shop
app.post("/make-server-27d0d16c/seller/products", async (c) => {
  try {
    console.log('🚀 ===== ADD PRODUCT REQUEST START =====');
    console.log('📥 Request headers:', Object.fromEntries(c.req.raw.headers.entries()));
    console.log('📥 Request URL:', c.req.url);
    
    const auth = await validateSellerSession(c);
    console.log('🔐 Auth result:', auth);
    
    if (!auth.success) {
      console.error('❌ Auth failed:', auth.error);
      return c.json({ error: auth.error }, 401);
    }

    const productData = await c.req.json();
    console.log('📦 Product data received:', {
      name: productData.name,
      description: productData.description,
      features: productData.features,
      variantsCount: productData.variants?.length,
    });
    console.log('📦 Full product data:', JSON.stringify(productData, null, 2));

    const vchk = validateVariantCommissionsForSave(productData.variants, "Mahsulot");
    if (!vchk.ok) {
      return c.json({ error: vchk.error }, 400);
    }
    if (Array.isArray(productData.variants)) {
      productData.variants = productData.variants.map((v: any) => ({
        ...v,
        commission: clampPlatformCommissionPercent(v?.commission ?? v?.platformCommissionPercent),
      }));
    }

    const productId = `shop_product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('🆔 Generated product ID:', productId);
    
    // Get shop info to add shop name to product
    console.log('🏪 Loading shop info...');
    const shop = await kv.get(`shop:${auth.shopId}`);
    const shopName = shop?.name || null;
    console.log('🏪 Shop name:', shopName);
    console.log('🏪 Shop region:', shop?.region);
    console.log('🏪 Shop district:', shop?.district);
    
    const newProduct = {
      ...productData,
      id: productId,
      shopId: auth.shopId,
      shopName, // Add shop name for display
      region: shop?.region || '', // Add shop region to product
      district: shop?.district || '', // Add shop district to product
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('💾 Saving product to KV store...');
    await kv.set(`shop_product:${productId}`, newProduct);
    console.log('✅ Product saved to KV store');

    // Update shop products count
    console.log('📊 Updating shop products count...');
    if (shop) {
      shop.productsCount = (shop.productsCount || 0) + 1;
      await kv.set(`shop:${auth.shopId}`, shop);
      console.log('✅ Shop products count updated:', shop.productsCount);
    }

    console.log('✅ ===== ADD PRODUCT REQUEST SUCCESS =====');
    return c.json({ 
      success: true, 
      product: newProduct, 
      message: 'Mahsulot qo\'shildi' 
    });
  } catch (error: any) {
    console.error('❌ ===== ADD PRODUCT REQUEST ERROR =====');
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error name:', error?.name);
    console.error('❌ Error message:', error?.message);
    console.error('❌ Error stack:', error?.stack);
    console.error('❌ Full error object:', error);
    
    const errorMessage = error?.message || 'Mahsulot qo\'shishda xatolik';
    console.error('❌ Returning error to client:', errorMessage);
    
    return c.json({ 
      error: errorMessage,
      message: errorMessage,
      details: error?.stack 
    }, 500);
  }
});

// Update shop product
app.put("/make-server-27d0d16c/seller/products/:id", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const product = await kv.get(`shop_product:${id}`);
    
    if (!product || !sellerShopIdsMatch(product.shopId, auth.shopId)) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }

    const updateData = await c.req.json();

    const mergedVariants = updateData.variants ?? product.variants;
    const vchk = validateVariantCommissionsForSave(mergedVariants, "Mahsulot");
    if (!vchk.ok) {
      return c.json({ error: vchk.error }, 400);
    }
    if (Array.isArray(updateData.variants)) {
      updateData.variants = updateData.variants.map((v: any) => ({
        ...v,
        commission: clampPlatformCommissionPercent(v?.commission ?? v?.platformCommissionPercent),
      }));
    }

    // Ensure shopName is preserved or updated
    const shop = await kv.get(`shop:${auth.shopId}`);
    const shopName = shop?.name || product.shopName || null;
    
    const updatedProduct = {
      ...product,
      ...updateData,
      id,
      shopName, // Preserve or update shop name
      updatedAt: new Date().toISOString(),
    };

    await purgeRemovedR2Urls(product, updatedProduct);
    await kv.set(`shop_product:${id}`, updatedProduct);

    return c.json({ 
      success: true, 
      product: updatedProduct, 
      message: 'Mahsulot yangilandi' 
    });
  } catch (error: any) {
    console.error('Update shop product error:', error);
    return c.json({ error: 'Mahsulotni yangilashda xatolik' }, 500);
  }
});

// Delete shop product
app.delete("/make-server-27d0d16c/seller/products/:id", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const product = await kv.get(`shop_product:${id}`);
    
    if (!product || !sellerShopIdsMatch(product.shopId, auth.shopId)) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }

    await purgeAllManagedR2UrlsInRecord(product);
    const deletedProduct = {
      ...product,
      deleted: true,
      deletedAt: new Date().toISOString(),
    };

    await kv.set(`shop_product:${id}`, deletedProduct);

    // Update shop products count
    const shop = await kv.get(`shop:${auth.shopId}`);
    if (shop && shop.productsCount > 0) {
      shop.productsCount = shop.productsCount - 1;
      await kv.set(`shop:${auth.shopId}`, shop);
    }

    return c.json({ 
      success: true, 
      message: 'Mahsulot o\'chirildi' 
    });
  } catch (error: any) {
    console.error('Delete shop product error:', error);
    return c.json({ error: 'Mahsulotni o\'chirishda xatolik' }, 500);
  }
});

// Toggle product status (activate/deactivate)
app.patch("/make-server-27d0d16c/seller/products/:id/toggle", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const product = await kv.get(`shop_product:${id}`);
    
    if (!product || !sellerShopIdsMatch(product.shopId, auth.shopId)) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }

    const { isActive } = await c.req.json();
    
    const updatedProduct = {
      ...product,
      isActive: isActive !== undefined ? isActive : !product.isActive,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`shop_product:${id}`, updatedProduct);

    return c.json({ 
      success: true, 
      product: updatedProduct,
      message: updatedProduct.isActive ? 'Mahsulot faollashtirildi' : 'Mahsulot o\'chirildi'
    });
  } catch (error: any) {
    console.error('Toggle product status error:', error);
    return c.json({ error: 'Mahsulot holatini o\'zgartirishda xatolik' }, 500);
  }
});

// Get seller's shop info
app.get("/make-server-27d0d16c/seller/shop", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const shop = await kv.get(`shop:${auth.shopId}`);
    
    if (!shop || shop.deleted) {
      return c.json({ error: 'Do\'kon topilmadi' }, 404);
    }

    return c.json({ success: true, shop });
  } catch (error: any) {
    console.error('Get seller shop error:', error);
    return c.json({ error: 'Do\'kon ma\'lumotlarini olishda xatolik' }, 500);
  }
});

// ==================== SHOP ORDERS (SELLER PANEL) ====================

const normalizeShopIdForSeller = (raw: unknown) =>
  String(raw ?? "")
    .trim()
    .replace(/^shop:/i, "");

/** KV da `shopId` ba'zan `shop:xxx`, ba'zan `xxx` — sotuvchi ombor/mahsulot filtrlari uchun */
function sellerShopIdsMatch(productOrOrderShopId: unknown, authShopId: unknown) {
  return normalizeShopIdForSeller(productOrOrderShopId) === normalizeShopIdForSeller(authShopId);
}

function inferShopIdFromCustomerOrder(order: any): string {
  const top = order?.shopId;
  if (top != null && String(top).trim()) return String(top).trim();
  const items = Array.isArray(order?.items) ? order.items : [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const candidates = [
      it.shopId,
      (it as any).shop_id,
      (it as any).product?.shopId,
      (it as any).product?.shop_id,
      (it as any).variant?.shopId,
      (it as any).metadata?.shopId,
      (it as any).lineItem?.shopId,
      (it as any).shop?.id,
    ];
    for (const c of candidates) {
      const s = String(c ?? "").trim();
      if (s) return s;
    }
  }
  return "";
}

function pickTelegramChatIdFromEntity(entity: any): string {
  if (!entity || typeof entity !== "object") return "";
  const raw =
    entity.telegramChatId ??
    entity.telegram_chat_id ??
    entity.telegramChatID ??
    entity.TelegramChatId ??
    entity.telegram ??
    entity.tgChatId ??
    entity.tg_chat_id ??
    "";
  return String(raw ?? "").trim();
}

/** KV kalit / id nomi farq qilganda ham do‘kon yozuvini topish */
async function loadShopKvRecordByNormalizedId(normalizedId: string): Promise<any | null> {
  const norm = normalizeShopIdForSeller(normalizedId);
  if (!norm) return null;
  const direct = await kv.get(`shop:${norm}`);
  if (direct && !direct.deleted) return direct;
  const all = await kv.getByPrefix("shop:");
  return (
    all.find(
      (s: any) => s && !s.deleted && normalizeShopIdForSeller(s.id) === norm,
    ) || null
  );
}

/**
 * Bitta savat qatori uchun do‘kon ID (maydondagi shopId yoki `shop_product:*` KV).
 * `isShopProductCartLine` ga bog‘lanmasdan UUID / turli id formatlarini sinaymiz.
 */
async function resolveShopIdFromSingleShopProductLine(line: any): Promise<string | null> {
  if (!line || typeof line !== "object") return null;
  const explicit = normalizeShopIdForSeller(
    String(
      (line as any).shopId ??
        (line as any).shop_id ??
        (line as any).product?.shopId ??
        (line as any).product?.shop_id ??
        "",
    ).trim(),
  );
  if (explicit) return explicit;

  const raw = String((line as any)?.id ?? (line as any)?.productId ?? "").trim();
  if (!raw) return null;

  const keysToTry = new Set<string>();
  keysToTry.add(raw.startsWith("shop_product:") ? raw : `shop_product:${raw}`);
  if (!raw.startsWith("shop_product:") && raw.includes("shop_product-")) {
    keysToTry.add(`shop_product:${raw}`);
  }
  for (const key of keysToTry) {
    if (key.replace("shop_product:", "").length < 2) continue;
    const product = await kv.get(key);
    if (!product || product.deleted) continue;
    const sid = String(product.shopId ?? (product as any).shop_id ?? "").trim();
    if (sid) {
      const norm = normalizeShopIdForSeller(sid);
      return norm || null;
    }
  }
  return null;
}

/**
 * Checkout ko‘pincha `shopId` yubormaydi; qatorlar orqali `shop_product:*` dan topish.
 */
async function resolveShopIdFromShopProductOrderLines(
  items: unknown,
  preInferred: string | null | undefined,
): Promise<string | null> {
  const fromPre =
    preInferred != null && String(preInferred).trim() !== ""
      ? normalizeShopIdForSeller(preInferred)
      : "";
  if (fromPre) return fromPre;

  const arr = Array.isArray(items) ? items : [];
  for (const line of arr) {
    const sid = await resolveShopIdFromSingleShopProductLine(line);
    if (sid) return sid;
  }
  return null;
}

/** Telegram: bir buyurtmadagi do‘kon qatorlarini shopId bo‘yicha guruhlash. */
async function groupShopLinesByShopIdForTelegram(lines: any[]): Promise<Map<string, any[]>> {
  const m = new Map<string, any[]>();
  for (const line of lines) {
    const sid = await resolveShopIdFromSingleShopProductLine(line);
    if (!sid) continue;
    const norm = normalizeShopIdForSeller(sid);
    if (!norm) continue;
    if (!m.has(norm)) m.set(norm, []);
    m.get(norm)!.push(line);
  }
  return m;
}

/**
 * Kassa cheki: do‘kon Telegram chat — asosiy do‘kon yozuvi yoki filialda yagona telegramli do‘kon.
 */
async function resolveShopTelegramTargetForReceipt(args: {
  normalizedShopId: string;
  branchId: string | null | undefined;
}): Promise<{ chatId: string; shopName: string | null } | null> {
  const { normalizedShopId, branchId } = args;
  const branchNorm = branchId ? normalizeBranchId(String(branchId)) : "";

  if (normalizedShopId) {
    const shop = await loadShopKvRecordByNormalizedId(normalizedShopId);
    if (shop) {
      const chatId = pickTelegramChatIdFromEntity(shop);
      if (chatId) return { chatId, shopName: shop.name || null };
    }
  }

  if (!branchNorm) return null;
  const all = await kv.getByPrefix("shop:");
  const onBranch = (all || []).filter(
    (s: any) =>
      s &&
      !s.deleted &&
      normalizeBranchId(s.branchId || "") === branchNorm,
  );
  const withChat = onBranch
    .map((s: any) => ({ s, chatId: pickTelegramChatIdFromEntity(s) }))
    .filter((x) => x.chatId);
  if (withChat.length !== 1) return null;
  return {
    chatId: withChat[0].chatId,
    shopName: withChat[0].s?.name || null,
  };
}

/** POST /orders: do‘kon uchun Telegram (TELEGRAM_BOT_TOKEN). */
async function sendShopOrderTelegramNotification(params: {
  order: any;
  data: any;
  branchId: string | null | undefined;
  orderIdForLog: string;
  lines: any[];
  shopIdNormHint: string | null | undefined;
  totalAmount: number;
  contextLabel?: string;
}): Promise<void> {
  const { order, data, branchId, orderIdForLog, lines, shopIdNormHint, totalAmount, contextLabel } = params;
  try {
    let shopIdNorm = normalizeShopIdForSeller(String(shopIdNormHint || "").trim());
    if (!shopIdNorm) {
      const r = await resolveShopIdFromShopProductOrderLines(lines, null);
      shopIdNorm = normalizeShopIdForSeller(String(r || ""));
    }
    if (!shopIdNorm) {
      console.log("ℹ️ Do'kon Telegram: shopId topilmadi", { orderIdForLog, contextLabel });
      return;
    }

    let shopRecord: any = await loadShopKvRecordByNormalizedId(shopIdNorm);
    let tgChat = shopRecord ? pickTelegramChatIdFromEntity(shopRecord) : "";
    let tgShopName = String(shopRecord?.name || "Do'kon").trim() || "Do'kon";

    if (!tgChat && shopIdNorm && branchId) {
      const fallback = await resolveShopTelegramTargetForReceipt({
        normalizedShopId: shopIdNorm,
        branchId,
      });
      if (fallback?.chatId) {
        tgChat = fallback.chatId;
        tgShopName = String(fallback.shopName || tgShopName);
      }
    }

    if (!tgChat) {
      console.log("ℹ️ Do'kon Telegram: chat ID yo'q (telegramChatId sozlang)", {
        shopIdNorm,
        orderIdForLog,
        contextLabel,
      });
      return;
    }

    const itemsForTelegram = (Array.isArray(lines) ? lines : []).map((item: any) => ({
      name: String(item?.name || item?.title || item?.product?.name || "Mahsulot"),
      variantName: String(
        item?.variantName ||
          item?.selectedVariantName ||
          item?.variant?.name ||
          item?.variantDetails?.name ||
          "Standart",
      ),
      quantity: Math.max(1, Number(item?.quantity || 1)),
      price: Number(item?.price ?? item?.unitPrice ?? 0),
      additionalProducts: (
        Array.isArray(item?.additionalProducts)
          ? item.additionalProducts
          : Array.isArray(item?.addons)
            ? item.addons
            : Array.isArray(item?.extras)
              ? item.extras
              : []
      ).map((addon: any) => ({
        name: String(addon?.name || "Qo'shimcha"),
        price: Number(addon?.price || 0),
        quantity: Number(addon?.quantity || 1),
      })),
    }));

    const payUz: Record<string, string> = {
      cash: "Naqd",
      naqd: "Naqd",
      click: "Click",
      click_card: "Click (karta)",
      payme: "Payme",
      atmos: "Atmos",
      qr: "Kassa QR",
      qrcode: "Kassa QR",
    };
    const pmRaw = String(order.paymentMethod || "cash").toLowerCase();
    let paymentLabel = payUz[pmRaw] || order.paymentMethod || "Naqd";
    if (order.paymentStatus === "paid" && !payUz[pmRaw]) {
      paymentLabel = `${paymentLabel} (to‘langan)`;
    }

    const addr = formatHumanOrderAddressForTelegram(order);

    const telegramItems =
      itemsForTelegram.length > 0
        ? itemsForTelegram
        : [
            {
              name: "Buyurtma",
              variantName: "—",
              quantity: 1,
              price: Number(totalAmount || order.finalTotal || order.totalAmount || 0),
            },
          ];

    const sent = await telegram.sendOrderNotification({
      type: "shop",
      shopName: tgShopName,
      shopChatId: tgChat,
      orderNumber: String(order.orderNumber || order.id),
      customerName: String(order.customerName || "Mijoz"),
      customerPhone: String(order.customerPhone || "Ko‘rsatilmagan"),
      customerAddress: addr,
      items: telegramItems,
      totalAmount: Number(totalAmount || order.finalTotal || order.totalAmount || 0),
      deliveryMethod:
        String(data?.addressType || "").toLowerCase() === "pickup" ? "Olib ketish" : "Yetkazib berish",
      paymentMethod: paymentLabel,
      orderDate: new Date(order.createdAt || Date.now()).toLocaleString("uz-UZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    if (!sent) {
      console.warn("⚠️ Do'kon Telegram: yuborilmadi (token yoki API)", {
        shopIdNorm,
        orderIdForLog,
        contextLabel,
      });
    } else {
      console.log("✅ Do'kon Telegram yuborildi", { shopIdNorm, orderIdForLog, contextLabel });
    }
  } catch (e) {
    console.warn("⚠️ sendShopOrderTelegramNotification:", e);
  }
}

async function resolveNormalizedShopIdForReceipt(order: any): Promise<string> {
  const top = String(order?.shopId || "").trim();
  if (top) return normalizeShopIdForSeller(top);
  const inferred = inferShopIdFromCustomerOrder(order);
  if (inferred) return normalizeShopIdForSeller(inferred);
  const items = Array.isArray(order?.items) ? order.items : [];
  for (const it of items) {
    const pid = String(it?.productId || it?.product?.id || it?.id || "").trim();
    if (!pid) continue;
    try {
      const prod = await kv.get(`shop_product:${pid}`);
      if (prod?.shopId) return normalizeShopIdForSeller(String(prod.shopId));
    } catch {
      /* ignore */
    }
  }
  return "";
}

function parseOrderKvValue(value: unknown): any | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value as any;
  return null;
}

// Get shop orders (legacy shop_order:* + mijoz checkout order:* shop)
app.get("/make-server-27d0d16c/seller/orders", async (c) => {
  try {
    const auth = await validateSellerSession(c);

    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const sellerShopNorm = normalizeShopIdForSeller(auth.shopId);
    const byId = new Map<string, any>();

    const legacy = await kv.getByPrefix("shop_order:");
    for (const o of legacy) {
      if (!o || o.deleted) continue;
      if (normalizeShopIdForSeller(o.shopId) !== sellerShopNorm) continue;
      const oid = String(o.id || "").trim();
      if (!oid) continue;
      byId.set(oid, { ...o, sellerOrderSource: "legacy_shop_order" });
    }

    const rows = await kv.getByPrefixWithKeys("order:");
    for (const { key, value } of rows) {
      const order = parseOrderKvValue(value);
      if (!order || order.deleted) continue;
      const ot = String(order.orderType || "").toLowerCase().trim();
      if (ot !== "shop") continue;
      if (
        !order.releasedToPreparerAt &&
        isCashLikePaymentMethodRaw(order.paymentMethod ?? order.payment_method)
      ) {
        continue;
      }
      const sid = inferShopIdFromCustomerOrder(order);
      if (normalizeShopIdForSeller(sid) !== sellerShopNorm) continue;
      const oid = String(order.id || "").trim();
      if (!oid) continue;
      byId.set(oid, {
        ...order,
        sellerOrderSource: "customer_checkout",
        _storageKey: key,
      });
    }

    const merged = Array.from(byId.values()).sort((a: any, b: any) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });

    return c.json({ success: true, orders: merged });
  } catch (error: any) {
    console.error("Get shop orders error:", error);
    return c.json({ error: "Buyurtmalarni olishda xatolik" }, 500);
  }
});

// Update order status (legacy shop_order yoki checkout order:*)
app.put("/make-server-27d0d16c/seller/orders/:id", async (c) => {
  try {
    const auth = await validateSellerSession(c);

    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = String(c.req.param("id") || "").trim();
    const sellerShopNorm = normalizeShopIdForSeller(auth.shopId);
    const { status } = await c.req.json();
    if (!status) {
      return c.json({ error: "status majburiy" }, 400);
    }

    const legacy = await kv.get(`shop_order:${id}`);
    if (legacy && !legacy.deleted && normalizeShopIdForSeller(legacy.shopId) === sellerShopNorm) {
      const prevStatus = String(legacy.status || "").toLowerCase().trim();
      const nextStatus = String(status || "").toLowerCase().trim();
      if (nextStatus === "cancelled" && prevStatus !== "cancelled") {
        await restoreInventoryFromOrder(legacy);
      }
      const nowLeg = new Date().toISOString();
      const wasPaidLeg =
        nextStatus === "cancelled" &&
        prevStatus !== "cancelled" &&
        isPaidLikeStatus(legacy.paymentStatus);
      const updatedOrder = {
        ...legacy,
        status,
        ...(nextStatus === "cancelled" && prevStatus !== "cancelled"
          ? {
              inventoryRestoredOnCancel: true,
              ...(wasPaidLeg ? { refundPending: true, refundRequestedAt: nowLeg } : {}),
            }
          : {}),
        updatedAt: nowLeg,
      };
      await kv.set(`shop_order:${id}`, updatedOrder);
      return c.json({
        success: true,
        order: updatedOrder,
        message: "Buyurtma holati yangilandi",
      });
    }

    const record = await getOrderRecord(id);
    if (!record?.order) {
      return c.json({ error: "Buyurtma topilmadi" }, 404);
    }
    const order = record.order;
    if (String(order.orderType || "").toLowerCase().trim() !== "shop") {
      return c.json({ error: "Buyurtma topilmadi" }, 404);
    }
    const sid = inferShopIdFromCustomerOrder(order);
    if (normalizeShopIdForSeller(sid) !== sellerShopNorm) {
      return c.json({ error: "Buyurtma topilmadi" }, 404);
    }

    const prevStatus = String(order.status || "").toLowerCase().trim();
    const nextStatus = String(status || "").toLowerCase().trim();
    if (nextStatus === "cancelled" && prevStatus !== "cancelled") {
      await restoreInventoryFromOrder(order);
    }

    const now = new Date().toISOString();
    const wasPaidOnCancel =
      nextStatus === "cancelled" &&
      prevStatus !== "cancelled" &&
      isPaidLikeStatus(order.paymentStatus);
    const updatedOrder = {
      ...order,
      status,
      ...(nextStatus === "cancelled" && prevStatus !== "cancelled"
        ? {
            inventoryRestoredOnCancel: true,
            ...(wasPaidOnCancel ? { refundPending: true, refundRequestedAt: now } : {}),
          }
        : {}),
      updatedAt: now,
      statusHistory: [
        ...(Array.isArray(order.statusHistory) ? order.statusHistory : []),
        {
          status,
          timestamp: now,
          note: "Sotuvchi panelidan yangilandi",
        },
      ],
    };
    await kv.set(record.key, updatedOrder);
    await syncFoodOrderMirrorKv(updatedOrder);

    try {
      await syncRelationalOrderFromLegacy({
        legacyOrderId: id,
        kvStatus: status,
        kvPaymentStatus: String(
          (updatedOrder as any).paymentStatus || order.paymentStatus || "pending",
        ),
        paymentRequiresVerification: Boolean(
          (updatedOrder as any).paymentRequiresVerification ?? order.paymentRequiresVerification,
        ),
      });
    } catch (e) {
      console.warn("[seller order update] v2 sync:", e);
    }

    return c.json({
      success: true,
      order: updatedOrder,
      message: "Buyurtma holati yangilandi",
    });
  } catch (error: any) {
    console.error("Update order status error:", error);
    return c.json({ error: "Buyurtma holatini yangilashda xatolik" }, 500);
  }
});

// ==================== CUSTOMER ORDERS ====================

// Create order from customer (DO'KON specific)
app.post("/make-server-27d0d16c/shop/orders", async (c) => {
  try {
    const body = await c.req.json();
    const { shopId, items, customer, delivery, payment } = body;

    // Validate input
    if (!shopId || !items || items.length === 0 || !customer || !delivery || !payment) {
      return c.json({ error: 'Ma\'lumotlar to\'liq emas' }, 400);
    }

    // Get shop info
    const shop = await kv.get(`shop:${shopId}`);
    if (!shop) {
      return c.json({ error: 'Do\'kon topilmadi' }, 404);
    }

    // Check stock and calculate total with commission
    let totalAmount = 0;
    let totalCommission = 0;
    let totalShopEarnings = 0;
    const processedItems = [];

    for (const item of items) {
      const productKey = shopProductKvKeyFromPid(String(item.productId ?? "").trim());
      if (!productKey) {
        return c.json({ error: "Mahsulot ID noto'g'ri" }, 400);
      }
      const product = await kv.get(productKey);
      if (!product || product.deleted) {
        return c.json({ error: `Mahsulot topilmadi: ${item.productId}` }, 404);
      }

      const variantKey =
        item.variantId != null && String(item.variantId).trim() !== ""
          ? String(item.variantId).trim()
          : "__first__";
      const variant = resolveShopProductVariantForOrder(product, variantKey);
      if (!variant) {
        return c.json({ error: `Variant topilmadi: ${item.variantId}` }, 404);
      }

      const qty = Math.max(0, Math.floor(Number(item.quantity ?? 1)));
      const stock = Math.floor(Number(variant.stock ?? variant.stockQuantity ?? 0));
      if (stock < qty) {
        return c.json({
          error: `Omborda yetarli mahsulot yo'q: ${product.name} (${variant.name || variantKey})`,
          available: stock,
          requested: qty,
        }, 400);
      }

      const next = Math.max(0, stock - qty);
      variant.stock = next;
      variant.stockQuantity = next;
      adjustVariantSoldCount(variant, qty);
      product.updatedAt = new Date().toISOString();
      await kv.set(productKey, product);

      // Calculate commission
      const itemTotal = variant.price * item.quantity;
      const commissionRate = variant.commission || 0;
      const itemCommission = (itemTotal * commissionRate) / 100;
      const itemShopEarning = itemTotal - itemCommission;

      totalAmount += itemTotal;
      totalCommission += itemCommission;
      totalShopEarnings += itemShopEarning;

      processedItems.push({
        ...item,
        commission: commissionRate,
        commissionAmount: itemCommission,
        shopEarning: itemShopEarning,
      });
    }

    // Create order
    const orderId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const orderNumber = `ORD${Date.now().toString().slice(-8)}`;
    const order = {
      id: orderId,
      orderNumber,
      shopId,
      shopName: shop.name,
      items: processedItems,
      customer,
      delivery,
      payment,
      totalAmount,
      totalCommission,
      totalShopEarnings,
      status: 'pending', // pending, confirmed, preparing, delivering, completed, cancelled
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`shop_order:${orderId}`, order);

    const legacyShopTg = pickTelegramChatIdFromEntity(shop);
    if (legacyShopTg) {
      console.log(`📱 Sending Telegram notification to shop ${shop.name} (Chat ID: ${legacyShopTg})`);

      const notificationSent = await telegram.sendOrderNotification({
        type: 'shop',
        shopName: String(shop.name || 'Do\'kon'),
        shopChatId: legacyShopTg,
        orderNumber,
        customerName: customer.name || 'Noma\'lum',
        customerPhone: customer.phone || 'Ko\'rsatilmagan',
        customerAddress: formatCustomerAddressForTelegram(customer),
        items: items.map((item: any) => ({
          name: item.name || 'Mahsulot',
          variantName: item.variantName || 'Standart',
          quantity: item.quantity,
          price: item.price,
        })),
        totalAmount,
        deliveryMethod: delivery.method || 'Yetkazib berish',
        paymentMethod: payment.method || 'Naqd',
        orderDate: new Date().toLocaleString('uz-UZ', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });

      if (notificationSent) {
        console.log(`✅ Telegram notification sent successfully for order ${orderNumber}`);
      } else {
        console.log(`⚠️ Failed to send Telegram notification for order ${orderNumber}`);
      }
    } else {
      console.log(`ℹ️ No Telegram chat ID configured for shop ${shop.name} (telegramChatId / telegram_chat_id)`);
    }

    return c.json({ 
      success: true, 
      order,
      message: 'Buyurtma qabul qilindi!' 
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    return c.json({ error: 'Buyurtma yaratishda xatolik' }, 500);
  }
});

// Test Telegram connection
app.post("/make-server-27d0d16c/test-telegram", async (c) => {
  try {
    const { chatId } = await c.req.json();

    if (!chatId) {
      return c.json({ error: 'Chat ID kerak' }, 400);
    }

    const result = await telegram.testTelegramConnection(chatId);
    
    if (result.success) {
      return c.json({ success: true, message: result.message });
    } else {
      return c.json({ error: result.message }, 400);
    }
  } catch (error: any) {
    console.error('Test Telegram error:', error);
    return c.json({ error: 'Telegram test xatosi' }, 500);
  }
});

// ==================== SELLER STATISTICS ====================

// Get seller statistics
app.get("/make-server-27d0d16c/seller/statistics", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    // Get all shop orders
    const allOrders = await kv.getByPrefix('shop_order:');
    const shopOrders = allOrders.filter((o: any) => sellerShopIdsMatch(o.shopId, auth.shopId));

    // Calculate statistics
    let totalOrders = shopOrders.length;
    let totalRevenue = 0;
    let totalCommission = 0;
    let totalEarnings = 0;
    let pendingOrders = 0;
    let completedOrders = 0;

    shopOrders.forEach((order: any) => {
      totalRevenue += order.totalAmount || 0;
      totalCommission += order.totalCommission || 0;
      totalEarnings += order.totalShopEarnings || 0;

      if (order.status === 'pending') pendingOrders++;
      if (order.status === 'completed') completedOrders++;
    });

    // Get products count
    const allProducts = await kv.getByPrefix('shop_product:');
    const shopProducts = allProducts.filter(
      (p: any) => sellerShopIdsMatch(p.shopId, auth.shopId) && !p.deleted,
    );
    const totalProducts = shopProducts.length;

    // Get total stock
    let totalStock = 0;
    shopProducts.forEach((product: any) => {
      product.variants?.forEach((variant: any) => {
        totalStock += variant.stock || 0;
      });
    });

    return c.json({
      success: true,
      statistics: {
        totalOrders,
        totalRevenue,
        totalCommission,
        totalEarnings,
        pendingOrders,
        completedOrders,
        totalProducts,
        totalStock,
        averageCommissionRate: totalRevenue > 0 ? (totalCommission / totalRevenue * 100).toFixed(2) : 0,
      },
    });
  } catch (error: any) {
    console.error('Get seller statistics error:', error);
    return c.json({ error: 'Statistika olishda xatolik' }, 500);
  }
});

// ==================== SHOP INVENTORY (SELLER PANEL) ====================

const LOW_STOCK_THRESHOLD = 5;

// Get shop inventory (variantlar bo‘yicha real ombor)
app.get("/make-server-27d0d16c/seller/inventory", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const products = await kv.getByPrefix('shop_product:');
    const shopProducts = products.filter(
      (p: any) => sellerShopIdsMatch(p.shopId, auth.shopId) && !p.deleted,
    );

    const items: any[] = [];
    for (const p of shopProducts) {
      const vars = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : null;
      if (vars) {
        vars.forEach((v: any, i: number) => {
          const st = Number(v.stock ?? v.stockQuantity ?? 0);
          items.push({
            productId: p.id,
            productName: String(p.name || 'Mahsulot'),
            variantId: v.id != null && String(v.id) !== '' ? String(v.id) : '',
            variantIndex: i,
            variantLabel: String(v.name || '').trim() || `Variant ${i + 1}`,
            stock: Number.isFinite(st) ? Math.max(0, Math.floor(st)) : 0,
            price: Number(v.price) || 0,
            image: (Array.isArray(v.images) && v.images[0]) || p.image || null,
            barcode: String(v.barcode || ''),
          });
        });
      } else {
        const st = Number(p.stock ?? p.stockQuantity ?? 0);
        items.push({
          productId: p.id,
          productName: String(p.name || 'Mahsulot'),
          variantId: '',
          variantIndex: 0,
          variantLabel: 'Asosiy',
          stock: Number.isFinite(st) ? Math.max(0, Math.floor(st)) : 0,
          price: Number(p.price) || 0,
          image: p.image || null,
          barcode: '',
        });
      }
    }

    const totalUnits = items.reduce((s, it) => s + (it.stock || 0), 0);
    const totalLines = items.length;
    const lowStockLines = items.filter(
      (it) => it.stock > 0 && it.stock <= LOW_STOCK_THRESHOLD,
    ).length;
    const outOfStockLines = items.filter((it) => it.stock <= 0).length;

    const summary = {
      totalLines,
      totalUnits,
      lowStockLines,
      outOfStockLines,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    };

    // Eski klientlar uchun `inventory` — mahsulot darajasida (ixcham)
    const inventoryLegacy = shopProducts.map((p: any) => ({
      id: p.id,
      name: p.name,
      stock: Array.isArray(p.variants) && p.variants.length > 0
        ? p.variants.reduce((acc: number, v: any) => acc + (Number(v.stock ?? v.stockQuantity) || 0), 0)
        : Number(p.stock ?? p.stockQuantity) || 0,
      price: p.price,
      category: p.category,
      image: p.image,
    }));

    return c.json({ success: true, items, summary, inventory: inventoryLegacy });
  } catch (error: any) {
    console.error('Get inventory error:', error);
    return c.json({ error: 'Ombor ma\'lumotlarini olishda xatolik' }, 500);
  }
});

// Update stock: variantli mahsulotda variantId yoki variantIndex; aks holda product.stock
app.put("/make-server-27d0d16c/seller/inventory/:id", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const product = await kv.get(`shop_product:${id}`);
    
    if (!product || !sellerShopIdsMatch(product.shopId, auth.shopId)) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const stockRaw = body.stock;
    const stock = Math.max(0, Math.floor(Number(stockRaw)));
    if (!Number.isFinite(stock)) {
      return c.json({ error: 'Miqdor noto\'g\'ri' }, 400);
    }

    const variantId =
      body.variantId != null && String(body.variantId).trim() !== ''
        ? String(body.variantId).trim()
        : null;
    const variantIndexRaw = body.variantIndex;
    const variantIndex =
      variantIndexRaw !== undefined && variantIndexRaw !== null
        ? Math.floor(Number(variantIndexRaw))
        : null;

    const variants = Array.isArray(product.variants) ? [...product.variants] : [];
    let updatedProduct: any;

    if (variants.length > 0) {
      let idx = -1;
      if (variantId) {
        idx = variants.findIndex((v: any) => String(v?.id ?? '') === variantId);
      }
      if (idx < 0 && variantIndex !== null && Number.isFinite(variantIndex)) {
        if (variantIndex >= 0 && variantIndex < variants.length) idx = variantIndex;
      }
      if (idx < 0) {
        return c.json(
          { error: 'Variant topilmadi — variantId yoki variantIndex yuboring' },
          400,
        );
      }
      const v = { ...variants[idx], stock };
      variants[idx] = v;
      updatedProduct = {
        ...product,
        variants,
        updatedAt: new Date().toISOString(),
      };
    } else {
      updatedProduct = {
        ...product,
        stock,
        updatedAt: new Date().toISOString(),
      };
    }

    await kv.set(`shop_product:${id}`, updatedProduct);

    return c.json({ 
      success: true, 
      product: updatedProduct, 
      message: 'Ombor yangilandi' 
    });
  } catch (error: any) {
    console.error('Update inventory error:', error);
    return c.json({ error: 'Omborni yangilashda xatolik' }, 500);
  }
});

// Get all products for a specific shop (public - for customers)
app.get("/make-server-27d0d16c/shops/:shopId/products", async (c) => {
  try {
    const shopId = c.req.param('shopId');
    const region = c.req.query('region');
    const district = c.req.query('district');
    
    console.log(`📍 Filter parameters - Region: ${region}, District: ${district}`);
    
    const products = await kv.getByPrefix('shop_product:');
    const shopProducts = products
      .filter((p: any) => {
        if (!p || p.deleted) return false;
        if (p.shopId !== shopId) return false;
        
        // Filter by region and district if provided
        if (region && p.region && p.region !== region) {
          console.log(`  ❌ Product ${p.id} filtered out - region mismatch: ${p.region} !== ${region}`);
          return false;
        }
        if (district && p.district && p.district !== district) {
          console.log(`  ❌ Product ${p.id} filtered out - district mismatch: ${p.district} !== ${district}`);
          return false;
        }
        
        return true;
      })
      .map((product: any) => {
        const { base, totalStock } = normalizeShopProductForPublicResponse(product);
        const firstVariant = base.variants?.[0];
        
        return {
          ...base,
          // Add flattened fields from first variant
          price: firstVariant?.price || 0,
          oldPrice: firstVariant?.oldPrice || null,
          image: firstVariant?.images?.[0] || null,
          stockQuantity: totalStock,
          variantsCount: base.variants?.length || 0,
          // Add display-ready fields
          category: base.category || 'Mahsulot',
          shopName: base.shopName || null, // Add shop name for display
          rating: 4.8, // Default rating - can be updated with real reviews later
          reviewCount: Math.floor(Math.random() * 500) + 100, // Random for demo
          isNew: base.createdAt && new Date(base.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // New if created in last 7 days
          isBestseller: false, // Can be updated based on sales data later
        };
      });

    console.log(`📦 Returning ${shopProducts.length} products for shop ${shopId} (region: ${region}, district: ${district})`);
    console.log('📦 Sample product:', shopProducts[0]);

    return c.json({ success: true, products: shopProducts });
  } catch (error: any) {
    console.error('Get shop products error:', error);
    return c.json({ error: 'Mahsulotlarni olishda xatolik' }, 500);
  }
});

// Upload product media (images/video) to R2
app.post("/make-server-27d0d16c/seller/upload-media", async (c) => {
  try {
    console.log('📤 ===== UPLOAD MEDIA START =====');
    console.log('📤 Request URL:', c.req.url);
    console.log('📤 Request headers:', Object.fromEntries(c.req.raw.headers.entries()));
    console.log('📤 Query params:', c.req.query());
    console.log('📤 Token from query:', c.req.query('token'));
    
    // Get FormData first to check for token
    const formData = await c.req.formData();
    const formDataToken = formData.get('token');
    console.log('📤 Token from FormData:', formDataToken ? `${(formDataToken as string).substring(0, 20)}...` : 'MISSING');
    
    // Manually inject token into context if found in FormData
    if (formDataToken && !c.req.query('token')) {
      console.log('⚡ Injecting FormData token into query params...');
      // Create a modified context with the token
      const originalQuery = c.req.query.bind(c.req);
      c.req.query = (key?: string) => {
        if (key === 'token') return formDataToken as string;
        return originalQuery(key);
      };
    }
    
    const auth = await validateSellerSession(c);
    
    console.log('📤 Auth result:', JSON.stringify(auth, null, 2));
    
    if (!auth.success) {
      console.log('❌ Auth failed:', auth.error);
      return c.json({ code: 401, error: auth.error, message: auth.error }, 401);
    }

    // FormData already retrieved above
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('❌ No file found in FormData');
      return c.json({ code: 400, error: 'Fayl topilmadi', message: 'Fayl topilmadi' }, 400);
    }

    console.log('📤 File info:', { name: file.name, type: file.type, size: file.size });

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return c.json({ code: 400, error: 'Fayl hajmi 50MB dan kichik bo\'lishi kerak', message: 'Fayl juda katta' }, 400);
    }

    // Check if R2 is configured
    const r2Config = r2.checkR2Config();
    
    if (r2Config.configured) {
      // R2 CONFIGURED - Upload to R2
      console.log('📦 R2 configured, uploading to R2...');
      
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const fileExt = file.name.split('.').pop();
      const fileName = `shop-products/${auth.shopId}/${timestamp}-${randomStr}.${fileExt}`;

      console.log('📤 Generated filename:', fileName);

      const arrayBuffer = await file.arrayBuffer();
      const uploadResult = await r2.uploadFile(new Uint8Array(arrayBuffer), fileName, file.type);

      if (!uploadResult.success) {
        console.log('❌ R2 upload failed:', uploadResult.error);
        return c.json({ 
          code: 500,
          error: uploadResult.error || 'Faylni yuklashda xatolik',
          message: uploadResult.error || 'Faylni yuklashda xatolik'
        }, 500);
      }

      console.log('✅ Upload successful:', uploadResult.url);
      console.log('📤 ===== UPLOAD MEDIA END =====\n');

      return c.json({ 
        success: true, 
        url: uploadResult.url,
        message: 'Fayl muvaffaqiyatli yuklandi (R2)' 
      });
    } else {
      // R2 NOT CONFIGURED - Use base64 in KV store (TEMP solution)
      console.log('⚠️ R2 not configured, using base64 in KV store (TEMP)');
      
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);
      
      // Generate unique ID
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const fileId = `image-${timestamp}-${randomStr}`;
      
      // Store in KV
      const kvKey = `shop_image:${auth.shopId}:${fileId}`;
      await kv.set(kvKey, {
        id: fileId,
        shopId: auth.shopId,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        base64: base64,
        uploadedAt: Date.now(),
      });
      
      // Return data URL
      const dataUrl = `data:${file.type};base64,${base64}`;
      
      console.log('✅ Upload successful (base64, temp)');
      console.log('📤 ===== UPLOAD MEDIA END =====\n');
      
      return c.json({ 
        success: true, 
        url: dataUrl,
        message: 'Fayl muvaffaqiyatli yuklandi (TEMP - base64)',
        warning: 'R2 sozlanmagan, rasmlar base64 formatda saqlanmoqda'
      });
    }
  } catch (error: any) {
    console.error('❌ Upload media error:', error);
    console.error('❌ Error stack:', error.stack);
    return c.json({ 
      code: 500,
      error: `Faylni yuklashda xatolik: ${error.message}`,
      message: error.message || 'Xatolik yuz berdi',
      details: error.stack
    }, 500);
  }
});

// ========== TELEGRAM NOTIFICATION ENDPOINT ==========
app.post("/make-server-27d0d16c/send-order-notification", async (c) => {
  try {
    const body = await c.req.json();
    
    console.log('📱 Telegram notification request:', body);
    
    // Check if shopChatId is provided
    if (!body.shopChatId) {
      console.log('⚠️ No Telegram chat ID provided, skipping notification');
      return c.json({ 
        success: false, 
        message: 'Telegram chat ID ko\'rsatilmagan. Do\'kon sozlamalarida Telegram chat ID ni qo\'shing.' 
      });
    }
    
    // Validate chat ID format (should be numeric)
    if (!/^-?\d+$/.test(body.shopChatId)) {
      console.log('⚠️ Invalid Telegram chat ID format:', body.shopChatId);
      return c.json({ 
        success: false, 
        message: 'Telegram chat ID formati noto\'g\'ri. Faqat raqamlardan iborat bo\'lishi kerak.' 
      });
    }
    
    const notification = {
      shopName: body.shopName || 'Do\'kon',
      shopChatId: body.shopChatId,
      orderNumber: body.orderNumber || '',
      customerName: body.customerName || 'Mijoz',
      customerPhone: body.customerPhone || '',
      customerAddress: body.customerAddress || '',
      items: body.items || [],
      totalAmount: body.totalAmount || 0,
      deliveryMethod: body.deliveryMethod || '',
      paymentMethod: body.paymentMethod || '',
      orderDate: body.orderDate || new Date().toLocaleString('uz-UZ'),
    };
    
    // Send notification via Telegram
    const result = await telegram.sendOrderNotification(notification);
    
    if (result) {
      console.log('✅ Telegram notification sent successfully');
      return c.json({ 
        success: true, 
        message: 'Telegram bildirishnoma yuborildi' 
      });
    } else {
      console.log('⚠️ Telegram notification failed - check bot token and chat ID');
      return c.json({ 
        success: false, 
        message: 'Telegram bildirishnoma yuborilmadi. Bot token va chat ID ni tekshiring.' 
      });
    }
  } catch (error: any) {
    console.error('❌ Send notification error:', error);
    return c.json({ 
      success: false,
      error: error.message || 'Xatolik yuz berdi'
    }, 500);
  }
});

// ========== HELPER: RETRY LOGIC FOR DATABASE OPERATIONS ==========
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.log(`❌ Attempt ${attempt}/${maxRetries} failed:`, error.message?.substring(0, 100));
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      }
    }
  }
  
  throw lastError;
}

// ==================== ADMIN auth / security / 2FA (mount BEFORE /make-server-27d0d16c catch-all routers) ====================
app.route('/make-server-27d0d16c/admin/auth', adminAuthApp);
app.route('/make-server-27d0d16c/admin/security', adminSecurityApp);
app.route('/make-server-27d0d16c/admin/2fa', admin2faApp);

// ==================== RESTAURANT ROUTES ====================
app.route('/make-server-27d0d16c', restaurantRoutes);

// ==================== RENTAL ROUTES ====================
app.route('/make-server-27d0d16c/rentals', rentalRoutes);

// ==================== AUCTION ROUTES ====================
app.route('/make-server-27d0d16c', auctionRoutes);

// ==================== BONUS ROUTES ====================
app.route('/make-server-27d0d16c', bonusRoutes);

// ==================== BANNER ROUTES ====================
app.route('/make-server-27d0d16c', bannerRoutes);

// ==================== PREPARERS ROUTES ====================
app.route('/make-server-27d0d16c/preparers', preparersRoutes);

// ==================== 2FA ROUTES ====================
app.route('/make-server-27d0d16c/2fa', twoFactorRoutes);

// ==================== CLICK PAYMENT ROUTES ====================
app.route('/make-server-27d0d16c/click', clickRoutes);

// ==================== RELATIONAL POSTGRES ROUTES ====================
app.route('/make-server-27d0d16c', relationalRoutes);

// ==================== PAYME PAYMENT ROUTES ====================

// Create Payme receipt (underscore alias — ba’zi klientlar /payme/create_receipt chaqiradi)
const paymeCreateReceiptHandler = async (c: Context) => {
  try {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return c.json({ error: "JSON body majburiy" }, 400);
    }
    logPaymeHttp("POST /payme/create-receipt", body);

    const { amount, orderId, items, phone, returnUrl } = body as {
      amount?: unknown;
      orderId?: unknown;
      items?: unknown;
      phone?: unknown;
      returnUrl?: unknown;
    };

    console.log('💳 Creating Payme receipt:', { amount, orderId, itemsCount: Array.isArray(items) ? items.length : 0, phone });

    if (!amount || !orderId) {
      return c.json({ error: 'Amount va orderId majburiy' }, 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'Items (mahsulotlar ro\'yxati) majburiy' }, 400);
    }

    const itemsTiyin = sumItemsTiyinForPaycom(items as PaymeReceiptItem[]);
    const clientTiyin = Math.round(Number(amount) * 100);
    if (!Number.isFinite(clientTiyin) || clientTiyin <= 0) {
      return c.json({ error: "Noto‘g‘ri amount" }, 400);
    }
    if (!Number.isFinite(itemsTiyin) || itemsTiyin <= 0) {
      return c.json({ error: "Mahsulotlar summasi 0 yoki noto‘g‘ri" }, 400);
    }
    if (Math.abs(itemsTiyin - clientTiyin) > 2) {
      return c.json(
        {
          error:
            "So‘m va savat qatorlari yig‘indisi mos emas. Sahifani yangilab qayta urinib ko‘ring (Paycom checkout «чек не найден» sababi bo‘lishi mumkin).",
          code: "PAYCOM_AMOUNT_LINES_MISMATCH",
          clientTiyin,
          itemsTiyin,
        },
        400,
      );
    }

    await kv.set(paymeCheckoutOrderKvKey(String(orderId)), {
      state: "pending_receipt",
      orderId: String(orderId),
      amountTiyin: itemsTiyin,
      updatedAt: new Date().toISOString(),
    });

    const paymeConfig = await kv.get('payment_method:payme');
    const resolvedTest = resolvePaycomUseTestForPayme(paymeConfig);
    const checkoutBackUrl = parsePaycomHttpsBackUrl(returnUrl);

    console.log('💳 Paycom create-receipt:', resolvedTest ? 'TEST (checkout.test.paycom.uz)' : 'PROD (checkout.paycom.uz)');

    if (!isPaymeConfiguredForMode(resolvedTest, null)) {
      return c.json(
        {
          error: resolvedTest
            ? 'Paycom TEST: Supabase Secrets — PAYCOM_REGISTER_ID va PAYCOM_SECRET_TEST.'
            : 'Paycom PROD: Supabase Secrets — PAYCOM_REGISTER_ID va PAYCOM_SECRET_PROD.',
          code: 'PAYCOM_ENV_MISSING',
        },
        503,
      );
    }

    const paycomCallOpts = {
      useTest: resolvedTest,
    };
    const idem = await resolvePaycomCreateIdempotency(String(orderId), items, paycomCallOpts);
    if (idem.action === "already_paid") {
      await kv.set(paymeCheckoutOrderKvKey(String(orderId)), {
        state: "paid",
        orderId: String(orderId),
        receiptId: idem.receiptId,
        updatedAt: new Date().toISOString(),
      });
      return c.json(
        {
          error:
            "Bu buyurtma (orderId) bo‘yicha chek allaqachon to‘langan. Yangi chek ochilmaydi.",
          code: "PAYCOM_ORDER_ALREADY_PAID",
          receiptId: idem.receiptId,
        },
        409,
      );
    }
    if (idem.action === "reuse") {
      const r = idem.record;
      const freshCheckoutUrl = buildPaycomCheckoutLink(r.receiptId, resolvedTest, {
        useTest: resolvedTest,
        checkoutBackUrl,
      });
      await kv.set(`paycom_receipt:${r.receiptId}`, {
        orderId: String(orderId),
        useTest: resolvedTest,
      });
      await savePaycomOrderPending({
        ...r,
        checkoutUrl: freshCheckoutUrl,
      });
      await kv.set(paymeCheckoutOrderKvKey(String(orderId)), {
        state: "receipt_created",
        orderId: String(orderId),
        receiptId: r.receiptId,
        amountTiyin: itemsTiyin,
        paycomEnvironment: resolvedTest ? "test" : "prod",
        idempotentReused: true,
        updatedAt: new Date().toISOString(),
      });
      console.log("[paycom] idempotent reuse", { orderId, receiptId: r.receiptId });
      return c.json({
        success: true,
        receiptId: r.receiptId,
        checkoutUrl: freshCheckoutUrl,
        paycomEnvironment: resolvedTest ? "test" : "prod",
        idempotentReused: true,
      });
    }

    const result = await paymeCreateReceipt(amount, orderId, items, phone, undefined, {
      useTest: resolvedTest,
      checkoutBackUrl,
    });

    if (!result.success) {
      return c.json({ error: result.error || 'Chek yaratishda xatolik' }, 400);
    }

    if (result.receiptId) {
      await kv.set(`paycom_receipt:${result.receiptId}`, {
        orderId: String(orderId),
        useTest: resolvedTest,
      });
      const amountTiyin = sumItemsTiyinForPaycom(items);
      await savePaycomOrderPending({
        receiptId: result.receiptId,
        checkoutUrl: result.checkoutUrl,
        amountTiyin,
        useTest: resolvedTest,
        createdAt: new Date().toISOString(),
        orderId: String(orderId),
      });
      await kv.set(paymeCheckoutOrderKvKey(String(orderId)), {
        state: "receipt_created",
        orderId: String(orderId),
        receiptId: result.receiptId,
        amountTiyin,
        paycomEnvironment: resolvedTest ? "test" : "prod",
        updatedAt: new Date().toISOString(),
      });
    }

    const rec = result.receipt as { state?: number } | undefined;
    console.log("RECEIPT_CREATE:", {
      receiptId: result.receiptId,
      accountOrderId: String(orderId),
      paycomEnvironment: resolvedTest ? "test" : "prod",
      receiptState: typeof rec?.state === "number" ? rec.state : undefined,
    });
    console.log("CHECKOUT_URL:", result.checkoutUrl);
    return c.json({
      success: true,
      receiptId: result.receiptId,
      checkoutUrl: result.checkoutUrl,
      /** test = checkout.test.paycom.uz — payme.uz prod bilan aralashmasin */
      paycomEnvironment: resolvedTest ? 'test' : 'prod',
      receiptState: typeof rec?.state === 'number' ? rec.state : undefined,
    });
  } catch (error: any) {
    console.error('Create receipt error:', error);
    return c.json({ error: `Chek yaratishda xatolik: ${error.message}` }, 500);
  }
};

app.post('/make-server-27d0d16c/payme/create-receipt', paymeCreateReceiptHandler);
app.post('/make-server-27d0d16c/payme/create_receipt', paymeCreateReceiptHandler);

// Check Payme receipt status
app.post('/make-server-27d0d16c/payme/check-receipt', async (c) => {
  try {
    let body: { receiptId?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "So‘rov tanasi JSON emas" }, 400);
    }
    const receiptIdRaw = body?.receiptId;
    const receiptId = receiptIdRaw != null ? String(receiptIdRaw).trim() : "";

    console.log("💳 Checking Payme receipt:", receiptId);

    if (!receiptId) {
      return c.json({ error: "ReceiptId majburiy" }, 400);
    }

    const paycomOpts = await paycomCallOptsForReceiptIdWithKv(receiptId);
    const result = await paymeCheckReceipt(receiptId, paycomOpts);

    if (!result.success) {
      return c.json({ error: result.error || "Chek tekshirishda xatolik" }, 400);
    }

    /** KV (Supabase jadval) xatosi Paycom natijasini «500» qilmasin — to‘lov holati baribir qaytadi */
    const applyPaidOrCancelledKv = async (kind: "paid" | "cancelled") => {
      try {
        const meta = (await kv.get(`paycom_receipt:${receiptId}`)) as
          | { orderId?: string }
          | null;
        if (!meta?.orderId) return;
        const oid = String(meta.orderId);
        await clearPaycomOrderPending(oid);
        await kv.set(paymeCheckoutOrderKvKey(oid), {
          state: kind,
          orderId: oid,
          receiptId,
          updatedAt: new Date().toISOString(),
        });
      } catch (kvErr: unknown) {
        console.error(`[payme/check-receipt] KV (${kind}) yangilanmadi:`, kvErr);
      }
    };

    if (result.isPaid) {
      await applyPaidOrCancelledKv("paid");
      try {
        const paidMeta = (await kv.get(`paycom_receipt:${receiptId}`)) as
          | { orderId?: string }
          | null;
        if (paidMeta?.orderId) {
          await markKvOrderPaidFromGateway(String(paidMeta.orderId), {
            paymeReceiptId: receiptId,
          });
        }
      } catch (paidKvErr: unknown) {
        console.error('[payme/check-receipt] buyurtma to‘langan deb yangilanmadi:', paidKvErr);
      }
    }
    if (result.isCancelled) {
      await applyPaidOrCancelledKv("cancelled");
    }

    console.log("[payme/http] POST /payme/check-receipt", {
      receiptIdTail: receiptId.slice(-8),
      isPaid: result.isPaid,
      state: result.state,
    });

    return c.json({
      success: true,
      isPaid: result.isPaid,
      isCancelled: result.isCancelled,
      state: result.state,
      receipt: result.receipt,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Check receipt error:", error);
    return c.json({ error: `Chek tekshirishda xatolik: ${msg}` }, 500);
  }
});

// Get Payme receipt
app.post('/make-server-27d0d16c/payme/get-receipt', async (c) => {
  try {
    const { receiptId } = await c.req.json();
    
    if (!receiptId) {
      return c.json({ error: 'ReceiptId majburiy' }, 400);
    }
    
    const paycomOpts = await paycomCallOptsForReceiptIdWithKv(String(receiptId));
    const result = await paymeGetReceipt(receiptId, paycomOpts);

    if (!result.success) {
      return c.json({ error: result.error || 'Chek olishda xatolik' }, 400);
    }
    
    return c.json({
      success: true,
      receipt: result.receipt,
    });
  } catch (error: any) {
    console.error('Get receipt error:', error);
    return c.json({ error: `Chek olishda xatolik: ${error.message}` }, 500);
  }
});

// Cancel Payme receipt
app.post('/make-server-27d0d16c/payme/cancel-receipt', async (c) => {
  try {
    const { receiptId } = await c.req.json();
    
    if (!receiptId) {
      return c.json({ error: 'ReceiptId majburiy' }, 400);
    }

    const paycomOpts = await paycomCallOptsForReceiptIdWithKv(String(receiptId));
    const result = await paymeCancelReceipt(receiptId, paycomOpts);
    
    if (!result.success) {
      return c.json({ error: result.error || 'Chek bekor qilishda xatolik' }, 400);
    }
    
    return c.json({
      success: true,
      message: 'Chek bekor qilindi',
    });
  } catch (error: any) {
    console.error('Cancel receipt error:', error);
    return c.json({ error: `Chek bekor qilishda xatolik: ${error.message}` }, 500);
  }
});

// Payme: SMS invoice — receipts.send
app.post('/make-server-27d0d16c/payme/send-receipt', async (c) => {
  try {
    const { receiptId, phone } = await c.req.json();

    if (!receiptId || !phone) {
      return c.json({ error: 'receiptId va phone majburiy' }, 400);
    }

    const paycomOpts = await paycomCallOptsForReceiptIdWithKv(String(receiptId));
    if (!isPaymeConfiguredForMode(paycomOpts.useTest, null)) {
      return c.json({ error: 'Paycom sozlanmagan (shu chek uchun kerak bo‘lgan muhit kaliti)' }, 503);
    }

    const result = await paymeSendReceipt(String(receiptId), String(phone), paycomOpts);

    if (!result.success) {
      return c.json({ error: result.error || 'SMS yuborilmadi' }, 400);
    }

    return c.json({ success: true, sent: result.sent !== false });
  } catch (error: any) {
    console.error('Send receipt error:', error);
    return c.json({ error: `SMS yuborishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== ATMOS PAYMENT ROUTES ====================

// Create Atmos transaction
app.post('/make-server-27d0d16c/atmos/create-transaction', async (c) => {
  try {
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'JSON body kutilmoqda', code: 'BAD_BODY' }, 400);
    }

    const amountRaw = body.amount;
    const orderId = body.orderId;
    const customerPhone = body.customerPhone;
    const customerName = body.customerName;

    const amountNum = Number(amountRaw);
    const oid = String(orderId ?? '').trim();
    const phone = String(customerPhone ?? '').trim();

    console.log('💳 Creating Atmos transaction:', {
      amount: amountNum,
      orderId: oid,
      customerPhone: phone,
      customerName,
    });

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return c.json(
        { error: `Noto‘g‘ri summa: ${String(amountRaw)}`, code: 'INVALID_AMOUNT' },
        400,
      );
    }
    if (!oid) {
      return c.json({ error: 'orderId majburiy', code: 'INVALID_ORDER' }, 400);
    }
    if (!phone) {
      return c.json({ error: 'Telefon (customerPhone) majburiy', code: 'INVALID_PHONE' }, 400);
    }

    const atmosRow = await kv.get('payment_method:atmos');
    if (atmosRow && atmosRow.enabled === false) {
      return c.json({ error: 'Atmos to\'lov usuli faol emas', code: 'ATMOS_DISABLED' }, 400);
    }
    
    if (!atmos.isAtmosConfigured(atmosRow ?? null)) {
      return c.json(
        {
          error:
            'Atmos sozlanmagan: Supabase Secrets (ATMOS_STORE_ID, ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET) yoki admin → Atmos maydonlari',
          code: 'ATMOS_NOT_CONFIGURED',
        },
        503,
      );
    }
    
    const result = await atmos.createTransaction(
      amountNum,
      oid,
      phone,
      typeof customerName === 'string' ? customerName : undefined,
      atmosRow ?? null,
    );
    
    if (!result.success) {
      return c.json(
        {
          error: result.error || 'Tranzaksiya yaratishda xatolik',
          code: 'ATMOS_UPSTREAM',
        },
        400,
      );
    }
    
    return c.json({
      success: true,
      transactionId: result.transactionId,
      redirectUrl: result.redirectUrl,
      status: result.status,
    });
  } catch (error: any) {
    console.error('Create Atmos transaction error:', error);
    return c.json({ error: `Tranzaksiya yaratishda xatolik: ${error.message}` }, 500);
  }
});

// Check Atmos transaction status
app.post('/make-server-27d0d16c/atmos/check-transaction', async (c) => {
  try {
    const { transactionId } = await c.req.json();
    
    console.log('💳 Checking Atmos transaction:', transactionId);
    
    if (!transactionId) {
      return c.json({ error: 'TransactionId majburiy' }, 400);
    }

    const atmosRow = await kv.get('payment_method:atmos');
    const result = await atmos.checkTransaction(transactionId, atmosRow ?? null);
    
    if (!result.success) {
      return c.json({ error: result.error || 'Tranzaksiya holatini olishda xatolik' }, 400);
    }
    
    return c.json({
      success: true,
      transaction: result.transaction,
      status: result.status,
      isPaid: result.isPaid,
      isApproved: result.isApproved,
      isRejected: result.isRejected,
    });
  } catch (error: any) {
    console.error('Check Atmos transaction error:', error);
    return c.json({ error: `Tranzaksiya holatini olishda xatolik: ${error.message}` }, 500);
  }
});

// Cancel Atmos transaction
app.post('/make-server-27d0d16c/atmos/cancel-transaction', async (c) => {
  try {
    const { transactionId } = await c.req.json();
    
    if (!transactionId) {
      return c.json({ error: 'TransactionId majburiy' }, 400);
    }

    const atmosRow = await kv.get('payment_method:atmos');
    const result = await atmos.cancelTransaction(transactionId, atmosRow ?? null);
    
    if (!result.success) {
      return c.json({ error: result.error || 'Tranzaksiyani bekor qilishda xatolik' }, 400);
    }
    
    return c.json({
      success: true,
      message: 'Tranzaksiya bekor qilindi',
    });
  } catch (error: any) {
    console.error('Cancel Atmos transaction error:', error);
    return c.json({ error: `Tranzaksiyani bekor qilishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== TELEGRAM TEST ROUTE ====================
app.post('/make-server-27d0d16c/telegram/test', async (c) => {
  try {
    const { chatId, type } = await c.req.json();
    
    if (!chatId) {
      return c.json({ success: false, error: 'Chat ID majburiy' }, 400);
    }

    // Use correct bot token based on type
    const botToken = type === 'restaurant' 
      ? Deno.env.get('TELEGRAM_RESTAURANT_BOT_TOKEN')
      : Deno.env.get('TELEGRAM_BOT_TOKEN');
      
    if (!botToken) {
      return c.json({ 
        success: false, 
        error: `${type === 'restaurant' ? 'Restoran' : 'Do\'kon'} bot token sozlanmagan` 
      }, 500);
    }

    // Create test message based on type
    let message = '';
    if (type === 'restaurant') {
      message = `✅ <b>RESTORAN TEST XABARI</b>

Tabriklaymiz! Telegram bildirishnomalar to'g'ri sozlandi.

Yangi buyurtmalar kelganda sizga shunga o'xshash xabar yuboriladi:

🍕 Taom buyurtmalari
👤 Mijoz ma'lumotlari
💰 To'lov summasi
📍 Yetkazish manzili

📱 Chat ID: ${chatId}
🤖 Bot: Restoran Bot (Faol)`;
    } else {
      message = `✅ <b>DO'KON TEST XABARI</b>

Tabriklaymiz! Telegram bildirishnomalar to'g'ri sozlandi.

Yangi buyurtmalar kelganda sizga shunga o'xshash xabar yuboriladi:

🛍️ Mahsulot buyurtmalari
👤 Mijoz ma'lumotlari
💰 To'lov summasi
📍 Yetkazish manzili

📱 Chat ID: ${chatId}
🤖 Bot: Do'kon Bot (Faol)`;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return c.json({ 
        success: false, 
        error: error.description || 'Xabar yuborishda xatolik' 
      }, 400);
    }

    return c.json({ 
      success: true, 
      message: 'Test xabari yuborildi! Telegram botingizni tekshiring.' 
    });
  } catch (error: any) {
    console.error('Telegram test error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== CHATS ROUTES ====================

const CHAT_KEY_PREFIX = 'chat:';
const CHAT_MESSAGE_KEY_PREFIX = 'chat_message:';
/** Mijozlar support yozishi uchun maxsus “filial” id (buyurtmasiz ham chat bo‘lishi uchun). Filial panelida shu branchId bilan suhbatlarni ko‘rish mumkin. */
const USER_SUPPORT_BRANCH_ID = 'aresso_support';

const normalizeKVValueChat = (v: any) => {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
};

const sanitizeForChatId = (value: string) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');

const buildChatId = (branchId: string, participantType: string, participantId: string) =>
  `chat_${sanitizeForChatId(branchId)}_${sanitizeForChatId(participantType)}_${sanitizeForChatId(participantId)}`;

const mapMessageStatusToUI = (raw: any): string => {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'sent') return 'sent';
  if (s === 'delivered') return 'delivered';
  if (s === 'read') return 'read';
  if (s === 'failed' || s === 'error') return 'failed';
  return 'sent';
};

/** chat_${branch}_customer_${userId} dan mijoz userId */
function parseCustomerIdFromChatId(chatId: string): string | null {
  const marker = '_customer_';
  const s = String(chatId || '');
  const i = s.lastIndexOf(marker);
  if (i < 0) return null;
  const id = s.slice(i + marker.length).trim();
  return id || null;
}

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPushBatch(
  items: {
    to: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    sound?: string;
    channelId?: string;
    /** Android: uxlab/yopiq ilovada tezroq yetkazish (FCM high priority) */
    priority?: 'default' | 'normal' | 'high';
  }[],
) {
  if (!items.length) return;
  try {
    const payload = items.map((item) => ({
      ...item,
      priority: item.priority ?? 'high',
    }));
    const res = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Expo push HTTP error', res.status, j);
    }
  } catch (e) {
    console.error('Expo push fetch error', e);
  }
}

async function notifyUserExpoPush(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  const key = `expo_push_tokens:${String(userId).trim()}`;
  const raw = await kv.get(key);
  let tokens: string[] = [];
  if (Array.isArray(raw)) {
    tokens = raw.filter((t: any) => typeof t === 'string' && t.startsWith('ExponentPushToken'));
  } else if (typeof raw === 'string' && raw.startsWith('ExponentPushToken')) {
    tokens = [raw];
  }
  tokens = [...new Set(tokens)];
  if (!tokens.length) return;
  const shortBody = body.length > 200 ? `${body.slice(0, 197)}...` : body;
  await sendExpoPushBatch(
    tokens.map((to) => ({
      to,
      title,
      body: shortBody,
      data,
      sound: 'default',
      channelId: 'default',
    })),
  );
}

function normalizePhoneDigitsForPush(phone: string): string {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 9) return `998${d}`;
  if (d.startsWith('998')) return d;
  return d;
}

async function resolveUserIdFromRentalCustomer(order: any): Promise<string | null> {
  const direct = String(order?.customerUserId || '').trim();
  if (direct) return direct;
  const pk = normalizePhoneDigitsForPush(String(order?.customerPhone || ''));
  if (pk.length < 9) return null;
  const row = await kv.get(`user_phone:${pk}`);
  if (row && (row as any).userId) return String((row as any).userId);
  return null;
}

function hoursSinceIso(iso: string | undefined | null, now: number): number {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 9999;
  return (now - t) / 3600000;
}

/** Cron / tashqi chaqiriq: haftalik-oylik ijara to‘lovi muddati yaqin yoki o‘tgan bo‘lsa push */
async function runRentalPaymentDuePushes() {
  const rows = await kv.getByPrefixWithKeys('rental_order_');
  const now = Date.now();
  const HOUR = 3600000;
  const DAY = 24 * HOUR;

  for (const { key, value: order } of rows) {
    if (!order || typeof order !== 'object') continue;
    const st = String((order as any).status || '').toLowerCase();
    if (st !== 'active' && st !== 'extended') continue;
    const sched = String((order as any).paymentSchedule || '').toLowerCase();
    if (sched !== 'weekly' && sched !== 'monthly') continue;
    const dueRaw = (order as any).nextPaymentDue;
    if (!dueRaw) continue;
    const due = new Date(dueRaw).getTime();
    if (Number.isNaN(due)) continue;

    const userId = await resolveUserIdFromRentalCustomer(order);
    if (!userId) continue;

    const msLeft = due - now;
    const p = { ...((order as any).paymentPushTimestamps || {}) };
    const isoNow = new Date().toISOString();
    const productLabel = String((order as any).productName || 'Ijara').slice(0, 42);

    let title = '';
    let body = '';
    let kind = '';

    if (msLeft <= 0) {
      if (hoursSinceIso(p.overdue, now) < 36) continue;
      kind = 'overdue';
      title = 'Ijara to‘lovi';
      body = `«${productLabel}» — to‘lov muddati o‘tgan. Filial bilan bog‘laning.`;
      p.overdue = isoNow;
    } else if (msLeft <= DAY) {
      if (hoursSinceIso(p.within24h, now) < 12) continue;
      kind = 'within24h';
      title = 'Ijara to‘lovi yaqin';
      const h = Math.max(1, Math.round(msLeft / HOUR));
      body = `«${productLabel}» — keyingi to‘lovgacha taxminan ${h} soat qoldi.`;
      p.within24h = isoNow;
    } else if (msLeft <= 3 * DAY) {
      if (hoursSinceIso(p.within72h, now) < 24) continue;
      kind = 'within72h';
      title = 'Ijara to‘lovi eslatma';
      const d = Math.max(1, Math.ceil(msLeft / DAY));
      body = `«${productLabel}» — keyingi to‘lovgacha taxminan ${d} kun qoldi.`;
      p.within72h = isoNow;
    } else {
      continue;
    }

    await notifyUserExpoPush(userId, title, body, {
      type: 'rental_payment_due',
      kind,
      rentalOrderId: String((order as any).id || ''),
      branchId: String((order as any).branchId || ''),
    });

    (order as any).paymentPushTimestamps = p;
    (order as any).updatedAt = isoNow;
    await kv.set(key, order);
  }
}

// List chats for a branch
app.get("/make-server-27d0d16c/chats", async (c) => {
  try {
    const branchId = String(c.req.query('branchId') || '').trim();
    const searchTerm = String(c.req.query('search') || '').trim().toLowerCase();
    const filter = String(c.req.query('filter') || 'all').trim(); // all, unread, starred, archived

    if (!branchId) return c.json({ error: 'branchId kerak' }, 400);

    // 1) KV'dagi real chats
    let chatsRaw: any[] = (await kv.getByPrefix(CHAT_KEY_PREFIX))
      .map(normalizeKVValueChat)
      .filter(Boolean)
      .filter((chat: any) => String(chat.branchId || '') === branchId);

    // 2) Agar real chats bo'lmasa: branchdagi orderlardan customer chatlarini "bootstrap" qilamiz va KV'ga saqlaymiz.
    if (chatsRaw.length === 0) {
      const ordersRaw = await kv.getByPrefix('order:');
      const orderItems = (ordersRaw || []).map(normalizeKVValueChat).filter(Boolean);
      const branchOrders = orderItems.filter((o: any) => String(o.branchId || '') === branchId);

      const chatMap = new Map<string, any>();

      for (const o of branchOrders) {
        const participantType = 'customer';
        const participantId = String(o.userId || o.customerId || '');
        if (!participantId) continue;

        const chatId = buildChatId(branchId, participantType, participantId);
        if (chatMap.has(chatId)) continue;

        const statusHistory = Array.isArray(o.statusHistory) ? o.statusHistory : [];
        const lastHist = statusHistory.length ? statusHistory[statusHistory.length - 1] : null;
        const lastContent =
          String(lastHist?.note || lastHist?.status || o.status || 'Buyurtma bo\'limi') || 'Buyurtma bo\'limi';
        const ts = o.updatedAt || o.createdAt || new Date().toISOString();

        chatMap.set(chatId, {
          id: chatId,
          branchId,
          participantId,
          participantType,
          participantName: String(o.customerName || 'Mijoz'),
          lastMessage: {
            content: lastContent,
            timestamp: new Date(ts).toISOString(),
            senderName: 'Filial',
            isOwn: true,
          },
          unreadCount: 0,
          isOnline: false,
          isTyping: false,
          isArchived: false,
          isStarred: false,
          createdAt: String(o.createdAt || ts),
          updatedAt: String(ts),
        });
      }

      chatsRaw = Array.from(chatMap.values());
      // Persist so' star/archive qilsa ham ishlaydi
      for (const chat of chatsRaw) {
        await kv.set(`${CHAT_KEY_PREFIX}${chat.id}`, chat);
      }
    }

    // filter/search
    let resultChats = chatsRaw;
    if (searchTerm) {
      resultChats = resultChats.filter((ch: any) => {
        const haystack = `${ch.participantName || ''} ${ch.lastMessage?.content || ''}`.toLowerCase();
        return haystack.includes(searchTerm);
      });
    }

    if (filter === 'unread') resultChats = resultChats.filter((ch: any) => Number(ch.unreadCount || 0) > 0);
    if (filter === 'starred') resultChats = resultChats.filter((ch: any) => Boolean(ch.isStarred));
    if (filter === 'archived') resultChats = resultChats.filter((ch: any) => Boolean(ch.isArchived));

    resultChats.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    return c.json({ success: true, chats: resultChats });
  } catch (error: any) {
    console.error('Chats list error:', error);
    return c.json({ error: 'Suhbatlarni olishda xatolik' }, 500);
  }
});

// ==================== USER ↔ BRANCH ORDER CHAT (CUSTOMER VIEW) ====================
// List chats for the authenticated user (across branches where user has orders)
// function declaration so GET /user/:userId can delegate userId === "chats" before KV lookup
async function userChatsHandler(c: any) {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ error: auth.error }, 401);
    }

    const userId = String(auth.userId).trim();
    const userProfile = await kv.get(`user:${userId}`);

    const ordersRaw = await kv.getByPrefix('order:');
    const myOrders = (ordersRaw || []).filter((o: any) => o && String(o.userId || '') === userId && !o.deleted);

    const branchIds = Array.from(
      new Set(myOrders.map((o: any) => String(o.branchId || '').trim()).filter(Boolean)),
    ).filter((id) => id !== USER_SUPPORT_BRANCH_ID);

    const chats: any[] = [];
    for (const branchId of branchIds) {
      const chatId = buildChatId(branchId, 'customer', userId);
      const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
      const existing = normalizeKVValueChat(await kv.get(chatKey));

      const nowIso = new Date().toISOString();
      const chat =
        existing ||
        ({
          id: chatId,
          branchId,
          participantId: userId,
          participantType: 'customer',
          participantName: String(userProfile?.name || userProfile?.firstName || 'Mijoz'),
          lastMessage: {
            content: 'Suhbat boshlandi',
            timestamp: nowIso,
            senderName: 'Tizim',
            isOwn: false,
          },
          unreadCount: 0,
          isOnline: false,
          isTyping: false,
          isArchived: false,
          isStarred: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        } as any);

      if (!existing) {
        await kv.set(chatKey, chat);
      }

      chats.push(chat);
    }

    const supportChatId = buildChatId(USER_SUPPORT_BRANCH_ID, 'customer', userId);
    const supportKey = `${CHAT_KEY_PREFIX}${supportChatId}`;
    const supportExisting = normalizeKVValueChat(await kv.get(supportKey));
    const nowIsoSupport = new Date().toISOString();
    const displayName = String(userProfile?.name || userProfile?.firstName || 'Mijoz');
    const supportChat =
      supportExisting ||
      ({
        id: supportChatId,
        branchId: USER_SUPPORT_BRANCH_ID,
        participantId: userId,
        participantType: 'customer',
        participantName: displayName,
        lastMessage: {
          content: 'Savolingizni yozing — operator tez orada javob beradi.',
          timestamp: nowIsoSupport,
          senderName: 'Aresso support',
          isOwn: false,
        },
        unreadCount: 0,
        isOnline: false,
        isTyping: false,
        isArchived: false,
        isStarred: false,
        createdAt: nowIsoSupport,
        updatedAt: nowIsoSupport,
      } as any);

    if (!supportExisting) {
      await kv.set(supportKey, supportChat);
    }

    chats.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    const ordered = [supportChat, ...chats.filter((c: any) => String(c?.id || '') !== supportChatId)];
    return c.json({ success: true, chats: ordered });
  } catch (error: any) {
    console.error('User chats list error:', error);
    return c.json({ error: 'Suhbatlarni olishda xatolik' }, 500);
  }
}

// NOTE: Some clients call without the "/make-server-27d0d16c" prefix.
app.get("/make-server-27d0d16c/user/chats", userChatsHandler);
app.get("/user/chats", userChatsHandler);

const assertUserOwnsChat = (chatId: string, userId: string) => {
  const safeUser = sanitizeForChatId(userId);
  return String(chatId || '').endsWith(`_${safeUser}`);
};

// List messages in a user chat (must belong to the authenticated user)
const userChatMessagesListHandler = async (c: any) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ error: auth.error }, 401);
    }

    const chatId = c.req.param('chatId');
    if (!chatId) return c.json({ error: 'chatId kerak' }, 400);
    if (!assertUserOwnsChat(chatId, String(auth.userId))) {
      return c.json({ error: 'Ruxsat yo‘q' }, 403);
    }

    const prefix = `${CHAT_MESSAGE_KEY_PREFIX}${chatId}:`;
    const raw = await kv.getByPrefix(prefix);
    const messages = (raw || []).map(normalizeKVValueChat).filter(Boolean);
    messages.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const uiMessages = messages.map((m: any) => ({
      id: String(m.id || ''),
      chatId: String(m.chatId || chatId),
      senderId: String(m.senderId || ''),
      senderName: String(m.senderName || ''),
      content: String(m.content || ''),
      type: String(m.type || 'text'),
      imageCaption: m.imageCaption != null ? String(m.imageCaption) : '',
      timestamp: new Date(m.timestamp || Date.now()).toISOString(),
      status: mapMessageStatusToUI(m.status),
      isOwn: String(m.senderId || '') === String(auth.userId),
    }));

    return c.json({ success: true, messages: uiMessages });
  } catch (error: any) {
    console.error('User chat messages list error:', error);
    return c.json({ error: 'Xabarlarni olishda xatolik' }, 500);
  }
};

app.get("/make-server-27d0d16c/user/chats/:chatId/messages", userChatMessagesListHandler);
app.get("/user/chats/:chatId/messages", userChatMessagesListHandler);

const userChatUploadMediaHandler = async (c: any) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ error: auth.error }, 401);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'Fayl topilmadi' }, 400);
    }
    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'Faqat rasm fayli yuklash mumkin' }, 400);
    }
    if (file.size > 8 * 1024 * 1024) {
      return c.json({ error: 'Rasm hajmi 8MB dan oshmasligi kerak' }, 400);
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `support_chat/${auth.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const r2Config = r2.checkR2Config();
    if (!r2Config.configured) {
      return c.json({ error: r2Config.message }, 500);
    }

    const uploadResult = await r2.uploadFile(buffer, filename, file.type);
    if (!uploadResult.success) {
      return c.json({ error: uploadResult.error || 'Yuklashda xatolik' }, 500);
    }

    return c.json({
      success: true,
      url: uploadResult.url,
      contentType: file.type,
    });
  } catch (error: any) {
    console.error('User chat upload-media error:', error);
    return c.json({ error: error.message || 'Yuklashda xatolik' }, 500);
  }
};

app.post("/make-server-27d0d16c/user/chats/upload-media", userChatUploadMediaHandler);
app.post("/user/chats/upload-media", userChatUploadMediaHandler);

// Send a message from user to branch (chat must belong to user)
const userChatSendHandler = async (c: any) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ error: auth.error }, 401);
    }

    const chatId = c.req.param('chatId');
    if (!chatId) return c.json({ error: 'chatId kerak' }, 400);
    if (!assertUserOwnsChat(chatId, String(auth.userId))) {
      return c.json({ error: 'Ruxsat yo‘q' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const type = String(body?.type || 'text').trim() || 'text';
    const captionRaw = body?.caption != null ? String(body.caption).trim().slice(0, 500) : '';

    let content = String(body?.content || '').trim();
    let imageCaption = '';

    if (type === 'image') {
      if (!/^https?:\/\//i.test(content)) {
        return c.json({ error: 'Rasm uchun to‘liq https havola kerak' }, 400);
      }
      imageCaption = captionRaw;
    } else {
      if (!content) return c.json({ error: 'content kerak' }, 400);
    }

    const userId = String(auth.userId);
    const userProfile = await kv.get(`user:${userId}`);
    const senderName = String(userProfile?.name || userProfile?.firstName || 'Mijoz');

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();

    const message: Record<string, unknown> = {
      id: messageId,
      chatId,
      senderId: userId,
      senderName,
      content,
      type,
      timestamp: nowIso,
      status: 'sent',
      isOwn: true,
    };
    if (type === 'image' && imageCaption) {
      message.imageCaption = imageCaption;
    }

    await kv.set(`${CHAT_MESSAGE_KEY_PREFIX}${chatId}:${messageId}`, message);

    const lastPreview =
      type === 'image' ? (imageCaption ? `📷 ${imageCaption.slice(0, 80)}` : '📷 Rasm') : content;

    // Update chat lastMessage
    const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
    const existing = normalizeKVValueChat(await kv.get(chatKey));
    const updatedAt = nowIso;
    const updated = existing
      ? {
          ...existing,
          updatedAt,
          lastMessage: {
            content: lastPreview,
            timestamp: nowIso,
            senderName,
            isOwn: false,
          },
        }
      : {
          id: chatId,
          branchId: '',
          participantId: userId,
          participantType: 'customer',
          participantName: senderName,
          lastMessage: {
            content: lastPreview,
            timestamp: nowIso,
            senderName,
            isOwn: false,
          },
          unreadCount: 0,
          isOnline: false,
          isTyping: false,
          isArchived: false,
          isStarred: false,
          createdAt: updatedAt,
          updatedAt,
        };

    await kv.set(chatKey, updated);

    return c.json({ success: true, message });
  } catch (error: any) {
    console.error('User send chat message error:', error);
    return c.json({ error: 'Xabarni yuborishda xatolik' }, 500);
  }
};

app.post("/make-server-27d0d16c/user/chats/:chatId/messages", userChatSendHandler);
app.post("/user/chats/:chatId/messages", userChatSendHandler);

const userPushTokenHandler = async (c: any) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ error: auth.error }, 401);
    }
    const body = await c.req.json().catch(() => ({}));
    const token = String(body.expoPushToken || body.token || '').trim();
    if (!token.startsWith('ExponentPushToken')) {
      return c.json({ error: 'ExponentPushToken kerak' }, 400);
    }
    const userId = String(auth.userId).trim();
    const key = `expo_push_tokens:${userId}`;
    const raw = await kv.get(key);
    const prev: string[] = Array.isArray(raw)
      ? raw.filter((x: any) => typeof x === 'string' && x.startsWith('ExponentPushToken'))
      : [];
    if (!prev.includes(token)) prev.push(token);
    const next = prev.slice(-25);
    await kv.set(key, next);
    return c.json({ success: true });
  } catch (e: any) {
    console.error('user push-token error', e);
    return c.json({ error: 'Push token saqlanmadi' }, 500);
  }
};

app.post("/make-server-27d0d16c/user/push-token", userPushTokenHandler);
app.post("/user/push-token", userPushTokenHandler);

/** Ijara to‘lovi eslatmalari (har 6–12 soatda tashqi cron chaqirsin). Header: x-push-cron-secret */
const rentalPaymentDuePushJobHandler = async (c: any) => {
  try {
    const secret = String(Deno.env.get('PUSH_CRON_SECRET') || '').trim();
    const hdr = String(c.req.header('x-push-cron-secret') || '').trim();
    if (!secret || hdr !== secret) {
      return c.json({ error: 'PUSH_CRON_SECRET sozlanmagan yoki kalit noto‘g‘ri' }, 401);
    }
    await runRentalPaymentDuePushes();
    return c.json({ success: true });
  } catch (e: any) {
    console.error('rental-payment-due-pushes job', e);
    return c.json({ error: e?.message || 'Job xatosi' }, 500);
  }
};

app.post(
  '/make-server-27d0d16c/jobs/rental-payment-due-pushes',
  rentalPaymentDuePushJobHandler,
);
app.post('/jobs/rental-payment-due-pushes', rentalPaymentDuePushJobHandler);

// List messages in a chat
app.get("/make-server-27d0d16c/chats/:chatId/messages", async (c) => {
  try {
    const chatId = c.req.param('chatId');
    if (!chatId) return c.json({ error: 'chatId kerak' }, 400);

    const prefix = `${CHAT_MESSAGE_KEY_PREFIX}${chatId}:`;
    const raw = await kv.getByPrefix(prefix);
    const messages = (raw || []).map(normalizeKVValueChat).filter(Boolean);
    messages.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const uiMessages = messages.map((m: any) => ({
      id: String(m.id || ''),
      chatId: String(m.chatId || chatId),
      senderId: String(m.senderId || ''),
      senderName: String(m.senderName || ''),
      content: String(m.content || ''),
      type: String(m.type || 'text'),
      imageCaption: m.imageCaption != null ? String(m.imageCaption) : '',
      timestamp: new Date(m.timestamp || Date.now()).toISOString(),
      status: mapMessageStatusToUI(m.status),
      isOwn: Boolean(m.isOwn),
    }));

    return c.json({ success: true, messages: uiMessages });
  } catch (error: any) {
    console.error('Chat messages list error:', error);
    return c.json({ error: 'Xabarlarni olishda xatolik' }, 500);
  }
});

// Send a message to a chat
app.post("/make-server-27d0d16c/chats/:chatId/messages", async (c) => {
  try {
    const chatId = c.req.param('chatId');
    if (!chatId) return c.json({ error: 'chatId kerak' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const content = String(body?.content || '').trim();
    const type = String(body?.type || 'text').trim() || 'text';
    if (!content) return c.json({ error: 'content kerak' }, 400);

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();

    const message = {
      id: messageId,
      chatId,
      senderId: 'branch',
      senderName: 'Filial',
      content,
      type,
      timestamp: nowIso,
      status: 'sent',
      isOwn: true,
    };

    await kv.set(`${CHAT_MESSAGE_KEY_PREFIX}${chatId}:${messageId}`, message);

    // Update chat lastMessage
    const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
    const existing = normalizeKVValueChat(await kv.get(chatKey));
    const updatedAt = nowIso;
    const updated = existing
      ? {
          ...existing,
          updatedAt,
          lastMessage: {
            content: message.content,
            timestamp: message.timestamp,
            senderName: message.senderName,
            isOwn: message.isOwn,
          },
        }
      : {
          id: chatId,
          branchId: '',
          participantId: '',
          participantType: 'customer',
          participantName: 'Mijoz',
          lastMessage: {
            content: message.content,
            timestamp: message.timestamp,
            senderName: message.senderName,
            isOwn: message.isOwn,
          },
          unreadCount: 0,
          isOnline: false,
          isTyping: false,
          isArchived: false,
          isStarred: false,
          createdAt: updatedAt,
          updatedAt,
        };

    await kv.set(chatKey, updated);

    const recipientUserId =
      String(updated.participantId || '').trim() || parseCustomerIdFromChatId(chatId) || '';
    if (recipientUserId) {
      void notifyUserExpoPush(
        recipientUserId,
        'Filial',
        content.length > 160 ? `${content.slice(0, 157)}...` : content,
        { chatId: String(chatId), type: 'branch_chat' },
      );
    }

    return c.json({ success: true, message });
  } catch (error: any) {
    console.error('Send chat message error:', error);
    return c.json({ error: 'Xabarni yuborishda xatolik' }, 500);
  }
});

// Toggle star
app.put("/make-server-27d0d16c/chats/:chatId/star", async (c) => {
  try {
    const chatId = c.req.param('chatId');
    if (!chatId) return c.json({ error: 'chatId kerak' }, 400);

    const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
    const existing = normalizeKVValueChat(await kv.get(chatKey));
    if (!existing) return c.json({ error: 'Suhbat topilmadi' }, 404);

    const updated = {
      ...existing,
      isStarred: !Boolean(existing.isStarred),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(chatKey, updated);

    return c.json({ success: true, chat: updated });
  } catch (error: any) {
    console.error('Star chat error:', error);
    return c.json({ error: 'Suhbatni yulduzlashda xatolik' }, 500);
  }
});

// Toggle archive
app.put("/make-server-27d0d16c/chats/:chatId/archive", async (c) => {
  try {
    const chatId = c.req.param('chatId');
    if (!chatId) return c.json({ error: 'chatId kerak' }, 400);

    const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
    const existing = normalizeKVValueChat(await kv.get(chatKey));
    if (!existing) return c.json({ error: 'Suhbat topilmadi' }, 404);

    const updated = {
      ...existing,
      isArchived: !Boolean(existing.isArchived),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(chatKey, updated);

    return c.json({ success: true, chat: updated });
  } catch (error: any) {
    console.error('Archive chat error:', error);
    return c.json({ error: 'Suhbatni arxivlashda xatolik' }, 500);
  }
});

// ==================== ORDER PAYMENT CONFIRM (CASHIER RECEIPT) ====================
// Cashier receipt uploaded -> order.paymentStatus becomes "paid" (especially for QR/manual verification flows)
app.post("/make-server-27d0d16c/orders/:orderId/confirm-receipt", async (c) => {
  try {
    const orderId = decodeURIComponent(c.req.param('orderId') || '');
    if (!orderId) return c.json({ error: 'orderId kerak' }, 400);

    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ success: false, error: branchAuth.error || 'Unauthorized' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const receiptImageUrl = String(body?.receiptImageUrl || '').trim();
    if (!receiptImageUrl) return c.json({ error: 'receiptImageUrl kerak' }, 400);

    const orderRecord = await getOrderRecord(orderId);
    if (!orderRecord) return c.json({ error: 'Buyurtma topilmadi' }, 404);

    const nowIso = new Date().toISOString();
    const inferredBranchId = orderRecord.order.branchId || (await inferOrderBranchId(orderRecord.order));
    if (branchAuth.branchId && inferredBranchId && String(branchAuth.branchId) !== String(inferredBranchId)) {
      return c.json({ success: false, error: 'Ruxsat yo‘q' }, 403);
    }

    const existingRootShopId = String(orderRecord.order.shopId || '').trim();
    const normalizedShopForOrder = await resolveNormalizedShopIdForReceipt(orderRecord.order);

    const updatedOrder = {
      ...orderRecord.order,
      ...(existingRootShopId || !normalizedShopForOrder ? {} : { shopId: normalizedShopForOrder }),
      paymentStatus: 'paid',
      paymentCompletedAt: nowIso,
      paymentReceiptImageUrl: receiptImageUrl,
      receiptUrl: receiptImageUrl,
      paymentConfirmedAt: nowIso,
      paymentRequiresVerification: false,
      updatedAt: nowIso,
      statusHistory: [
        ...(Array.isArray(orderRecord.order.statusHistory) ? orderRecord.order.statusHistory : []),
        { status: orderRecord.order.status, timestamp: nowIso, note: 'Kassa QR/to\'lov chekini tasdiqladi' },
      ],
    };

    await kv.set(orderRecord.key, updatedOrder);
    
    // Keep Postgres marketplace `v2` in sync (payment becomes "paid" after receipt confirmation)
    await syncRelationalOrderFromLegacy({
      legacyOrderId: String(orderRecord.order?.id || orderId),
      kvStatus: String(orderRecord.order.status || ''),
      kvPaymentStatus: 'paid',
      paymentRequiresVerification: false,
    });

    // Send receipt image to customer chat (used by shop/restaurant to process the order)
    if (inferredBranchId) {
      const participantId =
        String(orderRecord.order.userId || orderRecord.order.customerId || orderRecord.order.customerPhone || '').trim();

      if (participantId) {
        const chatId = buildChatId(inferredBranchId, 'customer', participantId);
        const chatKey = `${CHAT_KEY_PREFIX}${chatId}`;
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const message = {
          id: messageId,
          chatId,
          senderId: 'branch',
          senderName: 'Filial',
          content: receiptImageUrl,
          type: 'image',
          timestamp: nowIso,
          status: 'sent',
          isOwn: true,
        };

        await kv.set(`${CHAT_MESSAGE_KEY_PREFIX}${chatId}:${messageId}`, message);

        const updatedChat = {
          id: chatId,
          branchId: inferredBranchId,
          participantId,
          participantType: 'customer',
          participantName: String(orderRecord.order.customerName || 'Mijoz'),
          lastMessage: {
            content: 'To\'lov chek rasmi yuklandi',
            timestamp: nowIso,
            senderName: 'Filial',
            isOwn: true,
          },
          unreadCount: 0,
          isOnline: false,
          isTyping: false,
          isArchived: false,
          isStarred: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await kv.set(chatKey, updatedChat);
      }
    }

    // Also send receipt photo to shop/restaurant Telegram chat
    const orderType = String(orderRecord.order.orderType || '').toLowerCase().trim();
    const orderNumberForCaption = String(orderRecord.order.orderNumber || orderRecord.order.id || orderId);

    try {
      const captionHtml = `✅ <b>To'lov chek rasmi</b>\n\n🧾 Buyurtma: #${orderNumberForCaption}\n💰 Holat: To'landi`;
      const captionPlain = `To'lov chek rasmi\nBuyurtma: #${orderNumberForCaption}\nHolat: To'landi`;

      const isShopOrderFlow =
        orderType === 'shop' ||
        orderType.includes('shop') ||
        Boolean(normalizedShopForOrder);
      if (isShopOrderFlow) {
        const tgTarget = await resolveShopTelegramTargetForReceipt({
          normalizedShopId: normalizedShopForOrder,
          branchId: inferredBranchId,
        });
        if (tgTarget?.chatId) {
          const ok = await telegram.sendReceiptToTelegramRobust({
            type: 'shop',
            chatId: tgTarget.chatId,
            imageUrl: receiptImageUrl,
            captionHtml,
            plainCaption: captionPlain,
          });
          if (!ok) {
            console.error('[confirm-receipt] Do‘kon Telegram: yuborib bo‘lmadi', {
              orderId,
              shopName: tgTarget.shopName,
            });
          }
        } else {
          console.warn('[confirm-receipt] Do‘kon Telegram chat topilmadi (telegramChatId sozlang yoki filialda bitta telegramli do‘kon bo‘lsin)', {
            orderId,
            normalizedShopId: normalizedShopForOrder || null,
            branchId: inferredBranchId || null,
            orderType,
          });
        }
      }

      if ((orderType === 'food' || orderType === 'restaurant') && orderRecord.order.restaurantId) {
        const restaurantId = String(orderRecord.order.restaurantId);
        const restKey = restaurantId.startsWith('restaurant:') ? restaurantId : `restaurant:${restaurantId}`;
        const restaurant = await kv.get(restKey);
        const rChat = pickTelegramChatIdFromEntity(restaurant);

        if (rChat) {
          await telegram.sendReceiptToTelegramRobust({
            type: 'restaurant',
            chatId: rChat,
            imageUrl: receiptImageUrl,
            captionHtml,
            plainCaption: captionPlain,
          });
        } else {
          console.warn('[confirm-receipt] Restoranda telegramChatId yo‘q', { restKey, orderId });
        }
      }
    } catch (tgErr) {
      console.error('Telegram receipt photo send error:', tgErr);
    }

    return c.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Confirm receipt error:', error);
    return c.json({ error: 'Chekni tasdiqlashda xatolik' }, 500);
  }
});

// ==================== ARESSO PAYMENT ROUTES ====================

// Get payments list + stats (for branch payments history)
app.get("/make-server-27d0d16c/payments", async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ success: false, error: branchAuth.error || 'Unauthorized' }, 401);
    }

    const branchId = String(c.req.query('branchId') || '').trim();
    const branchIdNormalized = normalizeBranchId(branchId);
    const search = String(c.req.query('search') || '').trim().toLowerCase();
    const status = String(c.req.query('status') || '').trim(); // completed|pending|processing|failed|refunded|cancelled
    const method = String(c.req.query('method') || '').trim(); // cash|card|click|payme|uzum|apelsin
    const dateRange = String(c.req.query('dateRange') || '7days').trim(); // 7days|30days|90days
    const debugMode =
      String(c.req.query('debug') || '').trim() === '1' ||
      String(c.req.query('debug') || '').trim().toLowerCase() === 'true';

    if (!branchId) {
      return c.json({ success: false, error: 'branchId kerak' }, 400);
    }
    if (branchAuth.branchId && normalizeBranchId(branchAuth.branchId) !== branchIdNormalized) {
      return c.json({ success: false, error: 'Ruxsat yo‘q' }, 403);
    }

    const rangeDays = dateRange === '30days' ? 30 : dateRange === '90days' ? 90 : 7;
    const startTs = Date.now() - rangeDays * 24 * 60 * 60 * 1000;


    // payments tarixini orderlardan hisoblaymiz (cash ham bor).
    const allOrdersRaw = await kv.getByPrefix('order:');
    const filtered: any[] = [];
    const shopQrCache = new Map<string, string>();
    const restaurantQrCache = new Map<string, string>();

    const dropped: Record<string, number> = {};
    const dropSamples: Record<string, string[]> = {};
    const bumpDrop = (reason: string, sample: string) => {
      if (!debugMode) return;
      dropped[reason] = (dropped[reason] || 0) + 1;
      if (!dropSamples[reason]) dropSamples[reason] = [];
      if (dropSamples[reason].length < 10) dropSamples[reason].push(sample);
    };

    for (const order of allOrdersRaw) {
      try {
      if (!order) {
        bumpDrop('null_order', 'null');
        continue;
      }
      const orderType = String(order.orderType || '').toLowerCase().trim();
      let candidateRestaurantId = extractRestaurantIdFromOrder(order);

      let inferredBranchId = order.branchId || (await inferOrderBranchId(order));
      if (!inferredBranchId) {
        // Extra safety for food/restaurant orders: recover branchId from restaurant record.
        if (orderType === 'food' || orderType === 'restaurant' || candidateRestaurantId) {
          if (candidateRestaurantId) {
            inferredBranchId = await resolveBranchIdFromRestaurant(candidateRestaurantId);
          }
        }
      }
      if (!inferredBranchId) {
        bumpDrop('no_branch', String(order.id || 'unknown'));
        continue;
      }
      const normalizedInferred = normalizeBranchId(inferredBranchId);
      if (normalizedInferred !== branchIdNormalized) {
        // If order carries incorrect branchId, trust restaurant->branch mapping for food flows.
        if ((orderType === 'food' || orderType === 'restaurant' || candidateRestaurantId) && candidateRestaurantId) {
          const restBranch = await resolveBranchIdFromRestaurant(candidateRestaurantId);
          if (restBranch && normalizeBranchId(restBranch) === branchIdNormalized) {
            inferredBranchId = restBranch;
          } else {
            bumpDrop('branch_mismatch', `${String(order.id || 'unknown')}|${normalizedInferred}`);
            continue;
          }
        } else if (orderType === 'shop' && order.shopId) {
          const shopBranch = await resolveBranchIdFromShop(String(order.shopId));
          if (shopBranch && normalizeBranchId(shopBranch) === branchIdNormalized) {
            inferredBranchId = shopBranch;
          } else {
            bumpDrop('branch_mismatch', `${String(order.id || 'unknown')}|${normalizedInferred}`);
            continue;
          }
        } else {
        bumpDrop('branch_mismatch', `${String(order.id || 'unknown')}|${normalizedInferred}`);
        continue;
        }
      }

      const { createdAt, createdTs } = resolveCreatedTimestamp(order);
      if (!createdTs) {
        bumpDrop('no_created_ts', String(order.id || 'unknown'));
        continue;
      }
      if (createdTs < startTs) {
        bumpDrop('too_old', `${String(order.id || 'unknown')}|${new Date(createdTs).toISOString()}`);
        continue;
      }

      const uiStatus = mapOrderToPaymentUIStatus(order);
      const uiMethod = mapMethodToUI(order.paymentMethod);

      const orderTypeNormalized = orderType;

      const methodVerification = uiMethod === 'qr';

      let qrImageUrl: string | undefined = String(order.merchantPaymentQrUrl || '').trim() || undefined;
      try {
        const orderType = String(order.orderType || '').toLowerCase().trim();
        if (!candidateRestaurantId) candidateRestaurantId = extractRestaurantIdFromOrder(order);
        if (!candidateRestaurantId && Array.isArray(order.items) && order.items.length > 0) {
          const firstItem: any = order.items[0];
          candidateRestaurantId = String(
            firstItem?.restaurantId ||
            firstItem?.restaurant_id ||
            firstItem?.dishDetails?.restaurantId ||
            ''
          ).trim();
        }
        if (!qrImageUrl && orderType === 'shop') {
          const shopId = order.shopId ? String(order.shopId) : '';
          if (shopId) {
            const shopKey = shopId.startsWith('shop:') ? shopId : `shop:${shopId}`;
            if (shopQrCache.has(shopKey)) {
              qrImageUrl = shopQrCache.get(shopKey);
            } else {
              const shop = await kv.get(shopKey);
              const url = pickQrImage(shop) || undefined;
              shopQrCache.set(shopKey, url || '');
              qrImageUrl = url;
            }
          }
        } else if (!qrImageUrl && (orderType === 'food' || orderType === 'restaurant' || candidateRestaurantId)) {
          if (candidateRestaurantId) {
            const restKey = candidateRestaurantId.startsWith('restaurant:') ? candidateRestaurantId : `restaurant:${candidateRestaurantId}`;
            if (restaurantQrCache.has(restKey)) {
              qrImageUrl = restaurantQrCache.get(restKey);
            } else {
              const restaurant = await kv.get(restKey);
              const url = pickQrImage(restaurant) || undefined;
              restaurantQrCache.set(restKey, url || '');
              qrImageUrl = url;
            }
          }
        }

        if (!qrImageUrl) {
          let branchId = String(order.branchId || '').trim();

          // Restaurant/food orders may miss branchId; recover from restaurant record.
          if (!branchId && (orderType === 'food' || orderType === 'restaurant' || candidateRestaurantId)) {
            if (candidateRestaurantId) {
              const restaurant = await kv.get(
                candidateRestaurantId.startsWith('restaurant:') ? candidateRestaurantId : `restaurant:${candidateRestaurantId}`
              );
              branchId = String(
                restaurant?.branchId || restaurant?.branchID || restaurant?.branch_id || ''
              ).trim();
            }
          }

          if (branchId) {
            const branch = await kv.get(branchId.startsWith('branch:') ? branchId : `branch:${branchId}`);
            const branchQr = pickQrImage(branch);
            if (branchQr) {
              qrImageUrl = branchQr;
            }
          }
        }
      } catch {
        // qrImageUrl bo'lmasa, shunchaki kiritmaymiz
      }

      // QR presence implies cashier verification required for shop/restaurant flows too
      const verificationRequired =
        methodVerification || Boolean(order.paymentRequiresVerification) || Boolean(qrImageUrl);

      if (status && uiStatus !== status) continue;
      if (method && uiMethod !== method) continue;

      if (search) {
        const orderNumber = String(order.orderNumber || order.id || '').toLowerCase();
        const customerName = String(order.customerName || '').toLowerCase();
        const customerPhone = String(order.customerPhone || '').toLowerCase();
        const haystack = `${orderNumber} ${customerName} ${customerPhone}`.trim();
        if (!haystack.includes(search)) {
          bumpDrop('search_miss', String(order.id || 'unknown'));
          continue;
        }
      }

      const items = Array.isArray(order.items) ? order.items : [];
      const metadataItems = items.map((it: any) => ({
        name: String(it.productName || it.name || it.dishName || 'Mahsulot'),
        quantity: Number(it.quantity || it.qty || 0) || 0,
        price: Number(it.price || it.unitPrice || 0) || 0,
      }));

      const { amount, deliveryFee, serviceFee, discount, tax } = computeCashierAmount(order, metadataItems);

      const orderNumberRaw = String(order.orderNumber || order.id || '');
      const normalizedOrderNumber = orderNumberRaw.startsWith('#')
        ? orderNumberRaw
        : `#${orderNumberRaw.replace(/^ORD-/, '')}`;

      const completedAt =
        uiStatus === 'completed'
          ? (order.deliveredAt || order.paymentCompletedAt || order.updatedAt || createdAt)
          : undefined;
      const refundedAt = uiStatus === 'refunded' ? (order.refundedAt || order.updatedAt || createdAt) : undefined;

      filtered.push({
        id: `payment_${String(order.id)}`,
        branchId: String(inferredBranchId),
        orderId: String(order.id),
        orderNumber: normalizedOrderNumber,
        orderType: String(order.orderType || ''),
        orderStatus: resolveOrderOperationalStatus(order),
        customerId: String(order.userId || order.customerId || ''),
        customerName: String(order.customerName || ''),
        customerPhone: String(order.customerPhone || ''),
        amount,
        currency: 'UZS',
        method: uiMethod,
        status: uiStatus,
        qrImageUrl,
        paymentRequiresVerification: verificationRequired,
        receiptUrl: String(order.receiptUrl || order.paymentReceiptImageUrl || ''),
        paymentConfirmedAt: String(order.paymentConfirmedAt || order.paymentCompletedAt || ''),
        type: 'payment',
        description: String(order.notes || ''),
        transactionId: order.paymentTransactionId ? String(order.paymentTransactionId) : undefined,
        paymentGateway: String(order.paymentMethod || uiMethod),
        createdAt: toIsoSafeOrNow(createdAt),
        updatedAt: toIsoSafeOrNow(order.updatedAt),
        completedAt: toIsoSafe(completedAt),
        refundedAt: toIsoSafe(refundedAt),
        failureReason: uiStatus === 'failed' ? String(order.paymentFailureReason || order.paymentError || '') : undefined,
        platformCommissionTotalUzs: Number(order.platformCommissionTotalUzs || 0) || 0,
        merchantGoodsPayoutUzs: Number(order.merchantGoodsPayoutUzs || 0) || 0,
        commissionableItemsSubtotalUzs: Number(order.commissionableItemsSubtotalUzs || 0) || 0,
        metadata: {
          items: metadataItems,
          deliveryFee,
          serviceFee,
          discount,
          tax,
        },
      });
      } catch (rowErr: any) {
        console.error('[payments/list] row skip:', String((order as any)?.id ?? ''), rowErr?.message ?? rowErr);
      }
    }

    // Sort newest first
    filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalTransactions = filtered.length;
    const completed = filtered.filter((x: any) => x.status === 'completed');
    const refunded = filtered.filter((x: any) => x.status === 'refunded');

    const totalRevenue = completed.reduce((sum: number, x: any) => sum + (Number(x.amount) || 0), 0);
    const averageTransactionValue = totalTransactions ? totalRevenue / totalTransactions : 0;
    const successRate = totalTransactions ? (completed.length / totalTransactions) * 100 : 0;
    const refundRate = totalTransactions ? (refunded.length / totalTransactions) * 100 : 0;

    const methodAgg = new Map<string, { method: string; count: number; amount: number }>();
    for (const x of filtered) {
      const key = x.method || 'cash';
      const prev = methodAgg.get(key) || { method: key, count: 0, amount: 0 };
      prev.count += 1;
      if (x.status === 'completed') prev.amount += Number(x.amount) || 0;
      methodAgg.set(key, prev);
    }

    const paymentMethods = Array.from(methodAgg.values()).map((m) => ({
      method: m.method,
      count: m.count,
      amount: m.amount,
      percentage: totalTransactions ? (m.count / totalTransactions) * 100 : 0,
    }));

    const dayMap = new Map<string, { date: string; amount: number; transactions: number }>();
    const monthMap = new Map<string, { month: string; amount: number; transactions: number }>();

    for (const x of filtered) {
      if (x.status !== 'completed') continue;
      const d = new Date(x.createdAt);
      const day = d.toISOString().slice(0, 10);
      const month = d.toISOString().slice(0, 7); // YYYY-MM
      const prevDay = dayMap.get(day) || { date: day, amount: 0, transactions: 0 };
      prevDay.amount += Number(x.amount) || 0;
      prevDay.transactions += 1;
      dayMap.set(day, prevDay);

      const prevMonth = monthMap.get(month) || { month, amount: 0, transactions: 0 };
      prevMonth.amount += Number(x.amount) || 0;
      prevMonth.transactions += 1;
      monthMap.set(month, prevMonth);
    }

    const dailyRevenue = Array.from(dayMap.values()).sort((a, b) => a.date < b.date ? -1 : 1);
    const monthlyRevenue = Array.from(monthMap.values()).sort((a, b) => a.month < b.month ? -1 : 1);

    const stats = {
      totalRevenue,
      totalTransactions,
      averageTransactionValue,
      successRate: Math.round(successRate * 10) / 10,
      refundRate: Math.round(refundRate * 10) / 10,
      paymentMethods,
      dailyRevenue,
      monthlyRevenue,
    };

    return c.json({
      success: true,
      payments: filtered,
      stats,
      ...(debugMode ? { debug: { totalOrders: allOrdersRaw.length, dropped, dropSamples } } : {}),
    });
  } catch (error: any) {
    console.error('Payments list error:', error);
    return c.json({ error: 'To\'lovlar tarixini olishda xatolik' }, 500);
  }
});

// Create payment
app.post("/make-server-27d0d16c/payments/create", async (c) => {
  try {
    console.log('💳 Payment creation request received');
    
    const { amount, orderId, description, returnUrl, userId, userPhone, paymentMethod } =
      await c.req.json();

    if (!amount || !orderId) {
      return c.json({ error: 'Summa va buyurtma ID majburiy' }, 400);
    }

    // Validate amount (minimum 1000 so'm = 100000 tiyins)
    if (amount < 1000) {
      return c.json({ error: 'Minimal summa 1,000 so\'m' }, 400);
    }

    const pm = String(paymentMethod || "").toLowerCase().trim();
    const envForceDemo = Deno.env.get("ARESSO_PAYMENTS_DEMO") === "true";
    /** Atmos va bank kartasi (card / click_card) — demo; Payme, Click hamyoni — haqiqiy ARESSO */
    const useDemoPayment =
      envForceDemo || pm === "atmos" || pm === "card" || pm === "click_card";

    if (useDemoPayment) {
      const mockPaymentId = `DEMO_PAY_${Date.now()}`;
      const mockPaymentUrl = `https://demo-payment.aresso.uz/pay/${mockPaymentId}`;

      console.log("🎭 Demo/simulated payment:", { paymentId: mockPaymentId, amount, pm, envForceDemo });

      const paymentData = {
        paymentId: mockPaymentId,
        orderId,
        amount,
        status: "pending",
        userId,
        userPhone,
        description: description || `Buyurtma #${orderId}`,
        createdAt: new Date().toISOString(),
        isDemoMode: true,
        ...(pm ? { paymentMethod: pm } : {}),
      };

      await kv.set(`payment:${mockPaymentId}`, JSON.stringify(paymentData));
      await kv.set(`order:${orderId}:payment`, mockPaymentId);
      await kv.set(`payment_order:${orderId}`, {
        paymentId: mockPaymentId,
        orderId,
      });

      return c.json({
        success: true,
        paymentId: mockPaymentId,
        paymentUrl: mockPaymentUrl,
        message: envForceDemo
          ? "Demo to‘lov (ARESSO_PAYMENTS_DEMO=true)"
          : "Simulyatsiya: atmos/karta — haqiqiy integratsiya alohida",
      });
    }

    // Convert so'm to tiyins (1 so'm = 100 tiyin)
    const amountInTiyins = aresso.formatAmountToTiyins(amount);

    console.log('💰 Creating payment:', { 
      amount, 
      amountInTiyins, 
      orderId, 
      description 
    });

    // Create payment via ARESSO
    const result = await aresso.createPayment({
      amount: amountInTiyins,
      orderId,
      description: description || `Buyurtma #${orderId}`,
      returnUrl,
      userId,
      userPhone,
      ...(paymentMethod ? { paymentMethod: String(paymentMethod).toLowerCase() } : {}),
    });

    if (!result.success) {
      console.error('❌ ARESSO payment failed:', result.error);
      return c.json({ 
        success: false,
        error: result.error || 'To\'lov yaratishda xatolik' 
      }, 400);
    }

    // Store payment in KV
    const paymentData = {
      paymentId: result.paymentId,
      orderId,
      amount,
      status: 'pending',
      userId,
      userPhone,
      description,
      createdAt: new Date().toISOString(),
      ...(paymentMethod ? { paymentMethod: String(paymentMethod).toLowerCase() } : {}),
    };

    await kv.set(`payment:${result.paymentId}`, paymentData);
    await kv.set(`payment_order:${orderId}`, {
      paymentId: result.paymentId,
      orderId,
    });

    console.log('✅ Payment created and stored:', result.paymentId);

    return c.json({
      success: true,
      paymentId: result.paymentId,
      paymentUrl: result.paymentUrl,
      amount,
      message: 'To\'lov muvaffaqiyatli yaratildi',
    });
  } catch (error: any) {
    console.error('❌ Payment creation exception:', error);
    return c.json({ 
      success: false,
      error: `To'lov yaratishda xatolik: ${error.message}` 
    }, 500);
  }
});

// Check payment status
app.get("/make-server-27d0d16c/payments/:paymentId/status", async (c) => {
  try {
    const paymentId = c.req.param('paymentId');
    console.log('🔍 Checking payment status:', paymentId);

    if (!paymentId) {
      return c.json({ error: 'To\'lov ID majburiy' }, 400);
    }

    let paymentData: any = await kv.get(`payment:${paymentId}`);
    if (typeof paymentData === "string") {
      try {
        paymentData = JSON.parse(paymentData);
      } catch {
        paymentData = null;
      }
    }

    if (!paymentData || typeof paymentData !== "object") {
      return c.json({
        success: false,
        error: "To'lov topilmadi",
      }, 404);
    }

    if (paymentId.startsWith("DEMO_PAY_")) {
      console.log("🎭 Demo payment: auto-mark paid");

      const updatedPaymentData = {
        ...paymentData,
        status: "paid",
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`payment:${paymentId}`, updatedPaymentData);

      return c.json({
        success: true,
        paymentId,
        status: "paid",
        amount: paymentData.amount,
        orderId: paymentData.orderId,
        paidAt: updatedPaymentData.paidAt,
        message: "Demo to'lov muvaffaqiyatli yakunlandi",
      });
    }

    const statusResult = await aresso.checkPaymentStatus(paymentId);

    if (!statusResult.success) {
      console.error("❌ ARESSO status check failed:", statusResult.error);
      return c.json({
        success: true,
        paymentId,
        status: paymentData.status,
        amount: paymentData.amount,
        orderId: paymentData.orderId,
      });
    }

    const updatedPaymentData = {
      ...paymentData,
      status: statusResult.status,
      paidAt: statusResult.paidAt,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`payment:${paymentId}`, updatedPaymentData);

    console.log("✅ Payment status updated:", statusResult.status);

    return c.json({
      success: true,
      paymentId,
      status: statusResult.status,
      amount: paymentData.amount,
      paidAt: statusResult.paidAt,
      orderId: paymentData.orderId,
    });
  } catch (error: any) {
    console.error('❌ Payment status check exception:', error);
    return c.json({ 
      success: false,
      error: `Status tekshirishda xatolik: ${error.message}` 
    }, 500);
  }
});

// Get payment by order ID
app.get("/make-server-27d0d16c/payments/order/:orderId", async (c) => {
  try {
    const orderId = c.req.param('orderId');
    console.log('🔍 Getting payment for order:', orderId);

    if (!orderId) {
      return c.json({ error: 'Buyurtma ID majburiy' }, 400);
    }

    // Get payment mapping
    const mapping = await kv.get(`payment_order:${orderId}`);

    if (!mapping) {
      return c.json({ 
        success: false,
        error: 'To\'lov topilmadi' 
      }, 404);
    }

    // Get payment data
    const paymentData = await kv.get(`payment:${mapping.paymentId}`);

    if (!paymentData) {
      return c.json({ 
        success: false,
        error: 'To\'lov ma\'lumotlari topilmadi' 
      }, 404);
    }

    console.log('✅ Payment found for order:', orderId);

    return c.json({
      success: true,
      payment: paymentData,
    });
  } catch (error: any) {
    console.error('❌ Get payment exception:', error);
    return c.json({ 
      success: false,
      error: `To'lov olishda xatolik: ${error.message}` 
    }, 500);
  }
});

// Cancel payment
app.post("/make-server-27d0d16c/payments/:paymentId/cancel", async (c) => {
  try {
    const paymentId = c.req.param('paymentId');
    console.log('❌ Cancelling payment:', paymentId);

    if (!paymentId) {
      return c.json({ error: 'To\'lov ID majburiy' }, 400);
    }

    // Get payment from KV
    const paymentData = await kv.get(`payment:${paymentId}`);

    if (!paymentData) {
      return c.json({ 
        success: false,
        error: 'To\'lov topilmadi' 
      }, 404);
    }

    // Cancel via ARESSO
    const result = await aresso.cancelPayment(paymentId);

    if (!result.success) {
      console.error('❌ ARESSO cancel failed:', result.error);
      return c.json({ 
        success: false,
        error: result.error || 'To\'lovni bekor qilishda xatolik' 
      }, 400);
    }

    // Update status in KV
    const updatedPaymentData = {
      ...paymentData,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    };

    await kv.set(`payment:${paymentId}`, updatedPaymentData);

    console.log('✅ Payment cancelled:', paymentId);

    return c.json({
      success: true,
      message: 'To\'lov bekor qilindi',
    });
  } catch (error: any) {
    console.error('❌ Payment cancel exception:', error);
    return c.json({ 
      success: false,
      error: `To'lovni bekor qilishda xatolik: ${error.message}` 
    }, 500);
  }
});

// ==================== SERVICE PORTFOLIO ROUTES ====================

// Get all portfolios (with filters)
app.get("/make-server-27d0d16c/portfolios", async (c) => {
  try {
    const region = c.req.query('region');
    const district = c.req.query('district');
    const branchId = c.req.query('branchId');
    
    console.log('🎨 Fetching portfolios with filters:', { region, district, branchId });
    
    const portfolios = await kv.getByPrefix('portfolio:');
    
    let filteredPortfolios = portfolios;
    
    if (region) {
      filteredPortfolios = filteredPortfolios.filter((p: any) => p.region === region);
    }
    if (district) {
      filteredPortfolios = filteredPortfolios.filter((p: any) => p.district === district);
    }
    if (branchId) {
      filteredPortfolios = filteredPortfolios.filter((p: any) => p.branchId === branchId);
    }
    
    // Sort by creation date (newest first)
    filteredPortfolios.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    console.log(`✅ Found ${filteredPortfolios.length} portfolios`);
    return c.json({ portfolios: filteredPortfolios });
  } catch (error: any) {
    console.log('Get portfolios error:', error);
    return c.json({ error: 'Portfoliolarni olishda xatolik' }, 500);
  }
});

// Get single portfolio
app.get("/make-server-27d0d16c/portfolios/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const portfolio = await kv.get(`portfolio:${id}`);
    
    if (!portfolio) {
      return c.json({ error: 'Portfolio topilmadi' }, 404);
    }
    
    return c.json({ portfolio });
  } catch (error: any) {
    console.log('Get portfolio error:', error);
    return c.json({ error: 'Portfolio olishda xatolik' }, 500);
  }
});

// Create portfolio
app.post("/make-server-27d0d16c/portfolios", async (c) => {
  try {
    const body = await c.req.json();
    const {
      branchId,
      title,
      description,
      category,
      price,
      priceType,
      images,
      videos,
      phone,
      whatsapp,
      telegram,
      region,
      district,
      address,
    } = body;
    
    console.log('📝 Creating portfolio:', { branchId, title, category });
    
    // Validation
    if (!branchId || !title || !category || !region || !district) {
      return c.json({ error: 'Majburiy maydonlarni to\'ldiring' }, 400);
    }
    
    const portfolioId = `portfolio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const portfolio = {
      id: portfolioId,
      branchId,
      title,
      description: description || '',
      category,
      price: price || null,
      priceType: priceType || 'fixed', // 'fixed' | 'negotiable' | 'contact'
      images: images || [],
      videos: videos || [],
      phone: phone || '',
      whatsapp: whatsapp || '',
      telegram: telegram || '',
      region,
      district,
      address: address || '',
      status: 'active', // 'active' | 'inactive'
      views: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`portfolio:${portfolioId}`, portfolio);
    
    console.log(`✅ Portfolio created: ${portfolioId}`);
    return c.json({ portfolio, message: 'Portfolio yaratildi' });
  } catch (error: any) {
    console.log('Create portfolio error:', error);
    return c.json({ error: `Portfolio yaratishda xatolik: ${error.message}` }, 500);
  }
});

// Update portfolio
app.put("/make-server-27d0d16c/portfolios/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    console.log('📝 Updating portfolio:', id);
    
    const existingPortfolio = await kv.get(`portfolio:${id}`);
    
    if (!existingPortfolio) {
      return c.json({ error: 'Portfolio topilmadi' }, 404);
    }
    
    const updatedPortfolio = {
      ...existingPortfolio,
      ...body,
      id: existingPortfolio.id, // Keep original ID
      branchId: existingPortfolio.branchId, // Keep original branchId
      createdAt: existingPortfolio.createdAt, // Keep original creation date
      updatedAt: new Date().toISOString(),
    };
    
    await purgeRemovedR2Urls(existingPortfolio, updatedPortfolio);
    await kv.set(`portfolio:${id}`, updatedPortfolio);
    
    console.log(`✅ Portfolio updated: ${id}`);
    return c.json({ portfolio: updatedPortfolio, message: 'Portfolio yangilandi' });
  } catch (error: any) {
    console.log('Update portfolio error:', error);
    return c.json({ error: `Portfolio yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Delete portfolio
app.delete("/make-server-27d0d16c/portfolios/:id", async (c) => {
  try {
    const id = c.req.param('id');
    
    console.log('🗑️ Deleting portfolio:', id);
    
    const portfolio = await kv.get(`portfolio:${id}`);
    
    if (!portfolio) {
      return c.json({ error: 'Portfolio topilmadi' }, 404);
    }
    
    try {
      const projectsData = await kv.getByPrefix(`project:${id}:`);
      for (const p of projectsData || []) {
        await purgeAllManagedR2UrlsInRecord(p);
        const pid = (p as { id?: string })?.id;
        if (pid) await kv.del(`project:${id}:${pid}`);
      }
    } catch (e) {
      console.warn('[portfolio delete] loyihalar R2/KV:', e);
    }
    await purgeAllManagedR2UrlsInRecord(portfolio);
    await kv.del(`portfolio:${id}`);
    
    console.log(`✅ Portfolio deleted: ${id}`);
    return c.json({ success: true, message: 'Portfolio o\'chirildi' });
  } catch (error: any) {
    console.log('Delete portfolio error:', error);
    return c.json({ error: `Portfolio o'chirishda xatolik: ${error.message}` }, 500);
  }
});

// Increment portfolio views
app.post("/make-server-27d0d16c/portfolios/:id/view", async (c) => {
  try {
    const id = c.req.param('id');
    
    const portfolio = await kv.get(`portfolio:${id}`);
    
    if (!portfolio) {
      return c.json({ error: 'Portfolio topilmadi' }, 404);
    }
    
    const updatedPortfolio = {
      ...portfolio,
      views: (portfolio.views || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`portfolio:${id}`, updatedPortfolio);
    
    return c.json({ success: true, views: updatedPortfolio.views });
  } catch (error: any) {
    console.log('Increment view error:', error);
    return c.json({ error: 'Ko\'rishlar sonini oshirishda xatolik' }, 500);
  }
});

// ==================== BANK ROUTES ====================

// Get all banks for a branch
app.get("/make-server-27d0d16c/banks", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    
    console.log('🏦 Getting banks for branch:', branchId);
    
    const allBanks = await kv.getByPrefix('bank:');
    
    // Filter by branchId if provided
    let banks = allBanks;
    if (branchId) {
      banks = allBanks.filter((bank: any) => bank.branchId === branchId);
    }
    
    console.log(`✅ Returning ${banks.length} banks`);
    
    return c.json({ banks });
  } catch (error: any) {
    console.error('Get banks error:', error);
    return c.json({ error: `Banklar olishda xatolik: ${error.message}` }, 500);
  }
});

// Add new bank
app.post("/make-server-27d0d16c/banks", async (c) => {
  try {
    const data = await c.req.json();
    
    console.log('🏦 Adding new bank:', data.name);
    
    // Upload logo if provided as base64
    let finalLogoUrl = data.logo || '';
    if (data.logo && data.logo.startsWith('data:image/')) {
      try {
        const matches = data.logo.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const contentType = matches[1];
          const base64Data = matches[2];
          
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const extension = contentType.split('/')[1] || 'jpg';
          const filename = `bank/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
          
          finalLogoUrl = await r2.uploadToR2(filename, bytes, contentType);
          console.log('✅ Logo uploaded:', finalLogoUrl);
        }
      } catch (uploadError: any) {
        console.error('Logo upload failed:', uploadError);
      }
    }
    
    const bankId = `bank_${Date.now()}`;
    const bank = {
      id: bankId,
      branchId: data.branchId,
      name: data.name,
      logo: finalLogoUrl,
      mortgagePercent: data.mortgagePercent,
      minDownPayment: data.minDownPayment || 20,
      maxPeriod: data.maxPeriod || 20,
      contactPhone: data.contactPhone || '',
      contactEmail: data.contactEmail || '',
      description: data.description || '',
      telegramChatId: data.telegramChatId || '',
      viloyat: data.viloyat || '',
      tuman: data.tuman || '',
      createdAt: new Date().toISOString(),
    };
    
    await kv.set(`bank:${bankId}`, bank);
    
    console.log('✅ Bank added successfully');
    
    return c.json({ success: true, bank });
  } catch (error: any) {
    console.error('Add bank error:', error);
    return c.json({ error: `Bank qo'shishda xatolik: ${error.message}` }, 500);
  }
});

// Update bank
app.put("/make-server-27d0d16c/banks/:id", async (c) => {
  try {
    const bankId = c.req.param('id');
    const data = await c.req.json();
    
    console.log('🏦 Updating bank:', bankId);
    
    const existingBank = await kv.get(`bank:${bankId}`);
    if (!existingBank) {
      return c.json({ error: 'Bank topilmadi' }, 404);
    }
    
    // Upload logo if provided as base64
    let finalLogoUrl = data.logo || existingBank.logo || '';
    if (data.logo && data.logo.startsWith('data:image/')) {
      try {
        const matches = data.logo.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const contentType = matches[1];
          const base64Data = matches[2];
          
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const extension = contentType.split('/')[1] || 'jpg';
          const filename = `bank/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
          
          finalLogoUrl = await r2.uploadToR2(filename, bytes, contentType);
          console.log('✅ Logo uploaded:', finalLogoUrl);
        }
      } catch (uploadError: any) {
        console.error('Logo upload failed:', uploadError);
      }
    }
    
    const updatedBank = {
      ...existingBank,
      name: data.name,
      logo: finalLogoUrl,
      mortgagePercent: data.mortgagePercent,
      minDownPayment: data.minDownPayment || 20,
      maxPeriod: data.maxPeriod || 20,
      contactPhone: data.contactPhone || '',
      contactEmail: data.contactEmail || '',
      description: data.description || '',
      telegramChatId: data.telegramChatId || '',
      viloyat: data.viloyat || '',
      tuman: data.tuman || '',
      updatedAt: new Date().toISOString(),
    };
    
    await purgeRemovedR2Urls(existingBank, updatedBank);
    await kv.set(`bank:${bankId}`, updatedBank);
    
    console.log('✅ Bank updated successfully');
    
    return c.json({ success: true, bank: updatedBank });
  } catch (error: any) {
    console.error('Update bank error:', error);
    return c.json({ error: `Bank yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Delete bank
app.delete("/make-server-27d0d16c/banks/:id", async (c) => {
  try {
    const bankId = c.req.param('id');
    
    console.log('🏦 Deleting bank:', bankId);
    
    const bank = await kv.get(`bank:${bankId}`);
    if (!bank) {
      return c.json({ error: 'Bank topilmadi' }, 404);
    }
    
    await purgeAllManagedR2UrlsInRecord(bank);
    await kv.del(`bank:${bankId}`);
    
    console.log('✅ Bank deleted successfully');
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete bank error:', error);
    return c.json({ error: `Bank o'chirishda xatolik: ${error.message}` }, 500);
  }
});

// Submit bank application
app.post("/make-server-27d0d16c/banks/apply", async (c) => {
  try {
    const data = await c.req.json();
    
    console.log('📝 Bank application received:', data);
    
    // Get bank details
    const bank = await kv.get(`bank:${data.bankId}`);
    if (!bank) {
      return c.json({ error: 'Bank topilmadi' }, 404);
    }

    // Check if bank has Telegram chat ID
    if (!bank.telegramChatId) {
      console.log('⚠️ Bank has no Telegram chat ID configured');
      return c.json({ 
        success: true, 
        message: 'Ariza qabul qilindi (Telegram bildirishnoma o\'chirilgan)' 
      });
    }

    // Get bot token
    const TELEGRAM_BANK_BOT_TOKEN = Deno.env.get('TELEGRAM_BANK_BOT_TOKEN');
    if (!TELEGRAM_BANK_BOT_TOKEN) {
      console.error('❌ TELEGRAM_BANK_BOT_TOKEN not configured');
      return c.json({ 
        success: true, 
        message: 'Ariza qabul qilindi (Telegram bot sozlanmagan)' 
      });
    }

    // Format application message
    const message = `
🏠 <b>YANGI UY UCHUN ARIZA!</b>

🏦 <b>Bank:</b> ${bank.name}
📍 <b>Hudud:</b> ${bank.viloyat}, ${bank.tuman}

━━━━━━━━━━━━━━━━━━

👤 <b>MIJOZ MA'LUMOTLARI:</b>

👨‍💼 <b>Ismi:</b> ${data.customerName}
📞 <b>Telefon:</b> ${data.customerPhone}

━━━━━━━━━━━━━━━━━━

🏡 <b>UY MA'LUMOTLARI:</b>

📍 <b>Manzil:</b> ${data.houseAddress}
💰 <b>Narxi:</b> ${data.housePrice.toLocaleString()} so'm
🛏️ <b>Xonalar:</b> ${data.rooms}
📐 <b>Maydon:</b> ${data.area} m²

━━━━━━━━━━━━━━━━━━

💳 <b>IPOTEKA MA'LUMOTLARI:</b>

💵 <b>Boshlang'ich to'lov:</b> ${data.downPayment.toLocaleString()} so'm (${data.downPaymentPercent}%)
📅 <b>Muddat:</b> ${data.period} yil
📊 <b>Foiz stavkasi:</b> ${bank.mortgagePercent}%
💰 <b>Oylik to'lov:</b> ${data.monthlyPayment.toLocaleString()} so'm

━━━━━━━━━━━━━━━━━━

📅 <b>Ariza sanasi:</b> ${new Date().toLocaleString('uz-UZ')}

⚡ <b>DIQQAT!</b>
Mijoz bilan tez orada bog'laning va ipoteka hujjatlarini rasmiylashtiring.
`.trim();

    // Send notification via Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BANK_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: bank.telegramChatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Telegram API error:', error);
      return c.json({ 
        success: true, 
        message: 'Ariza qabul qilindi (Telegram xabar yuborishda xatolik)' 
      });
    }

    console.log(`✅ Application notification sent to bank ${bank.name} (Chat ID: ${bank.telegramChatId})`);
    
    return c.json({ 
      success: true, 
      message: 'Ariza muvaffaqiyatli yuborildi! Bank xodimlari siz bilan tez orada bog\'lanishadi.' 
    });
  } catch (error: any) {
    console.error('Bank application error:', error);
    return c.json({ error: `Ariza yuborishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== REGIONS & DISTRICTS ROUTES ====================

// Get all regions
app.get("/make-server-27d0d16c/regions", async (c) => {
  try {
    console.log('🗺️ Getting all regions');
    
    // O'zbekiston viloyatlari
    const regions = [
      { id: 'tashkent-city', name: 'Toshkent shahri' },
      { id: 'tashkent', name: 'Toshkent viloyati' },
      { id: 'andijan', name: 'Andijon' },
      { id: 'bukhara', name: 'Buxoro' },
      { id: 'fergana', name: 'Farg\'ona' },
      { id: 'jizzakh', name: 'Jizzax' },
      { id: 'namangan', name: 'Namangan' },
      { id: 'navoiy', name: 'Navoiy' },
      { id: 'kashkadarya', name: 'Qashqadaryo' },
      { id: 'karakalpakstan', name: 'Qoraqalpog\'iston' },
      { id: 'samarkand', name: 'Samarqand' },
      { id: 'sirdarya', name: 'Sirdaryo' },
      { id: 'surxondaryo', name: 'Surxondaryo' },
      { id: 'khorezm', name: 'Xorazm' },
    ];
    
    console.log(`✅ Returning ${regions.length} regions`);
    
    return c.json({ regions });
  } catch (error: any) {
    console.error('Get regions error:', error);
    return c.json({ error: `Viloyatlarni olishda xatolik: ${error.message}` }, 500);
  }
});

// Get all districts
app.get("/make-server-27d0d16c/districts", async (c) => {
  try {
    console.log('🗺️ Getting all districts');
    
    // O'zbekiston tumanlari
    const districts = [
      // Toshkent shahri
      { id: 'tashkent-city-1', regionId: 'tashkent-city', name: 'Bektemir' },
      { id: 'tashkent-city-2', regionId: 'tashkent-city', name: 'Chilonzor' },
      { id: 'tashkent-city-3', regionId: 'tashkent-city', name: 'Mirzo Ulug\'bek' },
      { id: 'tashkent-city-4', regionId: 'tashkent-city', name: 'Mirobod' },
      { id: 'tashkent-city-5', regionId: 'tashkent-city', name: 'Olmazor' },
      { id: 'tashkent-city-6', regionId: 'tashkent-city', name: 'Sergeli' },
      { id: 'tashkent-city-7', regionId: 'tashkent-city', name: 'Shayxontohur' },
      { id: 'tashkent-city-8', regionId: 'tashkent-city', name: 'Uchtepa' },
      { id: 'tashkent-city-9', regionId: 'tashkent-city', name: 'Yakkasaroy' },
      { id: 'tashkent-city-10', regionId: 'tashkent-city', name: 'Yangiobod' },
      { id: 'tashkent-city-11', regionId: 'tashkent-city', name: 'Yunusobod' },
      
      // Toshkent viloyati
      { id: 'tashkent-1', regionId: 'tashkent', name: 'Angren' },
      { id: 'tashkent-2', regionId: 'tashkent', name: 'Bekobod' },
      { id: 'tashkent-3', regionId: 'tashkent', name: 'Bo\'ka' },
      { id: 'tashkent-4', regionId: 'tashkent', name: 'Bo\'stonliq' },
      { id: 'tashkent-5', regionId: 'tashkent', name: 'Chinoz' },
      { id: 'tashkent-6', regionId: 'tashkent', name: 'Qibray' },
      { id: 'tashkent-7', regionId: 'tashkent', name: 'Ohangaron' },
      { id: 'tashkent-8', regionId: 'tashkent', name: 'Oqqo\'rg\'on' },
      { id: 'tashkent-9', regionId: 'tashkent', name: 'Parkent' },
      { id: 'tashkent-10', regionId: 'tashkent', name: 'Piskent' },
      { id: 'tashkent-11', regionId: 'tashkent', name: 'Quyichirchiq' },
      { id: 'tashkent-12', regionId: 'tashkent', name: 'Yangiyol' },
      { id: 'tashkent-13', regionId: 'tashkent', name: 'Yuqorichirchiq' },
      { id: 'tashkent-14', regionId: 'tashkent', name: 'Zangiota' },
      
      // Andijon
      { id: 'andijan-1', regionId: 'andijan', name: 'Andijon shahri' },
      { id: 'andijan-2', regionId: 'andijan', name: 'Asaka' },
      { id: 'andijan-3', regionId: 'andijan', name: 'Baliqchi' },
      { id: 'andijan-4', regionId: 'andijan', name: 'Bo\'z' },
      { id: 'andijan-5', regionId: 'andijan', name: 'Buloqboshi' },
      { id: 'andijan-6', regionId: 'andijan', name: 'Izboskan' },
      { id: 'andijan-7', regionId: 'andijan', name: 'Jalaquduq' },
      { id: 'andijan-8', regionId: 'andijan', name: 'Qo\'rg\'ontepa' },
      { id: 'andijan-9', regionId: 'andijan', name: 'Marhamat' },
      { id: 'andijan-10', regionId: 'andijan', name: 'Oltinko\'l' },
      { id: 'andijan-11', regionId: 'andijan', name: 'Paxtaobod' },
      { id: 'andijan-12', regionId: 'andijan', name: 'Shahrixon' },
      { id: 'andijan-13', regionId: 'andijan', name: 'Ulug\'nor' },
      { id: 'andijan-14', regionId: 'andijan', name: 'Xo\'jaobod' },
      
      // Samarqand
      { id: 'samarkand-1', regionId: 'samarkand', name: 'Samarqand shahri' },
      { id: 'samarkand-2', regionId: 'samarkand', name: 'Bulung\'ur' },
      { id: 'samarkand-3', regionId: 'samarkand', name: 'Ishtixon' },
      { id: 'samarkand-4', regionId: 'samarkand', name: 'Jomboy' },
      { id: 'samarkand-5', regionId: 'samarkand', name: 'Kattaqo\'rg\'on' },
      { id: 'samarkand-6', regionId: 'samarkand', name: 'Narpay' },
      { id: 'samarkand-7', regionId: 'samarkand', name: 'Nurobod' },
      { id: 'samarkand-8', regionId: 'samarkand', name: 'Oqdaryo' },
      { id: 'samarkand-9', regionId: 'samarkand', name: 'Paxtachi' },
      { id: 'samarkand-10', regionId: 'samarkand', name: 'Payariq' },
      { id: 'samarkand-11', regionId: 'samarkand', name: 'Pastdarg\'om' },
      { id: 'samarkand-12', regionId: 'samarkand', name: 'Qo\'shrabot' },
      { id: 'samarkand-13', regionId: 'samarkand', name: 'Samarqand' },
      { id: 'samarkand-14', regionId: 'samarkand', name: 'Toyloq' },
      { id: 'samarkand-15', regionId: 'samarkand', name: 'Urgut' },
      
      // Farg'ona
      { id: 'fergana-1', regionId: 'fergana', name: 'Farg\'ona shahri' },
      { id: 'fergana-2', regionId: 'fergana', name: 'Beshariq' },
      { id: 'fergana-3', regionId: 'fergana', name: 'Bog\'dod' },
      { id: 'fergana-4', regionId: 'fergana', name: 'Buvayda' },
      { id: 'fergana-5', regionId: 'fergana', name: 'Dang\'ara' },
      { id: 'fergana-6', regionId: 'fergana', name: 'Farg\'ona' },
      { id: 'fergana-7', regionId: 'fergana', name: 'Furqat' },
      { id: 'fergana-8', regionId: 'fergana', name: 'O\'zbekiston' },
      { id: 'fergana-9', regionId: 'fergana', name: 'Qo\'shtepa' },
      { id: 'fergana-10', regionId: 'fergana', name: 'Quva' },
      { id: 'fergana-11', regionId: 'fergana', name: 'Rishton' },
      { id: 'fergana-12', regionId: 'fergana', name: 'So\'x' },
      { id: 'fergana-13', regionId: 'fergana', name: 'Toshloq' },
      { id: 'fergana-14', regionId: 'fergana', name: 'Uchko\'prik' },
      { id: 'fergana-15', regionId: 'fergana', name: 'Yozyovon' },
      
      // Namangan
      { id: 'namangan-1', regionId: 'namangan', name: 'Namangan shahri' },
      { id: 'namangan-2', regionId: 'namangan', name: 'Chortoq' },
      { id: 'namangan-3', regionId: 'namangan', name: 'Chust' },
      { id: 'namangan-4', regionId: 'namangan', name: 'Kosonsoy' },
      { id: 'namangan-5', regionId: 'namangan', name: 'Mingbuloq' },
      { id: 'namangan-6', regionId: 'namangan', name: 'Namangan' },
      { id: 'namangan-7', regionId: 'namangan', name: 'Norin' },
      { id: 'namangan-8', regionId: 'namangan', name: 'Pop' },
      { id: 'namangan-9', regionId: 'namangan', name: 'To\'raqo\'rg\'on' },
      { id: 'namangan-10', regionId: 'namangan', name: 'Uchqo\'rg\'on' },
      { id: 'namangan-11', regionId: 'namangan', name: 'Uychi' },
      { id: 'namangan-12', regionId: 'namangan', name: 'Yangiqo\'rg\'on' },
      
      // Buxoro
      { id: 'bukhara-1', regionId: 'bukhara', name: 'Buxoro shahri' },
      { id: 'bukhara-2', regionId: 'bukhara', name: 'Olot' },
      { id: 'bukhara-3', regionId: 'bukhara', name: 'G\'ijduvon' },
      { id: 'bukhara-4', regionId: 'bukhara', name: 'Jondor' },
      { id: 'bukhara-5', regionId: 'bukhara', name: 'Kogon' },
      { id: 'bukhara-6', regionId: 'bukhara', name: 'Qorako\'l' },
      
      // Jizzax
      { id: 'jizzakh-1', regionId: 'jizzakh', name: 'Jizzax shahri' },
      { id: 'jizzakh-2', regionId: 'jizzakh', name: 'Arnasoy' },
      { id: 'jizzakh-3', regionId: 'jizzakh', name: 'Baxmal' },
      { id: 'jizzakh-4', regionId: 'jizzakh', name: 'Do\'stlik' },
      { id: 'jizzakh-5', regionId: 'jizzakh', name: 'Forish' },
      { id: 'jizzakh-6', regionId: 'jizzakh', name: 'G\'allaorol' },
      
      // Navoiy
      { id: 'navoiy-1', regionId: 'navoiy', name: 'Navoiy shahri' },
      { id: 'navoiy-2', regionId: 'navoiy', name: 'Karmana' },
      { id: 'navoiy-3', regionId: 'navoiy', name: 'Konimex' },
      { id: 'navoiy-4', regionId: 'navoiy', name: 'Navbahor' },
      
      // Qashqadaryo
      { id: 'kashkadarya-1', regionId: 'kashkadarya', name: 'Qarshi shahri' },
      { id: 'kashkadarya-2', regionId: 'kashkadarya', name: 'Chiroqchi' },
      { id: 'kashkadarya-3', regionId: 'kashkadarya', name: 'Dehqonobod' },
      { id: 'kashkadarya-4', regionId: 'kashkadarya', name: 'G\'uzor' },
      { id: 'kashkadarya-5', regionId: 'kashkadarya', name: 'Shahrisabz' },
      
      // Sirdaryo
      { id: 'sirdarya-1', regionId: 'sirdarya', name: 'Guliston shahri' },
      { id: 'sirdarya-2', regionId: 'sirdarya', name: 'Boyovut' },
      { id: 'sirdarya-3', regionId: 'sirdarya', name: 'Mirzaobod' },
      { id: 'sirdarya-4', regionId: 'sirdarya', name: 'Sardoba' },
      
      // Surxondaryo
      { id: 'surxondaryo-1', regionId: 'surxondaryo', name: 'Termiz shahri' },
      { id: 'surxondaryo-2', regionId: 'surxondaryo', name: 'Angor' },
      { id: 'surxondaryo-3', regionId: 'surxondaryo', name: 'Boysun' },
      { id: 'surxondaryo-4', regionId: 'surxondaryo', name: 'Denov' },
      { id: 'surxondaryo-5', regionId: 'surxondaryo', name: 'Sherobod' },
      
      // Xorazm
      { id: 'khorezm-1', regionId: 'khorezm', name: 'Urganch shahri' },
      { id: 'khorezm-2', regionId: 'khorezm', name: 'Bog\'ot' },
      { id: 'khorezm-3', regionId: 'khorezm', name: 'Gurlan' },
      { id: 'khorezm-4', regionId: 'khorezm', name: 'Xiva' },
      { id: 'khorezm-5', regionId: 'khorezm', name: 'Xonqa' },
      
      // Qoraqalpog'iston
      { id: 'karakalpakstan-1', regionId: 'karakalpakstan', name: 'Nukus shahri' },
      { id: 'karakalpakstan-2', regionId: 'karakalpakstan', name: 'Amudaryo' },
      { id: 'karakalpakstan-3', regionId: 'karakalpakstan', name: 'Beruniy' },
      { id: 'karakalpakstan-4', regionId: 'karakalpakstan', name: 'Chimboy' },
      { id: 'karakalpakstan-5', regionId: 'karakalpakstan', name: 'Qo\'ng\'irot' },
    ];
    
    console.log(`✅ Returning ${districts.length} districts`);
    
    return c.json({ districts });
  } catch (error: any) {
    console.error('Get districts error:', error);
    return c.json({ error: `Tumanlarni olishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== DELIVERY ZONES ROUTES ====================

// Get all delivery zones for a branch
app.get("/make-server-27d0d16c/delivery-zones", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    
    console.log('🗺️ Getting delivery zones for branch:', branchId);
    
    const allZones = await kv.getByPrefix('delivery-zone:');
    
    // Filter by branchId if provided
    let zones = allZones;
    if (branchId) {
      zones = allZones.filter((zone: any) => zone.branchId === branchId);
    }
    
    console.log(`✅ Returning ${zones.length} delivery zones`);
    
    return c.json({ zones });
  } catch (error: any) {
    console.error('Get delivery zones error:', error);
    return c.json({ error: `Zonalarni olishda xatolik: ${error.message}` }, 500);
  }
});

// Add new delivery zone
app.post("/make-server-27d0d16c/delivery-zones", async (c) => {
  try {
    const data = await c.req.json();
    
    console.log('🗺️ Adding new delivery zone:', data.name);
    
    // Check max zones per branch
    const existingZones = await kv.getByPrefix('delivery-zone:');
    const branchZones = existingZones.filter((zone: any) => zone.branchId === data.branchId);
    
    if (branchZones.length >= 4) {
      return c.json({ error: 'Maksimal 4 ta zona qo\'shish mumkin' }, 400);
    }
    
    const zoneId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const zone = {
      id: zoneId,
      branchId: data.branchId,
      name: data.name,
      coordinates: data.coordinates,
      polygon: data.polygon,
      deliveryPrice: data.deliveryPrice,
      zoneIp: data.zoneIp,
      region: data.region,
      district: data.district,
      workingHours: data.workingHours,
      deliveryTime: data.deliveryTime,
      minOrderAmount: data.minOrderAmount,
      isActive: data.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`delivery-zone:${zoneId}`, zone);
    
    console.log('✅ Delivery zone added successfully');
    
    return c.json({ success: true, zone });
  } catch (error: any) {
    console.error('Add delivery zone error:', error);
    return c.json({ error: `Zona qo'shishda xatolik: ${error.message}` }, 500);
  }
});

// Update delivery zone
app.put("/make-server-27d0d16c/delivery-zones/:id", async (c) => {
  try {
    const zoneId = c.req.param('id');
    const data = await c.req.json();
    
    console.log('🗺️ Updating delivery zone:', zoneId);
    
    const existingZone = await kv.get(`delivery-zone:${zoneId}`);
    if (!existingZone) {
      return c.json({ error: 'Zona topilmadi' }, 404);
    }
    
    const updatedZone = {
      ...existingZone,
      name: data.name,
      coordinates: data.coordinates,
      polygon: data.polygon,
      deliveryPrice: data.deliveryPrice,
      zoneIp: data.zoneIp,
      region: data.region,
      district: data.district,
      workingHours: data.workingHours,
      deliveryTime: data.deliveryTime,
      minOrderAmount: data.minOrderAmount,
      isActive: data.isActive !== false,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`delivery-zone:${zoneId}`, updatedZone);
    
    console.log('✅ Delivery zone updated successfully');
    
    return c.json({ success: true, zone: updatedZone });
  } catch (error: any) {
    console.error('Update delivery zone error:', error);
    return c.json({ error: `Zona yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Delete delivery zone
app.delete("/make-server-27d0d16c/delivery-zones/:id", async (c) => {
  try {
    const zoneId = c.req.param('id');
    
    console.log('🗺️ Deleting delivery zone:', zoneId);
    
    const zone = await kv.get(`delivery-zone:${zoneId}`);
    if (!zone) {
      return c.json({ error: 'Zona topilmadi' }, 404);
    }
    
    await kv.del(`delivery-zone:${zoneId}`);
    
    console.log('✅ Delivery zone deleted successfully');
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete delivery zone error:', error);
    return c.json({ error: `Zona o'chirishda xatolik: ${error.message}` }, 500);
  }
});

// Detect delivery zone by coordinates (Point-in-Polygon)
app.post("/make-server-27d0d16c/delivery-zones/detect", async (c) => {
  try {
    const { lat, lng, branchId } = await c.req.json();
    
    console.log('📍 Detecting zone for coordinates:', { lat, lng, branchId });
    
    if (!lat || !lng) {
      return c.json({ error: 'Koordinatalar majburiy' }, 400);
    }
    
    // Get all zones
    const allZones = await kv.getByPrefix('delivery-zone:');
    
    // Filter by branchId if provided
    let zones = allZones;
    if (branchId) {
      zones = allZones.filter((zone: any) => zone.branchId === branchId);
    }
    
    // Filter only active zones with polygons
    const activeZones = zones.filter((zone: any) => zone.isActive && zone.polygon && zone.polygon.length > 0);
    
    console.log(`🔍 Checking ${activeZones.length} active zones`);
    
    // Point-in-Polygon algorithm (Ray Casting)
    function isPointInPolygon(point: { lat: number; lng: number }, polygon: any[]): boolean {
      let inside = false;
      const x = point.lng;
      const y = point.lat;
      
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng;
        const yi = polygon[i].lat;
        const xj = polygon[j].lng;
        const yj = polygon[j].lat;
        
        const intersect = ((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        
        if (intersect) inside = !inside;
      }
      
      return inside;
    }
    
    // Find zone containing the point
    for (const zone of activeZones) {
      const inPolygon = isPointInPolygon({ lat, lng }, zone.polygon);
      
      if (inPolygon) {
        console.log(`✅ Point is inside zone: ${zone.name}`);
        return c.json({ 
          success: true, 
          zone,
          message: `${zone.name} zonasiga tushadi` 
        });
      }
    }
    
    console.log('❌ Point is not in any zone');
    return c.json({ 
      success: false, 
      zone: null,
      message: 'Bu joylashuv hech qaysi yetkazib berish zonasiga kirmaydi' 
    }, 404);
  } catch (error: any) {
    console.error('Detect zone error:', error);
    return c.json({ error: `Zona aniqlashda xatolik: ${error.message}` }, 500);
  }
});

// ==================== ORDER REVIEWS (mijoz: sharx, ulashish) ====================

async function findKvOrderById(orderId: string): Promise<any | null> {
  const id = String(orderId || "").trim();
  if (!id) return null;
  const a = await kv.get(`order:${id}`);
  if (a) return a;
  const b = await kv.get(`order:market:${id}`);
  if (b) return b;
  const all = await kv.getByPrefix("order:");
  const list = Array.isArray(all) ? all : [];
  return (
    list.find(
      (o: any) =>
        o &&
        (String(o.id) === id ||
          String(o.orderNumber || "").replace(/^#/, "") === id.replace(/^#/, "")),
    ) || null
  );
}

function isKvOrderReviewable(order: any): boolean {
  const s = String(order?.status || "").toLowerCase().trim();
  if (["cancelled", "canceled"].includes(s)) return false;
  return ["delivered", "completed", "fulfilled"].includes(s);
}

async function assertUserOwnsReviewableOrder(
  authUserId: string,
  orderId: string,
): Promise<{ ok: boolean; error?: string }> {
  const oid = String(orderId || "").trim();
  if (!oid) return { ok: false, error: "orderId kerak" };

  const kvOrder = await findKvOrderById(oid);
  if (kvOrder) {
    if (String(kvOrder.userId || "") !== String(authUserId)) {
      return { ok: false, error: "Bu buyurtma sizga tegishli emas" };
    }
    if (!isKvOrderReviewable(kvOrder)) {
      return {
        ok: false,
        error: "Faqat yetkazilgan / yakunlangan buyurtmalarga sharh yozish mumkin",
      };
    }
    return { ok: true };
  }

  const profile = await kv.get(`user:${authUserId}`);
  const candidates = new Set(
    [authUserId, profile?.relationalUserId, profile?.dbUserId, profile?.userId]
      .filter(Boolean)
      .map((x: any) => String(x)),
  );

  const { data: row, error: qErr } = await supabase
    .from("orders")
    .select("id,status,user_id")
    .eq("id", oid)
    .maybeSingle();

  if (qErr || !row) {
    return { ok: false, error: "Buyurtma topilmadi" };
  }
  if (!candidates.has(String(row.user_id))) {
    return { ok: false, error: "Bu buyurtma sizga tegishli emas" };
  }
  const st = String(row.status || "").toLowerCase();
  if (st !== "fulfilled") {
    return {
      ok: false,
      error: "Faqat bajarilgan buyurtmalarga sharh yozish mumkin",
    };
  }
  return { ok: true };
}

function buildOrderReviewStorageKey(userId: string, orderId: string) {
  return `user:${userId}:order_review:${String(orderId).trim()}`;
}

app.post("/make-server-27d0d16c/user/order-reviews", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ success: false, error: auth.error }, 401);
    }
    const body = await c.req.json();
    const orderId = String(body.orderId || "").trim();
    const rating = Number(body.rating);
    const comment = String(body.comment || "").trim().slice(0, 4000);

    if (!orderId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      return c.json(
        { success: false, error: "orderId va rating (1–5) majburiy" },
        400,
      );
    }

    const gate = await assertUserOwnsReviewableOrder(auth.userId, orderId);
    if (!gate.ok) {
      return c.json({ success: false, error: gate.error }, 403);
    }

    const key = buildOrderReviewStorageKey(auth.userId, orderId);
    const existing = (await kv.get(key)) || {};
    const profile = await kv.get(`user:${auth.userId}`);
    const authorName =
      String(profile?.name || profile?.firstName || "Mijoz").trim() || "Mijoz";
    const now = new Date().toISOString();
    const record = {
      ...existing,
      orderId,
      userId: auth.userId,
      rating,
      comment,
      authorName,
      updatedAt: now,
      createdAt: existing.createdAt || now,
    };
    await kv.set(key, record);

    return c.json({ success: true, review: record });
  } catch (e: any) {
    console.error("order-reviews POST:", e);
    return c.json({ success: false, error: "Sharxni saqlashda xatolik" }, 500);
  }
});

app.post("/make-server-27d0d16c/user/order-reviews/share", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ success: false, error: auth.error }, 401);
    }
    const body = await c.req.json();
    const orderId = String(body.orderId || "").trim();
    if (!orderId) {
      return c.json({ success: false, error: "orderId kerak" }, 400);
    }

    const key = buildOrderReviewStorageKey(auth.userId, orderId);
    let review = await kv.get(key);
    const rNum = Number(review?.rating);
    if (
      !review ||
      !Number.isFinite(rNum) ||
      rNum < 1 ||
      rNum > 5 ||
      String(review.userId || "") !== String(auth.userId)
    ) {
      return c.json(
        {
          success: false,
          error: "Avval sharx yozib saqlang — keyin havola ochiladi",
        },
        400,
      );
    }

    let token = String(review.shareToken || "").trim();
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      review = { ...review, shareToken: token, shareCreatedAt: new Date().toISOString() };
      await kv.set(key, review);
    }

    await kv.set(`order_review_share:${token}`, {
      userId: auth.userId,
      orderId,
      updatedAt: new Date().toISOString(),
    });

    return c.json({
      success: true,
      token,
      path: `/order-review/${token}`,
    });
  } catch (e: any) {
    console.error("order-reviews share:", e);
    return c.json({ success: false, error: "Havola yaratishda xatolik" }, 500);
  }
});

app.get("/make-server-27d0d16c/public/order-review/:token", async (c) => {
  try {
    const token = String(c.req.param("token") || "").trim();
    if (!token) {
      return c.json({ success: false, error: "Token kerak" }, 400);
    }
    const link = await kv.get(`order_review_share:${token}`);
    if (!link || !link.userId || !link.orderId) {
      return c.json({ success: false, error: "Havola eskirgan yoki topilmadi" }, 404);
    }
    const key = buildOrderReviewStorageKey(link.userId, link.orderId);
    const review = await kv.get(key);
    if (!review || !review.rating) {
      return c.json({ success: false, error: "Sharx topilmadi" }, 404);
    }

    const order = await findKvOrderById(String(link.orderId));
    const orderNumber = order
      ? String(order.orderNumber || order.id || link.orderId)
      : String(link.orderId);

    return c.json({
      success: true,
      payload: {
        rating: review.rating,
        comment: review.comment || "",
        authorName: review.authorName || "Mijoz",
        orderNumber,
        updatedAt: review.updatedAt || review.createdAt,
      },
    });
  } catch (e: any) {
    console.error("public order-review:", e);
    return c.json({ success: false, error: "Yuklashda xatolik" }, 500);
  }
});

// ==================== ORDERS ROUTES ====================

// Get all orders
app.get("/make-server-27d0d16c/orders", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    const orderType = c.req.query('orderType'); // market, shop, food, rental
    const status = c.req.query('status'); // pending, confirmed, delivering, completed, cancelled
    
    console.log('📦 Getting orders:', { branchId, orderType, status });
    
    const allOrders = await kv.getByPrefix('order:');
    
    // Filter orders
    let orders = allOrders;
    const userAuth = await validateAccessToken(c);
    if (userAuth.success && userAuth.userId && !branchId) {
      const uid = String(userAuth.userId).trim();
      orders = orders.filter((order: any) => String(order?.userId || '').trim() === uid);
    }
    if (branchId) {
      orders = orders.filter((order: any) => order.branchId === branchId);
    }
    if (orderType) {
      orders = orders.filter((order: any) => order.orderType === orderType);
    }
    if (status) {
      orders = orders.filter((order: any) => order.status === status);
    }
    
    // Sort by date (newest first)
    orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`✅ Returning ${orders.length} orders`);
    
    return c.json({ orders });
  } catch (error: any) {
    console.error('Get orders error:', error);
    return c.json({ error: `Buyurtmalarni olishda xatolik: ${error.message}` }, 500);
  }
});

async function assertBusinessHoursForStandardOrder(args: {
  orderType: string;
  deliveryZoneId?: string | null;
  shopId: string | null;
  restaurantId: string | null;
}): Promise<{ error: string; opensAt: string | null } | null> {
  const ref = new Date();
  const zid = args.deliveryZoneId != null ? String(args.deliveryZoneId).trim() : '';
  if (zid) {
    const zone = await kv.get(`delivery-zone:${zid}`);
    const ev = businessHours.evaluateHourStrings(
      businessHours.collectHourStringsFromRecord(zone as Record<string, unknown>),
      ref,
    );
    if (!ev.allowed) {
      return {
        error: `Yetkazib berish zonasi hozir ochiq emas${ev.label ? ` (ish vaqti: ${ev.label})` : ''}.`,
        opensAt: ev.nextOpenIso,
      };
    }
  }
  if (args.orderType === 'shop' && args.shopId) {
    const sid = businessHours.normalizeShopKey(String(args.shopId));
    if (sid) {
      const shop = await kv.get(`shop:${sid}`);
      const ev = businessHours.evaluateHourStrings(
        businessHours.collectHourStringsFromRecord(shop as Record<string, unknown>),
        ref,
      );
      if (!ev.allowed) {
        return {
          error: `Do‘kon hozir buyurtma qabul qilmaydi${ev.label ? ` (ish vaqti: ${ev.label})` : ''}.`,
          opensAt: ev.nextOpenIso,
        };
      }
    }
  }
  if ((args.orderType === 'food' || args.orderType === 'restaurant') && args.restaurantId) {
    const rid = String(args.restaurantId).trim();
    const key = rid.startsWith('restaurant:') ? rid : `restaurant:${rid}`;
    const restaurant = await kv.get(key);
    const ev = businessHours.evaluateHourStrings(
      businessHours.collectHourStringsFromRecord(restaurant as Record<string, unknown>),
      ref,
    );
    if (!ev.allowed) {
      return {
        error: `Restoran hozir buyurtma qabul qilmaydi${ev.label ? ` (ish vaqti: ${ev.label})` : ''}.`,
        opensAt: ev.nextOpenIso,
      };
    }
  }
  return null;
}

// Create new order (GENERAL - Market, Food, Rental)
app.post("/make-server-27d0d16c/orders", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    if (!auth.success || !auth.userId) {
      return c.json({ error: auth.error }, 401);
    }

    const data = await c.req.json();
    const userProfile = await kv.get(`user:${auth.userId}`);
    
    console.log('📦 ===== CREATING NEW ORDER =====');
    console.log('📦 Full request data:', JSON.stringify(data, null, 2));
    console.log('📦 Order type:', data.orderType);
    console.log('📦 Customer:', data.customerName, data.customerPhone);
    console.log('📦 Payment:', data.paymentMethod, data.paymentStatus);
    console.log('📦 Items count:', data.items?.length);
    console.log('📦 Total:', data.finalTotal);
    console.log('📦 Delivery zone:', data.deliveryZone);

    if (!Array.isArray(data.items) || data.items.length === 0) {
      return c.json({ error: 'Buyurtma uchun kamida bitta mahsulot kerak' }, 400);
    }

    const rawOrderType = String(data.orderType || '').toLowerCase().trim();
    if (!rawOrderType || !['market', 'shop', 'food', 'rental', 'restaurant'].includes(rawOrderType)) {
      return c.json({ error: 'Buyurtma turi noto\'g\'ri' }, 400);
    }

    const orderId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    /** v2 / mijoz ba'zan `restaurant` yuboradi — ichki logika `food` bilan bir xil */
    const normalizedOrderType = rawOrderType === 'restaurant' ? 'food' : rawOrderType;

    const commissionPack = await enrichOrderItemsWithPlatformCommission(
      Array.isArray(data.items) ? data.items : [],
      normalizedOrderType,
    );
    if (!commissionPack.ok) {
      return c.json({ error: commissionPack.error }, 400);
    }

    const bonusUsedAmt = Math.max(0, Math.floor(Number(data.bonusUsed) || 0));
    if (bonusUsedAmt > 0) {
      try {
        const bd = await getUserBonusData(auth.userId);
        const bal = Math.floor(Number(bd.balance) || 0);
        if (bal < bonusUsedAmt) {
          return c.json(
            {
              error: `Bonus balansi yetarli emas. Mavjud: ${bal} so'm, so'ralgan: ${bonusUsedAmt} so'm`,
            },
            400,
          );
        }
      } catch (bonusPreErr) {
        console.error('[orders] bonus pre-check', bonusPreErr);
        return c.json({ error: 'Bonus balansini tekshirishda xatolik' }, 500);
      }
    }

    /** Mijoz tanlagan usul (do‘kon/taom uchun ham market kabi: naqd, payme, click, atmos, qr) */
    const normalizedPaymentMethod = String(data.paymentMethod || 'cash').toLowerCase().trim();
    /** Checkout onlayn to‘lovda `paymentStatus: paid` yuboradi; avvaldoim `pending` qilib KV buzilgan edi. */
    const bodyPaymentNorm = normalizeIncomingOrderCreatePaymentStatus(data.paymentStatus);
    const cashLike =
      normalizedPaymentMethod === 'cash' ||
      normalizedPaymentMethod === 'naqd' ||
      normalizedPaymentMethod === 'cod';
    let paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded';
    if (bodyPaymentNorm === 'failed' || bodyPaymentNorm === 'refunded') {
      paymentStatus = bodyPaymentNorm;
    } else if (cashLike) {
      paymentStatus = 'pending';
    } else {
      paymentStatus = bodyPaymentNorm === 'paid' ? 'paid' : 'pending';
    }
    const branchId = await inferOrderBranchId(data);
    const branch = branchId ? await kv.get(`branch:${branchId}`) : null;
    let inferredShopId: string | null = (() => {
      if (normalizedOrderType !== 'shop') return null;
      const items = Array.isArray(data.items) ? data.items : [];
      const first = items[0] || null;
      const candidates = [
        first?.shopId,
        first?.product?.shopId,
        first?.variant?.shopId,
        first?.product?.shop?.id,
        first?.shop?.id,
      ].filter(Boolean);

      const shopId = candidates
        .map((x: any) => String(x))
        .map((s) => (s.startsWith('shop:') ? s.slice('shop:'.length) : s))
        .find((s) => s.length > 0);

      return shopId || null;
    })();

    if (normalizedOrderType === 'shop') {
      const fromProducts = await resolveShopIdFromShopProductOrderLines(data.items, inferredShopId);
      if (fromProducts) inferredShopId = fromProducts;
    }
    const inferredRestaurantId = (() => {
      if (normalizedOrderType !== 'food' && normalizedOrderType !== 'restaurant') return null;
      const items = Array.isArray(data.items) ? data.items : [];
      const first = items[0] || null;
      const candidates = [
        data?.restaurantId,
        first?.restaurantId,
        first?.dishDetails?.restaurantId,
      ].filter(Boolean);

      const restaurantId = candidates
        .map((x: any) => String(x))
        .map((s) => (s.startsWith('restaurant:') ? s.slice('restaurant:'.length) : s))
        .find((s) => s.length > 0);

      return restaurantId || null;
    })();
    const customerLocation =
      extractCustomerLocation(data) ||
      (data.deliveryZone ? getZoneCenter(await kv.get(`delivery-zone:${data.deliveryZone}`)) : null);
    const zoneRecord = data.deliveryZone ? await kv.get(`delivery-zone:${data.deliveryZone}`) : null;

    const hoursBlock = await assertBusinessHoursForStandardOrder({
      orderType: normalizedOrderType,
      deliveryZoneId: data.deliveryZone,
      shopId: inferredShopId,
      restaurantId: inferredRestaurantId,
    });
    if (hoursBlock) {
      return c.json(
        {
          error: hoursBlock.error,
          errorCode: 'outside_business_hours',
          opensAt: hoursBlock.opensAt,
        },
        409,
      );
    }

    const addressText = typeof data.address === 'object'
      ? [
          data.address?.street,
          data.address?.building,
          data.address?.apartment,
          data.address?.note,
        ].filter(Boolean).join(', ')
      : String(data.address || '');
    
    // Determine initial status based on payment
    let initialStatus = 'pending';
    if (data.orderType === 'market') {
      initialStatus = 'new';
    }
    
    const pickQrImage = (entity: any): string =>
      String(
        entity?.paymentQrImage ||
        entity?.paymentQRImage ||
        entity?.payment_qr_image ||
        entity?.paymentQr ||
        entity?.payment_qr ||
        entity?.qrImageUrl ||
        entity?.qrCode ||
        entity?.qr_code ||
        entity?.payment?.qrImage ||
        entity?.payment?.qrImageUrl ||
        entity?.payment?.qr ||
        entity?.paymentDetails?.qrImageUrl ||
        ''
      ).trim();
    let merchantPaymentQrUrl: string | null = null;
    if (normalizedOrderType === 'shop' && inferredShopId) {
      const shop = await kv.get(inferredShopId.startsWith('shop:') ? inferredShopId : `shop:${inferredShopId}`);
      merchantPaymentQrUrl = pickQrImage(shop) || null;
    } else if ((normalizedOrderType === 'food' || normalizedOrderType === 'restaurant') && inferredRestaurantId) {
      const restaurant = await kv.get(
        inferredRestaurantId.startsWith('restaurant:') ? inferredRestaurantId : `restaurant:${inferredRestaurantId}`
      );
      merchantPaymentQrUrl = pickQrImage(restaurant) || null;
    }
    if (!merchantPaymentQrUrl) {
      merchantPaymentQrUrl = pickQrImage(branch) || null;
    }
    /** Faqat kassa QR oqimi: chek yuklanmaguncha «to‘langan» deb qabul qilinmaydi. Onlayn to‘lov allaqachon paid. */
    const wantsCashierQrReceipt =
      normalizedPaymentMethod === 'qr' || normalizedPaymentMethod === 'qrcode';
    const paymentRequiresVerification = paymentStatus !== 'paid' && wantsCashierQrReceipt;

    // Market + naqd: filial "qabul qilish"gacha tayyorlovchi panelida ko‘rinmasin; onlayn to‘lov — darhol tayyorlovchiga.
    const marketCashHold =
      normalizedOrderType === 'market' &&
      (normalizedPaymentMethod === 'cash' || normalizedPaymentMethod === 'naqd');
    const branchCashHold =
      (normalizedOrderType === 'shop' || normalizedOrderType === 'food') &&
      (normalizedPaymentMethod === 'cash' || normalizedPaymentMethod === 'naqd');
    const shopOrFoodOnlinePaid =
      (normalizedOrderType === 'shop' || normalizedOrderType === 'food') &&
      paymentStatus === 'paid' &&
      ONLINE_PAYMENT_METHODS.has(normalizedPaymentMethod);
    const releasedToPreparerAt =
      normalizedOrderType === 'market' && !marketCashHold
        ? new Date().toISOString()
        : shopOrFoodOnlinePaid
          ? new Date().toISOString()
          : undefined;

    const foodOrderMirrorKey =
      normalizedOrderType === 'food' && inferredRestaurantId
        ? (() => {
            const rid = String(inferredRestaurantId).trim();
            const canon = rid.startsWith('restaurant:') ? rid : `restaurant:${rid}`;
            return `order:restaurant:${canon}:${orderId}`;
          })()
        : null;

    const order = {
      id: orderId,
      orderNumber: `ORD-${Date.now()}`,
      userId: auth.userId,
      customerName: data.customerName || userProfile?.name || userProfile?.firstName || 'Mijoz',
      customerPhone: data.customerPhone || userProfile?.phone || '',
      orderType: normalizedOrderType, // market, shop, food, rental
      items: commissionPack.items,
      platformCommissionTotalUzs: commissionPack.platformCommissionTotalUzs,
      merchantGoodsPayoutUzs: commissionPack.merchantGoodsPayoutUzs,
      commissionableItemsSubtotalUzs: commissionPack.commissionableItemsSubtotalUzs,
      branchMarketProfitTotalUzs: Number(commissionPack.branchMarketProfitTotalUzs) || 0,
      totalAmount: Number(data.totalAmount) || 0,
      deliveryPrice: Number(data.deliveryPrice) || 0,
      finalTotal: Number(data.finalTotal) || 0,
      paymentMethod: normalizedPaymentMethod, // cash, click, payme, atmos, qr
      paymentStatus,
      shopId: inferredShopId,
      restaurantId: inferredRestaurantId,
      merchantPaymentQrUrl,
      paymentRequiresVerification,
      promoCode: data.promoCode || null,
      bonusUsed: bonusUsedAmt,
      address: data.address,
      addressText,
      addressType: data.addressType,
      customerLocation,
      deliveryZone: data.deliveryZone,
      zoneIp: normalizeZoneIpToken(data.zoneIp || zoneRecord?.zoneIp || data.address?.zoneIp || data.zone?.ip),
      status: initialStatus, // new, preparing, with_courier, delivering, delivered, cancelled
      branchId,
      branchName: branch?.branchName || branch?.name || null,
      branchCoordinates: branch?.coordinates || null,
      notes: data.notes || '',
      statusHistory: [{
        status: initialStatus,
        timestamp: new Date().toISOString(),
        note: paymentRequiresVerification
          ? 'To\'lov tasdiqlanishi kutilmoqda'
          : 'Yangi buyurtma'
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(marketCashHold ? { marketCashHold: true } : {}),
      ...(branchCashHold ? { branchCashHold: true } : {}),
      ...(foodOrderMirrorKey ? { foodOrderMirrorKey } : {}),
      ...(releasedToPreparerAt ? { releasedToPreparerAt } : {}),
    };
    
    // Save order with type-specific key for better filtering
    const orderKey = normalizedOrderType === 'market' 
      ? `order:market:${orderId}` 
      : `order:${orderId}`;

    const itemsArr = commissionPack.items;
    const flaggedShopLines = itemsArr.filter(isShopProductCartLine);
    const applyShopInventory =
      normalizedOrderType === 'shop' || flaggedShopLines.length > 0;
    const linesForShopInventory = applyShopInventory
      ? normalizedOrderType === 'shop'
        ? itemsArr
        : flaggedShopLines
      : [];

    // Do'kon (shop_product) ombori: orderType noto'g'ri "market" bo'lsa ham shop_product-* qatorlari uchun tekshiruv va keyin kamaytirish
    if (applyShopInventory) {
      if (linesForShopInventory.length === 0) {
        return c.json({ error: "Do'kon mahsuloti qatorlari topilmadi" }, 400);
      }
      const needByVariant = new Map<
        string,
        { productKey: string; variantId: string; qty: number; label: string }
      >();
      for (const line of linesForShopInventory) {
        const pid = String(line?.id ?? line?.productId ?? '').trim();
        if (!pid) {
          return c.json({ error: "Buyurtma qatorida mahsulot ID yo'q" }, 400);
        }
        const productKey = pid.startsWith('shop_product:') ? pid : `shop_product:${pid}`;
        const qty = Math.max(0, Math.floor(Number(line?.quantity ?? 1)));
        if (qty <= 0) continue;
        const vidRaw = line?.selectedVariantId;
        const variantKey =
          vidRaw != null && String(vidRaw).trim() !== '' ? String(vidRaw).trim() : '__first__';
        const mapKey = `${productKey}\t${variantKey}`;
        const label = String(line?.name || 'Mahsulot');
        const prev = needByVariant.get(mapKey);
        if (prev) prev.qty += qty;
        else needByVariant.set(mapKey, { productKey, variantId: variantKey, qty, label });
      }

      const productCache = new Map<string, any>();

      for (const [, agg] of needByVariant) {
        let product = productCache.get(agg.productKey);
        if (!product) {
          product = await kv.get(agg.productKey);
          if (!product || product.deleted) {
            return c.json({ error: `Mahsulot topilmadi: ${agg.label}` }, 404);
          }
          productCache.set(agg.productKey, product);
        }
        const variant = resolveShopProductVariantForOrder(product, agg.variantId);
        if (!variant) {
          return c.json({ error: `Variant topilmadi: ${agg.label}` }, 400);
        }
        const stock = Math.floor(Number(variant.stock ?? variant.stockQuantity ?? 0));
        if (stock < agg.qty) {
          return c.json(
            {
              error: `Omborda yetarli mahsulot yo'q: ${String(product.name || agg.label)}. Mavjud: ${stock}, kerak: ${agg.qty}`,
              available: stock,
              requested: agg.qty,
            },
            400,
          );
        }
      }
    }

    // Bozor (filial branchproduct): faqat do'kon mahsuloti bo'lmagan qatorlar — aks holda market buyurtmada shop_product UUID talab qilinib xato berardi
    if (normalizedOrderType === 'market') {
      const marketLines = itemsArr.filter((line: any) => !isShopProductCartLine(line));
      if (marketLines.length > 0) {
        const needByVariant = new Map<
          string,
          { productKey: string; variantId: string; qty: number; label: string }
        >();

        for (const line of marketLines) {
          const storageId = resolveMarketCartBranchProductStorageId(line);
          if (!storageId) {
            return c.json(
              {
                error:
                  "Buyurtma qatorida filial mahsuloti UUID (productUuid) topilmadi. Ilovani yangilab qayta urinib ko'ring.",
              },
              400,
            );
          }
          const productKey = `branchproduct:${storageId}`;
          const qty = Math.max(0, Math.floor(Number(line?.quantity ?? 1)));
          if (qty <= 0) continue;
          const vidRaw = line?.selectedVariantId;
          const variantKey =
            vidRaw != null && String(vidRaw).trim() !== '' ? String(vidRaw).trim() : '__first__';
          const mapKey = `${productKey}\t${variantKey}`;
          const label = String(line?.name || 'Mahsulot');
          const prev = needByVariant.get(mapKey);
          if (prev) prev.qty += qty;
          else needByVariant.set(mapKey, { productKey, variantId: variantKey, qty, label });
        }

        const productCache = new Map<string, any>();
        const resolveMarketVariant = (product: any, variantId: string) => {
          const variants = Array.isArray(product?.variants) ? product.variants : [];
          if (variantId === '__first__') return variants[0] || null;
          return variants.find((v: any) => String(v?.id) === variantId) || null;
        };

        const orderBranchNorm = branchId ? String(branchId).trim() : '';

        for (const [, agg] of needByVariant) {
          let product = productCache.get(agg.productKey);
          if (!product) {
            product = await kv.get(agg.productKey);
            if (!product || product.deleted) {
              return c.json({ error: `Mahsulot topilmadi: ${agg.label}` }, 404);
            }
            productCache.set(agg.productKey, product);
          }
          if (orderBranchNorm && product.branchId && String(product.branchId).trim() !== orderBranchNorm) {
            return c.json(
              {
                error: `Mahsulot boshqa filialga tegishli: ${String(product.name || agg.label)}`,
              },
              400,
            );
          }
          const variant = resolveMarketVariant(product, agg.variantId);
          if (!variant) {
            return c.json({ error: `Variant topilmadi: ${agg.label}` }, 400);
          }
          const stock = Math.floor(
            Number(variant.stock ?? variant.stockQuantity ?? variant.stockCount ?? 0),
          );
          if (stock < agg.qty) {
            return c.json(
              {
                error: `Omborda yetarli mahsulot yo'q: ${String(product.name || agg.label)}. Mavjud: ${stock}, kerak: ${agg.qty}`,
                available: stock,
                requested: agg.qty,
              },
              400,
            );
          }
        }
      }
    }

    await kv.set(orderKey, order);
    if (foodOrderMirrorKey) {
      await kv.set(foodOrderMirrorKey, order);
    }

    if (bonusUsedAmt > 0) {
      try {
        const deduct = await deductBonusForOrderPurchase(
          auth.userId,
          bonusUsedAmt,
          orderId,
          'Buyurtmada bonus ishlatildi',
        );
        if (!deduct.ok) {
          console.error('[orders] bonus deduct failed after order save', deduct.error, {
            orderId,
            bonusUsedAmt,
          });
        }
      } catch (bonusDeductErr) {
        console.error('[orders] bonus deduct exception', bonusDeductErr, { orderId, bonusUsedAmt });
      }
    }

    if (applyShopInventory && linesForShopInventory.length > 0) {
      const needByVariant = new Map<
        string,
        { productKey: string; variantId: string; qty: number; label: string }
      >();
      for (const line of linesForShopInventory) {
        const pid = String(line?.id ?? line?.productId ?? '').trim();
        if (!pid) continue;
        const productKey = pid.startsWith('shop_product:') ? pid : `shop_product:${pid}`;
        const qty = Math.max(0, Math.floor(Number(line?.quantity ?? 1)));
        if (qty <= 0) continue;
        const vidRaw = line?.selectedVariantId;
        const variantKey =
          vidRaw != null && String(vidRaw).trim() !== '' ? String(vidRaw).trim() : '__first__';
        const mapKey = `${productKey}\t${variantKey}`;
        const label = String(line?.name || 'Mahsulot');
        const prev = needByVariant.get(mapKey);
        if (prev) prev.qty += qty;
        else needByVariant.set(mapKey, { productKey, variantId: variantKey, qty, label });
      }
      for (const [, agg] of needByVariant) {
        const product = await kv.get(agg.productKey);
        if (!product || product.deleted) {
          console.error('[orders] shop stock: product missing after save', agg.productKey);
          continue;
        }
        const variant = resolveShopProductVariantForOrder(product, agg.variantId);
        if (!variant) {
          console.error('[orders] shop stock: variant missing after save', agg);
          continue;
        }
        const stock = Math.floor(Number(variant.stock ?? variant.stockQuantity ?? 0));
        const next = Math.max(0, stock - agg.qty);
        variant.stock = next;
        variant.stockQuantity = next;
        adjustVariantSoldCount(variant, agg.qty);
        product.updatedAt = new Date().toISOString();
        await kv.set(agg.productKey, product);
      }
    }

    if (normalizedOrderType === 'market') {
      const marketLines = itemsArr.filter((line: any) => !isShopProductCartLine(line));
      if (marketLines.length === 0) {
        /* faqat do'kon mahsulotlari — branchproduct kamaytirish kerak emas */
      } else {
      const needByVariant = new Map<
        string,
        { productKey: string; variantId: string; qty: number; label: string }
      >();

      for (const line of marketLines) {
        const storageId = resolveMarketCartBranchProductStorageId(line);
        if (!storageId) continue;
        const productKey = `branchproduct:${storageId}`;
        const qty = Math.max(0, Math.floor(Number(line?.quantity ?? 1)));
        if (qty <= 0) continue;
        const vidRaw = line?.selectedVariantId;
        const variantKey =
          vidRaw != null && String(vidRaw).trim() !== '' ? String(vidRaw).trim() : '__first__';
        const mapKey = `${productKey}\t${variantKey}`;
        const label = String(line?.name || 'Mahsulot');
        const prev = needByVariant.get(mapKey);
        if (prev) prev.qty += qty;
        else needByVariant.set(mapKey, { productKey, variantId: variantKey, qty, label });
      }

      const resolveMarketVariant = (product: any, variantId: string) => {
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        if (variantId === '__first__') return variants[0] || null;
        return variants.find((v: any) => String(v?.id) === variantId) || null;
      };

      for (const [, agg] of needByVariant) {
        const product = await kv.get(agg.productKey);
        if (!product || product.deleted) continue;
        const variant = resolveMarketVariant(product, agg.variantId);
        if (!variant) continue;
        const stock = Math.floor(
          Number(variant.stock ?? variant.stockQuantity ?? variant.stockCount ?? 0),
        );
        const next = Math.max(0, stock - agg.qty);
        variant.stock = next;
        if (Object.prototype.hasOwnProperty.call(variant, 'stockQuantity')) {
          variant.stockQuantity = next;
        }
        if (Object.prototype.hasOwnProperty.call(variant, 'stockCount')) {
          variant.stockCount = next;
        }
        adjustVariantSoldCount(variant, agg.qty);
        product.updatedAt = new Date().toISOString();
        await kv.set(agg.productKey, product);
      }
      }
    }

    // Food buyurtmasi bo'lsa restoran Telegram chatiga xabar yuborish
    if (order.orderType === 'food') {
      try {
        const itemRestaurantId = String(data?.items?.[0]?.restaurantId || '').trim();
        const payloadRestaurantId = String(data?.restaurantId || '').trim();
        const restaurantRef = payloadRestaurantId || itemRestaurantId;

        let restaurant: any = null;
        if (restaurantRef) {
          const candidateKeys = [
            restaurantRef,
            `restaurant:${restaurantRef}`,
          ];
          for (const key of candidateKeys) {
            const found = await kv.get(key);
            if (found && !found.deleted) {
              restaurant = found;
              break;
            }
          }
        }

        const restTg = restaurant ? pickTelegramChatIdFromEntity(restaurant) : '';
        if (restaurant && restTg) {
          const itemsForTelegram = (Array.isArray(order.items) ? order.items : []).map((item: any) => ({
            name: String(item?.name || item?.title || item?.dishName || 'Taom'),
            variantName: String(item?.variantName || item?.size || 'Standart'),
            quantity: Number(item?.quantity || 1),
            price: Number(item?.price || 0),
            additionalProducts: (
              Array.isArray(item?.additionalProducts)
                ? item.additionalProducts
                : (Array.isArray(item?.addons) ? item.addons : (Array.isArray(item?.extras) ? item.extras : []))
            ).map((addon: any) => ({
                  name: String(addon?.name || 'Qo\'shimcha'),
                  price: Number(addon?.price || 0),
                  quantity: Number(addon?.quantity || 1),
                })),
          }));

          const sent = await telegram.sendOrderNotification({
            type: 'restaurant',
            shopName: String(restaurant.name || restaurant.title || 'Restoran'),
            shopChatId: restTg,
            orderNumber: String(order.orderNumber || order.id),
            customerName: String(order.customerName || 'Mijoz'),
            customerPhone: String(order.customerPhone || 'Ko‘rsatilmagan'),
            customerAddress: formatHumanOrderAddressForTelegram(order),
            items: itemsForTelegram,
            totalAmount: Number(order.finalTotal || order.totalAmount || 0),
            deliveryMethod: 'Yetkazib berish',
            paymentMethod: String(order.paymentMethod || 'cash'),
            orderDate: new Date(order.createdAt || Date.now()).toLocaleString('uz-UZ', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          });

          if (!sent) {
            console.log('⚠️ Food order Telegram notification yuborilmadi');
          } else {
            console.log('✅ Food order Telegram notification yuborildi');
          }
        } else {
          console.log('ℹ️ Food order: restaurant Telegram chat topilmadi (telegramChatId / telegram_chat_id)');
        }
      } catch (telegramError) {
        console.log('⚠️ Food order telegram notify xatolik:', telegramError);
      }
    }

    // Do'kon: Telegram (TELEGRAM_BOT_TOKEN). orderType=shop yoki market buyurtmada shop_product qatorlari.
    if (normalizedOrderType === 'shop') {
      await sendShopOrderTelegramNotification({
        order,
        data,
        branchId,
        orderIdForLog: orderId,
        lines: Array.isArray(order.items) ? order.items : [],
        shopIdNormHint: order.shopId || inferredShopId,
        totalAmount: Number(order.finalTotal || order.totalAmount || 0),
        contextLabel: 'orderType=shop',
      });
    } else if (normalizedOrderType === 'market' && flaggedShopLines.length > 0) {
      const groups = await groupShopLinesByShopIdForTelegram(flaggedShopLines);
      for (const [sidNorm, gLines] of groups) {
        const subtotal = gLines.reduce(
          (s, it) =>
            s + Number(it?.price ?? it?.unitPrice ?? 0) * Math.max(1, Number(it?.quantity ?? 1)),
          0,
        );
        await sendShopOrderTelegramNotification({
          order,
          data,
          branchId,
          orderIdForLog: orderId,
          lines: gLines,
          shopIdNormHint: sidNorm,
          totalAmount: subtotal > 0 ? subtotal : Number(order.finalTotal || order.totalAmount || 0),
          contextLabel: 'orderType=market+shop_lines',
        });
      }
    }

    console.log('✅ Order created successfully:', orderId);
    console.log('📦 Order key:', orderKey);
    console.log('📦 Order details:', {
      id: orderId,
      type: order.orderType,
      payment: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
      total: order.finalTotal
    });
    console.log('📦 ===== ORDER CREATION COMPLETE =====\n');
    
    return c.json({ success: true, id: orderId, order });
  } catch (error: any) {
    console.error('❌ Create order error:', error);
    console.error('❌ Error stack:', error.stack);
    return c.json({ error: `Buyurtma yaratishda xatolik: ${error.message}` }, 500);
  }
});

// ===== SPECIFIC ROUTES (must be before dynamic :id routes) =====

function parseKvOrderValue(value: unknown): any | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value as any;
  return null;
}

function inferCreatedAtFromKvKey(kvKey: string): string | undefined {
  const last = kvKey.split(':').pop();
  if (!last || !/^\d{10,}$/.test(last)) return undefined;
  const ms = Number(last);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

/** Provayderlar turli qatorlar yuboradi — admin UI uchun bitta enum */
function normalizeOrderPaymentStatusForAdmin(raw: unknown): 'paid' | 'pending' | 'failed' | 'refunded' {
  const s = String(raw ?? '').toLowerCase().trim();
  if (
    ['paid', 'completed', 'complete', 'success', 'succeeded', 'successful', 'captured', 'settled', 'paid_out'].includes(
      s,
    )
  ) {
    return 'paid';
  }
  if (['failed', 'error', 'declined', 'rejected', 'expired'].includes(s)) {
    return 'failed';
  }
  if (['refunded', 'partially_refunded', 'partial_refund'].includes(s)) {
    return 'refunded';
  }
  if (['pending', 'processing', 'awaiting', 'unpaid', 'new', 'created', 'authorized'].includes(s) || !s) {
    return 'pending';
  }
  return 'pending';
}

function orderTotalMoneyForStats(o: any): number {
  const n = Number(o?.finalTotal ?? o?.totalAmount ?? o?.totalPrice ?? o?.total ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Bir xil buyurtma `order:id` va `order:market:id` kalitlarida takrorlanmasin */
function dedupeNormalizedOrdersForAdmin(normalized: any[]): any[] {
  const byId = new Map<string, any>();
  for (const o of normalized) {
    const id = String(o?.id ?? '').trim();
    if (!id) continue;
    const prev = byId.get(id);
    const t = new Date(o.updatedAt ?? o.createdAt ?? 0).getTime();
    const pt = prev ? new Date(prev.updatedAt ?? prev.createdAt ?? 0).getTime() : -1;
    if (!prev || (Number.isFinite(t) && (!Number.isFinite(pt) || t >= pt))) {
      byId.set(id, o);
    }
  }
  return Array.from(byId.values());
}

/** Admin / filial UI uchun KV buyurtma qatorini bir xil maydonlarga keltirish */
function normalizeOrderRowForAdmin(raw: unknown, kvKey: string): any | null {
  const order = parseKvOrderValue(raw);
  if (!order || typeof order !== 'object') return null;
  if (order.deleted) return null;

  const keySuffix = kvKey.startsWith('order:') ? kvKey.slice('order:'.length) : kvKey;
  const idFromBody = order.id ?? order.orderId;
  const id = idFromBody || kvKey;

  const orderNumber = order.orderNumber ?? order.order_number;
  const orderIdDisplay = String(
    orderNumber || idFromBody || keySuffix || kvKey,
  ).replace(/^order:/, '');

  const rawType = order.orderType ?? order.type;
  const typeForUi = rawType === 'food' ? 'restaurant' : rawType;

  const totalRaw =
    order.totalAmount ?? order.finalTotal ?? order.totalPrice ?? order.total ?? 0;
  const totalAmount = Number(totalRaw);
  const totalAmountSafe = Number.isFinite(totalAmount) ? totalAmount : 0;

  let createdAt = order.createdAt ?? order.created_at ?? order.timestamp;
  if (!createdAt || !Number.isFinite(new Date(createdAt).getTime())) {
    const fromKey = inferCreatedAtFromKvKey(kvKey);
    if (fromKey) createdAt = fromKey;
  }
  if (!createdAt || !Number.isFinite(new Date(createdAt).getTime())) {
    createdAt = new Date(0).toISOString();
  }

  const customerName =
    order.customerName ?? order.customer_name ?? order.name ?? order.customer?.name ?? '';
  const customerPhone =
    order.customerPhone ??
    order.customer_phone ??
    order.phone ??
    order.customer?.phone ??
    '';

  let status = String(order.status ?? 'pending').toLowerCase();
  if (status === 'accepted') status = 'confirmed';
  else if (status === 'new' || status === '') status = 'pending';

  const payObj = order.payment && typeof order.payment === 'object' ? (order.payment as any) : null;
  const paymentSource =
    order.paymentStatus ??
    order.payment_status ??
    (order as any).paymentState ??
    (order as any).pay_status ??
    payObj?.status;

  const paymentStatus = normalizeOrderPaymentStatusForAdmin(paymentSource);

  const customerAddress =
    order.customerAddress ??
    order.addressText ??
    order.address?.street ??
    (typeof order.address === 'object' && order.address
      ? JSON.stringify(order.address)
      : order.address);

  return {
    ...order,
    id,
    orderId: orderIdDisplay,
    type: typeForUi,
    orderType: rawType,
    totalAmount: totalAmountSafe,
    createdAt,
    customerName,
    customerPhone,
    customerAddress,
    status,
    paymentStatus,
  };
}

// Get all orders (admin)
app.get('/make-server-27d0d16c/orders/all', async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    console.log('📦 Getting all orders');
    const rows = await kv.getByPrefixWithKeys('order:');
    console.log(`📦 Found ${rows.length} order kv rows`);

    const normalized = rows
      .map(({ key, value }) => normalizeOrderRowForAdmin(value, key))
      .filter((o): o is NonNullable<typeof o> => o != null);

    const deduped = dedupeNormalizedOrdersForAdmin(normalized);
    const sortedOrders = [...deduped].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return c.json({ success: true, orders: sortedOrders, total: sortedOrders.length });
  } catch (error: any) {
    console.error('Get all orders error:', error);
    return c.json({ error: `Buyurtmalarni olishda xatolik: ${error.message}` }, 500);
  }
});

// Branch-specific orders (staff/operator read-only uchun)
app.get('/make-server-27d0d16c/orders/branch', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ error: branchAuth.error }, 403);
    }

    const requestedBranchId = c.req.query('branchId')
      ? String(c.req.query('branchId')).trim()
      : '';
    if (requestedBranchId && requestedBranchId !== branchAuth.branchId) {
      return c.json({ error: "Filialga ruxsat yo'q" }, 403);
    }

    const branchId = branchAuth.branchId;
    const type = (c.req.query('type') || 'all') ? String(c.req.query('type')).trim() : 'all';
    const refundQueue = String(c.req.query('refundQueue') || '').trim() === '1';

    const rows = await kv.getByPrefixWithKeys('order:');
    let orders = rows
      .map(({ key, value }) => normalizeOrderRowForAdmin(value, key))
      .filter((o): o is NonNullable<typeof o> => o != null)
      .filter((o: any) => o.branchId === branchId);

    if (refundQueue) {
      orders = orders.filter((o: any) => {
        const st = String(o.status || '').toLowerCase();
        if (st !== 'cancelled' && st !== 'canceled') return false;
        if (o.refundPending !== true) return false;
        if (o.refundResolvedAt) return false;
        const ot = String(o.orderType || '').toLowerCase();
        return ot === 'market' || ot === 'shop' || ot === 'food';
      });
    } else {
      const orderTypeMap: Record<string, string> = {
        all: '',
        market: 'market',
        shop: 'shop',
        rental: 'rental',
        food: 'food',
        restaurant: 'food', // food orders backendda `food` turi bilan saqlanadi; restaurant UI uchun alohida ko'rinish bo'lishi mumkin
      };

      const normalizedType = orderTypeMap[type] ?? '';
      if (normalizedType) {
        orders = orders.filter((o: any) => o.orderType === normalizedType);
      }
    }

    const sortedOrders = [...orders].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return c.json({ success: true, orders: sortedOrders, total: sortedOrders.length });
  } catch (error: any) {
    console.error('Get branch orders error:', error);
    return c.json({ error: 'Filial buyurtmalarini olishda xatolik' }, 500);
  }
});

/** Kassa: kuryer naqd pulini qabul qilish (mahsulot summasi, yetkazish kuryerda qoladi). */
app.get('/make-server-27d0d16c/branch/courier-cash-handoffs', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ error: branchAuth.error }, 403);
    }
    const branchId = String(branchAuth.branchId || '');
    const scope = String(c.req.query('scope') || 'pending').toLowerCase();

    const rows = await kv.getByPrefixWithKeys('order:');
    let orders = rows
      .map(({ key, value }) => normalizeOrderRowForAdmin(value, key))
      .filter((o): o is NonNullable<typeof o> => o != null)
      .filter((o: any) => String(o.branchId || '') === branchId)
      .filter((o: any) => {
        const st = String(o.courierCashHandoffStatus || '');
        if (scope === 'pending') return st === 'pending_cashier';
        if (scope === 'history') return st === 'cashier_received';
        return st === 'pending_cashier' || st === 'cashier_received';
      });

    orders.sort(
      (a: any, b: any) =>
        new Date(b.deliveredAt || b.handedToCustomerAt || b.updatedAt || 0).getTime() -
        new Date(a.deliveredAt || a.handedToCustomerAt || a.updatedAt || 0).getTime(),
    );

    const marketHandoffs = orders.slice(0, 200).map((o: any) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName || o.customer_name || '',
      customerPhone: o.customerPhone || o.customer_phone || o.phone || '',
      courierCashHandoffExpectedUzs: Number(o.courierCashHandoffExpectedUzs || 0),
      courierCashHandoffStatus: o.courierCashHandoffStatus,
      courierCashHandedToCashierAt: o.courierCashHandedToCashierAt || null,
      assignedCourierId: o.assignedCourierId || null,
      deliveredAt: o.deliveredAt || o.handedToCustomerAt || null,
      paymentMethod: o.paymentMethod || o.payment_method || '',
      finalTotal: Number(o.finalTotal ?? o.totalAmount ?? o.total ?? 0) || 0,
      deliveryFee:
        Number(o.deliveryPrice ?? o.deliveryFee ?? o.delivery_fee ?? 0) || 0,
      handoffKind: 'market' as const,
    }));

    const rentalRows = (await kv.getByPrefix(`rental_order_${branchId}_`)) || [];
    const rentalHandoffs: any[] = [];
    for (const ro of rentalRows) {
      if (!ro || String(ro.branchId || '') !== branchId) continue;
      const st = String(ro.courierCashHandoffStatus || '');
      if (scope === 'pending' && st !== 'pending_cashier') continue;
      if (scope === 'history' && st !== 'cashier_received') continue;
      if (
        scope !== 'pending' &&
        scope !== 'history' &&
        st !== 'pending_cashier' &&
        st !== 'cashier_received'
      ) {
        continue;
      }
      const sortAt =
        st === 'pending_cashier'
          ? ro.pickupCompletedAt || ro.updatedAt
          : ro.courierCashHandedToCashierAt || ro.updatedAt;
      rentalHandoffs.push({
        id: ro.id,
        orderNumber: ro.productName ? `Ijara · ${String(ro.productName)}` : 'Ijara',
        customerName: ro.customerName || '',
        customerPhone: ro.customerPhone || '',
        courierCashHandoffExpectedUzs: Number(ro.courierCashHandoffExpectedUzs || 0),
        courierCashHandoffStatus: ro.courierCashHandoffStatus,
        courierCashHandedToCashierAt: ro.courierCashHandedToCashierAt || null,
        assignedCourierId: ro.deliveryCourierId || null,
        deliveredAt: ro.pickupCompletedAt || null,
        paymentMethod: ro.paymentMethod || '',
        finalTotal: Number(ro.totalPrice ?? 0) || 0,
        deliveryFee: Number(ro.deliveryPrice ?? ro.deliveryFee ?? 0) || 0,
        handoffKind: 'rental' as const,
        __sortMs: new Date(sortAt || 0).getTime(),
      });
    }

    const merged = [
      ...marketHandoffs.map((h: any) => ({
        ...h,
        __sortMs: new Date(h.deliveredAt || 0).getTime(),
      })),
      ...rentalHandoffs,
    ].sort((a: any, b: any) => (b.__sortMs || 0) - (a.__sortMs || 0));

    const handoffs = merged.slice(0, 200).map(({ __sortMs, ...rest }: any) => rest);

    return c.json({ success: true, handoffs, total: handoffs.length });
  } catch (error: any) {
    console.error('courier-cash-handoffs GET:', error);
    return c.json({ error: 'Naqd topshiruvlarni olishda xatolik' }, 500);
  }
});

app.post('/make-server-27d0d16c/branch/courier-cash-handoffs/:orderId/confirm', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ error: branchAuth.error }, 403);
    }
    const orderId = String(c.req.param('orderId') || '').trim();
    if (!orderId) {
      return c.json({ error: 'Buyurtma ID kerak' }, 400);
    }
    const record = await getOrderRecord(orderId);
    if (record?.order) {
      const o = record.order;
      if (String(o.branchId || '') !== String(branchAuth.branchId || '')) {
        return c.json({ error: "Bu filial uchun ruxsat yo'q" }, 403);
      }
      if (String(o.courierCashHandoffStatus || '') !== 'pending_cashier') {
        return c.json({
          success: true,
          message: 'Allaqachon qabul qilingan yoki naqd topshiruv talab qilinmaydi',
          order: o,
        });
      }
      const now = new Date().toISOString();
      const updated = {
        ...o,
        courierCashHandoffStatus: 'cashier_received',
        courierCashHandedToCashierAt: now,
        updatedAt: now,
      };
      await kv.set(record.key, updated);
      return c.json({ success: true, order: updated, handoffKind: 'market' });
    }

    const rKey = `rental_order_${branchAuth.branchId}_${orderId}`;
    const rental = await kv.get(rKey);
    if (!rental) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }
    if (String(rental.branchId || '') !== String(branchAuth.branchId || '')) {
      return c.json({ error: "Bu filial uchun ruxsat yo'q" }, 403);
    }
    if (String(rental.courierCashHandoffStatus || '') !== 'pending_cashier') {
      return c.json({
        success: true,
        message: 'Allaqachon qabul qilingan yoki naqd topshiruv talab qilinmaydi',
        order: rental,
        handoffKind: 'rental',
      });
    }
    const nowR = new Date().toISOString();
    const updatedRental = {
      ...rental,
      courierCashHandoffStatus: 'cashier_received',
      courierCashHandedToCashierAt: nowR,
      updatedAt: nowR,
    };
    await kv.set(rKey, updatedRental);
    return c.json({ success: true, order: updatedRental, handoffKind: 'rental' });
  } catch (error: any) {
    console.error('courier-cash-handoffs confirm:', error);
    return c.json({ error: 'Qabul qilishda xatolik' }, 500);
  }
});

// Filial: naqd buyurtmani qabul qilib tayyorlovchi / sotuvchi / restoran jarayoniga chiqarish
app.post('/make-server-27d0d16c/orders/:orderId/release-to-preparer', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ error: branchAuth.error }, 403);
    }

    const orderId = String(c.req.param('orderId') || '').trim();
    if (!orderId) {
      return c.json({ error: 'Buyurtma ID kerak' }, 400);
    }

    const record = await getOrderRecord(orderId);
    if (!record?.order) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }

    const o = record.order;
    if (String(o.branchId || '') !== String(branchAuth.branchId || '')) {
      return c.json({ error: "Bu filial uchun ruxsat yo'q" }, 403);
    }
    const keyStr = String(record.key || '');
    const ot = String(o.orderType || o.type || '').toLowerCase();
    const isMarketOrder = ot === 'market' || keyStr.startsWith('order:market:');
    const isShopOrder = ot === 'shop';
    const isFoodOrder = ot === 'food' || ot === 'restaurant';
    if (!isMarketOrder && !isShopOrder && !isFoodOrder) {
      return c.json({ error: 'Faqat market, do‘kon yoki taom buyurtmalari' }, 400);
    }
    if (!isCashLikePaymentMethodRaw(o.paymentMethod ?? o.payment_method)) {
      return c.json({ error: "Faqat naqd to'lov bilan buyurtmalar" }, 400);
    }
    if (o.releasedToPreparerAt) {
      return c.json({ success: true, order: o, alreadyReleased: true });
    }

    const st = String(o.status || '').toLowerCase();
    if (st === 'cancelled' || st === 'canceled') {
      return c.json({ error: 'Buyurtma bekor qilingan' }, 400);
    }

    const now = new Date().toISOString();
    const updated = {
      ...o,
      releasedToPreparerAt: now,
      updatedAt: now,
      statusHistory: [
        ...(Array.isArray(o.statusHistory) ? o.statusHistory : []),
        {
          status: o.status || 'new',
          timestamp: now,
          note:
            isShopOrder
              ? "Filial qabul qildi — do‘kon paneliga chiqarildi"
              : isFoodOrder
                ? "Filial qabul qildi — restoran paneliga chiqarildi"
                : "Filial qabul qildi — tayyorlovchiga yuborildi",
        },
      ],
    };
    await kv.set(record.key, updated);
    await syncFoodOrderMirrorKv(updated);
    return c.json({ success: true, order: updated });
  } catch (error: any) {
    console.error('release-to-preparer error:', error);
    return c.json({ error: error?.message || 'Xatolik' }, 500);
  }
});

// Filial: kutilayotgan buyurtmani bekor qilish (naqd — oddiy; to‘langan — qaytarish navbatiga)
app.post('/make-server-27d0d16c/orders/:orderId/cancel-by-branch', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ error: branchAuth.error }, 403);
    }

    const orderId = String(c.req.param('orderId') || '').trim();
    if (!orderId) {
      return c.json({ error: 'Buyurtma ID kerak' }, 400);
    }

    const record = await getOrderRecord(orderId);
    if (!record?.order) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }

    const o = record.order as Record<string, any>;
    if (String(o.branchId || '') !== String(branchAuth.branchId || '')) {
      return c.json({ error: "Bu filial uchun ruxsat yo'q" }, 403);
    }

    const ot = String(o.orderType || o.type || '').toLowerCase();
    if (ot !== 'market' && ot !== 'shop' && ot !== 'food' && ot !== 'restaurant') {
      return c.json({ error: 'Faqat market / do‘kon / taom buyurtmalari' }, 400);
    }

    const st = String(o.status || '').toLowerCase();
    if (st === 'cancelled' || st === 'canceled') {
      return c.json({ success: true, order: o, alreadyCancelled: true });
    }

    const terminal = new Set([
      'delivered',
      'completed',
      'with_courier',
      'delivering',
      'ready',
      'preparing',
    ]);
    if (terminal.has(st)) {
      return c.json(
        { error: 'Buyurtma allaqachon jarayonda — filialdan bekor qilib bo‘lmaydi' },
        400,
      );
    }

    const pmRaw = o.paymentMethod ?? o.payment_method;
    const cashLike = isCashLikePaymentMethodRaw(pmRaw);
    const paidLike = isPaidLikeStatus(o.paymentStatus);
    const cashHeldAtBranch = cashLike && !o.releasedToPreparerAt;
    const pmLower = String(pmRaw || '').toLowerCase().trim();
    const looksOnlinePaid =
      ONLINE_PAYMENT_METHODS.has(pmLower) ||
      ['uzum', 'humo', 'stripe', 'apple', 'google'].some((x) => pmLower.includes(x)) ||
      pmLower === 'qr' ||
      pmLower === 'qrcode';
    const earlyPaidCancel =
      paidLike &&
      ['new', 'pending', 'confirmed'].includes(st) &&
      looksOnlinePaid;

    if (!cashHeldAtBranch && !earlyPaidCancel) {
      return c.json(
        { error: 'Filial ushbu buyurtmani hozircha bekor qila olmaydi' },
        400,
      );
    }

    if (!o.inventoryRestoredOnCancel) {
      await restoreInventoryFromOrder(o);
    }

    const now = new Date().toISOString();
    const refundPending = paidLike;
    const updated = {
      ...o,
      status: 'cancelled',
      inventoryRestoredOnCancel: true,
      refundPending,
      cancelledByBranchAt: now,
      cancellationSource: 'branch',
      updatedAt: now,
      statusHistory: [
        ...(Array.isArray(o.statusHistory) ? o.statusHistory : []),
        {
          status: 'cancelled',
          timestamp: now,
          note: refundPending
            ? "Filial bekor qildi — onlayn to‘lov qaytarishini tekshiring"
            : "Filial bekor qildi (naqd)",
        },
      ],
    };

    await kv.set(record.key, updated);
    await syncFoodOrderMirrorKv(updated);
    await applyOrderCancelOneDayLineCooldown(updated);

    try {
      await syncRelationalOrderFromLegacy({
        legacyOrderId: String(updated.id ?? orderId),
        kvStatus: 'cancelled',
        kvPaymentStatus: String(updated.paymentStatus || 'pending'),
        paymentRequiresVerification: Boolean(
          updated.paymentRequiresVerification ?? o.paymentRequiresVerification,
        ),
      });
    } catch (e) {
      console.warn('[cancel-by-branch] v2 sync:', e);
    }

    return c.json({ success: true, order: updated, refundPending });
  } catch (error: any) {
    console.error('cancel-by-branch error:', error);
    return c.json({ error: error?.message || 'Xatolik' }, 500);
  }
});

// Branch-specific orders from relational marketplace (Postgres) for operator/support UI
app.get('/make-server-27d0d16c/v2/branch/orders', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ success: false, error: branchAuth.error }, 403);
    }

    const requestedBranchId = c.req.query('branchId')
      ? String(c.req.query('branchId')).trim()
      : '';
    const sessionRelId = String(
      (branchAuth as { relationalBranchId?: string }).relationalBranchId || '',
    ).trim();
    const sessionBranchId = String(branchAuth.branchId || '').trim();
    if (
      requestedBranchId &&
      requestedBranchId !== sessionBranchId &&
      requestedBranchId !== sessionRelId
    ) {
      return c.json({ success: false, error: "Filialga ruxsat yo'q" }, 403);
    }

    const branchId = branchAuth.branchId;
    const pgBranchId = await resolvePostgresBranchId({
      branchId,
      relationalBranchId: sessionRelId || undefined,
    });
    if (!pgBranchId) {
      return c.json({ success: true, orders: [], total: 0 });
    }

    const type = (c.req.query('type') || 'all') ? String(c.req.query('type')).trim() : 'all';
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') || 100)));

    const orderTypeMap: Record<string, string> = {
      all: '',
      market: 'market',
      shop: 'shop',
      rental: 'rental',
      food: 'food',
      restaurant: 'food',
    };
    const normalizedType = orderTypeMap[type] ?? '';

    // Shallow embed only (same pattern as getSellerOrderQueue). Deep nesting
    // (order_addresses / payments) often breaks PostgREST; load those in follow-up queries.
    const { data, error } = await supabase
      .from('order_groups')
      .select(
        `
        id,
        order_id,
        branch_id,
        vertical_type,
        status,
        fulfillment_type,
        subtotal_amount,
        shipping_amount,
        total_amount,
        item_count,
        created_at,
        updated_at,
        order:order_id (
          id,
          order_number,
          status,
          payment_status,
          total_amount,
          created_at,
          updated_at
        ),
        items:order_items (
          id,
          product_name,
          variant_name,
          quantity,
          unit_price,
          total_amount,
          currency_code
        )
      `,
      )
      .eq('branch_id', pgBranchId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('v2 branch orders query error:', error);
      return c.json(
        {
          success: false,
          error: 'Buyurtmalarni olishda xatolik',
          details: error.message || String(error),
        },
        500,
      );
    }

    const groups = Array.isArray(data) ? data : [];
    const orderIds = [
      ...new Set(
        groups
          .map((g: any) => String(g?.order?.id || g?.order_id || '').trim())
          .filter((id: string) => POSTGRES_BRANCH_UUID_RE.test(id)),
      ),
    ];

    const shippingByOrderId = new Map<string, any>();
    const lastPaymentByOrderId = new Map<string, any>();

    if (orderIds.length > 0) {
      const chunkSize = 80;
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const [addrRes, payRes] = await Promise.all([
          supabase
            .from('order_addresses')
            .select(
              'order_id, role, recipient_name, recipient_phone, address_line1',
            )
            .in('order_id', chunk)
            .eq('role', 'shipping'),
          supabase
            .from('payments')
            .select(
              'order_id, provider, method_type, status, merchant_order_ref, created_at',
            )
            .in('order_id', chunk),
        ]);

        if (addrRes.error) {
          console.error('v2 branch orders addresses error:', addrRes.error);
          return c.json(
            {
              success: false,
              error: 'Buyurtmalarni olishda xatolik',
              details: addrRes.error.message || String(addrRes.error),
            },
            500,
          );
        }
        if (payRes.error) {
          console.error('v2 branch orders payments error:', payRes.error);
          return c.json(
            {
              success: false,
              error: 'Buyurtmalarni olishda xatolik',
              details: payRes.error.message || String(payRes.error),
            },
            500,
          );
        }

        for (const row of addrRes.data || []) {
          const oid = String((row as any)?.order_id || '');
          if (oid && !shippingByOrderId.has(oid)) {
            shippingByOrderId.set(oid, row);
          }
        }

        for (const row of payRes.data || []) {
          const oid = String((row as any)?.order_id || '');
          if (!oid) continue;
          const prev = lastPaymentByOrderId.get(oid);
          const t = new Date((row as any)?.created_at || 0).getTime();
          const pt = prev
            ? new Date((prev as any)?.created_at || 0).getTime()
            : -1;
          if (!prev || t >= pt) lastPaymentByOrderId.set(oid, row);
        }
      }
    }
    const filtered = normalizedType
      ? groups.filter((g: any) => String(g?.vertical_type || '') === normalizedType)
      : groups;

    const mapVerticalToLegacyType = (v: any) => {
      const x = String(v || '').toLowerCase().trim();
      if (x === 'food') return 'restaurant';
      if (x === 'shop') return 'shop';
      if (x === 'rental' || x === 'property' || x === 'place') return 'rental';
      return 'market';
    };

    const mapV2GroupStatusToLegacy = (raw: any) => {
      const s = String(raw || '').toLowerCase().trim();
      if (s === 'delivered') return 'delivered';
      if (s === 'in_transit') return 'delivering';
      if (s === 'ready_for_dispatch' || s === 'ready') return 'ready';
      if (s === 'preparing') return 'preparing';
      if (s === 'accepted') return 'confirmed';
      if (s === 'cancelled' || s === 'returned') return 'cancelled';
      return 'pending';
    };

    const mapV2PaymentStatusToLegacy = (raw: any) => {
      const s = String(raw || '').toLowerCase().trim();
      if (s === 'paid') return 'paid';
      if (s === 'failed') return 'failed';
      if (s === 'refunded' || s === 'partially_refunded') return 'refunded';
      if (s === 'cancelled') return 'refunded';
      return 'pending';
    };

    const orders = filtered.map((g: any) => {
      const o = g?.order || {};
      const oid = String(o?.id || g?.order_id || '').trim();
      const shipping = oid ? shippingByOrderId.get(oid) || null : null;
      const lastPayment = oid ? lastPaymentByOrderId.get(oid) || null : null;

      return {
        id: String(o?.id || g?.order_id || g?.id || ''),
        orderId: String(o?.order_number || o?.id || g?.order_id || ''),
        type: mapVerticalToLegacyType(g?.vertical_type),
        status: mapV2GroupStatusToLegacy(g?.status),
        paymentStatus: mapV2PaymentStatusToLegacy(o?.payment_status),
        customerName: String(shipping?.recipient_name || 'Mijoz'),
        customerPhone: String(shipping?.recipient_phone || ''),
        customerAddress: String(shipping?.address_line1 || ''),
        items: Array.isArray(g?.items)
          ? g.items.map((it: any) => ({
              id: it?.id,
              name: it?.product_name,
              variantName: it?.variant_name,
              quantity: Number(it?.quantity || 1),
              price: Number(it?.unit_price || 0),
              total: Number(it?.total_amount || 0),
              currency: it?.currency_code || 'UZS',
            }))
          : [],
        totalAmount: Number(o?.total_amount || g?.total_amount || 0),
        deliveryFee: Number(g?.shipping_amount || 0),
        createdAt: String(o?.created_at || g?.created_at || new Date().toISOString()),
        updatedAt: String(o?.updated_at || g?.updated_at || o?.created_at || g?.created_at || new Date().toISOString()),
        branchId,
        paymentMethod: lastPayment?.provider || lastPayment?.method_type || null,
        paymentMethodType: lastPayment?.method_type || null,
        paymentProvider: lastPayment?.provider || null,
      };
    });

    return c.json({ success: true, orders, total: orders.length });
  } catch (error: any) {
    console.error('v2 branch orders error:', error);
    return c.json({ success: false, error: 'Filial buyurtmalarini olishda xatolik' }, 500);
  }
});

// Get order statistics
app.get('/make-server-27d0d16c/orders/stats', async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    console.log('📦 Getting order statistics');
    const rows = await kv.getByPrefixWithKeys('order:');
    const normalized = rows
      .map(({ key, value }) => normalizeOrderRowForAdmin(value, key))
      .filter((o): o is NonNullable<typeof o> => o != null);
    const allOrders = dedupeNormalizedOrdersForAdmin(normalized);

    const paymentByStatus = { paid: 0, pending: 0, failed: 0, refunded: 0 };
    for (const o of allOrders) {
      const k = o.paymentStatus as keyof typeof paymentByStatus;
      if (k in paymentByStatus) paymentByStatus[k]++;
      else paymentByStatus.pending++;
    }

    const revenueTotal = allOrders.reduce((sum: number, o: any) => sum + orderTotalMoneyForStats(o), 0);
    const revenuePaid = allOrders
      .filter((o: any) => o.paymentStatus === 'paid')
      .reduce((sum: number, o: any) => sum + orderTotalMoneyForStats(o), 0);

    const recentActivity = [...allOrders]
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 12)
      .map((o: any) => ({
        id: o.id,
        orderId: o.orderId,
        customerName: o.customerName || '',
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        totalAmount: orderTotalMoneyForStats(o),
        orderType: o.orderType ?? o.type,
      }));

    const stats = {
      total: allOrders.length,
      paidOrderCount: paymentByStatus.paid,
      paymentByStatus,
      byType: {
        market: allOrders.filter((o: any) => o.orderType === 'market').length,
        shop: allOrders.filter((o: any) => o.orderType === 'shop').length,
        rental: allOrders.filter((o: any) => o.orderType === 'rental').length,
        food: allOrders.filter((o: any) => o.orderType === 'food').length,
      },
      byStatus: {
        pending: allOrders.filter((o: any) => o.status === 'pending').length,
        confirmed: allOrders.filter((o: any) => o.status === 'confirmed').length,
        preparing: allOrders.filter((o: any) => o.status === 'preparing').length,
        ready: allOrders.filter((o: any) => o.status === 'ready').length,
        delivering: allOrders.filter((o: any) => o.status === 'delivering').length,
        delivered: allOrders.filter((o: any) => o.status === 'delivered').length,
        cancelled: allOrders.filter((o: any) => o.status === 'cancelled').length,
      },
      revenue: {
        total: revenueTotal,
        paid: revenuePaid,
      },
      recentActivity,
    };

    return c.json({ success: true, stats });
  } catch (error: any) {
    console.error('Get order stats error:', error);
    return c.json({ error: `Statistikani olishda xatolik: ${error.message}` }, 500);
  }
});

/** Buyurtmadan mijozni noyob kalit (telefon ustuvor) */
function adminInsightCustomerKey(o: any): string {
  const ph = String(o?.customerPhone ?? o?.customer_phone ?? o?.phone ?? '').replace(/\D/g, '');
  if (ph.length >= 9) return `p:${ph}`;
  const nm = String(o?.customerName ?? o?.customer_name ?? '').trim().toLowerCase();
  if (nm.length >= 2) return `n:${nm.slice(0, 80)}`;
  return '';
}

function compareWeeksFromSeries14(series: Array<{ orders: number; revenuePaid: number }>) {
  if (!Array.isArray(series) || series.length !== 14) {
    return {
      ordersPrev7: 0,
      ordersLast7: 0,
      revenuePaidPrev7: 0,
      revenuePaidLast7: 0,
    };
  }
  let ordersPrev7 = 0;
  let ordersLast7 = 0;
  let revenuePaidPrev7 = 0;
  let revenuePaidLast7 = 0;
  for (let i = 0; i < 7; i++) {
    ordersPrev7 += series[i].orders || 0;
    revenuePaidPrev7 += series[i].revenuePaid || 0;
  }
  for (let i = 7; i < 14; i++) {
    ordersLast7 += series[i].orders || 0;
    revenuePaidLast7 += series[i].revenuePaid || 0;
  }
  return { ordersPrev7, ordersLast7, revenuePaidPrev7, revenuePaidLast7 };
}

function sanitizeBranchInsightRow(m: any) {
  const set = m._customerKeys;
  const uniqueCustomers = set instanceof Set ? set.size : 0;
  const {
    _customerKeys: _omitCust,
    orderCount: oc0,
    paidOrderCount: pc0,
    deliveredCount: dlv0,
    cancelledCount: cc0,
    revenuePaid: rp,
    revenueAll: ra,
    series14d,
    ...rest
  } = m;
  const oc = Number(oc0) || 0;
  const pc = Number(pc0) || 0;
  const dlv = Number(dlv0) || 0;
  const cc = Number(cc0) || 0;
  const compareWeeks = compareWeeksFromSeries14(series14d || []);
  return {
    ...rest,
    orderCount: oc,
    paidOrderCount: pc,
    deliveredCount: dlv,
    cancelledCount: cc,
    revenuePaid: rp,
    revenueAll: ra,
    series14d: series14d || [],
    uniqueCustomers,
    compareWeeks,
    avgOrderValuePaid: pc > 0 ? rp / pc : 0,
    avgOrderValueAll: oc > 0 ? ra / oc : 0,
    cancellationRatePct: oc > 0 ? (cc / oc) * 100 : 0,
    paidSharePct: oc > 0 ? (pc / oc) * 100 : 0,
    deliveredSharePct: oc > 0 ? (dlv / oc) * 100 : 0,
  };
}

/** Admin: barcha filiallar bo‘yicha buyurtma statistikasi va 14 kunlik qatorlar (KV) */
app.get('/make-server-27d0d16c/admin/branch-insights', async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    const rows = await kv.getByPrefixWithKeys('order:');
    const normalized = rows
      .map(({ key, value }) => normalizeOrderRowForAdmin(value, key))
      .filter((o): o is NonNullable<typeof o> => o != null);
    const allOrders = dedupeNormalizedOrdersForAdmin(normalized);

    const branchRecords = await kv.getByPrefix('branch:');
    const branchNameById = new Map<string, string>();
    for (const b of branchRecords) {
      if (b?.id) {
        branchNameById.set(
          String(b.id),
          String(b.branchName || b.name || b.login || 'Filial'),
        );
      }
    }

    const dayKeys: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const dt = new Date();
      dt.setUTCDate(dt.getUTCDate() - i);
      dayKeys.push(dt.toISOString().slice(0, 10));
    }

    const emptySeries = () => dayKeys.map((date) => ({ date, orders: 0, revenuePaid: 0 }));

    const baseMetrics = () => ({
      orderCount: 0,
      revenuePaid: 0,
      revenueAll: 0,
      platformCommissionUzs: 0,
      cancelledCount: 0,
      paidOrderCount: 0,
      deliveredCount: 0,
      byOrderType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byPaymentStatus: {} as Record<string, number>,
      byOrderTypeRevenuePaid: {} as Record<string, number>,
      series14d: emptySeries(),
      hourly24: Array.from({ length: 24 }, () => 0),
      _customerKeys: new Set<string>(),
    });

    type M = ReturnType<typeof baseMetrics>;
    const global = baseMetrics();
    const byBranch = new Map<string, M & { branchId: string; branchName: string }>();

    const getBranch = (bid: string) => {
      const key = bid || '__no_branch__';
      if (!byBranch.has(key)) {
        byBranch.set(key, {
          ...baseMetrics(),
          branchId: bid,
          branchName: bid ? (branchNameById.get(bid) || 'Filial') : "Filial ko'rsatilmagan",
        });
      }
      return byBranch.get(key)!;
    };

    const bump = (m: M, o: any) => {
      const money = orderTotalMoneyForStats(o);
      m.orderCount++;
      m.revenueAll += money;
      const ps = String(o.paymentStatus || 'pending');
      m.byPaymentStatus[ps] = (m.byPaymentStatus[ps] || 0) + 1;
      if (ps === 'paid') {
        m.revenuePaid += money;
        m.paidOrderCount++;
      }

      const st = String(o.status || 'pending');
      const stLower = st.toLowerCase();
      m.byStatus[st] = (m.byStatus[st] || 0) + 1;
      if (stLower === 'cancelled' || stLower === 'canceled') m.cancelledCount++;
      if (stLower === 'delivered') m.deliveredCount++;

      const ot = String(o.orderType || o.type || 'unknown');
      m.byOrderType[ot] = (m.byOrderType[ot] || 0) + 1;
      if (ps === 'paid') {
        m.byOrderTypeRevenuePaid[ot] = (m.byOrderTypeRevenuePaid[ot] || 0) + money;
      }

      const plat = Number(o.platformCommissionTotalUzs);
      if (Number.isFinite(plat) && plat > 0) {
        m.platformCommissionUzs = (m.platformCommissionUzs || 0) + plat;
      }

      const ck = adminInsightCustomerKey(o);
      if (ck) m._customerKeys.add(ck);

      const t = new Date(o.createdAt || 0).getTime();
      if (Number.isFinite(t)) {
        const hour = new Date(t).getUTCHours();
        if (hour >= 0 && hour < 24) m.hourly24[hour] = (m.hourly24[hour] || 0) + 1;
        const day = new Date(t).toISOString().slice(0, 10);
        const idx = dayKeys.indexOf(day);
        if (idx >= 0) {
          m.series14d[idx].orders++;
          if (ps === 'paid') m.series14d[idx].revenuePaid += money;
        }
      }
    };

    for (const o of allOrders) {
      bump(global, o);
      const bid = String(o.branchId || '').trim();
      bump(getBranch(bid), o);
    }

    const branchesRaw = Array.from(byBranch.values()).sort((a, b) => b.orderCount - a.orderCount);
    const branches = branchesRaw.map((row) => sanitizeBranchInsightRow(row));
    const globalOut = sanitizeBranchInsightRow(global);

    const topByRevenue = [...branches]
      .filter((b) => b.orderCount > 0)
      .sort((a, b) => b.revenuePaid - a.revenuePaid)
      .slice(0, 8)
      .map((b) => ({
        branchId: b.branchId,
        branchName: b.branchName,
        revenuePaid: b.revenuePaid,
        orderCount: b.orderCount,
      }));

    return c.json({
      success: true,
      generatedAt: new Date().toISOString(),
      global: globalOut,
      branches,
      meta: {
        kvOrderRows: rows.length,
        dedupedOrders: allOrders.length,
        branchesInKv: branchRecords.length,
        branchesWithOrders: branches.filter((b) => b.orderCount > 0).length,
        topBranchesByRevenue: topByRevenue,
      },
    });
  } catch (error: any) {
    console.error('Admin branch insights error:', error);
    return c.json(
      { success: false, error: error?.message || 'Statistikani olishda xatolik' },
      500,
    );
  }
});

// Get orders by type
app.get('/make-server-27d0d16c/orders/type/:type', async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    const type = c.req.param('type');
    console.log(`📦 Getting orders by type: ${type}`);
    
    const allOrders = await kv.getByPrefix('order:');
    const filteredOrders = allOrders.filter((order: any) => order.orderType === type);
    
    console.log(`📦 Found ${filteredOrders.length} ${type} orders`);
    return c.json({ success: true, orders: filteredOrders, total: filteredOrders.length });
  } catch (error: any) {
    console.error('Get orders by type error:', error);
    return c.json({ error: `Buyurtmalarni olishda xatolik: ${error.message}` }, 500);
  }
});

// Update order status
app.post('/make-server-27d0d16c/orders/update-status', async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    const branchAuth = await validateBranchSession(c);
    if (!admin.success && !branchAuth.success) {
      return c.json({ error: admin.error || branchAuth.error || 'Ruxsat yo‘q' }, 403);
    }

    const { orderId, status, paymentMethod } = await c.req.json();
    console.log(`📦 Updating order ${orderId} status to: ${status}`);
    
    if (!orderId || !status) {
      return c.json({ error: 'OrderId va status majburiy' }, 400);
    }
    
    const orderRecord = await getOrderRecord(orderId);
    if (!orderRecord) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }

    if (!admin.success && branchAuth.success) {
      let ob = normalizeBranchId(orderRecord.order.branchId || '');
      if (!ob) {
        ob = normalizeBranchId(await inferOrderBranchId(orderRecord.order));
      }
      const sb = normalizeBranchId(branchAuth.branchId || '');
      if (!ob || !sb || ob !== sb) {
        return c.json({ error: "Bu filial uchun buyurtmani boshqarish mumkin emas" }, 403);
      }
    }

    const prevStatus = String(orderRecord.order.status || '').toLowerCase().trim();
    const nextStatus = String(status || '').toLowerCase().trim();
    if (nextStatus === 'cancelled' && prevStatus !== 'cancelled') {
      await restoreInventoryFromOrder(orderRecord.order);
    }

    const paymentMethodNormalized = paymentMethod ? String(paymentMethod).toLowerCase().trim() : undefined;
    const needsVerification =
      paymentMethodNormalized === 'qr' ||
      paymentMethodNormalized === 'qrcode' ||
      (paymentMethodNormalized ? ONLINE_PAYMENT_METHODS.has(paymentMethodNormalized) : orderRecord.order.paymentRequiresVerification);

    const updatedOrder = {
      ...orderRecord.order,
      status,
      ...(nextStatus === 'cancelled' && prevStatus !== 'cancelled' ? { inventoryRestoredOnCancel: true } : {}),
      ...(paymentMethodNormalized ? { paymentMethod: paymentMethodNormalized } : {}),
      ...(paymentMethodNormalized ? { paymentRequiresVerification: needsVerification } : {}),
      // QR/manual verification: kassir chek tasdiqlamaguncha paymentStatus="pending" bo'lib turadi
      ...(paymentMethodNormalized && (paymentMethodNormalized === 'qr' || paymentMethodNormalized === 'qrcode')
        ? {
            paymentStatus: orderRecord.order.paymentStatus === 'paid' ? 'paid' : 'pending',
          }
        : {}),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        ...(Array.isArray(orderRecord.order.statusHistory) ? orderRecord.order.statusHistory : []),
        {
          status,
          timestamp: new Date().toISOString(),
          note:
            paymentMethodNormalized === 'qr' || paymentMethodNormalized === 'qrcode'
              ? 'To\'lov QR orqali tekshiruvga keltirildi'
              : 'Admin tomonidan yangilandi',
        },
      ],
    };
    await kv.set(orderRecord.key, updatedOrder);

    // Keep Postgres marketplace `v2` in sync with legacy KV status/payment changes
    await syncRelationalOrderFromLegacy({
      legacyOrderId: orderId,
      kvStatus: status,
      kvPaymentStatus:
        String((updatedOrder as any).paymentStatus || orderRecord.order.paymentStatus || 'pending'),
      paymentRequiresVerification: needsVerification,
    });

    if (status === 'cancelled' || status === 'delivered') {
      await detachBagFromOrderInternal(orderId, {
        actorType: admin.success ? 'admin' : 'branch',
        actorId: admin.success ? admin.userId || null : branchAuth.success ? branchAuth.branchId || null : null,
        note: `Buyurtma ${status} holatiga o‘tgani uchun so‘mka bo‘shatildi`,
      });
    }
    
    console.log('✅ Order status updated successfully');
    return c.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Update order status error:', error);
    return c.json({ error: `Buyurtma holatini yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Cancel order
app.post('/make-server-27d0d16c/orders/cancel', async (c) => {
  try {
    const { orderId } = await c.req.json();
    console.log(`📦 Cancelling order: ${orderId}`);
    
    if (!orderId) {
      return c.json({ error: 'OrderId majburiy' }, 400);
    }
    
    const orderRecord = await getOrderRecord(orderId);
    if (!orderRecord) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }

    const access = await validateOrderOwnership(c, orderRecord.order);
    if (!access.success) {
      return c.json({ error: access.error }, 403);
    }
    
    const cancelSt = String(orderRecord.order.status || '').toLowerCase().trim();
    if (cancelSt === 'delivered') {
      return c.json({ error: 'Yetkazilgan buyurtmani bekor qilib bo\'lmaydi' }, 400);
    }
    
    if (orderRecord.order.status === 'cancelled') {
      return c.json({ error: 'Buyurtma allaqachon bekor qilingan' }, 400);
    }

    await restoreInventoryFromOrder(orderRecord.order);

    const updatedOrder = {
      ...orderRecord.order,
      status: 'cancelled',
      inventoryRestoredOnCancel: true,
      updatedAt: new Date().toISOString(),
      statusHistory: [
        ...(Array.isArray(orderRecord.order.statusHistory) ? orderRecord.order.statusHistory : []),
        {
          status: 'cancelled',
          timestamp: new Date().toISOString(),
          note:
            access.mode === 'admin'
              ? 'Admin tomonidan bekor qilindi'
              : access.mode === 'branch'
                ? 'Filial tomonidan bekor qilindi'
                : 'Mijoz tomonidan bekor qilindi',
        },
      ],
    };
    await kv.set(orderRecord.key, updatedOrder);
    await detachBagFromOrderInternal(orderId, {
      actorType: access.mode === 'admin' ? 'admin' : access.mode === 'branch' ? 'branch' : 'user',
      actorId:
        access.mode === 'admin'
          ? access.userId || null
          : access.mode === 'branch'
            ? (access as { branchId?: string }).branchId || null
            : access.userId || null,
      note: 'Buyurtma bekor qilingani uchun so‘mka bo‘shatildi',
    });
    
    try {
      await syncRelationalOrderFromLegacy({
        legacyOrderId: String(orderId),
        kvStatus: 'cancelled',
        kvPaymentStatus: String((updatedOrder as any).paymentStatus || 'cancelled'),
        paymentRequiresVerification: false,
      });
    } catch {
      /* v2 ixtiyoriy */
    }

    if (access.mode === 'branch') {
      await applyOrderCancelOneDayLineCooldown(updatedOrder);
    }

    console.log('✅ Order cancelled successfully');
    return c.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Cancel order error:', error);
    return c.json({ error: `Buyurtmani bekor qilishda xatolik: ${error.message}` }, 500);
  }
});

/** Mijoz kuryer topshirgandan keyin buyurtmani qabul qilishni tasdiqlaydi (`awaiting_receipt` → `delivered`). */
app.post('/make-server-27d0d16c/orders/:orderId/confirm-delivery', async (c) => {
  try {
    const orderId = decodeURIComponent(c.req.param('orderId') || '').trim();
    if (!orderId) {
      return c.json({ error: 'orderId kerak' }, 400);
    }

    const orderRecord = await getOrderRecord(orderId);
    if (!orderRecord) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }

    const access = await validateOrderOwnership(c, orderRecord.order);
    if (!access.success) {
      return c.json({ error: access.error }, 403);
    }
    if (access.mode !== 'owner' && access.mode !== 'admin') {
      return c.json({ error: 'Faqat buyurtma egasi tasdiqlashi mumkin' }, 403);
    }

    const st = String(orderRecord.order.status || '').toLowerCase().trim();
    if (st !== 'awaiting_receipt') {
      return c.json({ error: 'Bu bosqichda qabul qilishni tasdiqlab bo‘lmaydi' }, 400);
    }

    const nowIso = new Date().toISOString();
    const pmRaw = String(orderRecord.order.paymentMethod || '').toLowerCase().trim();
    const isCashLike =
      pmRaw === 'cash' ||
      pmRaw.includes('naqd') ||
      pmRaw.includes('naqt') ||
      pmRaw.includes('cash');

    const updatedOrder = {
      ...orderRecord.order,
      status: 'delivered',
      customerReceiptConfirmedAt: nowIso,
      updatedAt: nowIso,
      ...(isCashLike
        ? {
            paymentStatus: 'paid',
            paymentCompletedAt: nowIso,
          }
        : {}),
      statusHistory: [
        ...(Array.isArray(orderRecord.order.statusHistory) ? orderRecord.order.statusHistory : []),
        {
          status: 'delivered',
          timestamp: nowIso,
          note:
            access.mode === 'admin'
              ? 'Admin buyurtma qabul qilindi deb belgiladi'
              : 'Mijoz buyurtmani qabul qilganini tasdiqladi',
        },
      ],
    };

    await kv.set(orderRecord.key, updatedOrder);

    await syncRelationalOrderFromLegacy({
      legacyOrderId: orderId,
      kvStatus: 'delivered',
      kvPaymentStatus: String(updatedOrder.paymentStatus || 'pending'),
      paymentRequiresVerification:
        String(updatedOrder.paymentStatus || '').toLowerCase().trim() === 'paid'
          ? false
          : Boolean(updatedOrder.paymentRequiresVerification),
    });

    const ownerId = String(updatedOrder.userId || '').trim();
    if (ownerId) {
      void notifyUserExpoPush(ownerId, 'Buyurtma qabul qilindi', 'Rahmat! Buyurtmangiz muvaffaqiyatli yakunlandi.', {
        type: 'order_delivered',
        orderId: String(orderId),
      });
    }

    return c.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('confirm-delivery error:', error);
    return c.json({ error: `Tasdiqlashda xatolik: ${error.message}` }, 500);
  }
});

// ===== DYNAMIC ROUTES (must be after specific routes) =====

// Update order status
app.put("/make-server-27d0d16c/orders/:id/status", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    const orderId = c.req.param('id');
    const { status } = await c.req.json();
    
    console.log('📦 Updating order status:', orderId, status);
    
    const orderRecord = await getOrderRecord(orderId);
    if (!orderRecord) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }

    const prevStatus = String(orderRecord.order.status || '').toLowerCase().trim();
    const nextStatus = String(status || '').toLowerCase().trim();
    if (nextStatus === 'cancelled' && prevStatus !== 'cancelled') {
      await restoreInventoryFromOrder(orderRecord.order);
    }
    
    const updatedOrder = {
      ...orderRecord.order,
      status,
      ...(nextStatus === 'cancelled' && prevStatus !== 'cancelled' ? { inventoryRestoredOnCancel: true } : {}),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        ...(Array.isArray(orderRecord.order.statusHistory) ? orderRecord.order.statusHistory : []),
        { status, timestamp: new Date().toISOString(), note: 'Admin tomonidan yangilandi' },
      ],
    };
    
    await kv.set(orderRecord.key, updatedOrder);
    if (status === 'cancelled' || status === 'delivered') {
      await detachBagFromOrderInternal(orderId, {
        actorType: 'admin',
        actorId: admin.userId || null,
        note: `Buyurtma ${status} holatiga o‘tgani uchun so‘mka bo‘shatildi`,
      });
    }
    
    console.log('✅ Order status updated successfully');
    
    return c.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Update order status error:', error);
    return c.json({ error: `Buyurtma holatini yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Get single order
app.get("/make-server-27d0d16c/orders/:id", async (c) => {
  try {
    const orderId = c.req.param('id');
    
    console.log('📦 Getting order:', orderId);
    
    const orderRecord = await getOrderRecord(orderId);
    if (!orderRecord) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }

    const access = await validateOrderOwnership(c, orderRecord.order);
    if (!access.success) {
      return c.json({ error: access.error }, 403);
    }
    
    return c.json({ order: orderRecord.order });
  } catch (error: any) {
    console.error('Get order error:', error);
    return c.json({ error: `Buyurtmani olishda xatolik: ${error.message}` }, 500);
  }
});

// Delete order (admin only)
app.delete("/make-server-27d0d16c/orders/:id", async (c) => {
  try {
    const admin = await validateAdminAccess(c);
    if (!admin.success) {
      return c.json({ error: admin.error }, 403);
    }

    const orderId = c.req.param('id');
    
    console.log('📦 Deleting order:', orderId);
    
    const orderRecord = await getOrderRecord(orderId);
    if (!orderRecord) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }
    
    await kv.del(orderRecord.key);
    
    console.log('✅ Order deleted successfully');
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete order error:', error);
    return c.json({ error: `Buyurtmani o'chirishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== END OF ORDERS ROUTES ====================

// ==================== CATEGORIES ROUTES ====================

// Get all catalogs and categories
app.get("/make-server-27d0d16c/categories", async (c) => {
  try {
    console.log('📋 Loading categories...');

    let raw = await kv.get('categories');
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }

    const FLAG = MARKET_CATALOG_SEED_FLAG;
    const VER_KEY = MARKET_CATALOG_SEED_VERSION_KEY;
    const TARGET_VER = MARKET_CATALOG_SEED_VERSION;
    let stored: Record<string, unknown> & { catalogs?: unknown[] };

    const existingVer = Number((raw as Record<string, unknown> | null)?.[VER_KEY] ?? 0);

    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).catalogs)) {
      stored = {
        catalogs: JSON.parse(JSON.stringify(DEFAULT_MARKET_CATALOGS.catalogs)),
        [FLAG]: true,
        [VER_KEY]: TARGET_VER,
      };
      await kv.set('categories', stored);
      console.log('✅ Full default market catalogs saved to KV');
    } else if (!Number.isFinite(existingVer) || existingVer < TARGET_VER) {
      const merged = mergeMarketCatalogTrees(
        { catalogs: (raw as { catalogs: any[] }).catalogs },
        DEFAULT_MARKET_CATALOGS,
      );
      stored = {
        ...(raw as Record<string, unknown>),
        catalogs: merged.catalogs,
        [FLAG]: true,
        [VER_KEY]: TARGET_VER,
      };
      await kv.set('categories', stored);
      console.log(
        merged.changed
          ? `✅ Market catalogs merged (seed v${TARGET_VER})`
          : `✅ Market catalog seed version set to v${TARGET_VER}`,
      );
    } else {
      stored = raw as Record<string, unknown> & { catalogs?: unknown[] };
    }

    return c.json({
      success: true,
      data: { catalogs: stored.catalogs ?? [] },
    });
  } catch (error: any) {
    console.error('Get categories error:', error);
    return c.json({ error: `Kategoriyalarni olishda xatolik: ${error.message}` }, 500);
  }
});

// Update categories (admin only)
app.put("/make-server-27d0d16c/categories", async (c) => {
  try {
    const body = await c.req.json();
    console.log('📝 Updating categories...');
    
    // Validate required fields
    if (!body.catalogs || !Array.isArray(body.catalogs)) {
      return c.json({ error: 'Kataloglar majburiy' }, 400);
    }

    const toSave = {
      ...body,
      [MARKET_CATALOG_SEED_FLAG]: true,
      [MARKET_CATALOG_SEED_VERSION_KEY]: MARKET_CATALOG_SEED_VERSION,
    };
    await kv.set('categories', toSave);

    console.log('✅ Categories updated successfully');
    return c.json({ success: true, data: { catalogs: toSave.catalogs } });
  } catch (error: any) {
    console.error('Update categories error:', error);
    return c.json({ error: `Kategoriyalarni yangilashda xatolik: ${error.message}` }, 500);
  }
});

// Get place categories
app.get("/make-server-27d0d16c/place-categories", async (c) => {
  try {
    console.log('📍 Loading place categories...');
    
    // Check if place categories exist in KV store
    let placeCategories = await kv.get('place-categories');
    
    if (!placeCategories) {
      console.log('📝 Place categories not found in KV, using default data...');
      
      // Default place categories data
      placeCategories = [
        { id: 'restaurant', name: 'Restoran', icon: '🍽️' },
        { id: 'cafe', name: 'Kafe', icon: '☕' },
        { id: 'hotel', name: 'Mehmonxona', icon: '🏨' },
        { id: 'shopping', name: 'Savdo markazi', icon: '🛍️' },
        { id: 'entertainment', name: 'Oʻyin-kulgi', icon: '🎮' },
        { id: 'park', name: 'Park', icon: '🌳' },
        { id: 'museum', name: 'Muzey', icon: '🏛️' },
        { id: 'theater', name: 'Teatr', icon: '🎭' },
        { id: 'cinema', name: 'Kino', icon: '🎬' },
        { id: 'gym', name: 'Sport zal', icon: '💪' },
        { id: 'hospital', name: 'Kasalxona', icon: '🏥' },
        { id: 'school', name: 'Maktab', icon: '🏫' },
        { id: 'bank', name: 'Bank', icon: '🏦' },
        { id: 'pharmacy', name: 'Dorixona', icon: '💊' },
        { id: 'gas-station', name: 'Benzin qutisi', icon: '⛽' },
        { id: 'mosque', name: 'Masjid', icon: '🕌' },
        { id: 'market', name: 'Bozor', icon: '🏪' },
        { id: 'beauty', name: 'Goʻzallik saloni', icon: '💇‍♀️' },
        { id: 'car-service', name: 'Avtoservis', icon: '🔧' },
        { id: 'other', name: 'Boshqa', icon: '📍' }
      ];
      
      // Save to KV store for future use
      await kv.set('place-categories', placeCategories);
      console.log('✅ Default place categories saved to KV store');
    }
    
    return c.json({ success: true, data: placeCategories });
  } catch (error: any) {
    console.error('Get place categories error:', error);
    return c.json({ error: `Joy kategoriyalarini olishda xatolik: ${error.message}` }, 500);
  }
});

// Get regions and districts
app.get("/make-server-27d0d16c/geo-data", async (c) => {
  try {
    console.log('🗺️ Loading geo data...');
    
    // Check if geo data exist in KV store
    let geoData = await kv.get('geo-data');
    
    if (!geoData) {
      console.log('📝 Geo data not found in KV, using default data...');
      
      // Default geo data
      geoData = {
        regions: [
          'Toshkent shahar',
          'Toshkent viloyati',
          'Andijon',
          'Buxoro',
          'Jizzax',
          'Qashqadaryo',
          'Navoiy',
          'Namangan',
          'Samarqand',
          'Sirdaryo',
          'Surxondaryo',
          'Farg\'ona',
          'Xorazm',
          'Qoraqalpog\'iston',
        ],
        districts: {
          'Toshkent shahar': ['Bektemir', 'Chilonzor', 'Mirzo Ulug\'bek', 'Mirobod', 'Olmazor', 'Sergeli', 'Shayxontohur', 'Uchtepa', 'Yakkasaroy', 'Yashnobod', 'Yunusobod'],
          'Toshkent viloyati': ['Angren', 'Bekobod', 'Bo\'ka', 'Bo\'stonliq', 'Chinoz', 'Qibray', 'Ohangaron', 'Oqqo\'rg\'on', 'Parkent', 'Piskent', 'Quyi Chirchiq', 'O\'rta Chirchiq', 'Yangiyo\'l', 'Yuqori Chirchiq', 'Zangiota'],
          'Andijon': ['Andijon', 'Asaka', 'Baliqchi', 'Bo\'z', 'Buloqboshi', 'Jalaquduq', 'Izboskan', 'Qo\'rg\'ontepa', 'Marhamat', 'Oltinko\'l', 'Paxtaobod', 'Shahrixon', 'Ulug\'nor', 'Xo\'jaobod'],
          'Buxoro': ['Buxoro', 'Kogon', 'G\'ijduvon', 'Jondor', 'Olot', 'Peshku', 'Qorako\'l', 'Qorovulbozor', 'Romitan', 'Shofirkon', 'Vobkent'],
          'Farg\'ona': ['Farg\'ona', 'Beshariq', 'Bog\'dod', 'Buvayda', 'Dang\'ara', 'Farg\'ona', 'Furqat', 'O\'zbekiston', 'Qo\'qon', 'Qo\'shtepa', 'Quva', 'Rishton', 'So\'x', 'Toshloq', 'Uchko\'prik', 'Yozyovon'],
          'Jizzax': ['Jizzax', 'Arnasoy', 'Baxmal', 'Do\'stlik', 'Forish', 'G\'allaorol', 'Sharof Rashidov', 'Mirzacho\'l', 'Paxtakor', 'Yangiobod', 'Zomin', 'Zafarobod'],
          'Namangan': ['Namangan', 'Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq', 'Norin', 'Pop', 'To\'raqo\'rg\'on', 'Uchqo\'rg\'on', 'Uychi', 'Yangiqo\'rg\'on'],
          'Navoiy': ['Navoiy', 'Konimex', 'Karmana', 'Qiziltepa', 'Xatirchi', 'Navbahor', 'Nurota', 'Tomdi', 'Uchquduq'],
          'Qashqadaryo': ['Qarshi', 'Chiroqchi', 'Dehqonobod', 'G\'uzor', 'Kasbi', 'Kitob', 'Koson', 'Mirishkor', 'Muborak', 'Nishon', 'Qamashi', 'Shahrisabz', 'Yakkabog\''],
          'Qoraqalpog\'iston': ['Nukus', 'Amudaryo', 'Beruniy', 'Chimboy', 'Ellikqal\'a', 'Kegeyli', 'Mo\'ynoq', 'Qonliko\'l', 'Qo\'ng\'irot', 'Shumanay', 'Taxtako\'pir', 'To\'rtko\'l', 'Xo\'jayli'],
          'Samarqand': ['Samarqand', 'Bulung\'ur', 'Ishtixon', 'Jomboy', 'Kattaqo\'rg\'on', 'Narpay', 'Nurobod', 'Oqdaryo', 'Paxtachi', 'Payariq', 'Pastdarg\'om', 'Qo\'shrabot', 'Samarqand', 'Toyloq', 'Urgut'],
          'Sirdaryo': ['Guliston', 'Boyovut', 'Guliston', 'Mirzaobod', 'Oqoltin', 'Sardoba', 'Sayxunobod', 'Sirdaryo', 'Xovos'],
          'Surxondaryo': ['Termiz', 'Angor', 'Boysun', 'Denov', 'Jarqo\'rg\'on', 'Qiziriq', 'Qo\'mqo\'rg\'on', 'Muzrabot', 'Oltinsoy', 'Sariosiyo', 'Sherobod', 'Sho\'rchi', 'Termiz', 'Uzun'],
          'Xorazm': ['Urganch', 'Bog\'ot', 'Gurlan', 'Xonqa', 'Xazorasp', 'Qo\'shko\'pir', 'Shovot', 'Urganch', 'Yangiariq', 'Yangibozor']
        }
      };
      
      // Save to KV store for future use
      await kv.set('geo-data', geoData);
      console.log('✅ Default geo data saved to KV store');
    }
    
    return c.json({ success: true, data: geoData });
  } catch (error: any) {
    console.error('Get geo data error:', error);
    return c.json({ error: `Geografik ma\'lumotlarni olishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== END OF CATEGORIES ROUTES ====================

// ==================== VEHICLE DATA ROUTES ====================
app.get('/make-server-27d0d16c/vehicle-brands', async (c) => {
  try {
    const brands = await kv.get('vehicle_brands');
    
    if (!brands) {
      // Default brands if not set in KV
      const defaultBrands = [
        'Toyota', 'Honda', 'Nissan', 'Mazda', 'Suzuki', 'Mitsubishi',
        'Chevrolet', 'Daewoo', 'GM', 'Ford', 'Hyundai', 'Kia',
        'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Lexus',
        'Opel', 'Renault', 'Peugeot', 'Citroen', 'Skoda', 'Seat',
        'Jaguar', 'Land Rover', 'Volvo', 'Saab', 'Subaru', 'Mitsubishi'
      ];
      await kv.set('vehicle_brands', defaultBrands);
      return c.json({ success: true, data: defaultBrands });
    }
    
    return c.json({ success: true, data: brands });
  } catch (error) {
    console.error('Error getting vehicle brands:', error);
    return c.json({ success: false, error: 'Failed to get vehicle brands' }, 500);
  }
});

app.get('/make-server-27d0d16c/fuel-types', async (c) => {
  try {
    const fuelTypes = await kv.get('fuel_types');
    
    if (!fuelTypes) {
      // Default fuel types if not set in KV
      const defaultFuelTypes = [
        { value: 'petrol', label: 'Benzin' },
        { value: 'diesel', label: 'Dizel' },
        { value: 'gas', label: 'Gaz' },
        { value: 'electric', label: 'Elektr' },
        { value: 'hybrid', label: 'Gibrid' }
      ];
      await kv.set('fuel_types', defaultFuelTypes);
      return c.json({ success: true, data: defaultFuelTypes });
    }
    
    return c.json({ success: true, data: fuelTypes });
  } catch (error) {
    console.error('Error getting fuel types:', error);
    return c.json({ success: false, error: 'Failed to get fuel types' }, 500);
  }
});

app.get('/make-server-27d0d16c/transmission-types', async (c) => {
  try {
    const transmissionTypes = await kv.get('transmission_types');
    
    if (!transmissionTypes) {
      // Default transmission types if not set in KV
      const defaultTransmissionTypes = [
        { value: 'manual', label: 'Mexanika' },
        { value: 'automatic', label: 'Avtomat' },
        { value: 'robot', label: 'Robot' },
        { value: 'cvt', label: 'CVT' }
      ];
      await kv.set('transmission_types', defaultTransmissionTypes);
      return c.json({ success: true, data: defaultTransmissionTypes });
    }
    
    return c.json({ success: true, data: transmissionTypes });
  } catch (error) {
    console.error('Error getting transmission types:', error);
    return c.json({ success: false, error: 'Failed to get transmission types' }, 500);
  }
});

// ==================== SERVICE CATEGORIES ROUTES ====================
app.get('/make-server-27d0d16c/service-categories', async (c) => {
  try {
    const categories = await kv.get('service_categories');
    
    if (!categories) {
      // Default service categories if not set in KV
      const defaultCategories = [
        { id: 'web', name: 'Web Dasturlash', icon: '💻' },
        { id: 'mobile', name: 'Mobile Dasturlash', icon: '📱' },
        { id: 'design', name: 'Dizayn', icon: '🎨' },
        { id: 'marketing', name: 'Marketing', icon: '📢' },
        { id: 'consulting', name: 'Konsalting', icon: '💼' },
        { id: 'other', name: 'Boshqa', icon: '📦' }
      ];
      await kv.set('service_categories', defaultCategories);
      return c.json({ success: true, data: defaultCategories });
    }
    
    return c.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error getting service categories:', error);
    return c.json({ success: false, error: 'Failed to get service categories' }, 500);
  }
});

// ==================== DELIVERY OPTIONS ROUTES ====================
app.get('/make-server-27d0d16c/delivery-options', async (c) => {
  try {
    const options = await kv.get('delivery_options');
    
    if (!options) {
      // Default delivery options if not set in KV
      const defaultOptions = [
        { value: '5', label: '5 daqiqa' },
        { value: '15', label: '15 daqiqa' },
        { value: '30', label: '30 daqiqa' },
        { value: '45', label: '45 daqiqa' },
        { value: '60', label: '1 soat' },
        { value: '90', label: '1.5 soat' },
        { value: '120', label: '2 soat' }
      ];
      await kv.set('delivery_options', defaultOptions);
      return c.json({ success: true, data: defaultOptions });
    }
    
    return c.json({ success: true, data: options });
  } catch (error) {
    console.error('Error getting delivery options:', error);
    return c.json({ success: false, error: 'Failed to get delivery options' }, 500);
  }
});

// ==================== ADMIN ROUTES FOR MANAGING STATIC DATA ====================
app.put('/make-server-27d0d16c/admin/vehicle-brands', async (c) => {
  try {
    const { brands } = await c.req.json();
    await kv.set('vehicle_brands', brands);
    return c.json({ success: true, message: 'Vehicle brands updated successfully' });
  } catch (error) {
    console.error('Error updating vehicle brands:', error);
    return c.json({ success: false, error: 'Failed to update vehicle brands' }, 500);
  }
});

app.put('/make-server-27d0d16c/admin/fuel-types', async (c) => {
  try {
    const { fuelTypes } = await c.req.json();
    await kv.set('fuel_types', fuelTypes);
    return c.json({ success: true, message: 'Fuel types updated successfully' });
  } catch (error) {
    console.error('Error updating fuel types:', error);
    return c.json({ success: false, error: 'Failed to update fuel types' }, 500);
  }
});

app.put('/make-server-27d0d16c/admin/transmission-types', async (c) => {
  try {
    const { transmissionTypes } = await c.req.json();
    await kv.set('transmission_types', transmissionTypes);
    return c.json({ success: true, message: 'Transmission types updated successfully' });
  } catch (error) {
    console.error('Error updating transmission types:', error);
    return c.json({ success: false, error: 'Failed to update transmission types' }, 500);
  }
});

// ==================== BRANCH PROFILE (legacy branchSession) ====================
app.get('/make-server-27d0d16c/branch-profile', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ success: false, error: branchAuth.error || 'Unauthorized' }, 401);
    }

    const branchId = String(branchAuth.branchId || '');
    const branch = branchId ? await kv.get(`branch:${branchId}`) : null;
    if (!branch) {
      return c.json({ success: false, error: 'Filial topilmadi' }, 404);
    }

    // minimal “real” data from branch record + computed stats
    const orders = (await kv.getByPrefix('order:')).filter((o: any) => o && !o.deleted && String(o.branchId || '') === branchId);
    const revenue = orders
      .filter((o: any) => String(o.paymentStatus || '').toLowerCase() === 'paid')
      .reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);

    return c.json({
      success: true,
      data: {
        id: branchId,
        firstName: String(branch.managerName || 'Manager').split(' ')[0] || 'Manager',
        lastName: String(branch.managerName || '').split(' ').slice(1).join(' ') || '',
        email: String(branch.email || ''),
        phone: String(branch.phone || ''),
        birthDate: '',
        gender: '',
        profileImage: String(branch.logoUrl || ''),
        branchName: branch.name || branch.branchName || 'Filial',
        role: 'Branch',
        region: String(branch.regionName || branch.region || ''),
        district: String(branch.districtName || branch.district || ''),
        address: String(branch.address || ''),
        createdAt: String(branch.createdAt || ''),
        lastLogin: new Date().toISOString(),
        status: 'active',
        permissions: ['manage_orders', 'manage_products', 'manage_staff', 'view_reports'],
        stats: {
          totalOrders: orders.length,
          totalRevenue: revenue,
          averageRating: 0,
          completedDeliveries: orders.filter((o: any) => o.status === 'delivered').length,
          customerSatisfaction: 0,
        },
      },
    });
  } catch (error: any) {
    console.error('branch-profile get error:', error);
    return c.json({ success: false, error: 'Profilni olishda xatolik' }, 500);
  }
});

app.put('/make-server-27d0d16c/branch-profile/:id', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ success: false, error: branchAuth.error || 'Unauthorized' }, 401);
    }
    const branchId = String(branchAuth.branchId || '');
    const id = String(c.req.param('id') || '');
    if (!branchId || !id || id !== branchId) {
      return c.json({ success: false, error: 'Ruxsat yo‘q' }, 403);
    }

    const existing = await kv.get(`branch:${branchId}`);
    if (!existing) {
      return c.json({ success: false, error: 'Filial topilmadi' }, 404);
    }

    const patch = await parseOptionalJsonBody(c);
    const next = {
      ...existing,
      managerName: patch.firstName || patch.lastName
        ? `${String(patch.firstName || '').trim()} ${String(patch.lastName || '').trim()}`.trim()
        : existing.managerName,
      phone: patch.phone != null ? String(patch.phone) : existing.phone,
      email: patch.email != null ? String(patch.email) : existing.email,
      address: patch.address != null ? String(patch.address) : existing.address,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`branch:${branchId}`, next);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('branch-profile put error:', error);
    return c.json({ success: false, error: 'Profilni saqlashda xatolik' }, 500);
  }
});

app.put('/make-server-27d0d16c/admin/service-categories', async (c) => {
  try {
    const { categories } = await c.req.json();
    await kv.set('service_categories', categories);
    return c.json({ success: true, message: 'Service categories updated successfully' });
  } catch (error) {
    console.error('Error updating service categories:', error);
    return c.json({ success: false, error: 'Failed to update service categories' }, 500);
  }
});

app.put('/make-server-27d0d16c/admin/delivery-options', async (c) => {
  try {
    const { options } = await c.req.json();
    await kv.set('delivery_options', options);
    return c.json({ success: true, message: 'Delivery options updated successfully' });
  } catch (error) {
    console.error('Error updating delivery options:', error);
    return c.json({ success: false, error: 'Failed to update delivery options' }, 500);
  }
});

// ==================== END OF STATIC DATA ROUTES ====================

// ==================== REPORTS (branch panel) ====================
app.get('/make-server-27d0d16c/report-templates', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ success: false, error: branchAuth.error || 'Unauthorized' }, 401);
    }

    const stored = await kv.get('report_templates');
    if (stored && Array.isArray(stored)) {
      return c.json({ success: true, templates: stored });
    }

    const defaults = [
      {
        id: 'tpl_sales_daily_pdf',
        name: 'Kunlik savdo (PDF)',
        description: 'Kunlik savdo va tushum bo‘yicha qisqa hisobot',
        category: 'sales',
        type: 'daily',
        format: 'pdf',
        icon: '📄',
        parameters: [
          { name: 'startDate', type: 'date', required: true },
          { name: 'endDate', type: 'date', required: true },
        ],
      },
      {
        id: 'tpl_sales_monthly_excel',
        name: 'Oylik savdo (Excel)',
        description: 'Oylik savdo bo‘yicha jadval ko‘rinishida hisobot',
        category: 'sales',
        type: 'monthly',
        format: 'excel',
        icon: '📊',
        parameters: [
          { name: 'startDate', type: 'date', required: true },
          { name: 'endDate', type: 'date', required: true },
        ],
      },
      {
        id: 'tpl_financial_custom_csv',
        name: 'Moliyaviy (CSV)',
        description: 'Tushum, to‘lovlar va balans bo‘yicha export',
        category: 'financial',
        type: 'custom',
        format: 'csv',
        icon: '🧾',
        parameters: [
          { name: 'startDate', type: 'date', required: true },
          { name: 'endDate', type: 'date', required: true },
        ],
      },
    ];
    await kv.set('report_templates', defaults);
    return c.json({ success: true, templates: defaults });
  } catch (error: any) {
    console.error('report-templates error:', error);
    return c.json({ success: false, error: 'Shablonlarni olishda xatolik' }, 500);
  }
});

app.get('/make-server-27d0d16c/reports', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ success: false, error: branchAuth.error || 'Unauthorized' }, 401);
    }

    const branchId = String(c.req.query('branchId') || '').trim();
    const search = String(c.req.query('search') || '').trim().toLowerCase();
    const category = String(c.req.query('category') || '').trim();
    const status = String(c.req.query('status') || '').trim();

    if (!branchId) {
      return c.json({ success: false, error: 'branchId majburiy' }, 400);
    }
    if (branchAuth.branchId && branchAuth.branchId !== branchId) {
      return c.json({ success: false, error: 'Ruxsat yo‘q' }, 403);
    }

    const all = await kv.getByPrefix(`report:${branchId}:`);
    let reports = (Array.isArray(all) ? all : []).filter(Boolean);

    if (search) {
      reports = reports.filter((r: any) => String(r.name || '').toLowerCase().includes(search));
    }
    if (category) {
      reports = reports.filter((r: any) => String(r.category || '') === category);
    }
    if (status) {
      reports = reports.filter((r: any) => String(r.status || '') === status);
    }

    // newest first
    reports.sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    return c.json({ success: true, reports });
  } catch (error: any) {
    console.error('reports list error:', error);
    return c.json({ success: false, error: 'Hisobotlarni olishda xatolik' }, 500);
  }
});

app.post('/make-server-27d0d16c/reports/generate', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ success: false, error: branchAuth.error || 'Unauthorized' }, 401);
    }

    const body = await parseOptionalJsonBody(c);
    const templateId = String(body.templateId || '').trim();
    const branchId = String(body.branchId || '').trim();
    const parameters = body.parameters || {};

    if (!templateId || !branchId) {
      return c.json({ success: false, error: 'templateId va branchId majburiy' }, 400);
    }
    if (branchAuth.branchId && branchAuth.branchId !== branchId) {
      return c.json({ success: false, error: 'Ruxsat yo‘q' }, 403);
    }

    const templates = (await kv.get('report_templates')) as any[] | null;
    const tpl = (templates || []).find((t) => String(t.id) === templateId);
    if (!tpl) {
      return c.json({ success: false, error: 'Shablon topilmadi' }, 404);
    }

    const now = new Date().toISOString();
    const reportId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const report = {
      id: reportId,
      branchId,
      name: String(tpl.name || 'Hisobot'),
      type: tpl.type || 'custom',
      category: tpl.category || 'performance',
      format: tpl.format || 'pdf',
      status: 'completed',
      description: String(tpl.description || ''),
      parameters: {
        startDate: String(parameters.startDate || ''),
        endDate: String(parameters.endDate || ''),
        filters: parameters.filters || {},
      },
      generatedAt: now,
      downloadUrl: null,
      fileSize: 0,
      createdAt: now,
      createdBy: String(branchAuth.userId || branchAuth.authUserId || 'branch'),
    };

    await kv.set(`report:${branchId}:${reportId}`, report);
    return c.json({ success: true, report });
  } catch (error: any) {
    console.error('reports generate error:', error);
    return c.json({ success: false, error: 'Hisobot generatsiyasida xatolik' }, 500);
  }
});

// ==================== ANALYTICS ROUTES ====================
app.get('/make-server-27d0d16c/analytics', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ error: branchAuth.error || 'Unauthorized', success: false }, 401);
    }
    const branchId = String(branchAuth.branchId || '');
    if (!branchId) {
      return c.json({ error: 'Filial aniqlanmadi', success: false }, 400);
    }

    const dateRange = c.req.query('dateRange') || '7days';
    const category = c.req.query('category') || 'all';

    console.log('📊 Analytics request:', { branchId, dateRange, category });

    const DAY_MS = 24 * 60 * 60 * 1000;
    const rangeDays =
      dateRange === '90days' ? 90 :
      dateRange === '30days' ? 30 :
      7;

    const normalizeValue = (value: unknown) => String(value ?? '').trim().toLowerCase();
    const toSlug = (value: unknown) =>
      normalizeValue(value)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const toNumber = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const parseDate = (value: unknown) => {
      const parsed = new Date(String(value || ''));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const formatDateKey = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const buildGrowth = (current: number, previous: number) => {
      if (previous <= 0) {
        return current > 0 ? 100 : 0;
      }
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const now = new Date();
    const currentEnd = new Date(now);
    currentEnd.setHours(23, 59, 59, 999);

    const currentStart = new Date(currentEnd.getTime() - ((rangeDays - 1) * DAY_MS));
    currentStart.setHours(0, 0, 0, 0);

    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - ((rangeDays - 1) * DAY_MS));
    previousStart.setHours(0, 0, 0, 0);

    const orderTypeRaw = normalizeValue(c.req.query('orderType') || 'all');
    const orderTypeFilter: 'all' | 'food' | 'market' | 'shop' | 'rental' =
      orderTypeRaw === 'food' || orderTypeRaw === 'restaurant'
        ? 'food'
        : orderTypeRaw === 'market' || orderTypeRaw === 'shop' || orderTypeRaw === 'rental'
          ? (orderTypeRaw as 'market' | 'shop' | 'rental')
          : 'all';

    const orderMatchesVertical = (order: any) => {
      if (orderTypeFilter === 'all') return true;
      const ot = normalizeValue(order?.orderType || order?.type || '');
      if (orderTypeFilter === 'food') return ot === 'food' || ot === 'restaurant';
      return ot === orderTypeFilter;
    };

    const branchProducts = (await kv.getByPrefix('branchproduct:')).filter((product: any) => product?.branchId === branchId);
    const salesAll = (await kv.getByPrefix('sale:')).filter((sale: any) => sale?.branchId === branchId);
    const ordersAll = (await kv.getByPrefix('order:')).filter((order: any) => order?.branchId === branchId);
    const ordersForMetrics = ordersAll.filter(orderMatchesVertical);
    const salesForMetrics =
      orderTypeFilter === 'food' || orderTypeFilter === 'shop' || orderTypeFilter === 'rental' ? [] : salesAll;
    const categoriesData = await kv.get('categories');

    const categoryLabelById = new Map<string, string>();
    for (const catalog of categoriesData?.catalogs || []) {
      for (const item of catalog?.categories || []) {
        const categoryId = normalizeValue(item?.id);
        if (categoryId) {
          categoryLabelById.set(categoryId, item?.name || item?.id || 'Boshqa');
        }
      }
    }

    const productById = new Map<string, any>();
    const categoryOptionsMap = new Map<string, { id: string; label: string }>();

    const registerCategoryOption = (rawId: unknown, rawLabel: unknown) => {
      const label = String(rawLabel || '').trim();
      const id = normalizeValue(rawId) || toSlug(label);
      if (!id || !label) {
        return;
      }
      if (!categoryOptionsMap.has(id)) {
        categoryOptionsMap.set(id, { id, label });
      }
    };

    for (const product of branchProducts) {
      if (!product?.id) {
        continue;
      }

      productById.set(String(product.id), product);

      const rawCategoryId = product.categoryId || product.category?.id || '';
      const rawCategoryName =
        product.categoryName ||
        product.category?.name ||
        categoryLabelById.get(normalizeValue(rawCategoryId)) ||
        '';

      if (rawCategoryId || rawCategoryName) {
        registerCategoryOption(rawCategoryId, rawCategoryName || rawCategoryId);
      }
    }

    const selectedCategoryKey = normalizeValue(category);

    const getItemProductId = (item: any) =>
      String(
        item?.productId ||
        item?.id ||
        item?.product?.id ||
        item?.product?.productId ||
        ''
      );

    const getItemName = (item: any) =>
      String(
        item?.productName ||
        item?.name ||
        item?.product?.name ||
        item?.variantName ||
        'Noma\'lum mahsulot'
      );

    const getItemQuantity = (item: any) =>
      Math.max(
        0,
        toNumber(
          item?.quantity ??
          item?.count ??
          item?.qty ??
          1
        )
      );

    const getItemRevenue = (item: any) => {
      if (item?.total !== undefined && item?.total !== null) {
        return toNumber(item.total);
      }
      if (item?.totalPrice !== undefined && item?.totalPrice !== null) {
        return toNumber(item.totalPrice);
      }

      const quantity = getItemQuantity(item);
      const unitPrice = toNumber(
        item?.price ??
        item?.product?.price ??
        item?.variant?.price ??
        item?.unitPrice ??
        0
      );

      return quantity * unitPrice;
    };

    const getCategoryMeta = (item: any) => {
      const product = productById.get(getItemProductId(item));
      const rawCategoryId =
        item?.categoryId ||
        item?.category?.id ||
        item?.product?.categoryId ||
        product?.categoryId ||
        product?.category?.id ||
        '';

      const resolvedCategoryId = normalizeValue(rawCategoryId);
      const rawCategoryName =
        item?.categoryName ||
        item?.category?.name ||
        item?.product?.categoryName ||
        item?.product?.category?.name ||
        product?.categoryName ||
        product?.category?.name ||
        categoryLabelById.get(resolvedCategoryId) ||
        '';

      const label = String(rawCategoryName || rawCategoryId || 'Boshqa').trim() || 'Boshqa';
      const id = resolvedCategoryId || toSlug(label) || 'boshqa';

      registerCategoryOption(id, label);

      return { id, label };
    };

    const itemMatchesCategory = (item: any) => {
      if (selectedCategoryKey === 'all') {
        return true;
      }

      const categoryMeta = getCategoryMeta(item);
      return (
        categoryMeta.id === selectedCategoryKey ||
        normalizeValue(categoryMeta.label) === selectedCategoryKey
      );
    };

    const getCustomerKey = (record: any, type: 'sale' | 'order') => {
      if (type === 'sale') {
        return String(
          record?.customerInfo?.phone ||
          record?.customerInfo?.phoneNumber ||
          record?.customerInfo?.id ||
          record?.customerInfo?.name ||
          `sale:${record?.id || 'noid'}`
        );
      }

      return String(
        record?.customerPhone ||
        record?.userId ||
        record?.customerName ||
        `order:${record?.id || 'noid'}`
      );
    };

    const getRecordDate = (record: any) =>
      parseDate(record?.createdAt) ||
      parseDate(record?.updatedAt) ||
      parseDate(record?.date) ||
      new Date();

    const buildPeriodMetrics = (periodStart: Date, periodEnd: Date) => {
      const dailyMap = new Map<string, { revenue: number; orders: number; customerIds: Set<string> }>();
      for (let time = periodStart.getTime(); time <= periodEnd.getTime(); time += DAY_MS) {
        dailyMap.set(formatDateKey(new Date(time)), {
          revenue: 0,
          orders: 0,
          customerIds: new Set<string>(),
        });
      }

      const productStats = new Map<string, { name: string; sales: number; revenue: number }>();
      const categoryStats = new Map<string, { revenue: number; orderIds: Set<string> }>();
      const uniqueCustomers = new Set<string>();
      const uniqueOrders = new Set<string>();
      let totalRevenue = 0;

      const applyTransaction = (record: any, transactionKey: string, transactionType: 'sale' | 'order') => {
        const recordDate = getRecordDate(record);
        if (recordDate < periodStart || recordDate > periodEnd) {
          return;
        }

        const dayKey = formatDateKey(recordDate);
        const items = Array.isArray(record?.items) ? record.items : [];
        const matchedItems = items.filter((item: any) => itemMatchesCategory(item));

        let matchedRevenue = 0;
        let matchedCategories = new Set<string>();

        for (const item of matchedItems) {
          const revenue = getItemRevenue(item);
          const quantity = getItemQuantity(item);
          const name = getItemName(item);
          const categoryMeta = getCategoryMeta(item);

          matchedRevenue += revenue;
          matchedCategories.add(categoryMeta.label);

          const existingProduct = productStats.get(name) || { name, sales: 0, revenue: 0 };
          existingProduct.sales += quantity;
          existingProduct.revenue += revenue;
          productStats.set(name, existingProduct);

          const existingCategory = categoryStats.get(categoryMeta.label) || {
            revenue: 0,
            orderIds: new Set<string>(),
          };
          existingCategory.revenue += revenue;
          existingCategory.orderIds.add(transactionKey);
          categoryStats.set(categoryMeta.label, existingCategory);
        }

        if (!matchedItems.length && selectedCategoryKey === 'all') {
          matchedRevenue = toNumber(record?.finalTotal ?? record?.totalAmount ?? record?.total ?? 0);
          if (matchedRevenue > 0) {
            matchedCategories.add('Boshqa');
            const existingCategory = categoryStats.get('Boshqa') || {
              revenue: 0,
              orderIds: new Set<string>(),
            };
            existingCategory.revenue += matchedRevenue;
            existingCategory.orderIds.add(transactionKey);
            categoryStats.set('Boshqa', existingCategory);
          }
        }

        if (matchedRevenue <= 0 && matchedCategories.size === 0) {
          return;
        }

        totalRevenue += matchedRevenue;
        uniqueOrders.add(transactionKey);

        const customerKey = getCustomerKey(record, transactionType);
        uniqueCustomers.add(customerKey);

        const existingDay = dailyMap.get(dayKey);
        if (existingDay) {
          existingDay.revenue += matchedRevenue;
          existingDay.orders += 1;
          existingDay.customerIds.add(customerKey);
        }
      };

      for (const sale of salesForMetrics) {
        applyTransaction(sale, `sale:${sale?.id || ''}`, 'sale');
      }

      for (const order of ordersForMetrics) {
        applyTransaction(order, `order:${order?.id || ''}`, 'order');
      }

      const topProducts = Array.from(productStats.values())
        .sort((a, b) => {
          if (b.sales !== a.sales) {
            return b.sales - a.sales;
          }
          return b.revenue - a.revenue;
        })
        .slice(0, 5);

      const normalizedCategoryStats = Array.from(categoryStats.entries())
        .map(([categoryName, stats]) => ({
          category: categoryName,
          revenue: Math.round(stats.revenue),
          orders: stats.orderIds.size,
          percentage: totalRevenue > 0 ? Number(((stats.revenue / totalRevenue) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      const dailyStats = Array.from(dailyMap.entries()).map(([date, stats]) => ({
        date,
        revenue: Math.round(stats.revenue),
        orders: stats.orders,
        customers: stats.customerIds.size,
      }));

      return {
        totalRevenue: Math.round(totalRevenue),
        totalOrders: uniqueOrders.size,
        totalCustomers: uniqueCustomers.size,
        topProducts,
        categoryStats: normalizedCategoryStats,
        dailyStats,
        uniqueLineItemKinds: productStats.size,
      };
    };

    const currentMetrics = buildPeriodMetrics(currentStart, currentEnd);
    const previousMetrics = buildPeriodMetrics(previousStart, previousEnd);

    const totalProducts = branchProducts.filter((product: any) => {
      if (selectedCategoryKey === 'all') {
        return true;
      }

      const rawCategoryId = product?.categoryId || product?.category?.id || '';
      const categoryId = normalizeValue(rawCategoryId);
      const categoryName = normalizeValue(
        product?.categoryName ||
        product?.category?.name ||
        categoryLabelById.get(categoryId) ||
        ''
      );

      return categoryId === selectedCategoryKey || categoryName === selectedCategoryKey;
    }).length;

    const categories = Array.from(categoryOptionsMap.values())
      .sort((a, b) => a.label.localeCompare(b.label, 'uz'))
      .filter((item) => item.label);

    const totalProductsOut =
      orderTypeFilter === 'food'
        ? Math.max(0, Number((currentMetrics as any).uniqueLineItemKinds || 0))
        : totalProducts;

    return c.json({
      success: true,
      data: {
        totalRevenue: currentMetrics.totalRevenue,
        totalOrders: currentMetrics.totalOrders,
        totalCustomers: currentMetrics.totalCustomers,
        totalProducts: totalProductsOut,
        revenueGrowth: buildGrowth(currentMetrics.totalRevenue, previousMetrics.totalRevenue),
        ordersGrowth: buildGrowth(currentMetrics.totalOrders, previousMetrics.totalOrders),
        customersGrowth: buildGrowth(currentMetrics.totalCustomers, previousMetrics.totalCustomers),
        topProducts: currentMetrics.topProducts,
        categoryStats: currentMetrics.categoryStats,
        dailyStats: currentMetrics.dailyStats,
      },
      categories,
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return c.json({ error: `Analytics ma\'lumotlarini olishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== STATISTICS ROUTES ====================
app.get('/make-server-27d0d16c/statistics', async (c) => {
  try {
    const branchAuth = await validateBranchSession(c);
    if (!branchAuth.success) {
      return c.json({ error: branchAuth.error || 'Unauthorized', success: false }, 401);
    }
    const branchId = String(branchAuth.branchId || '');
    if (!branchId) {
      return c.json({ error: 'Filial aniqlanmadi', success: false }, 400);
    }

    const period = c.req.query('period') || 'month';

    console.log('📈 Statistics request:', { branchId, period });

    const DAY_MS = 24 * 60 * 60 * 1000;
    const SUCCESSFUL_ORDER_STATUSES = new Set(['completed', 'delivered']);
    const CANCELLED_ORDER_STATUSES = new Set(['cancelled']);

    const periodDays =
      period === 'year' ? 365 :
      period === 'quarter' ? 90 :
      period === 'week' ? 7 :
      30;

    const now = new Date();
    const currentEnd = new Date(now);
    currentEnd.setHours(23, 59, 59, 999);

    const currentStart = new Date(currentEnd.getTime() - ((periodDays - 1) * DAY_MS));
    currentStart.setHours(0, 0, 0, 0);

    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - ((periodDays - 1) * DAY_MS));
    previousStart.setHours(0, 0, 0, 0);

    const normalizeValue = (value: unknown) => String(value ?? '').trim().toLowerCase();
    const toNumber = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const roundToOne = (value: number) => Number(value.toFixed(1));
    const parseDate = (value: unknown) => {
      const parsed = new Date(String(value || ''));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const formatDateKey = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const buildChange = (current: number, previous: number) => {
      if (previous <= 0) {
        return current > 0 ? 100 : 0;
      }
      return roundToOne(((current - previous) / previous) * 100);
    };
    const getRecordDate = (record: any) =>
      parseDate(record?.createdAt) ||
      parseDate(record?.updatedAt) ||
      parseDate(record?.date) ||
      new Date();
    const getItemProductId = (item: any) =>
      String(
        item?.productId ||
        item?.id ||
        item?.product?.id ||
        item?.product?.productId ||
        ''
      );
    const getItemName = (item: any) =>
      String(
        item?.productName ||
        item?.name ||
        item?.product?.name ||
        item?.variantName ||
        'Noma\'lum mahsulot'
      );
    const getItemQuantity = (item: any) =>
      Math.max(
        0,
        toNumber(
          item?.quantity ??
          item?.count ??
          item?.qty ??
          1
        )
      );
    const getItemRevenue = (item: any) => {
      if (item?.total !== undefined && item?.total !== null) {
        return toNumber(item.total);
      }
      if (item?.totalPrice !== undefined && item?.totalPrice !== null) {
        return toNumber(item.totalPrice);
      }

      const quantity = getItemQuantity(item);
      const unitPrice = toNumber(
        item?.price ??
        item?.product?.price ??
        item?.variant?.price ??
        item?.unitPrice ??
        0
      );

      return quantity * unitPrice;
    };
    const getCustomerKey = (record: any, type: 'sale' | 'order') => {
      if (type === 'sale') {
        return String(
          record?.customerInfo?.phone ||
          record?.customerInfo?.phoneNumber ||
          record?.customerInfo?.id ||
          record?.customerInfo?.name ||
          `sale:${record?.id || 'unknown'}`
        );
      }

      return String(
        record?.customerPhone ||
        record?.userId ||
        record?.customerName ||
        `order:${record?.id || 'unknown'}`
      );
    };
    const getCompletionMinutes = (order: any) => {
      if (!SUCCESSFUL_ORDER_STATUSES.has(normalizeValue(order?.status))) {
        return null;
      }

      const createdAt = parseDate(order?.createdAt);
      if (!createdAt) {
        return null;
      }

      const statusHistory = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
      const lastStatusTimestamp = statusHistory
        .map((entry: any) => parseDate(entry?.timestamp))
        .filter(Boolean)
        .sort((a: any, b: any) => b.getTime() - a.getTime())[0];

      const completedAt = lastStatusTimestamp || parseDate(order?.updatedAt);
      if (!completedAt) {
        return null;
      }

      const diffMinutes = Math.round((completedAt.getTime() - createdAt.getTime()) / 60000);
      return diffMinutes > 0 ? diffMinutes : null;
    };
    const getDayPart = (hour: number) => {
      if (hour >= 6 && hour < 11) return 'Tong';
      if (hour >= 11 && hour < 17) return 'Tush';
      if (hour >= 17 && hour < 23) return 'Oqshom';
      return 'Kechasi';
    };
    const clampScore = (value: number) => {
      if (!Number.isFinite(value)) return 0;
      return roundToOne(Math.min(5, Math.max(0, value)));
    };

    const orderTypeRaw = normalizeValue(c.req.query('orderType') || 'all');
    const orderTypeFilter: 'all' | 'food' | 'market' | 'shop' | 'rental' =
      orderTypeRaw === 'food' || orderTypeRaw === 'restaurant'
        ? 'food'
        : orderTypeRaw === 'market' || orderTypeRaw === 'shop' || orderTypeRaw === 'rental'
          ? (orderTypeRaw as 'market' | 'shop' | 'rental')
          : 'all';

    const orderMatchesVertical = (order: any) => {
      if (orderTypeFilter === 'all') return true;
      const ot = normalizeValue(order?.orderType || order?.type || '');
      if (orderTypeFilter === 'food') return ot === 'food' || ot === 'restaurant';
      return ot === orderTypeFilter;
    };

    const branchProducts = (await kv.getByPrefix('branchproduct:')).filter((product: any) => product?.branchId === branchId);
    const salesAll = (await kv.getByPrefix('sale:')).filter((sale: any) => sale?.branchId === branchId);
    const ordersAll = (await kv.getByPrefix('order:')).filter((order: any) => order?.branchId === branchId);
    const ordersForStats = ordersAll.filter(orderMatchesVertical);
    const salesForStats =
      orderTypeFilter === 'food' || orderTypeFilter === 'shop' || orderTypeFilter === 'rental' ? [] : salesAll;

    const productById = new Map<string, any>();
    for (const product of branchProducts) {
      if (product?.id) {
        productById.set(String(product.id), product);
      }
    }

    const buildSnapshot = (periodStart: Date, periodEnd: Date, includeDetails = false) => {
      const dailyMap = new Map<string, { revenue: number; orders: number; customerIds: Set<string> }>();
      for (let time = periodStart.getTime(); time <= periodEnd.getTime(); time += DAY_MS) {
        dailyMap.set(formatDateKey(new Date(time)), {
          revenue: 0,
          orders: 0,
          customerIds: new Set<string>(),
        });
      }

      const productStats = new Map<string, { name: string; revenue: number; orders: number; ratingTotal: number; ratingWeight: number }>();
      const hourStats = new Map<number, { hour: number; orders: number; revenue: number }>();
      const deliveryStats = new Map<string, { totalMinutes: number; count: number }>();
      const customerCounts = new Map<string, number>();

      let totalRevenue = 0;
      let totalOrders = 0;
      let successfulOrders = 0;

      const applyRecord = (record: any, type: 'sale' | 'order') => {
        const recordDate = getRecordDate(record);
        if (recordDate < periodStart || recordDate > periodEnd) {
          return;
        }

        const customerKey = getCustomerKey(record, type);
        const dayKey = formatDateKey(recordDate);
        const hour = recordDate.getHours();
        const revenue = toNumber(record?.finalTotal ?? record?.totalAmount ?? record?.total ?? 0);

        totalRevenue += revenue;
        totalOrders += 1;
        customerCounts.set(customerKey, (customerCounts.get(customerKey) || 0) + 1);

        if (type === 'sale') {
          successfulOrders += 1;
        } else if (SUCCESSFUL_ORDER_STATUSES.has(normalizeValue(record?.status))) {
          successfulOrders += 1;
        }

        const dayStats = dailyMap.get(dayKey);
        if (dayStats) {
          dayStats.revenue += revenue;
          dayStats.orders += 1;
          dayStats.customerIds.add(customerKey);
        }

        const currentHour = hourStats.get(hour) || { hour, orders: 0, revenue: 0 };
        currentHour.orders += 1;
        currentHour.revenue += revenue;
        hourStats.set(hour, currentHour);

        const items = Array.isArray(record?.items) ? record.items : [];
        for (const item of items) {
          const productId = getItemProductId(item);
          const product = productById.get(productId);
          const itemName = getItemName(item);
          const itemQuantity = getItemQuantity(item);
          const itemRevenue = getItemRevenue(item);
          const rating = toNumber(product?.rating);
          const reviewWeight = Math.max(1, toNumber(product?.reviewCount ?? product?.reviewsCount ?? 0));

          const productStatsEntry = productStats.get(itemName) || {
            name: itemName,
            revenue: 0,
            orders: 0,
            ratingTotal: 0,
            ratingWeight: 0,
          };

          productStatsEntry.revenue += itemRevenue;
          productStatsEntry.orders += itemQuantity;

          if (rating > 0) {
            productStatsEntry.ratingTotal += rating * reviewWeight;
            productStatsEntry.ratingWeight += reviewWeight;
          }

          productStats.set(itemName, productStatsEntry);
        }

        if (type === 'order') {
          const completionMinutes = getCompletionMinutes(record);
          if (completionMinutes !== null) {
            const dayPart = getDayPart(hour);
            const existingDelivery = deliveryStats.get(dayPart) || { totalMinutes: 0, count: 0 };
            existingDelivery.totalMinutes += completionMinutes;
            existingDelivery.count += 1;
            deliveryStats.set(dayPart, existingDelivery);
          }
        }
      };

      for (const sale of salesForStats) {
        applyRecord(sale, 'sale');
      }

      for (const order of ordersForStats) {
        if (CANCELLED_ORDER_STATUSES.has(normalizeValue(order?.status))) {
          applyRecord(order, 'order');
          continue;
        }
        applyRecord(order, 'order');
      }

      const uniqueCustomers = customerCounts.size;
      const repeatCustomers = Array.from(customerCounts.values()).filter((count) => count > 1).length;
      const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      const conversionRate = totalOrders > 0 ? roundToOne((successfulOrders / totalOrders) * 100) : 0;
      const customerRetention = uniqueCustomers > 0 ? roundToOne((repeatCustomers / uniqueCustomers) * 100) : 0;
      const operatingCosts = 0;
      const netProfit = Math.max(totalRevenue - operatingCosts, 0);
      const profitMargin = totalRevenue > 0 ? roundToOne((netProfit / totalRevenue) * 100) : 0;

      const topProducts = includeDetails
        ? Array.from(productStats.values())
            .map((product) => ({
              name: product.name,
              revenue: Math.round(product.revenue),
              orders: product.orders,
              rating: product.ratingWeight > 0 ? roundToOne(product.ratingTotal / product.ratingWeight) : 0,
            }))
            .sort((a, b) => {
              if (b.revenue !== a.revenue) {
                return b.revenue - a.revenue;
              }
              return b.orders - a.orders;
            })
            .slice(0, 5)
        : [];

      const peakHours = includeDetails
        ? Array.from(hourStats.values())
            .sort((a, b) => {
              if (b.orders !== a.orders) {
                return b.orders - a.orders;
              }
              return b.revenue - a.revenue;
            })
            .slice(0, 6)
            .map((item) => ({
              hour: item.hour,
              orders: item.orders,
              revenue: Math.round(item.revenue),
            }))
        : [];

      const deliveryTimes = includeDetails
        ? Array.from(deliveryStats.entries()).map(([periodName, stats]) => ({
            period: periodName,
            avgTime: stats.count > 0 ? Math.round(stats.totalMinutes / stats.count) : 0,
          }))
        : [];

      const trends = Array.from(dailyMap.entries()).map(([date, stats], index, list) => {
        const previous = index > 0 ? list[index - 1][1] : null;
        return {
          date,
          revenue: Math.round(stats.revenue),
          orders: stats.orders,
          customers: stats.customerIds.size,
          revenueChange: previous ? buildChange(stats.revenue, previous.revenue) : 0,
          ordersChange: previous ? buildChange(stats.orders, previous.orders) : 0,
          customersChange: previous ? buildChange(stats.customerIds.size, previous.customerIds.size) : 0,
        };
      });

      const weightedRating = Array.from(productStats.values()).reduce(
        (acc, item) => {
          acc.total += item.ratingTotal;
          acc.weight += item.ratingWeight;
          return acc;
        },
        { total: 0, weight: 0 }
      );

      return {
        overview: {
          totalRevenue: Math.round(totalRevenue),
          totalOrders,
          totalCustomers: uniqueCustomers,
          averageOrderValue,
          conversionRate,
          customerRetention,
          operatingCosts,
          netProfit: Math.round(netProfit),
          profitMargin,
        },
        successfulOrders,
        topProducts,
        peakHours,
        deliveryTimes,
        trends,
        averageRating: weightedRating.weight > 0 ? roundToOne(weightedRating.total / weightedRating.weight) : 0,
      };
    };

    const currentSnapshot = buildSnapshot(currentStart, currentEnd, true);
    const previousSnapshot = buildSnapshot(previousStart, previousEnd, true);
    const lastMonthSnapshot = buildSnapshot(new Date(currentEnd.getTime() - (29 * DAY_MS)), currentEnd);
    const lastQuarterSnapshot = buildSnapshot(new Date(currentEnd.getTime() - (89 * DAY_MS)), currentEnd);
    const lastYearSnapshot = buildSnapshot(new Date(currentEnd.getTime() - (364 * DAY_MS)), currentEnd);

    const previousDeliveryTargets = new Map(
      previousSnapshot.deliveryTimes.map((item: any) => [item.period, item.avgTime])
    );

    const customerSatisfaction = [
      {
        metric: 'Mahsulot reytingi',
        score: clampScore(currentSnapshot.averageRating),
        target: clampScore(previousSnapshot.averageRating || currentSnapshot.averageRating),
      },
      {
        metric: 'Qayta xarid',
        score: clampScore(currentSnapshot.overview.customerRetention / 20),
        target: clampScore((previousSnapshot.overview.customerRetention || currentSnapshot.overview.customerRetention) / 20),
      },
      {
        metric: 'Buyurtma yakuni',
        score: clampScore(currentSnapshot.overview.conversionRate / 20),
        target: clampScore((previousSnapshot.overview.conversionRate || currentSnapshot.overview.conversionRate) / 20),
      },
    ].filter((item) => item.score > 0 || item.target > 0);

    const data = {
      overview: currentSnapshot.overview,
      changes: {
        totalRevenue: buildChange(currentSnapshot.overview.totalRevenue, previousSnapshot.overview.totalRevenue),
        totalOrders: buildChange(currentSnapshot.overview.totalOrders, previousSnapshot.overview.totalOrders),
        averageOrderValue: buildChange(currentSnapshot.overview.averageOrderValue, previousSnapshot.overview.averageOrderValue),
        conversionRate: buildChange(currentSnapshot.overview.conversionRate, previousSnapshot.overview.conversionRate),
        customerRetention: buildChange(currentSnapshot.overview.customerRetention, previousSnapshot.overview.customerRetention),
        operatingCosts: buildChange(currentSnapshot.overview.operatingCosts, previousSnapshot.overview.operatingCosts),
        netProfit: buildChange(currentSnapshot.overview.netProfit, previousSnapshot.overview.netProfit),
        profitMargin: buildChange(currentSnapshot.overview.profitMargin, previousSnapshot.overview.profitMargin),
      },
      trends: {
        revenue: currentSnapshot.trends.map((item: any) => ({
          date: item.date,
          value: item.revenue,
          change: item.revenueChange,
        })),
        orders: currentSnapshot.trends.map((item: any) => ({
          date: item.date,
          value: item.orders,
          change: item.ordersChange,
        })),
        customers: currentSnapshot.trends.map((item: any) => ({
          date: item.date,
          value: item.customers,
          change: item.customersChange,
        })),
      },
      performance: {
        topProducts: currentSnapshot.topProducts,
        peakHours: currentSnapshot.peakHours,
        deliveryTimes: currentSnapshot.deliveryTimes.map((item: any) => ({
          period: item.period,
          avgTime: item.avgTime,
          target: previousDeliveryTargets.get(item.period) ?? item.avgTime,
        })),
        customerSatisfaction,
      },
      comparisons: {
        lastMonth: {
          revenue: lastMonthSnapshot.overview.totalRevenue,
          orders: lastMonthSnapshot.overview.totalOrders,
          customers: lastMonthSnapshot.overview.totalCustomers,
        },
        lastQuarter: {
          revenue: lastQuarterSnapshot.overview.totalRevenue,
          orders: lastQuarterSnapshot.overview.totalOrders,
          customers: lastQuarterSnapshot.overview.totalCustomers,
        },
        lastYear: {
          revenue: lastYearSnapshot.overview.totalRevenue,
          orders: lastYearSnapshot.overview.totalOrders,
          customers: lastYearSnapshot.overview.totalCustomers,
        },
      },
    };

    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('Statistics error:', error);
    return c.json({ error: `Statistika ma\'lumotlarini olishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== PROFILE ROUTES ====================
app.get('/profile', async (c) => {
  try {
    const { branchId } = c.req.query();
    
    console.log('👤 Profile request:', { branchId });

    // For now, return mock data
    const mockData = {
      id: branchId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+998901234567',
      avatar: 'https://picsum.photos/seed/avatar/200/200.jpg',
      role: 'Branch Manager',
      department: 'Sales',
      joinDate: '2023-01-15',
      lastLogin: new Date().toISOString(),
      isActive: true,
      permissions: ['read', 'write', 'delete'],
      settings: {
        notifications: true,
        darkMode: false,
        language: 'uz'
      }
    };

    return c.json({ success: true, data: mockData });
  } catch (error: any) {
    console.error('Profile error:', error);
    return c.json({ error: `Profil ma\'lumotlarini olishda xatolik: ${error.message}` }, 500);
  }
});

Deno.serve(app.fetch);