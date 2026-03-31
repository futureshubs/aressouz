import { getAdminDb } from "./client.ts";
import { resolveUserIdentity } from "./users.ts";

interface FavoriteTargetInput {
  productId?: string | null;
  listingId?: string | null;
}

interface GetFavoritesArgs {
  userId?: string | null;
  authUserId?: string | null;
}

interface ReplaceFavoritesArgs extends GetFavoritesArgs {
  items: FavoriteTargetInput[];
}

export const getUserFavorites = async (args: GetFavoritesArgs) => {
  const db = getAdminDb();
  const user = await resolveUserIdentity(args);

  const { data, error } = await db
    .from("favorites")
    .select(`
      id,
      created_at,
      product:product_id (
        id,
        slug,
        name,
        status,
        rating_average,
        review_count
      ),
      listing:listing_id (
        id,
        vertical_type,
        title,
        status,
        rating_average,
        review_count
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load favorites: ${error.message}`);
  }

  return data ?? [];
};

export const replaceUserFavorites = async (args: ReplaceFavoritesArgs) => {
  const db = getAdminDb();
  const user = await resolveUserIdentity(args);

  const normalizedItems = args.items.map((item) => ({
    user_id: user.id,
    product_id: item.productId || null,
    listing_id: item.listingId || null,
  }));

  const { error: deleteError } = await db
    .from("favorites")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    throw new Error(`Failed to clear favorites: ${deleteError.message}`);
  }

  if (!normalizedItems.length) {
    return [];
  }

  const { data, error } = await db
    .from("favorites")
    .insert(normalizedItems)
    .select("id, product_id, listing_id, created_at");

  if (error) {
    throw new Error(`Failed to replace favorites: ${error.message}`);
  }

  return data ?? [];
};
