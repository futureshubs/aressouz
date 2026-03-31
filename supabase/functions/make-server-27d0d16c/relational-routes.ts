import { Hono } from "npm:hono";
import { getProductsWithFilters } from "../_shared/db/catalog.ts";
import { getUserFavorites, replaceUserFavorites } from "../_shared/db/favorites.ts";
import { createMarketplaceOrder, getBuyerOrders, getSellerOrderQueue } from "../_shared/db/orders.ts";
import { resolveV2IdentityFromRequest } from "./relational-auth.ts";

const relationalRoutes = new Hono();

const v2ErrorStatus = (message: string) =>
  message === "Unauthorized" ? 401 : 400;

relationalRoutes.get("/v2/users/me/favorites", async (c) => {
  try {
    const identity = await resolveV2IdentityFromRequest(c.req.raw);
    const data = await getUserFavorites(identity);
    return c.json({ success: true, favorites: data });
  } catch (error: any) {
    const msg = error.message || "Failed to load relational favorites";
    return c.json({ success: false, error: msg }, v2ErrorStatus(msg));
  }
});

relationalRoutes.put("/v2/users/me/favorites", async (c) => {
  try {
    const identity = await resolveV2IdentityFromRequest(c.req.raw);
    const body = await c.req.json();
    const data = await replaceUserFavorites({
      ...identity,
      items: Array.isArray(body?.items) ? body.items : [],
    });
    return c.json({ success: true, favorites: data });
  } catch (error: any) {
    const msg = error.message || "Failed to replace relational favorites";
    return c.json({ success: false, error: msg }, v2ErrorStatus(msg));
  }
});

relationalRoutes.get("/v2/products", async (c) => {
  try {
    const minPrice = c.req.query("minPrice");
    const maxPrice = c.req.query("maxPrice");

    const data = await getProductsWithFilters({
      categoryId: c.req.query("categoryId"),
      sellerStoreId: c.req.query("sellerStoreId"),
      branchId: c.req.query("branchId"),
      verticalType: c.req.query("verticalType"),
      regionId: c.req.query("regionId"),
      districtId: c.req.query("districtId"),
      q: c.req.query("q"),
      status: c.req.query("status"),
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
      offset: c.req.query("offset") ? Number(c.req.query("offset")) : undefined,
    });

    return c.json({ success: true, ...data });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to load relational products" }, 400);
  }
});

relationalRoutes.get("/v2/orders", async (c) => {
  try {
    const identity = await resolveV2IdentityFromRequest(c.req.raw);
    const data = await getBuyerOrders({
      ...identity,
      limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
      offset: c.req.query("offset") ? Number(c.req.query("offset")) : undefined,
    });
    return c.json({ success: true, ...data });
  } catch (error: any) {
    const msg = error.message || "Failed to load relational orders";
    return c.json({ success: false, error: msg }, v2ErrorStatus(msg));
  }
});

relationalRoutes.get("/v2/seller/orders", async (c) => {
  try {
    const sellerStoreId = c.req.query("sellerStoreId");
    if (!sellerStoreId) {
      return c.json({ success: false, error: "sellerStoreId is required" }, 400);
    }

    const data = await getSellerOrderQueue({
      sellerStoreId,
      status: c.req.query("status"),
      limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
      offset: c.req.query("offset") ? Number(c.req.query("offset")) : undefined,
    });

    return c.json({ success: true, ...data });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to load seller order queue" }, 400);
  }
});

relationalRoutes.post("/v2/orders", async (c) => {
  try {
    const identity = await resolveV2IdentityFromRequest(c.req.raw);
    const body = await c.req.json();
    const orderId = await createMarketplaceOrder({
      ...identity,
      currency_code: body?.currency_code,
      source_channel: body?.source_channel,
      promo_code: body?.promo_code,
      bonus_used_amount: body?.bonus_used_amount,
      buyer_note: body?.buyer_note,
      payment_requires_verification: body?.payment_requires_verification,
      shipping_address: body?.shipping_address,
      billing_address: body?.billing_address,
      groups: Array.isArray(body?.groups) ? body.groups : [],
      payment: body?.payment || null,
    });

    return c.json({ success: true, orderId });
  } catch (error: any) {
    const msg = error.message || "Failed to create relational order";
    return c.json({ success: false, error: msg }, v2ErrorStatus(msg));
  }
});

export default relationalRoutes;
