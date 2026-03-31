import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const bannerRoutes = new Hono();

// Retry helper function for database operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 500
): Promise<T> {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`⚠️ Retry attempt ${i + 1}/${maxRetries} after error:`, error);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

// Banner categories
export const BANNER_CATEGORIES = [
  'market',
  'shop', 
  'foods',
  'rentals',
  'car',
  'house',
  'services'
] as const;

export type BannerCategory = typeof BANNER_CATEGORIES[number];

export interface Banner {
  id: string;
  branchId: string;
  category: BannerCategory;
  name: string;
  image: string;
  description: string;
  link?: string;
  promoCode?: string;
  region: string;
  district: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// GET /banners - Get all banners or filter by category/branchId
bannerRoutes.get('/banners', async (c) => {
  try {
    const branchId = c.req.query('branchId');
    const category = c.req.query('category') as BannerCategory | undefined;

    console.log('📢 ===== GET BANNERS REQUEST =====');
    console.log('📢 branchId:', branchId);
    console.log('📢 category:', category);

    // Get all banners with retry
    const allBanners = await retryOperation(
      () => kv.getByPrefix('banner:'),
      3,
      500
    );
    
    console.log('📢 Total banners from KV:', allBanners.length);
    
    // getByPrefix already returns values only, not {key, value} objects
    let banners = allBanners.filter((item: any) => item && typeof item === 'object') as Banner[];

    console.log('📢 After filter:', banners.length);

    // Filter by branchId if provided
    if (branchId) {
      console.log('📢 Filtering by branchId:', branchId);
      banners = banners.filter(banner => banner.branchId === branchId);
      console.log('📢 After branchId filter:', banners.length);
    }

    // Filter by category if provided
    if (category) {
      console.log('📢 Filtering by category:', category);
      banners = banners.filter(banner => banner.category === category);
      console.log('📢 After category filter:', banners.length);
    }

    // Filter only active banners
    console.log('📢 Before active filter:', banners.length);
    banners = banners.filter(banner => banner.isActive);
    console.log('📢 After active filter (final):', banners.length);

    // Sort by order
    banners.sort((a, b) => a.order - b.order);

    console.log('✅ FINAL BANNERS COUNT:', banners.length);
    console.log('📢 ===== END GET BANNERS =====\n');

    return c.json({
      success: true,
      data: banners
    });
  } catch (error) {
    console.error('❌ Get banners error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get banners'
    }, 500);
  }
});

// POST /banners - Create new banner
bannerRoutes.post('/banners', async (c) => {
  try {
    const body = await c.req.json();
    
    console.log('📢 ===== CREATE BANNER REQUEST =====');
    console.log('📢 Request body:', JSON.stringify(body, null, 2));

    const {
      branchId,
      category,
      name,
      image,
      description,
      link,
      promoCode,
      region,
      district
    } = body;

    // Validation
    if (!branchId || !category || !name || !image || !region || !district) {
      console.error('❌ Missing required fields');
      return c.json({
        success: false,
        error: 'Missing required fields: branchId, category, name, image, region, district'
      }, 400);
    }

    if (!BANNER_CATEGORIES.includes(category)) {
      console.error('❌ Invalid category:', category);
      return c.json({
        success: false,
        error: `Invalid category. Must be one of: ${BANNER_CATEGORIES.join(', ')}`
      }, 400);
    }

    // Generate unique ID
    const bannerId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('📢 Generated banner ID:', bannerId);

    // Get existing banners to determine order
    const existingBanners = await kv.getByPrefix(`banner:`);
    console.log('📢 Existing banners count:', existingBanners.length);
    
    // getByPrefix returns values directly, not {key, value} objects
    const categoryBanners = (existingBanners as Banner[])
      .filter((banner: Banner) => 
        banner.branchId === branchId &&
        banner.category === category
      );
    const order = categoryBanners.length;
    console.log('📢 Banner order in category:', order);

    const now = new Date().toISOString();

    const banner: Banner = {
      id: bannerId,
      branchId,
      category,
      name,
      image,
      description: description || '',
      link: link || undefined,
      promoCode: promoCode || undefined,
      region,
      district,
      isActive: true,
      order,
      createdAt: now,
      updatedAt: now
    };

    console.log('📢 Banner object to save:', JSON.stringify(banner, null, 2));

    // Save to KV store
    const kvKey = `banner:${bannerId}`;
    console.log('📢 Saving to KV with key:', kvKey);
    await kv.set(kvKey, banner);

    // Verify it was saved
    const savedBanner = await kv.get(kvKey);
    console.log('📢 Verification - Banner saved?', savedBanner ? 'YES' : 'NO');
    if (savedBanner) {
      console.log('📢 Saved banner data:', JSON.stringify(savedBanner, null, 2));
    }

    console.log('✅ Banner created successfully:', bannerId);
    console.log('📢 ===== END CREATE BANNER =====\n');

    return c.json({
      success: true,
      data: banner
    });
  } catch (error) {
    console.error('❌ Create banner error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create banner'
    }, 500);
  }
});

// PATCH /banners/:id - Update banner
bannerRoutes.patch('/banners/:id', async (c) => {
  try {
    const bannerId = c.req.param('id');
    const updates = await c.req.json();

    console.log('📢 Update banner request:', bannerId, updates);

    // Get existing banner
    const existing = await kv.get(`banner:${bannerId}`);
    if (!existing) {
      return c.json({
        success: false,
        error: 'Banner not found'
      }, 404);
    }

    const banner = existing as Banner;

    // Update fields
    const updatedBanner: Banner = {
      ...banner,
      ...updates,
      id: banner.id, // Don't allow ID change
      branchId: banner.branchId, // Don't allow branchId change
      createdAt: banner.createdAt, // Don't allow createdAt change
      updatedAt: new Date().toISOString()
    };

    // Save updated banner
    await kv.set(`banner:${bannerId}`, updatedBanner);

    console.log('✅ Banner updated:', bannerId);

    return c.json({
      success: true,
      data: updatedBanner
    });
  } catch (error) {
    console.error('❌ Update banner error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update banner'
    }, 500);
  }
});

// DELETE /banners/:id - Delete banner
bannerRoutes.delete('/banners/:id', async (c) => {
  try {
    const bannerId = c.req.param('id');

    console.log('📢 Delete banner request:', bannerId);

    // Check if banner exists
    const existing = await kv.get(`banner:${bannerId}`);
    if (!existing) {
      return c.json({
        success: false,
        error: 'Banner not found'
      }, 404);
    }

    // Delete banner
    await kv.del(`banner:${bannerId}`);

    console.log('✅ Banner deleted:', bannerId);

    return c.json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete banner error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete banner'
    }, 500);
  }
});

// PATCH /banners/:id/toggle - Toggle banner active status
bannerRoutes.patch('/banners/:id/toggle', async (c) => {
  try {
    const bannerId = c.req.param('id');

    console.log('📢 Toggle banner status:', bannerId);

    // Get existing banner
    const existing = await kv.get(`banner:${bannerId}`);
    if (!existing) {
      return c.json({
        success: false,
        error: 'Banner not found'
      }, 404);
    }

    const banner = existing as Banner;

    // Toggle isActive
    const updatedBanner: Banner = {
      ...banner,
      isActive: !banner.isActive,
      updatedAt: new Date().toISOString()
    };

    // Save updated banner
    await kv.set(`banner:${bannerId}`, updatedBanner);

    console.log('✅ Banner status toggled:', bannerId, 'isActive:', updatedBanner.isActive);

    return c.json({
      success: true,
      data: updatedBanner
    });
  } catch (error) {
    console.error('❌ Toggle banner error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle banner status'
    }, 500);
  }
});

export default bannerRoutes;