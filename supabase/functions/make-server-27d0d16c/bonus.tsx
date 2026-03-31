import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// ==================== HELPER FUNCTIONS ====================

// Retry helper for database operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Retry ${i + 1}/${maxRetries} failed:`, error.message);
      
      // If it's a connection error, retry
      if (error.message.includes('broken pipe') || 
          error.message.includes('connection error') ||
          error.message.includes('stream closed')) {
        if (i < maxRetries - 1) {
          console.log(`⏳ Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
      }
      
      // If it's not a connection error or max retries reached, throw
      throw error;
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

// Get user bonus data from KV store with retry
async function getUserBonusData(userId: string) {
  const key = `bonus:${userId}`;
  console.log('📊 Getting bonus data for user:', userId);
  
  const existing = await retryOperation(
    async () => await kv.get(key),
    3, // 3 retries
    500 // 500ms delay
  );
  
  const today = getTodayString();
  
  if (existing) {
    // KV store returns parsed JSONB, no need to JSON.parse
    const data = existing;
    
    // Reset daily taps if new day
    if (data.lastResetDate !== today) {
      data.dailyTaps = 0;
      data.lastResetDate = today;
      await retryOperation(
        async () => await kv.set(key, data),
        3,
        500
      );
    }
    
    return data;
  }
  
  // Create new bonus data
  const newData = {
    userId,
    balance: 0,
    totalEarned: 0,
    dailyTaps: 0,
    bonusTaps: 0,
    lastResetDate: today,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await retryOperation(
    async () => await kv.set(key, newData),
    3,
    500
  );
  
  return newData;
}

// Save tap history to KV store with retry
async function saveTapHistory(userId: string, amount: number, balanceAfter: number) {
  const historyKey = `bonus_history:${userId}:${Date.now()}`;
  const historyData = {
    userId,
    type: 'tap',
    amount,
    balanceAfter,
    timestamp: new Date().toISOString(),
  };
  
  await retryOperation(
    async () => await kv.set(historyKey, historyData),
    3,
    500
  );
}

// Validate user from Authorization header (matches index.tsx validateAccessToken)
async function validateUser(c: any) {
  console.log('🔐 ===== BONUS validateUser START =====');
  console.log('📍 Request URL:', c.req.url);
  console.log('📍 Request Method:', c.req.method);
  
  // Get all headers for debugging
  const allHeaders: Record<string, string> = {};
  c.req.raw.headers.forEach((value: string, key: string) => {
    allHeaders[key] = value;
  });
  console.log('📋 All Request Headers:', JSON.stringify(allHeaders, null, 2));
  
  // Try multiple ways to get the token
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
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      authToken = parts[1];
    } else if (parts.length === 1) {
      authToken = parts[0];
    }
  }
  
  const accessToken = customToken || authToken;
  
  console.log('🔑 Custom Token (X-Access-Token):', customToken ? `${customToken.substring(0, 20)}...` : 'MISSING');
  console.log('🔑 Auth Header:', authHeader ? `${authHeader.substring(0, 30)}...` : 'MISSING');
  console.log('🔑 Extracted Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
  
  if (!accessToken) {
    console.log('❌ No access token found');
    console.log('🔐 ===== BONUS validateUser END (NO TOKEN) =====\n');
    return null;
  }

  // First, try to validate with custom access token in KV
  console.log('🔍 Checking KV store for custom token...');
  console.log('🔑 KV key will be:', `access_token:${accessToken}`);
  
  const customTokenData = await kv.get(`access_token:${accessToken}`);
  
  if (!customTokenData) {
    console.log('⚠️ Token not found in KV store');
    
    // Debug: Query database directly to list sample access tokens
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      
      const { data: allTokensData, error: queryError } = await supabaseClient
        .from('kv_store_27d0d16c')
        .select('key, value')
        .like('key', 'access_token:%')
        .limit(5);
      
      console.log('📋 Sample access tokens in database:', allTokensData?.length || 0);
      if (queryError) {
        console.error('❌ Error querying tokens:', queryError);
      }
      if (allTokensData && allTokensData.length > 0) {
        allTokensData.forEach((item: any, index: number) => {
          const tokenFromKey = item.key.replace('access_token:', '');
          console.log(`  Token ${index + 1}:`, {
            tokenPreview: tokenFromKey.substring(0, 30) + '...',
            providedTokenPreview: accessToken.substring(0, 30) + '...',
            tokensMatch: tokenFromKey === accessToken ? '✅ MATCH!' : '❌ NO MATCH',
          });
        });
      } else {
        console.log('  No tokens found in database!');
      }
    } catch (err) {
      console.error('Error listing tokens:', err);
    }
  }
  
  if (customTokenData) {
    console.log('✅ Custom token found in KV store:', customTokenData);
    
    // Check expiry
    if (Date.now() > customTokenData.expiresAt) {
      console.log('❌ Custom token expired at:', new Date(customTokenData.expiresAt).toISOString());
      console.log('🔐 ===== BONUS validateUser END (EXPIRED) =====\n');
      return null;
    }
    
    console.log('✅ Custom token valid, userId:', customTokenData.userId);
    console.log('🔐 ===== BONUS validateUser END (SUCCESS) =====\n');
    return { id: customTokenData.userId };
  }

  // Token not found in KV store - this means invalid token
  console.log('❌ Custom token not found in KV store');
  console.log('🔐 ===== BONUS validateUser END (INVALID TOKEN) =====\n');
  return null;
}

// Get today's date as string (for daily reset)
function getTodayString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ==================== ROUTES ====================

// GET /bonus/:phone - Get user bonus data by phone
app.get('/bonus/:phone', async (c) => {
  try {
    const phone = c.req.param('phone');
    console.log('📊 GET /bonus/:phone - Fetching bonus data by phone:', phone);
    
    if (!phone) {
      return c.json({ 
        success: false, 
        error: 'Telefon raqam majburiy' 
      }, 400);
    }

    // Find user by phone
    const phoneData = await kv.get(`user_phone:${phone}`);
    
    if (!phoneData || !phoneData.userId) {
      console.log('⚠️ User not found for phone:', phone);
      // Return default empty bonus data instead of error
      return c.json({
        success: true,
        bonus: {
          balance: 0,
          totalEarned: 0,
          dailyTaps: 0,
          bonusTaps: 0,
          points: 0, // For compatibility
        },
      });
    }

    console.log('✅ User found:', phoneData.userId);
    const bonusData = await getUserBonusData(phoneData.userId);
    
    // Add points field for compatibility
    const responseData = {
      ...bonusData,
      points: bonusData.balance, // Map balance to points for compatibility
    };
    
    console.log('✅ Bonus data retrieved:', responseData);
    
    return c.json({
      success: true,
      bonus: responseData,
    });
  } catch (error) {
    console.error('❌ Error fetching bonus by phone:', error);
    return c.json({
      success: false,
      error: `Bonus ma'lumotlarini yuklashda xatolik: ${error.message}`,
    }, 500);
  }
});

// GET /bonus - Get user bonus data
app.get('/bonus', async (c) => {
  try {
    console.log('📊 GET /bonus - Fetching user bonus data');
    console.log('📋 Request headers:', c.req.header());
    
    const user = await validateUser(c);
    if (!user) {
      console.log('❌ User validation failed');
      return c.json({ 
        success: false, 
        error: 'Unauthorized - Tizimga kiring' 
      }, 401);
    }

    console.log('✅ User validated:', user.id);
    const bonusData = await getUserBonusData(user.id);
    
    console.log('✅ Bonus data retrieved:', bonusData);
    
    return c.json({
      success: true,
      bonus: bonusData,
    });
  } catch (error) {
    console.error('❌ Error fetching bonus:', error);
    return c.json({
      success: false,
      error: `Bonus ma'lumotlarini yuklashda xatolik: ${error.message}`,
    }, 500);
  }
});

// POST /bonus/tap - Handle tap action
app.post('/bonus/tap', async (c) => {
  try {
    console.log('👆 POST /bonus/tap - Processing tap');
    
    const user = await validateUser(c);
    if (!user) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized - Tizimga kiring' 
      }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const tapCount = Math.max(1, Math.min(200, Number(body?.count || 1)));
    const bonusData = await getUserBonusData(user.id);
    
    const DAILY_LIMIT = 1000;
    const TAP_VALUE = 1;
    
    // Check if user has available taps
    const availableTaps = DAILY_LIMIT - bonusData.dailyTaps + bonusData.bonusTaps;

    if (availableTaps <= 0) {
      return c.json({
        success: false,
        error: 'Kunlik limit tugadi! Ertaga qayta urinib ko\'ring yoki Market\'dan xarid qiling.',
      }, 400);
    }

    const applyCount = Math.min(tapCount, availableTaps);
    
    // Process taps (batched)
    const newBalance = bonusData.balance + (TAP_VALUE * applyCount);
    const newTotalEarned = bonusData.totalEarned + (TAP_VALUE * applyCount);
    let newDailyTaps = bonusData.dailyTaps;
    let newBonusTaps = bonusData.bonusTaps;

    // Use bonus taps first, then daily taps
    const bonusConsumed = Math.min(newBonusTaps, applyCount);
    newBonusTaps = newBonusTaps - bonusConsumed;
    const dailyConsumed = applyCount - bonusConsumed;
    newDailyTaps = newDailyTaps + dailyConsumed;
    
    // Update bonus data
    const updatedData = {
      ...bonusData,
      balance: newBalance,
      totalEarned: newTotalEarned,
      dailyTaps: newDailyTaps,
      bonusTaps: newBonusTaps,
      updatedAt: new Date().toISOString(),
    };
    
    const key = `bonus:${user.id}`;
    await retryOperation(
      async () => await kv.set(key, updatedData),
      3,
      500
    );
    
    // Save tap history
    await saveTapHistory(user.id, TAP_VALUE * applyCount, newBalance);
    
    console.log('✅ Tap processed successfully:', {
      balance: newBalance,
      dailyTaps: newDailyTaps,
      bonusTaps: newBonusTaps,
    });
    
    return c.json({
      success: true,
      bonus: updatedData,
      appliedCount: applyCount,
      message: `+${TAP_VALUE * applyCount} so'm qo'shildi!`,
    });
  } catch (error) {
    console.error('❌ Error processing tap:', error);
    return c.json({
      success: false,
      error: `Tap qilishda xatolik: ${error.message}`,
    }, 500);
  }
});

// POST /bonus/add-bonus-taps - Admin: Add bonus taps to user
app.post('/bonus/add-bonus-taps', async (c) => {
  try {
    console.log('🎁 POST /bonus/add-bonus-taps - Adding bonus taps');
    
    const body = await c.req.json();
    const { userId, amount, reason } = body;
    
    if (!userId || !amount) {
      return c.json({
        success: false,
        error: 'userId va amount majburiy',
      }, 400);
    }
    
    const bonusData = await getUserBonusData(userId);
    
    // Add bonus taps
    const updatedData = {
      ...bonusData,
      bonusTaps: bonusData.bonusTaps + amount,
      updatedAt: new Date().toISOString(),
    };
    
    const key = `bonus:${userId}`;
    await retryOperation(
      async () => await kv.set(key, updatedData),
      3,
      500
    );
    
    // Save history
    const historyKey = `bonus_history:${userId}:${Date.now()}`;
    const historyData = {
      userId,
      type: 'bonus_taps_added',
      amount,
      reason: reason || 'Admin tomonidan qo\'shildi',
      balanceAfter: bonusData.balance,
      bonusTapsAfter: updatedData.bonusTaps,
      timestamp: new Date().toISOString(),
    };
    await retryOperation(
      async () => await kv.set(historyKey, historyData),
      3,
      500
    );
    
    console.log('✅ Bonus taps added:', {
      userId,
      amount,
      newBonusTaps: updatedData.bonusTaps,
    });
    
    return c.json({
      success: true,
      bonus: updatedData,
      message: `${amount} bonus tap qo'shildi!`,
    });
  } catch (error) {
    console.error('❌ Error adding bonus taps:', error);
    return c.json({
      success: false,
      error: `Bonus tap qo'shishda xatolik: ${error.message}`,
    }, 500);
  }
});

// POST /bonus/use - Use bonus balance (for purchases)
app.post('/bonus/use', async (c) => {
  try {
    console.log('💰 POST /bonus/use - Using bonus balance');
    
    const user = await validateUser(c);
    if (!user) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized - Tizimga kiring' 
      }, 401);
    }

    const body = await c.req.json();
    const { amount, orderId, description } = body;
    
    if (!amount || amount <= 0) {
      return c.json({
        success: false,
        error: 'Noto\'g\'ri summa',
      }, 400);
    }
    
    const bonusData = await getUserBonusData(user.id);
    
    // Check if user has enough balance
    if (bonusData.balance < amount) {
      return c.json({
        success: false,
        error: `Yetarli bonus yo'q. Sizda: ${bonusData.balance} so'm`,
      }, 400);
    }
    
    // Deduct bonus balance
    const newBalance = bonusData.balance - amount;
    
    const updatedData = {
      ...bonusData,
      balance: newBalance,
      updatedAt: new Date().toISOString(),
    };
    
    const key = `bonus:${user.id}`;
    await retryOperation(
      async () => await kv.set(key, updatedData),
      3,
      500
    );
    
    // Save usage history
    const historyKey = `bonus_history:${user.id}:${Date.now()}`;
    const historyData = {
      userId: user.id,
      type: 'used',
      amount: -amount,
      orderId: orderId || null,
      description: description || 'Xaridda ishlatildi',
      balanceAfter: newBalance,
      timestamp: new Date().toISOString(),
    };
    await retryOperation(
      async () => await kv.set(historyKey, historyData),
      3,
      500
    );
    
    console.log('✅ Bonus used successfully:', {
      userId: user.id,
      amount,
      newBalance,
    });
    
    return c.json({
      success: true,
      bonus: updatedData,
      message: `${amount} so'm bonus ishlatildi!`,
    });
  } catch (error) {
    console.error('❌ Error using bonus:', error);
    return c.json({
      success: false,
      error: `Bonusni ishlatishda xatolik: ${error.message}`,
    }, 500);
  }
});

// GET /bonus/history - Get bonus history
app.get('/bonus/history', async (c) => {
  try {
    console.log('📜 GET /bonus/history - Fetching bonus history');
    
    const user = await validateUser(c);
    if (!user) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized - Tizimga kiring' 
      }, 401);
    }

    const prefix = `bonus_history:${user.id}`;
    const historyEntries = await kv.getByPrefix(prefix);
    
    // KV store returns parsed JSONB, sort by timestamp (newest first)
    const history = historyEntries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    console.log('✅ History retrieved:', history.length, 'entries');
    
    return c.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('❌ Error fetching history:', error);
    return c.json({
      success: false,
      error: `Tarixni yuklashda xatolik: ${error.message}`,
    }, 500);
  }
});

// GET /bonus/leaderboard - Get top bonus earners
app.get('/bonus/leaderboard', async (c) => {
  try {
    console.log('🏆 GET /bonus/leaderboard - Fetching leaderboard');
    
    const prefix = 'bonus:';
    const allBonusData = await kv.getByPrefix(prefix);
    
    // KV store returns parsed JSONB, sort by totalEarned
    const leaderboard = allBonusData
      .sort((a, b) => b.totalEarned - a.totalEarned)
      .slice(0, 100); // Top 100
    
    console.log('✅ Leaderboard retrieved:', leaderboard.length, 'users');
    
    return c.json({
      success: true,
      leaderboard,
    });
  } catch (error) {
    console.error('❌ Error fetching leaderboard:', error);
    return c.json({
      success: false,
      error: `Reyting jadvalini yuklashda xatolik: ${error.message}`,
    }, 500);
  }
});

// POST /bonus/reward-purchase - Reward user with bonus taps after purchase
app.post('/bonus/reward-purchase', async (c) => {
  try {
    console.log('🎁 POST /bonus/reward-purchase - Rewarding purchase');
    
    const body = await c.req.json();
    const { userId, orderTotal, orderId } = body;
    
    if (!userId || !orderTotal) {
      return c.json({
        success: false,
        error: 'userId va orderTotal majburiy',
      }, 400);
    }
    
    // Calculate bonus taps based on order total
    // For every 10,000 so'm spent, give 10 bonus taps
    const bonusTapsToAdd = Math.floor(orderTotal / 10000) * 10;
    
    if (bonusTapsToAdd <= 0) {
      return c.json({
        success: true,
        message: 'Bonus tap uchun minimal summa: 10,000 so\'m',
        bonusTapsAdded: 0,
      });
    }
    
    const bonusData = await getUserBonusData(userId);
    
    // Add bonus taps
    const updatedData = {
      ...bonusData,
      bonusTaps: bonusData.bonusTaps + bonusTapsToAdd,
      updatedAt: new Date().toISOString(),
    };
    
    const key = `bonus:${userId}`;
    await retryOperation(
      async () => await kv.set(key, updatedData),
      3,
      500
    );
    
    // Save history
    const historyKey = `bonus_history:${userId}:${Date.now()}`;
    const historyData = {
      userId,
      type: 'purchase_reward',
      amount: bonusTapsToAdd,
      orderId: orderId || null,
      orderTotal,
      reason: `Xarid uchun mukofot: ${orderTotal.toLocaleString()} so'm`,
      balanceAfter: bonusData.balance,
      bonusTapsAfter: updatedData.bonusTaps,
      timestamp: new Date().toISOString(),
    };
    await retryOperation(
      async () => await kv.set(historyKey, historyData),
      3,
      500
    );
    
    console.log('✅ Purchase rewarded:', {
      userId,
      orderTotal,
      bonusTapsAdded: bonusTapsToAdd,
    });
    
    return c.json({
      success: true,
      bonus: updatedData,
      bonusTapsAdded: bonusTapsToAdd,
      message: `🎉 Xarid uchun ${bonusTapsToAdd} bonus tap olindiz!`,
    });
  } catch (error) {
    console.error('❌ Error rewarding purchase:', error);
    return c.json({
      success: false,
      error: `Mukofot berishda xatolik: ${error.message}`,
    }, 500);
  }
});

export default app;