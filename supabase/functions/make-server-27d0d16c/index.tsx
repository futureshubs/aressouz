import { Hono, type Context } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store_simple.ts";
import * as r2 from "./r2-storage.tsx";
import * as eskiz from "./eskiz-sms.tsx";
import * as houseSeed from "./house-seed.tsx";
import * as carSeed from "./car-seed.tsx";
import * as telegram from "./telegram.tsx";
import restaurantRoutes from "./restaurants.tsx";
import rentalRoutes from "./rentals.tsx";
import auctionRoutes from "./auction.tsx";
import bonusRoutes from "./bonus.tsx";
import bannerRoutes from "./banners.tsx";
import * as aresso from "./aresso.tsx";
import clickRoutes from "./click.tsx";
import {
  cancelReceipt as paymeCancelReceipt,
  checkReceipt as paymeCheckReceipt,
  createReceipt as paymeCreateReceipt,
  getReceipt as paymeGetReceipt,
  isPaymeConfiguredForMode,
  parsePaycomHttpsBackUrl,
  parsePaymeKvCredentials,
  resolvePaycomUseTestForPayme,
  sendReceipt as paymeSendReceipt,
} from "./payme.tsx";
import * as atmos from "./atmos.tsx";
import preparersRoutes from "./preparers.tsx";
import twoFactorRoutes from "./twoFactor.tsx";
import { coerceKvTestMode, normalizeKvTestModeForSave } from "./payment-kv-utils.ts";

async function paycomCallOptsForReceiptId(receiptId: string) {
  const meta = (await kv.get(`paycom_receipt:${receiptId}`)) as { useTest?: boolean } | null;
  return typeof meta?.useTest === "boolean" ? { useTest: meta.useTest } : undefined;
}

async function paycomCallOptsForReceiptIdWithKv(receiptId: string) {
  const paymeConfig = await kv.get("payment_method:payme");
  const kvCredentials = parsePaymeKvCredentials(paymeConfig);
  const fromReceipt = await paycomCallOptsForReceiptId(receiptId);
  const useTest =
    typeof fromReceipt?.useTest === "boolean"
      ? fromReceipt.useTest
      : resolvePaycomUseTestForPayme(paymeConfig);
  return { useTest, kvCredentials };
}

const app = new Hono();

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

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: [
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
      "X-Branch-Token",
      "x-branch-token",
      "X-Accountant-Token",
      "x-accountant-token",
      "apikey",
    ],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Content-Type"],
    maxAge: 600,
    credentials: false,
  }),
);

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Token, x-access-token, X-Seller-Token, x-seller-token, X-Courier-Token, x-courier-token, X-Admin-Code, x-admin-code, X-Branch-Token, x-branch-token, X-Accountant-Token, x-accountant-token, apikey',
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

// ==================== BRANCH STAFF (Xodim) AUTH + REGISTRATION ====================
type StaffRole = 'warehouse' | 'operator' | 'cashier' | 'accountant' | 'support';

const buildBranchSessionKey = (token: string) => `branch_session:${token}`;
const buildStaffKey = (staffId: string) => `staff:${staffId}`;
const buildAccountantSessionKey = (token: string) => `accountant_session:${token}`;

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

function sanitizeBranchSessionPayload(branch: any) {
  return {
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
  };
}

async function validateBranchSession(c: any) {
  const token =
    c.req.header('X-Branch-Token') ||
    c.req.header('x-branch-token') ||
    c.req.raw.headers.get('X-Branch-Token') ||
    c.req.raw.headers.get('x-branch-token') ||
    c.req.query('branchToken');

  if (!token) {
    return { success: false as const, error: 'Filial sessiyasi topilmadi' };
  }

  const session = await kv.get(buildBranchSessionKey(token));
  if (!session) {
    return { success: false as const, error: 'Filial sessiyasi topilmadi' };
  }

  if (Date.now() > Number(session.expiresAt || 0)) {
    await kv.del(buildBranchSessionKey(token));
    return { success: false as const, error: 'Filial sessiyasi muddati tugagan' };
  }

  const branchId = String(session.branchId || '');
  const branchRecord = branchId ? await kv.get(`branch:${branchId}`) : null;
  if (!branchRecord) {
    return { success: false as const, error: 'Filial topilmadi' };
  }

  return {
    success: true as const,
    token,
    branchId,
    branch: branchRecord,
  };
}

async function listAllBranches() {
  const branches = await kv.getByPrefix('branch:');
  return branches
    .filter((b: any) => b && !b.deleted)
    .map((b: any) => ({
      id: b.id,
      name: b.name || b.branchName,
      branchName: b.branchName || b.name,
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

    const payload = staff.map((s: any) => ({
      ...s,
      role: s.role,
    }));

    return c.json({ success: true, staff: payload });
  } catch (error: any) {
    console.log('Get staff error:', error);
    return c.json({ error: 'Xodimlarni olishda xatolik' }, 500);
  }
});

// Staff registration (branch manager / filial panel)
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
    const birthDate = String(
      body.birthDate || body.birth || body.tugilganKun || body.tugulganKun || ''
    ).trim();

    if (!role || !login || !password || !firstName || !lastName || !phone || !address || !gender || !birthDate) {
      return c.json({ error: "To'liq ma'lumot majburiy" }, 400);
    }

    if (password.length < 4) {
      return c.json({ error: 'Parol juda qisqa' }, 400);
    }

    // Uniqueness: (branchId + login)
    const allStaff = await kv.getByPrefix('staff:');
    const existing = allStaff.find(
      (s: any) => s && !s.deleted && s.branchId === branchAuth.branchId && s.login === login,
    );
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
    allStaff = allStaff.filter(
      (s: any) => s && !s.deleted && s.login === login && s.password === password,
    );

    if (!allStaff.length) {
      return c.json({ error: "Login yoki parol noto'g'ri" }, 401);
    }

    // If multiple records exist with same login/pass, take the newest active one
    allStaff.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const staff = allStaff[0];
    const role = staff.role as StaffRole;

    // Cashier login not enabled (per your request)
    if (role === 'cashier') {
      return c.json({ error: 'Kassa uchun login parol keyinroq qilinadi' }, 403);
    }

    // Accountant/Bogalter: allow selecting a branch at login
    if (role === 'accountant') {
      const branches = await listAllBranches();
      const branchOptions = branches.map((b: any) => ({ id: b.id, name: b.branchName || b.name }));

      if (!requestedBranchId) {
        return c.json({
          success: true,
          role,
          needsBranchSelect: true,
          branchOptions,
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
        role,
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

    // Other staff roles: create branch session token
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
    return c.json({ error: "Bogalter login xatoligi" }, 500);
  }
});

// ==================== AUTH ROUTES ====================

// ==================== SMS AUTH ROUTES ====================

// Send SMS verification code
app.post("/make-server-27d0d16c/auth/sms/send", async (c) => {
  try {
    const { phone } = await c.req.json();

    if (!phone) {
      return c.json({ error: 'Telefon raqam majburiy' }, 400);
    }

    // Validate phone format (998XXXXXXXXX)
    const phoneRegex = /^998\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return c.json({ error: 'Telefon raqam noto\'g\'ri formatda (masalan: 998901234567)' }, 400);
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
    await kv.set(`sms_code:${phone}`, {
      code,
      phone,
      expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
      createdAt: new Date().toISOString(),
    });

    // Send SMS
    const result = await eskiz.sendVerificationSMS(phone, code);

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

    // Get stored code
    const storedData = await kv.get(`sms_code:${phone}`);
    
    if (!storedData) {
      return c.json({ error: 'Kod topilmadi yoki muddati tugagan' }, 400);
    }

    // Check expiry
    if (Date.now() > storedData.expiresAt) {
      await kv.del(`sms_code:${phone}`);
      return c.json({ error: 'Kod muddati tugagan' }, 400);
    }

    // Verify code
    if (storedData.code !== code) {
      return c.json({ error: 'Kod noto\'g\'ri' }, 400);
    }

    // Check if user already exists
    const existingUser = await kv.get(`user_phone:${phone}`);
    
    if (existingUser) {
      return c.json({ error: 'Bu raqam allaqachon ro\'yxatdan o\'tgan' }, 400);
    }

    // Create user with Supabase Auth (using phone as email)
    const email = `${phone}@aresso.app`; // Virtual email
    const password = `${phone}-${Date.now()}`; // Auto-generated password

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        firstName,
        lastName,
        birthDate,
        gender,
        phone,
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
      phone,
      firstName,
      lastName,
      birthDate,
      gender,
      email,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`user:${authData.user.id}`, userProfile);
    await kv.set(`user_phone:${phone}`, {
      userId: authData.user.id,
      phone,
    });

    // Delete verification code
    await kv.del(`sms_code:${phone}`);

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
      phone,
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
      return c.json({ error: 'Telefon va kod majburiy' }, 400);
    }

    // Get stored code
    const storedData = await kv.get(`sms_code:${phone}`);
    
    if (!storedData) {
      return c.json({ error: 'Kod topilmadi yoki muddati tugagan' }, 400);
    }

    // Check expiry
    if (Date.now() > storedData.expiresAt) {
      await kv.del(`sms_code:${phone}`);
      return c.json({ error: 'Kod muddati tugagan' }, 400);
    }

    // Verify code
    if (storedData.code !== code) {
      return c.json({ error: 'Kod noto\'g\'ri' }, 400);
    }

    // Check if user exists
    const phoneData = await kv.get(`user_phone:${phone}`);
    
    if (!phoneData) {
      return c.json({ error: 'Bu raqam ro\'yxatdan o\'tmagan. Iltimos, avval ro\'yxatdan o\'ting.' }, 400);
    }

    // Get user profile
    const userProfile = await kv.get(`user:${phoneData.userId}`);

    if (!userProfile) {
      return c.json({ error: 'Foydalanuvchi topilmadi' }, 404);
    }

    // Get user from Supabase Auth
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(phoneData.userId);
    
    if (userError || !userData.user) {
      console.log('Get user error:', userError);
      return c.json({ error: 'Foydalanuvchi topilmadi' }, 404);
    }

    // Create access token manually using admin
    const accessToken = `${phoneData.userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🔑 ===== CREATING ACCESS TOKEN =====');
    console.log('🔑 Generated token:', accessToken);
    console.log('🔑 KV key:', `access_token:${accessToken}`);
    console.log('🔑 User ID:', phoneData.userId);
    
    // Store the access token in KV for validation
    const tokenData = {
      userId: phoneData.userId,
      phone,
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
    console.log('🔑 ===== TOKEN CREATION COMPLETE =====');

    // Delete verification code
    await kv.del(`sms_code:${phone}`);

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

// Get user by ID (requires auth)
app.get("/make-server-27d0d16c/user/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    
    if (!userId) {
      return c.json({ error: 'User ID majburiy' }, 400);
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
      .map((product: any) => ({
      ...product,
      source: 'market',
      price: product.price || 0,
      oldPrice: product.oldPrice || null,
      image: product.image || product.images?.[0] || null,
      stockQuantity: product.stock || 0,
      category: product.category || 'Market',
      rating: product.rating || 4.8,
      reviewCount: product.reviewCount || Math.floor(Math.random() * 500) + 100,
      isNew: product.createdAt && new Date(product.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      isBestseller: product.isBestseller || false,
    }));
    
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
        const firstVariant = product.variants?.[0];
        
        return {
          ...product,
          source: 'shop',
          price: firstVariant?.price || 0,
          oldPrice: firstVariant?.oldPrice || null,
          image: firstVariant?.images?.[0] || null,
          stockQuantity: firstVariant?.stock || 0,
          variantsCount: product.variants?.length || 0,
          category: product.category || 'Do\'kon',
          shopName: product.shopName || null, // Add shop name for display
          rating: 4.8,
          reviewCount: Math.floor(Math.random() * 500) + 100,
          isNew: product.createdAt && new Date(product.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
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
      await kv.del(`shop_product:${id}`);
      console.log('✅ Shop product deleted successfully');
      return c.json({ success: true, message: 'Mahsulot o\'chirildi' });
    }
    
    // If not found in shop_product, try branch product
    const branchProduct = await kv.get(`branchproduct:${id}`);
    
    if (branchProduct) {
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
      coordinates 
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
      await kv.del(`shop:${shop.id}`);
    }
    console.log(`✅ Deleted ${branchShops.length} shops`);
    
    // 5. Delete the branch itself
    console.log('🗑️ Step 5: Deleting branch...');
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
    
    // Calculate soldThisWeek for each product's variants
    for (const product of products) {
      if (product.variants && Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          variant.soldThisWeek = await calculateSoldThisWeek(product.id, variant.id);
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
    console.log(`🔍 Fetching product: ${id}`);
    
    const product = await kv.get(`branchproduct:${id}`);
    
    if (!product) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }
    
    // Calculate soldThisWeek for each variant
    if (product.variants && Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        variant.soldThisWeek = await calculateSoldThisWeek(id, variant.id);
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

// Get all users (admin only)
app.get("/make-server-27d0d16c/admin/users", async (c) => {
  try {
    console.log('👥 Fetching all users for admin...');
    
    // Get all users from KV store
    const allUsers = await kv.getByPrefix('user:');
    
    // Filter out non-user entries (like user_phone:, user:xxx:favorites, etc.)
    const users = allUsers.filter((item: any) => {
      // Only include entries that are direct user profiles
      const key = item.id || '';
      return key.startsWith('user:') && !key.includes(':favorites') && 
             !key.includes(':cart') && !key.includes(':bonus') && 
             !key.includes(':settings') && !key.includes(':purchase');
    });
    
    // Enrich user data with additional info
    const enrichedUsers = await Promise.all(users.map(async (user: any) => {
      // Get bonus info
      const bonusData = await kv.get(`user:${user.id}:bonus`) || {
        balance: 0,
        totalEarned: 0,
      };
      
      // Get purchase history count
      const purchases = await kv.getByPrefix(`user:${user.id}:purchase:`);
      
      // Calculate total spent
      let totalSpent = 0;
      purchases.forEach((purchase: any) => {
        totalSpent += purchase.amount || 0;
      });
      
      return {
        ...user,
        bonusBalance: bonusData.balance || 0,
        totalBonusEarned: bonusData.totalEarned || 0,
        purchasesCount: purchases.length,
        totalSpent: totalSpent,
        status: user.blocked ? 'blocked' : 'active',
      };
    }));
    
    // Sort by creation date (newest first)
    enrichedUsers.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    console.log(`✅ Found ${enrichedUsers.length} users`);
    return c.json({ 
      success: true,
      users: enrichedUsers,
      total: enrichedUsers.length,
    });
  } catch (error: any) {
    console.error('Get users error:', error);
    return c.json({ error: 'Foydalanuvchilarni olishda xatolik' }, 500);
  }
});

// Get user details (admin only)
app.get("/make-server-27d0d16c/admin/users/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    console.log('👤 Fetching user details:', userId);
    
    // Get user profile
    const user = await kv.get(`user:${userId}`);
    
    if (!user) {
      return c.json({ error: 'Foydalanuvchi topilmadi' }, 404);
    }
    
    // Get bonus info
    const bonusData = await kv.get(`user:${userId}:bonus`) || {
      balance: 0,
      earnedToday: 0,
      totalEarned: 0,
      tapCount: 0,
    };
    
    // Get favorites
    const favorites = await kv.get(`user:${userId}:favorites`) || [];
    
    // Get cart
    const cart = await kv.get(`user:${userId}:cart`) || [];
    
    // Get purchase history
    const purchases = await kv.getByPrefix(`user:${userId}:purchase:`);
    
    // Calculate total spent
    let totalSpent = 0;
    purchases.forEach((purchase: any) => {
      totalSpent += purchase.amount || 0;
    });
    
    // Sort purchases by date
    purchases.sort((a: any, b: any) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    
    const userDetails = {
      ...user,
      bonus: bonusData,
      favorites: favorites,
      cart: cart,
      purchases: purchases,
      purchasesCount: purchases.length,
      totalSpent: totalSpent,
      status: user.blocked ? 'blocked' : 'active',
    };
    
    console.log('✅ User details loaded');
    return c.json({ 
      success: true,
      user: userDetails,
    });
  } catch (error: any) {
    console.error('Get user details error:', error);
    return c.json({ error: 'Foydalanuvchi ma\'lumotlarini olishda xatolik' }, 500);
  }
});

// Block/Unblock user (admin only)
app.patch("/make-server-27d0d16c/admin/users/:userId/status", async (c) => {
  try {
    const userId = c.req.param('userId');
    const { blocked } = await c.req.json();
    
    console.log(`🔒 ${blocked ? 'Blocking' : 'Unblocking'} user:`, userId);
    
    // Get user profile
    const user = await kv.get(`user:${userId}`);
    
    if (!user) {
      return c.json({ error: 'Foydalanuvchi topilmadi' }, 404);
    }
    
    // Update user status
    const updatedUser = {
      ...user,
      blocked: blocked,
      blockedAt: blocked ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`user:${userId}`, updatedUser);
    
    console.log(`✅ User ${blocked ? 'blocked' : 'unblocked'}`);
    return c.json({ 
      success: true,
      user: updatedUser,
      message: blocked ? 'Foydalanuvchi bloklandi' : 'Foydalanuvchi aktivlashtirildi',
    });
  } catch (error: any) {
    console.error('Update user status error:', error);
    return c.json({ error: 'Foydalanuvchi holatini o\'zgartirishda xatolik' }, 500);
  }
});

// Delete user (admin only)
app.delete("/make-server-27d0d16c/admin/users/:userId", async (c) => {
  try {
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
    
    return c.json({ 
      success: true,
      listings: userListings,
      count: userListings.length
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
    const updatedListing = {
      ...existingListing,
      ...updatedData,
      id: listingId, // Keep original ID
      userId: auth.userId, // Keep original userId
      updatedAt: new Date().toISOString(),
    };

    // Save updated listing
    await kv.set(`listing:${auth.userId}:${listingId}`, updatedListing);
    
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

    await kv.del(`project:${portfolioId}:${projectId}`);

    return c.json({ success: true, message: 'Loyiha o\'chirildi' });
  } catch (error: any) {
    console.log('Delete project error:', error);
    return c.json({ error: `Loyiha o\'chirishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== REVIEWS ROUTES ====================

// ==================== LISTING ROUTES (HOUSE & CAR) ====================

// Check if user can create listing (first free, then paid)
app.get("/make-server-27d0d16c/check-listing-quota", async (c) => {
  try {
    const auth = await validateAccessToken(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    // Get all user's listings
    const userListings = await kv.getByPrefix(`listing:${auth.userId}:`);
    
    // First listing is free
    const canPostFree = userListings.length === 0;
    const requiresPayment = userListings.length > 0;

    return c.json({
      totalListings: userListings.length,
      canPostFree,
      requiresPayment,
      message: requiresPayment 
        ? 'Keyingi e\'lonlar uchun to\'lov kerak' 
        : 'Birinchi e\'lon bepul'
    });
  } catch (error: any) {
    console.error('Check listing quota error:', error);
    return c.json({ error: 'Tekshirishda xatolik' }, 500);
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
    
    // Validate required fields
    if (!data.title || !data.price || !data.categoryId || !data.images || data.images.length === 0) {
      return c.json({ error: 'Majburiy maydonlarni to\'ldiring' }, 400);
    }

    // Check if user can post (first free, then paid)
    const userListings = await kv.getByPrefix(`listing:${auth.userId}:`);
    if (userListings.length > 0) {
      // TODO: Check payment status
      // For now, allow posting but mark as requires payment
      console.log('⚠️ User has existing listings, should require payment');
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
      images: data.images,
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
      isPaid: userListings.length === 0, // First listing is free
    };

    await kv.set(`listing:${auth.userId}:${houseId}`, house);
    await kv.set(`house:${houseId}`, house);

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
    
    // Validate required fields
    if (!data.title || !data.price || !data.categoryId || !data.images || data.images.length === 0) {
      return c.json({ error: 'Majburiy maydonlarni to\'ldiring' }, 400);
    }

    // Check if user can post (first free, then paid)
    const userListings = await kv.getByPrefix(`listing:${auth.userId}:`);
    if (userListings.length > 0) {
      console.log('⚠️ User has existing listings, should require payment');
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
    
    const car = {
      id: carId,
      userId: auth.userId,
      type: 'car',
      name: data.title,
      categoryId: data.categoryId,
      category: data.categoryId,
      image: finalImageUrls.length > 0 ? finalImageUrls[0] : (data.images?.[0] || ''),
      images: finalImageUrls.length > 0 ? finalImageUrls : data.images,
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
      isPaid: userListings.length === 0,
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
    
    // Optimized filtering - single pass (case-insensitive)
    const filteredHouses = allHouses.filter((h: any) => {
      if (!h) return false;
      if (region && (!h.region || h.region.toLowerCase() !== region.toLowerCase())) return false;
      if (district && (!h.district || h.district.toLowerCase() !== district.toLowerCase())) return false;
      if (category && h.categoryId !== category) return false;
      return true;
    });

    console.log(`✅ Filtered houses: ${filteredHouses.length} out of ${allHouses.length}`);
    return c.json({ houses: filteredHouses });
  } catch (error) {
    console.log('Get houses error:', error);
    return c.json({ error: 'Uylarni olishda xatolik' }, 500);
  }
});

// Get single house
app.get("/make-server-27d0d16c/houses/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const house = await kv.get(`house:${id}`);
    
    if (!house) {
      return c.json({ error: 'Uy topilmadi' }, 404);
    }

    return c.json({ house });
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
    const houseId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const house = {
      id: houseId,
      ...houseData,
      userId: auth.userId,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`house:${houseId}`, house);

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
    
    return c.json({ success: true, cars: allCars });
  } catch (error: any) {
    console.log('Get cars error:', error);
    return c.json({ error: 'Avtomobillarni olishda xatolik' }, 500);
  }
});

// Get single car
app.get("/make-server-27d0d16c/cars/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const car = await kv.get(`car:${id}`);
    
    if (!car) {
      return c.json({ error: 'Avtomobil topilmadi' }, 404);
    }
    
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
    const carId = `car-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newCar = {
      ...carData,
      id: carId,
      userId: auth.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`car:${carId}`, newCar);

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
    
    // Validate security code (fixed code: 0099)
    const SECRET_CODE = '0099';
    
    if (!data.securityCode || data.securityCode !== SECRET_CODE) {
      console.log(`❌ Invalid security code. Expected: ${SECRET_CODE}, Got: ${data.securityCode}`);
      return c.json({ 
        error: `Noto'g'ri maxfiy kod!` 
      }, 403);
    }
    
    console.log(`✅ Security code validated: ${SECRET_CODE}`);

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

    // Validate security code (fixed code: 0099)
    const SECRET_CODE = '0099';

    console.log('🔐 Security code validation:');
    console.log('  Expected code:', SECRET_CODE);
    console.log('  Received code:', data.securityCode);

    if (!data.securityCode || data.securityCode !== SECRET_CODE) {
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

// ==================== HEALTH CHECK ====================

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
      public: ['/health', '/test-deployment'],
      auth: ['/auth/sms/send', '/auth/sms/signup', '/auth/sms/signin'],
      user: ['/user/profile', '/upload'],
      products: ['/products', '/foods']
    }
  });
});

// ==================== PAYMENT METHODS ROUTES ====================

// Get all payment methods configuration
app.get("/make-server-27d0d16c/payment-methods", async (c) => {
  try {
    console.log('💳 Fetching payment methods configuration...');
    
    const methods = await kv.getByPrefix('payment_method:');
    
    console.log(`✅ Found ${methods.length} payment methods`);
    return c.json({ 
      success: true,
      methods: methods,
    });
  } catch (error: any) {
    console.error('Get payment methods error:', error);
    return c.json({ error: 'To\'lov usullarini olishda xatolik' }, 500);
  }
});

// Save or update payment method configuration
app.post("/make-server-27d0d16c/payment-methods", async (c) => {
  try {
    const { type, enabled, isTestMode, config } = await c.req.json();
    
    console.log(`💾 Saving payment method: ${type}`);
    
    if (!type) {
      return c.json({ error: 'To\'lov turi majburiy' }, 400);
    }

    // Encrypt sensitive data before storing
    const encryptedConfig: any = {};
    for (const [key, value] of Object.entries(config || {})) {
      if (typeof value === 'string') {
        // In production, use proper encryption
        // For now, we'll store as is (should be encrypted in real app)
        encryptedConfig[key] = value;
      }
    }

    const methodData = {
      type,
      enabled: enabled || false,
      isTestMode: normalizeKvTestModeForSave(isTestMode),
      config: encryptedConfig,
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
    const type = c.req.param('type');
    console.log(`💳 Fetching payment method: ${type}`);
    
    const method = await kv.get(`payment_method:${type}`);
    
    if (!method) {
      return c.json({ error: 'To\'lov usuli topilmadi' }, 404);
    }
    
    console.log(`✅ Payment method found: ${type}`);
    return c.json({ 
      success: true,
      method: method,
    });
  } catch (error: any) {
    console.error('Get payment method error:', error);
    return c.json({ error: 'To\'lov usulini olishda xatolik' }, 500);
  }
});

// Delete payment method configuration
app.delete("/make-server-27d0d16c/payment-methods/:type", async (c) => {
  try {
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

    if (!paymeConfig || !paymeConfig.enabled) {
      return c.json({ error: 'Payme to\'lov usuli faol emas' }, 400);
    }

    const resolvedTest = resolvePaycomUseTestForPayme(paymeConfig);
    const kvPaymeCreds = parsePaymeKvCredentials(paymeConfig);
    const checkoutBackPm = parsePaycomHttpsBackUrl(
      (paymeConfig as { config?: { callbackUrl?: unknown } } | null)?.config?.callbackUrl,
    );
    if (!isPaymeConfiguredForMode(resolvedTest, kvPaymeCreds)) {
      return c.json(
        {
          error: resolvedTest
            ? "Paycom TEST: Admin Payme (Merchant ID + Secret Key) yoki Secrets: PAYCOM_REGISTER_ID + PAYCOM_SECRET_TEST."
            : "Paycom PROD: Admin Payme (Merchant ID + Secret Key) yoki Secrets: PAYCOM_REGISTER_ID + PAYCOM_SECRET_PROD.",
          code: "PAYCOM_ENV_MISSING",
        },
        503,
      );
    }

    const transactionId = `payme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const oid = String(orderId || transactionId);
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
      kvCredentials: kvPaymeCreds,
      checkoutBackUrl: checkoutBackPm,
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
    
    const clickConfig = await kv.get('payment_method:click');
    
    if (!clickConfig || !clickConfig.enabled) {
      return c.json({ error: 'Click to\'lov usuli faol emas' }, 400);
    }

    const amountSom = Number(amount);
    if (!Number.isFinite(amountSom) || amountSom <= 0) {
      return c.json({ error: 'Noto\'g\'ri summa' }, 400);
    }
    const cfg = (clickConfig as any).config || {};
    const serviceId = String(cfg.serviceId ?? '');
    const merchantId = String(cfg.merchantId ?? '');
    const merchantUserId = String(cfg.merchantUserId ?? cfg.merchant_user_id ?? '');

    const transactionId = `click_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const clickIsTest =
      coerceKvTestMode((clickConfig as { isTestMode?: unknown }).isTestMode) === true;

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
    if (merchantUserId) {
      payUrl.searchParams.set('merchant_user_id', merchantUserId);
    }
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
    const shopProducts = products.filter((p: any) => 
      p.shopId === auth.shopId && !p.deleted
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
    
    if (!product || product.shopId !== auth.shopId) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }

    const updateData = await c.req.json();
    
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
    
    if (!product || product.shopId !== auth.shopId) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }

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
    
    if (!product || product.shopId !== auth.shopId) {
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

// Get shop orders
app.get("/make-server-27d0d16c/seller/orders", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const orders = await kv.getByPrefix('shop_order:');
    const shopOrders = orders.filter((o: any) => o.shopId === auth.shopId);

    return c.json({ success: true, orders: shopOrders });
  } catch (error: any) {
    console.error('Get shop orders error:', error);
    return c.json({ error: 'Buyurtmalarni olishda xatolik' }, 500);
  }
});

// Update order status
app.put("/make-server-27d0d16c/seller/orders/:id", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const order = await kv.get(`shop_order:${id}`);
    
    if (!order || order.shopId !== auth.shopId) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }

    const { status } = await c.req.json();
    const updatedOrder = {
      ...order,
      status,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`shop_order:${id}`, updatedOrder);

    return c.json({ 
      success: true, 
      order: updatedOrder, 
      message: 'Buyurtma holati yangilandi' 
    });
  } catch (error: any) {
    console.error('Update order status error:', error);
    return c.json({ error: 'Buyurtma holatini yangilashda xatolik' }, 500);
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
      const product = await kv.get(`shop_product:${item.productId}`);
      if (!product) {
        return c.json({ error: `Mahsulot topilmadi: ${item.productId}` }, 404);
      }

      const variant = product.variants?.find((v: any) => v.id === item.variantId);
      if (!variant) {
        return c.json({ error: `Variant topilmadi: ${item.variantId}` }, 404);
      }

      // Check stock availability
      if (variant.stock < item.quantity) {
        return c.json({ 
          error: `Omborda yetarli mahsulot yo\'q: ${product.name} (${variant.name})`,
          available: variant.stock,
          requested: item.quantity
        }, 400);
      }

      // Update stock
      variant.stock -= item.quantity;
      await kv.set(`shop_product:${item.productId}`, product);

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

    // Send Telegram notification if chat ID is configured
    if (shop.telegramChatId) {
      console.log(`📱 Sending Telegram notification to shop ${shop.name} (Chat ID: ${shop.telegramChatId})`);
      
      const notificationSent = await telegram.sendOrderNotification({
        shopName: shop.name,
        shopChatId: shop.telegramChatId,
        orderNumber,
        customerName: customer.name || 'Noma\'lum',
        customerPhone: customer.phone || 'Ko\'rsatilmagan',
        customerAddress: customer.address || 'Ko\'rsatilmagan',
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
          minute: '2-digit'
        }),
      });

      if (notificationSent) {
        console.log(`✅ Telegram notification sent successfully for order ${orderNumber}`);
      } else {
        console.log(`⚠️ Failed to send Telegram notification for order ${orderNumber}`);
      }
    } else {
      console.log(`ℹ️ No Telegram chat ID configured for shop ${shop.name}`);
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
    const shopOrders = allOrders.filter((o: any) => o.shopId === auth.shopId);

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
    const shopProducts = allProducts.filter((p: any) => p.shopId === auth.shopId && !p.deleted);
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

// Get shop inventory
app.get("/make-server-27d0d16c/seller/inventory", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const products = await kv.getByPrefix('shop_product:');
    const inventory = products
      .filter((p: any) => p.shopId === auth.shopId && !p.deleted)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        stock: p.stock || 0,
        price: p.price,
        category: p.category,
        image: p.image,
      }));

    return c.json({ success: true, inventory });
  } catch (error: any) {
    console.error('Get inventory error:', error);
    return c.json({ error: 'Ombor ma\'lumotlarini olishda xatolik' }, 500);
  }
});

// Update product stock
app.put("/make-server-27d0d16c/seller/inventory/:id", async (c) => {
  try {
    const auth = await validateSellerSession(c);
    
    if (!auth.success) {
      return c.json({ error: auth.error }, 401);
    }

    const id = c.req.param('id');
    const product = await kv.get(`shop_product:${id}`);
    
    if (!product || product.shopId !== auth.shopId) {
      return c.json({ error: 'Mahsulot topilmadi' }, 404);
    }

    const { stock } = await c.req.json();
    const updatedProduct = {
      ...product,
      stock: stock !== undefined ? stock : product.stock,
      updatedAt: new Date().toISOString(),
    };

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
        // Flatten first variant data to product level for easier display
        const firstVariant = product.variants?.[0];
        
        return {
          ...product,
          // Add flattened fields from first variant
          price: firstVariant?.price || 0,
          oldPrice: firstVariant?.oldPrice || null,
          image: firstVariant?.images?.[0] || null,
          stockQuantity: firstVariant?.stock || 0,
          variantsCount: product.variants?.length || 0,
          // Add display-ready fields
          category: product.category || 'Mahsulot',
          shopName: product.shopName || null, // Add shop name for display
          rating: 4.8, // Default rating - can be updated with real reviews later
          reviewCount: Math.floor(Math.random() * 500) + 100, // Random for demo
          isNew: product.createdAt && new Date(product.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // New if created in last 7 days
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

// ==================== CAR CATEGORIES ROUTES ====================
app.get("/make-server-27d0d16c/car-categories", async (c) => {
  try {
    console.log('🚗 Getting car categories');
    
    const { data: categories, error } = await supabase
      .from('car_categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching car categories:', error);
      return c.json({ error: 'Kategoriyalarni olishda xatolik' }, 500);
    }

    return c.json({
      success: true,
      categories: categories || []
    });
  } catch (error: any) {
    console.error('Car categories error:', error);
    return c.json({ error: 'Serverda xatolik' }, 500);
  }
});

// ==================== REGIONS & DISTRICTS ROUTES ====================
app.get("/make-server-27d0d16c/regions", async (c) => {
  try {
    console.log('🗺️ Getting all regions');
    
    const { data: regions, error: regionsError } = await supabase
      .from('regions')
      .select('*')
      .order('name');

    const { data: districts, error: districtsError } = await supabase
      .from('districts')
      .select('*')
      .order('name');

    if (regionsError || districtsError) {
      console.error('Error fetching regions data:', regionsError || districtsError);
      return c.json({ error: 'Viloyatlarni olishda xatolik' }, 500);
    }

    // Format regions with districts
    const formattedRegions = regions?.map(region => ({
      id: region.id,
      name: region.name,
      districts: districts?.filter(district => district.region_id === region.id) || []
    })) || [];

    return c.json({
      success: true,
      regions: formattedRegions
    });
  } catch (error: any) {
    console.error('Regions error:', error);
    return c.json({ error: 'Serverda xatolik' }, 500);
  }
});

// ==================== CARS ROUTES (DATABASE) ====================
app.get("/make-server-27d0d16c/cars", async (c) => {
  try {
    console.log('🚗 Getting cars from database');
    
    const region = c.req.query('region');
    const district = c.req.query('district');
    const category_id = c.req.query('category_id');
    const available = c.req.query('available') === 'true';
    
    let query = supabase
      .from('cars')
      .select('*');

    // Apply filters
    if (region) {
      query = query.eq('region_id', region);
    }
    if (district) {
      query = query.eq('district_id', district);
    }
    if (category_id) {
      query = query.eq('category_id', category_id);
    }
    if (available) {
      query = query.eq('available', true);
    }

    const { data: cars, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cars:', error);
      return c.json({ error: 'Avtomobillarni olishda xatolik' }, 500);
    }

    return c.json({
      success: true,
      cars: cars || []
    });
  } catch (error: any) {
    console.error('Cars error:', error);
    return c.json({ error: 'Serverda xatolik' }, 500);
  }
});

app.get("/make-server-27d0d16c/cars/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log('🚗 Getting car:', id);
    
    const { data: car, error } = await supabase
      .from('cars')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching car:', error);
      return c.json({ error: 'Avtomobilni olishda xatolik' }, 500);
    }

    if (!car) {
      return c.json({ error: 'Avtomobil topilmadi' }, 404);
    }

    return c.json({
      success: true,
      car
    });
  } catch (error: any) {
    console.error('Car error:', error);
    return c.json({ error: 'Serverda xatolik' }, 500);
  }
});

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

// ==================== PAYME PAYMENT ROUTES ====================

const paymeCreateReceiptHandlerV2 = async (c: Context) => {
  try {
    const { amount, orderId, items, phone, returnUrl } = await c.req.json();

    console.log('💳 Creating Payme receipt:', { amount, orderId, itemsCount: items?.length, phone });

    if (!amount || !orderId) {
      return c.json({ error: 'Amount va orderId majburiy' }, 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'Items (mahsulotlar ro\'yxati) majburiy' }, 400);
    }

    const paymeConfig = await kv.get('payment_method:payme');
    const resolvedTest = resolvePaycomUseTestForPayme(paymeConfig);
    const kvPaymeCreds = parsePaymeKvCredentials(paymeConfig);
    const checkoutBackUrl =
      parsePaycomHttpsBackUrl(
        (paymeConfig as { config?: { callbackUrl?: unknown } } | null)?.config?.callbackUrl,
      ) ?? parsePaycomHttpsBackUrl(returnUrl);

    console.log('💳 Paycom create-receipt:', resolvedTest ? 'TEST' : 'PROD');

    if (!isPaymeConfiguredForMode(resolvedTest, kvPaymeCreds)) {
      return c.json(
        {
          error: resolvedTest
            ? 'Paycom TEST: Admin Payme (Merchant ID + Secret Key) yoki Secrets: PAYCOM_REGISTER_ID + PAYCOM_SECRET_TEST.'
            : 'Paycom PROD: Admin Payme (Merchant ID + Secret Key) yoki Secrets: PAYCOM_REGISTER_ID + PAYCOM_SECRET_PROD.',
          code: 'PAYCOM_ENV_MISSING',
        },
        503,
      );
    }

    const result = await paymeCreateReceipt(amount, orderId, items, phone, undefined, {
      useTest: resolvedTest,
      kvCredentials: kvPaymeCreds,
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
    }

    return c.json({
      success: true,
      receiptId: result.receiptId,
      checkoutUrl: result.checkoutUrl,
    });
  } catch (error: any) {
    console.error('Create receipt error:', error);
    return c.json({ error: `Chek yaratishda xatolik: ${error.message}` }, 500);
  }
};

app.post('/make-server-27d0d16c/payme/create-receipt', paymeCreateReceiptHandlerV2);
app.post('/make-server-27d0d16c/payme/create_receipt', paymeCreateReceiptHandlerV2);

// Check Payme receipt status
app.post('/make-server-27d0d16c/payme/check-receipt', async (c) => {
  try {
    const { receiptId } = await c.req.json();

    console.log('💳 Checking Payme receipt:', receiptId);

    if (!receiptId) {
      return c.json({ error: 'ReceiptId majburiy' }, 400);
    }

    const paycomOpts = await paycomCallOptsForReceiptIdWithKv(String(receiptId));
    const result = await paymeCheckReceipt(receiptId, paycomOpts);

    if (!result.success) {
      return c.json({ error: result.error || 'Chek tekshirishda xatolik' }, 400);
    }

    return c.json({
      success: true,
      isPaid: result.isPaid,
      isCancelled: result.isCancelled,
      state: result.state,
      receipt: result.receipt,
    });
  } catch (error: any) {
    console.error('Check receipt error:', error);
    return c.json({ error: `Chek tekshirishda xatolik: ${error.message}` }, 500);
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
    if (!isPaymeConfiguredForMode(paycomOpts.useTest, paycomOpts.kvCredentials)) {
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

// ==================== ARESSO PAYMENT ROUTES ====================

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

    // Get payment mapping (prod: payment_order; demo: order:{orderId}:payment)
    let mapping = await kv.get(`payment_order:${orderId}`);
    if (!mapping) {
      const legacyPid = await kv.get(`order:${orderId}:payment`);
      if (typeof legacyPid === 'string' && legacyPid.trim()) {
        mapping = { paymentId: legacyPid.trim(), orderId };
      }
    }

    if (!mapping || !mapping.paymentId) {
      return c.json({ 
        success: false,
        error: 'To\'lov topilmadi' 
      }, 404);
    }

    // Get payment data
    let paymentData = await kv.get(`payment:${mapping.paymentId}`);
    if (typeof paymentData === 'string') {
      try {
        paymentData = JSON.parse(paymentData);
      } catch {
        /* ignore */
      }
    }

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

// Create new order (GENERAL - Market, Food, Rental)
app.post("/make-server-27d0d16c/orders", async (c) => {
  try {
    const data = await c.req.json();
    
    console.log('📦 ===== CREATING NEW ORDER =====');
    console.log('📦 Full request data:', JSON.stringify(data, null, 2));
    console.log('📦 Order type:', data.orderType);
    console.log('📦 Customer:', data.customerName, data.customerPhone);
    console.log('📦 Payment:', data.paymentMethod, data.paymentStatus);
    console.log('📦 Items count:', data.items?.length);
    console.log('📦 Total:', data.finalTotal);
    console.log('📦 Delivery zone:', data.deliveryZone);
    
    const orderId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine initial status based on payment
    // For market orders:
    // - Cash payment: 'new' (waiting for admin confirmation)
    // - Online payment (paid): 'preparing' (auto-confirmed, ready for preparation)
    let initialStatus = 'pending';
    if (data.orderType === 'market') {
      if (data.paymentStatus === 'paid') {
        initialStatus = 'preparing'; // Online payment - auto-confirmed
      } else {
        initialStatus = 'new'; // Cash payment - needs confirmation
      }
    }
    
    const order = {
      id: orderId,
      orderNumber: `ORD-${Date.now()}`,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      orderType: data.orderType, // market, shop, food, rental
      items: data.items,
      totalAmount: data.totalAmount,
      deliveryPrice: data.deliveryPrice || 0,
      finalTotal: data.finalTotal,
      paymentMethod: data.paymentMethod, // cash, click, payme, atmos
      paymentStatus: data.paymentStatus || 'pending', // pending, paid
      promoCode: data.promoCode || null,
      bonusUsed: data.bonusUsed || 0,
      address: data.address,
      addressType: data.addressType,
      deliveryZone: data.deliveryZone,
      status: initialStatus, // new, preparing, with_courier, delivering, delivered, cancelled
      branchId: data.branchId || null,
      notes: data.notes || '',
      statusHistory: [{
        status: initialStatus,
        timestamp: new Date().toISOString(),
        note: data.paymentStatus === 'paid' ? 'Oldindan to\'lov qilingan' : 'Yangi buyurtma'
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Save order with type-specific key for better filtering
    const orderKey = data.orderType === 'market' 
      ? `order:market:${orderId}` 
      : `order:${orderId}`;
    
    await kv.set(orderKey, order);
    
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
    
    // TODO: Send notification to branch/courier
    
    return c.json({ success: true, id: orderId, order });
  } catch (error: any) {
    console.error('❌ Create order error:', error);
    console.error('❌ Error stack:', error.stack);
    return c.json({ error: `Buyurtma yaratishda xatolik: ${error.message}` }, 500);
  }
});

// ===== SPECIFIC ROUTES (must be before dynamic :id routes) =====

// Get all orders (admin)
app.get('/make-server-27d0d16c/orders/all', async (c) => {
  try {
    console.log('📦 Getting all orders');
    const allOrders = await kv.getByPrefix('order:');
    console.log(`📦 Found ${allOrders.length} orders`);
    
    const sortedOrders = allOrders
      .map((order: any) => ({
        ...order,
        type: order.orderType,
        orderId: order.orderNumber || order.id,
        customerAddress: order.address?.street || (typeof order.address === 'object' ? JSON.stringify(order.address) : order.address),
      }))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return c.json({ success: true, orders: sortedOrders, total: sortedOrders.length });
  } catch (error: any) {
    console.error('Get all orders error:', error);
    return c.json({ error: `Buyurtmalarni olishda xatolik: ${error.message}` }, 500);
  }
});

// Get order statistics
app.get('/make-server-27d0d16c/orders/stats', async (c) => {
  try {
    console.log('📦 Getting order statistics');
    const allOrders = await kv.getByPrefix('order:');
    
    const stats = {
      total: allOrders.length,
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
        total: allOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0),
        paid: allOrders.filter((o: any) => o.paymentStatus === 'paid')
          .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0),
      },
    };
    
    return c.json({ success: true, stats });
  } catch (error: any) {
    console.error('Get order stats error:', error);
    return c.json({ error: `Statistikani olishda xatolik: ${error.message}` }, 500);
  }
});

// Get orders by type
app.get('/make-server-27d0d16c/orders/type/:type', async (c) => {
  try {
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
    const { orderId, status } = await c.req.json();
    console.log(`📦 Updating order ${orderId} status to: ${status}`);
    
    if (!orderId || !status) {
      return c.json({ error: 'OrderId va status majburiy' }, 400);
    }
    
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }
    
    const updatedOrder = { ...order, status, updatedAt: new Date().toISOString() };
    await kv.set(`order:${orderId}`, updatedOrder);
    
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
    
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }
    
    if (order.status === 'delivered') {
      return c.json({ error: 'Yetkazilgan buyurtmani bekor qilib bo\'lmaydi' }, 400);
    }
    
    if (order.status === 'cancelled') {
      return c.json({ error: 'Buyurtma allaqachon bekor qilingan' }, 400);
    }
    
    const updatedOrder = { ...order, status: 'cancelled', updatedAt: new Date().toISOString() };
    await kv.set(`order:${orderId}`, updatedOrder);
    
    console.log('✅ Order cancelled successfully');
    return c.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Cancel order error:', error);
    return c.json({ error: `Buyurtmani bekor qilishda xatolik: ${error.message}` }, 500);
  }
});

// ===== DYNAMIC ROUTES (must be after specific routes) =====

// Update order status
app.put("/make-server-27d0d16c/orders/:id/status", async (c) => {
  try {
    const orderId = c.req.param('id');
    const { status } = await c.req.json();
    
    console.log('📦 Updating order status:', orderId, status);
    
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }
    
    const updatedOrder = {
      ...order,
      status,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`order:${orderId}`, updatedOrder);
    
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
    
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }
    
    return c.json({ order });
  } catch (error: any) {
    console.error('Get order error:', error);
    return c.json({ error: `Buyurtmani olishda xatolik: ${error.message}` }, 500);
  }
});

// Delete order (admin only)
app.delete("/make-server-27d0d16c/orders/:id", async (c) => {
  try {
    const orderId = c.req.param('id');
    
    console.log('📦 Deleting order:', orderId);
    
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }
    
    await kv.del(`order:${orderId}`);
    
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
    
    // Check if categories exist in KV store
    let categories = await kv.get('categories');
    
    if (!categories) {
      console.log('📝 Categories not found in KV, using default data...');
      
      // Default categories data
      categories = {
        catalogs: [
          {
            id: 'groceries',
            name: 'Oziq-ovqat',
            image: 'https://images.unsplash.com/photo-1543168256-418811576931?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncm9jZXJ5JTIwZm9vZCUyMGluZ3JlZGllbnRzfGVufDF8fHx8MTc3MzE2NjU3M3ww&ixlib=rb-4.1.0&q=80&w=1080',
            categories: [
              { id: 'pasta-cereals', name: 'Makaron va donli mahsulotlar', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800' },
              { id: 'rice', name: 'Guruch', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=800' },
              { id: 'flour', name: 'Un va undan mahsulotlar', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800' },
              { id: 'oil', name: 'Yog\'lar', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800' },
              { id: 'sugar-salt', name: 'Shakar va tuz', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=800' },
              { id: 'canned', name: 'Konserva mahsulotlari', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1615485736894-c32045e69ca0?w=800' },
            ]
          },
          {
            id: 'fruits',
            name: 'Mevalar',
            image: 'https://images.unsplash.com/photo-1607130813443-243737c21f7d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMGZydWl0cyUyMGNvbG9yZnVsfGVufDF8fHx8MTc3MzE0OTgzMnww&ixlib=rb-4.1.0&q=80&w=1080',
            categories: [
              { id: 'citrus', name: 'Sitrus mevalar', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=800' },
              { id: 'stone-fruits', name: 'Shaftoli va o\'rik', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1629828874514-944d8c58a8d6?w=800' },
              { id: 'berries', name: 'Rezavorlar', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800' },
              { id: 'apples-pears', name: 'Olma va nok', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=800' },
              { id: 'grapes', name: 'Uzum', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800' },
              { id: 'bananas', name: 'Banan', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=800' },
              { id: 'melons', name: 'Qovun va tarvuz', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1587049352846-1eecc30f269e?w=800' },
              { id: 'exotic-fruits', name: 'Ekzotik mevalar', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800' },
            ]
          },
          {
            id: 'vegetables',
            name: 'Sabzavotlar',
            image: 'https://images.unsplash.com/photo-1748342319942-223b99937d4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjBtYXJrZXR8ZW58MXx8fHwxNzczMTQzODM0fDA&ixlib=rb-4.1.0&q=80&w=1080',
            categories: [
              { id: 'tomatoes', name: 'Pomidor', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=800' },
              { id: 'cucumbers', name: 'Bodring', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=800' },
              { id: 'potatoes', name: 'Kartoshka', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1518977676601-b5362342d3e3?w=800' },
              { id: 'onions', name: 'Piyoz', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1592769655432-735b4b2d2b4c?w=800' },
              { id: 'carrots', name: 'Sabzavot', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1445282768819-95a93d8f5529?w=800' },
              { id: 'cabbage', name: 'Karam', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1576558413262-9c8596a2c0a6?w=800' },
              { id: 'greens', name: 'Yashil sabzavotlar', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1568905179914-84e1b9e5c066?w=800' },
              { id: 'root-vegetables', name: 'ildiz mevalar', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1478369402113-1fd53f17e8b4?w=800' },
            ]
          }
        ]
      };
      
      // Save to KV store for future use
      await kv.set('categories', categories);
      console.log('✅ Default categories saved to KV store');
    }
    
    return c.json({ success: true, data: categories });
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
    
    // Save to KV store
    await kv.set('categories', body);
    
    console.log('✅ Categories updated successfully');
    return c.json({ success: true, data: body });
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
app.get('/vehicle-brands', async (c) => {
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

app.get('/fuel-types', async (c) => {
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

app.get('/transmission-types', async (c) => {
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
app.get('/service-categories', async (c) => {
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
app.get('/delivery-options', async (c) => {
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
app.put('/admin/vehicle-brands', async (c) => {
  try {
    const { brands } = await c.req.json();
    await kv.set('vehicle_brands', brands);
    return c.json({ success: true, message: 'Vehicle brands updated successfully' });
  } catch (error) {
    console.error('Error updating vehicle brands:', error);
    return c.json({ success: false, error: 'Failed to update vehicle brands' }, 500);
  }
});

app.put('/admin/fuel-types', async (c) => {
  try {
    const { fuelTypes } = await c.req.json();
    await kv.set('fuel_types', fuelTypes);
    return c.json({ success: true, message: 'Fuel types updated successfully' });
  } catch (error) {
    console.error('Error updating fuel types:', error);
    return c.json({ success: false, error: 'Failed to update fuel types' }, 500);
  }
});

app.put('/admin/transmission-types', async (c) => {
  try {
    const { transmissionTypes } = await c.req.json();
    await kv.set('transmission_types', transmissionTypes);
    return c.json({ success: true, message: 'Transmission types updated successfully' });
  } catch (error) {
    console.error('Error updating transmission types:', error);
    return c.json({ success: false, error: 'Failed to update transmission types' }, 500);
  }
});

app.put('/admin/service-categories', async (c) => {
  try {
    const { categories } = await c.req.json();
    await kv.set('service_categories', categories);
    return c.json({ success: true, message: 'Service categories updated successfully' });
  } catch (error) {
    console.error('Error updating service categories:', error);
    return c.json({ success: false, error: 'Failed to update service categories' }, 500);
  }
});

app.put('/admin/delivery-options', async (c) => {
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

// ==================== ANALYTICS ROUTES ====================

// Test endpoint
app.get('/make-server-27d0d16c/analytics-test', async (c) => {
  return c.json({ success: true, message: 'Analytics route is working!' });
});

app.get('/make-server-27d0d16c/analytics', async (c) => {
  try {
    const { branchId, dateRange, category } = c.req.query();
    
    console.log('📊 Analytics request:', { branchId, dateRange, category });

    // For now, return mock data
    const mockData = {
      totalRevenue: 25480000,
      totalOrders: 1245,
      totalCustomers: 892,
      totalProducts: 156,
      revenueGrowth: 15.3,
      ordersGrowth: 8.7,
      customersGrowth: 12.1,
      topProducts: [
        { name: 'Lavash', sales: 245, revenue: 3675000 },
        { name: 'Cola 1.5L', sales: 189, revenue: 2835000 },
        { name: 'Shaurma', sales: 167, revenue: 2505000 },
        { name: 'Hot Dog', sales: 134, revenue: 2010000 },
        { name: 'Burger', sales: 112, revenue: 1680000 }
      ],
      categoryStats: [
        { category: 'Taomlar', revenue: 15480000, orders: 678, percentage: 60.7 },
        { category: 'Ichimliklar', revenue: 6230000, orders: 389, percentage: 24.5 },
        { category: 'Fast Food', revenue: 2870000, orders: 178, percentage: 11.3 },
        { category: 'Shirinliklar', revenue: 920000, orders: 100, percentage: 3.6 }
      ],
      dailyStats: [
        { date: '2025-03-13', revenue: 3240000, orders: 167 },
        { date: '2025-03-14', revenue: 3890000, orders: 198 },
        { date: '2025-03-15', revenue: 4120000, orders: 213 },
        { date: '2025-03-16', revenue: 3780000, orders: 189 },
        { date: '2025-03-17', revenue: 4230000, orders: 234 },
        { date: '2025-03-18', revenue: 3980000, orders: 201 },
        { date: '2025-03-19', revenue: 4240000, orders: 243 }
      ]
    };

    return c.json({ success: true, data: mockData });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return c.json({ error: `Analytics ma\'lumotlarini olishda xatolik: ${error.message}` }, 500);
  }
});

// ==================== END OF STATIC DATA ROUTES ====================

// Helper function to generate daily analytics stats
function generateDailyAnalyticsStats(totalRevenue: number, totalOrders: number, totalCustomers: number, dateRange: string) {
  const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
  const dailyRevenue = totalRevenue / days;
  const dailyOrders = totalOrders / days;
  const dailyCustomers = totalCustomers / days;
  
  return Array.from({ length: Math.min(days, 7) }, (_, i) => ({
    date: new Date(Date.now() - (days - i - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    revenue: Math.floor(dailyRevenue * (0.8 + Math.random() * 0.4)),
    orders: Math.floor(dailyOrders * (0.8 + Math.random() * 0.4)),
    customers: Math.floor(dailyCustomers * (0.8 + Math.random() * 0.4))
  }));
}

// Helper function to generate category statistics
async function generateCategoryStats(branchId: string, startDate: Date, endDate: Date) {
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select('category, total_amount')
      .eq('branch_id', branchId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const categoryRevenue = orders?.reduce((acc: any, order) => {
      const category = order.category || 'Noma\'lum';
      acc[category] = (acc[category] || 0) + (order.total_amount || 0);
      return acc;
    }, {});

    const categoryOrders = orders?.reduce((acc: any, order) => {
      const category = order.category || 'Noma\'lum';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const totalRevenue = Object.values(categoryRevenue).reduce((sum, rev) => sum + rev, 0);

    return Object.entries(categoryRevenue).map(([category, revenue]) => ({
      category,
      revenue,
      orders: categoryOrders[category] || 0,
      percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
    }));
  } catch (error) {
    console.error('Error generating category stats:', error);
    return [];
  }
}

// Helper function to generate daily trend data
function generateDailyTrends(totalValue: number, period: string) {
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
  const dailyValue = totalValue / days;
  
  return Array.from({ length: Math.min(days, 7) }, (_, i) => ({
    date: new Date(Date.now() - (days - i - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    value: Math.floor(dailyValue * (0.8 + Math.random() * 0.4)),
    change: Math.random() * 20 - 10 // Random change between -10% and +10%
  }));
}

// ==================== STATISTICS ROUTES ====================
app.get('/statistics', async (c) => {
  try {
    const { branchId, period, metric } = c.req.query();
    
    console.log('📈 Statistics request:', { branchId, period, metric });

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get orders for this branch and period
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('branch_id', branchId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString());

    if (ordersError) {
      console.error('Error fetching orders for statistics:', ordersError);
      return c.json({ error: 'Statistika ma\'lumotlarini olishda xatolik' }, 500);
    }

    // Calculate statistics from real data
    const totalOrders = orders?.length || 0;
    const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
    const totalCustomers = new Set(orders?.map(order => order.customer_id) || []).size;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get products for this branch
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('name, total_sales, revenue')
      .eq('branch_id', branchId);

    const topProducts = products?.slice(0, 5).map(product => ({
      name: product.name,
      revenue: product.revenue || 0,
      orders: product.total_sales || 0,
      rating: 4.5 // Placeholder
    })) || [];

    // Generate trend data (mock for now, but based on real data)
    const trends = {
      revenue: generateDailyTrends(totalRevenue, period),
      orders: generateDailyTrends(totalOrders, period),
      customers: generateDailyTrends(totalCustomers, period)
    };

    const statisticsData = {
      overview: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        conversionRate: 3.2, // Placeholder
        customerRetention: 68.5, // Placeholder
        operatingCosts: totalRevenue * 0.3, // Placeholder
        netProfit: totalRevenue * 0.7, // Placeholder
        profitMargin: 70 // Placeholder
      },
      performance: {
        avgOrderValue: averageOrderValue,
        conversionRate: 3.2,
        customerRetention: 68.5,
        orderCompletionRate: 94.2
      },
      trends,
      comparisons: {
        lastMonth: { revenue: totalRevenue * 0.8, orders: totalOrders * 0.8, customers: totalCustomers * 0.8 },
        lastQuarter: { revenue: totalRevenue * 2.5, orders: totalOrders * 2.5, customers: totalCustomers * 2.5 },
        lastYear: { revenue: totalRevenue * 10, orders: totalOrders * 10, customers: totalCustomers * 10 }
      }
    };

    return c.json({ success: true, data: statisticsData });
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

// Start server
const port = parseInt(Deno.env.get('PORT') || '8001');
console.log(`🚀 Server starting on port ${port}`);

Deno.serve({ port }, app.fetch);