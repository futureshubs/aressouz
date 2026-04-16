export type {
  DocumentMatchResult,
  MarketplaceSearchOptions,
  MatchTier,
  ParsedMarketplaceQuery,
  SearchRankVertical,
} from './types';
export { normalizeSearchText, normalizeHeaderSearch } from './textNormalize';
export { parseMarketplaceQuery, expandedHeadTokens } from './queryIntel';
export {
  scoreMarketplaceDocument,
  scoreMarketplaceSearchLegacy,
  compareMarketplaceRank,
  getParsedQuery,
  type RankableItemMeta,
} from './rankingEngine';
export { fuzzyTokenInText, levenshtein } from './fuzzy';
export { applyPhraseSynonyms, expandTokenAliases, TOKEN_ALIASES } from './synonyms';
