import { describe, expect, it } from 'vitest';
import { getMarketingDoc, isValidMarketingSlug, MARKETING_DOC_SLUGS } from './marketingDocs';

describe('marketingDocs', () => {
  it('validates known slugs', () => {
    for (const s of MARKETING_DOC_SLUGS) {
      expect(isValidMarketingSlug(s)).toBe(true);
      expect(getMarketingDoc(s).title.length).toBeGreaterThan(0);
    }
  });

  it('rejects unknown slug', () => {
    expect(isValidMarketingSlug('nope')).toBe(false);
  });
});
