import type { ReactNode } from 'react';

function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type PaymentMethodLogoFrameProps = {
  brandColor: string;
  isDark: boolean;
  children: ReactNode;
  className?: string;
  /** Oq fonli PNG — dark temada ichkariga yumshoq fon, chekka «yopishadi» */
  softLightBackdrop?: boolean;
  /**
   * To‘lov qatori ichida: tashqi padding 0, balandlik qator bo‘yicha cho‘ziladi,
   * chap chekka rounded-xl bilan yopishadi (tashqi tugma overflow-hidden).
   */
  embedInRow?: boolean;
};

/**
 * To‘lov logotiplari: ramka kontentga yaqin, rasm balandlik bo‘yicha to‘ldirib ko‘rinadi (contain).
 */
export function PaymentMethodLogoFrame({
  brandColor,
  isDark,
  children,
  className = '',
  softLightBackdrop = false,
  embedInRow = false,
}: PaymentMethodLogoFrameProps) {
  const border = withAlpha(brandColor, isDark ? 0.55 : 0.42);
  const glow = withAlpha(brandColor, isDark ? 0.32 : 0.18);
  const bgTop = withAlpha(brandColor, isDark ? 0.26 : 0.1);
  const bgMid = withAlpha(brandColor, isDark ? 0.1 : 0.06);

  const innerPad =
    embedInRow && softLightBackdrop && isDark
      ? '2px 6px'
      : embedInRow
        ? '0 4px'
        : softLightBackdrop && isDark
          ? '3px 7px'
          : '0 5px';
  const innerBg =
    softLightBackdrop && isDark ? 'rgba(255,255,255,0.09)' : 'transparent';
  const innerRadius = embedInRow ? '6px' : softLightBackdrop ? '10px' : '4px';

  const xl = '0.75rem';

  return (
    <div
      className={`inline-flex shrink-0 items-stretch ${embedInRow ? 'h-full min-h-[52px] self-stretch' : ''} ${className}`}
      style={{
        padding: embedInRow ? 0 : '3px 5px',
        borderRadius: embedInRow ? 0 : '1rem',
        borderTopLeftRadius: embedInRow ? xl : undefined,
        borderBottomLeftRadius: embedInRow ? xl : undefined,
        borderTopRightRadius: embedInRow ? 0 : undefined,
        borderBottomRightRadius: embedInRow ? 0 : undefined,
        border: `2px solid ${border}`,
        borderRight: embedInRow ? `1px solid ${withAlpha(brandColor, isDark ? 0.35 : 0.25)}` : undefined,
        background: isDark
          ? `linear-gradient(168deg, ${bgTop} 0%, ${bgMid} 55%, rgba(0,0,0,0.22) 100%)`
          : `linear-gradient(168deg, #ffffff 0%, ${bgTop} 38%, ${bgMid} 100%)`,
        boxShadow: embedInRow
          ? `inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)'}`
          : `
          0 8px 22px ${glow},
          0 2px 8px rgba(0,0,0,0.06),
          inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)'}
        `,
      }}
    >
      <div
        className="flex items-center justify-center leading-none"
        style={{
          height: embedInRow ? '100%' : 44,
          minHeight: embedInRow ? '100%' : 44,
          maxWidth: embedInRow ? 'min(104px, 28vw)' : 'min(212px, 56vw)',
          minWidth: embedInRow ? 56 : 0,
          padding: innerPad,
          background: innerBg,
          borderRadius: innerRadius,
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  );
}
