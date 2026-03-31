/**
 * Application Constants and Configuration
 * Production-ready constants for consistent system-wide usage
 */

// ============================================================================
// API CONSTANTS
// ============================================================================

export const API_CONFIG = {
  BASE_URL: (import.meta as any).env?.VITE_API_BASE_URL || 'https://localhost:3000/api/v1',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  RATE_LIMIT_REQUESTS: 100,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
} as const;

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY_EMAIL: '/auth/verify-email',
    VERIFY_PHONE: '/auth/verify-phone',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password',
  },
  
  // Users
  USERS: {
    ME: '/users/me',
    PROFILE: '/users/profile',
    PREFERENCES: '/users/preferences',
    AVATAR: '/users/avatar',
  },
  
  // Listings
  LISTINGS: {
    LIST: '/listings',
    DETAIL: (id: string) => `/listings/${id}`,
    CREATE: '/listings',
    UPDATE: (id: string) => `/listings/${id}`,
    DELETE: (id: string) => `/listings/${id}`,
    LIKE: (id: string) => `/listings/${id}/like`,
    UNLIKE: (id: string) => `/listings/${id}/unlike`,
    VIEWS: (id: string) => `/listings/${id}/views`,
    SHARE: (id: string) => `/listings/${id}/share`,
  },
  
  // Categories
  CATEGORIES: {
    LIST: '/categories',
    DETAIL: (id: string) => `/categories/${id}`,
    BY_TYPE: (type: string) => `/categories/type/${type}`,
  },
  
  // Locations
  LOCATIONS: {
    REGIONS: '/locations/regions',
    DISTRICTS: '/locations/districts',
    SEARCH: '/locations/search',
    NEARBY: '/locations/nearby',
  },
  
  // Media
  MEDIA: {
    UPLOAD: '/media/upload',
    DELETE: (id: string) => `/media/${id}`,
    BULK_DELETE: '/media/bulk-delete',
  },
  
  // Search
  SEARCH: {
    LISTINGS: '/search/listings',
    SUGGESTIONS: '/search/suggestions',
    RECENT: '/search/recent',
    POPULAR: '/search/popular',
  },
  
  // Cart & Orders
  CART: {
    LIST: '/cart',
    ADD: '/cart/add',
    UPDATE: (id: string) => `/cart/${id}`,
    REMOVE: (id: string) => `/cart/${id}`,
    CLEAR: '/cart/clear',
  },
  
  ORDERS: {
    LIST: '/orders',
    DETAIL: (id: string) => `/orders/${id}`,
    CREATE: '/orders',
    CANCEL: (id: string) => `/orders/${id}/cancel`,
  },
  
  // Reviews
  REVIEWS: {
    LIST: (listingId: string) => `/reviews/listing/${listingId}`,
    CREATE: '/reviews',
    UPDATE: (id: string) => `/reviews/${id}`,
    DELETE: (id: string) => `/reviews/${id}`,
    HELPFUL: (id: string) => `/reviews/${id}/helpful`,
  },
  
  // Notifications
  NOTIFICATIONS: {
    LIST: '/notifications',
    MARK_READ: (id: string) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/read-all',
  },
} as const;

// ============================================================================
// STORAGE KEYS
// ============================================================================

export const STORAGE_KEYS = {
  // Authentication
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  
  // Preferences
  THEME: 'theme',
  LANGUAGE: 'language',
  LOCATION: 'location',
  
  // Application State
  CART: 'cart',
  FAVORITES: 'favorites',
  RECENT_SEARCHES: 'recent_searches',
  
  // Performance
  LAST_SYNC: 'last_sync',
  CACHE_VERSION: 'cache_version',
} as const;

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  // General
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Business Logic
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  
  // System
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

// ============================================================================
// SUCCESS MESSAGES
// ============================================================================

export const SUCCESS_MESSAGES = {
  // Authentication
  LOGIN_SUCCESS: 'login_success',
  REGISTER_SUCCESS: 'register_success',
  LOGOUT_SUCCESS: 'logout_success',
  PASSWORD_CHANGED: 'password_changed',
  
  // Profile
  PROFILE_UPDATED: 'profile_updated',
  AVATAR_UPDATED: 'avatar_updated',
  
  // Listings
  LISTING_CREATED: 'listing_created',
  LISTING_UPDATED: 'listing_updated',
  LISTING_DELETED: 'listing_deleted',
  LISTING_LIKED: 'listing_liked',
  
  // Cart & Orders
  ADDED_TO_CART: 'added_to_cart',
  CART_UPDATED: 'cart_updated',
  ORDER_CREATED: 'order_created',
  ORDER_CANCELLED: 'order_cancelled',
  
  // Reviews
  REVIEW_CREATED: 'review_created',
  REVIEW_UPDATED: 'review_updated',
  REVIEW_DELETED: 'review_deleted',
} as const;

// ============================================================================
// VALIDATION RULES
// ============================================================================

export const VALIDATION_RULES = {
  // Text fields
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  TITLE_MIN_LENGTH: 3,
  TITLE_MAX_LENGTH: 100,
  DESCRIPTION_MIN_LENGTH: 10,
  DESCRIPTION_MAX_LENGTH: 2000,
  
  // Contact
  PHONE_MIN_LENGTH: 9,
  PHONE_MAX_LENGTH: 20,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  
  // Numbers
  PRICE_MIN: 0,
  PRICE_MAX: 999999999,
  RATING_MIN: 1,
  RATING_MAX: 5,
  YEAR_MIN: 1900,
  YEAR_MAX: new Date().getFullYear() + 1,
  
  // Files
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
  MAX_IMAGES_PER_LISTING: 10,
  MAX_VIDEOS_PER_LISTING: 3,
} as const;

// ============================================================================
// PAGINATION
// ============================================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const;

// ============================================================================
// CACHE SETTINGS
// ============================================================================

export const CACHE_CONFIG = {
  // TTL in seconds
  USER_PROFILE: 300, // 5 minutes
  CATEGORIES: 3600, // 1 hour
  LISTINGS: 600, // 10 minutes
  SEARCH_RESULTS: 300, // 5 minutes
  LOCATIONS: 7200, // 2 hours
  
  // Cache keys
  PREFIX: 'app_cache_',
  VERSION: 'v1',
} as const;

// ============================================================================
// NOTIFICATION SETTINGS
// ============================================================================

export const NOTIFICATION_CONFIG = {
  // Durations in milliseconds
  SUCCESS_DURATION: 3000,
  ERROR_DURATION: 5000,
  WARNING_DURATION: 4000,
  INFO_DURATION: 3000,
  
  // Limits
  MAX_NOTIFICATIONS: 5,
  MAX_QUEUE_SIZE: 20,
  
  // Positions
  POSITION: 'top-right' as const,
} as const;

// ============================================================================
// THEME CONFIGURATION
// ============================================================================

export const THEME_CONFIG = {
  DEFAULT: 'light',
  STORAGE_KEY: STORAGE_KEYS.THEME,
  
  COLORS: {
    PRIMARY: '#14b8a6',
    SECONDARY: '#64748b',
    ACCENT: '#f59e0b',
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    INFO: '#3b82f6',
  },
  
  BREAKPOINTS: {
    SM: '640px',
    MD: '768px',
    LG: '1024px',
    XL: '1280px',
    '2XL': '1536px',
  },
} as const;

// ============================================================================
// LOCALIZATION
// ============================================================================

export const LOCALIZATION = {
  DEFAULT_LANGUAGE: 'uz',
  SUPPORTED_LANGUAGES: ['uz', 'ru', 'en'] as const,
  STORAGE_KEY: STORAGE_KEYS.LANGUAGE,
  
  DATE_FORMATS: {
    UZ: 'DD.MM.YYYY',
    RU: 'DD.MM.YYYY',
    EN: 'MM/DD/YYYY',
  },
  
  TIME_FORMATS: {
    UZ: 'HH:mm',
    RU: 'HH:mm',
    EN: 'hh:mm A',
  },
  
  CURRENCIES: {
    USD: {
      symbol: '$',
      position: 'before' as const,
    },
    UZS: {
      symbol: 'UZS',
      position: 'after' as const,
    },
  },
} as const;

// ============================================================================
// BUSINESS RULES
// ============================================================================

export const BUSINESS_RULES = {
  // Listing limits
  MAX_LISTINGS_PER_USER: 50,
  MAX_FAVORITES_PER_USER: 1000,
  
  // Order limits
  MAX_CART_ITEMS: 50,
  MAX_ORDER_VALUE: 10000000, // 10 million
  
  // Review limits
  MIN_DAYS_BETWEEN_REVIEWS: 1,
  MAX_REVIEW_LENGTH: 1000,
  
  // Search limits
  MAX_SEARCH_RESULTS: 1000,
  SEARCH_DEBOUNCE_MS: 300,
  
  // Upload limits
  DAILY_UPLOAD_LIMIT: 100,
  HOURLY_UPLOAD_LIMIT: 10,
} as const;

// ============================================================================
// PERFORMANCE CONFIGURATION
// ============================================================================

export const PERFORMANCE_CONFIG = {
  // Debounce times in milliseconds
  SEARCH_DEBOUNCE: 300,
  INPUT_DEBOUNCE: 200,
  SCROLL_DEBOUNCE: 100,
  
  // Throttle times in milliseconds
  SCROLL_THROTTLE: 16, // ~60fps
  RESIZE_THROTTLE: 100,
  
  // Lazy loading
  LAZY_LOAD_THRESHOLD: 200, // pixels
  PLACEHOLDER_BLUR: 20,
  
  // Animation
  ANIMATION_DURATION: 300,
  TRANSITION_DURATION: 200,
} as const;

// ============================================================================
// DEVELOPMENT CONFIGURATION
// ============================================================================

export const DEV_CONFIG = {
  isDevelopment: (import.meta as any).env?.DEV,
  isProduction: (import.meta as any).env?.PROD,
  isTest: (import.meta as any).env?.MODE === 'test',
  
  // Feature flags
  ENABLE_ANALYTICS: (import.meta as any).env?.VITE_ENABLE_ANALYTICS === 'true',
  ENABLE_LOGGING: (import.meta as any).env?.VITE_ENABLE_LOGGING !== 'false',
  ENABLE_ERROR_REPORTING: (import.meta as any).env?.VITE_ENABLE_ERROR_REPORTING !== 'false',
  
  // Debug settings
  DEBUG_API: (import.meta as any).env?.VITE_DEBUG_API === 'true',
  DEBUG_PERFORMANCE: (import.meta as any).env?.VITE_DEBUG_PERFORMANCE === 'true',
  
  // Mock data
  USE_MOCK_DATA: (import.meta as any).env?.VITE_USE_MOCK_DATA === 'true',
} as const;

// ============================================================================
// ALL CONSTANTS EXPORTED FROM THIS FILE
// ============================================================================
