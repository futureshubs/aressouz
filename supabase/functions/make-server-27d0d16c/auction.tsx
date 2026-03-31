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

    const auction = await kv.get(`auction:${auctionId}`);
    
    if (!auction) {
      return c.json({ 
        success: false, 
        error: 'Auksion topilmadi' 
      }, 404);
    }

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

    // Delete all bids for this auction
    // Note: We can't directly delete by prefix, so we'll leave bids orphaned
    // They will be filtered out when fetching since auction won't exist
    
    // Delete auction
    await kv.del(`auction:${auctionId}`);
    console.log('✅ Auction deleted:', auctionId);

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

    const { userId, userName, userPhone, amount } = await c.req.json();

    if (!userId || !userName || !amount) {
      return c.json({ 
        success: false, 
        error: 'Barcha maydonlarni to\'ldiring' 
      }, 400);
    }

    // Get auction
    const auction = await kv.get(`auction:${auctionId}`);
    
    if (!auction) {
      return c.json({ 
        success: false, 
        error: 'Auksion topilmadi' 
      }, 404);
    }

    // Check if auction is still active
    const now = new Date();
    const endDate = new Date(auction.endDate);
    
    if (endDate <= now || auction.status !== 'active') {
      return c.json({ 
        success: false, 
        error: 'Auksion yakunlangan' 
      }, 400);
    }

    // Calculate minimum bid
    const minimumBid = calculateNextMinimumBid(auction.currentPrice, auction.bidIncrementPercent);
    
    if (amount < minimumBid) {
      return c.json({ 
        success: false, 
        error: `Minimal taklif: ${minimumBid.toLocaleString()} so'm`,
        minimumBid
      }, 400);
    }

    if (amount > auction.maxPrice) {
      return c.json({ 
        success: false, 
        error: `Maksimal narx: ${auction.maxPrice.toLocaleString()} so'm` 
      }, 400);
    }

    // Check if user has paid participation fee
    const participantKey = `auction_participant:${auctionId}:${userId}`;
    const participant = await kv.get(participantKey);
    
    if (!participant) {
      return c.json({ 
        success: false, 
        error: 'Ishtirok etish uchun to\'lov qiling',
        participationFee: auction.participationFee
      }, 400);
    }

    // Create bid
    const bidId = generateBidId();
    const bid = {
      id: bidId,
      auctionId,
      userId,
      userName,
      userPhone: userPhone || '',
      amount,
      createdAt: new Date().toISOString(),
    };

    // Save bid
    await kv.set(`auction_bid:${auctionId}:${bidId}`, bid);

    // Update auction
    const updatedAuction = {
      ...auction,
      currentPrice: amount,
      totalBids: (auction.totalBids || 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`auction:${auctionId}`, updatedAuction);
    console.log('✅ Bid placed:', bidId);

    return c.json({ 
      success: true, 
      bid,
      auction: updatedAuction,
      message: 'Taklifingiz qabul qilindi'
    });
  } catch (error) {
    console.error('❌ Error placing bid:', error);
    return c.json({ 
      success: false, 
      error: 'Taklif berishda xatolik yuz berdi',
      details: error.message 
    }, 500);
  }
});

// Pay participation fee
app.post("/auctions/:id/participate", async (c) => {
  try {
    const auctionId = c.req.param('id');
    console.log('💳 Paying participation fee for auction:', auctionId);

    const { userId, userName, userPhone, paymentMethod } = await c.req.json();

    if (!userId || !userName) {
      return c.json({ 
        success: false, 
        error: 'Barcha maydonlarni to\'ldiring' 
      }, 400);
    }

    // Get auction
    const auction = await kv.get(`auction:${auctionId}`);
    
    if (!auction) {
      return c.json({ 
        success: false, 
        error: 'Auksion topilmadi' 
      }, 404);
    }

    // Check if already participated
    const participantKey = `auction_participant:${auctionId}:${userId}`;
    const existingParticipant = await kv.get(participantKey);
    
    if (existingParticipant) {
      return c.json({ 
        success: false, 
        error: 'Siz allaqachon ishtirok etyapsiz' 
      }, 400);
    }

    // Create participant record
    const participant = {
      auctionId,
      userId,
      userName,
      userPhone: userPhone || '',
      paymentMethod: paymentMethod || 'cash',
      participationFee: auction.participationFee,
      paidAt: new Date().toISOString(),
    };

    await kv.set(participantKey, participant);

    // Update auction participants
    const participants = auction.participants || [];
    if (!participants.includes(userId)) {
      participants.push(userId);
    }

    const updatedAuction = {
      ...auction,
      participants,
      totalParticipants: participants.length,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`auction:${auctionId}`, updatedAuction);
    console.log('✅ Participation fee paid:', userId);

    return c.json({ 
      success: true, 
      participant,
      auction: updatedAuction,
      message: 'Ishtirok to\'lovi qabul qilindi'
    });
  } catch (error) {
    console.error('❌ Error processing participation:', error);
    return c.json({ 
      success: false, 
      error: 'To\'lovni qayta ishlashda xatolik yuz berdi',
      details: error.message 
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

    const { userId, userName, userPhone, productName, productDescription, images, category, estimatedPrice } = await c.req.json();

    if (!userId || !userName || !productName || !category) {
      return c.json({ 
        success: false, 
        error: 'Barcha maydonlarni to\'ldiring' 
      }, 400);
    }

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
    const userId = c.req.param('userId');
    console.log('🏆 Fetching wins for user:', userId);

    const auctions = await kv.getByPrefix('auction:');

    const wins = [];

    for (const auction of auctions) {
      if (!auction || !auction.id) continue;
      
      // Only check ended auctions
      const endDate = new Date(auction.endDate);
      const now = new Date();
      
      if (endDate > now && auction.status !== 'ended') {
        continue;
      }

      // Get highest bid
      const bids = await kv.getByPrefix(`auction_bid:${auction.id}:`);
      
      if (bids.length === 0) continue;

      // Sort by amount (highest first)
      const validBids = bids.filter((b: any) => b && typeof b === 'object' && b.amount);
      validBids.sort((a: any, b: any) => b.amount - a.amount);
      
      const highestBid = validBids[0];
      
      if (highestBid && highestBid.userId === userId) {
        wins.push({
          auction,
          bid: highestBid,
          wonAt: auction.endDate,
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