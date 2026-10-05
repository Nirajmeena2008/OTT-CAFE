export type DietaryType = 'veg' | 'non-veg' | 'egg' | 'vegan';

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  originalPrice?: number;
  isVeg: boolean;
  isEgg?: boolean;
  isVegan?: boolean;
  isBestseller?: boolean;
  isAvailable: boolean;
  rating: number;
  reviewsCount: number;
  image: string;
  tags?: string[];
  preparationTimeMinutes?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  image?: string;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

export type OrderType = 'delivery' | 'pickup' | 'dine-in';
export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'counter';

export type DeliveryPartnerVehicle = 'bike' | 'scooter' | 'van' | 'electric_ev' | 'car';

export type DeliveryTrackingStage =
  | 'assigned'
  | 'arrived_at_pickup'
  | 'picked_up'
  | 'on_the_way'
  | 'near_destination'
  | 'delivered';

export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  vehicleType: DeliveryPartnerVehicle;
  vehicleNumber: string;
  rating?: number;
  totalDeliveries?: number;
  photoUrl?: string;
  batteryLevel?: number;
  isOnDuty?: boolean;
  notes?: string;
  currentCoordinates?: {
    lat: number;
    lng: number;
  };
}

export interface DeliveryWaypoint {
  id: string;
  name: string;
  landmark: string;
  distanceKm: number;
  completed: boolean;
  active: boolean;
  timeEstimate?: string;
}

export interface DeliveryTimelineItem {
  stage: DeliveryTrackingStage;
  title: string;
  description: string;
  timestamp: string;
  completed: boolean;
}

export interface DeliveryTracking {
  partner: DeliveryPartner;
  stage: DeliveryTrackingStage;
  statusNotes?: string;
  assignedAt: string;
  arrivedAtPickupAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  estimatedDeliveryMinutes: number;
  estimatedArrivalTime: string; // e.g. "08:15 PM"
  progressPercent: number; // 0 to 100 for GPS position along NH-48 route
  currentLocationLabel: string;
  partnerLocation?: {
    lat: number;
    lng: number;
    speedKmh?: number;
    heading?: number;
    updatedAt?: string;
  };
  pickupLocation: {
    name: string;
    address: string;
    phone: string;
    lat: number;
    lng: number;
  };
  deliveryLocation: {
    customerName: string;
    address: string;
    phone: string;
    lat?: number;
    lng?: number;
  };
  waypoints: DeliveryWaypoint[];
  timeline: DeliveryTimelineItem[];
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

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  image: string;
}

export interface CustomCakeDetails {
  itemType: string; // 'cake' | 'cupcakes' | 'pastries' | 'hamper' | 'other'
  occasion: string; // 'Birthday' | 'Anniversary' | 'Wedding' | 'Celebration' | etc.
  flavor: string;
  weightKg: number;
  shape?: string;
  isEggless: boolean;
  messageOnCake?: string;
  designDescription: string;
  referenceImageUrl?: string;
  targetDate: string;
  targetTime: string;
  specialInstructions?: string;
  estimatedPriceQuote?: number;
  addSparklerCandle?: boolean;
  addAcrylicTopper?: boolean;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: OrderType;
  deliveryAddress?: string;
  tableNumber?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  promoCode?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'paid';
  status: OrderStatus;
  statusNotes?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  createdAt: string;
  estimatedTimeMinutes?: number;
  isCustomCake?: boolean;
  customCakeDetails?: CustomCakeDetails;
  specialInstructions?: string;
  notes?: string;
  deliveryNotes?: string;
  deliveryPartner?: DeliveryPartner;
  deliveryTracking?: DeliveryTracking;
}

// The restaurant has exactly three bookable areas -- Out of the Town (Kukas, NH-48) has no
// window nook or chef's counter seating, and no rooftop; those were placeholder values that
// never matched the real venue.
export type SeatingArea = 'indoor_lounge' | 'garden_patio' | 'banquet_hall';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Reservation {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  date: string;
  time: string;
  guestCount: number;
  seatingArea: SeatingArea;
  specialRequests?: string;
  status: ReservationStatus;
  createdAt: string;
}

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  highlightBadge: string;
  discountText: string;
  code: string;
  imageUrl: string;
  badgeBgColor: string;
  targetCategory?: string;
  active: boolean;
  comboItemIds?: string[];
  comboDescription?: string;
  terms?: string[];
}

export interface CafeInfo {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  openingHours: string;
  announcement?: string;
  // Manual admin toggle -- false means closed regardless of closedUntil.
  isOpen: boolean;
  // ISO datetime string. While set and in the future, the cafe is treated as
  // closed (orders/reservations blocked) even if isOpen is still true --
  // lets admins schedule "closed until X" without remembering to flip isOpen
  // back on afterwards.
  closedUntil: string | null;
  // Customer-facing message shown alongside the closed banner, e.g. "Closed
  // for Diwali, back on the 25th."
  closedReason?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt?: string;
  lastLogin?: string;
}

export type AdminRole =
  | 'owner'
  | 'manager'
  | 'staff'
  | 'kitchen'
  | 'accountant'
  | 'marketing'
  | 'delivery'
  // Backward compatibility aliases:
  | 'counter_staff'
  | 'kitchen_staff'
  | 'marketing_staff'
  | 'delivery_person'
  | 'kitchen_lead';

export type ModuleName =
  | 'orders'
  | 'menu'
  | 'inventory'
  | 'finance'
  | 'staff'
  | 'marketing'
  | 'delivery'
  | 'reports'
  | 'settings';

export type AccessLevel =
  | 'Full'
  | 'Manage'
  | 'Edit'
  | 'View'
  | 'Content'
  | 'Limited'
  | 'Operational'
  | 'Financial'
  | 'Marketing'
  | 'Own'
  | 'Assigned'
  | '—';

export type Permission =
  | '*'
  // Orders
  | 'orders.full'
  | 'orders.manage'
  | 'orders.view'
  | 'orders.create'
  | 'orders.accept'
  | 'orders.reject'
  | 'orders.update_status'
  | 'orders.cancel'
  | 'orders.delete'
  | 'orders.assign_delivery'
  | 'orders.view_kitchen'
  | 'orders.assigned'
  // Menu
  | 'menu.full'
  | 'menu.edit'
  | 'menu.view'
  | 'menu.content'
  | 'menu.create'
  | 'menu.delete'
  | 'menu.change_price'
  | 'menu.change_availability'
  // Inventory
  | 'inventory.full'
  | 'inventory.manage'
  | 'inventory.view'
  | 'inventory.edit'
  | 'inventory.update_stock'
  // Finance
  | 'finance.full'
  | 'finance.limited'
  | 'finance.view_sales'
  | 'finance.view_transactions'
  | 'finance.view_settlements'
  | 'finance.export'
  // Staff & Permissions
  | 'staff.full'
  | 'staff.limited'
  | 'staff.view'
  | 'staff.create'
  | 'staff.edit'
  | 'staff.deactivate'
  | 'staff.manage_permissions'
  | 'staff.reset_access'
  | 'staff.revoke_session'
  // Settings
  | 'settings.full'
  | 'settings.limited'
  | 'settings.view'
  | 'settings.edit'
  | 'settings.security'
  // Delivery
  | 'delivery.full'
  | 'delivery.manage'
  | 'delivery.view'
  | 'delivery.assigned'
  | 'delivery.assign'
  | 'delivery.update_status'
  | 'delivery.view_assigned'
  // Reports
  | 'reports.full'
  | 'reports.operational'
  | 'reports.limited'
  | 'reports.financial'
  | 'reports.marketing'
  | 'reports.own'
  // Reservations
  | 'reservations.view'
  | 'reservations.confirm'
  | 'reservations.cancel'
  // Banners & Content
  | 'banners.view'
  | 'banners.manage'
  | 'marketing.full'
  | 'marketing.view'
  | 'marketing.view_analytics'
  | 'reviews.view'
  | 'reviews.manage'
  // Database
  | 'database.view'
  | 'database.manage'
  // Audit
  | 'audit.view';

export interface AdminAccessUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  restaurantId: string;
  permissions?: Permission[];
  passcode?: string;
  phone?: string;
  addedBy: string;
  addedAt: string;
  lastLogin?: string;
  lastActiveAt?: string;
  sessionToken?: string;
  isActive: boolean;
  notes?: string;
  // Fleet profile fields — only meaningful when role === 'delivery_person'
  vehicleType?: DeliveryPartnerVehicle;
  vehicleNumber?: string;
  rating?: number;
  totalDeliveries?: number;
  photoUrl?: string;
  isOnDuty?: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  restaurantId: string;
  role: AdminRole;
  action: string;
  module:
    | 'orders'
    | 'menu'
    | 'categories'
    | 'inventory'
    | 'finance'
    | 'staff'
    | 'settings'
    | 'delivery'
    | 'reservations'
    | 'banners'
    | 'marketing'
    | 'database'
    | 'auth';
  timestamp: string;
  result: 'success' | 'failure';
  ip?: string;
  details?: string;
}
