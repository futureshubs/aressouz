/** Diller panel: bitta asosiy scroll, mobil qotishlarni oldini olish */

export const DILLER_VIEWPORT_HEIGHT = 'var(--app-viewport-height, 100dvh)';

export const DILLER_NAV_BOTTOM_PADDING =
  'calc(6.25rem + var(--app-safe-bottom, 0px))';

export const dillerPageShellClass =
  'flex flex-col h-[var(--app-viewport-height,100dvh)] max-h-[var(--app-viewport-height,100dvh)] min-h-0 overflow-hidden';

export const dillerMainScrollClass =
  'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y';

export const dillerSheetShellClass =
  'fixed inset-0 z-[110] flex flex-col min-h-0 h-[100dvh] max-h-[100dvh] overflow-hidden app-safe-pad';

export const dillerSheetScrollClass =
  'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y';

/** Tab ichidagi ro‘yxatlar — alohida scroll yo‘q, asosiy main scroll */
export const dillerListClass = 'space-y-3';

export const dillerTabContentClass = 'space-y-4 pb-6';
