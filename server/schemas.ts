import { z } from 'zod';
import { restaurantDateString, restaurantMinutesOfDay, slotToMinutes, addDaysToDateString } from './time';

const MAX_RESERVATION_DAYS_AHEAD = 90;

/**
 * ============================================================================
 * DATABASE SCHEMAS & ZOD VALIDATION MODELS
 * ============================================================================
 * These schemas model Mongoose / PostgreSQL (Prisma) database schemas and provide
 * strict, secure runtime sanitization and validation for all incoming payloads.
 */

// ==========================================
// 1. User & Admin Auth Schema
// ==========================================
export const UserSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(60),
  email: z.string().email(),
  passwordHash: z.string().min(6),
  role: z.enum(['admin', 'staff', 'customer']).default('customer'),
  phone: z.string().min(7).max(15).optional(),
  createdAt: z.string().datetime().optional(),
});

export const AdminLoginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// Customer Authentication Schemas (Email + Mobile OTP)
// `name` is an optional field in the UI, so the client sends an empty string (not
// `undefined`) when it's left blank. `.optional()` alone only skips validation for
// `undefined` — an empty string still has to satisfy `.min(2)` and fails, which is exactly
// what broke sign-in for anyone who left the (explicitly optional) name field blank.
export const CustomerSendOtpSchema = z.object({
  email: z.string().trim().email('Valid email address is required'),
  phone: z.string().trim().regex(/^[0-9+\s-]{8,15}$/, 'Valid mobile number is required'),
  name: z.string().trim().min(2).max(60).optional().or(z.literal('')),
});

export const CustomerVerifyOtpSchema = z.object({
  email: z.string().trim().email('Valid email address is required'),
  phone: z.string().trim().regex(/^[0-9+\s-]{8,15}$/, 'Valid mobile number is required'),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  name: z.string().trim().min(2).max(60).optional().or(z.literal('')),
});

// ==========================================
// 2. Menu Item Schema
// ==========================================
export const MenuItemSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  category: z.string().min(2, 'Category is required'),
  description: z.string().min(5, 'Description must be at least 5 characters').max(500),
  price: z.number().positive('Price must be greater than 0'),
  originalPrice: z.number().positive().optional(),
  isVeg: z.boolean().default(true),
  isEgg: z.boolean().optional().default(false),
  isVegan: z.boolean().optional().default(false),
  isBestseller: z.boolean().optional().default(false),
  isAvailable: z.boolean().default(true),
  rating: z.number().min(0).max(5).default(4.5),
  reviewsCount: z.number().int().min(0).default(0),
  image: z.string().url('Must be a valid image URL'),
  tags: z.array(z.string()).optional().default([]),
  preparationTimeMinutes: z.number().int().min(1).max(120).optional().default(15),
});

export type MenuItemInput = z.infer<typeof MenuItemSchema>;

// ==========================================
// 3. Online Food Order Schema
// ==========================================
export const OrderItemSchema = z.object({
  menuItemId: z.string().min(1),
  name: z.string().min(1),
  price: z.number().positive(),
  quantity: z.number().int().min(1).max(50),
  isVeg: z.boolean(),
  image: z.string(),
});

export const CustomCakeDetailsSchema = z.object({
  itemType: z.string().max(60).optional(),
  occasion: z.string().max(80),
  flavor: z.string().max(80),
  weightKg: z.number().positive(),
  shape: z.string().max(60).optional(),
  isEggless: z.boolean().default(true),
  messageOnCake: z.string().max(150).optional(),
  designDescription: z.string().max(2000),
  referenceImageUrl: z.string().optional(),
  targetDate: z.string(),
  targetTime: z.string(),
  specialInstructions: z.string().max(500).optional(),
  estimatedPriceQuote: z.number().optional(),
  addSparklerCandle: z.boolean().optional(),
  addAcrylicTopper: z.boolean().optional(),
});

export const CreateOrderSchema = z
  .object({
    customerName: z.string().trim().min(2, 'Customer full name is required (minimum 2 characters)').max(60),
    customerPhone: z.string().trim().regex(/^[0-9+\s-]{8,15}$/, 'Invalid phone number format'),
    customerEmail: z.string().email().optional().or(z.literal('')),
    orderType: z.enum(['delivery', 'pickup', 'dine-in']),
    deliveryAddress: z.string().max(250).optional(),
    tableNumber: z.string().max(20).optional(),
    items: z.array(OrderItemSchema).min(1, 'Order must contain at least 1 item'),
    promoCode: z.string().max(30).optional(),
    paymentMethod: z.enum(['cash', 'card', 'upi', 'counter']).default('upi'),
    isCustomCake: z.boolean().optional(),
    customCakeDetails: CustomCakeDetailsSchema.optional(),
    specialInstructions: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      const digits = data.customerPhone.replace(/\D/g, '');
      return digits.length >= 10;
    },
    {
      message: 'Valid 10-digit phone number is required for order updates',
      path: ['customerPhone'],
    }
  )
  .refine(
    (data) => {
      if (data.orderType === 'delivery') {
        return !!data.deliveryAddress && data.deliveryAddress.trim().length >= 5;
      }
      return true;
    },
    {
      message: 'Delivery address is required for delivery orders (minimum 5 characters)',
      path: ['deliveryAddress'],
    }
  )
  .refine(
    (data) => {
      if (data.orderType === 'dine-in') {
        return !!data.tableNumber && data.tableNumber.trim().length >= 1;
      }
      return true;
    },
    {
      message: 'Table number is required for dine-in orders',
      path: ['tableNumber'],
    }
  );

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled']),
  statusNotes: z.string().max(200).optional(),
  acceptedBy: z.string().max(80).optional(),
  acceptedAt: z.string().optional(),
  estimatedTimeMinutes: z.number().int().min(1).max(180).optional(),
});

export const DeliveryPartnerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  phone: z.string().min(8),
  vehicleType: z.enum(['bike', 'scooter', 'van', 'electric_ev']).default('bike'),
  vehicleNumber: z.string().min(1),
  rating: z.number().min(1).max(5).default(4.9),
  totalDeliveries: z.number().int().min(0).default(100),
  photoUrl: z.string().optional(),
  batteryLevel: z.number().optional(),
});

export const AssignDeliveryPartnerSchema = z.object({
  partner: DeliveryPartnerSchema,
  estimatedMinutes: z.number().int().min(5).max(180).optional().default(25),
  notes: z.string().max(300).optional(),
  initialStage: z
    .enum(['assigned', 'arrived_at_pickup', 'picked_up', 'on_the_way', 'near_destination', 'delivered'])
    .optional()
    .default('assigned'),
});

export const UpdateDeliveryStageSchema = z.object({
  stage: z.enum(['assigned', 'arrived_at_pickup', 'picked_up', 'on_the_way', 'near_destination', 'delivered']),
  notes: z.string().max(300).optional(),
  progressPercent: z.number().min(0).max(100).optional(),
  currentLocationLabel: z.string().max(120).optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

// ==========================================
// 4. Table Reservation Schema
// ==========================================
export const CreateReservationSchema = z
  .object({
    customerName: z.string().trim().min(2, 'Customer name is required').max(60),
    customerPhone: z.string().trim().regex(/^[0-9+\s-]{8,15}$/, 'Invalid phone number format'),
    customerEmail: z.string().email('Valid email is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    time: z.string().min(3, 'Time slot is required'),
    guestCount: z.number().int().min(1, 'At least 1 guest').max(20, 'Max 20 guests per online booking'),
    seatingArea: z.enum(['indoor_lounge', 'garden_patio', 'banquet_hall']).default('indoor_lounge'),
    specialRequests: z.string().max(300).optional(),
  })
  .superRefine((data, ctx) => {
    // All checks use the restaurant's own clock (IST) -- the server runs on UTC, where
    // "today" differed from India's for 5.5 hours every day and a same-day slot that had
    // already passed in Jaipur (the client hides these, but nothing stopped a direct request)
    // was still accepted.
    const [y, m, d] = data.date.split('-').map(Number);
    const asDate = new Date(Date.UTC(y, m - 1, d));
    if (asDate.getUTCFullYear() !== y || asDate.getUTCMonth() !== m - 1 || asDate.getUTCDate() !== d) {
      ctx.addIssue({ code: 'custom', message: 'Please choose a valid calendar date', path: ['date'] });
      return;
    }
    const today = restaurantDateString();
    if (data.date < today) {
      ctx.addIssue({ code: 'custom', message: 'Reservation date cannot be in the past', path: ['date'] });
      return;
    }
    if (data.date > addDaysToDateString(today, MAX_RESERVATION_DAYS_AHEAD)) {
      ctx.addIssue({
        code: 'custom',
        message: `Online reservations can be made up to ${MAX_RESERVATION_DAYS_AHEAD} days ahead`,
        path: ['date'],
      });
      return;
    }
    const slotMinutes = slotToMinutes(data.time);
    if (slotMinutes === null) {
      ctx.addIssue({ code: 'custom', message: 'Please choose a valid time slot', path: ['time'] });
      return;
    }
    if (data.date === today && slotMinutes <= restaurantMinutesOfDay()) {
      ctx.addIssue({ code: 'custom', message: 'That time slot has already passed today', path: ['time'] });
    }
  });

export const UpdateReservationStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

// ==========================================
// 5. Flipkart-Style Promo Banner Schema
// ==========================================
export const PromoBannerSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2).max(100),
  subtitle: z.string().min(2).max(150),
  highlightBadge: z.string().max(40),
  discountText: z.string().max(50),
  code: z.string().max(25),
  imageUrl: z.string().url(),
  badgeBgColor: z.string().default('bg-amber-600'),
  targetCategory: z.string().optional(),
  active: z.boolean().default(true),
});

export type PromoBannerInput = z.infer<typeof PromoBannerSchema>;
