import { getAdminDb } from "./client.ts";

export interface ProductFilterArgs {
  categoryId?: string | null;
  sellerStoreId?: string | null;
  branchId?: string | null;
  verticalType?: string | null;
  regionId?: string | null;
  districtId?: string | null;
  q?: string | null;
  status?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  limit?: number;
  offset?: number;
}

export const getProductsWithFilters = async (args: ProductFilterArgs) => {
  const db = getAdminDb();
  const limit = Math.min(Math.max(args.limit ?? 24, 1), 100);
  const offset = Math.max(args.offset ?? 0, 0);
  let scopedStoreIds: string[] | null = null;
  let scopedProductIds: string[] | null = null;

  if (args.regionId || args.districtId) {
    let storeQuery = db
      .from("seller_stores")
      .select("id");

    if (args.regionId) {
      storeQuery = storeQuery.eq("region_id", args.regionId);
    }
    if (args.districtId) {
      storeQuery = storeQuery.eq("district_id", args.districtId);
    }

    const { data: storeRows, error: storeError } = await storeQuery;
    if (storeError) {
      throw new Error(`Failed to scope stores: ${storeError.message}`);
    }

    scopedStoreIds = (storeRows ?? []).map((row) => row.id);
    if (!scopedStoreIds.length) {
      return { items: [], total: 0, limit, offset };
    }
  }

  if (typeof args.minPrice === "number" || typeof args.maxPrice === "number") {
    let variantQuery = db
      .from("product_variants")
      .select("product_id");

    if (typeof args.minPrice === "number") {
      variantQuery = variantQuery.gte("price_amount", args.minPrice);
    }

    if (typeof args.maxPrice === "number") {
      variantQuery = variantQuery.lte("price_amount", args.maxPrice);
    }

    const { data: variantRows, error: variantError } = await variantQuery;
    if (variantError) {
      throw new Error(`Failed to scope products by price: ${variantError.message}`);
    }

    scopedProductIds = [...new Set((variantRows ?? []).map((row) => row.product_id).filter(Boolean))];
    if (!scopedProductIds.length) {
      return { items: [], total: 0, limit, offset };
    }
  }

  let query = db
    .from("products")
    .select(`
      id,
      slug,
      name,
      short_description,
      description,
      vertical_type,
      status,
      brand,
      rating_average,
      review_count,
      is_featured,
      published_at,
      seller_store:seller_store_id (
        id,
        name,
        slug,
        region_id,
        district_id
      ),
      category:category_id (
        id,
        name,
        slug
      ),
      variants:product_variants (
        id,
        name,
        sku,
        price_amount,
        compare_at_price,
        currency_code,
        status
      ),
      media:product_media (
        id,
        media_url,
        media_type,
        is_primary,
        sort_order
      )
    `, { count: "exact" });

  if (args.categoryId) {
    query = query.eq("category_id", args.categoryId);
  }

  if (args.sellerStoreId) {
    query = query.eq("seller_store_id", args.sellerStoreId);
  } else if (scopedStoreIds) {
    query = query.in("seller_store_id", scopedStoreIds);
  }

  if (args.branchId) {
    query = query.eq("branch_id", args.branchId);
  }

  if (args.verticalType) {
    query = query.eq("vertical_type", args.verticalType);
  }

  if (args.status) {
    query = query.eq("status", args.status);
  } else {
    query = query.eq("status", "active");
  }

  if (args.q?.trim()) {
    query = query.or(`name.ilike.%${args.q.trim()}%,brand.ilike.%${args.q.trim()}%,description.ilike.%${args.q.trim()}%`);
  }

  if (scopedProductIds) {
    query = query.in("id", scopedProductIds);
  }

  const { data, error, count } = await query
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  return {
    items: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  };
};
