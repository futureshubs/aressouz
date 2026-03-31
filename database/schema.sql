-- ===================================
-- CARS TABLE
-- ===================================
CREATE TABLE cars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  image TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  year INTEGER NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  transmission TEXT NOT NULL,
  seats INTEGER NOT NULL,
  color TEXT NOT NULL,
  mileage TEXT NOT NULL,
  features TEXT[] DEFAULT '{}',
  rating DECIMAL(3,2) DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  location TEXT NOT NULL,
  owner TEXT NOT NULL,
  available BOOLEAN DEFAULT true,
  price DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'UZS')),
  old_price DECIMAL(12,2),
  description TEXT,
  condition TEXT CHECK (condition IN ('Yangi', 'Ishlatilgan')),
  owner_phone TEXT,
  user_id UUID,
  credit_available BOOLEAN DEFAULT false,
  mortgage_available BOOLEAN DEFAULT false,
  credit_term INTEGER,
  credit_interest_rate DECIMAL(5,2),
  initial_payment DECIMAL(12,2),
  has_halal_installment BOOLEAN DEFAULT false,
  halal_installment_months INTEGER,
  halal_installment_bank TEXT,
  halal_down_payment DECIMAL(12,2),
  region_id TEXT,
  district_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- CAR CATEGORIES TABLE
-- ===================================
CREATE TABLE car_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT NOT NULL,
  icon TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- HOUSES TABLE
-- ===================================
CREATE TABLE houses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'UZS')),
  price_type TEXT DEFAULT 'sale' CHECK (price_type IN ('sale', 'rent')),
  property_type TEXT CHECK (property_type IN ('apartment', 'house', 'commercial', 'land', 'cottage', 'office')),
  images TEXT[] DEFAULT '{}',
  panorama_scenes JSONB,
  rooms INTEGER,
  area DECIMAL(8,2),
  floor_number INTEGER,
  total_floors INTEGER,
  address TEXT NOT NULL,
  location TEXT NOT NULL,
  coordinates POINT,
  owner_name TEXT,
  owner_phone TEXT,
  rating DECIMAL(3,2) DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  available BOOLEAN DEFAULT true,
  user_id UUID,
  region_id TEXT,
  district_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- HOUSE CATEGORIES TABLE
-- ===================================
CREATE TABLE house_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  image TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- SERVICES TABLE
-- ===================================
CREATE TABLE services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  profession TEXT NOT NULL,
  category_id TEXT NOT NULL,
  catalog_id TEXT NOT NULL,
  image TEXT NOT NULL,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  experience TEXT NOT NULL,
  price_from DECIMAL(10,2),
  price_to DECIMAL(10,2),
  price_unit TEXT NOT NULL,
  phone TEXT NOT NULL,
  work_days TEXT[] DEFAULT '{}',
  work_hours TEXT NOT NULL,
  description TEXT NOT NULL,
  skills TEXT[] DEFAULT '{}',
  completed_jobs INTEGER DEFAULT 0,
  languages TEXT[] DEFAULT '{}',
  location TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  user_id UUID,
  region_id TEXT,
  district_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- SERVICE CATEGORIES TABLE
-- ===================================
CREATE TABLE service_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  catalog_id TEXT NOT NULL,
  service_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- RENTALS TABLE
-- ===================================
CREATE TABLE rentals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  price_unit TEXT NOT NULL,
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'UZS')),
  images TEXT[] DEFAULT '{}',
  rental_type TEXT CHECK (rental_type IN ('hourly', 'daily', 'weekly', 'monthly')),
  specifications JSONB,
  availability JSONB,
  location TEXT NOT NULL,
  coordinates POINT,
  owner_name TEXT,
  owner_phone TEXT,
  rating DECIMAL(3,2) DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  user_id UUID,
  region_id TEXT,
  district_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- RENTAL CATEGORIES TABLE
-- ===================================
CREATE TABLE rental_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  image TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- RESTAURANTS TABLE
-- ===================================
CREATE TABLE restaurants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  cuisine_type TEXT NOT NULL,
  image TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  address TEXT NOT NULL,
  location TEXT NOT NULL,
  coordinates POINT,
  phone TEXT NOT NULL,
  opening_hours TEXT,
  delivery_available BOOLEAN DEFAULT false,
  min_delivery_amount DECIMAL(10,2),
  delivery_fee DECIMAL(10,2),
  average_preparation_time TEXT,
  features TEXT[] DEFAULT '{}',
  verified BOOLEAN DEFAULT false,
  user_id UUID,
  region_id TEXT,
  district_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- PLACES TABLE
-- ===================================
CREATE TABLE places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  image TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  rating DECIMAL(3,2) DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  address TEXT NOT NULL,
  phone TEXT,
  coordinates POINT,
  is_open BOOLEAN DEFAULT true,
  opening_hours TEXT,
  description TEXT NOT NULL,
  services TEXT[] DEFAULT '{}',
  distance TEXT,
  location TEXT NOT NULL,
  user_id UUID,
  region_id TEXT,
  district_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- PLACE CATEGORIES TABLE
-- ===================================
CREATE TABLE place_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  image TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- STORES TABLE
-- ===================================
CREATE TABLE stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  image TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  address TEXT NOT NULL,
  location TEXT NOT NULL,
  coordinates POINT,
  phone TEXT NOT NULL,
  opening_hours TEXT,
  website TEXT,
  social_links JSONB,
  products_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  user_id UUID,
  region_id TEXT,
  district_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- STORE CATEGORIES TABLE
-- ===================================
CREATE TABLE store_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  image TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- REGIONS TABLE
-- ===================================
CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- DISTRICTS TABLE
-- ===================================
CREATE TABLE districts (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES regions(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- INDEXES FOR PERFORMANCE
-- ===================================
CREATE INDEX idx_cars_category_id ON cars(category_id);
CREATE INDEX idx_cars_region_district ON cars(region_id, district_id);
CREATE INDEX idx_cars_available ON cars(available);
CREATE INDEX idx_houses_category_id ON houses(category_id);
CREATE INDEX idx_houses_region_district ON houses(region_id, district_id);
CREATE INDEX idx_houses_available ON houses(available);
CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_region_district ON services(region_id, district_id);
CREATE INDEX idx_rentals_category_id ON rentals(category_id);
CREATE INDEX idx_rentals_region_district ON rentals(region_id, district_id);
CREATE INDEX idx_restaurants_category_id ON restaurants(category_id);
CREATE INDEX idx_restaurants_region_district ON restaurants(region_id, district_id);
CREATE INDEX idx_places_category_id ON places(category_id);
CREATE INDEX idx_places_region_district ON places(region_id, district_id);
CREATE INDEX idx_stores_category_id ON stores(category_id);
CREATE INDEX idx_stores_region_district ON stores(region_id, district_id);
CREATE INDEX idx_districts_region_id ON districts(region_id);

-- ===================================
-- ENABLE POSTGIS FOR GEOSPATIAL QUERIES
-- ===================================
-- Run this once in your Supabase project:
-- CREATE EXTENSION IF NOT EXISTS postgis;
