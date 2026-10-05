import mysql from 'mysql2/promise';

export interface MySQLConfig {
  host: string | null;
  port: number;
  user: string | null;
  database: string | null;
  hasPassword: boolean;
  ssl: boolean;
  isConfigured: boolean;
  connectionStringSummary: string | null;
}

let pool: mysql.Pool | null = null;
let hasLoggedMissingConfig = false;
let isSchemaInitialized = false;

/**
 * Parses MySQL connection configuration from environment variables.
 * Supports:
 * - MYSQL_URL or DATABASE_URL (e.g. mysql://user:password@host:3306/database)
 * - Individual vars: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_SSL
 */
export function getMySQLConfig(): MySQLConfig {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;

  if (url && (url.startsWith('mysql://') || url.startsWith('mysql2://'))) {
    try {
      const parsed = new URL(url);
      const dbName = parsed.pathname ? parsed.pathname.replace(/^\//, '') : null;
      return {
        host: parsed.hostname || null,
        port: parsed.port ? parseInt(parsed.port, 10) : 3306,
        user: parsed.username || null,
        database: dbName || null,
        hasPassword: Boolean(parsed.password),
        ssl: parsed.searchParams.get('ssl') === 'true' || url.includes('ssl='),
        isConfigured: Boolean(parsed.hostname && dbName),
        connectionStringSummary: `mysql://${parsed.username ? parsed.username + '@' : ''}${parsed.hostname}:${parsed.port || 3306}/${dbName || ''}`,
      };
    } catch {
      // Fall through to standard env vars
    }
  }

  const host = process.env.MYSQL_HOST || null;
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306;
  const user = process.env.MYSQL_USER || null;
  const database = process.env.MYSQL_DATABASE || null;
  const password = process.env.MYSQL_PASSWORD || null;
  const ssl = process.env.MYSQL_SSL === 'true' || process.env.MYSQL_SSL === '1';

  const isConfigured = Boolean(host && database && user);

  return {
    host,
    port,
    user,
    database,
    hasPassword: Boolean(password),
    ssl,
    isConfigured,
    connectionStringSummary: isConfigured ? `mysql://${user}@${host}:${port}/${database}` : null,
  };
}

/**
 * Returns a singleton connection pool for MySQL.
 * Uses lazy initialization to prevent startup crashes when env variables are not set.
 */
export function getMySQLPool(): mysql.Pool | null {
  const config = getMySQLConfig();

  if (!config.isConfigured) {
    if (!hasLoggedMissingConfig) {
      console.log(
        '[MySQL] Environment variables (MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE or MYSQL_URL/DATABASE_URL) are not set. Operating with local high-performance store.'
      );
      hasLoggedMissingConfig = true;
    }
    return null;
  }

  if (!pool) {
    try {
      const rawUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
      if (rawUrl && (rawUrl.startsWith('mysql://') || rawUrl.startsWith('mysql2://'))) {
        pool = mysql.createPool({
          uri: rawUrl,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          connectTimeout: 10000,
        });
      } else {
        const poolConfig: mysql.PoolOptions = {
          host: config.host || 'localhost',
          port: config.port,
          user: config.user || 'root',
          password: process.env.MYSQL_PASSWORD || '',
          database: config.database || 'ott_restro',
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          connectTimeout: 10000,
        };

        if (config.ssl) {
          poolConfig.ssl = {
            rejectUnauthorized: false,
          };
        }

        pool = mysql.createPool(poolConfig);
      }

      console.log(`[MySQL] Connection pool created for ${config.connectionStringSummary}`);
    } catch (err) {
      console.error('[MySQL] Failed to initialize MySQL connection pool:', err);
      return null;
    }
  }

  return pool;
}

/**
 * Initializes tables if MySQL is connected and tables don't exist yet
 */
export async function ensureMySQLTables(): Promise<boolean> {
  if (isSchemaInitialized) return true;
  const p = getMySQLPool();
  if (!p) return false;

  try {
    // Strip `-- comment` lines BEFORE splitting on ';'. The schema puts a comment line
    // directly above each CREATE TABLE (e.g. "-- 1. Orders Table\nCREATE TABLE..."), both
    // inside the same ';'-delimited chunk — filtering out any chunk that merely *starts with*
    // '--' (the previous approach) discards every real statement along with its comment,
    // since the comment line is what the trimmed chunk starts with. That left this function
    // executing zero CREATE TABLE statements while still logging success and returning true:
    // MySQL persistence silently never created a single table in any real deployment.
    const schemaWithoutComments = MYSQL_SQL_SCHEMA
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    const ddlStatements = schemaWithoutComments
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let executed = 0;
    for (const stmt of ddlStatements) {
      if (stmt.toUpperCase().startsWith('CREATE TABLE')) {
        await p.query(stmt);
        executed++;
      }
    }

    if (executed === 0) {
      console.warn('[MySQL] Schema creation found zero CREATE TABLE statements to run — not marking schema as initialized.');
      return false;
    }

    // Widen `image` columns on tables created before device-upload support was added --
    // CREATE TABLE IF NOT EXISTS above is a no-op on an already-existing table, so a
    // deployed DB from before this change would still have TEXT (64KB max), which is too
    // small for a base64-encoded photo and would fail/truncate on save. MODIFY COLUMN is
    // safe to re-run every cold start: a no-op once the column is already LONGTEXT.
    try {
      await p.query('ALTER TABLE menu_items MODIFY COLUMN image LONGTEXT NULL');
      await p.query('ALTER TABLE promo_banners MODIFY COLUMN image LONGTEXT NULL');
    } catch (err: any) {
      console.warn('[MySQL] Could not widen image columns to LONGTEXT:', err.message);
    }

    // Add open/closed status columns for cafe_info tables created before this feature
    // existed -- CREATE TABLE IF NOT EXISTS above is a no-op on an already-existing table.
    // ADD COLUMN IF NOT EXISTS isn't supported on MySQL 5.7/older MariaDB, so each column
    // is added individually and a "duplicate column" error (already added) is swallowed.
    for (const stmt of [
      'ALTER TABLE cafe_info ADD COLUMN is_open TINYINT(1) NOT NULL DEFAULT 1',
      'ALTER TABLE cafe_info ADD COLUMN closed_until VARCHAR(64) NULL',
      'ALTER TABLE cafe_info ADD COLUMN closed_reason TEXT NULL',
      // Delivery assignment/tracking and special instructions had no column at all, so they
      // vanished on every restart and every time the dashboard re-read orders from MySQL.
      'ALTER TABLE orders ADD COLUMN extra_json LONGTEXT NULL',
    ]) {
      try {
        await p.query(stmt);
      } catch (err: any) {
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.warn('[MySQL] Could not add column:', err.message);
        }
      }
    }

    isSchemaInitialized = true;
    console.log(`[MySQL] Schema verified: ${executed} core table(s) checked/created.`);
    return true;
  } catch (err: any) {
    console.warn('[MySQL] Auto-schema creation note:', err.message);
    return false;
  }
}

/**
 * Complete MySQL SQL Schema script with clean DDL, primary keys, and indices.
 * Fully compatible with MySQL 5.7, 8.0+, MariaDB, AWS RDS, GCP Cloud SQL, PlanetScale, and Aiven.
 */
export const MYSQL_SQL_SCHEMA = `-- ==========================================================
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
`;
