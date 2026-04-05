// Two-Factor Authentication (2FA) System
// Google Authenticator Integration

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const twoFactor = new Hono();

// Generate random secret for 2FA
function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Base32 alphabet
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// Generate backup codes
function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substr(2, 8).toUpperCase();
    codes.push(code);
  }
  return codes;
}

// Base32 decode for TOTP
function base32Decode(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  
  for (const char of base32.toUpperCase().replace(/=+$/, '')) {
    const val = alphabet.indexOf(char);
    if (val === -1) throw new Error('Invalid base32 character');
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
  }
  
  return bytes;
}

// HMAC-SHA1 implementation
async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(signature);
}

// Generate TOTP code
async function generateTOTP(secret: string, timeStep: number = 30): Promise<string> {
  const time = Math.floor(Date.now() / 1000 / timeStep);
  const timeBuffer = new Uint8Array(8);
  const dataView = new DataView(timeBuffer.buffer);
  dataView.setBigUint64(0, BigInt(time), false);
  
  const key = base32Decode(secret);
  const hmac = await hmacSha1(key, timeBuffer);
  
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

// Verify TOTP code (RFC 6238 / Google Authenticator: 30s, 6 digits, SHA1; ±window qadam — soat siljishiga chidamli)
async function verifyTOTP(secret: string, token: string, window: number = 2): Promise<boolean> {
  const timeStep = 30;
  const currentTime = Math.floor(Date.now() / 1000 / timeStep);
  
  for (let i = -window; i <= window; i++) {
    const time = currentTime + i;
    const timeBuffer = new Uint8Array(8);
    const dataView = new DataView(timeBuffer.buffer);
    dataView.setBigUint64(0, BigInt(time), false);
    
    const key = base32Decode(secret);
    const hmac = await hmacSha1(key, timeBuffer);
    
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    ) % 1000000;
    
    if (code.toString().padStart(6, '0') === token) {
      return true;
    }
  }
  
  return false;
}

// ==================== Filial login: 2FA noto‘g‘ri urinishlar + bloklash ====================
const BRANCH_2FA_LOCK_KV = (branchId: string) => `2fa:branch-login-lockout:${branchId}`;
const BRANCH_2FA_MAX_FAILS = 3;
const MS_DAY = 86_400_000;
const MS_WEEK = 7 * MS_DAY;
/** ~10 yil (kabisa bilan) */
const MS_TEN_YEAR = Math.floor(10 * 365.25 * MS_DAY);

type Branch2FALockState = {
  failures: number;
  /** 0 = keyingi blok 1 kun; 1 = 1 hafta; 2+ = 10 yil */
  strike: number;
  lockedUntil: string | null;
};

function lockDurationMsForStrike(strike: number): number {
  if (strike <= 0) return MS_DAY;
  if (strike === 1) return MS_WEEK;
  return MS_TEN_YEAR;
}

function formatLockoutMessageUz(lockedUntilIso: string): string {
  const until = new Date(lockedUntilIso).getTime();
  if (!Number.isFinite(until)) {
    return "2FA urinishlari vaqtincha bloklangan. Keyinroq qayta urinib ko‘ring.";
  }
  const d = new Date(until);
  const human = d.toLocaleString("uz-UZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `Juda ko‘p noto‘g‘ri kod. 2FA bloklangan. Qayta urinish: ${human}`;
}

export async function getBranch2FALoginLockState(branchId: string): Promise<Branch2FALockState> {
  const key = BRANCH_2FA_LOCK_KV(branchId);
  const raw = await kv.get(key);
  if (!raw || typeof raw !== "object") {
    return { failures: 0, strike: 0, lockedUntil: null };
  }
  const lockedUntil = raw.lockedUntil != null ? String(raw.lockedUntil) : null;
  const now = Date.now();
  if (lockedUntil) {
    const untilMs = new Date(lockedUntil).getTime();
    if (Number.isFinite(untilMs) && now >= untilMs) {
      const next: Branch2FALockState = {
        failures: 0,
        strike: Math.min(3, Math.max(0, Number(raw.strike) || 0)),
        lockedUntil: null,
      };
      await kv.set(key, next);
      return next;
    }
  }
  return {
    failures: Math.max(0, Number(raw.failures) || 0),
    strike: Math.min(3, Math.max(0, Number(raw.strike) || 0)),
    lockedUntil,
  };
}

export async function assertBranch2FANotLocked(
  branchId: string,
): Promise<
  | { ok: true }
  | { ok: false; error: string; lockedUntil: string; retryAfterMs: number }
> {
  const state = await getBranch2FALoginLockState(branchId);
  if (!state.lockedUntil) return { ok: true };
  const untilMs = new Date(state.lockedUntil).getTime();
  const now = Date.now();
  if (!Number.isFinite(untilMs) || now >= untilMs) {
    return { ok: true };
  }
  return {
    ok: false,
    error: formatLockoutMessageUz(state.lockedUntil),
    lockedUntil: state.lockedUntil,
    retryAfterMs: Math.max(0, untilMs - now),
  };
}

export type Branch2FAFailureRecord = {
  justLocked: boolean;
  lockedUntil: string | null;
  /** Ushbu muvaffaqiyatsiz urinishdan keyin yana nechta noto‘g‘ri kod qabul qilinsa bloklanadi (0 = hozir bloklandi) */
  attemptsRemaining: number;
};

export async function recordBranch2FALoginFailure(branchId: string): Promise<Branch2FAFailureRecord> {
  const key = BRANCH_2FA_LOCK_KV(branchId);
  let state = await getBranch2FALoginLockState(branchId);
  if (state.lockedUntil) {
    const untilMs = new Date(state.lockedUntil).getTime();
    if (Number.isFinite(untilMs) && Date.now() < untilMs) {
      return {
        justLocked: false,
        lockedUntil: state.lockedUntil,
        attemptsRemaining: 0,
      };
    }
  }

  state.failures += 1;
  if (state.failures >= BRANCH_2FA_MAX_FAILS) {
    const dur = lockDurationMsForStrike(state.strike);
    const lockedUntil = new Date(Date.now() + dur).toISOString();
    state.lockedUntil = lockedUntil;
    state.failures = 0;
    state.strike = Math.min(state.strike + 1, 3);
    await kv.set(key, state);
    return {
      justLocked: true,
      lockedUntil,
      attemptsRemaining: 0,
    };
  }

  await kv.set(key, state);
  return {
    justLocked: false,
    lockedUntil: null,
    attemptsRemaining: BRANCH_2FA_MAX_FAILS - state.failures,
  };
}

export async function clearBranch2FALoginLockout(branchId: string): Promise<void> {
  await kv.del(BRANCH_2FA_LOCK_KV(branchId));
}

export async function getBranch2FALockoutMeta(branchId: string): Promise<{
  locked: boolean;
  lockedUntil: string | null;
  message?: string;
}> {
  const state = await getBranch2FALoginLockState(branchId);
  if (!state.lockedUntil) return { locked: false, lockedUntil: null };
  const untilMs = new Date(state.lockedUntil).getTime();
  if (!Number.isFinite(untilMs) || Date.now() >= untilMs) {
    return { locked: false, lockedUntil: null };
  }
  return {
    locked: true,
    lockedUntil: state.lockedUntil,
    message: formatLockoutMessageUz(state.lockedUntil),
  };
}

export async function branchRequiresTwoFactor(branchId: string): Promise<boolean> {
  const twoFactorData = await kv.get(`2fa:branch:${branchId}`);
  return Boolean(twoFactorData?.enabled);
}

export async function verifyBranchTwoFactorLogin(
  branchId: string,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const twoFactorData = await kv.get(`2fa:branch:${branchId}`);

  if (!twoFactorData || !twoFactorData.enabled) {
    return { ok: false, error: "2FA yoqilmagan" };
  }

  const backupCodes = Array.isArray(twoFactorData.backupCodes) ? twoFactorData.backupCodes : [];
  const normalizedToken = String(token || "").trim();
  const backupCodeIndex = backupCodes.findIndex(
    (code: string) => String(code).toUpperCase() === normalizedToken.toUpperCase(),
  );

  if (backupCodeIndex !== -1) {
    twoFactorData.backupCodes.splice(backupCodeIndex, 1);
    await kv.set(`2fa:branch:${branchId}`, twoFactorData);
    return { ok: true };
  }

  const digitsOnly = normalizedToken.replace(/\D/g, "");
  const totpCode = digitsOnly.length === 6 ? digitsOnly : "";
  if (!totpCode) {
    return { ok: false, error: "Kod noto‘g‘ri (6 raqamli authenticator kodi yoki backup kod)" };
  }

  const isValid = await verifyTOTP(twoFactorData.secret, totpCode, 2);

  if (!isValid) {
    return { ok: false, error: "Kod noto'g'ri" };
  }

  return { ok: true };
}

// ==================== 2FA SETUP ROUTES ====================

// Enable 2FA for branch
twoFactor.post('/enable', async (c) => {
  try {
    const { branchId, branchName } = await c.req.json();

    console.log('🔐 Enabling 2FA for branch:', branchId);

    if (!branchId) {
      return c.json({ error: 'Branch ID majburiy' }, 400);
    }

    // Check if 2FA already enabled
    const existing2FA = await kv.get(`2fa:branch:${branchId}`);
    if (existing2FA && existing2FA.enabled) {
      return c.json({ error: '2FA allaqachon yoqilgan' }, 400);
    }

    // Generate secret and backup codes
    const secret = generateSecret();
    const backupCodes = generateBackupCodes(10);

    // Generate QR code data (otpauth URL)
    const issuer = 'Filial Panel';
    const accountName = branchName || branchId;
    const otpauthUrl =
      `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}` +
      `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    // Save 2FA data (but not enabled yet - needs verification)
    const twoFactorData = {
      branchId,
      secret,
      backupCodes,
      enabled: false, // Will be enabled after first verification
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`2fa:branch:${branchId}`, twoFactorData);

    console.log('✅ 2FA setup data created for branch:', branchId);

    return c.json({
      success: true,
      secret,
      qrCodeUrl: otpauthUrl,
      backupCodes,
      message: '2FA sozlamalari yaratildi. Google Authenticator\'ga QR kodni skanerlang.',
    });
  } catch (error: any) {
    console.error('❌ Enable 2FA error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Verify and activate 2FA
twoFactor.post('/verify-and-enable', async (c) => {
  try {
    const { branchId, token } = await c.req.json();

    console.log('🔐 Verifying 2FA token for branch:', branchId);

    if (!branchId || !token) {
      return c.json({ error: 'Branch ID va token majburiy' }, 400);
    }

    // Get 2FA data
    const twoFactorData = await kv.get(`2fa:branch:${branchId}`);

    if (!twoFactorData) {
      return c.json({ error: '2FA sozlamalari topilmadi. Avval 2FA ni yoqing.' }, 404);
    }

    // Verify token
    const tokenDigits = String(token || "").trim().replace(/\D/g, "");
    const totpTry = tokenDigits.length === 6 ? tokenDigits : "";
    if (!totpTry) {
      return c.json({ error: '6 raqamli kod kiriting' }, 400);
    }
    const isValid = await verifyTOTP(twoFactorData.secret, totpTry, 2);

    if (!isValid) {
      console.log('❌ Invalid 2FA token');
      return c.json({ error: 'Kod noto\'g\'ri. Qaytadan urinib ko\'ring.' }, 400);
    }

    // Enable 2FA
    twoFactorData.enabled = true;
    twoFactorData.updatedAt = new Date().toISOString();
    await kv.set(`2fa:branch:${branchId}`, twoFactorData);

    console.log('✅ 2FA enabled successfully for branch:', branchId);

    return c.json({
      success: true,
      message: '2FA muvaffaqiyatli yoqildi!',
    });
  } catch (error: any) {
    console.error('❌ Verify 2FA error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Disable 2FA
twoFactor.post('/disable', async (c) => {
  try {
    const { branchId, password } = await c.req.json();

    console.log('🔐 Disabling 2FA for branch:', branchId);

    if (!branchId || !password) {
      return c.json({ error: 'Branch ID va parol majburiy' }, 400);
    }

    // Verify password
    const branch = await kv.get(`branch:${branchId}`);
    if (!branch || branch.password !== password) {
      return c.json({ error: 'Parol noto\'g\'ri' }, 400);
    }

    // Delete 2FA data
    await kv.del(`2fa:branch:${branchId}`);

    console.log('✅ 2FA disabled for branch:', branchId);

    return c.json({
      success: true,
      message: '2FA o\'chirildi',
    });
  } catch (error: any) {
    console.error('❌ Disable 2FA error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get 2FA status
twoFactor.get('/status/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');

    console.log('🔐 Getting 2FA status for branch:', branchId);

    const twoFactorData = await kv.get(`2fa:branch:${branchId}`);

    if (!twoFactorData) {
      return c.json({
        success: true,
        enabled: false,
        message: '2FA o\'chiq',
      });
    }

    return c.json({
      success: true,
      enabled: twoFactorData.enabled,
      createdAt: twoFactorData.createdAt,
      backupCodesCount: twoFactorData.backupCodes?.filter((c: any) => !c.used).length || 0,
    });
  } catch (error: any) {
    console.error('❌ Get 2FA status error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get backup codes
twoFactor.get('/backup-codes/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');

    console.log('🔐 Getting backup codes for branch:', branchId);

    const twoFactorData = await kv.get(`2fa:branch:${branchId}`);

    if (!twoFactorData) {
      return c.json({ error: '2FA sozlamalari topilmadi' }, 404);
    }

    return c.json({
      success: true,
      backupCodes: twoFactorData.backupCodes || [],
    });
  } catch (error: any) {
    console.error('❌ Get backup codes error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== 2FA VERIFICATION ROUTES ====================

// Verify 2FA token during login
twoFactor.post('/verify', async (c) => {
  try {
    const { branchId, token } = await c.req.json();

    console.log('🔐 Verifying 2FA token for login:', branchId);

    if (!branchId || !token) {
      return c.json({ error: 'Branch ID va token majburiy' }, 400);
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

    const result = await verifyBranchTwoFactorLogin(branchId, token);
    if (!result.ok) {
      console.log('❌ Invalid 2FA token');
      const rec = await recordBranch2FALoginFailure(branchId);
      return c.json(
        {
          error: result.error || 'Kod noto\'g\'ri',
          attemptsRemaining: rec.attemptsRemaining,
          ...(rec.justLocked && rec.lockedUntil
            ? { lockout: true, lockedUntil: rec.lockedUntil }
            : {}),
        },
        401,
      );
    }

    await clearBranch2FALoginLockout(branchId);
    console.log('✅ 2FA token verified successfully');

    return c.json({
      success: true,
      message: 'Kod to\'g\'ri',
    });
  } catch (error: any) {
    console.error('❌ Verify 2FA token error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Regenerate backup codes
twoFactor.post('/regenerate-backup-codes', async (c) => {
  try {
    const { branchId, password } = await c.req.json();

    console.log('🔐 Regenerating backup codes for branch:', branchId);

    if (!branchId || !password) {
      return c.json({ error: 'Branch ID va parol majburiy' }, 400);
    }

    // Verify password
    const branch = await kv.get(`branch:${branchId}`);
    if (!branch || branch.password !== password) {
      return c.json({ error: 'Parol noto\'g\'ri' }, 400);
    }

    // Get 2FA data
    const twoFactorData = await kv.get(`2fa:branch:${branchId}`);

    if (!twoFactorData || !twoFactorData.enabled) {
      return c.json({ error: '2FA yoqilmagan' }, 400);
    }

    // Generate new backup codes
    const newBackupCodes = generateBackupCodes(10);
    twoFactorData.backupCodes = newBackupCodes;
    twoFactorData.updatedAt = new Date().toISOString();

    await kv.set(`2fa:branch:${branchId}`, twoFactorData);

    console.log('✅ Backup codes regenerated');

    return c.json({
      success: true,
      backupCodes: newBackupCodes,
      message: 'Yangi backup kodlar yaratildi',
    });
  } catch (error: any) {
    console.error('❌ Regenerate backup codes error:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default twoFactor;
