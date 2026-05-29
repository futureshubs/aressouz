import { aressoMainIconSrc } from './aressoBrandAssets';

type RouteBrand = {
  prefix: string;
  title: string;
  /** Panelga xos yoki null = asosiy kun/tun ikonka */
  icon?: string;
  appleTitle?: string;
};

const DEFAULT_TITLE = 'ARESSO';

const ROUTE_BRANDS: RouteBrand[] = [
  { prefix: '/kuryer', title: 'Kuryer — ARESSO', icon: '/icons/icon-kuryer.png', appleTitle: 'Kuryer' },
  { prefix: '/avtokuryer', title: 'Avtokuryer — ARESSO', icon: '/icons/icon-kuryer.png', appleTitle: 'Avtokuryer' },
  {
    prefix: '/tayyorlovchi',
    title: 'Tayyorlovchi — ARESSO',
    icon: '/icons/icon-tayyorlovchi.png',
    appleTitle: 'Tayyorlovchi',
  },
  { prefix: '/seller', title: 'Seller — ARESSO', appleTitle: 'Seller' },
  { prefix: '/restaurant', title: 'Taom — ARESSO', appleTitle: 'Taom' },
  { prefix: '/filyal', title: 'Filial — ARESSO', appleTitle: 'Filial' },
  { prefix: '/admin', title: 'Admin — ARESSO', appleTitle: 'Admin' },
];

function resolveBrand(pathname: string, isDark: boolean): RouteBrand & { icon: string } {
  const hit = ROUTE_BRANDS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));

  if (hit) {
    return {
      ...hit,
      icon: hit.icon ?? aressoMainIconSrc(isDark),
    };
  }

  return {
    prefix: '/',
    title: DEFAULT_TITLE,
    icon: aressoMainIconSrc(isDark),
    appleTitle: DEFAULT_TITLE,
  };
}

function setLinkRel(rel: string, href: string) {
  const selector =
    rel === 'icon' ? 'link[rel="icon"], link[rel~="icon"]' : `link[rel="${rel}"]`;
  const nodes = document.querySelectorAll(selector) as NodeListOf<HTMLLinkElement>;
  const next = href.split('?')[0];

  if (nodes.length === 0) {
    const el = document.createElement('link');
    el.rel = rel;
    el.setAttribute('href', `${next}?v=${Date.now()}`);
    document.head.appendChild(el);
    return;
  }

  nodes.forEach((el) => {
    if (el.getAttribute('href')?.split('?')[0] !== next) {
      el.setAttribute('href', `${next}?v=${Date.now()}`);
    }
  });
}

function setMetaName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  if (el.getAttribute('content') !== content) {
    el.setAttribute('content', content);
  }
}

/** Brauzer tab / PWA: sarlavha va favicon (yo‘l + kun/tun). */
export function applyDocumentBrand(pathname: string, isDark: boolean): void {
  if (typeof document === 'undefined') return;

  const brand = resolveBrand(pathname, isDark);
  if (document.title !== brand.title) {
    document.title = brand.title;
  }

  setLinkRel('icon', brand.icon);
  setLinkRel('apple-touch-icon', brand.icon);
  setMetaName('application-name', brand.appleTitle || brand.title);
  setMetaName('apple-mobile-web-app-title', brand.appleTitle || DEFAULT_TITLE);
}
