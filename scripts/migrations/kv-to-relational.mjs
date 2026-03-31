import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const PAGE_SIZE = Number(process.env.KV_PAGE_SIZE || 500);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const state = {
  users: new Map(),
  stores: new Map(),
  branches: new Map(),
  categories: new Map(),
  products: new Map(),
  variants: new Map(),
  listings: new Map(),
};

const log = (...args) => console.log("[kv-to-relational]", ...args);

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

const hashPayload = (payload) =>
  createHash("sha256").update(JSON.stringify(payload ?? {})).digest("hex");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const chunk = (items, size = 200) => {
  const parts = [];
  for (let i = 0; i < items.length; i += size) {
    parts.push(items.slice(i, i + size));
  }
  return parts;
};

const fetchKvRows = async () => {
  const rows = [];
  let cursor = null;

  while (true) {
    let query = db
      .from("kv_store_27d0d16c")
      .select("key, value")
      .order("key", { ascending: true })
      .limit(PAGE_SIZE);

    if (cursor) {
      query = query.gt("key", cursor);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to read KV rows: ${error.message}`);
    }

    if (!data?.length) {
      break;
    }

    rows.push(...data);
    cursor = data[data.length - 1].key;
    log(`Loaded ${rows.length} KV rows so far`);
  }

  return rows;
};

const upsertRows = async (table, rows, onConflict) => {
  if (!rows.length) return;

  if (DRY_RUN) {
    log(`DRY RUN ${table}: ${rows.length} rows`);
    return;
  }

  for (const batch of chunk(rows)) {
    const { error } = await db.from(table).upsert(batch, { onConflict });
    if (error) {
      throw new Error(`Failed upserting ${table}: ${error.message}`);
    }
  }
};

const insertRows = async (table, rows) => {
  if (!rows.length) return;

  if (DRY_RUN) {
    log(`DRY RUN ${table}: ${rows.length} rows`);
    return;
  }

  for (const batch of chunk(rows)) {
    const { error } = await db.from(table).insert(batch);
    if (error) {
      throw new Error(`Failed inserting ${table}: ${error.message}`);
    }
  }
};

const recordLegacyMap = async (entityType, legacyKey, newTable, newId, payload) => {
  await upsertRows("legacy_kv_map", [{
    entity_type: entityType,
    legacy_key: legacyKey,
    new_table: newTable,
    new_id: newId,
    payload_hash: hashPayload(payload),
  }], "entity_type,legacy_key");
};

const ensureRegion = async (rawRegion) => {
  if (!rawRegion) return null;
  const id = slugify(rawRegion);
  await upsertRows("regions", [{
    id,
    name: rawRegion,
    name_uz: rawRegion,
  }], "id");
  return id;
};

const ensureDistrict = async (regionId, rawDistrict) => {
  if (!regionId || !rawDistrict) return null;
  const id = `${regionId}-${slugify(rawDistrict)}`;
  await upsertRows("districts", [{
    id,
    region_id: regionId,
    name: rawDistrict,
    name_uz: rawDistrict,
  }], "id");
  return id;
};

const ensureCategory = async ({ verticalType, rawCategoryId, rawCategoryName, rawCatalogName }) => {
  const categoryKey = `${verticalType}:${rawCategoryId || rawCategoryName || "other"}`;
  if (state.categories.has(categoryKey)) {
    return state.categories.get(categoryKey);
  }

  const catalogId = randomUUID();
  const categoryId = randomUUID();
  const catalogCode = `${verticalType}-${slugify(rawCatalogName || verticalType)}`;
  const categorySlug = `${verticalType}-${slugify(rawCategoryName || rawCategoryId || "other")}`;

  await upsertRows("catalogs", [{
    id: catalogId,
    vertical_type: verticalType,
    code: catalogCode,
    name: rawCatalogName || verticalType,
  }], "code");

  await upsertRows("categories", [{
    id: categoryId,
    catalog_id: catalogId,
    vertical_type: verticalType,
    legacy_external_id: rawCategoryId || null,
    slug: categorySlug,
    name: rawCategoryName || rawCategoryId || "Boshqa",
  }], "slug");

  state.categories.set(categoryKey, categoryId);
  return categoryId;
};

const ensureUser = async ({ legacyKey, phone, email, firstName, lastName, displayName, role = "buyer" }) => {
  if (legacyKey && state.users.has(legacyKey)) {
    return state.users.get(legacyKey);
  }

  const id = randomUUID();
  await upsertRows("users", [{
    id,
    legacy_kv_key: legacyKey || null,
    phone: phone || null,
    email: email || null,
    first_name: firstName || null,
    last_name: lastName || null,
    display_name: displayName || `${firstName || ""} ${lastName || ""}`.trim() || phone || email || "User",
    role,
    status: "active",
  }], legacyKey ? "legacy_kv_key" : "id");

  await upsertRows("user_profiles", [{
    user_id: id,
  }], "user_id");

  if (legacyKey) {
    state.users.set(legacyKey, id);
  }

  return id;
};

const ensureSellerStore = async ({ legacyKey, name, phone, email, region, district, address, branchId = null, type = "business" }) => {
  if (legacyKey && state.stores.has(legacyKey)) {
    return state.stores.get(legacyKey);
  }

  const ownerLegacyKey = `seller-owner:${legacyKey || name}`;
  const ownerUserId = await ensureUser({
    legacyKey: ownerLegacyKey,
    phone,
    email,
    displayName: name,
    role: "seller",
  });

  const sellerAccountId = randomUUID();
  await upsertRows("seller_accounts", [{
    id: sellerAccountId,
    user_id: ownerUserId,
    seller_type: type,
    legal_name: name,
    brand_name: name,
    status: "active",
  }], "user_id");

  const regionId = await ensureRegion(region);
  const districtId = await ensureDistrict(regionId, district);
  const storeId = randomUUID();

  await upsertRows("seller_stores", [{
    id: storeId,
    seller_account_id: sellerAccountId,
    legacy_kv_key: legacyKey || null,
    name,
    slug: slugify(name),
    phone: phone || null,
    email: email || null,
    region_id: regionId,
    district_id: districtId,
    address_line1: address || null,
    status: "active",
    is_delivery_enabled: true,
  }], legacyKey ? "legacy_kv_key" : "slug");

  if (branchId) {
    state.branches.set(branchId, branchId);
  }

  if (legacyKey) {
    state.stores.set(legacyKey, storeId);
  }

  return storeId;
};

const migrateUsers = async (rows) => {
  const profileRows = rows.filter((row) => row.key.startsWith("user:") && row.key.split(":").length === 2);

  for (const row of profileRows) {
    const profile = row.value || {};
    const userId = await ensureUser({
      legacyKey: row.key,
      phone: profile.phone,
      email: profile.email,
      firstName: profile.firstName || profile.name,
      lastName: profile.lastName,
      displayName: `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.name,
    });

    await upsertRows("user_profiles", [{
      user_id: userId,
      birth_date: profile.birthDate || null,
      gender: profile.gender || null,
      bonus_balance: toNumber(profile.bonus?.points ?? profile.points ?? 0),
      metadata: {
        legacy_created_at: profile.createdAt || null,
      },
    }], "user_id");

    await recordLegacyMap("user", row.key, "users", userId, profile);
  }
};

const migrateBranches = async (rows) => {
  const branchRows = rows.filter((row) => row.key.startsWith("branch:"));

  for (const row of branchRows) {
    const branch = row.value || {};
    const storeId = await ensureSellerStore({
      legacyKey: `store-from-branch:${row.key}`,
      name: branch.branchName || branch.name || "Branch Store",
      phone: branch.phone,
      region: branch.regionName || branch.region,
      district: branch.districtName || branch.district,
      address: branch.address,
      type: "branch_network",
    });

    const managerUserId = branch.managerName
      ? await ensureUser({
          legacyKey: `branch-manager:${row.key}`,
          displayName: branch.managerName,
          phone: branch.phone,
          role: "branch_staff",
        })
      : null;

    const regionId = await ensureRegion(branch.regionName || branch.region);
    const districtId = await ensureDistrict(regionId, branch.districtName || branch.district);
    const branchId = randomUUID();

    await upsertRows("branches", [{
      id: branchId,
      seller_store_id: storeId,
      legacy_kv_key: row.key,
      manager_user_id: managerUserId,
      name: branch.branchName || branch.name || "Branch",
      code: branch.id || slugify(branch.branchName || branch.name),
      phone: branch.phone || null,
      region_id: regionId,
      district_id: districtId,
      address_line1: branch.address || null,
      status: "active",
    }], "legacy_kv_key");

    state.branches.set(row.key, branchId);
    await recordLegacyMap("branch", row.key, "branches", branchId, branch);
  }
};

const migrateShops = async (rows) => {
  const shopRows = rows.filter((row) => row.key.startsWith("shop:"));

  for (const row of shopRows) {
    const shop = row.value || {};
    const storeId = await ensureSellerStore({
      legacyKey: row.key,
      name: shop.name || "Shop",
      phone: shop.phone,
      region: shop.region,
      district: shop.district,
      address: shop.address,
      type: "business",
    });

    await upsertRows("seller_stores", [{
      id: storeId,
      legacy_kv_key: row.key,
      name: shop.name || "Shop",
      slug: slugify(shop.name || row.key),
      phone: shop.phone || null,
      support_phone: shop.phone || null,
      logo_url: shop.logo || null,
      banner_url: shop.banner || null,
      is_delivery_enabled: Boolean(shop.delivery),
      min_order_amount: toNumber(shop.minOrder),
      default_delivery_eta_min_minutes: toNumber(shop.deliveryTime),
      default_delivery_eta_max_minutes: toNumber(shop.deliveryTime),
      telegram_chat_id: shop.telegramChatId || null,
      status: shop.deleted ? "archived" : "active",
    }], "legacy_kv_key");

    await recordLegacyMap("shop", row.key, "seller_stores", storeId, shop);
  }
};

const migrateProducts = async (rows) => {
  const productRows = rows.filter((row) =>
    row.key.startsWith("branchproduct:") ||
    row.key.startsWith("shop_product:") ||
    row.key.startsWith("product:") ||
    row.key.startsWith("food:")
  );

  for (const row of productRows) {
    const raw = row.value || {};
    const isBranchProduct = row.key.startsWith("branchproduct:");
    const isShopProduct = row.key.startsWith("shop_product:");
    const isFood = row.key.startsWith("food:");
    const verticalType = isFood ? "food" : raw.type === "rental" ? "rental" : (isShopProduct ? "shop" : "market");
    const categoryId = await ensureCategory({
      verticalType,
      rawCategoryId: raw.categoryId || raw.category?.id || raw.catalogId,
      rawCategoryName: raw.categoryName || raw.category?.name || raw.category || "Boshqa",
      rawCatalogName: raw.catalogName || raw.catalog || verticalType,
    });

    const branchLegacyKey = raw.branchId ? `branch:${raw.branchId}` : null;
    const branchId = branchLegacyKey && state.branches.has(branchLegacyKey) ? state.branches.get(branchLegacyKey) : null;
    const storeId = isShopProduct
      ? state.stores.get(`shop:${raw.shopId}`) || await ensureSellerStore({
          legacyKey: `shop:${raw.shopId}`,
          name: raw.shopName || "Shop",
          phone: raw.phone,
          region: raw.region,
          district: raw.district,
          address: raw.address,
          type: "business",
        })
      : branchId
        ? await ensureSellerStore({
            legacyKey: `store-for-branch:${branchLegacyKey}`,
            name: raw.branchName || "Branch Store",
            phone: raw.phone,
            region: raw.region,
            district: raw.district,
            address: raw.address,
            type: "branch_network",
          })
        : await ensureSellerStore({
            legacyKey: `store-for-product:${row.key}`,
            name: raw.shopName || raw.branchName || raw.ownerName || "Marketplace Store",
            phone: raw.phone,
            region: raw.region,
            district: raw.district,
            address: raw.address,
            type: "business",
          });

    const productId = randomUUID();
    const productName = raw.name || raw.title || "Unnamed product";

    await upsertRows("products", [{
      id: productId,
      legacy_kv_key: row.key,
      seller_store_id: storeId,
      branch_id: branchId,
      category_id: categoryId,
      vertical_type: verticalType,
      status: raw.deleted ? "archived" : "active",
      sku: raw.sku || null,
      slug: slugify(productName),
      name: productName,
      short_description: raw.shortDescription || null,
      description: raw.description || null,
      brand: raw.brand || null,
      unit_name: raw.unit || "item",
      rating_average: toNumber(raw.rating),
      review_count: toNumber(raw.reviewCount ?? raw.reviewsCount),
      published_at: raw.createdAt || new Date().toISOString(),
    }], "legacy_kv_key");

    state.products.set(row.key, productId);
    await recordLegacyMap("product", row.key, "products", productId, raw);

    const variants = isShopProduct
      ? asArray(raw.variants)
      : isBranchProduct
        ? asArray(raw.variants)
        : [{
            id: raw.id,
            name: raw.variantName || raw.name || "Standart",
            price: raw.price,
            oldPrice: raw.oldPrice,
            stock: raw.stock || raw.stockQuantity,
            images: raw.images || (raw.image ? [raw.image] : []),
          }];

    for (const variant of variants) {
      const variantId = randomUUID();
      const variantKey = `${row.key}:${variant.id || variant.name || variantId}`;
      await upsertRows("product_variants", [{
        id: variantId,
        product_id: productId,
        legacy_external_id: variant.id || null,
        variant_code: variant.id || slugify(variant.name || "default"),
        sku: variant.sku || null,
        barcode: variant.barcode || null,
        name: variant.name || "Standart",
        attribute_values: variant.attributes || {},
        price_amount: toNumber(variant.price ?? raw.price),
        compare_at_price: variant.oldPrice ?? raw.oldPrice ?? null,
        cost_amount: variant.costPrice ?? null,
        currency_code: "UZS",
        weight_grams: variant.weightGrams ?? null,
        status: "active",
      }], "id");

      state.variants.set(variantKey, variantId);

      await upsertRows("inventory_items", [{
        id: randomUUID(),
        product_variant_id: variantId,
        seller_store_id: storeId,
        branch_id: branchId,
        available_quantity: Math.max(0, toNumber(variant.stock ?? variant.stockQuantity ?? raw.stock ?? raw.stockQuantity)),
        reserved_quantity: 0,
        incoming_quantity: 0,
      }], "product_variant_id,branch_id");

      const mediaItems = asArray(variant.images || raw.images || (raw.image ? [raw.image] : []))
        .filter(Boolean)
        .map((mediaUrl, index) => ({
          id: randomUUID(),
          product_id: productId,
          variant_id: variantId,
          media_url: mediaUrl,
          media_type: "image",
          sort_order: index,
          is_primary: index === 0,
        }));

      await insertRows("product_media", mediaItems);
    }
  }
};

const migrateListings = async (rows) => {
  const listingRows = rows.filter((row) =>
    row.key.startsWith("house:") ||
    row.key.startsWith("car:") ||
    row.key.startsWith("listing:") ||
    row.key.startsWith("portfolio:") ||
    row.key.startsWith("place:")
  );

  for (const row of listingRows) {
    const raw = row.value || {};
    const verticalType = row.key.startsWith("house:")
      ? "property"
      : row.key.startsWith("car:")
        ? "vehicle"
        : row.key.startsWith("place:")
          ? "place"
          : row.key.startsWith("portfolio:")
            ? "service"
            : (raw.type === "house" ? "property" : raw.type === "car" ? "vehicle" : "service");

    const categoryId = await ensureCategory({
      verticalType,
      rawCategoryId: raw.categoryId || raw.profession || raw.propertyType || raw.brand,
      rawCategoryName: raw.category || raw.profession || raw.propertyType || raw.brand || "Boshqa",
      rawCatalogName: verticalType,
    });

    const userId = raw.userId
      ? await ensureUser({
          legacyKey: `user:${raw.userId}`,
          phone: raw.ownerPhone || raw.phone,
          displayName: raw.ownerName || raw.userName || raw.contactName,
        })
      : null;

    const storeId = raw.branchId || raw.shopId
      ? await ensureSellerStore({
          legacyKey: raw.shopId ? `shop:${raw.shopId}` : `store-for-listing:${row.key}`,
          name: raw.shopName || raw.branchName || raw.ownerName || raw.userName || "Listing Store",
          phone: raw.ownerPhone || raw.phone,
          region: raw.region,
          district: raw.district,
          address: raw.address,
        })
      : null;

    const regionId = await ensureRegion(raw.region);
    const districtId = await ensureDistrict(regionId, raw.district);
    const listingId = randomUUID();

    await upsertRows("listings", [{
      id: listingId,
      legacy_kv_key: row.key,
      user_id: userId,
      seller_store_id: storeId,
      category_id: categoryId,
      vertical_type: verticalType,
      status: raw.status === "active" || !raw.status ? "active" : "paused",
      title: raw.title || raw.name || `${verticalType} listing`,
      description: raw.description || null,
      price_from: raw.price || raw.priceFrom || null,
      price_to: raw.priceTo || null,
      currency_code: raw.currency || "UZS",
      condition_label: raw.condition || null,
      region_id: regionId,
      district_id: districtId,
      address_line1: raw.address || null,
      contact_name: raw.ownerName || raw.contactName || raw.userName || null,
      contact_phone: raw.ownerPhone || raw.phone || null,
      contact_email: raw.email || null,
      rating_average: toNumber(raw.rating),
      review_count: toNumber(raw.reviewCount ?? raw.reviews),
      published_at: raw.createdAt || new Date().toISOString(),
      verified: Boolean(raw.verified),
    }], "legacy_kv_key");

    state.listings.set(row.key, listingId);
    await recordLegacyMap("listing", row.key, "listings", listingId, raw);

    const mediaItems = asArray(raw.images || (raw.image ? [raw.image] : []))
      .filter(Boolean)
      .map((mediaUrl, index) => ({
        id: randomUUID(),
        listing_id: listingId,
        media_url: mediaUrl,
        media_type: "image",
        sort_order: index,
        is_primary: index === 0,
      }));

    await insertRows("listing_media", mediaItems);

    if (verticalType === "vehicle") {
      await upsertRows("vehicle_specs", [{
        listing_id: listingId,
        brand: raw.brand || null,
        model: raw.model || null,
        model_year: raw.year || null,
        mileage_km: raw.mileage || null,
        fuel_type: raw.fuelType || null,
        transmission_type: raw.transmission || null,
        engine_volume_cc: raw.engineVolume || null,
        drivetrain: raw.drivetrain || null,
        color: raw.color || null,
        vin: raw.vin || null,
        plates_region: raw.region || null,
      }], "listing_id");
    }

    if (verticalType === "property") {
      await upsertRows("property_specs", [{
        listing_id: listingId,
        property_type: raw.propertyType || raw.type || null,
        total_area_m2: raw.area || null,
        land_area_m2: raw.landArea || null,
        room_count: raw.rooms || null,
        bathroom_count: raw.bathrooms || null,
        floor_number: raw.floor || null,
        total_floors: raw.totalFloors || null,
        build_year: raw.buildYear || null,
        is_mortgage_allowed: Boolean(raw.isMortgageAllowed || raw.mortgageAvailable),
        is_halal_installment: Boolean(raw.isHalalInstallment || raw.halalInstallment),
      }], "listing_id");
    }

    if (verticalType === "service") {
      await upsertRows("service_profiles", [{
        listing_id: listingId,
        pricing_model: raw.priceType || null,
        phone: raw.phone || null,
        whatsapp: raw.whatsapp || null,
        telegram: raw.telegram || null,
        response_time_minutes: raw.responseTimeMinutes || null,
      }], "listing_id");
    }

    if (verticalType === "place") {
      await upsertRows("place_details", [{
        listing_id: listingId,
        place_type: raw.category || null,
        opening_hours: raw.workingHours || null,
        website_url: raw.website || null,
        google_maps_url: raw.googleMapsUrl || null,
      }], "listing_id");
    }
  }
};

const migrateFavoritesAndReviews = async (rows) => {
  const favoriteRows = rows.filter((row) => row.key.endsWith(":favorites"));
  const reviewRows = rows.filter((row) => row.key.startsWith("review:"));

  for (const row of favoriteRows) {
    const parts = row.key.split(":");
    const legacyUserKey = `${parts[0]}:${parts[1]}`;
    const userId = await ensureUser({ legacyKey: legacyUserKey });
    const items = asArray(row.value)
      .map((item) => ({
        id: randomUUID(),
        user_id: userId,
        product_id: item?.id ? (state.products.get(`product:${item.id}`) || state.products.get(`branchproduct:${item.id}`) || state.products.get(`shop_product:${item.id}`) || null) : null,
        listing_id: item?.id ? (state.listings.get(`listing:${parts[1]}:${item.id}`) || state.listings.get(`house:${item.id}`) || state.listings.get(`car:${item.id}`) || state.listings.get(`place:${item.id}`) || null) : null,
      }))
      .filter((item) => item.product_id || item.listing_id);

    await insertRows("favorites", items);
  }

  for (const row of reviewRows) {
    const parts = row.key.split(":");
    const targetKey = `${parts[0]}:${parts[1]}`;
    const payload = row.value || {};
    const userId = payload.userId
      ? await ensureUser({ legacyKey: `user:${payload.userId}`, displayName: payload.userName, phone: payload.userPhone })
      : await ensureUser({ legacyKey: `review-user:${row.key}`, displayName: payload.userName, phone: payload.userPhone });

    await insertRows("reviews", [{
      id: randomUUID(),
      user_id: userId,
      target_type: state.products.has(targetKey) ? "product" : "listing",
      product_id: state.products.get(targetKey) || null,
      listing_id: state.listings.get(targetKey) || null,
      rating: Math.min(5, Math.max(1, toNumber(payload.rating, 5))),
      title: payload.title || null,
      body: payload.comment || payload.content || null,
      is_verified_purchase: Boolean(payload.orderId),
      is_published: true,
      created_at: payload.createdAt || new Date().toISOString(),
      updated_at: payload.updatedAt || payload.createdAt || new Date().toISOString(),
    }]);
  }
};

const migrateOrdersAndPayments = async (rows) => {
  const orderRows = rows.filter((row) =>
    row.key.startsWith("order:") ||
    row.key.startsWith("shop_order:") ||
    row.key.startsWith("rental_order_")
  );

  for (const row of orderRows) {
    const raw = row.value || {};
    const legacyUserKey = raw.userId ? `user:${raw.userId}` : null;
    const userId = await ensureUser({
      legacyKey: legacyUserKey || `order-user:${row.key}`,
      phone: raw.customerPhone || raw.customer?.phone,
      displayName: raw.customerName || raw.customer?.name,
    });

    const orderId = randomUUID();
    const shippingAddress = {
      id: randomUUID(),
      order_id: orderId,
      role: "shipping",
      type: "shipping",
      recipient_name: raw.customerName || raw.customer?.name || "Mijoz",
      recipient_phone: raw.customerPhone || raw.customer?.phone || "",
      region_id: null,
      district_id: null,
      address_line1: raw.address?.street || raw.address || raw.customer?.address || "Unknown address",
      address_line2: null,
    };

    await insertRows("orders", [{
      id: orderId,
      legacy_kv_key: row.key,
      user_id: userId,
      order_number: raw.orderNumber || `MIG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: raw.status === "cancelled" ? "cancelled" : raw.status === "delivered" || raw.status === "completed" ? "fulfilled" : "processing",
      payment_status: raw.paymentStatus === "paid" ? "paid" : raw.paymentStatus === "failed" ? "failed" : "pending",
      currency_code: raw.currency || "UZS",
      subtotal_amount: toNumber(raw.totalAmount ?? raw.subtotal ?? raw.total),
      discount_amount: 0,
      tax_amount: toNumber(raw.tax),
      shipping_amount: toNumber(raw.deliveryPrice ?? raw.deliveryFee ?? raw.delivery?.price),
      total_amount: toNumber(raw.finalTotal ?? raw.totalAmount ?? raw.total),
      item_count: asArray(raw.items).length,
      promo_code: raw.promoCode || null,
      bonus_used_amount: toNumber(raw.bonusUsed),
      payment_requires_verification: Boolean(raw.paymentRequiresVerification),
      source_channel: "kv_migration",
      buyer_note: raw.notes || null,
      created_at: raw.createdAt || new Date().toISOString(),
      updated_at: raw.updatedAt || raw.createdAt || new Date().toISOString(),
      cancelled_at: raw.status === "cancelled" ? (raw.updatedAt || raw.createdAt || new Date().toISOString()) : null,
      completed_at: raw.status === "delivered" || raw.status === "completed" ? (raw.updatedAt || raw.createdAt || new Date().toISOString()) : null,
    }]);

    await insertRows("order_addresses", [shippingAddress]);

    const grouped = new Map();
    for (const item of asArray(raw.items)) {
      const variantKeyCandidates = [
        `shop_product:${item.productId}:${item.variantId}`,
        `branchproduct:${item.productId}:${item.variantId}`,
      ];

      const productKeyCandidates = [
        `shop_product:${item.productId}`,
        `branchproduct:${item.productId}`,
        `product:${item.productId}`,
      ];

      const productId = productKeyCandidates.map((key) => state.products.get(key)).find(Boolean) || null;
      const storeId = raw.shopId
        ? state.stores.get(`shop:${raw.shopId}`) || null
        : null;
      const branchId = raw.branchId ? (state.branches.get(`branch:${raw.branchId}`) || null) : null;
      const groupKey = `${storeId || "none"}:${branchId || "none"}:${raw.orderType || raw.type || "market"}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          id: randomUUID(),
          order_id: orderId,
          seller_store_id: storeId,
          branch_id: branchId,
          vertical_type: raw.orderType || raw.type || "market",
          status: raw.status === "cancelled" ? "cancelled" : raw.status === "delivered" || raw.status === "completed" ? "delivered" : "pending",
          fulfillment_type: raw.delivery || raw.deliveryZone ? "delivery" : "pickup",
          currency_code: raw.currency || "UZS",
          subtotal_amount: 0,
          discount_amount: 0,
          tax_amount: 0,
          shipping_amount: 0,
          total_amount: 0,
          item_count: 0,
          delivery_zone_id: null,
          note: raw.notes || null,
        });
      }

      const group = grouped.get(groupKey);
      const itemTotal = toNumber(item.total ?? item.totalPrice ?? (toNumber(item.price) * toNumber(item.quantity, 1)));
      group.subtotal_amount += itemTotal;
      group.total_amount += itemTotal;
      group.item_count += 1;

      if (!group.items) group.items = [];
      group.items.push({
        id: randomUUID(),
        order_id: orderId,
        order_group_id: group.id,
        seller_store_id: storeId,
        branch_id: branchId,
        vertical_type: raw.orderType || raw.type || "market",
        product_id: productId,
        product_variant_id: variantKeyCandidates.map((key) => state.variants.get(key)).find(Boolean) || null,
        listing_id: null,
        product_name: item.productName || item.name || "Item",
        variant_name: item.variantName || null,
        sku: item.sku || null,
        quantity: toNumber(item.quantity, 1),
        unit_price: toNumber(item.price),
        compare_at_price: item.oldPrice || null,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: itemTotal,
        currency_code: raw.currency || "UZS",
        requires_confirmation: false,
      });
    }

    for (const group of grouped.values()) {
      await insertRows("order_groups", [{
        ...group,
        items: undefined,
      }]);

      await insertRows("order_items", group.items || []);
    }

    if (raw.paymentMethod || raw.payment?.method) {
      await insertRows("payments", [{
        id: randomUUID(),
        order_id: orderId,
        provider: raw.paymentMethod || raw.payment?.method || "cash",
        method_type: ["cash", "naqd"].includes(String(raw.paymentMethod || raw.payment?.method || "cash")) ? "cash_on_delivery" : "online",
        status: raw.paymentStatus === "paid" ? "paid" : "pending",
        amount: toNumber(raw.finalTotal ?? raw.totalAmount ?? raw.total),
        currency_code: raw.currency || "UZS",
        idempotency_key: `${row.key}:payment`,
        merchant_order_ref: raw.orderNumber || null,
        provider_payment_ref: raw.paymentId || raw.transactionId || null,
        provider_checkout_url: raw.paymentUrl || null,
        is_test: Boolean(raw.isDemoMode),
      }]);
    }

    await recordLegacyMap("order", row.key, "orders", orderId, raw);
  }

  const transactionRows = rows.filter((row) => row.key.startsWith("transaction:") || row.key.startsWith("payment:"));
  for (const row of transactionRows) {
    const raw = row.value || {};
    if (!raw.orderId) continue;

    const { data: orderRecord } = await db
      .from("orders")
      .select("id")
      .or(`legacy_kv_key.eq.order:${raw.orderId},legacy_kv_key.eq.order:market:${raw.orderId}`)
      .maybeSingle();

    if (!orderRecord?.id) continue;

    await insertRows("payments", [{
      id: randomUUID(),
      order_id: orderRecord.id,
      provider: raw.method || raw.provider || "cash",
      method_type: raw.method === "cash" ? "cash_on_delivery" : "online",
      status: raw.status === "paid" ? "paid" : raw.status === "failed" ? "failed" : "pending",
      amount: toNumber(raw.amount),
      currency_code: "UZS",
      idempotency_key: `${row.key}:txn`,
      merchant_order_ref: raw.orderId,
      provider_payment_ref: raw.paymentId || raw.transactionId || null,
      provider_checkout_url: raw.paymentUrl || null,
      is_test: Boolean(raw.isTestMode || raw.isDemoMode),
    }]);
  }
};

const main = async () => {
  log(`Migration started${DRY_RUN ? " in DRY RUN mode" : ""}`);
  const rows = await fetchKvRows();
  log(`Loaded ${rows.length} total KV rows`);

  await migrateUsers(rows);
  await migrateBranches(rows);
  await migrateShops(rows);
  await migrateProducts(rows);
  await migrateListings(rows);
  await migrateFavoritesAndReviews(rows);
  await migrateOrdersAndPayments(rows);

  log("Migration completed");
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
