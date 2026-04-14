import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { publicAnonKey } from '../../../utils/supabase/info';
import { edgeApiBaseUrl, edgeFetch } from './apiFetch';

describe('edgeFetch (smoke)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    );
  });

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch);
    vi.restoreAllMocks();
  });

  it('edgeApiBaseUrl uses production URL in node (no window)', () => {
    const u = edgeApiBaseUrl();
    expect(u).toMatch(/^https:\/\//);
    expect(u).toContain('functions/v1');
  });

  it('merges anon Bearer, apikey, and X-Access-Token', async () => {
    await edgeFetch('/orders', {
      accessToken: 'test-session-token',
      headers: { 'Content-Type': 'application/json' },
    });
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/orders');
    const h = init.headers as Headers;
    expect(h.get('Authorization')).toBe(`Bearer ${publicAnonKey}`);
    expect(h.get('apikey')).toBe(publicAnonKey);
    expect(h.get('X-Access-Token')).toBe('test-session-token');
    expect(h.get('Content-Type')).toBe('application/json');
  });

  it('retries once on 503 for GET when retryOnceOnTransientFailure', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response('err', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await edgeFetch('/v2/orders', {
      method: 'GET',
      retryOnceOnTransientFailure: true,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
