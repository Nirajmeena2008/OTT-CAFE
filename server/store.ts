import type { MenuItem, Category, Order, Reservation, PromoBanner, CafeInfo, AdminAccessUser, AuditLog } from '../src/types';
import { OTT_CATEGORIES, OTT_MENU_ITEMS } from '../src/data/ottPdfMenu';

export const OWNER_EMAIL = 'kumarsatyam5868@gmail.com';
export const RESTAURANT_ID = 'ott-kukas-jaipur';

// Two ways to close:
//  - closedUntil set: closed until that moment, then reopens by itself -- whether or not the
//    admin also flipped isOpen off (previously isOpen=false ignored closedUntil entirely, so
//    "closed until Monday 11 AM" stayed closed forever unless someone remembered to reopen).
//  - isOpen=false with no reopen time: closed until the admin reopens manually.
export function isCafeAcceptingOrders(
  cafeInfo: CafeInfo,
  now: number = Date.now()
): { open: boolean; reason?: string; reopensAt?: string } {
  const closed = { open: false, reason: cafeInfo.closedReason || undefined, reopensAt: cafeInfo.closedUntil || undefined };
  if (cafeInfo.closedUntil) {
    const reopenTime = new Date(cafeInfo.closedUntil).getTime();
    if (!Number.isNaN(reopenTime)) {
      return reopenTime > now ? closed : { open: true };
    }
  }
  if (cafeInfo.isOpen === false) return closed;
  return { open: true };
}

export interface DeliveryNotification {
  id: string;
  partnerId: string;
  partnerName: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  lat?: number;
  lng?: number;
  orderTotal: number;
  itemsCount: number;
  itemsSummary: string;
  paymentMethod?: string;
  notes?: string;
  assignedAt: string;
  read: boolean;
}

export class CafeStore {
  private static instance: CafeStore;

  public deliveryNotifications: DeliveryNotification[] = [];

  public cafeInfo: CafeInfo = {
    name: 'Out of the Town - Restro and Bakery',
    tagline: 'Gourmet Restro, Artisan Bakery in Kukas, Jaipur',
    phone: '+91 98289 19626',
    email: 'care@outofthetownjaipur.com',
    address: 'SP 41 B, Near RIICO Industrial Area & Arya College of Industrial Training, Kukas, Delhi-Jaipur Road (NH-48), Jaipur, Rajasthan 302038 (Near Umaid Haveli)',
    openingHours: 'Mon - Sun: 11:00 AM – 12:00 AM (Midnight)',
    announcement: '🌟 Welcome to Out of the Town - Restro and Bakery! Pure taste, fresh bakes & great dining. Call Customer Care: +91 98289 19626',
    isOpen: true,
    closedUntil: null,
    closedReason: '',
  };

  public categories: Category[] = OTT_CATEGORIES;

  public promoBanners: PromoBanner[] = [
    {
      id: 'promo-1',
      title: 'OTT Royal Thali Feast',
      subtitle: 'Dine in our signature arch lounge, flat ₹100 off',
      highlightBadge: 'SIGNATURE LOUNGE',
      discountText: 'FLAT ₹100 OFF',
      code: 'OTTTHALI',
      imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
      badgeBgColor: 'bg-amber-600',
      targetCategory: 'thali',
      active: true,
      // Regression fix: these previously referenced 'item-N' ids from an older menu dataset
      // that no longer exists (the real catalog uses 'ott-<category>-<n>' ids) — every combo
      // page silently showed "Pre-Selected Dishes (0 Items)" as a result. Now pointing at the
      // closest real, currently-available dishes to what comboDescription actually promises.
      comboItemIds: ['ott-thl-3', 'ott-brd-15', 'ott-main-3'], // OTT Special Thali, Garlic Naan, Dal Makhni
      comboDescription: 'The royal banquet feast enjoyed in our signature illuminated arched booths. Includes OTT Special Royal Thali, Butter Garlic Naan (2 pcs) and Bukhara Dal Makhani.',
      terms: [
        'Flat ₹100 instant discount with promo code OTTTHALI',
        'Valid on dine-in at our neon arch booths, takeaway, and delivery',
        'Free doorstep delivery for orders above ₹499',
        'Freshly prepared in traditional tandoor and clay ovens',
      ],
    },
    {
      id: 'promo-2',
      title: 'European Bakery Treat',
      subtitle: 'Cheesecake & sizzling brownies, 25% off',
      highlightBadge: 'LUXURY DINING',
      discountText: '25% OFF',
      code: 'BAKERY25',
      imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
      badgeBgColor: 'bg-rose-600',
      targetCategory: 'bakery',
      active: true,
      comboItemIds: ['ott-des-3', 'ott-des-1', 'ott-brk-11'], // Blueberry Cheese Cake, Brownie with Ice Cream, Chocolate Pancake
      comboDescription: 'Artisan dessert lovers combo in our luxury gold dining hall: New York Blueberry Cheesecake, warm Sizzling Walnut Brownie with Belgian chocolate, and Golden Pancake Stack.',
      terms: [
        'Flat 25% instant discount with promo code BAKERY25',
        'Baked fresh daily in-house by our master pastry chefs',
        'Packed in insulated eco-friendly pastry boxes',
        'Complimentary Belgian chocolate fudge drizzle',
      ],
    },
    {
      id: 'promo-3',
      title: 'Birthday & Party Banquet',
      subtitle: 'Book our private party hall today',
      highlightBadge: 'CELEBRATION HALL',
      discountText: 'PARTY OFFER',
      code: 'PARTYHALL',
      imageUrl: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80',
      badgeBgColor: 'bg-purple-600',
      targetCategory: 'bites',
      active: true,
      comboItemIds: ['ott-bit-3', 'ott-bit-12', 'ott-bit-15'], // Peri-Peri Fries, Paneer Chaat, Chicken Lollipop
      comboDescription: 'Private celebration party space featuring botanical wallpaper, festive balloon setups, and multi-cuisine catering for 15-35 guests.',
      terms: [
        'Instant table & hall reservation confirmation',
        'Dedicated celebration music and sound setup',
        'Custom themed cakes and party platters available on request',
        'Open daily for lunch, evening tea, and late night parties',
      ],
    },
    {
      id: 'promo-4',
      title: 'Scenic View Pavilion',
      subtitle: 'Pizzas, pasta & freakshakes with a view',
      highlightBadge: 'SCENIC RETREAT',
      discountText: 'FLAT ₹50 OFF',
      code: 'WELCOME50',
      imageUrl: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=1200&q=80',
      badgeBgColor: 'bg-emerald-600',
      targetCategory: 'italian',
      active: true,
      comboItemIds: ['ott-piz-2', 'ott-pas-2', 'ott-shk-5'], // Fresh Farm Pizza, Pasta Cream Cheese Sauce, Nutella Shake
      comboDescription: "The ultimate traveler's retreat: 10-inch stone-baked Farmhouse Pizza loaded with mozzarella, Creamy Alfredo White Penne Pasta, and Nutella Freakshake.",
      terms: [
        'Flat ₹50 instant discount with promo code WELCOME50',
        'Ideal for travelers, families and college groups',
        'Scenic Aravalli hillside view and quick pit-stop service',
        'Free high-speed Wi-Fi and electric vehicle charging point nearby',
      ],
    },
  ];

  public menuItems: MenuItem[] = OTT_MENU_ITEMS;

  // Real customer orders only -- the old seeded "ORD-1001" demo visit was showing up as a
  // genuine delivered ₹765 sale in the owner's revenue figures.
  public orders: Order[] = [];

  // Live real reservations made by customers
  public reservations: Reservation[] = [];

  public customers: {
    id: string;
    name: string;
    phone: string;
    email: string;
    createdAt: string;
    lastLogin?: string;
  }[] = [];

  // Admin Panel Role-Based Access Control list
  // Owner (kumarsatyam5868@gmail.com) always has immutable root admin permissions
  public adminUsers: AdminAccessUser[] = [
    {
      id: 'admin-owner-satyam',
      email: 'kumarsatyam5868@gmail.com',
      name: 'Satyam Kumar (Owner)',
      role: 'owner',
      restaurantId: RESTAURANT_ID,
      permissions: ['*'],
      // Overridable via OWNER_PASSCODE for public/hosted deployments — '123' stays the
      // local-dev default so it doesn't disrupt the owner's existing familiar workflow.
      passcode: process.env.OWNER_PASSCODE ?? (() => {
  if (process.env.NODE_ENV === 'production') throw new Error('OWNER_PASSCODE required');
  return '123';
})(),
      addedBy: 'Founder (System)',
      addedAt: '2026-01-01T00:00:00.000Z',
      isActive: true,
      notes: 'Principal Owner & Head of Out of the Town (OTT) - Full Authority',
    },
    // No other accounts are seeded. Demo staff (manager "2026", counter "3030", kitchen
    // "4040", ...) used to ship here, and since the login form accepts a passcode on its own,
    // typing "2026" gave anyone General Manager access to the live site. The owner adds real
    // staff and riders from Team & Access Management; those are persisted to MySQL.
  ];

  // System-wide Audit Logs for compliance, security & tracking
  public auditLogs: AuditLog[] = [];

  public pendingOtps: Map<string, {
    otp: string;
    email: string;
    phone: string;
    name?: string;
    expiresAt: number;
    // Wrong-guess counter for this specific code — verify-otp increments this on every
    // mismatch and deletes the entry outright once it hits the limit, so a code can't be
    // brute-forced within its own validity window regardless of request throughput.
    attempts?: number;
  }> = new Map();

  public customerTokens: Map<string, {
    id: string;
    name: string;
    phone: string;
    email: string;
    createdAt: string;
    lastLogin?: string;
  }> = new Map();

  public static getInstance(): CafeStore {
    if (!CafeStore.instance) {
      CafeStore.instance = new CafeStore();
    }
    return CafeStore.instance;
  }
}

export const store = CafeStore.getInstance();
