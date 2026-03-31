-- ===================================
-- REGIONS SEED DATA
-- ===================================
INSERT INTO regions (id, name) VALUES
('tashkent-city', 'Toshkent shahri'),
('tashkent', 'Toshkent'),
('andijon', 'Andijon'),
('buxoro', 'Buxoro'),
('fargona', 'Farg''ona'),
('jizzax', 'Jizzax'),
('xorazm', 'Xorazm'),
('qoraqalpogiston', 'Qoraqalpog''iston'),
('qashqadaryo', 'Qashqadaryo'),
('sirdaryo', 'Sirdaryo'),
('surxondaryo', 'Surxondaryo'),
('namangan', 'Namangan'),
('navoiy', 'Navoiy'),
('samarkand', 'Samarqand');

-- ===================================
-- DISTRICTS SEED DATA (Sample)
-- ===================================
INSERT INTO districts (id, region_id, name) VALUES
-- Tashkent City
('bektemir', 'tashkent-city', 'Bektemir'),
('chilonzor', 'tashkent-city', 'Chilonzor'),
('mirobod', 'tashkent-city', 'Mirobod'),
('mirzo-ulugbek', 'tashkent-city', 'Mirzo Ulug''bek'),
('olmazor', 'tashkent-city', 'Olmazor'),
('sergeli', 'tashkent-city', 'Sergeli'),
('shayxontohur', 'tashkent-city', 'Shayxontohur'),
('uchtepa', 'tashkent-city', 'Uchtepa'),
('yakkasaroy', 'tashkent-city', 'Yakkasaroy'),
('yashnobod', 'tashkent-city', 'Yashnobod'),
('yunusobod', 'tashkent-city', 'Yunusobod'),

-- Tashkent Region
('angren', 'tashkent', 'Angren'),
('bekobod', 'tashkent', 'Bekobod'),
('boka', 'tashkent', 'Bo''ka'),
('bostonliq', 'tashkent', 'Bo''stonliq'),
('chinoz', 'tashkent', 'Chinoz'),
('ohangaron', 'tashkent', 'Ohangaron'),
('oqqorgon', 'tashkent', 'Oqqo''rg''on'),
('parkent', 'tashkent', 'Parkent'),
('piskent', 'tashkent', 'Piskent'),
('qibray', 'tashkent', 'Qibray');

-- ===================================
-- CAR CATEGORIES SEED DATA
-- ===================================
INSERT INTO car_categories (id, name, description, image, icon, count) VALUES
('sedan', 'Sedan', 'O''rta toifali avtomobillar', 'https://images.unsplash.com/photo-1550355241-3a921004b4a3?w=800', '🚗', 0),
('suv', 'SUV', 'Yengil avtomobillar', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800', '🚙', 0),
('truck', 'Yuk mashinalari', 'Yuk tashish uchun', 'https://images.unsplash.com/photo-1549396341-7f3b8f4ee5b4?w=800', '🚚', 0),
('bus', 'Avtobuslar', 'Yo''lovchi tashish', 'https://images.unsplash.com/photo-1570126470972-40c8d6a6e4f4?w=800', '🚌', 0),
('motorcycle', 'Motosikllar', 'Ikki g''ildirakli transport', 'https://images.unsplash.com/photo-1558981285-6f0b8d0c7c0c?w=800', '🏍️', 0),
('pickup', 'Pikaplar', 'Yuk va yo''lovchi', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800', '🛻', 0);

-- ===================================
-- HOUSE CATEGORIES SEED DATA
-- ===================================
INSERT INTO house_categories (id, name, icon, image, count) VALUES
('apartment', 'Kvartiralar', '🏢', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800', 0),
('house', 'Uylar', '🏠', 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800', 0),
('commercial', 'Tijorat binolari', '🏢', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800', 0),
('land', 'Yer uchastkalari', '🏞️', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800', 0),
('cottage', 'Kottejlar', '🏡', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800', 0),
('office', 'Ofislar', '🏬', 'https://images.unsplash.com/photo-1497366216548-375f70e41755?w=800', 0);

-- ===================================
-- SERVICE CATEGORIES SEED DATA
-- ===================================
INSERT INTO service_categories (id, name, icon, catalog_id, service_count) VALUES
('repair', 'Ta''mirlash', '🔧', 'home', 0),
('cleaning', 'Tozalash', '🧹', 'home', 0),
('beauty', 'Go''zallik', '💇', 'personal', 0),
('health', 'Sog''liq', '⚕️', 'health', 0),
('education', 'Ta''lim', '📚', 'education', 0),
('legal', 'Yuridik', '⚖️', 'business', 0),
('it', 'IT xizmatlar', '💻', 'technology', 0),
('transport', 'Transport', '🚗', 'transport', 0);

-- ===================================
-- RENTAL CATEGORIES SEED DATA
-- ===================================
INSERT INTO rental_categories (id, name, icon, image, count) VALUES
('tools', 'Asbob-uskunalar', '🔧', 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800', 0),
('vehicles', 'Transport vositalari', '🚗', 'https://images.unsplash.com/photo-1550355241-3a921004b4a3?w=800', 0),
('equipment', 'Uskunalar', '⚙️', 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800', 0),
('property', 'Mulkni ijaraga', '🏠', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800', 0),
('clothing', 'Kiyim-kechak', '👔', 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800', 0);

-- ===================================
-- PLACE CATEGORIES SEED DATA
-- ===================================
INSERT INTO place_categories (id, name, icon, image, count) VALUES
('pharmacy', 'Dorixona', '💊', 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=600&q=80', 0),
('night', 'Kechagi', '🌙', 'https://images.unsplash.com/photo-1555992336-fb0d29498b13?w=600&q=80', 0),
('hospital', 'Kasalxona', '🏥', 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600&q=80', 0),
('school', 'Maktab', '🏫', 'https://images.unsplash.com/photo-1581078426770-6d336e5de7bf?w=600&q=80', 0),
('bank', 'Bank', '🏦', 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&q=80', 0),
('restaurant', 'Restoran', '🍽️', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80', 0),
('shopping', 'Savdo markazi', '🛍️', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80', 0),
('park', 'Park', '🌳', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80', 0);

-- ===================================
-- STORE CATEGORIES SEED DATA
-- ===================================
INSERT INTO store_categories (id, name, icon, image, count) VALUES
('electronics', 'Elektronika', '📱', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800', 0),
('clothing', 'Kiyim-kechak', '👔', 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800', 0),
('food', 'Oziq-ovqat', '🍎', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800', 0),
('furniture', 'Mebel', '🪑', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800', 0),
('sports', 'Sport tovarlari', '⚽', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800', 0),
('books', 'Kitoblar', '📚', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800', 0),
('toys', 'O''yinchoqlar', '🎮', 'https://images.unsplash.com/photo-1612287230202-1ff1d85d22b7?w=800', 0),
('beauty', 'Kosmetika', '💄', 'https://images.unsplash.com/photo-1596462502278-27d435534aa6?w=800', 0);
