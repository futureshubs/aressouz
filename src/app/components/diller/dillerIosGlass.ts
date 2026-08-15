/** iOS liquid glass — yengil chuqurlik, oshirilmagan */
import type { CSSProperties } from 'react';

/** Rangli / gradient sirt ustidagi matn va ikon — doim oq */
export const DILLER_ON_ACCENT = '#ffffff';

export function iosGlassPageSurface(isDark: boolean): CSSProperties {
  return {
    background: isDark ? '#000' : '#f4f4f5',
    color: isDark ? '#fff' : '#0f172a',
  };
}

export function iosGlassCardStyle(isDark: boolean): CSSProperties {
  return {
    background: isDark ? 'rgba(28, 28, 30, 0.55)' : 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: isDark ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(255,255,255,0.85)',
    boxShadow: isDark
      ? '0 6px 20px rgba(0,0,0,0.28), inset 0 0.5px 0 rgba(255,255,255,0.10)'
      : '0 4px 14px rgba(15,23,42,0.06), inset 0 0.5px 0 rgba(255,255,255,0.9)',
  };
}

export function iosGlassTintStyle(isDark: boolean, tint: string): CSSProperties {
  return {
    ...iosGlassCardStyle(isDark),
    background: isDark ? `${tint}22` : `${tint}16`,
    border: isDark ? `0.5px solid ${tint}44` : `0.5px solid ${tint}33`,
  };
}

export function iosGlassInputStyle(isDark: boolean): CSSProperties {
  return {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(16px) saturate(170%)',
    WebkitBackdropFilter: 'blur(16px) saturate(170%)',
    border: isDark ? '0.5px solid rgba(255,255,255,0.10)' : '0.5px solid rgba(255,255,255,0.9)',
    boxShadow: isDark
      ? 'inset 0 0.5px 0 rgba(255,255,255,0.06)'
      : 'inset 0 1px 2px rgba(15,23,42,0.04)',
  };
}

/** To‘liq ekran sheet — orqa kontent shaffof ko‘rinadi */
export function iosGlassPageStyle(isDark: boolean): CSSProperties {
  return {
    background: isDark ? 'rgba(8, 8, 10, 0.58)' : 'rgba(244, 244, 245, 0.72)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  };
}

export function iosGlassBarStyle(isDark: boolean): CSSProperties {
  return {
    background: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(20px) saturate(170%)',
    WebkitBackdropFilter: 'blur(20px) saturate(170%)',
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
    borderBottom: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(15,23,42,0.06)',
    boxShadow: 'none',
  };
}

/** Gradient tugma / chip — oq matn, yengil soya */
export function iosAccentFillStyle(gradient: string, accentHex: string): CSSProperties {
  return {
    background: gradient,
    color: DILLER_ON_ACCENT,
    boxShadow: `0 4px 12px ${accentHex}28`,
  };
}
