/**
 * Production-ready TypeScript interfaces for the Online Store API
 * Follows strict typing standards for scalability and maintainability
 */

// ===================================
// Core Domain Types
// ===================================

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface Address {
  regionId: string;
  districtId: string;
  fullAddress: string;
  coordinates?: GeoLocation;
}

// ===================================
// User & Authentication Types
// ===================================

export enum UserRole {
  ADMIN = 'admin',
  BRANCH_MANAGER = 'branch_manager',
  COURIER = 'courier',
  RESTAURANT = 'restaurant',
  SELLER = 'seller',
  CUSTOMER = 'customer',
  BOGALTER = 'bogalter',
  STAFF = 'staff'
}

export interface User extends BaseEntity {
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  profileId?: string;
}

export interface UserProfile extends BaseEntity {
  userId: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginRequest {
  identifier: string; // email or phone
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  preferences?: Partial<UserPreferences>;
}

export interface SmsVerificationRequest {
  phone: string;
  purpose: 'signin' | 'signup' | 'password_reset';
}

export interface SmsVerifyRequest {
  phone: string;
  code: string;
  purpose: 'signin' | 'signup' | 'password_reset';
}

// ===================================
// Region & Location Types
// ===================================

export interface Region extends BaseEntity {
  id: string;
  name: string;
  country: string;
}

export interface District extends BaseEntity {
  id: string;
  regionId: string;
  name: string;
}

// ===================================
// Branch Types
// ===================================

export interface Branch extends BaseEntity {
  id: string;
  name: string;
  branchName: string;
  login: string;
  regionId: string;
  districtId: string;
  phone: string;
  managerName: string;
  coordinates: GeoLocation;
  isActive: boolean;
  managerId?: string;
}

// ===================================
// Product & Catalog Types
// ===================================

export enum BusinessType {
  CARS = 'cars',
  HOUSES = 'houses',
  SERVICES = 'services',
  RENTALS = 'rentals',
  RESTAURANTS = 'restaurants',
  PLACES = 'places',
  STORES = 'stores'
}

export interface Category extends BaseEntity {
  id: string;
  name: string;
  description?: string;
  icon: string;
  image: string;
  businessType: BusinessType;
  count: number;
  parentId?: string;
}

export interface Product extends BaseEntity {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  businessType: BusinessType;
  images: string[];
  price: number;
  currency: 'USD' | 'UZS';
  oldPrice?: number;
  rating: number;
  reviewCount: number;
  location: string;
  coordinates?: GeoLocation;
  ownerName?: string;
  ownerPhone?: string;
  userId?: string;
  regionId: string;
  districtId: string;
  isActive: boolean;
  isFeatured: boolean;
  specifications?: Record<string, any>;
}

// ===================================
// Order Types
// ===================================

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export interface Order extends BaseEntity {
  id: string;
  userId: string;
  branchId?: string;
  restaurantId?: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  currency: 'USD' | 'UZS';
  deliveryAddress: Address;
  deliveryFee?: number;
  tip?: number;
  notes?: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  paymentId?: string;
  courierId?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specifications?: Record<string, any>;
}

export interface CreateOrderRequest {
  items: Omit<OrderItem, 'id' | 'totalPrice'>[];
  deliveryAddress: Address;
  branchId?: string;
  restaurantId?: string;
  notes?: string;
  tip?: number;
}

// ===================================
// Payment Types
// ===================================

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  CLICK = 'click',
  PAYME = 'payme',
  QR_CODE = 'qr_code'
}

export interface Payment extends BaseEntity {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: 'USD' | 'UZS';
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  receiptUrl?: string;
  qrCodeUrl?: string;
  processedAt?: string;
  failureReason?: string;
}

export interface ProcessPaymentRequest {
  orderId: string;
  method: PaymentMethod;
  saveCard?: boolean;
}

export interface UploadReceiptRequest {
  paymentId: string;
  receiptImage: string; // base64 encoded
  transactionId?: string;
}

// ===================================
// Delivery Types
// ===================================

export enum CourierStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline'
}

export interface Courier extends BaseEntity {
  id: string;
  userId: string;
  vehicleType: 'car' | 'motorcycle' | 'bicycle' | 'foot';
  vehicleNumber?: string;
  currentLocation: GeoLocation;
  status: CourierStatus;
  rating: number;
  deliveryCount: number;
  isActive: boolean;
}

export interface DeliveryAssignment extends BaseEntity {
  id: string;
  orderId: string;
  courierId: string;
  status: 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
  assignedAt: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  notes?: string;
}

export interface AvailableOrderRequest {
  regionId?: string;
  districtId?: string;
  maxDistance?: number; // in kilometers
}

// ===================================
// API Response Types
// ===================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ErrorResponse extends ApiResponse {
  success: false;
  error: string;
  errorCode?: string;
  details?: Record<string, any>;
}

// ===================================
// Health & System Types
// ===================================

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: 'pass' | 'fail';
    storage: 'pass' | 'fail';
    external_apis: 'pass' | 'fail';
  };
  endpoints: {
    public: string[];
    auth: string[];
    user: string[];
    admin: string[];
  };
}

// ===================================
// Request/Response Validation Types
// ===================================

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  custom?: (value: any) => boolean | string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
}

// ===================================
// Logging Types
// ===================================

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

// ===================================
// Environment Configuration Types
// ===================================

export interface EnvironmentConfig {
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    maxAge: number;
  };
  logging: {
    level: LogLevel;
    enableConsole: boolean;
    enableExternal: boolean;
  };
  features: {
    enableSmsAuth: boolean;
    enablePayments: boolean;
    enableDelivery: boolean;
    enableAnalytics: boolean;
  };
  external: {
    smsProvider?: {
      apiKey: string;
      baseUrl: string;
    };
    paymentProvider?: {
      secretKey: string;
      baseUrl: string;
    };
  };
}
