import { Link } from 'react-router';
import {
  Truck,
  ShieldCheck,
  Headphones,
  Instagram,
  Send,
  Facebook,
  Package,
  Store,
  UtensilsCrossed,
  Building2,
  Gavel,
  MapPinned,
  ShoppingBag,
  UserRound,
  FileText,
  Mail,
  ChevronDown,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { siteSocial, siteSupportEmail } from '../config/site';

interface SiteFooterProps {
  onNavigateTab: (tab: string) => void;
}

const linkClass =
  'text-xs md:text-sm text-muted-foreground transition-colors hover:[color:var(--accent-color)] text-left w-full min-w-0 sm:w-auto inline-flex items-center gap-1.5';

function AccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-border/60 dark:border-white/10 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between py-2.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/90 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="pb-3 pt-0">{children}</div>
    </details>
  );
}

export function SiteFooter({ onNavigateTab }: SiteFooterProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const goTab = (tab: string) => {
    onNavigateTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const iconSm = 'size-3 shrink-0 opacity-70 md:size-3.5';

  const bollimlarLinks = (
    <ul className="space-y-1.5 md:space-y-2.5">
      <li>
        <button type="button" onClick={() => goTab('market')} className={linkClass}>
          <Package className={iconSm} aria-hidden />
          Market
        </button>
      </li>
      <li>
        <button type="button" onClick={() => goTab('dokon')} className={linkClass}>
          <Store className={iconSm} aria-hidden />
          Do‘kon
        </button>
      </li>
      <li>
        <button type="button" onClick={() => goTab('taomlar')} className={linkClass}>
          <UtensilsCrossed className={iconSm} aria-hidden />
          Taomlar
        </button>
      </li>
      <li>
        <button type="button" onClick={() => goTab('ijara')} className={linkClass}>
          <Building2 className={iconSm} aria-hidden />
          Ijara
        </button>
      </li>
      <li>
        <button type="button" onClick={() => goTab('auksion')} className={linkClass}>
          <Gavel className={iconSm} aria-hidden />
          Auksion
        </button>
      </li>
      <li>
        <button type="button" onClick={() => goTab('atrof')} className={linkClass}>
          <MapPinned className={iconSm} aria-hidden />
          Atrofda
        </button>
      </li>
    </ul>
  );

  const xaridLinks = (
    <ul className="space-y-1.5 md:space-y-2.5">
      <li>
        <Link to="/orders" className={linkClass}>
          <ShoppingBag className={iconSm} aria-hidden />
          Mening buyurtmalarim
        </Link>
      </li>
      <li>
        <button type="button" onClick={() => goTab('profile')} className={linkClass}>
          <UserRound className={iconSm} aria-hidden />
          Profil
        </button>
      </li>
      <li>
        <span className={`${linkClass} cursor-default opacity-80`}>
          <Truck className={iconSm} aria-hidden />
          Yetkazib berish
        </span>
      </li>
      <li>
        <span className={`${linkClass} cursor-default opacity-80`}>
          <FileText className={iconSm} aria-hidden />
          Qaytarish
        </span>
      </li>
      <li>
        <span className={`${linkClass} cursor-default opacity-80`}>
          <ShieldCheck className={iconSm} aria-hidden />
          Kafolat
        </span>
      </li>
    </ul>
  );

  const kompaniyaLinks = (
    <ul className="space-y-1.5 md:space-y-2.5">
      <li>
        <Link to="/docs/about" className={linkClass}>
          Biz haqimizda
        </Link>
      </li>
      <li>
        <Link to="/docs/partnership" className={linkClass}>
          Hamkorlik
        </Link>
      </li>
      <li>
        <Link to="/docs/careers" className={linkClass}>
          Vakansiyalar
        </Link>
      </li>
      <li>
        <a href={`mailto:${siteSupportEmail}`} className={linkClass}>
          <Mail className={iconSm} aria-hidden />
          Bog‘lanish
        </a>
      </li>
    </ul>
  );

  const socialButtons = (
    <ul className="flex flex-wrap gap-1.5 md:gap-2">
      <li>
        <a
          href={siteSocial.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center size-9 md:size-10 rounded-lg md:rounded-xl transition-colors border ${
            isDark
              ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white/90'
              : 'border-border bg-background hover:bg-muted text-foreground'
          }`}
          aria-label="Instagram"
        >
          <Instagram className="size-3.5 md:size-4" />
        </a>
      </li>
      <li>
        <a
          href={siteSocial.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center size-9 md:size-10 rounded-lg md:rounded-xl transition-colors border ${
            isDark
              ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white/90'
              : 'border-border bg-background hover:bg-muted text-foreground'
          }`}
          aria-label="Telegram"
        >
          <Send className="size-3.5 md:size-4" />
        </a>
      </li>
      <li>
        <a
          href={siteSocial.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center size-9 md:size-10 rounded-lg md:rounded-xl transition-colors border ${
            isDark
              ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white/90'
              : 'border-border bg-background hover:bg-muted text-foreground'
          }`}
          aria-label="Facebook"
        >
          <Facebook className="size-3.5 md:size-4" />
        </a>
      </li>
    </ul>
  );

  return (
    <footer
      className={`mt-6 sm:mt-10 md:mt-16 lg:mt-20 border-t overflow-x-hidden ${
        isDark ? 'bg-black/40 border-white/10' : 'bg-muted/30 border-border'
      }`}
      style={{ paddingBottom: 'max(0.5rem, var(--app-safe-bottom, 0px))' }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 md:py-10 lg:py-12">
        {/* Mobil / ixcham: qisqa sarlavha + ishonch */}
        <div className="md:hidden mb-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-foreground">Aresso</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[color:var(--accent-color)]/15 text-[color:var(--accent-color)]">
              Marketplace
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
            Mahsulotlar, do‘konlar, taom va xizmatlar — bitta ilovada.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-medium ${
                isDark ? 'bg-white/5 text-white/75' : 'bg-background text-foreground/80 border border-border'
              }`}
              title="Yetkazib berish"
            >
              <Truck className="size-2.5 shrink-0 text-[color:var(--accent-color)]" aria-hidden />
              Yetkazib
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-medium ${
                isDark ? 'bg-white/5 text-white/75' : 'bg-background text-foreground/80 border border-border'
              }`}
              title="Xavfsiz to‘lov"
            >
              <ShieldCheck className="size-2.5 shrink-0 text-[color:var(--accent-color)]" aria-hidden />
              To‘lov
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-medium ${
                isDark ? 'bg-white/5 text-white/75' : 'bg-background text-foreground/80 border border-border'
              }`}
              title="Qo‘llab-quvvatlash"
            >
              <Headphones className="size-2.5 shrink-0 text-[color:var(--accent-color)]" aria-hidden />
              Yordam
            </span>
          </div>
        </div>

        {/* Mobil: akkordeon — balandlik iqtisod */}
        <nav className="md:hidden mt-2 -mx-0.5" aria-label="Sayt pastki navigatsiyasi">
          <AccordionSection title="Bo‘limlar">{bollimlarLinks}</AccordionSection>
          <AccordionSection title="Xarid">{xaridLinks}</AccordionSection>
          <AccordionSection title="Kompaniya">{kompaniyaLinks}</AccordionSection>
          <div className="py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/90 mb-2">
              Ijtimoiy
            </p>
            {socialButtons}
          </div>
        </nav>

        {/* Desktop / planshet */}
        <div className="hidden md:flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 lg:gap-12 pb-8 lg:pb-10 border-b border-border/80 dark:border-white/10">
          <div className="max-w-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">Aresso</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[color:var(--accent-color)]/15 text-[color:var(--accent-color)]">
                Marketplace
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Mahsulotlar, onlayn do‘konlar, taomlar, ijara va xizmatlar — barchasi bitta platformada.
              Tezkor buyurtma, xavfsiz to‘lov va filial bilan chat.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                  isDark ? 'bg-white/5 text-white/80' : 'bg-background/80 text-foreground/80 border border-border shadow-sm'
                }`}
              >
                <Truck className="size-3.5 shrink-0 text-[color:var(--accent-color)]" aria-hidden />
                Yetkazib berish
              </div>
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                  isDark ? 'bg-white/5 text-white/80' : 'bg-background/80 text-foreground/80 border border-border shadow-sm'
                }`}
              >
                <ShieldCheck className="size-3.5 shrink-0 text-[color:var(--accent-color)]" aria-hidden />
                Xavfsiz to‘lov
              </div>
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                  isDark ? 'bg-white/5 text-white/80' : 'bg-background/80 text-foreground/80 border border-border shadow-sm'
                }`}
              >
                <Headphones className="size-3.5 shrink-0 text-[color:var(--accent-color)]" aria-hidden />
                Qo‘llab-quvvatlash
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-10 flex-1 lg:justify-end min-w-0">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/90 mb-4">
                Bo‘limlar
              </h3>
              {bollimlarLinks}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/90 mb-4">Xarid</h3>
              {xaridLinks}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/90 mb-4">
                Kompaniya
              </h3>
              {kompaniyaLinks}
            </div>
            <div className="col-span-2 lg:col-span-1 min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/90 mb-4">
                Ijtimoiy tarmoqlar
              </h3>
              <p className="text-xs text-muted-foreground mb-4 max-w-[220px] hidden lg:block">
                Yangiliklar va aksiyalar — ijtimoiy tarmoqlarda kuzatib boring.
              </p>
              {socialButtons}
            </div>
          </div>
        </div>

        <div
          className={`mt-2 pt-3 border-t border-border/60 dark:border-white/10 md:mt-0 md:border-t-0 md:pt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4`}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] md:text-xs text-muted-foreground">
            <span className="shrink-0">© {new Date().getFullYear()} Aresso</span>
            <span className="hidden sm:inline text-border dark:text-white/20" aria-hidden>
              ·
            </span>
            <Link to="/docs/privacy" className="shrink-0 hover:[color:var(--accent-color)] transition-colors">
              Maxfiylik
            </Link>
            <span className="text-border/80 dark:text-white/15">·</span>
            <Link to="/docs/terms" className="shrink-0 hover:[color:var(--accent-color)] transition-colors">
              Shartlar
            </Link>
            <span className="text-border/80 dark:text-white/15">·</span>
            <Link to="/docs/cookies" className="shrink-0 hover:[color:var(--accent-color)] transition-colors">
              Cookie
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
              To‘lov
            </span>
            {['Payme', 'Click', 'Uzcard', 'Humo'].map((name) => (
              <span
                key={name}
                className={`text-[9px] md:text-[10px] font-semibold px-1.5 py-0.5 md:px-2 md:py-1 rounded ${
                  isDark ? 'bg-white/5 text-white/70' : 'bg-muted text-muted-foreground'
                }`}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
