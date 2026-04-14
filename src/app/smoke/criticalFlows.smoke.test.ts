import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authAPI, ordersAPI } from '../services/api';

function installMemoryLocalStorage(): () => void {
  const store: Record<string, string> = {};
  const ls = {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  } as Storage;
  const g = globalThis as unknown as { localStorage?: Storage };
  const prev = g.localStorage;
  g.localStorage = ls;
  return () => {
    if (prev !== undefined) g.localStorage = prev;
    else delete g.localStorage;
  };
}

describe('critical API flows (smoke)', () => {
  const originalFetch = globalThis.fetch;
  let uninstallLs: (() => void) | undefined;

  beforeEach(() => {
    uninstallLs = installMemoryLocalStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, orders: [] }), { status: 200 }),
      ),
    );
  });

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch);
    vi.restoreAllMocks();
    uninstallLs?.();
  });

  it('authAPI.signin persists session token on success', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session: { access_token: 'smoke-access-token' },
          user: { id: 'user-1', email: 'a@b.uz' },
        }),
        { status: 200 },
      ),
    );

    await authAPI.signin('a@b.uz', 'password123');

    expect(globalThis.localStorage.getItem('auth_token')).toBe('smoke-access-token');
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/auth/signin');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body.email).toBe('a@b.uz');
  });

  it('ordersAPI.create sends POST with auth header', async () => {
    globalThis.localStorage.setItem('auth_token', 'tok-for-order');
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ order: { id: 'ord-1', total: 99 } }), { status: 200 }),
    );

    const order = await ordersAPI.create({ items: [], total: 99 });

    expect(order.id).toBe('ord-1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toContain('tok-for-order');
    expect(JSON.parse(String(init.body)).total).toBe(99);
  });
});
