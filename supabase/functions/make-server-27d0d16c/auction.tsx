import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as r2 from "./r2-storage.tsx";

const app = new Hono();

// Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

console.log('🎯 Auction routes initialized');

// ==================== HELPER FUNCTIONS ====================

// Generate unique auction ID
function generateAuctionId() {
  return `AUC_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Generate unique bid ID
function generateBidId() {
  return `BID_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Generate unique request ID
function generateRequestId() {
  return `REQ_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Calculate next minimum bid
function calculateNextMinimumBid(currentBid: number, bidIncrementPercent: number) {
  return Math.ceil(currentBid * (1 + bidIncrementPercent / 100));
}

function participationFeeOrderId(auctionId: string, userId: string) {
  return `AUC_FEE__${auctionId}__${userId}`;
}

function parseKvRecord(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function requireSupabaseUser(c: any) {
  const authHeader =
    c.req.header("Authorization") || c.req.raw.headers.get("Authorization") || "";
  const m = authHeader.match(/Bearer\s+(.+)/i);
  const token = m?.[1]?.trim();
  if (!token) {
    return { error: c.json({ success: false, error: "Avtorizatsiya kerak (Bearer token)" }, 401) };
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: c.json({ success: false, error: "Sessiya yaroqsiz yoki muddati tugagan" }, 401) };
  }
  return { user };
}

function displayNameFromUser(user: { user_metadata?: Record<string, unknown>; phone?: string; email?: string }) {
  const meta = user.user_metadata || {};
  const n =
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.first_name === "string" && `${meta.first_name} ${typeof meta.last_name === "string" ? meta.last_name : ""}`.trim()) ||
    user.phone ||
    user.email ||
    "Foydalanuvchi";
  return String(n).trim() || "Foydalanuvchi";
}

function phoneFromUser(user: { user_metadata?: Record<string, unknown>; phone?: string }) {
  const meta = user.user_metadata || {};
  const p =
    (typeof meta.phone === "string" && meta.phone) ||
    user.phone ||
    "";
  return String(p).trim();
}

/** Muddat tugagan faol auksionni yakunlaydi: g‘olib eng yuqori taklif (yoki taklifsiz). */
async function finalizeAndSaveAuction(auction: any): Promise<any> {
  if (!auction?.id || auction.status !== "active") return auction;
  const endMs = new Date(auction.endDate).getTime();
  if (Number.isNaN(endMs) || endMs > Date.now()) return auction;

  const bids = await kv.getByPrefix(`auction_bid:${auction.id}:`);
  const validBids = (bids || []).filter((b: any) => b && typeof b === "object" && Number.isFinite(Number(b.amount)));
  validBids.sort((a: any, b: any) => Number(b.amount) - Number(a.amount));
  const winner = validBids[0];

  const updated = {
    ...auction,
    status: "ended",
    endedAt: new Date().toISOString(),
    winnerUserId: winner?.userId ?? null,
    winningBidAmount: winner ? Number(winner.amount) : Number(auction.currentPrice) || 0,
    winningBidId: winner?.id ?? null,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`auction:${auction.id}`, updated);
  return updated;
}

async function verifyParticipationPayment(
  paymentId: string | undefined,
  userId: string,
  auctionId: string,
  expectedFee: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fee = Number(expectedFee) || 0;
  if (fee <= 0) return { ok: true };
  // payments/create minimal 1000 so'm — kichikroq haqni JWT bilan tasdiqlash yetarli
  if (fee > 0 && fee < 1000) return { ok: true };

  const pid = String(paymentId || "").trim();
  if (!pid) {
    return { ok: false, error: "Ishtirok to‘lovi uchun avval to‘lov yarating va yakunlang" };
  }

  const raw = await kv.get(`payment:${pid}`);
  const pay = parseKvRecord(raw);
  if (!pay) return { ok: false, error: "To‘lov topilmadi" };

  if (String(pay.status) !== "paid") {
    return { ok: false, error: "To‘lov hali yakunlanmagan — statusni tekshiring" };
  }

  const expectedOrder = participationFeeOrderId(auctionId, userId);
  if (String(pay.orderId || "") !== expectedOrder) {
    return { ok: false, error: "To‘lov boshqa auksion yoki akkaunt uchun" };
  }

  const amt = Number(pay.amount);
  if (!Number.isFinite(amt) || amt < fee) {
    return { ok: false, error: "To‘lov summasi ishtirok haqqiga mos emas" };
  }

  const paidUid = String(pay.userId || "").trim();
  if (paidUid && paidUid !== userId) {
    return { ok: false, error: "To‘lov boshqa foydalanuvchiga tegishli" };
  }

  return { ok: true };
}

async function deleteAuctionCascade(auctionId: string) {
  const bidRows = await kv.getByPrefixWithKeys(`auction_bid:${auctionId}:`);
  const partRows = await kv.getByPrefixWithKeys(`auction_participant:${auctionId}:`);
  const keys = [...bidRows, ...partRows].map((r) => r.key).filter(Boolean);
  if (keys.length) await kv.mdel(keys);
  await kv.del(`auction:${auctionId}`);
}

// ==================== AUCTION ROUTES ====================

// DEBUG: Direct KV check
app.get("/debug/auctions", async (c) => {
  try {
    console.log('🔍 DEBUG: Checking KV store directly');
    
    const branchId = c.req.query('branchId');
    
    // Try to get ALL keys with auction prefix using raw SQL query
    const { data, error } = await supabase
      .from('kv_store_27d0d16c')
      .select('key, value')
      .like('key', 'auction:%');
    
    console.log('📊 Raw SQL result:', { 
      count: data?.length || 0, 
      error,
      keys: data?.map(d => d.key)
    });
    
    // Also try getByPrefix
    const kvResult = await kv.getByPrefix('auction:');
    console.log('📦 KV getByPrefix result:', {
      count: kvResult?.length || 0,
      firstItem: kvResult?.[0]
    });
    
    return c.json({
      success: true,
      rawSQL: {
        count: data?.length || 0,
        items: data || [],
      },
      kvStore: {
        count: kvResult?.length || 0,
        items: kvResult || [],
      }
    });
  } catch (error) {
    console.error('❌ Debug error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get all auctions (with filters)
app.get("/auctions", async (c) => {
  try {
    console.log('📦 Fetching all auctions');
    
    const status = c.req.query('status'); // 'active', 'ended', 'all'
    const branchId = c.req.query('branchId');
    const category = c.req.query('category');

    console.log('🔍 Query params:', { status, branchId, category });

    // Get all auctions from KV store
    // NOTE: getByPrefix returns array of VALUES only, not {key, value} objects
    const auctionValues = await kv.getByPrefix('auction:');
    console.log(`✅ Found ${auctionValues.length} auctions from KV`);
    
    // Debug: log first few auctions
    if (auctionValues.length > 0) {
      console.log('📋 Sample auctions:', auctionValues.slice(0, 2).map(a => ({ id: a?.id, status: a?.status, branchId: a?.branchId })));
    }

    // Filter out invalid/undefined entries
    let auctions = auctionValues
      .filter((a: any) => a && typeof a === 'object' && a.id); // Ensure valid auction objects

    console.log(`✅ Filtered to ${auctions.length} valid auctions`);

    // Filter by branch
    if (branchId) {
      const beforeFilter = auctions.length;
      auctions = auctions.filter((a: any) => a && a.branchId === branchId);
      console.log(`✅ Filtered by branchId '${branchId}': ${beforeFilter} -> ${auctions.length} auctions`);
    }

    // Filter by category
    if (category) {
      auctions = auctions.filter((a: any) => a && a.category === category);
      console.log(`✅ Filtered by category: ${auctions.length} auctions`);
    }

    const nowMs = Date.now();
    for (let i = 0; i < auctions.length; i++) {
      const a = auctions[i];
      if (
        a?.status === "active" &&
        a?.endDate &&
        new Date(a.endDate).getTime() <= nowMs
      ) {
        auctions[i] = await finalizeAndSaveAuction(a);
      }
    }

    // Filter by status
    const now = new Date();
    if (status === 'active') {
      const beforeFilter = auctions.length;
      auctions = auctions.filter((a: any) => {
        if (!a || !a.endDate) {
          console.log('⚠️ Auction missing endDate:', a?.id);
          return false;
        }
        const endDate = new Date(a.endDate);
        const isActive = endDate > now && a.status === 'active';
        if (!isActive) {
          console.log(`⚠️ Auction ${a.id} filtered out: endDate=${endDate}, now=${now}, status=${a.status}`);
        }
        return isActive;
      });
      console.log(`✅ Filtered by status 'active': ${beforeFilter} -> ${auctions.length} auctions`);
    } else if (status === 'ended') {
      auctions = auctions.filter((a: any) => {
        if (!a || !a.endDate) return false;
        const endDate = new Date(a.endDate);
        return endDate <= now || a.status === 'ended';
      });
      console.log(`✅ Filtered by status 'ended': ${auctions.length} auctions`);
    }

    // Sort by creation date (newest first)
    auctions.sort((a: any, b: any) => {
      const aTime = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    console.log(`📤 Returning ${auctions.length} auctions`);
    return c.json({ success: true, auctions });
  } catch (error) {
    console.error('❌ Error fetching auctions:', error);
    return c.json({ 
      success: false, 
      error: 'Auksionlarni yuklashda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// Get single auction by ID
app.get("/auctions/:id", async (c) => {
  try {
    const auctionId = c.req.param('id');
    console.log('📦 Fetching auction:', auctionId);

    let auction = await kv.get(`auction:${auctionId}`);
    
    if (!auction) {
      return c.json({ 
        success: false, 
        error: 'Auksion topilmadi' 
      }, 404);
    }

    auction = await finalizeAndSaveAuction(auction);

    // Get bids for this auction
    const bids = await kv.getByPrefix(`auction_bid:${auctionId}:`);
    
    // Sort bids by amount (highest first)
    const validBids = bids.filter((b: any) => b && typeof b === 'object');
    validBids.sort((a: any, b: any) => b.amount - a.amount);

    return c.json({ 
      success: true, 
      auction,
      bids: validBids,
      totalBids: validBids.length,
      highestBid: validBids[0] || null
    });
  } catch (error) {
    console.error('❌ Error fetching auction:', error);
    return c.json({ 
      success: false, 
      error: 'Auksionni yuklashda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// Create new auction
app.post("/auctions", async (c) => {
  try {
    console.log('🎯 Creating new auction');
    
    const formData = await c.req.formData();
    
    const auctionId = generateAuctionId();
    const branchId = formData.get('branchId') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const region = formData.get('region') as string;
    const district = formData.get('district') as string;
    const startPrice = parseFloat(formData.get('startPrice') as string);
    const maxPrice = parseFloat(formData.get('maxPrice') as string);
    const participationFee = parseFloat(formData.get('participationFee') as string);
    const bidIncrementPercent = parseFloat(formData.get('bidIncrementPercent') as string);
    const durationDays = parseInt(formData.get('durationDays') as string);

    // Validate required fields
    if (!branchId || !name || !description || !category || !region || !district) {
      return c.json({ 
        success: false, 
        error: 'Barcha maydonlarni to\'ldiring' 
      }, 400);
    }

    if (!startPrice || !maxPrice || !participationFee || !bidIncrementPercent || !durationDays) {
      return c.json({ 
        success: false, 
        error: 'Barcha narx va muddat maydonlarni to\'ldiring' 
      }, 400);
    }

    if (startPrice <= 0 || maxPrice <= startPrice) {
      return c.json({ 
        success: false, 
        error: 'Narxlar noto\'g\'ri kiritilgan' 
      }, 400);
    }

    // Upload images to R2
    const images: string[] = [];
    const imageFiles = formData.getAll('images');
    
    console.log(`📸 Uploading ${imageFiles.length} images to R2`);
    
    for (const imageFile of imageFiles) {
      if (imageFile instanceof File && imageFile.size > 0) {
        try {
          console.log(`📷 Processing image: ${imageFile.name}, size: ${imageFile.size}, type: ${imageFile.type}`);
          
          // Convert File to ArrayBuffer then to Uint8Array
          const arrayBuffer = await imageFile.arrayBuffer();
          const fileContent = new Uint8Array(arrayBuffer);
          
          // Generate unique filename
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 15);
          const extension = imageFile.name.split('.').pop() || 'jpg';
          const uniqueFileName = `auctions/${auctionId}/${timestamp}-${random}.${extension}`;
          
          console.log(`📤 Uploading to R2: ${uniqueFileName}`);
          
          // Upload to R2 with correct parameter order: (fileContent, fileName, contentType)
          const uploadResult = await r2.uploadFile(
            fileContent,
            uniqueFileName,
            imageFile.type || 'image/jpeg'
          );
          
          if (uploadResult.success && uploadResult.url) {
            images.push(uploadResult.url);
            console.log('✅ Image uploaded successfully:', uploadResult.url);
          } else {
            console.error('❌ Upload failed:', uploadResult.error);
          }
        } catch (uploadError) {
          console.error('❌ Error uploading image:', uploadError);
        }
      }
    }

    console.log(`📦 Total images uploaded: ${images.length}`);

    if (images.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Kamida bitta rasm yuklang' 
      }, 400);
    }

    // Calculate end date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    // Create auction object
    const auction = {
      id: auctionId,
      branchId,
      name,
      description,
      category,
      region,
      district,
      images,
      startPrice,
      maxPrice,
      currentPrice: startPrice,
      participationFee,
      bidIncrementPercent,
      durationDays,
      endDate: endDate.toISOString(),
      status: 'active',
      totalBids: 0,
      totalParticipants: 0,
      participants: [] as string[], // Array of user IDs
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to KV store
    await kv.set(`auction:${auctionId}`, auction);
    console.log('✅ Auction created and saved to KV:', auctionId);

    // Verify it was saved
    const verifyAuction = await kv.get(`auction:${auctionId}`);
    if (verifyAuction) {
      console.log('✅ Verification passed: auction found in KV immediately after save');
    } else {
      console.error('❌ WARNING: Auction NOT found in KV after save!');
    }

    return c.json({ 
      success: true, 
      auction,
      message: 'Auksion muvaffaqiyatli yaratildi'
    });
  } catch (error) {
    console.error('❌ Error creating auction:', error);
    return c.json({ 
      success: false, 
      error: 'Auksion yaratishda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// Update auction
app.put("/auctions/:id", async (c) => {
  try {
    const auctionId = c.req.param('id');
    console.log('🔄 Updating auction:', auctionId);

    const auction = await kv.get(`auction:${auctionId}`);
    
    if (!auction) {
      return c.json({ 
        success: false, 
        error: 'Auksion topilmadi' 
      }, 404);
    }

    const updates = await c.req.json();
    
    // Update allowed fields
    const updatedAuction = {
      ...auction,
      ...updates,
      id: auctionId, // Prevent ID change
      updatedAt: new Date().toISOString(),
    };

    await purgeAuctionR2ImageDiff(auction, updatedAuction);
    await kv.set(`auction:${auctionId}`, updatedAuction);
    console.log('✅ Auction updated:', auctionId);

    return c.json({ 
      success: true, 
      auction: updatedAuction,
      message: 'Auksion yangilandi'
    });
  } catch (error) {
    console.error('❌ Error updating auction:', error);
    return c.json({ 
      success: false, 
      error: 'Auksionni yangilashda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// Delete auction
app.delete("/auctions/:id", async (c) => {
  try {
    const auctionId = c.req.param('id');
    console.log('🗑️ Deleting auction:', auctionId);

    const auction = await kv.get(`auction:${auctionId}`);
    
    if (!auction) {
      return c.json({ 
        success: false, 
        error: 'Auksion topilmadi' 
      }, 404);
    }

    await purgeAllAuctionR2Images(auction as { images?: unknown });

    await deleteAuctionCascade(auctionId);
    console.log('✅ Auction deleted (taklif va ishtirokchilar ham tozalandi):', auctionId);

    return c.json({ 
      success: true,
      message: 'Auksion o\'chirildi'
    });
  } catch (error) {
    console.error('❌ Error deleting auction:', error);
    return c.json({ 
      success: false, 
      error: 'Auksionni o\'chirishda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// ==================== BID ROUTES ====================

// Place a bid
app.post("/auctions/:id/bid", async (c) => {
  try {
    const auctionId = c.req.param('id');
    console.log('💰 Placing bid on auction:', auctionId);

    const auth = await requireSupabaseUser(c);
    if ("error" in auth) return auth.error;

    const body = await c.req.json().catch(() => ({}));
    const amountNum = Number(body?.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return c.json({ success: false, error: "Taklif summasi noto‘g‘ri" }, 400);
    }

    if (body?.userId && String(body.userId) !== auth.user.id) {
      return c.json({ success: false, error: "JWT va tanlangan foydalanuvchi mos emas" }, 403);
    }

    const userId = auth.user.id;
    const userName = displayNameFromUser(auth.user);
    const userPhone = phoneFromUser(auth.user) || String(body?.userPhone || "").trim();

    let auction = await kv.get(`auction:${auctionId}`);
    if (!auction) {
      return c.json({ success: false, error: "Auksion topilmadi" }, 404);
    }

    auction = await finalizeAndSaveAuction(auction);
    if (auction.status !== "active") {
      return c.json({ success: false, error: "Auksion yakunlangan" }, 400);
    }

    const endDate = new Date(auction.endDate);
    if (endDate.getTime() <= Date.now()) {
      return c.json({ success: false, error: "Auksion yakunlangan" }, 400);
    }

    if (amountNum > Number(auction.maxPrice)) {
      return c.json({
        success: false,
        error: `Maksimal narx: ${Number(auction.maxPrice).toLocaleString()} so'm`,
      }, 400);
    }

    const participantKey = `auction_participant:${auctionId}:${userId}`;
    const participant = await kv.get(participantKey);
    if (!participant) {
      return c.json({
        success: false,
        error: "Ishtirok etish uchun avval ro‘yxatdan o‘ting (ishtirok to‘lovi)",
        participationFee: auction.participationFee,
      }, 400);
    }

    let minimumBid = calculateNextMinimumBid(
      Number(auction.currentPrice),
      Number(auction.bidIncrementPercent),
    );
    if (amountNum < minimumBid) {
      return c.json({
        success: false,
        error: `Minimal taklif: ${minimumBid.toLocaleString()} so'm`,
        minimumBid,
      }, 400);
    }

    const freshRaw = await kv.get(`auction:${auctionId}`);
    if (!freshRaw) {
      return c.json({ success: false, error: "Auksion topilmadi" }, 404);
    }
    const fresh2 = await finalizeAndSaveAuction(freshRaw);
    if (!fresh2 || fresh2.status !== "active") {
      return c.json({ success: false, error: "Auksion yakunlangan" }, 400);
    }

    minimumBid = calculateNextMinimumBid(
      Number(fresh2.currentPrice),
      Number(fresh2.bidIncrementPercent),
    );
    if (amountNum < minimumBid) {
      return c.json(
        {
          success: false,
          error: `Boshqa ishtirokchi yuqori taklif berdi. Minimal taklif: ${minimumBid.toLocaleString()} so'm`,
          minimumBid,
          code: "BID_OUTDATED",
        },
        409,
      );
    }

    const bidId = generateBidId();
    const bid = {
      id: bidId,
      auctionId,
      userId,
      userName,
      userPhone: userPhone || "",
      amount: amountNum,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`auction_bid:${auctionId}:${bidId}`, bid);

    let updatedAuction: any = {
      ...fresh2,
      currentPrice: amountNum,
      totalBids: (fresh2.totalBids || 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    const maxP = Number(fresh2.maxPrice);
    if (Number.isFinite(maxP) && amountNum >= maxP) {
      updatedAuction = {
        ...updatedAuction,
        status: "ended",
        endedAt: new Date().toISOString(),
        winnerUserId: userId,
        winningBidAmount: amountNum,
        winningBidId: bidId,
      };
    }

    await kv.set(`auction:${auctionId}`, updatedAuction);
    console.log("✅ Bid placed:", bidId);

    return c.json({
      success: true,
      bid,
      auction: updatedAuction,
      message: "Taklifingiz qabul qilindi",
    });
  } catch (error) {
    console.error("❌ Error placing bid:", error);
    return c.json({
      success: false,
      error: "Taklif berishda xatolik yuz berdi",
      details: error.message,
    }, 500);
  }
});

// Pay participation fee
app.post("/auctions/:id/participate", async (c) => {
  try {
    const auctionId = c.req.param('id');
    console.log('💳 Participation for auction:', auctionId);

    const auth = await requireSupabaseUser(c);
    if ("error" in auth) return auth.error;

    const body = await c.req.json().catch(() => ({}));
    if (body?.userId && String(body.userId) !== auth.user.id) {
      return c.json({ success: false, error: "JWT va foydalanuvchi mos emas" }, 403);
    }

    const userId = auth.user.id;
    const userName = displayNameFromUser(auth.user);
    const userPhone = phoneFromUser(auth.user) || String(body?.userPhone || "").trim();
    const paymentMethod = String(body?.paymentMethod || "app_payment");

    let auction = await kv.get(`auction:${auctionId}`);
    if (!auction) {
      return c.json({ success: false, error: "Auksion topilmadi" }, 404);
    }

    auction = await finalizeAndSaveAuction(auction);
    if (auction.status !== "active") {
      return c.json({ success: false, error: "Auksion yakunlangan" }, 400);
    }

    const participantKey = `auction_participant:${auctionId}:${userId}`;
    const existingParticipant = await kv.get(participantKey);
    if (existingParticipant) {
      return c.json({ success: false, error: "Siz allaqachon ishtirok etyapsiz" }, 400);
    }

    const payCheck = await verifyParticipationPayment(
      body?.paymentId,
      userId,
      auctionId,
      Number(auction.participationFee) || 0,
    );
    if (!payCheck.ok) {
      return c.json(
        {
          success: false,
          error: payCheck.error,
          participationFee: auction.participationFee,
          expectedOrderId: participationFeeOrderId(auctionId, userId),
        },
        402,
      );
    }

    const participant = {
      auctionId,
      userId,
      userName,
      userPhone,
      paymentMethod,
      participationFee: auction.participationFee,
      paymentId: body?.paymentId ? String(body.paymentId) : null,
      paidAt: new Date().toISOString(),
    };

    await kv.set(participantKey, participant);

    const participants = [...(auction.participants || [])];
    if (!participants.includes(userId)) participants.push(userId);

    const updatedAuction = {
      ...auction,
      participants,
      totalParticipants: participants.length,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`auction:${auctionId}`, updatedAuction);
    console.log("✅ Participation recorded:", userId);

    return c.json({
      success: true,
      participant,
      auction: updatedAuction,
      message: "Ishtirok qayd etildi",
    });
  } catch (error) {
    console.error("❌ Error processing participation:", error);
    return c.json({
      success: false,
      error: "Ishtirokni qayd etishda xatolik",
      details: error.message,
    }, 500);
  }
});

// Get auction participants
app.get("/auctions/:id/participants", async (c) => {
  try {
    const auctionId = c.req.param('id');
    console.log('👥 Fetching participants for auction:', auctionId);

    const participants = await kv.getByPrefix(`auction_participant:${auctionId}:`);

    return c.json({ 
      success: true, 
      participants,
      total: participants.length
    });
  } catch (error) {
    console.error('❌ Error fetching participants:', error);
    return c.json({ 
      success: false, 
      error: 'Ishtirokchilarni yuklashda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// Get bids for auction
app.get("/auctions/:id/bids", async (c) => {
  try {
    const auctionId = c.req.param('id');
    console.log('💰 Fetching bids for auction:', auctionId);

    const bids = await kv.getByPrefix(`auction_bid:${auctionId}:`);

    // Sort by amount (highest first)
    const validBids = bids.filter((b: any) => b && typeof b === 'object');
    validBids.sort((a: any, b: any) => (b.amount || 0) - (a.amount || 0));

    return c.json({ 
      success: true, 
      bids: validBids,
      total: validBids.length,
      highestBid: validBids[0] || null
    });
  } catch (error) {
    console.error('❌ Error fetching bids:', error);
    return c.json({ 
      success: false, 
      error: 'Takliflarni yuklashda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// ==================== AUCTION REQUEST ROUTES ====================

// Submit auction request (from user)
app.post("/auction-requests", async (c) => {
  try {
    console.log('📝 Creating auction request');

    const auth = await requireSupabaseUser(c);
    if ("error" in auth) return auth.error;

    const { productName, productDescription, images, category, estimatedPrice } = await c.req.json();

    if (!productName || !category) {
      return c.json({ 
        success: false, 
        error: 'Barcha maydonlarni to\'ldiring' 
      }, 400);
    }

    const userId = auth.user.id;
    const userName = displayNameFromUser(auth.user);
    const userPhone = phoneFromUser(auth.user);

    const requestId = generateRequestId();
    
    const request = {
      id: requestId,
      userId,
      userName,
      userPhone: userPhone || '',
      productName,
      productDescription: productDescription || '',
      images: images || [],
      category,
      estimatedPrice: estimatedPrice || 0,
      status: 'pending', // pending, approved, rejected
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`auction_request:${requestId}`, request);
    console.log('✅ Auction request created:', requestId);

    return c.json({ 
      success: true, 
      request,
      message: 'Arizangiz qabul qilindi'
    });
  } catch (error) {
    console.error('❌ Error creating auction request:', error);
    return c.json({ 
      success: false, 
      error: 'Ariza yuborishda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// Get all auction requests
app.get("/auction-requests", async (c) => {
  try {
    console.log('📦 Fetching auction requests');
    
    const status = c.req.query('status');
    const userId = c.req.query('userId');

    let requests = await kv.getByPrefix('auction_request:');

    // Filter by status
    if (status) {
      requests = requests.filter((r: any) => r && r.status === status);
    }

    // Filter by user
    if (userId) {
      requests = requests.filter((r: any) => r && r.userId === userId);
    }

    // Sort by creation date (newest first)
    requests.sort((a: any, b: any) => {
      const aTime = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return c.json({ 
      success: true, 
      requests,
      total: requests.length
    });
  } catch (error) {
    console.error('❌ Error fetching auction requests:', error);
    return c.json({ 
      success: false, 
      error: 'Arizalarni yuklashda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// Update auction request status
app.put("/auction-requests/:id", async (c) => {
  try {
    const requestId = c.req.param('id');
    console.log('🔄 Updating auction request:', requestId);

    const request = await kv.get(`auction_request:${requestId}`);
    
    if (!request) {
      return c.json({ 
        success: false, 
        error: 'Ariza topilmadi' 
      }, 404);
    }

    const { status, adminNote } = await c.req.json();

    const updatedRequest = {
      ...request,
      status: status || request.status,
      adminNote: adminNote || request.adminNote,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`auction_request:${requestId}`, updatedRequest);
    console.log('✅ Auction request updated:', requestId);

    return c.json({ 
      success: true, 
      request: updatedRequest,
      message: 'Ariza yangilandi'
    });
  } catch (error) {
    console.error('❌ Error updating auction request:', error);
    return c.json({ 
      success: false, 
      error: 'Arizani yangilashda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// ==================== STATISTICS & ANALYTICS ====================

// Get auction statistics
app.get("/auctions/stats/summary", async (c) => {
  try {
    const branchId = c.req.query('branchId');
    console.log('📊 Fetching auction statistics for branch:', branchId);

    let auctions = await kv.getByPrefix('auction:');
    console.log(`✅ Found ${auctions.length} auctions from KV`);

    // Filter out invalid/undefined entries
    auctions = auctions.filter((a: any) => a && typeof a === 'object' && a.id);

    console.log(`✅ Filtered to ${auctions.length} valid auctions`);

    // Filter by branch
    if (branchId) {
      auctions = auctions.filter((a: any) => a && a.branchId === branchId);
      console.log(`✅ Filtered by branchId: ${auctions.length} auctions`);
    }

    const now = new Date();
    
    const stats = {
      totalAuctions: auctions.length,
      activeAuctions: auctions.filter((a: any) => {
        if (!a || !a.endDate) return false;
        const endDate = new Date(a.endDate);
        return endDate > now && a.status === 'active';
      }).length,
      endedAuctions: auctions.filter((a: any) => {
        if (!a || !a.endDate) return false;
        const endDate = new Date(a.endDate);
        return endDate <= now || a.status === 'ended';
      }).length,
      totalBids: auctions.reduce((sum: number, a: any) => sum + (a && a.totalBids ? a.totalBids : 0), 0),
      totalParticipants: auctions.reduce((sum: number, a: any) => sum + (a && a.totalParticipants ? a.totalParticipants : 0), 0),
      totalRevenue: auctions.reduce((sum: number, a: any) => sum + ((a && a.totalParticipants ? a.totalParticipants : 0) * (a && a.participationFee ? a.participationFee : 0)), 0),
      totalSales: auctions.filter((a: any) => {
        if (!a || !a.endDate) return false;
        const endDate = new Date(a.endDate);
        return endDate <= now || a.status === 'ended';
      }).reduce((sum: number, a: any) => sum + (a && a.currentPrice ? a.currentPrice : 0), 0),
    };

    console.log('📈 Statistics calculated:', stats);
    return c.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    return c.json({ 
      success: false, 
      error: 'Statistikani yuklashda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// Get user wins
app.get("/auctions/wins/:userId", async (c) => {
  try {
    const auth = await requireSupabaseUser(c);
    if ("error" in auth) return auth.error;

    const userId = c.req.param('userId');
    if (userId !== auth.user.id) {
      return c.json({ success: false, error: 'Faqat o‘z yutuqlaringizni ko‘rishingiz mumkin' }, 403);
    }
    console.log('🏆 Fetching wins for user:', userId);

    const auctionRows = await kv.getByPrefix('auction:');

    const wins = [];

    for (const auction of auctionRows) {
      if (!auction || !auction.id) continue;

      let a = await finalizeAndSaveAuction(auction);
      
      // Only check ended auctions
      const endDate = new Date(a.endDate);
      const now = new Date();
      
      if (endDate > now && a.status !== 'ended') {
        continue;
      }

      // Get highest bid
      const bids = await kv.getByPrefix(`auction_bid:${a.id}:`);
      
      if (bids.length === 0) continue;

      // Sort by amount (highest first)
      const validBids = bids.filter((b: any) => b && typeof b === 'object' && b.amount);
      validBids.sort((a: any, b: any) => b.amount - a.amount);
      
      const highestBid = validBids[0];
      
      if (highestBid && highestBid.userId === userId) {
        wins.push({
          auction: a,
          bid: highestBid,
          wonAt: a.endedAt || a.endDate,
        });
      }
    }

    // Sort by won date (newest first)
    wins.sort((a: any, b: any) => 
      new Date(b.wonAt).getTime() - new Date(a.wonAt).getTime()
    );

    return c.json({ 
      success: true, 
      wins,
      total: wins.length
    });
  } catch (error) {
    console.error('❌ Error fetching wins:', error);
    return c.json({ 
      success: false, 
      error: 'Yutuqlarni yuklashda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

export default app;