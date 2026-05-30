import { describe, expect, it } from 'vitest';

/** Mirror of server `legacyOrderKeyCandidates` for regression */
function legacyOrderKeyCandidates(legacyOrderId: string): string[] {
  const raw = String(legacyOrderId || '').trim();
  if (!raw) return [];
  const keys = new Set<string>();
  if (raw.startsWith('order:market:')) {
    const stripped = raw.slice('order:market:'.length);
    keys.add(raw);
    keys.add(`order:${stripped}`);
    keys.add(stripped);
  } else if (raw.startsWith('order:')) {
    const stripped = raw.slice('order:'.length);
    keys.add(raw);
    keys.add(`order:market:${stripped}`);
    keys.add(stripped);
  } else {
    keys.add(`order:${raw}`);
    keys.add(`order:market:${raw}`);
  }
  return Array.from(keys);
}

describe('legacyOrderKeyCandidates', () => {
  it('maps bare id to order and order:market keys', () => {
    const keys = legacyOrderKeyCandidates('abc123');
    expect(keys).toContain('order:abc123');
    expect(keys).toContain('order:market:abc123');
  });

  it('normalizes order:market prefix', () => {
    const keys = legacyOrderKeyCandidates('order:market:xyz');
    expect(keys).toContain('order:xyz');
    expect(keys).toContain('order:market:xyz');
  });
});
