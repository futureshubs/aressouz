/**
 * Optimized Database Schema
 * Production-ready PostgreSQL schema with proper indexing, constraints, and performance optimizations
 */

-- ===================================
-- EXTENSIONS
-- ===================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ===================================
-- ENUMS FOR DATA CONSISTENCY
-- ===================================
CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'seller', 'user');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending');
CREATE TYPE entity_type AS ENUM ('car', 'house', 'service', 'rental', 'restaurant', 'place', 'store');
CREATE TYPE listing_status AS ENUM ('active', 'inactive', 'pending', 'sold', 'rented', 'closed');
CREATE TYPE currency AS ENUM ('USD', 'UZS', 'EUR');
CREATE TYPE condition_type AS ENUM ('new', 'used', 'refurbished');
CREATE TYPE fuel_type AS ENUM ('gasoline', 'diesel', 'electric', 'hybrid', 'lpg');
CREATE TYPE transmission_type AS ENUM ('manual', 'automatic', 'cvt', 'dsg');
CREATE TYPE property_type AS ENUM ('apartment', 'house', 'villa', 'commercial', 'land');
CREATE TYPE rental_type AS ENUM ('daily', 'weekly', 'monthly', 'yearly');
CREATE TYPE media_type AS ENUM ('image', 'video', 'document');
CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');

-- ===================================
-- USERS TABLE
-- ===================================
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  role user_role DEFAULT 'user' NOT NULL,
  status user_status DEFAULT 'active' NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP WITH TIME ZONE,
  password_hash VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- ===================================
-- REGIONS TABLE
-- ===================================
CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_uz VARCHAR(100),
  name_ru VARCHAR(100),
  name_en VARCHAR(100),
  coordinates GEOMETRY(POINT, 4326),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- DISTRICTS TABLE
-- ===================================
CREATE TABLE districts (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_uz VARCHAR(100),
  name_ru VARCHAR(100),
  name_en VARCHAR(100),
  coordinates GEOMETRY(POINT, 4326),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- CATEGORIES TABLE
-- ===================================
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entity_type entity_type NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  name_uz VARCHAR(100),
  name_ru VARCHAR(100),
  name_en VARCHAR(100),
  description TEXT,
  icon_url TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- LISTINGS TABLE (UNIFIED)
-- ===================================
CREATE TABLE listings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  old_price DECIMAL(12,2),
  currency currency DEFAULT 'USD' NOT NULL,
  condition condition_type DEFAULT 'used',
  status listing_status DEFAULT 'active' NOT NULL,
  featured BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT false,
  location_name VARCHAR(255),
  coordinates GEOMETRY(POINT, 4326),
  region_id TEXT NOT NULL REFERENCES regions(id),
  district_id TEXT NOT NULL REFERENCES districts(id),
  address TEXT,
  contact_name VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  website_url TEXT,
  social_links JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  specifications JSONB DEFAULT '{}',
  availability JSONB DEFAULT '{}',
  pricing JSONB DEFAULT '{}',
  media JSONB DEFAULT '[]',
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  promoted_until TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- ===================================
-- MEDIA FILES TABLE
-- ===================================
CREATE TABLE media_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entity_id UUID NOT NULL,
  entity_type entity_type NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  media_type media_type NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- FAVORITES TABLE
-- ===================================
CREATE TABLE favorites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- ===================================
-- REVIEWS TABLE
-- ===================================
CREATE TABLE reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  content TEXT,
  pros TEXT[],
  cons TEXT[],
  media JSONB DEFAULT '[]',
  helpful_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  status listing_status DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- ===================================
-- ORDERS TABLE
-- ===================================
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  status order_status DEFAULT 'pending' NOT NULL,
  payment_status payment_status DEFAULT 'pending' NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  currency currency DEFAULT 'USD' NOT NULL,
  items JSONB DEFAULT '[]',
  shipping_address JSONB,
  billing_address JSONB,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- NOTIFICATIONS TABLE
-- ===================================
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- SEARCH LOG TABLE
-- ===================================
CREATE TABLE search_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  results_count INTEGER,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- USER SESSIONS TABLE
-- ===================================
CREATE TABLE user_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  refresh_token VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================
-- INDEXES FOR PERFORMANCE
-- ===================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login_at);

-- Categories table indexes
CREATE INDEX idx_categories_entity_type ON categories(entity_type);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_is_active ON categories(is_active);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);

-- Listings table indexes
CREATE INDEX idx_listings_user_id ON listings(user_id);
CREATE INDEX idx_listings_category_id ON listings(category_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_featured ON listings(featured);
CREATE INDEX idx_listings_verified ON listings(verified);
CREATE INDEX idx_listings_region_id ON listings(region_id);
CREATE INDEX idx_listings_district_id ON listings(district_id);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_created_at ON listings(created_at);
CREATE INDEX idx_listings_expires_at ON listings(expires_at);
CREATE INDEX idx_listings_promoted_until ON listings(promoted_until);

-- GIN indexes for JSONB and arrays
CREATE INDEX idx_listings_tags ON listings USING GIN(tags);
CREATE INDEX idx_listings_specifications ON listings USING GIN(specifications);
CREATE INDEX idx_listings_coordinates ON listings USING GIST(coordinates);

-- Composite indexes for common queries
CREATE INDEX idx_listings_status_category ON listings(status, category_id);
CREATE INDEX idx_listings_status_region ON listings(status, region_id);
CREATE INDEX idx_listings_featured_status ON listings(featured, status) WHERE featured = true;
CREATE INDEX idx_listings_price_status ON listings(price, status) WHERE status = 'active';

-- Media files indexes
CREATE INDEX idx_media_files_entity ON media_files(entity_id, entity_type);
CREATE INDEX idx_media_files_entity_type ON media_files(entity_type);
CREATE INDEX idx_media_files_is_primary ON media_files(is_primary);
CREATE INDEX idx_media_files_sort_order ON media_files(sort_order);

-- Favorites indexes
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_listing_id ON favorites(listing_id);
CREATE INDEX idx_favorites_created_at ON favorites(created_at);

-- Reviews indexes
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_listing_id ON reviews(listing_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);

-- Orders indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_listing_id ON orders(listing_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Search logs indexes
CREATE INDEX idx_search_logs_user_id ON search_logs(user_id);
CREATE INDEX idx_search_logs_query ON search_logs USING GIN(to_tsvector('english', query));
CREATE INDEX idx_search_logs_created_at ON search_logs(created_at);

-- User sessions indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Regions and districts indexes
CREATE INDEX idx_districts_region_id ON districts(region_id);
CREATE INDEX idx_regions_is_active ON regions(is_active);
CREATE INDEX idx_districts_is_active ON districts(is_active);
CREATE INDEX idx_regions_coordinates ON regions USING GIST(coordinates);
CREATE INDEX idx_districts_coordinates ON districts USING GIST(coordinates);

-- ===================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ===================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON regions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_districts_updated_at BEFORE UPDATE ON districts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_files_updated_at BEFORE UPDATE ON media_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- VIEWS FOR COMMON QUERIES
-- ===================================

-- Active listings view
CREATE VIEW active_listings AS
SELECT 
    l.*,
    u.first_name || ' ' || u.last_name as seller_name,
    u.phone as seller_phone,
    c.name as category_name,
    r.name as region_name,
    d.name as district_name
FROM listings l
JOIN users u ON l.user_id = u.id
JOIN categories c ON l.category_id = c.id
JOIN regions r ON l.region_id = r.id
JOIN districts d ON l.district_id = d.id
WHERE l.status = 'active' 
  AND l.deleted_at IS NULL
  AND u.status = 'active'
  AND l.expires_at > NOW();

-- User statistics view
CREATE VIEW user_statistics AS
SELECT 
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    COUNT(DISTINCT l.id) as total_listings,
    COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) as active_listings,
    AVG(l.rating) as average_rating,
    COUNT(DISTINCT r.id) as total_reviews,
    COUNT(DISTINCT f.id) as total_favorites
FROM users u
LEFT JOIN listings l ON u.id = l.user_id AND l.deleted_at IS NULL
LEFT JOIN reviews r ON l.id = r.listing_id
LEFT JOIN favorites f ON l.id = f.listing_id
GROUP BY u.id, u.first_name, u.last_name, u.email;

-- ===================================
-- CONSTRAINTS AND VALIDATIONS
-- ===================================

-- Check constraints for listings
ALTER TABLE listings ADD CONSTRAINT chk_listings_price_positive CHECK (price > 0);
ALTER TABLE listings ADD CONSTRAINT chk_listings_old_price_positive CHECK (old_price IS NULL OR old_price > 0);
ALTER TABLE listings ADD CONSTRAINT chk_listings_old_price_greater CHECK (old_price IS NULL OR old_price >= price);
ALTER TABLE listings ADD CONSTRAINT chk_listings_rating_range CHECK (rating >= 0 AND rating <= 5);
ALTER TABLE listings ADD CONSTRAINT chk_listings_views_positive CHECK (views >= 0);
ALTER TABLE listings ADD CONSTRAINT chk_listings_likes_positive CHECK (likes >= 0);

-- Check constraints for reviews
ALTER TABLE reviews ADD CONSTRAINT chk_reviews_rating_range CHECK (rating >= 1 AND rating <= 5);
ALTER TABLE reviews ADD CONSTRAINT chk_reviews_helpful_count_positive CHECK (helpful_count >= 0);

-- Check constraints for orders
ALTER TABLE orders ADD CONSTRAINT chk_orders_total_positive CHECK (total_amount > 0);

-- ===================================
-- PARTITIONING FOR LARGE TABLES
-- ===================================

-- Partition search_logs by month for better performance
CREATE TABLE search_logs_partitioned (
    LIKE search_logs INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (example for current year)
CREATE TABLE search_logs_2024_01 PARTITION OF search_logs_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE search_logs_2024_02 PARTITION OF search_logs_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Add more partitions as needed...

-- ===================================
-- SECURITY POLICIES (ROW LEVEL SECURITY)
-- ===================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY users_policy ON users
    FOR ALL USING (id = auth.uid());

-- Users can see all active listings, but only modify their own
CREATE POLICY listings_policy ON listings
    FOR SELECT USING (status = 'active' OR user_id = auth.uid());

CREATE POLICY listings_update_policy ON listings
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY listings_delete_policy ON listings
    FOR DELETE USING (user_id = auth.uid());

-- Favorites policies
CREATE POLICY favorites_policy ON favorites
    FOR ALL USING (user_id = auth.uid());

-- Reviews policies
CREATE POLICY reviews_policy ON reviews
    FOR SELECT USING (status = 'active' OR user_id = auth.uid());

CREATE POLICY reviews_insert_policy ON reviews
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY reviews_update_policy ON reviews
    FOR UPDATE USING (user_id = auth.uid());

-- Orders policies
CREATE POLICY orders_policy ON orders
    FOR ALL USING (user_id = auth.uid());

-- Notifications policies
CREATE POLICY notifications_policy ON notifications
    FOR ALL USING (user_id = auth.uid());

-- Sessions policies
CREATE POLICY sessions_policy ON user_sessions
    FOR ALL USING (user_id = auth.uid());

-- ===================================
-- PERFORMANCE TUNING
-- ===================================

-- Set table statistics target for better query planning
ALTER TABLE listings SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE listings SET (autovacuum_analyze_scale_factor = 0.05);

-- Create partial indexes for common filtered queries
CREATE INDEX idx_listings_active_featured ON listings(featured, created_at) 
WHERE status = 'active' AND featured = true;

CREATE INDEX idx_listings_active_price_range ON listings(price, created_at)
WHERE status = 'active' AND price BETWEEN 0 AND 100000;

CREATE INDEX idx_reviews_active_rating ON reviews(rating, created_at)
WHERE status = 'active';

-- ===================================
-- SAMPLE DATA INSERTION
-- ===================================

-- Insert default regions (example)
INSERT INTO regions (id, name, name_uz, name_ru, name_en) VALUES
('01', 'Toshkent shahri', 'Тошкент шаҳри', 'Ташкент город', 'Tashkent city'),
('02', 'Toshkent viloyati', 'Тошкент вилояти', 'Ташкент область', 'Tashkent region'),
('03', 'Samarqand viloyati', 'Самарқанд вилояти', 'Самарканд область', 'Samarkand region'),
('04', 'Buxoro viloyati', 'Бухоро вилояти', 'Бухара область', 'Bukhara region'),
('05', 'Farg\'ona viloyati', 'Фарғона вилояти', 'Фергана область', 'Fergana region');

-- Insert default categories (example)
INSERT INTO categories (id, entity_type, name, name_uz, name_ru, name_en) VALUES
(uuid_generate_v4(), 'car', 'Avtomobillar', 'Автомобиллар', 'Автомобили', 'Cars'),
(uuid_generate_v4(), 'car', 'Yengil avtomobillar', 'Ёнгил автомобиллар', 'Легковые автомобили', 'Light cars'),
(uuid_generate_v4(), 'house', 'Kvartiralar', 'Квартиралар', 'Квартиры', 'Apartments'),
(uuid_generate_v4(), 'house', 'Uylar', 'Уйлар', 'Дома', 'Houses'),
(uuid_generate_v4(), 'service', 'Xizmatlar', 'Хизматлар', 'Услуги', 'Services');

-- ===================================
-- MAINTENANCE FUNCTIONS
-- ===================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update listing view counts
CREATE OR REPLACE FUNCTION increment_listing_views(listing_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE listings SET views = views + 1 WHERE id = listing_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get popular searches
CREATE OR REPLACE FUNCTION get_popular_searches(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(query TEXT, search_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        query,
        COUNT(*) as search_count
    FROM search_logs 
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY query
    ORDER BY search_count DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- SCHEDULED JOBS (using pg_cron extension if available)
-- ===================================

-- Clean up expired sessions every hour
-- SELECT cron.schedule('cleanup-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions();');

-- Update statistics daily
-- SELECT cron.schedule('update-stats', '0 2 * * *', 'ANALYZE;');

-- ===================================
-- COMPLETION
-- ===================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticated, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant sequence permissions
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Final vacuum analyze
VACUUM ANALYZE;
