import { publicAnonKey, API_BASE_URL, DEV_API_BASE_URL } from '../../../utils/supabase/info';

export function edgeApiBaseUrl(): string {
  if (typeof window === 'undefined') return API_BASE_URL;
  return window.location.hostname === 'localhost' ? DEV_API_BASE_URL : API_BASE_URL;
}

export type EdgeFetchInit = RequestInit & {
  /** Sessiya: `X-Access-Token` (mavjud bo‘lmasa qo‘shiladi). */
  accessToken?: string;
  /** Berilganda so‘rov `timeoutMs` dan keyin abort qilinadi (user `signal` bilan birlashtiriladi). */
  timeoutMs?: number;
  /**
   * Faqat idempotent so‘rovlar uchun: GET/HEAD, tanlangan 502/503/504 yoki tarmoq xatosida 1 marta qayta urinish.
   * Default: o‘chiq (oldingi xatti-harakat).
   */
  retryOnceOnTransientFailure?: boolean;
};

function isTransientHttpStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isUserAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

/**
 * Edge function ga bir xil `Authorization` / `apikey` / ixtiyoriy `X-Access-Token` bilan so‘rov.
 * Mavjud sarlavhalar ustidan yozilmaydi (caller nazorat qiladi).
 */
export async function edgeFetch(path: string, init: EdgeFetchInit = {}): Promise<Response> {
  const {
    accessToken,
    headers: userHeaders,
    timeoutMs,
    retryOnceOnTransientFailure,
    signal: userSignal,
    ...restInit
  } = init;
  const base = edgeApiBaseUrl();
  const url =
    path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const h = new Headers(userHeaders);
  if (!h.has('Authorization')) {
    h.set('Authorization', `Bearer ${publicAnonKey}`);
  }
  if (!h.has('apikey')) {
    h.set('apikey', publicAnonKey);
  }
  if (
    accessToken &&
    !h.has('X-Access-Token') &&
    !h.has('x-access-token')
  ) {
    h.set('X-Access-Token', accessToken);
  }
  if (
    !h.has('Content-Type') &&
    restInit.body != null &&
    !(restInit.body instanceof FormData) &&
    !(restInit.body instanceof Blob) &&
    !(restInit.body instanceof ArrayBuffer)
  ) {
    h.set('Content-Type', 'application/json');
  }

  const method = (restInit.method || 'GET').toUpperCase();
  const allowRetry =
    Boolean(retryOnceOnTransientFailure) &&
    (method === 'GET' || method === 'HEAD') &&
    restInit.body == null;

  const runOnce = async (): Promise<Response> => {
    const hasTimeout = typeof timeoutMs === 'number' && timeoutMs > 0;
    const needMergedSignal = hasTimeout || !!userSignal;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let forwardUserAbort: (() => void) | null = null;
    let outSignal: AbortSignal | undefined;

    if (!needMergedSignal) {
      outSignal = undefined;
    } else {
      const controller = new AbortController();
      outSignal = controller.signal;
      if (hasTimeout) {
        timer = setTimeout(() => controller.abort(), timeoutMs);
      }
      if (userSignal) {
        if (userSignal.aborted) controller.abort();
        else {
          forwardUserAbort = () => controller.abort();
          userSignal.addEventListener('abort', forwardUserAbort, { once: true });
        }
      }
    }

    try {
      return await fetch(url, {
        ...restInit,
        headers: h,
        signal: outSignal,
      });
    } finally {
      if (timer) clearTimeout(timer);
      if (userSignal && forwardUserAbort) {
        userSignal.removeEventListener('abort', forwardUserAbort);
      }
    }
  };

  try {
    const first = await runOnce();
    if (userSignal?.aborted) return first;
    if (allowRetry && isTransientHttpStatus(first.status)) {
      await sleep(400);
      return runOnce();
    }
    return first;
  } catch (e) {
    if (userSignal?.aborted || isUserAbort(e)) throw e;
    if (allowRetry) {
      await sleep(400);
      return runOnce();
    }
    throw e;
  }
}
