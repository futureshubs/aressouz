import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;
const SESSION_PREFIX = 'aresso:portfolio-view:';

async function fetchPortfolioViews(portfolioId: string): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/portfolios/${encodeURIComponent(portfolioId)}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return Number(data?.portfolio?.views) || 0;
  } catch {
    return null;
  }
}

/** Portfolio ochilganda ko‘rishlar sonini oshiradi (sessiyada bir marta; egasi ko‘rganida +1 emas). */
export async function recordPortfolioView(
  portfolioId: string,
  opts: { viewerUserId?: string; portfolioUserId?: string } = {},
): Promise<number | null> {
  if (!portfolioId) return null;

  const isOwner =
    Boolean(opts.viewerUserId) &&
    Boolean(opts.portfolioUserId) &&
    opts.viewerUserId === opts.portfolioUserId;

  if (isOwner) {
    return fetchPortfolioViews(portfolioId);
  }

  let alreadyCounted = false;
  try {
    alreadyCounted = sessionStorage.getItem(`${SESSION_PREFIX}${portfolioId}`) === '1';
  } catch {
    /* private mode */
  }

  if (alreadyCounted) {
    return fetchPortfolioViews(portfolioId);
  }

  try {
    const res = await fetch(`${API_BASE}/portfolios/${encodeURIComponent(portfolioId)}/view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    if (!res.ok) {
      return fetchPortfolioViews(portfolioId);
    }
    const data = await res.json().catch(() => ({}));
    try {
      sessionStorage.setItem(`${SESSION_PREFIX}${portfolioId}`, '1');
    } catch {
      /* ignore */
    }
    return Number(data?.views) || 0;
  } catch {
    return fetchPortfolioViews(portfolioId);
  }
}
