/**
 * Core TypeScript Types and Interfaces
 * Production-ready type definitions for the entire system
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export type UUID = string;
export type ISO8601 = string;
export type PhoneNumber = string;
export type EmailAddress = string;
export type URL = string;
export type JSONValue = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined 
  | JSONObject 
  | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

export interface JSONArray extends Array<JSONValue> {}

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface BaseEntity {
  id: UUID;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface Timestamps {
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

export enum UserRole {
  ADMIN = 'admin',
  VENDOR = 'vendor',
  CUSTOMER = 'customer',
  MANAGER = 'manager',
  BRANCH_MANAGER = 'branch_manager',
  SELLER = 'seller',
  RESTAURANT = 'restaurant',
  PREPARER = 'preparer',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  VERIFIED = 'verified',
}

export interface User extends BaseEntity {
  phone: PhoneNumber;
  email?: EmailAddress;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  avatar?: URL;
  lastLoginAt?: ISO8601;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: 'uz' | 'ru' | 'en';
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationPreferences;
  location: LocationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  marketing: boolean;
}

export interface LocationPreferences {
  regionId?: string;
  districtId?: string;
  autoDetect: boolean;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: ISO8601;
}

// ============================================================================
// LOCATION TYPES
// ============================================================================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location extends BaseEntity {
  country?: string;
  region: string;
  district: string;
  address?: string;
  postalCode?: string;
  coordinates?: Coordinates;
  timezone?: string;
}

export interface Region {
  id: string;
  name: string;
  country?: string;
  code?: string;
}

export interface District {
  id: string;
  regionId: string;
  name: string;
  code?: string;
}

// ============================================================================
// CATEGORY TYPES
// ============================================================================

export enum EntityType {
  CAR = 'car',
  HOUSE = 'house',
  SERVICE = 'service',
  RENTAL = 'rental',
  RESTAURANT = 'restaurant',
  PLACE = 'place',
  STORE = 'store',
  PRODUCT = 'product',
  FOOD = 'food',
}

export interface Category extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: URL;
  icon?: string;
  parentId?: UUID;
  entityType: EntityType;
  sortOrder: number;
  isActive: boolean;
  metadata?: JSONObject;
}

// ============================================================================
// LISTING TYPES
// ============================================================================

export enum ListingStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
  DELETED = 'deleted',
  PENDING = 'pending',
  REJECTED = 'rejected',
}

export enum Currency {
  USD = 'USD',
  UZS = 'UZS',
}

export enum Condition {
  NEW = 'new',
  USED = 'used',
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
}

export interface Listing extends BaseEntity {
  title: string;
  description: string;
  categoryId: UUID;
  ownerId: UUID;
  entityType: EntityType;
  status: ListingStatus;
  price: number;
  currency: Currency;
  locationId?: UUID;
  location?: Location;
  images: MediaFile[];
  featured: boolean;
  verified: boolean;
  views: number;
  likes: number;
  rating?: number;
  reviewCount: number;
  condition?: Condition;
  metadata: JSONObject;
  tags: string[];
  expiresAt?: ISO8601;
}

// ============================================================================
// MEDIA TYPES
// ============================================================================

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
}

export interface MediaFile extends BaseEntity {
  entityId: UUID;
  entityType: EntityType;
  fileUrl: URL;
  fileName: string;
  fileType: MediaType;
  mimeType: string;
  fileSize: number;
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number; // For video/audio
  sortOrder: number;
  alt?: string;
  caption?: string;
}

// ============================================================================
// SPECIFIC ENTITY TYPES
// ============================================================================

export interface Car extends Listing {
  brand: string;
  model: string;
  year: number;
  fuelType: FuelType;
  transmission: TransmissionType;
  seats: number;
  color: string;
  mileage: number;
  features: string[];
  vin?: string;
  engineVolume?: number;
  creditAvailable: boolean;
  mortgageAvailable: boolean;
  halalInstallmentAvailable: boolean;
}

export enum FuelType {
  PETROL = 'petrol',
  DIESEL = 'diesel',
  HYBRID = 'hybrid',
  ELECTRIC = 'electric',
  GAS = 'gas',
}

export enum TransmissionType {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
  CVT = 'cvt',
  SEMI_AUTOMATIC = 'semi-automatic',
}

export interface House extends Listing {
  propertyType: PropertyType;
  priceType: PriceType;
  rooms: number;
  area: number;
  floorNumber?: number;
  totalFloors?: number;
  hasBalcony: boolean;
  hasParking: boolean;
  hasFurniture: boolean;
  buildingYear?: number;
}

export enum PropertyType {
  APARTMENT = 'apartment',
  HOUSE = 'house',
  COMMERCIAL = 'commercial',
  LAND = 'land',
  COTTAGE = 'cottage',
  OFFICE = 'office',
}

export enum PriceType {
  SALE = 'sale',
  RENT = 'rent',
}

export interface Service extends Listing {
  profession: string;
  experience: string;
  priceFrom?: number;
  priceTo?: number;
  priceUnit: string;
  phone: PhoneNumber;
  workDays: string[];
  workHours: string;
  skills: string[];
  completedJobs: number;
  languages: string[];
  portfolio?: MediaFile[];
}

export interface Rental extends Listing {
  rentalType: RentalType;
  specifications: JSONObject;
  availability: RentalAvailability;
  deposit?: number;
  rules?: string[];
}

export enum RentalType {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface RentalAvailability {
  availableDates: ISO8601[];
  blockedDates: ISO8601[];
  minRentalPeriod?: number;
  maxRentalPeriod?: number;
  advanceNotice?: number;
}

export interface Restaurant extends Listing {
  cuisineType: string;
  phone: PhoneNumber;
  openingHours: OpeningHours;
  deliveryAvailable: boolean;
  minDeliveryAmount?: number;
  deliveryFee?: number;
  averagePreparationTime?: string;
  features: string[];
  menu?: MenuItem[];
}

export interface OpeningHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  open: string; // HH:MM format
  close: string; // HH:MM format
  closed: boolean;
}

export interface MenuItem {
  id: UUID;
  name: string;
  description?: string;
  price: number;
  currency: Currency;
  category: string;
  images: MediaFile[];
  ingredients?: string[];
  allergens?: string[];
  spicy?: boolean;
  vegetarian?: boolean;
  available: boolean;
}

// ============================================================================
// SEARCH AND FILTER TYPES
// ============================================================================

export interface SearchFilters {
  query?: string;
  categoryId?: UUID;
  entityType?: EntityType;
  locationId?: UUID;
  regionId?: string;
  districtId?: string;
  priceMin?: number;
  priceMax?: number;
  currency?: Currency;
  condition?: Condition;
  verified?: boolean;
  featured?: boolean;
  sortBy?: SortOption;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}

export enum SortOption {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  PRICE = 'price',
  RATING = 'rating',
  VIEWS = 'views',
  LIKES = 'likes',
  RELEVANCE = 'relevance',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export interface SearchResult<T = Listing> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  timestamp: ISO8601;
}

export interface ApiError {
  code: string;
  message: string;
  details?: JSONObject;
  stack?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: FormFieldOption[];
  validation?: ValidationRule[];
  defaultValue?: any;
  disabled?: boolean;
  hidden?: boolean;
}

export enum FormFieldType {
  TEXT = 'text',
  EMAIL = 'email',
  PHONE = 'phone',
  NUMBER = 'number',
  PASSWORD = 'password',
  SELECT = 'select',
  MULTI_SELECT = 'multi-select',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  TEXTAREA = 'textarea',
  FILE = 'file',
  DATE = 'date',
  TIME = 'time',
  DATETIME = 'datetime',
  URL = 'url',
}

export interface FormFieldOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface ValidationRule {
  type: ValidationType;
  value?: any;
  message: string;
}

export enum ValidationType {
  REQUIRED = 'required',
  MIN_LENGTH = 'minLength',
  MAX_LENGTH = 'maxLength',
  MIN = 'min',
  MAX = 'max',
  EMAIL = 'email',
  PHONE = 'phone',
  URL = 'url',
  PATTERN = 'pattern',
  CUSTOM = 'custom',
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface Notification {
  id: UUID;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
  createdAt: ISO8601;
  readAt?: ISO8601;
}

export interface NotificationAction {
  label: string;
  action: string;
  primary?: boolean;
  destructive?: boolean;
}

// ============================================================================
// CART AND ORDER TYPES
// ============================================================================

export interface CartItem {
  id: UUID;
  listingId: UUID;
  listing: Listing;
  quantity: number;
  price: number;
  currency: Currency;
  addedAt: ISO8601;
}

export interface Cart {
  id: UUID;
  userId?: UUID;
  items: CartItem[];
  totalAmount: number;
  currency: Currency;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface Order extends BaseEntity {
  userId: UUID;
  user: User;
  items: OrderItem[];
  totalAmount: number;
  currency: Currency;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  metadata?: JSONObject;
}

export interface OrderItem {
  id: UUID;
  orderId: UUID;
  listingId: UUID;
  listing: Listing;
  quantity: number;
  price: number;
  currency: Currency;
  total: number;
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export interface Address {
  street: string;
  city: string;
  region: string;
  postalCode?: string;
  country: string;
  coordinates?: Coordinates;
}

// ============================================================================
// REVIEW AND RATING TYPES
// ============================================================================

export interface Review extends BaseEntity {
  userId: UUID;
  user: User;
  listingId: UUID;
  listing: Listing;
  rating: number;
  comment?: string;
  images?: MediaFile[];
  helpful: number;
  verified: boolean;
}

export interface RatingStats {
  average: number;
  count: number;
  distribution: RatingDistribution;
}

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface AppConfig {
  api: ApiConfig;
  features: FeatureFlags;
  theme: ThemeConfig;
  localization: LocalizationConfig;
  analytics?: AnalyticsConfig;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface FeatureFlags {
  [key: string]: boolean;
}

export interface ThemeConfig {
  defaultTheme: 'light' | 'dark' | 'system';
  colors: ColorPalette;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

export interface LocalizationConfig {
  defaultLanguage: 'uz' | 'ru' | 'en';
  supportedLanguages: ('uz' | 'ru' | 'en')[];
  currency: Currency;
  timezone: string;
}

export interface AnalyticsConfig {
  provider: 'google' | 'mixpanel' | 'amplitude' | 'custom';
  trackingId?: string;
  config?: JSONObject;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

export type EventHandler<T = any> = (event: T) => void;
export type AsyncEventHandler<T = any> = (event: T) => Promise<void>;

export interface Event<T = any> {
  type: string;
  payload: T;
  timestamp: ISO8601;
  id?: UUID;
}

// ============================================================================
// ALL TYPES EXPORTED FROM THIS FILE
// ============================================================================
