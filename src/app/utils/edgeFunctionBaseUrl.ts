import { API_BASE_URL, DEV_API_BASE_URL } from '../../../utils/supabase/info';

function isLocalhostHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]'
  );
}

/**
 * Edge Function bazaviy URL:
 * - **Dev (localhost):** Vite `server.proxy` → `supabase.co` (CORS / tarmoq muammolaridan qochish).
 * - **Production (Vercel):** `vercel.json` rewrite — brauzer `sizning-domen.uz/functions/v1/...` ga uradi,
 *   server Supabase’ga proxylaydi; `ERR_CONNECTION_CLOSED` (to‘g‘ridan-to‘g‘ri supabase.co) kamayadi.
 * - **vite preview / SSR:** to‘g‘ridan `API_BASE_URL`.
 * Majburiy to‘g‘ri URL: `.env` da `VITE_EDGE_FUNCTIONS_DIRECT=true`.
 */
export function edgeFunctionBaseUrl(): string {
  if (import.meta.env.VITE_EDGE_FUNCTIONS_DIRECT === 'true') {
    return API_BASE_URL;
  }

  if (typeof window === 'undefined') {
    return API_BASE_URL;
  }

  const { origin, hostname } = window.location;
  const local = isLocalhostHost(hostname);

  if (import.meta.env.DEV && local) {
    return `${origin}${DEV_API_BASE_URL}`;
  }

  if (import.meta.env.PROD && !local) {
    return `${origin}${DEV_API_BASE_URL}`;
  }

  return API_BASE_URL;
}
