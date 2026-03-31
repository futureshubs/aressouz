/**
 * Validation Schemas using Zod
 * Production-ready validation for all data structures
 */

import { z } from 'zod';
import { 
  UserRole, 
  UserStatus, 
  EntityType, 
  ListingStatus, 
  Currency, 
  Condition,
  FuelType,
  TransmissionType,
  PropertyType,
  PriceType,
  RentalType,
  SortOption,
  SortOrder,
  NotificationType,
  OrderStatus,
  PaymentStatus,
  MediaType,
  FormFieldType,
  ValidationType
} from '../types';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const emailSchema = z.string().email('Invalid email format');
export const phoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone format');
export const urlSchema = z.string().url('Invalid URL format');
export const iso8601Schema = z.string().datetime('Invalid datetime format');
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const baseEntitySchema = z.object({
  id: uuidSchema,
  createdAt: iso8601Schema,
  updatedAt: iso8601Schema,
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const userRoleSchema = z.nativeEnum(UserRole);
export const userStatusSchema = z.nativeEnum(UserStatus);

export const userPreferencesSchema = z.object({
  language: z.enum(['uz', 'ru', 'en']).default('uz'),
  theme: z.enum(['light', 'dark', 'system']).default('light'),
  notifications: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(true),
    push: z.boolean().default(true),
    marketing: z.boolean().default(false),
  }).default({}),
  location: z.object({
    regionId: z.string().optional(),
    districtId: z.string().optional(),
    autoDetect: z.boolean().default(true),
  }).default({}),
});

export const userSchema = baseEntitySchema.extend({
  phone: phoneSchema,
  email: emailSchema.optional(),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  role: userRoleSchema,
  status: userStatusSchema,
  avatar: urlSchema.optional(),
  lastLoginAt: iso8601Schema.optional(),
  emailVerified: z.boolean().optional(),
  phoneVerified: z.boolean().optional(),
  preferences: userPreferencesSchema,
});

export const createUserSchema = userSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  emailVerified: true,
  phoneVerified: true,
}).partial({
  email: true,
  avatar: true,
});

export const updateUserSchema = createUserSchema.partial();

export const loginUserSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(8).max(128),
});

export const registerUserSchema = createUserSchema.extend({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// ============================================================================
// LOCATION SCHEMAS
// ============================================================================

export const locationSchema = baseEntitySchema.extend({
  country: z.string().optional(),
  region: z.string().min(1),
  district: z.string().min(1),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  coordinates: coordinatesSchema.optional(),
  timezone: z.string().optional(),
});

export const regionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  country: z.string().optional(),
  code: z.string().optional(),
});

export const districtSchema = z.object({
  id: z.string(),
  regionId: z.string(),
  name: z.string().min(1),
  code: z.string().optional(),
});

// ============================================================================
// CATEGORY SCHEMAS
// ============================================================================

export const entityTypeSchema = z.nativeEnum(EntityType);
export const categorySchema = baseEntitySchema.extend({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  imageUrl: urlSchema.optional(),
  icon: z.string().optional(),
  parentId: uuidSchema.optional(),
  entityType: entityTypeSchema,
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

export const createCategorySchema = categorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCategorySchema = createCategorySchema.partial();

// ============================================================================
// LISTING SCHEMAS
// ============================================================================

export const listingStatusSchema = z.nativeEnum(ListingStatus);
export const currencySchema = z.nativeEnum(Currency);
export const conditionSchema = z.nativeEnum(Condition);

export const listingSchema = baseEntitySchema.extend({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  categoryId: uuidSchema,
  ownerId: uuidSchema,
  entityType: entityTypeSchema,
  status: listingStatusSchema.default(ListingStatus.DRAFT),
  price: z.number().min(0).max(999999999),
  currency: currencySchema.default(Currency.USD),
  locationId: uuidSchema.optional(),
  location: locationSchema.optional(),
  images: z.array(z.any()).default([]),
  featured: z.boolean().default(false),
  verified: z.boolean().default(false),
  views: z.number().int().min(0).default(0),
  likes: z.number().int().min(0).default(0),
  rating: z.number().min(1).max(5).optional(),
  reviewCount: z.number().int().min(0).default(0),
  condition: conditionSchema.optional(),
  metadata: z.record(z.any()).default({}),
  tags: z.array(z.string()).default([]),
  expiresAt: iso8601Schema.optional(),
});

export const createListingSchema = listingSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  views: true,
  likes: true,
  reviewCount: true,
  rating: true,
  verified: true,
}).partial({
  status: true,
  featured: true,
  verified: true,
  expiresAt: true,
});

export const updateListingSchema = createListingSchema.partial();

// ============================================================================
// CAR SCHEMAS
// ============================================================================

export const fuelTypeSchema = z.nativeEnum(FuelType);
export const transmissionTypeSchema = z.nativeEnum(TransmissionType);

export const carSchema = listingSchema.extend({
  brand: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  fuelType: fuelTypeSchema,
  transmission: transmissionTypeSchema,
  seats: z.number().int().min(1).max(20),
  color: z.string().min(1).max(30),
  mileage: z.number().min(0),
  features: z.array(z.string()).default([]),
  vin: z.string().optional(),
  engineVolume: z.number().positive().optional(),
  creditAvailable: z.boolean().default(false),
  mortgageAvailable: z.boolean().default(false),
  halalInstallmentAvailable: z.boolean().default(false),
});

export const createCarSchema = createListingSchema.extend({
  brand: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  fuelType: fuelTypeSchema,
  transmission: transmissionTypeSchema,
  seats: z.number().int().min(1).max(20),
  color: z.string().min(1).max(30),
  mileage: z.number().min(0),
  features: z.array(z.string()).default([]),
  vin: z.string().optional(),
  engineVolume: z.number().positive().optional(),
  creditAvailable: z.boolean().default(false),
  mortgageAvailable: z.boolean().default(false),
  halalInstallmentAvailable: z.boolean().default(false),
});

// ============================================================================
// HOUSE SCHEMAS
// ============================================================================

export const propertyTypeSchema = z.nativeEnum(PropertyType);
export const priceTypeSchema = z.nativeEnum(PriceType);

export const houseSchema = listingSchema.extend({
  propertyType: propertyTypeSchema,
  priceType: priceTypeSchema.default(PriceType.SALE),
  rooms: z.number().int().min(0),
  area: z.number().positive(),
  floorNumber: z.number().int().min(1).optional(),
  totalFloors: z.number().int().min(1).optional(),
  hasBalcony: z.boolean().default(false),
  hasParking: z.boolean().default(false),
  hasFurniture: z.boolean().default(false),
  buildingYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
});

export const createHouseSchema = createListingSchema.extend({
  propertyType: propertyTypeSchema,
  priceType: priceTypeSchema.default(PriceType.SALE),
  rooms: z.number().int().min(0),
  area: z.number().positive(),
  floorNumber: z.number().int().min(1).optional(),
  totalFloors: z.number().int().min(1).optional(),
  hasBalcony: z.boolean().default(false),
  hasParking: z.boolean().default(false),
  hasFurniture: z.boolean().default(false),
  buildingYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
});

// ============================================================================
// SERVICE SCHEMAS
// ============================================================================

export const serviceSchema = listingSchema.extend({
  profession: z.string().min(1).max(100),
  experience: z.string().min(1).max(100),
  priceFrom: z.number().positive().optional(),
  priceTo: z.number().positive().optional(),
  priceUnit: z.string().min(1).max(50),
  phone: phoneSchema,
  workDays: z.array(z.string()).default([]),
  workHours: z.string().min(1).max(50),
  skills: z.array(z.string()).default([]),
  completedJobs: z.number().int().min(0).default(0),
  languages: z.array(z.string()).default([]),
  portfolio: z.array(z.any()).optional(),
});

export const createServiceSchema = createListingSchema.extend({
  profession: z.string().min(1).max(100),
  experience: z.string().min(1).max(100),
  priceFrom: z.number().positive().optional(),
  priceTo: z.number().positive().optional(),
  priceUnit: z.string().min(1).max(50),
  phone: phoneSchema,
  workDays: z.array(z.string()).default([]),
  workHours: z.string().min(1).max(50),
  skills: z.array(z.string()).default([]),
  completedJobs: z.number().int().min(0).default(0),
  languages: z.array(z.string()).default([]),
});

// ============================================================================
// RENTAL SCHEMAS
// ============================================================================

export const rentalTypeSchema = z.nativeEnum(RentalType);

export const rentalAvailabilitySchema = z.object({
  availableDates: z.array(iso8601Schema).default([]),
  blockedDates: z.array(iso8601Schema).default([]),
  minRentalPeriod: z.number().positive().optional(),
  maxRentalPeriod: z.number().positive().optional(),
  advanceNotice: z.number().positive().optional(),
});

export const rentalSchema = listingSchema.extend({
  rentalType: rentalTypeSchema,
  specifications: z.record(z.any()).default({}),
  availability: rentalAvailabilitySchema.default({}),
  deposit: z.number().positive().optional(),
  rules: z.array(z.string()).optional(),
});

export const createRentalSchema = createListingSchema.extend({
  rentalType: rentalTypeSchema,
  specifications: z.record(z.any()).default({}),
  availability: rentalAvailabilitySchema.default({}),
  deposit: z.number().positive().optional(),
  rules: z.array(z.string()).optional(),
});

// ============================================================================
// RESTAURANT SCHEMAS
// ============================================================================

export const dayScheduleSchema = z.object({
  open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  closed: z.boolean().default(false),
});

export const openingHoursSchema = z.object({
  monday: dayScheduleSchema,
  tuesday: dayScheduleSchema,
  wednesday: dayScheduleSchema,
  thursday: dayScheduleSchema,
  friday: dayScheduleSchema,
  saturday: dayScheduleSchema,
  sunday: dayScheduleSchema,
});

export const menuItemSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  price: z.number().positive(),
  currency: currencySchema,
  category: z.string().min(1).max(50),
  images: z.array(z.any()).default([]),
  ingredients: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
  spicy: z.boolean().default(false),
  vegetarian: z.boolean().default(false),
  available: z.boolean().default(true),
});

export const restaurantSchema = listingSchema.extend({
  cuisineType: z.string().min(1).max(50),
  phone: phoneSchema,
  openingHours: openingHoursSchema,
  deliveryAvailable: z.boolean().default(false),
  minDeliveryAmount: z.number().positive().optional(),
  deliveryFee: z.number().positive().optional(),
  averagePreparationTime: z.string().optional(),
  features: z.array(z.string()).default([]),
  menu: z.array(menuItemSchema).optional(),
});

export const createRestaurantSchema = createListingSchema.extend({
  cuisineType: z.string().min(1).max(50),
  phone: phoneSchema,
  openingHours: openingHoursSchema,
  deliveryAvailable: z.boolean().default(false),
  minDeliveryAmount: z.number().positive().optional(),
  deliveryFee: z.number().positive().optional(),
  averagePreparationTime: z.string().optional(),
  features: z.array(z.string()).default([]),
});

// ============================================================================
// MEDIA SCHEMAS
// ============================================================================

export const mediaTypeSchema = z.nativeEnum(MediaType);

export const mediaFileSchema = baseEntitySchema.extend({
  entityId: uuidSchema,
  entityType: entityTypeSchema,
  fileUrl: urlSchema,
  fileName: z.string().min(1),
  fileType: mediaTypeSchema,
  mimeType: z.string().min(1),
  fileSize: z.number().positive(),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  duration: z.number().positive().optional(),
  sortOrder: z.number().int().min(0).default(0),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const createMediaFileSchema = mediaFileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

export const sortOptionSchema = z.nativeEnum(SortOption);
export const sortOrderSchema = z.nativeEnum(SortOrder);

export const searchFiltersSchema = z.object({
  query: z.string().optional(),
  categoryId: uuidSchema.optional(),
  entityType: entityTypeSchema.optional(),
  locationId: uuidSchema.optional(),
  regionId: z.string().optional(),
  districtId: z.string().optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().positive().optional(),
  currency: currencySchema.optional(),
  condition: conditionSchema.optional(),
  verified: z.boolean().optional(),
  featured: z.boolean().optional(),
  sortBy: sortOptionSchema.optional(),
  sortOrder: sortOrderSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const searchResultSchema = z.object({
  items: z.array(z.any()),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

// ============================================================================
// FORM SCHEMAS
// ============================================================================

export const formFieldTypeSchema = z.nativeEnum(FormFieldType);
export const validationTypeSchema = z.nativeEnum(ValidationType);

export const formFieldOptionSchema = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string(),
  disabled: z.boolean().default(false),
});

export const validationRuleSchema = z.object({
  type: validationTypeSchema,
  value: z.any().optional(),
  message: z.string(),
});

export const formFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: formFieldTypeSchema,
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(formFieldOptionSchema).optional(),
  validation: z.array(validationRuleSchema).optional(),
  defaultValue: z.any().optional(),
  disabled: z.boolean().default(false),
  hidden: z.boolean().default(false),
});

// ============================================================================
// NOTIFICATION SCHEMAS
// ============================================================================

export const notificationTypeSchema = z.nativeEnum(NotificationType);

export const notificationActionSchema = z.object({
  label: z.string().min(1),
  action: z.string().min(1),
  primary: z.boolean().default(false),
  destructive: z.boolean().default(false),
});

export const notificationSchema = z.object({
  id: uuidSchema,
  type: notificationTypeSchema,
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  duration: z.number().positive().optional(),
  persistent: z.boolean().default(false),
  actions: z.array(notificationActionSchema).optional(),
  createdAt: iso8601Schema,
  readAt: iso8601Schema.optional(),
});

// ============================================================================
// ORDER SCHEMAS
// ============================================================================

export const orderStatusSchema = z.nativeEnum(OrderStatus);
export const paymentStatusSchema = z.nativeEnum(PaymentStatus);

export const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  region: z.string().min(1),
  postalCode: z.string().optional(),
  country: z.string().min(1),
  coordinates: coordinatesSchema.optional(),
});

export const cartItemSchema = z.object({
  id: uuidSchema,
  listingId: uuidSchema,
  listing: z.any(), // Listing type
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  currency: currencySchema,
  addedAt: iso8601Schema,
});

export const cartSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema.optional(),
  items: z.array(cartItemSchema).default([]),
  totalAmount: z.number().positive(),
  currency: currencySchema,
  createdAt: iso8601Schema,
  updatedAt: iso8601Schema,
});

export const orderItemSchema = z.object({
  id: uuidSchema,
  orderId: uuidSchema,
  listingId: uuidSchema,
  listing: z.any(), // Listing type
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  currency: currencySchema,
  total: z.number().positive(),
});

export const orderSchema = baseEntitySchema.extend({
  userId: uuidSchema,
  user: userSchema,
  items: z.array(orderItemSchema).default([]),
  totalAmount: z.number().positive(),
  currency: currencySchema,
  status: orderStatusSchema.default(OrderStatus.PENDING),
  paymentStatus: paymentStatusSchema.default(PaymentStatus.PENDING),
  shippingAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const createOrderSchema = orderSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  user: true,
}).partial({
  status: true,
  paymentStatus: true,
});

// ============================================================================
// REVIEW SCHEMAS
// ============================================================================

export const ratingDistributionSchema = z.object({
  1: z.number().int().min(0),
  2: z.number().int().min(0),
  3: z.number().int().min(0),
  4: z.number().int().min(0),
  5: z.number().int().min(0),
});

export const ratingStatsSchema = z.object({
  average: z.number().min(1).max(5),
  count: z.number().int().min(0),
  distribution: ratingDistributionSchema,
});

export const reviewSchema = baseEntitySchema.extend({
  userId: uuidSchema,
  user: userSchema,
  listingId: uuidSchema,
  listing: z.any(), // Listing type
  rating: z.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
  images: z.array(mediaFileSchema).optional(),
  helpful: z.number().int().min(0).default(0),
  verified: z.boolean().default(false),
});

export const createReviewSchema = reviewSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  user: true,
  helpful: true,
  verified: true,
});

export const updateReviewSchema = createReviewSchema.partial();

// ============================================================================
// API RESPONSE SCHEMAS
// ============================================================================

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional(),
  stack: z.string().optional(),
});

export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: apiErrorSchema.optional(),
  message: z.string().optional(),
  timestamp: iso8601Schema,
});

export const paginationMetaSchema = z.object({
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

// ============================================================================
// CONFIGURATION SCHEMAS
// ============================================================================

export const apiConfigSchema = z.object({
  baseUrl: urlSchema,
  timeout: z.number().positive(),
  retryAttempts: z.number().int().min(0),
  retryDelay: z.number().positive(),
});

export const featureFlagsSchema = z.record(z.boolean());

export const colorPaletteSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  background: z.string(),
  surface: z.string(),
  text: z.string(),
});

export const themeConfigSchema = z.object({
  defaultTheme: z.enum(['light', 'dark', 'system']),
  colors: colorPaletteSchema,
});

export const localizationConfigSchema = z.object({
  defaultLanguage: z.enum(['uz', 'ru', 'en']),
  supportedLanguages: z.array(z.enum(['uz', 'ru', 'en'])),
  currency: currencySchema,
  timezone: z.string(),
});

export const analyticsConfigSchema = z.object({
  provider: z.enum(['google', 'mixpanel', 'amplitude', 'custom']),
  trackingId: z.string().optional(),
  config: z.record(z.any()).optional(),
});

export const appConfigSchema = z.object({
  api: apiConfigSchema,
  features: featureFlagsSchema,
  theme: themeConfigSchema,
  localization: localizationConfigSchema,
  analytics: analyticsConfigSchema.optional(),
});

// ============================================================================
// ALL SCHEMAS EXPORTED FROM THIS FILE
// ============================================================================
