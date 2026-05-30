/** E2E: production yoki PLAYWRIGHT_API_BASE_URL ga so‘rovlar */

export const API_BASE =
  (process.env.PLAYWRIGHT_API_BASE_URL || '').trim() ||
  'https://wnondmqmuvjugbomyolz.supabase.co/functions/v1/make-server-27d0d16c';

export const ANON_KEY =
  (process.env.PLAYWRIGHT_SUPABASE_ANON_KEY || '').trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indub25kbXFtdXZqdWdib215b2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTE3NzQsImV4cCI6MjA4ODQ4Nzc3NH0.7CJOTYZ-NhI9XiyWEGpcBxORx4mmM7jxx0MIJ-lQYSc';

export const SUPPORT_BRANCH_ID =
  (process.env.E2E_SUPPORT_BRANCH_ID || '').trim() || 'aresso_support';

export async function edgeFetch(
  path: string,
  init: RequestInit & { accessToken?: string; branchToken?: string } = {},
) {
  const { accessToken, branchToken, ...rest } = init;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${ANON_KEY}`,
    ...(rest.headers as Record<string, string>),
  };
  if (accessToken) {
    headers['X-Access-Token'] = accessToken;
  }
  if (branchToken) {
    headers['X-Branch-Token'] = branchToken;
    headers['X-Staff-Token'] = branchToken;
  }
  const url = `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, { ...rest, headers });
}
