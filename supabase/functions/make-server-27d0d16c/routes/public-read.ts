import type { Hono } from "npm:hono";
import * as kv from "../kv_store.tsx";

/** Ochiq o‘qish: filiallar va mock favorites — `index.ts`dagi marshrutlar bilan identik. */
export function registerPublicReadRoutes(app: Hono): void {
  app.get("/make-server-27d0d16c/favorites", async (c) => {
    try {
      console.log("📚 PUBLIC: Fetching favorites...");

      const mockFavorites = [
        {
          id: "fav_1",
          type: "product",
          itemId: "product_1",
          name: "Mock Product 1",
          price: 299000,
          image: "/mock-images/product1.jpg",
          createdAt: new Date().toISOString(),
        },
        {
          id: "fav_2",
          type: "branch",
          itemId: "branch_1",
          name: "Test Branch 1",
          location: "Tashkent",
          createdAt: new Date().toISOString(),
        },
      ];

      console.log(`✅ PUBLIC: Found ${mockFavorites.length} favorites`);
      return c.json({
        success: true,
        favorites: mockFavorites,
        message: "Favorites loaded (mock)",
      });
    } catch (error) {
      console.log("PUBLIC Get favorites error:", error);
      return c.json({ error: "Favorites olishda xatolik" }, 500);
    }
  });

  app.get("/make-server-27d0d16c/public/branches", async (c) => {
    try {
      console.log("🌐 PUBLIC: Fetching all branches...");
      const branches = await kv.getByPrefix("branch:");
      console.log(`✅ PUBLIC: Found ${branches.length} branches`);
      return c.json({ branches });
    } catch (error) {
      console.log("PUBLIC Get branches error:", error);
      return c.json({ error: "Filiallarni olishda xatolik" }, 500);
    }
  });

  app.get("/make-server-27d0d16c/public/branches/location", async (c) => {
    try {
      const regionId = c.req.query("regionId");
      const districtId = c.req.query("districtId");

      console.log(`🌐 PUBLIC: Fetching branches for region: ${regionId}, district: ${districtId}`);

      const branches = await kv.getByPrefix("branch:");

      const filteredBranches = branches.filter((b: any) => {
        if (!b) return false;
        if (regionId && b.regionId !== regionId) return false;
        if (districtId && b.districtId !== districtId) return false;
        return true;
      });

      console.log(`✅ PUBLIC: Found ${filteredBranches.length} branches in location`);
      return c.json({ branches: filteredBranches });
    } catch (error) {
      console.log("PUBLIC Get branches by location error:", error);
      return c.json({ error: "Filiallarni olishda xatolik" }, 500);
    }
  });
}
