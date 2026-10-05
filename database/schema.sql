-- ==========================================================
-- OUT OF THE TOWN - RESTRO AND BAKERY
-- MYSQL RELATIONAL DATABASE SCHEMA
-- ==========================================================

-- 1. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(32) NOT NULL,
  customer_email VARCHAR(255) NULL,
  order_type VARCHAR(32) NOT NULL,
  delivery_address TEXT NULL,
  table_number VARCHAR(32) NULL,
  items JSON NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  promo_code VARCHAR(64) NULL,
  payment_method VARCHAR(32) NOT NULL,
  payment_status VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  status_notes TEXT NULL,
  accepted_by VARCHAR(255) NULL,
  accepted_at VARCHAR(64) NULL,
  estimated_time_minutes INT DEFAULT 20,
  extra_json LONGTEXT NULL,
  created_at VARCHAR(64) NOT NULL,
  INDEX idx_orders_status (status),
  INDEX idx_orders_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table Reservations
CREATE TABLE IF NOT EXISTS reservations (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(32) NOT NULL,
  customer_email VARCHAR(255) NULL,
  date VARCHAR(32) NOT NULL,
  time VARCHAR(32) NOT NULL,
  guest_count INT NOT NULL DEFAULT 2,
  seating_area VARCHAR(64) NOT NULL,
  special_requests TEXT NULL,
  status VARCHAR(32) NOT NULL,
  created_at VARCHAR(64) NOT NULL,
  INDEX idx_reservations_datetime (date, time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(64) NOT NULL,
  image LONGTEXT NULL,
  is_veg TINYINT(1) NOT NULL DEFAULT 1,
  is_egg TINYINT(1) NOT NULL DEFAULT 0,
  is_spicy TINYINT(1) NOT NULL DEFAULT 0,
  is_bestseller TINYINT(1) NOT NULL DEFAULT 0,
  rating DECIMAL(3, 1) DEFAULT 4.8,
  reviews_count INT DEFAULT 50,
  tags JSON NULL,
  available TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_menu_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Promotional Banners
CREATE TABLE IF NOT EXISTS promo_banners (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT NULL,
  promo_code VARCHAR(64) NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
  image LONGTEXT NULL,
  badge_text VARCHAR(64) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  link VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Cafe Information
CREATE TABLE IF NOT EXISTS cafe_info (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tagline TEXT NULL,
  phone VARCHAR(64) NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  opening_hours TEXT NULL,
  announcement TEXT NULL,
  is_open TINYINT(1) NOT NULL DEFAULT 1,
  closed_until VARCHAR(64) NULL,
  closed_reason TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  invoice_number VARCHAR(64) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(32) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(32) NOT NULL,
  items JSON NOT NULL,
  created_at VARCHAR(64) NOT NULL,
  INDEX idx_invoices_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  created_at VARCHAR(64) NOT NULL,
  last_login VARCHAR(64) NOT NULL,
  INDEX idx_customers_phone (phone),
  INDEX idx_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Food Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(64) NOT NULL UNIQUE,
  icon VARCHAR(64) DEFAULT 'Sparkles',
  description TEXT NULL,
  image TEXT NULL,
  display_order INT DEFAULT 0,
  created_at VARCHAR(64) NOT NULL,
  INDEX idx_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Staff & Delivery Partner Accounts (full account record as JSON)
CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(96) NOT NULL PRIMARY KEY,
  data LONGTEXT NOT NULL,
  updated_at VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Admin Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(96) NOT NULL PRIMARY KEY,
  data TEXT NOT NULL,
  created_at VARCHAR(64) NOT NULL,
  INDEX idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
