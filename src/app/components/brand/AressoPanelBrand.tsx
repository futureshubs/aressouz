import type { CSSProperties } from 'react';
import {
  aressoMainLogoSrc,
  isAressoMainBrandVariant,
} from '../../utils/aressoBrandAssets';

export type AressoPanelVariant = 'seller' | 'taom' | 'kuryer' | 'tayyorlovchi' | 'system';

/** Panelga xos logolar (kun/tun alohida emas) */
export const ARESSO_PANEL_LOGO_SRC: Record<AressoPanelVariant, string> = {
  system: aressoMainLogoSrc(false),
  seller: aressoMainLogoSrc(false),
  taom: aressoMainLogoSrc(false),
  kuryer: '/branding/aresso-kuryer.png',
  tayyorlovchi: '/branding/aresso-tayyorlovchi.png',
};

export function resolveAressoPanelLogoSrc(
  variant: AressoPanelVariant,
  isDark: boolean,
  override?: string,
): string {
  if (override) return override;
  if (isAressoMainBrandVariant(variant)) return aressoMainLogoSrc(isDark);
  return ARESSO_PANEL_LOGO_SRC[variant];
}

const PANEL_LABEL: Record<AressoPanelVariant, string> = {
  system: 'Aresso',
  seller: 'Seller Panel',
  taom: 'Taom Panel',
  kuryer: 'Kuryer Panel',
  tayyorlovchi: 'Tayyorlovchi Panel',
};

const SIZE_MAP = {
  xs: { img: 28, pad: 'p-1.5', rounded: 'rounded-xl' },
  sm: { img: 40, pad: 'p-2', rounded: 'rounded-xl' },
  md: { img: 56, pad: 'p-3', rounded: 'rounded-2xl' },
  lg: { img: 80, pad: 'p-4', rounded: 'rounded-2xl' },
  xl: { img: 112, pad: 'p-5', rounded: 'rounded-3xl' },
} as const;

type Size = keyof typeof SIZE_MAP;

type Props = {
  variant: AressoPanelVariant;
  /** Do‘kon / restoran / kuryer nomi */
  title?: string;
  /** Qator ostidagi izoh */
  subtitle?: string;
  /** Panel nomi (Seller Panel va h.k.) */
  panelLabel?: string;
  showPanelLabel?: boolean;
  /** Alohida logo URL (keyin alohida fayl berilganda) */
  logoSrc?: string;
  size?: Size;
  layout?: 'stack' | 'row';
  align?: 'left' | 'center';
  className?: string;
  isDark?: boolean;
  accentColor?: string;
};

export default function AressoPanelBrand({
  variant,
  title,
  subtitle,
  panelLabel,
  showPanelLabel = true,
  logoSrc,
  size = 'md',
  layout = 'stack',
  align = 'center',
  className = '',
  isDark = true,
  accentColor = '#14b8a6',
}: Props) {
  const s = SIZE_MAP[size];
  const src = resolveAressoPanelLogoSrc(variant, isDark, logoSrc);
  const label = panelLabel ?? PANEL_LABEL[variant];
  const alignCls = align === 'center' ? 'items-center text-center' : 'items-start text-left';
  const rowCls = layout === 'row' ? 'flex-row gap-3' : 'flex-col gap-2';

  const shellStyle: CSSProperties = {
    background: isDark
      ? `linear-gradient(145deg, ${accentColor}18, rgba(255,255,255,0.04))`
      : `linear-gradient(145deg, ${accentColor}12, rgba(255,255,255,0.95))`,
    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
    boxShadow: isDark ? `0 8px 28px ${accentColor}22` : `0 8px 24px ${accentColor}14`,
  };

  return (
    <div className={`flex min-w-0 ${rowCls} ${alignCls} ${className}`.trim()}>
      <div
        className={`shrink-0 inline-flex ${s.pad} ${s.rounded}`}
        style={shellStyle}
      >
        <img
          src={src}
          alt="Aresso"
          width={s.img}
          height={s.img}
          className="object-contain"
          style={{ width: s.img, height: s.img }}
          decoding="async"
        />
      </div>
      {(title || showPanelLabel || subtitle) ? (
        <div className={`min-w-0 flex flex-col gap-0.5 ${align === 'center' ? 'items-center' : 'items-start'}`}>
          {title ? (
            <p
              className="font-bold leading-tight truncate max-w-full text-sm sm:text-base"
              style={{ color: accentColor }}
            >
              {title}
            </p>
          ) : null}
          {showPanelLabel ? (
            <p
              className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide opacity-70"
              style={{ color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.65)' }}
            >
              {label}
            </p>
          ) : null}
          {subtitle ? (
            <p
              className="text-[10px] sm:text-xs truncate max-w-full"
              style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
