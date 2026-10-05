import { getMySQLPool, getMySQLConfig, ensureMySQLTables, MYSQL_SQL_SCHEMA } from './mysql';
import type { Order, Reservation, MenuItem, PromoBanner, CafeInfo, AdminAccessUser, AuditLog } from '../src/types';
import { OTT_MENU_ITEMS } from '../src/data/ottPdfMenu';

// menu_items has no ordering column and fetchMenuItems sorts by name, so every hydration
// (boot, and the 10-minute auto-sync) used to flip the menu to A-Z. Restore the curated
// seed order; dishes an admin added later aren't in the seed and go first, matching how
// the admin create route unshifts them onto the in-memory list.
const CURATED_MENU_INDEX = new Map(OTT_MENU_ITEMS.map((item, i) => [item.id, i]));
export function orderLikeCuratedMenu(items: MenuItem[]): MenuItem[] {
  const added = items.filter((item) => !CURATED_MENU_INDEX.has(item.id));
  const curated = items
    .filter((item) => CURATED_MENU_INDEX.has(item.id))
    .sort((a, b) => CURATED_MENU_INDEX.get(a.id)! - CURATED_MENU_INDEX.get(b.id)!);
  return [...added, ...curated];
}

export const ALL_EXPECTED_TABLES = [
  'orders',
  'reservations',
  'menu_items',
  'categories',
  'promo_banners',
  'cafe_info',
  'invoices',
  'customers',
  'admin_users',
  'audit_logs',
];

// ORD-1001 was a demo "Satyam Kumar" dine-in visit seeded into every fresh install.
export const FAKE_ORDER_IDS = new Set(['ORD-8925', 'ORD-8924', 'ORD-8921', 'ORD-8920', 'ORD-8918', 'ORD-1001']);

// Order fields that have no dedicated column, stored together in orders.extra_json.
function orderExtras(order: Order) {
  return {
    deliveryPartner: order.deliveryPartner,
    deliveryTracking: order.deliveryTracking,
    specialInstructions: order.specialInstructions,
  };
}

// Combine orders read from MySQL with the in-memory list. The in-memory copy of an order is
// always at least as new (every change lands there first and is written to MySQL in the
// background), so it wins -- replacing memory with the DB rows, as before, briefly rolled back
// a status change the owner had just made whenever the dashboard refreshed mid-write.
export function mergeById<T extends { id: string; createdAt?: string }>(fromDb: T[], inMemory: T[]): T[] {
  const memoryIds = new Set(inMemory.map((x) => x.id));
  const merged = [...inMemory, ...fromDb.filter((x) => !memoryIds.has(x.id))];
  return merged.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}
export const FAKE_CUSTOMER_NAMES = new Set([
  'Kabir Verma',
  'Meenakshi Rathore',
  'Aarav Sharma',
  'Priya Meena',
  'Rohan Deshmukh',
]);

export function isFakeOrder(order: { id?: string; customerName?: string; customer_name?: string }): boolean {
  if (order.id && FAKE_ORDER_IDS.has(order.id)) return true;
  const name = order.customerName || order.customer_name;
  if (name && FAKE_CUSTOMER_NAMES.has(name)) return true;
  return false;
}

export const FAKE_RESV_IDS = new Set(['RES-5011', 'RES-5012']);
export const FAKE_RESV_NAMES = new Set(['Rohit Khandelwal', 'Neha Rathore']);

export function isFakeReservation(resv: { id?: string; customerName?: string; customer_name?: string }): boolean {
  if (resv.id && FAKE_RESV_IDS.has(resv.id)) return true;
  const name = resv.customerName || resv.customer_name;
  if (name && FAKE_RESV_NAMES.has(name)) return true;
  return false;
}

// Convert MySQL row back to Order
export function rowToOrder(row: any): Order {
  let parsedItems = row.items;
  if (typeof parsedItems === 'string') {
    try {
      parsedItems = JSON.parse(parsedItems);
    } catch {
      parsedItems = [];
    }
  } else if (!Array.isArray(parsedItems)) {
    parsedItems = [];
  }

  const customDetails = parsedItems.find((it: any) => it.customCakeDetails)?.customCakeDetails;

  let extras: Partial<Order> = {};
  if (row.extra_json) {
    try {
      extras = typeof row.extra_json === 'string' ? JSON.parse(row.extra_json) : row.extra_json;
    } catch {
      extras = {};
    }
  }

  return {
    id: row.id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email || undefined,
    orderType: row.order_type,
    deliveryAddress: row.delivery_address || undefined,
    tableNumber: row.table_number || undefined,
    items: parsedItems,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount || 0),
    deliveryFee: Number(row.delivery_fee || 0),
    tax: Number(row.tax || 0),
    total: Number(row.total),
    promoCode: row.promo_code || undefined,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    status: row.status,
    statusNotes: row.status_notes || undefined,
    acceptedBy: row.accepted_by || undefined,
    acceptedAt: row.accepted_at || undefined,
    estimatedTimeMinutes: row.estimated_time_minutes ?? undefined,
    createdAt: row.created_at,
    isCustomCake: Boolean(customDetails),
    customCakeDetails: customDetails,
    deliveryPartner: extras.deliveryPartner || undefined,
    deliveryTracking: extras.deliveryTracking || undefined,
    specialInstructions: extras.specialInstructions || undefined,
  };
}

export function rowToReservation(row: any): Reservation {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email || undefined,
    date: row.date,
    time: row.time,
    guestCount: Number(row.guest_count),
    seatingArea: row.seating_area,
    specialRequests: row.special_requests || undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

export class MySQLService {
  private static adminUsersHydrated = false;
  private static auditLogsHydrated = false;

  /**
   * Probes MySQL database for existing tables
   */
  public static async getActiveTables(): Promise<Set<string>> {
    const pool = getMySQLPool();
    if (!pool) return new Set();

    try {
      await ensureMySQLTables();
      const config = getMySQLConfig();
      const dbName = config.database;

      const [rows] = await pool.query<any[]>(
        `SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ?`,
        [dbName]
      );

      const tableSet = new Set<string>();
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const name = r.TABLE_NAME || r.table_name;
          if (name) tableSet.add(name.toLowerCase());
        }
      }
      return tableSet;
    } catch (err: any) {
      console.warn('[MySQL] Error probing tables:', err.message);
      return new Set();
    }
  }

  // =====================================
  // 1. ORDERS
  // =====================================
  public static async saveOrder(order: Order): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;
    if (isFakeOrder(order)) return false;

    try {
      await ensureMySQLTables();
      const itemsJson = JSON.stringify(order.items || []);

      const query = `
        INSERT INTO orders (
          id, customer_name, customer_phone, customer_email, order_type,
          delivery_address, table_number, items, subtotal, discount,
          delivery_fee, tax, total, promo_code, payment_method,
          payment_status, status, status_notes, accepted_by, accepted_at,
          estimated_time_minutes, extra_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          customer_name = VALUES(customer_name),
          customer_phone = VALUES(customer_phone),
          customer_email = VALUES(customer_email),
          order_type = VALUES(order_type),
          delivery_address = VALUES(delivery_address),
          table_number = VALUES(table_number),
          items = VALUES(items),
          subtotal = VALUES(subtotal),
          discount = VALUES(discount),
          delivery_fee = VALUES(delivery_fee),
          tax = VALUES(tax),
          total = VALUES(total),
          promo_code = VALUES(promo_code),
          payment_method = VALUES(payment_method),
          payment_status = VALUES(payment_status),
          status = VALUES(status),
          status_notes = VALUES(status_notes),
          accepted_by = VALUES(accepted_by),
          accepted_at = VALUES(accepted_at),
          estimated_time_minutes = VALUES(estimated_time_minutes),
          extra_json = VALUES(extra_json)
      `;

      await pool.execute(query, [
        order.id,
        order.customerName,
        order.customerPhone,
        order.customerEmail || null,
        order.orderType,
        order.deliveryAddress || null,
        order.tableNumber || null,
        itemsJson,
        order.subtotal || 0,
        order.discount || 0,
        order.deliveryFee || 0,
        order.tax || 0,
        order.total || 0,
        order.promoCode || null,
        order.paymentMethod,
        order.paymentStatus,
        order.status,
        order.statusNotes || null,
        order.acceptedBy || null,
        order.acceptedAt || null,
        order.estimatedTimeMinutes ?? 20,
        JSON.stringify(orderExtras(order)),
        order.createdAt || new Date().toISOString(),
      ]);

      return true;
    } catch (err: any) {
      console.warn(`[MySQL] saveOrder error for ${order.id}:`, err.message);
      return false;
    }
  }

  public static async deleteOrder(orderId: string): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await pool.execute(`DELETE FROM invoices WHERE order_id = ?`, [orderId]);
      await pool.execute(`DELETE FROM orders WHERE id = ?`, [orderId]);
      return true;
    } catch (err: any) {
      console.warn(`[MySQL] deleteOrder error for ${orderId}:`, err.message);
      return false;
    }
  }

  public static async updateOrderStatus(
    orderId: string,
    status: Order['status'],
    extras?: {
      acceptedBy?: string;
      acceptedAt?: string;
      estMinutes?: number;
      estimatedTimeMinutes?: number;
      notes?: string;
    }
  ): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      const updates: string[] = ['status = ?'];
      const values: any[] = [status];

      if (extras?.acceptedBy !== undefined) {
        updates.push('accepted_by = ?');
        values.push(extras.acceptedBy);
      }
      if (extras?.acceptedAt !== undefined) {
        updates.push('accepted_at = ?');
        values.push(extras.acceptedAt);
      }
      const estTime = extras?.estMinutes !== undefined ? extras.estMinutes : extras?.estimatedTimeMinutes;
      if (estTime !== undefined) {
        updates.push('estimated_time_minutes = ?');
        values.push(estTime);
      }
      if (extras?.notes !== undefined) {
        updates.push('status_notes = ?');
        values.push(extras.notes);
      }

      values.push(orderId);
      const query = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
      await pool.execute(query, values);
      return true;
    } catch (err: any) {
      console.warn(`[MySQL] updateOrderStatus error for ${orderId}:`, err.message);
      return false;
    }
  }

  public static async fetchOrders(): Promise<Order[] | null> {
    const pool = getMySQLPool();
    if (!pool) return null;

    try {
      const [rows] = await pool.query<any[]>(`SELECT * FROM orders ORDER BY created_at DESC`);
      if (!Array.isArray(rows)) return [];
      return rows.filter((r) => !isFakeOrder(r)).map(rowToOrder);
    } catch {
      return null;
    }
  }

  // =====================================
  // 2. RESERVATIONS
  // =====================================
  public static async saveReservation(r: Reservation): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;
    if (isFakeReservation(r)) return false;

    try {
      await ensureMySQLTables();
      const query = `
        INSERT INTO reservations (
          id, customer_name, customer_phone, customer_email, date, time,
          guest_count, seating_area, special_requests, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          customer_name = VALUES(customer_name),
          customer_phone = VALUES(customer_phone),
          customer_email = VALUES(customer_email),
          date = VALUES(date),
          time = VALUES(time),
          guest_count = VALUES(guest_count),
          seating_area = VALUES(seating_area),
          special_requests = VALUES(special_requests),
          status = VALUES(status)
      `;

      await pool.execute(query, [
        r.id,
        r.customerName,
        r.customerPhone,
        r.customerEmail || null,
        r.date,
        r.time,
        r.guestCount,
        r.seatingArea,
        r.specialRequests || null,
        r.status,
        r.createdAt || new Date().toISOString(),
      ]);

      return true;
    } catch (err: any) {
      console.warn(`[MySQL] saveReservation error for ${r.id}:`, err.message);
      return false;
    }
  }

  public static async updateReservationStatus(id: string, status: Reservation['status']): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await pool.execute(`UPDATE reservations SET status = ? WHERE id = ?`, [status, id]);
      return true;
    } catch (err: any) {
      console.warn(`[MySQL] updateReservationStatus error for ${id}:`, err.message);
      return false;
    }
  }

  public static async deleteReservation(id: string): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await pool.execute(`DELETE FROM reservations WHERE id = ?`, [id]);
      return true;
    } catch (err: any) {
      console.warn(`[MySQL] deleteReservation error for ${id}:`, err.message);
      return false;
    }
  }

  public static async fetchReservations(): Promise<Reservation[] | null> {
    const pool = getMySQLPool();
    if (!pool) return null;

    try {
      const [rows] = await pool.query<any[]>(`SELECT * FROM reservations ORDER BY created_at DESC`);
      if (!Array.isArray(rows)) return [];
      return rows.filter((r) => !isFakeReservation(r)).map(rowToReservation);
    } catch {
      return null;
    }
  }

  // =====================================
  // 3. MENU ITEMS
  // =====================================
  public static async saveMenuItem(item: MenuItem): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await ensureMySQLTables();
      const tagsJson = JSON.stringify(item.tags || []);

      const query = `
        INSERT INTO menu_items (
          id, name, description, price, category, image,
          is_veg, is_egg, is_spicy, is_bestseller, rating, reviews_count, tags, available
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          description = VALUES(description),
          price = VALUES(price),
          category = VALUES(category),
          image = VALUES(image),
          is_veg = VALUES(is_veg),
          is_egg = VALUES(is_egg),
          is_spicy = VALUES(is_spicy),
          is_bestseller = VALUES(is_bestseller),
          rating = VALUES(rating),
          reviews_count = VALUES(reviews_count),
          tags = VALUES(tags),
          available = VALUES(available)
      `;

      await pool.execute(query, [
        item.id,
        item.name,
        item.description || null,
        item.price,
        item.category,
        item.image || null,
        item.isVeg ? 1 : 0,
        item.isEgg ? 1 : 0,
        0, // isSpicy
        item.isBestseller ? 1 : 0,
        item.rating || 4.8,
        item.reviewsCount || 50,
        tagsJson,
        item.isAvailable !== false ? 1 : 0,
      ]);

      return true;
    } catch (err: any) {
      console.warn(`[MySQL] saveMenuItem error for ${item.id}:`, err.message);
      return false;
    }
  }

  public static async deleteMenuItem(id: string): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await pool.execute(`DELETE FROM menu_items WHERE id = ?`, [id]);
      return true;
    } catch (err: any) {
      console.warn(`[MySQL] deleteMenuItem error for ${id}:`, err.message);
      return false;
    }
  }

  public static async fetchMenuItems(): Promise<MenuItem[] | null> {
    const pool = getMySQLPool();
    if (!pool) return null;

    try {
      const [rows] = await pool.query<any[]>(`SELECT * FROM menu_items ORDER BY name ASC`);
      if (!Array.isArray(rows)) return [];

      return rows.map((r: any) => {
        let parsedTags = r.tags;
        if (typeof parsedTags === 'string') {
          try {
            parsedTags = JSON.parse(parsedTags);
          } catch {
            parsedTags = [];
          }
        }
        return {
          id: r.id,
          name: r.name,
          description: r.description || '',
          price: Number(r.price),
          category: r.category,
          image: r.image || '',
          isVeg: Boolean(r.is_veg),
          isEgg: Boolean(r.is_egg),
          isBestseller: Boolean(r.is_bestseller),
          isAvailable: Boolean(r.available),
          rating: Number(r.rating || 4.8),
          reviewsCount: Number(r.reviews_count || 50),
          tags: Array.isArray(parsedTags) ? parsedTags : [],
        };
      });
    } catch {
      return null;
    }
  }

  // =====================================
  // 4. PROMO BANNERS
  // =====================================
  public static async saveBanner(banner: PromoBanner): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await ensureMySQLTables();
      const query = `
        INSERT INTO promo_banners (
          id, title, subtitle, promo_code, discount_percentage, image, badge_text, active, link
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          subtitle = VALUES(subtitle),
          promo_code = VALUES(promo_code),
          discount_percentage = VALUES(discount_percentage),
          image = VALUES(image),
          badge_text = VALUES(badge_text),
          active = VALUES(active),
          link = VALUES(link)
      `;

      await pool.execute(query, [
        banner.id,
        banner.title,
        banner.subtitle || null,
        banner.code || null,
        0, // discountPercentage
        banner.imageUrl || null,
        banner.highlightBadge || null,
        banner.active !== false ? 1 : 0,
        banner.targetCategory || null,
      ]);

      return true;
    } catch (err: any) {
      console.warn(`[MySQL] saveBanner error for ${banner.id}:`, err.message);
      return false;
    }
  }

  public static async deleteBanner(id: string): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await pool.execute(`DELETE FROM promo_banners WHERE id = ?`, [id]);
      return true;
    } catch (err: any) {
      console.warn(`[MySQL] deleteBanner error for ${id}:`, err.message);
      return false;
    }
  }

  public static async fetchBanners(): Promise<PromoBanner[] | null> {
    const pool = getMySQLPool();
    if (!pool) return null;

    try {
      const [rows] = await pool.query<any[]>(`SELECT * FROM promo_banners`);
      if (!Array.isArray(rows)) return [];

      return rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle || '',
        highlightBadge: r.badge_text || 'SPECIAL',
        discountText: 'Special Offer',
        code: r.promo_code || 'OTTSPECIAL',
        imageUrl: r.image || '',
        badgeBgColor: 'bg-amber-600',
        targetCategory: r.link || undefined,
        active: Boolean(r.active),
      }));
    } catch {
      return null;
    }
  }

  // =====================================
  // 5. FOOD CATEGORIES
  // =====================================
  public static async saveCategory(cat: {
    id: string;
    name: string;
    slug: string;
    icon?: string;
    description?: string;
    image?: string;
    displayOrder?: number;
    createdAt?: string;
  }): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await ensureMySQLTables();
      const query = `
        INSERT INTO categories (
          id, name, slug, icon, description, image, display_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          icon = VALUES(icon),
          description = VALUES(description),
          image = VALUES(image),
          display_order = VALUES(display_order)
      `;

      await pool.execute(query, [
        cat.id,
        cat.name,
        cat.slug,
        cat.icon || 'Sparkles',
        cat.description || null,
        cat.image || null,
        cat.displayOrder || 0,
        cat.createdAt || new Date().toISOString(),
      ]);

      return true;
    } catch (err: any) {
      console.warn(`[MySQL] saveCategory error for ${cat.slug}:`, err.message);
      return false;
    }
  }

  public static async deleteCategory(id: string): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await pool.execute(`DELETE FROM categories WHERE id = ?`, [id]);
      return true;
    } catch (err: any) {
      console.warn(`[MySQL] deleteCategory error for ${id}:`, err.message);
      return false;
    }
  }

  public static async fetchCategories(): Promise<any[] | null> {
    const pool = getMySQLPool();
    if (!pool) return null;

    try {
      const [rows] = await pool.query<any[]>(`SELECT * FROM categories ORDER BY display_order ASC, name ASC`);
      if (!Array.isArray(rows)) return [];

      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        icon: r.icon,
        description: r.description,
        image: r.image,
        displayOrder: r.display_order,
      }));
    } catch {
      return null;
    }
  }

  // =====================================
  // 6. CAFE INFO
  // =====================================
  public static async saveCafeInfo(info: CafeInfo): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await ensureMySQLTables();
      const query = `
        INSERT INTO cafe_info (
          id, name, tagline, phone, email, address, opening_hours, announcement,
          is_open, closed_until, closed_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          tagline = VALUES(tagline),
          phone = VALUES(phone),
          email = VALUES(email),
          address = VALUES(address),
          opening_hours = VALUES(opening_hours),
          announcement = VALUES(announcement),
          is_open = VALUES(is_open),
          closed_until = VALUES(closed_until),
          closed_reason = VALUES(closed_reason)
      `;

      await pool.execute(query, [
        'default_cafe',
        info.name,
        info.tagline || null,
        info.phone,
        info.email,
        info.address,
        info.openingHours,
        info.announcement || null,
        info.isOpen === false ? 0 : 1,
        info.closedUntil || null,
        info.closedReason || null,
      ]);

      return true;
    } catch (err: any) {
      console.warn(`[MySQL] saveCafeInfo error:`, err.message);
      return false;
    }
  }

  public static async fetchCafeInfo(): Promise<CafeInfo | null> {
    const pool = getMySQLPool();
    if (!pool) return null;

    try {
      const [rows] = await pool.query<any[]>(`SELECT * FROM cafe_info WHERE id = 'default_cafe' LIMIT 1`);
      if (!Array.isArray(rows) || rows.length === 0) return null;

      const r = rows[0];
      return {
        name: r.name,
        tagline: r.tagline || '',
        phone: r.phone || '',
        email: r.email || '',
        address: r.address || '',
        openingHours: r.opening_hours || '',
        announcement: r.announcement || '',
        isOpen: r.is_open === undefined || r.is_open === null ? true : Boolean(r.is_open),
        closedUntil: r.closed_until || null,
        closedReason: r.closed_reason || '',
      };
    } catch {
      return null;
    }
  }

  // =====================================
  // 7. INVOICES
  // =====================================
  public static async saveInvoice(inv: {
    id: string;
    orderId: string;
    invoiceNumber: string;
    customerName: string;
    customerPhone: string;
    subtotal: number;
    discount: number;
    deliveryFee: number;
    tax: number;
    total: number;
    paymentMethod: string;
    items: any[];
    createdAt: string;
  }): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await ensureMySQLTables();
      const itemsJson = JSON.stringify(inv.items || []);

      const query = `
        INSERT INTO invoices (
          id, order_id, invoice_number, customer_name, customer_phone,
          subtotal, discount, delivery_fee, tax, total,
          payment_method, items, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          invoice_number = VALUES(invoice_number),
          customer_name = VALUES(customer_name),
          customer_phone = VALUES(customer_phone),
          subtotal = VALUES(subtotal),
          discount = VALUES(discount),
          delivery_fee = VALUES(delivery_fee),
          tax = VALUES(tax),
          total = VALUES(total),
          payment_method = VALUES(payment_method),
          items = VALUES(items)
      `;

      await pool.execute(query, [
        inv.id,
        inv.orderId,
        inv.invoiceNumber,
        inv.customerName,
        inv.customerPhone,
        inv.subtotal,
        inv.discount,
        inv.deliveryFee,
        inv.tax,
        inv.total,
        inv.paymentMethod,
        itemsJson,
        inv.createdAt || new Date().toISOString(),
      ]);

      return true;
    } catch (err: any) {
      console.warn(`[MySQL] saveInvoice error for ${inv.id}:`, err.message);
      return false;
    }
  }

  // =====================================
  // 8. CUSTOMERS
  // =====================================
  public static async saveCustomer(c: {
    id: string;
    name: string;
    phone: string;
    email: string;
    createdAt: string;
    lastLogin?: string;
  }): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await ensureMySQLTables();
      const query = `
        INSERT INTO customers (id, name, phone, email, created_at, last_login)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          email = VALUES(email),
          last_login = VALUES(last_login)
      `;

      await pool.execute(query, [c.id, c.name, c.phone, c.email, c.createdAt, c.lastLogin || new Date().toISOString()]);
      return true;
    } catch (err: any) {
      console.warn(`[MySQL] saveCustomer error for ${c.phone}:`, err.message);
      return false;
    }
  }

  public static async fetchCustomers(): Promise<any[] | null> {
    const pool = getMySQLPool();
    if (!pool) return null;

    try {
      const [rows] = await pool.query<any[]>(`SELECT * FROM customers ORDER BY created_at DESC`);
      if (!Array.isArray(rows)) return [];

      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        createdAt: r.created_at,
        lastLogin: r.last_login,
      }));
    } catch {
      return null;
    }
  }

  // =====================================
  // 9. STAFF & DELIVERY PARTNER ACCOUNTS
  // =====================================
  // Staff/rider accounts used to live only in memory: every restart or redeploy deleted every
  // account the owner had created. The list is small, so it is written out whole on change.
  public static async saveAdminUsers(users: AdminAccessUser[]): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await ensureMySQLTables();
      const now = new Date().toISOString();
      for (const u of users) {
        await pool.execute(
          `INSERT INTO admin_users (id, data, updated_at) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)`,
          [u.id, JSON.stringify(u), now]
        );
      }
      if (users.length > 0) {
        await pool.query(`DELETE FROM admin_users WHERE id NOT IN (?)`, [users.map((u) => u.id)]);
      }
      return true;
    } catch (err: any) {
      console.warn('[MySQL] saveAdminUsers error:', err.message);
      return false;
    }
  }

  public static async fetchAdminUsers(): Promise<AdminAccessUser[] | null> {
    const pool = getMySQLPool();
    if (!pool) return null;

    try {
      const [rows] = await pool.query<any[]>(`SELECT data FROM admin_users`);
      if (!Array.isArray(rows)) return [];
      const users: AdminAccessUser[] = [];
      for (const r of rows) {
        try {
          users.push(JSON.parse(r.data));
        } catch {
          // skip a corrupt row rather than losing the whole team
        }
      }
      return users;
    } catch {
      return null;
    }
  }

  // =====================================
  // 10. AUDIT LOG
  // =====================================
  public static async saveAuditLog(log: AuditLog): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) return false;

    try {
      await ensureMySQLTables();
      await pool.execute(`INSERT IGNORE INTO audit_logs (id, data, created_at) VALUES (?, ?, ?)`, [
        log.id,
        JSON.stringify(log),
        log.timestamp,
      ]);
      return true;
    } catch (err: any) {
      console.warn('[MySQL] saveAuditLog error:', err.message);
      return false;
    }
  }

  public static async fetchAuditLogs(limit = 1000): Promise<AuditLog[] | null> {
    const pool = getMySQLPool();
    if (!pool) return null;

    try {
      const [rows] = await pool.query<any[]>(`SELECT data FROM audit_logs ORDER BY created_at DESC LIMIT ?`, [limit]);
      if (!Array.isArray(rows)) return [];
      const logs: AuditLog[] = [];
      for (const r of rows) {
        try {
          logs.push(JSON.parse(r.data));
        } catch {
          // skip corrupt row
        }
      }
      return logs;
    } catch {
      return null;
    }
  }

  // =====================================
  // SYSTEM HYDRATION & PERSISTENCE
  // =====================================
  public static async hydrateStoreFromMySQL(store: any): Promise<boolean> {
    const pool = getMySQLPool();
    if (!pool) {
      console.log('[MySQL] Not configured yet. Operating with local in-memory store.');
      return false;
    }

    try {
      await ensureMySQLTables();
      const activeTables = await MySQLService.getActiveTables();

      console.log(`[MySQL] Hydrating store from MySQL (${activeTables.size} active tables detected)...`);

      // 1. Cafe Info
      if (activeTables.has('cafe_info')) {
        const dbCafeInfo = await MySQLService.fetchCafeInfo();
        if (dbCafeInfo) {
          store.cafeInfo = { ...store.cafeInfo, ...dbCafeInfo };
        } else if (store.cafeInfo) {
          await MySQLService.saveCafeInfo(store.cafeInfo);
        }
      }

      // 2. Menu Items
      if (activeTables.has('menu_items')) {
        const dbMenu = await MySQLService.fetchMenuItems();
        if (dbMenu && dbMenu.length > 0) {
          store.menuItems = orderLikeCuratedMenu(dbMenu);
          console.log(`[MySQL] Loaded ${dbMenu.length} menu items from database.`);
        } else if (store.menuItems && store.menuItems.length > 0) {
          for (const item of store.menuItems) {
            await MySQLService.saveMenuItem(item);
          }
        }
      }

      // 3. Promo Banners
      if (activeTables.has('promo_banners')) {
        const dbBanners = await MySQLService.fetchBanners();
        if (dbBanners && dbBanners.length > 0) {
          store.promoBanners = dbBanners;
          console.log(`[MySQL] Loaded ${dbBanners.length} promo banners from database.`);
        } else if (store.promoBanners && store.promoBanners.length > 0) {
          for (const banner of store.promoBanners) {
            await MySQLService.saveBanner(banner);
          }
        }
      }

      // 4. Food Categories
      if (activeTables.has('categories')) {
        const dbCategories = await MySQLService.fetchCategories();
        if (dbCategories && dbCategories.length > 0) {
          store.categories = dbCategories;
          console.log(`[MySQL] Loaded ${dbCategories.length} food categories from database.`);
        } else if (store.categories && store.categories.length > 0) {
          for (const cat of store.categories) {
            await MySQLService.saveCategory(cat);
          }
        }
      }

      // 5. Orders (Strictly genuine customer orders only)
      if (activeTables.has('orders')) {
        const dbOrders = await MySQLService.fetchOrders();
        if (dbOrders && dbOrders.length > 0) {
          const fakeOrders = dbOrders.filter(isFakeOrder);
          for (const fake of fakeOrders) {
            await MySQLService.deleteOrder(fake.id).catch(() => {});
          }
          const realOrders = dbOrders.filter((o) => !isFakeOrder(o));
          store.orders = mergeById(realOrders, store.orders.filter((o: Order) => !isFakeOrder(o)));
          console.log(`[MySQL] Loaded ${realOrders.length} real orders from database.`);
        }
      }

      // 6. Reservations (Strictly genuine customer reservations only)
      if (activeTables.has('reservations')) {
        const dbReservations = await MySQLService.fetchReservations();
        if (dbReservations && dbReservations.length > 0) {
          const fakeResvs = dbReservations.filter(isFakeReservation);
          for (const fake of fakeResvs) {
            await MySQLService.deleteReservation(fake.id).catch(() => {});
          }
          const realResvs = dbReservations.filter((r) => !isFakeReservation(r));
          store.reservations = mergeById(
            realResvs,
            store.reservations.filter((r: Reservation) => !isFakeReservation(r))
          );
          console.log(`[MySQL] Loaded ${realResvs.length} real reservations from database.`);
        }
      }

      // 7. Customers
      if (activeTables.has('customers')) {
        const dbCustomers = await MySQLService.fetchCustomers();
        if (dbCustomers && dbCustomers.length > 0) {
          const dbPhones = new Set(dbCustomers.map((c) => c.phone));
          const localRemaining = (store.customers || []).filter((c: any) => !dbPhones.has(c.phone));
          store.customers = [...dbCustomers, ...localRemaining];
          console.log(`[MySQL] Loaded ${dbCustomers.length} customers from database.`);
        }
      }

      // 8. Staff & rider accounts -- loaded once at boot. After that memory is the source of
      // truth (every change is written straight back), so the periodic sync must not reload
      // them and undo a login/passcode change made in between.
      if (activeTables.has('admin_users') && !MySQLService.adminUsersHydrated) {
        const dbUsers = await MySQLService.fetchAdminUsers();
        if (dbUsers) {
          MySQLService.adminUsersHydrated = true;
          if (dbUsers.length > 0) {
            // The seeded owner record is authoritative for its passcode (OWNER_PASSCODE env).
            const seededOwner = store.adminUsers.find((u: AdminAccessUser) => u.role === 'owner');
            const others = dbUsers.filter((u) => u.id !== seededOwner?.id && u.role !== 'owner');
            const dbOwner = dbUsers.find((u) => u.id === seededOwner?.id);
            const owner = seededOwner
              ? { ...(dbOwner || {}), ...seededOwner, sessionToken: dbOwner?.sessionToken, lastLogin: dbOwner?.lastLogin }
              : undefined;
            store.adminUsers = owner ? [owner, ...others] : others;
            console.log(`[MySQL] Loaded ${others.length} staff/rider account(s) from database.`);
          }
          await MySQLService.saveAdminUsers(store.adminUsers);
        }
      }

      // 9. Audit log (boot only, same reasoning)
      if (activeTables.has('audit_logs') && !MySQLService.auditLogsHydrated) {
        const dbLogs = await MySQLService.fetchAuditLogs();
        if (dbLogs) {
          MySQLService.auditLogsHydrated = true;
          const seen = new Set(dbLogs.map((l) => l.id));
          store.auditLogs = [...store.auditLogs.filter((l: AuditLog) => !seen.has(l.id)), ...dbLogs].slice(0, 1000);
        }
      }

      return true;
    } catch (err: any) {
      console.warn('[MySQL] Hydration error:', err.message);
      return false;
    }
  }

  /**
   * Check MySQL connection status and table state
   */
  public static async checkStatus(): Promise<{
    configured: boolean;
    connectionStringSummary: string | null;
    host: string | null;
    database: string | null;
    connected: boolean;
    tablesFound: string[];
    tablesMissing: string[];
    error?: string;
  }> {
    const config = getMySQLConfig();
    if (!config.isConfigured) {
      return {
        configured: false,
        connectionStringSummary: null,
        host: null,
        database: null,
        connected: false,
        tablesFound: [],
        tablesMissing: ALL_EXPECTED_TABLES,
      };
    }

    const pool = getMySQLPool();
    if (!pool) {
      return {
        configured: true,
        connectionStringSummary: config.connectionStringSummary,
        host: config.host,
        database: config.database,
        connected: false,
        tablesFound: [],
        tablesMissing: ALL_EXPECTED_TABLES,
        error: 'Connection pool could not be initialized.',
      };
    }

    try {
      // Test connectivity
      await pool.query('SELECT 1');
      await ensureMySQLTables();
      const activeTables = await MySQLService.getActiveTables();
      const tablesFound = Array.from(activeTables);
      const tablesMissing = ALL_EXPECTED_TABLES.filter((t) => !activeTables.has(t));

      return {
        configured: true,
        connectionStringSummary: config.connectionStringSummary,
        host: config.host,
        database: config.database,
        connected: true,
        tablesFound,
        tablesMissing,
      };
    } catch (err: any) {
      return {
        configured: true,
        connectionStringSummary: config.connectionStringSummary,
        host: config.host,
        database: config.database,
        connected: false,
        tablesFound: [],
        tablesMissing: ALL_EXPECTED_TABLES,
        error: err.message,
      };
    }
  }

  public static getSchemaSql(): string {
    return MYSQL_SQL_SCHEMA;
  }
}
