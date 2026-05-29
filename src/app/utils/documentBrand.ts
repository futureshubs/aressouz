import { ARESSO_PANEL_LOGO_SRC } from '../components/brand/AressoPanelBrand';

type RouteBrand = {
  prefix: string;
  title: string;
  icon: string;
  appleTitle?: string;
};

const DEFAULT_TITLE = 'ARESSO';
const DEFAULT_ICON = '/icons/icon-192.png';

const ROUTE_BRANDS: RouteBrand[] = [
  { prefix: '/kuryer', title: 'Kuryer — ARESSO', icon: '/icons/icon-kuryer.png', appleTitle: 'Kuryer' },
  { prefix: '/avtokuryer', title: 'Avtokuryer — ARESSO', icon: '/icons/icon-kuryer.png', appleTitle: 'Avtokuryer' },
  { prefix: '/tayyorlovchi', title: 'Tayyorlovchi — ARESSO', icon: '/icons/icon-tayyorlovchi.png', appleTitle: 'Tayyorlovchi' },
  { prefix: '/seller', title: 'Seller — ARESSO', icon: ARESSO_PANEL_LOGO_SRC.seller, appleTitle: 'Seller' },
  { prefix: '/restaurant', title: 'Taom — ARESSO', icon: ARESSO_PANEL_LOGO_SRC.taom, appleTitle: 'Taom' },
  { prefix: '/filyal', title: 'Filial — ARESSO', icon: DEFAULT_ICON, appleTitle: 'Filial' },
  { prefix: '/admin', title: 'Admin — ARESSO', icon: DEFAULT_ICON, appleTitle: 'Admin' },
];

function resolveBrand(pathname: string): RouteBrand {
  const hit = ROUTE_BRANDS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (hit) return hit;
  return { prefix: '/', title: DEFAULT_TITLE, icon: DEFAULT_ICON, appleTitle: DEFAULT_TITLE };
}

function setLinkRel(rel: string, href: string) {
  const selector =
    rel === 'icon'
      ? 'link[rel="icon"], link[rel~="icon"]'
      : `link[rel="${rel}"]`;
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  const next = href.split('?')[0];
  if (el.getAttribute('href')?.split('?')[0] !== next) {
    el.setAttribute('href', `${next}?v=${Date.now()}`);
  }
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

/** Brauzer tab / PWA: sarlavha va favicon (panel yo‘liga qarab). */
export function applyDocumentBrand(pathname: string): void {
  if (typeof document === 'undefined') return;

  const brand = resolveBrand(pathname);
  if (document.title !== brand.title) {
    document.title = brand.title;
  }

  setLinkRel('icon', brand.icon);
  setLinkRel('apple-touch-icon', brand.icon);
  setMetaName('application-name', brand.appleTitle || brand.title);
  setMetaName('apple-mobile-web-app-title', brand.appleTitle || DEFAULT_TITLE);
}
