/** Qaysi bo‘limda qidirayotgani — vertikal bo‘yicha vaznlar */
export type SearchRankVertical =
  | 'product'
  | 'rental'
  | 'branch'
  | 'food'
  | 'vehicle'
  | 'property'
  | 'place'
  | 'general';

export type MarketplaceSearchOptions = {
  vertical?: SearchRankVertical;
};

export type MatchTier = 'exact' | 'strong' | 'related' | 'weak';

export type ParsedMarketplaceQuery = {
  raw: string;
  normalized: string;
  /** Atributlar ajratilgach qolgan ibora */
  phraseForMatch: string;
  tokens: string[];
  /** Joy nomlari (normalize) */
  locations: string[];
  roomCount: number | null;
  /** "16gb", "i5" kabi qatorlar */
  attributeHints: string[];
  priceMin: number | null;
  priceMax: number | null;
  rentIntent: boolean;
  /** Qidiruvdagi asosiy so‘zlar (joy/stopword chiqarilgan) */
  headTokens: string[];
};

export type DocumentMatchResult = {
  matches: boolean;
  score: number;
  tier: MatchTier;
};
