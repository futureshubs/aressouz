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

// Verify TOTP code (with time window tolerance)
async function verifyTOTP(secret: string, token: string, window: number = 1): Promise<boolean> {
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

  const isValid = await verifyTOTP(twoFactorData.secret, normalizedToken);

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
    const issuer = 'Online Shop';
    const accountName = branchName || branchId;
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

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
    const isValid = await verifyTOTP(twoFactorData.secret, token);

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

    const result = await verifyBranchTwoFactorLogin(branchId, token);
    if (!result.ok) {
      console.log('❌ Invalid 2FA token');
      return c.json({ error: result.error || 'Kod noto\'g\'ri' }, 400);
    }

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
