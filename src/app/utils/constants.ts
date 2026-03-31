// Application constants

// Animation durations (ms)
export const ANIMATION = {
  FAST: 150,
  NORMAL: 200,
  SLOW: 300,
  EXTRA_SLOW: 500,
} as const;

// Z-index layers
export const Z_INDEX = {
  BASE: 0,
  DROPDOWN: 10,
  STICKY: 20,
  FIXED: 30,
  MODAL_BACKDROP: 50,
  MODAL: 60,
  POPOVER: 70,
  TOOLTIP: 80,
} as const;

// Breakpoints (px)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
} as const;

// Modal max heights
export const MODAL = {
  MAX_HEIGHT: '85vh',
  CONTENT_HEIGHT: 'calc(85vh - 80px)',
} as const;

// Product card dimensions
export const PRODUCT_CARD = {
  IMAGE_HEIGHT: 200,
  BORDER_RADIUS: {
    IOS: '16px',
    ANDROID: '12px',
  },
} as const;

// Common transitions
export const TRANSITIONS = {
  ALL: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  TRANSFORM: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  OPACITY: 'opacity 0.2s ease-in-out',
  COLORS: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out',
} as const;

// Shadow presets
export const SHADOWS = {
  SM: '0 1px 2px rgba(0, 0, 0, 0.05)',
  MD: '0 4px 6px rgba(0, 0, 0, 0.1)',
  LG: '0 10px 15px rgba(0, 0, 0, 0.1)',
  XL: '0 20px 25px rgba(0, 0, 0, 0.15)',
} as const;
