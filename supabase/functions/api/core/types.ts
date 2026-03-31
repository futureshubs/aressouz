/**
 * Core type definitions for the API edge functions
 * Provides comprehensive TypeScript interfaces for all data structures
 */

// ============================================================================
// User and Authentication Types
// ============================================================================

export interface User {
  id: string;
  email?: string;
  phone: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other';
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  type: 'user' | 'seller' | 'admin' | 'branch' | 'restaurant' | 'preparer';
  permissions: Permission[];
}

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

export interface UserPreferences {
  language: 'uz' | 'ru' | 'en';
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

// ============================================================================
// SMS Verification Types
// ============================================================================

export interface SMSVerification {
  id: string;
  phone: string;
  code: string;
  attempts: number;
  expiresAt: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SMSRequest {
  phone: string;
  purpose: 'signin' | 'signup' | 'password_reset';
}

export interface SMSVerificationRequest {
  phone: string;
  code: string;
  purpose: 'signin' | 'signup' | 'password_reset';
  userData?: Partial<User>;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string; // Only in development
}

export interface ResponseMeta {
  pagination?: PaginationMeta;
  timestamp: string;
  requestId: string;
  version: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// Request/Response Context Types
// ============================================================================

export interface RequestContext {
  id: string;
  method: string;
  path: string;
  url: string;
  headers: Record<string, string>;
  userAgent?: string;
  ip?: string;
  userId?: string;
  timestamp: string;
}

export interface MiddlewareContext {
  req: RequestContext;
  config: any;
  logger: Logger;
  startTime: number;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'phone' | 'url' | 'date';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  custom?: (value: any) => boolean | string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: RequestContext) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// ============================================================================
// Logging Types
// ============================================================================

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  requestId: string;
  userId?: string;
  meta?: any;
  error?: {
    name: string;
    message: string;
    stack: string;
  };
}

// ============================================================================
// Database Types
// ============================================================================

export interface DatabaseError extends Error {
  code: string;
  details?: any;
  hint?: string;
}

export interface QueryOptions {
  select?: string;
  filters?: Record<string, any>;
  orderBy?: {
    column: string;
    ascending?: boolean;
  };
  limit?: number;
  offset?: number;
}

// ============================================================================
// Product/Marketplace Types (for future expansion)
// ============================================================================

export interface Product {
  id: string;
  type: 'car' | 'house' | 'service' | 'rental' | 'restaurant' | 'place' | 'store';
  categoryId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  specifications: Record<string, any>;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  ownerId: string;
  status: 'active' | 'inactive' | 'pending' | 'sold';
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  image: string;
  icon: string;
  parentId?: string;
  productCount: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type ApiResponseHandler<T = any> = (
  context: MiddlewareContext
) => Promise<ApiResponse<T>>;

export type MiddlewareFunction = (
  context: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void>;
