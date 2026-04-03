/**
 * Filial market mahsulot qo‘shish: katalog / kategoriya tanlovi uchun standart daraxt.
 * GET /categories: `_marketCatalogSeedVersion` < MARKET_CATALOG_SEED_VERSION bo‘lsa merge.
 */
const G = "https://images.unsplash.com/photo-1560493676-0405c45f7831?w=800";

/** Admin PUT dan keyin ham saqlanadi */
export const MARKET_CATALOG_SEED_FLAG = "_seedMarketCatalogsV2";
export const MARKET_CATALOG_SEED_VERSION_KEY = "_marketCatalogSeedVersion";
/** Oshirib yangi katalog/kategoriyalarni barcha filiallarga bir marta qo‘shish */
export const MARKET_CATALOG_SEED_VERSION = 3;

export type MarketCategory = {
  id: string;
  name: string;
  catalog: string;
  image?: string;
};

export type MarketCatalog = {
  id: string;
  name: string;
  image?: string;
  categories: MarketCategory[];
};

export const DEFAULT_MARKET_CATALOGS: { catalogs: MarketCatalog[] } = {
  catalogs: [
    {
      id: "groceries",
      name: "Oziq-ovqat",
      image: G,
      categories: [
        { id: "pasta-cereals", name: "Makaron va don", catalog: "groceries", image: G },
        { id: "rice", name: "Guruch", catalog: "groceries", image: G },
        { id: "flour", name: "Un va undan mahsulotlar", catalog: "groceries", image: G },
        { id: "oil", name: "Yog‘lar", catalog: "groceries", image: G },
        { id: "sugar-salt", name: "Shakar va tuz", catalog: "groceries", image: G },
        { id: "canned", name: "Konservalar", catalog: "groceries", image: G },
        { id: "dairy-grocery", name: "Sut mahsulotlari (sovuq zanjir)", catalog: "groceries", image: G },
        { id: "spices", name: "Ziravorlar va souslar", catalog: "groceries", image: G },
        { id: "tea-coffee", name: "Choy va qahva", catalog: "groceries", image: G },
        { id: "breakfast", name: "Nonushta", catalog: "groceries", image: G },
        { id: "baby-food", name: "Bolalar oziq-ovqati", catalog: "groceries", image: G },
      ],
    },
    {
      id: "fruits",
      name: "Mevalar",
      image: G,
      categories: [
        { id: "citrus", name: "Sitrus", catalog: "fruits", image: G },
        { id: "stone-fruits", name: "Shaftoli va o‘rik", catalog: "fruits", image: G },
        { id: "berries", name: "Rezavorlar", catalog: "fruits", image: G },
        { id: "apples-pears", name: "Olma va nok", catalog: "fruits", image: G },
        { id: "grapes", name: "Uzum", catalog: "fruits", image: G },
        { id: "bananas", name: "Banan", catalog: "fruits", image: G },
        { id: "melons", name: "Qovun va tarvuz", catalog: "fruits", image: G },
        { id: "exotic-fruits", name: "Ekzotik mevalar", catalog: "fruits", image: G },
        { id: "tropical-fruits", name: "Tropik mevalar", catalog: "fruits", image: G },
        { id: "dried-fruits", name: "Quritilgan mevalar", catalog: "fruits", image: G },
        { id: "organic-fruits", name: "Organik mevalar", catalog: "fruits", image: G },
        { id: "fruit-sets", name: "To‘plam va sovg‘a qutisi", catalog: "fruits", image: G },
        { id: "avocado-mango", name: "Avokado va mango", catalog: "fruits", image: G },
        { id: "kiwi-pineapple", name: "Kivi va ananas", catalog: "fruits", image: G },
        { id: "cherries-plums", name: "Gilos va o‘rikxo‘ra", catalog: "fruits", image: G },
        { id: "pomegranate-fig", name: "Anor va anjir", catalog: "fruits", image: G },
        { id: "coconut-dates", name: "Kokos va xurmo", catalog: "fruits", image: G },
      ],
    },
    {
      id: "vegetables",
      name: "Sabzavotlar",
      image: G,
      categories: [
        { id: "tomatoes", name: "Pomidor", catalog: "vegetables", image: G },
        { id: "cucumbers", name: "Bodring", catalog: "vegetables", image: G },
        { id: "potatoes", name: "Kartoshka", catalog: "vegetables", image: G },
        { id: "onions", name: "Piyoz va sarimsoq", catalog: "vegetables", image: G },
        { id: "carrots", name: "Sabzi", catalog: "vegetables", image: G },
        { id: "cabbage", name: "Karam", catalog: "vegetables", image: G },
        { id: "greens", name: "Yashil", catalog: "vegetables", image: G },
        { id: "root-vegetables", name: "Ildizmevalar", catalog: "vegetables", image: G },
        { id: "mushrooms", name: "Qo‘ziqorin", catalog: "vegetables", image: G },
      ],
    },
    {
      id: "dairy",
      name: "Sut mahsulotlari",
      image: G,
      categories: [
        { id: "milk", name: "Sut", catalog: "dairy", image: G },
        { id: "yogurt", name: "Yogurt va kefir", catalog: "dairy", image: G },
        { id: "cheese", name: "Pishloq", catalog: "dairy", image: G },
        { id: "butter-cream", name: "Saryog‘ va qaymaq", catalog: "dairy", image: G },
        { id: "eggs", name: "Tuxum", catalog: "dairy", image: G },
      ],
    },
    {
      id: "meat-fish",
      name: "Go‘sht va baliq",
      image: G,
      categories: [
        { id: "beef", name: "Mol go‘shti", catalog: "meat-fish", image: G },
        { id: "lamb", name: "Qo‘chqor / mol", catalog: "meat-fish", image: G },
        { id: "poultry", name: "Parrandachilik", catalog: "meat-fish", image: G },
        { id: "sausages", name: "Kolbasa va sosiska", catalog: "meat-fish", image: G },
        { id: "fish", name: "Baliq", catalog: "meat-fish", image: G },
        { id: "seafood", name: "Dengiz mahsulotlari", catalog: "meat-fish", image: G },
      ],
    },
    {
      id: "bakery",
      name: "Non va pishiriq",
      image: G,
      categories: [
        { id: "bread", name: "Non", catalog: "bakery", image: G },
        { id: "pastry", name: "Pishiriqlar", catalog: "bakery", image: G },
        { id: "cakes", name: "Tortlar", catalog: "bakery", image: G },
      ],
    },
    {
      id: "drinks",
      name: "Ichimliklar",
      image: G,
      categories: [
        { id: "water", name: "Suv", catalog: "drinks", image: G },
        { id: "juice", name: "Sharbat", catalog: "drinks", image: G },
        { id: "soda", name: "Gazlangan", catalog: "drinks", image: G },
        { id: "energy", name: "Energetik", catalog: "drinks", image: G },
      ],
    },
    {
      id: "snacks",
      name: "Gazaklar va shirinlik",
      image: G,
      categories: [
        { id: "chips", name: "Chips va kraker", catalog: "snacks", image: G },
        { id: "chocolate", name: "Shokolad", catalog: "snacks", image: G },
        { id: "candy", name: "Konfet", catalog: "snacks", image: G },
        { id: "nuts", name: "Yong‘oq va quritilgan meva", catalog: "snacks", image: G },
      ],
    },
    {
      id: "frozen",
      name: "Muzlatilgan",
      image: G,
      categories: [
        { id: "frozen-veg", name: "Sabzavot", catalog: "frozen", image: G },
        { id: "frozen-ready", name: "Tayyor taomlar", catalog: "frozen", image: G },
        { id: "ice-cream", name: "Muzqaymoq", catalog: "frozen", image: G },
      ],
    },
    {
      id: "household",
      name: "Uy-ro‘zg‘or",
      image: G,
      categories: [
        { id: "cleaning", name: "Tozalash vositalari", catalog: "household", image: G },
        { id: "paper", name: "Qog‘oz mahsulotlari", catalog: "household", image: G },
        { id: "kitchen-tools", name: "Oshxona anjomlari", catalog: "household", image: G },
        { id: "storage", name: "Saqlash idishlari", catalog: "household", image: G },
      ],
    },
    {
      id: "hygiene",
      name: "Shaxsiy gigiena",
      image: G,
      categories: [
        { id: "shower", name: "Dush va sovun", catalog: "hygiene", image: G },
        { id: "oral", name: "Og‘iz parvarishi", catalog: "hygiene", image: G },
        { id: "hair", name: "Soch parvarishi", catalog: "hygiene", image: G },
        { id: "skin", name: "Teri parvarishi", catalog: "hygiene", image: G },
      ],
    },
    {
      id: "baby",
      name: "Bolalar uchun",
      image: G,
      categories: [
        { id: "diapers", name: "Tagliklar", catalog: "baby", image: G },
        { id: "baby-care", name: "Parvarish", catalog: "baby", image: G },
        { id: "baby-toys", name: "O‘yinchoqlar", catalog: "baby", image: G },
      ],
    },
    {
      id: "pets",
      name: "Uy hayvonlari",
      image: G,
      categories: [
        { id: "dog-food", name: "It uchun", catalog: "pets", image: G },
        { id: "cat-food", name: "Mushuk uchun", catalog: "pets", image: G },
        { id: "pet-accessories", name: "Aksessuarlar", catalog: "pets", image: G },
      ],
    },
    {
      id: "electronics",
      name: "Elektronika",
      image: G,
      categories: [
        { id: "phones-acc", name: "Telefon aksessuarlari", catalog: "electronics", image: G },
        { id: "audio", name: "Audio", catalog: "electronics", image: G },
        { id: "cables", name: "Kabel va adapter", catalog: "electronics", image: G },
        { id: "batteries", name: "Batareykalar", catalog: "electronics", image: G },
        { id: "small-appliances", name: "Kichik maishiy texnika", catalog: "electronics", image: G },
      ],
    },
    {
      id: "home-garden",
      name: "Uy va bog‘",
      image: G,
      categories: [
        { id: "textile", name: "Matolar va parda", catalog: "home-garden", image: G },
        { id: "decor", name: "Dekor", catalog: "home-garden", image: G },
        { id: "tools", name: "Asboblar", catalog: "home-garden", image: G },
        { id: "plants", name: "O‘simliklar", catalog: "home-garden", image: G },
      ],
    },
    {
      id: "clothing",
      name: "Kiyim-kechak",
      image: G,
      categories: [
        { id: "mens", name: "Erkaklar", catalog: "clothing", image: G },
        { id: "womens", name: "Ayollar", catalog: "clothing", image: G },
        { id: "kids-wear", name: "Bolalar", catalog: "clothing", image: G },
        { id: "underwear", name: "Ichki kiyim", catalog: "clothing", image: G },
        { id: "footwear", name: "Oyoq kiyim", catalog: "clothing", image: G },
      ],
    },
    {
      id: "sports",
      name: "Sport",
      image: G,
      categories: [
        { id: "fitness", name: "Fitnes", catalog: "sports", image: G },
        { id: "balls", name: "To‘p va raketka", catalog: "sports", image: G },
        { id: "outdoor", name: "Sayr", catalog: "sports", image: G },
      ],
    },
    {
      id: "auto",
      name: "Avtotovarlar",
      image: G,
      categories: [
        { id: "car-care", name: "Parvarish", catalog: "auto", image: G },
        { id: "car-accessories", name: "Aksessuarlar", catalog: "auto", image: G },
      ],
    },
    {
      id: "stationery",
      name: "Kanstovarlar",
      image: G,
      categories: [
        { id: "writing", name: "Yozuv buyumlari", catalog: "stationery", image: G },
        { id: "paper-office", name: "Qog‘oz va daftar", catalog: "stationery", image: G },
        { id: "school", name: "Maktab", catalog: "stationery", image: G },
      ],
    },
    {
      id: "health",
      name: "Sog‘liq va vitaminlar",
      image: G,
      categories: [
        { id: "vitamins", name: "Vitaminlar", catalog: "health", image: G },
        { id: "bandage", name: "Tibbiy sarf", catalog: "health", image: G },
        { id: "masks", name: "Maska va antiseptik", catalog: "health", image: G },
      ],
    },
  ],
};

export function mergeMarketCatalogTrees(
  existing: { catalogs?: MarketCatalog[] },
  defaults: { catalogs: MarketCatalog[] },
): { catalogs: MarketCatalog[]; changed: boolean } {
  let changed = false;
  const byId = new Map<string, MarketCatalog>();

  for (const c of existing.catalogs || []) {
    if (!c?.id) continue;
    byId.set(String(c.id), {
      ...c,
      categories: Array.isArray(c.categories) ? c.categories.map((x) => ({ ...x })) : [],
    });
  }

  for (const def of defaults.catalogs) {
    const id = def.id;
    if (!byId.has(id)) {
      byId.set(id, JSON.parse(JSON.stringify(def)) as MarketCatalog);
      changed = true;
      continue;
    }
    const cur = byId.get(id)!;
    const subIds = new Set((cur.categories || []).map((s) => String(s.id)));
    for (const sub of def.categories || []) {
      if (!subIds.has(String(sub.id))) {
        cur.categories = [...(cur.categories || []), { ...sub }];
        subIds.add(String(sub.id));
        changed = true;
      }
    }
  }

  return { catalogs: Array.from(byId.values()), changed };
}
