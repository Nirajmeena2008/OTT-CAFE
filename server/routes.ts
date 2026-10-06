import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { randomInt, createHmac } from 'crypto';
import { store, OWNER_EMAIL, isCafeAcceptingOrders } from './store';
import { formatRestaurantTime, restaurantDateString } from './time';
import type { DeliveryNotification } from './store';
import {
  MySQLService,
  isFakeOrder,
  isFakeReservation,
  FAKE_ORDER_IDS,
  FAKE_RESV_IDS,
  mergeById,
} from './mysqlService';
import {
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  CreateReservationSchema,
  UpdateReservationStatusSchema,
  MenuItemSchema,
  PromoBannerSchema,
  AdminLoginSchema,
  CustomerSendOtpSchema,
  CustomerVerifyOtpSchema,
  AssignDeliveryPartnerSchema,
  UpdateDeliveryStageSchema,
} from './schemas';
import {
  orderLimiter,
  reservationLimiter,
  adminAuthLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
} from './middleware/rateLimiter';
import type { Order, Reservation, MenuItem, PromoBanner, AdminAccessUser, AdminRole, Permission, AuditLog, CafeInfo } from '../src/types';
import {
  RESTAURANT_ID,
  hasPermission,
  getUserPermissions,
  recordAuditLog,
  canManageRole,
  sanitizePermissionGrant,
  sanitizeOrderForKitchen,
} from './rbac';

export const apiRouter = Router();

// Generate a collision-safe ID: a random 4-digit suffix is fine at small scale, but with
// only 9,000 possible values it will eventually repeat and silently merge two customers'
// records. Retry with a wider range until we find one nothing currently uses.
function generateUniqueId(prefix: string, isTaken: (id: string) => boolean): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const width = attempt < 10 ? 9000 : 900000;
    const base = attempt < 10 ? 1000 : 100000;
    const candidate = `${prefix}-${Math.floor(base + Math.random() * width)}`;
    if (!isTaken(candidate)) return candidate;
  }
  // Astronomically unlikely fallback: timestamp-based, guaranteed unique.
  return `${prefix}-${Date.now()}`;
}

// zod 4 applies `.default()`s even inside `.partial()`, so a partial update like
// { isAvailable: false } parsed to { isAvailable: false, isVeg: true, tags: [], rating: 4.5, ... }
// and marking a chicken dish sold-out turned it "veg" and wiped its tags. Keep only the keys the
// client actually sent.
function onlySentFields<T extends object>(parsed: T, body: unknown): Partial<T> {
  const sent = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  return Object.fromEntries(Object.entries(parsed).filter(([key]) => key in sent)) as Partial<T>;
}

// Staff/rider accounts are persisted to MySQL as a whole list; call after any change to one.
// Staff sign in with the passcode alone (the login form has no email field), so a passcode
// must identify exactly one account and be long enough not to be guessed: random 4-digit PINs
// could collide (the second person then logged in as the first) and had only 9,000 values.
function generateStaffPasscode(): string {
  for (;;) {
    const code = String(randomInt(100000, 1000000));
    if (!store.adminUsers.some((u) => u.passcode === code) && code !== ADMIN_SECRET) return code;
  }
}

function passcodeProblem(passcode: string, forUserId?: string): string | null {
  if (passcode.length < 6) return 'Passcode must be at least 6 characters.';
  if (passcode === ADMIN_SECRET || store.adminUsers.some((u) => u.passcode === passcode && u.id !== forUserId)) {
    return 'That passcode is already in use. Please choose a different one.';
  }
  return null;
}

function persistTeam() {
  MySQLService.saveAdminUsers(store.adminUsers).catch((err) => {
    console.warn('Background MySQL staff sync error:', err);
  });
}

// A specific OTP is invalidated outright after this many wrong guesses, forcing a fresh
// send-otp call — independent of otpVerifyLimiter's coarser per-phone request cap, this is
// what actually stops a single leaked/guessed-at code from being brute-forced within its own
// 10-minute validity window no matter how much request throughput an attacker has.
const MAX_OTP_VERIFY_ATTEMPTS = 5;

// Helper to normalize Indian phone numbers to 10 digits
export function normalizePhone(p?: unknown): string {
  if (typeof p !== 'string' || !p) return ''; // a number/object body field used to crash with a 500
  const digits = p.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

// Admin master passcode is read from ADMIN_PASSWORD (set this in the real deployment env).
// 'admin123' is only a local-dev fallback, matching the documented default in .env.example.
const ADMIN_SECRET = process.env.ADMIN_PASSWORD || 'admin123';
// Derived from the password rather than containing it -- /admin/check-access hands this token
// back to the browser, so embedding ADMIN_SECRET in plain text leaked the master password.
const VALID_TOKEN = 'ott_admin_' + createHmac('sha256', ADMIN_SECRET).update('ott-admin-session-v1').digest('hex');

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  if (clean === OWNER_EMAIL.toLowerCase().trim()) return true;
  return store.adminUsers.some((u) => u.email.toLowerCase().trim() === clean && u.isActive);
}

export function getAdminUserByEmail(email?: string | null): AdminAccessUser | undefined {
  if (!email) return undefined;
  const clean = email.toLowerCase().trim();
  if (clean === OWNER_EMAIL.toLowerCase().trim()) {
    const found = store.adminUsers.find((u) => u.email.toLowerCase().trim() === clean);
    if (found) return found;
    return {
      id: 'admin-owner-satyam',
      email: OWNER_EMAIL,
      name: 'Satyam Kumar (Owner)',
      role: 'owner',
      restaurantId: RESTAURANT_ID,
      permissions: ['*'],
      addedBy: 'Root System',
      addedAt: '2026-01-01T00:00:00.000Z',
      isActive: true,
      notes: 'Primary restaurant owner with full administrative authority',
    };
  }
  return store.adminUsers.find((u) => u.email.toLowerCase().trim() === clean && u.isActive);
}

/**
 * Resolve authenticated admin or staff member from request
 */
export function resolveAdminUser(req: Request): AdminAccessUser | null {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]?.trim();
  } else if (typeof req.query.adminToken === 'string') {
    token = req.query.adminToken.trim();
  } else if (typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }

  // 1. Direct standard master admin token -> Owner with all permissions
  if (token === VALID_TOKEN) {
    return (
      getAdminUserByEmail(OWNER_EMAIL) || {
        id: 'admin-owner-satyam',
        email: OWNER_EMAIL,
        name: 'Satyam Kumar (Owner)',
        role: 'owner',
        restaurantId: RESTAURANT_ID,
        permissions: ['*'],
        addedBy: 'Root System',
        addedAt: '2026-01-01T00:00:00.000Z',
        isActive: true,
        notes: 'Primary restaurant owner with full administrative authority',
      }
    );
  }

  // 2. Staff user matched by stored sessionToken
  if (token) {
    const matchedStaff = store.adminUsers.find(
      (u) => u.isActive && u.sessionToken && u.sessionToken === token
    );
    if (matchedStaff) {
      matchedStaff.lastActiveAt = new Date().toISOString();
      return matchedStaff;
    }
  }

  // Nothing else grants admin access. Earlier fallbacks here trusted a self-built
  // "admin_session_<base64 email>" token, a customer session whose (never verified) email
  // matched a staff account, and even a bare ?email= query parameter -- each let anyone
  // become the owner without a password.
  return null;
}

/**
 * Enforce multi-restaurant data isolation.
 * Staff from Restaurant A can NEVER access Restaurant B's data.
 */
export function checkRestaurantIsolation(user: AdminAccessUser, req: Request): boolean {
  if (user.role === 'owner') return true; // Owner has root authority

  const reqRestaurantId =
    (req.headers['x-restaurant-id'] as string) ||
    (req.query.restaurantId as string) ||
    (req.body && req.body.restaurantId);

  if (reqRestaurantId && reqRestaurantId !== user.restaurantId) {
    return false;
  }

  return true;
}

/**
 * Express Middleware: Require specific RBAC permission(s)
 */
export function requirePermission(permission: Permission | Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = resolveAdminUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Valid restaurant administrator or staff token required',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Access Denied: Your staff account has been deactivated by the restaurant owner.',
      });
    }

    // Delivery personnel must NOT access the main restaurant admin dashboard / management APIs
    if (user.role === 'delivery_person') {
      return res.status(403).json({
        success: false,
        error: 'Access Restricted: Delivery personnel must use the dedicated Delivery Partner portal.',
      });
    }

    // Multi-restaurant isolation check
    if (!checkRestaurantIsolation(user, req)) {
      return res.status(403).json({
        success: false,
        error: `Cross-restaurant data access violation: Your account belongs to ${user.restaurantId}. Access to other restaurants is forbidden.`,
      });
    }

    // Check permissions
    const perms = Array.isArray(permission) ? permission : [permission];
    const allowed = perms.some((p) => hasPermission(user, p));

    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: `Permission Denied: Role '${user.role}' lacks the required privilege (${perms.join(' or ')}).`,
      });
    }

    (req as any).adminUser = user;
    next();
  };
}

/**
 * Express Middleware: Require a real, logged-in delivery partner session.
 * Deliberately separate from requirePermission, which blanket-rejects the
 * delivery_person role (that block exists to keep riders out of the main admin
 * dashboard, not to lock them out of their own delivery endpoints).
 */
function requireDeliveryPartner(req: Request, res: Response, next: NextFunction) {
  const user = resolveAdminUser(req);

  if (!user || user.role !== 'delivery_person') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Please sign in as a delivery partner to use this endpoint.',
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Your delivery partner account has been deactivated.',
    });
  }

  (req as any).deliveryPartnerUser = user;
  next();
}

// Customer authentication helpers and middleware
//
// The ONLY valid proof of identity is a token that was actually issued by
// /auth/customer/verify-otp and recorded in store.customerTokens. Do not add
// fallbacks that trust a self-describing token payload or a plain request
// header — either lets anyone impersonate any customer by just naming a
// phone/email/id, with no verification at all.
function getCustomerFromRequest(req: Request) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]?.trim();
  } else if (typeof req.query.token === 'string') {
    token = req.query.token.trim();
  } else if (typeof req.headers['x-customer-token'] === 'string') {
    token = (req.headers['x-customer-token'] as string).trim();
  }

  if (token && store.customerTokens.has(token)) {
    return store.customerTokens.get(token)!;
  }

  return null;
}

function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const customer = getCustomerFromRequest(req);
  if (!customer) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please verify your mobile number and email with OTP to access your account.',
    });
  }
  (req as any).customer = customer;
  next();
}

// ==========================================
// PUBLIC CAFE & PROMOTIONAL APIS
// ==========================================

// Get cafe information & announcements
apiRouter.get('/cafe-info', (req: Request, res: Response) => {
  // Report the *effective* status: once a scheduled reopen time has passed the cafe is open
  // again, so clear the stale closure instead of making every client re-derive it.
  const status = isCafeAcceptingOrders(store.cafeInfo);
  if (status.open && (store.cafeInfo.isOpen === false || store.cafeInfo.closedUntil)) {
    store.cafeInfo = { ...store.cafeInfo, isOpen: true, closedUntil: null, closedReason: '' };
    MySQLService.saveCafeInfo(store.cafeInfo).catch(() => {});
  }
  res.json({ success: true, data: store.cafeInfo });
});

// Get categories
apiRouter.get('/categories', (req: Request, res: Response) => {
  res.json({ success: true, data: store.categories });
});

// Get promotional banners (Flipkart style carousel)
apiRouter.get('/banners', (req: Request, res: Response) => {
  const activeBanners = store.promoBanners.filter((b) => b.active);
  res.json({ success: true, data: activeBanners });
});

// Get menu items with optional filtering
apiRouter.get('/menu', (req: Request, res: Response) => {
  const { category, isVeg, search } = req.query;
  let items = [...store.menuItems];

  if (category && category !== 'all') {
    items = items.filter((item) => item.category === category);
  }

  if (isVeg === 'true') {
    items = items.filter((item) => item.isVeg);
  }

  if (typeof search === 'string' && search.trim().length > 0) {
    const q = search.toLowerCase().trim();
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }

  res.json({ success: true, data: items });
});

// ==========================================
// CUSTOMER AUTHENTICATION (Mobile + Email OTP & Google)
// ==========================================

// Google Sign-In endpoint (accepts email/name directly - for backward compatibility)
apiRouter.post('/auth/customer/google', async (req: Request, res: Response) => {
  const { email, name } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid email is required from Google' });
  }

  const cleanEmail = email.toLowerCase().trim();
  let customer = store.customers.find((c) => c.email.toLowerCase() === cleanEmail);

  if (customer) {
    customer.lastLogin = new Date().toISOString();
    if (name?.trim()) customer.name = name.trim();
  } else {
    customer = {
      id: generateUniqueId('CUST', (id) => store.customers.some((c) => c.id === id)),
      name: name?.trim() || 'Google User',
      phone: '',
      email: cleanEmail,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    store.customers.push(customer);
  }

  const b64Payload = Buffer.from(
    JSON.stringify({
      id: customer.id,
      phone: customer.phone,
      email: customer.email,
      name: customer.name,
    })
  ).toString('base64');
  const token = `cust_token_${customer.id}_${b64Payload}`;
  store.customerTokens.set(token, customer);

  return res.json({ success: true, customer, token });
});

// Google OAuth Callback endpoint (Authorization Code Flow)
apiRouter.post('/auth/customer/google/callback', async (req: Request, res: Response) => {
  const { code, redirectUri } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'Authorization code is required' });
  }

  const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ success: false, error: 'VITE_GOOGLE_CLIENT_ID is not configured in environment.' });
  }
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientSecret) {
    console.error('GOOGLE_CLIENT_SECRET not configured - falling back to implicit flow not available');
    return res.status(500).json({
      success: false,
      error: 'Google OAuth not fully configured. Please set GOOGLE_CLIENT_SECRET in environment.'
    });
  }

  try {
    // Exchange authorization code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri || `${process.env.APP_URL || 'http://localhost:3000'}/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Google token exchange failed:', tokenData);
      return res.status(400).json({ success: false, error: 'Failed to exchange authorization code' });
    }

    // Fetch user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo = await userInfoRes.json();

    if (!userInfoRes.ok || !userInfo.email) {
      console.error('Google user info fetch failed:', userInfo);
      return res.status(400).json({ success: false, error: 'Failed to fetch user info from Google' });
    }

    const cleanEmail = userInfo.email.toLowerCase().trim();
    let customer = store.customers.find((c) => c.email.toLowerCase() === cleanEmail);

    if (customer) {
      customer.lastLogin = new Date().toISOString();
      if (userInfo.name?.trim()) customer.name = userInfo.name.trim();
    } else {
      customer = {
        id: generateUniqueId('CUST', (id) => store.customers.some((c) => c.id === id)),
        name: userInfo.name?.trim() || 'Google User',
        phone: '',
        email: cleanEmail,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      store.customers.push(customer);
    }

    const b64Payload = Buffer.from(
      JSON.stringify({
        id: customer.id,
        phone: customer.phone,
        email: customer.email,
        name: customer.name,
      })
    ).toString('base64');
    const token = `cust_token_${customer.id}_${b64Payload}`;
    store.customerTokens.set(token, customer);

    MySQLService.saveCustomer(customer).catch((err) => {
      console.warn('Background MySQL customer sync from Google OAuth:', err);
    });

    return res.json({ success: true, customer, token });
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return res.status(500).json({ success: false, error: 'Google authentication failed' });
  }
});

// Send OTP to customer's mobile number
apiRouter.post('/auth/customer/send-otp', otpSendLimiter, (req: Request, res: Response) => {
  const validation = CustomerSendOtpSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input. Both email and mobile number are required.',
      details: validation.error.flatten(),
    });
  }

  const { email, phone, name } = validation.data;
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length < 10) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a valid 10-digit mobile number.',
    });
  }

  // Generate 6-digit random OTP
  const otp = randomInt(100000, 1000000).toString(); // crypto.randomInt, not Math.random -- CSPRNG
  const cleanEmail = email.toLowerCase().trim();
  const key = `${cleanPhone}:${cleanEmail}`;
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  store.pendingOtps.set(key, {
    otp,
    email: cleanEmail,
    phone: cleanPhone,
    name: name?.trim() || 'Valued Guest',
    expiresAt,
  });

  // The OTP itself is never written to the log — only that one was issued and to whom.
  console.log(`[SMS OTP SERVICE] Verification OTP issued for +91 ${cleanPhone} (${cleanEmail})`);

  res.json({
    success: true,
    message: `Verification code sent to +91 ${cleanPhone}`,
    phone: cleanPhone,
    // Only present while no real SMS gateway is wired up (see .env.example) — this is how the
    // frontend's "SMS preview" toast can show the code at all today. Set DISABLE_OTP_PREVIEW=true
    // the moment a real provider sends the code instead, so the API stops being the delivery
    // channel. Defaults to shown (matches current behavior) so this doesn't silently break
    // OTP login anywhere it's already relied on until that switch is made deliberately.
    ...(process.env.DISABLE_OTP_PREVIEW !== 'true' ? { otpPreview: otp } : {}),
    expiresInSeconds: 600,
  });
});

// Verify OTP & return authenticated session token
apiRouter.post('/auth/customer/verify-otp', otpVerifyLimiter, async (req: Request, res: Response) => {
  const validation = CustomerVerifyOtpSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid verification input data',
      details: validation.error.flatten(),
    });
  }

  const { email, phone, otp, name } = validation.data;
  const cleanPhone = normalizePhone(phone);
  const cleanEmail = email.toLowerCase().trim();
  const key = `${cleanPhone}:${cleanEmail}`;

  const pending = store.pendingOtps.get(key);

  const isValidOtp = !!pending && pending.otp === otp && Date.now() <= pending.expiresAt;

  if (!isValidOtp) {
    if (pending) {
      pending.attempts = (pending.attempts || 0) + 1;
      if (pending.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
        store.pendingOtps.delete(key);
        return res.status(400).json({
          success: false,
          error: 'Too many incorrect attempts. This code has been invalidated — please request a new one.',
        });
      }
    }
    return res.status(400).json({
      success: false,
      error: 'Invalid or expired OTP. Please re-check or request a new code.',
    });
  }

  // Clear pending OTP
  store.pendingOtps.delete(key);

  // Find or create customer
  // Match on the phone number only -- the code goes to the phone, the email is never verified,
  // so matching on email let someone sign in with another person's email (and their own
  // phone) and take over that person's account and order history.
  let customer = store.customers.find((c) => normalizePhone(c.phone) === cleanPhone);

  const customerName = name?.trim() || pending?.name?.trim() || customer?.name || 'Valued Guest';

  if (customer) {
    customer.lastLogin = new Date().toISOString();
    if (name?.trim()) customer.name = customerName;
    customer.email = cleanEmail;
    customer.phone = cleanPhone;
  } else {
    customer = {
      id: generateUniqueId('CUST', (id) => store.customers.some((c) => c.id === id)),
      name: customerName,
      phone: cleanPhone,
      email: cleanEmail,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    store.customers.push(customer);
  }

  // Generate secure self-describing token
  const b64Payload = Buffer.from(
    JSON.stringify({
      id: customer.id,
      phone: customer.phone,
      email: customer.email,
      name: customer.name,
    })
  ).toString('base64');
  const token = `cust_token_${customer.id}_${b64Payload}`;
  store.customerTokens.set(token, customer);

  // Persist to MySQL if connected
  MySQLService.saveCustomer(customer).catch((err) => {
    console.warn('Background MySQL customer sync:', err);
  });

  res.json({
    success: true,
    message: `Welcome, ${customer.name}!`,
    customer,
    token,
  });
});

// Authenticated customer profile
apiRouter.get('/user/profile', requireCustomer, (req: Request, res: Response) => {
  const customer = (req as any).customer;
  res.json({ success: true, data: customer });
});

// Customer's isolated order history (User CANNOT see any other user's data)
apiRouter.get('/user/orders', requireCustomer, (req: Request, res: Response) => {
  const customer = (req as any).customer;
  const custPhone = normalizePhone(customer.phone);

  // Phone only (see verify-otp): the email on an order is whatever was typed at checkout.
  const userOrders = store.orders.filter(
    (o) => !isFakeOrder(o) && !!custPhone && normalizePhone(o.customerPhone) === custPhone
  );

  res.json({ success: true, data: userOrders });
});

// Customer's isolated table reservations (User CANNOT see any other user's data)
apiRouter.get('/user/reservations', requireCustomer, (req: Request, res: Response) => {
  const customer = (req as any).customer;
  const custPhone = normalizePhone(customer.phone);

  const userResvs = store.reservations.filter(
    (r) => !isFakeReservation(r) && !!custPhone && normalizePhone(r.customerPhone) === custPhone
  );

  res.json({ success: true, data: userResvs });
});

// ==========================================
// GOOGLE MAPS REVERSE GEOCODING API
// ==========================================
apiRouter.get('/maps/reverse-geocode', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({
      success: false,
      error: 'Valid latitude and longitude coordinates are required.',
    });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GMP_API_KEY;

  if (apiKey) {
    try {
      // Mandatory attribution ID solution_id=gmp_git_agentskills_v1 per Google Maps Platform rules
      const gmpUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&solution_id=gmp_git_agentskills_v1`;
      const response = await fetch(gmpUrl);
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const topResult = data.results[0];
        const addressComponents = topResult.address_components || [];

        const getComponent = (types: string[]) => {
          const comp = addressComponents.find((c: any) => types.some((t: string) => c.types.includes(t)));
          return comp ? comp.long_name : undefined;
        };

        const streetNumber = getComponent(['street_number']);
        const route = getComponent(['route']);
        const sublocality = getComponent(['sublocality_level_1', 'sublocality', 'neighborhood']);
        const city = getComponent(['locality', 'administrative_area_level_2']);
        const state = getComponent(['administrative_area_level_1']);
        const postalCode = getComponent(['postal_code']);

        return res.json({
          success: true,
          data: {
            formattedAddress: topResult.formatted_address,
            street: [streetNumber, route].filter(Boolean).join(' '),
            sublocality,
            city: city || 'Jaipur',
            state: state || 'Rajasthan',
            postalCode,
            location: topResult.geometry?.location || { lat, lng },
            source: 'google',
          },
        });
      }
    } catch (err) {
      console.warn('Google Maps API reverse geocoding error:', err);
    }
  }

  // Graceful fallback (e.g. OpenStreetMap Nominatim reverse geocoding)
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const osmRes = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'OutOfTheTown-Restro/1.0 (Jaipur Food Delivery App)',
      },
    });
    if (osmRes.ok) {
      const osmData = await osmRes.json();
      if (osmData && osmData.display_name) {
        const addr = osmData.address || {};
        return res.json({
          success: true,
          data: {
            formattedAddress: osmData.display_name,
            street: [addr.house_number, addr.road].filter(Boolean).join(' '),
            sublocality: addr.suburb || addr.neighbourhood || addr.residential,
            city: addr.city || addr.town || addr.village || addr.county || 'Jaipur',
            state: addr.state || 'Rajasthan',
            postalCode: addr.postcode,
            location: { lat, lng },
            source: 'osm',
          },
        });
      }
    }
  } catch (err) {
    console.warn('Fallback geocoding error:', err);
  }

  // If network reverse geocoder unavailable, return localized coordinates address
  return res.json({
    success: true,
    data: {
      formattedAddress: `Near GPS Location (${lat.toFixed(5)}, ${lng.toFixed(5)}), Kukas, Jaipur, Rajasthan`,
      city: 'Jaipur',
      state: 'Rajasthan',
      location: { lat, lng },
      source: 'coords',
    },
  });
});

// ==========================================
// ONLINE FOOD ORDERING (Anti-bombing rate limited)
// ==========================================

// Custom-cake base pricing by weight tier — must stay in sync with WEIGHT_OPTIONS in
// src/components/CustomCakeModal.tsx. Custom cakes use a synthetic menuItemId that never
// matches store.menuItems, so without this table the server had nothing to verify the
// client-claimed price against (a ₹1 wedding cake would go through as "paid").
const CUSTOM_CAKE_WEIGHT_PRICING: { weightKg: number; basePrice: number }[] = [
  { weightKg: 0.5, basePrice: 550 },
  { weightKg: 1.0, basePrice: 950 },
  { weightKg: 1.5, basePrice: 1400 },
  { weightKg: 2.0, basePrice: 1800 },
  { weightKg: 3.0, basePrice: 2700 },
];

// Optional extras offered in CustomCakeModal -- kept in sync with its addonsTotal. The server
// previously priced only the weight tier, so a customer who saw ₹1,080 (1 kg + sparkler +
// topper) was charged ₹950.
const CUSTOM_CAKE_ADDON_PRICES = { sparklerCandle: 50, acrylicTopper: 80 };

function verifiedCustomCakePrice(details?: { weightKg?: number; addSparklerCandle?: boolean; addAcrylicTopper?: boolean }): number {
  const weightKg = details?.weightKg;
  let base: number;
  if (!weightKg) {
    base = CUSTOM_CAKE_WEIGHT_PRICING[1].basePrice;
  } else {
    const exact = CUSTOM_CAKE_WEIGHT_PRICING.find((w) => w.weightKg === weightKg);
    // Unknown weight tier: fall back to the closest known tier rather than trust the client.
    base = (
      exact ||
      CUSTOM_CAKE_WEIGHT_PRICING.reduce((best, w) =>
        Math.abs(w.weightKg - weightKg) < Math.abs(best.weightKg - weightKg) ? w : best
      )
    ).basePrice;
  }
  return (
    base +
    (details?.addSparklerCandle ? CUSTOM_CAKE_ADDON_PRICES.sparklerCandle : 0) +
    (details?.addAcrylicTopper ? CUSTOM_CAKE_ADDON_PRICES.acrylicTopper : 0)
  );
}

apiRouter.post('/orders', orderLimiter, (req: Request, res: Response) => {
  // Staff logging a phone / walk-in order (Custom Cakes > manual order) may do so while the
  // cafe is closed to online orders, and may set a custom cake's quoted price.
  const staffUser = resolveAdminUser(req);
  const isStaffOrder = !!staffUser && staffUser.role !== 'delivery_person' && hasPermission(staffUser, 'orders.create');

  const status = isCafeAcceptingOrders(store.cafeInfo);
  if (!status.open && !isStaffOrder) {
    return res.status(403).json({
      success: false,
      error: status.reason || 'We are currently closed and not accepting orders right now.',
      reopensAt: status.reopensAt,
    });
  }

  const validation = CreateOrderSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid order input data',
      details: validation.error.flatten(),
    });
  }

  const data = validation.data;

  // Every line must be a real, currently available dish (or the custom-cake pre-order).
  // Unknown ids used to fall back to the client-supplied price, so a hand-made request could
  // place a "paid" order for anything at ₹1; unavailable (sold-out) dishes went through too.
  for (const cartItem of data.items) {
    if (cartItem.menuItemId === 'custom-cake-preorder') {
      if (!data.customCakeDetails) {
        return res.status(400).json({ success: false, error: 'Custom cake details are missing from this order.' });
      }
      continue;
    }
    const menuItem = store.menuItems.find((m) => m.id === cartItem.menuItemId);
    if (!menuItem) {
      return res.status(400).json({
        success: false,
        error: `"${cartItem.name}" is no longer on our menu. Please remove it from your cart and try again.`,
      });
    }
    if (menuItem.isAvailable === false) {
      return res.status(400).json({
        success: false,
        error: `Sorry, "${menuItem.name}" is currently unavailable. Please remove it from your cart and try again.`,
      });
    }
  }
  if (data.customCakeDetails?.targetDate && data.customCakeDetails.targetDate < restaurantDateString() && !isStaffOrder) {
    return res.status(400).json({ success: false, error: 'The cake date cannot be in the past.' });
  }

  // Calculate prices securely on the server to prevent client-side price tampering
  let subtotal = 0;
  const sanitizedItems = data.items.map((cartItem) => {
    const original = store.menuItems.find((m) => m.id === cartItem.menuItemId);
    const isCustomCakeItem = cartItem.menuItemId === 'custom-cake-preorder';
    const verifiedPrice = isCustomCakeItem
      ? isStaffOrder
        ? cartItem.price // quoted by staff for a phone / walk-in order
        : verifiedCustomCakePrice(data.customCakeDetails)
      : original!.price;
    subtotal += verifiedPrice * cartItem.quantity;

    return {
      menuItemId: cartItem.menuItemId,
      name: original ? original.name : cartItem.name,
      price: verifiedPrice,
      quantity: cartItem.quantity,
      isVeg: original ? original.isVeg : cartItem.isVeg,
      image: original ? original.image : cartItem.image,
      ...(data.customCakeDetails ? { customCakeDetails: data.customCakeDetails } : {}),
    };
  });

  // Calculate promotional discounts (kept in sync with src/context/CartContext.tsx so the
  // total charged here always matches what the cart showed the customer before checkout)
  let discount = 0;
  let freeDeliveryPromo = false;
  if (data.promoCode) {
    const code = data.promoCode.toUpperCase().trim();
    if (code === 'WELCOME100' && subtotal >= 199) {
      discount = Math.min(subtotal, 100);
      freeDeliveryPromo = true;
    } else if (code === 'OTTTHALI' && subtotal >= 300) {
      discount = subtotal >= 400 ? 100 : 50;
    } else if (code === 'BAKERY25') {
      discount = Math.min(150, Math.round(subtotal * 0.25 * 100) / 100);
    } else if (code === 'CAMPUS30' || code === 'COMBO30' || code === 'AURA30') {
      discount = Math.min(150, Math.round(subtotal * 0.3 * 100) / 100);
    } else if ((code === 'WELCOME50' || code === 'AURA10') && subtotal >= 200) {
      discount = 50;
    } else if (code === 'BREW25') {
      discount = Math.round(subtotal * 0.25 * 100) / 100;
    }
  }

  const deliveryFee = freeDeliveryPromo ? 0 : data.orderType === 'delivery' ? (subtotal >= 499 ? 0 : 40) : 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = Math.round(taxableAmount * 0.05 * 100) / 100; // 5% Restaurant GST
  const total = Math.round((taxableAmount + deliveryFee + tax) * 100) / 100;

  const newOrder: Order = {
    id: generateUniqueId('ORD', (id) => store.orders.some((o) => o.id === id)),
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerEmail: data.customerEmail || '',
    orderType: data.orderType,
    deliveryAddress: data.deliveryAddress,
    tableNumber: data.tableNumber,
    items: sanitizedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    discount,
    deliveryFee,
    tax,
    total,
    promoCode: data.promoCode,
    paymentMethod: data.paymentMethod,
    paymentStatus: 'paid', // Simulated immediate processing
    status: 'pending',
    statusNotes: data.isCustomCake
      ? `Custom cake request for ${data.customCakeDetails?.occasion || 'celebration'} (${data.customCakeDetails?.weightKg || 1}kg, ${data.customCakeDetails?.flavor || 'special'}). Event: ${data.customCakeDetails?.targetDate || ''}`
      : 'Order received by the kitchen',
    createdAt: new Date().toISOString(),
    estimatedTimeMinutes: data.isCustomCake ? 180 : data.orderType === 'delivery' ? 35 : 15,
    isCustomCake: data.isCustomCake,
    customCakeDetails: data.customCakeDetails as any,
    specialInstructions: data.specialInstructions,
  };

  store.orders.unshift(newOrder);

  // Sync to MySQL database if configured
  MySQLService.saveOrder(newOrder).catch((err) => {
    console.warn('Background MySQL order sync error:', err);
  });

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: newOrder,
  });
});

// Track an order by ID (with cross-user privacy protection)
apiRouter.get('/orders/:id', (req: Request, res: Response) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order || isFakeOrder(order)) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // Staff/owner may view any order.
  const adminUser = resolveAdminUser(req);
  if (adminUser && adminUser.role !== 'delivery_person') {
    return res.json({ success: true, data: order });
  }

  // A logged-in customer may view it if it's actually theirs.
  const customer = getCustomerFromRequest(req);
  if (customer) {
    if (normalizePhone(customer.phone) === normalizePhone(order.customerPhone)) {
      return res.json({ success: true, data: order });
    }
    return res.status(403).json({
      success: false,
      error: 'Access denied: You cannot view orders belonging to another user.',
    });
  }

  // Guest checkout never required an account, so allow a guest to poll status on
  // their own just-placed order by also proving they know the phone number it was
  // placed under. This still closes the original hole (a bare order ID was enough
  // to read anyone's order) since IDs alone are no longer sufficient.
  const guestPhone = normalizePhone((req.query.phone as string) || '');
  if (guestPhone && guestPhone === normalizePhone(order.customerPhone)) {
    return res.json({ success: true, data: order });
  }

  return res.status(401).json({
    success: false,
    error: 'Authentication required to view this order.',
  });
});

// ==========================================
// CUSTOMER ORDER CANCELLATION (Before rider pickup/dispatch)
// ==========================================
apiRouter.post('/orders/:id/cancel', async (req: Request, res: Response) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order || isFakeOrder(order)) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // Same ownership rule as viewing an order: staff, the logged-in owning customer,
  // or a guest who can name the phone number the order was placed under.
  const adminUser = resolveAdminUser(req);
  const customer = getCustomerFromRequest(req);
  const isOwningCustomer = customer && normalizePhone(customer.phone) === normalizePhone(order.customerPhone);
  const guestPhone = normalizePhone(typeof req.body?.phone === 'string' ? req.body.phone : '');
  const isOwningGuest = guestPhone && guestPhone === normalizePhone(order.customerPhone);

  if (!(adminUser && adminUser.role !== 'delivery_person') && !isOwningCustomer && !isOwningGuest) {
    return res.status(401).json({
      success: false,
      error: 'You can only cancel your own order.',
    });
  }

  // Reject if order is already picked up, out for delivery, or completed/cancelled
  const isAlreadyDispatched =
    order.status === 'ready' ||
    order.status === 'delivered' ||
    order.status === 'cancelled' ||
    order.deliveryTracking?.stage === 'picked_up' ||
    order.deliveryTracking?.stage === 'on_the_way' ||
    order.deliveryTracking?.stage === 'near_destination';

  if (isAlreadyDispatched) {
    return res.status(400).json({
      success: false,
      error: 'Order cannot be cancelled because it has already been picked up by the delivery rider or is out for delivery.',
    });
  }

  // Only allowed during pending, accepted, or preparing
  if (!['pending', 'accepted', 'preparing'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      error: `Order cannot be cancelled in its current state (${order.status}).`,
    });
  }

  const reason =
    (typeof req.body?.reason === 'string' && req.body.reason.trim().slice(0, 200)) || 'Cancelled by customer before rider pickup';
  order.status = 'cancelled';
  order.statusNotes = reason;

  // Persist to MySQL
  await MySQLService.updateOrderStatus(order.id, 'cancelled', { notes: reason }).catch((err) => {
    console.warn('MySQL: failed to update customer-cancelled order status:', err);
  });

  res.json({
    success: true,
    message: `Order #${order.id} has been cancelled successfully.`,
    data: order,
  });
});

// ==========================================
// TABLE RESERVATIONS (Anti-bombing rate limited)
// ==========================================

apiRouter.post('/reservations', reservationLimiter, (req: Request, res: Response) => {
  const status = isCafeAcceptingOrders(store.cafeInfo);
  if (!status.open) {
    return res.status(403).json({
      success: false,
      error: status.reason || 'We are currently closed and not accepting table reservations right now.',
      reopensAt: status.reopensAt,
    });
  }

  const validation = CreateReservationSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid reservation input data',
      details: validation.error.flatten(),
    });
  }

  const data = validation.data;

  const newReservation: Reservation = {
    id: generateUniqueId('RES', (id) => store.reservations.some((r) => r.id === id)),
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerEmail: data.customerEmail,
    date: data.date,
    time: data.time,
    guestCount: data.guestCount,
    seatingArea: data.seatingArea,
    specialRequests: data.specialRequests,
    status: 'pending', // Require admin approval before confirmation
    createdAt: new Date().toISOString(),
  };

  store.reservations.unshift(newReservation);

  // Sync reservation to MySQL database if configured
  MySQLService.saveReservation(newReservation).catch((err) => {
    console.warn('Background MySQL reservation sync error:', err);
  });

  res.status(201).json({
    success: true,
    message: 'Table reservation successfully confirmed!',
    data: newReservation,
  });
});

// Track reservation by ID
apiRouter.get('/reservations/:id', (req: Request, res: Response) => {
  const reservation = store.reservations.find((r) => r.id === req.params.id);
  if (!reservation) {
    return res.status(404).json({ success: false, error: 'Reservation not found' });
  }

  // Same ownership rule as order lookup: staff, the logged-in owning customer, or a guest
  // who can name the phone number the reservation was booked under. Reservations were fully
  // open by ID alone before this — anyone could read any customer's name/phone/email/special
  // requests just by guessing a RES-#### id.
  const adminUser = resolveAdminUser(req);
  if (adminUser && adminUser.role !== 'delivery_person') {
    return res.json({ success: true, data: reservation });
  }

  const customer = getCustomerFromRequest(req);
  if (customer) {
    if (normalizePhone(customer.phone) === normalizePhone(reservation.customerPhone)) {
      return res.json({ success: true, data: reservation });
    }
    return res.status(403).json({
      success: false,
      error: 'Access denied: You cannot view reservations belonging to another user.',
    });
  }

  const guestPhone = normalizePhone((req.query.phone as string) || '');
  if (guestPhone && guestPhone === normalizePhone(reservation.customerPhone)) {
    return res.json({ success: true, data: reservation });
  }

  return res.status(401).json({
    success: false,
    error: 'Authentication required to view this reservation.',
  });
});

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

apiRouter.post('/admin/login', adminAuthLimiter, (req: Request, res: Response) => {
  const { password, email } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Password or passcode is required' });
  }

  const cleanPassword = password.trim();
  const cleanEmail = typeof email === 'string' ? email.toLowerCase().trim() : undefined;

  // 1. Root Owner Login via the configured ADMIN_PASSWORD (see ADMIN_SECRET above)
  if (cleanPassword === ADMIN_SECRET) {
    const owner = getAdminUserByEmail(OWNER_EMAIL) || {
      id: 'admin-owner-satyam',
      email: OWNER_EMAIL,
      name: 'Satyam Kumar (Owner)',
      role: 'owner',
      restaurantId: RESTAURANT_ID,
      permissions: ['*'],
      addedBy: 'Root System',
      addedAt: '2026-01-01T00:00:00.000Z',
      isActive: true,
      notes: 'Principal Owner & Head of Out of the Town (OTT) - Full Authority',
    };

    recordAuditLog({
      userId: owner.id,
      userName: owner.name,
      userEmail: owner.email,
      restaurantId: owner.restaurantId,
      role: owner.role,
      action: 'Owner signed into Admin Suite',
      module: 'auth',
      result: 'success',
      req,
      details: 'Root administrative session authenticated with passcode.',
    });

    return res.json({
      success: true,
      token: VALID_TOKEN,
      user: owner,
      role: 'owner',
      permissions: ['*'],
      restaurantId: RESTAURANT_ID,
      message: 'Authenticated successfully as Restaurant Owner & Super Admin',
    });
  }

  // 2. Staff user login via email & passcode, or by unique staff passcode
  let matchedUser: AdminAccessUser | undefined;

  if (cleanEmail) {
    matchedUser = store.adminUsers.find(
      (u) => u.email.toLowerCase().trim() === cleanEmail && u.passcode === cleanPassword
    );
  } else {
    // Quick passcode lookup
    matchedUser = store.adminUsers.find((u) => u.passcode === cleanPassword);
  }

  if (matchedUser) {
    if (!matchedUser.isActive) {
      recordAuditLog({
        userId: matchedUser.id,
        userName: matchedUser.name,
        userEmail: matchedUser.email,
        restaurantId: matchedUser.restaurantId,
        role: matchedUser.role,
        action: 'Failed login attempt - Suspended Account',
        module: 'auth',
        result: 'failure',
        req,
      });

      return res.status(403).json({
        success: false,
        error: 'Your staff account is currently suspended. Please contact the restaurant owner.',
      });
    }

    // Delivery personnel cannot log into admin panel
    if (matchedUser.role === 'delivery_person') {
      return res.status(403).json({
        success: false,
        error: 'Delivery personnel access is restricted to the Delivery Partner mobile/rider portal.',
      });
    }

    const sessionToken = `staff_session_${matchedUser.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    matchedUser.sessionToken = sessionToken;
    matchedUser.lastLogin = new Date().toISOString();
    matchedUser.lastActiveAt = new Date().toISOString();
    persistTeam();

    recordAuditLog({
      userId: matchedUser.id,
      userName: matchedUser.name,
      userEmail: matchedUser.email,
      restaurantId: matchedUser.restaurantId,
      role: matchedUser.role,
      action: `${matchedUser.role.toUpperCase()} ${matchedUser.name} signed into Admin Suite`,
      module: 'auth',
      result: 'success',
      req,
      details: `Role-based session established for ${matchedUser.role}.`,
    });

    return res.json({
      success: true,
      token: sessionToken,
      user: matchedUser,
      role: matchedUser.role,
      permissions: getUserPermissions(matchedUser),
      restaurantId: matchedUser.restaurantId,
      message: `Authenticated successfully as ${matchedUser.role.replace('_', ' ').toUpperCase()}`,
    });
  }

  // Failed login attempt
  recordAuditLog({
    userId: 'unknown',
    userName: cleanEmail || 'Anonymous',
    userEmail: cleanEmail || 'unknown@guest',
    restaurantId: RESTAURANT_ID,
    role: 'staff',
    action: 'Failed Admin Suite passcode attempt',
    module: 'auth',
    result: 'failure',
    req,
    details: 'Invalid credentials provided.',
  });

  return res.status(401).json({
    success: false,
    error: 'Invalid admin passcode. Please verify your credentials or contact the restaurant owner.',
  });
});

// Check if current user/customer session has admin privileges
apiRouter.get('/admin/check-access', (req: Request, res: Response) => {
  const user = resolveAdminUser(req);

  if (user && user.isActive) {
    return res.json({
      success: true,
      hasAccess: true,
      user,
      role: user.role,
      permissions: getUserPermissions(user),
      restaurantId: user.restaurantId || RESTAURANT_ID,
      adminToken: user.sessionToken || VALID_TOKEN,
    });
  }

  return res.json({
    success: true,
    hasAccess: false,
  });
});

// ==========================================
// ADMIN TEAM & ACCESS CONTROL ENDPOINTS
// ==========================================

// Get list of authorized admin users (Protected by staff.view)
apiRouter.get('/admin/team', requirePermission('staff.view'), (req: Request, res: Response) => {
  res.json({
    success: true,
    data: store.adminUsers,
    ownerEmail: OWNER_EMAIL,
    restaurantId: RESTAURANT_ID,
  });
});

// Grant admin access to a new user / staff member (Protected by staff.create)
apiRouter.post('/admin/team', requirePermission(['staff.create', 'staff.manage_permissions', '*']), (req: Request, res: Response) => {
  const { email, name, role, notes, permissions, passcode, phone } = req.body;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ success: false, error: 'Staff email or identifier is required' });
  }

  let cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail.includes('@')) {
    cleanEmail = `${cleanEmail.replace(/[^a-z0-9._-]/g, '')}@outofthetownjaipur.com`;
  }

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  const callerRole: AdminRole = callerUser?.role || 'owner';
  const addedBy = callerUser ? `${callerUser.name} (${callerUser.email})` : `Owner (${OWNER_EMAIL})`;

  // Only the single, seeded root owner account may ever hold role 'owner' — this endpoint
  // can never mint additional owners, and a caller may never grant more than they can manage.
  const allowedRoles: AdminRole[] = [
    'manager',
    'staff',
    'kitchen',
    'accountant',
    'marketing',
    'delivery',
    'counter_staff',
    'kitchen_staff',
    'marketing_staff',
    'delivery_person',
    'kitchen_lead',
  ];

  // Check if email already exists
  const existing = store.adminUsers.find((u) => u.email.toLowerCase().trim() === cleanEmail);
  if (existing) {
    if (existing.isActive) {
      return res.status(400).json({
        success: false,
        error: `Admin access is already active for ${cleanEmail}.`,
      });
    }

    const reactivateRole: AdminRole = role && allowedRoles.includes(role) ? role : existing.role;
    if (callerUser && !canManageRole(callerRole, reactivateRole)) {
      return res.status(403).json({
        success: false,
        error: `Permission Denied: Role '${callerRole}' cannot grant or manage the '${reactivateRole}' role.`,
      });
    }

    // Reactivate
    existing.isActive = true;
    existing.name = name?.trim() || existing.name;
    existing.role = reactivateRole;
    existing.notes = notes !== undefined ? notes : existing.notes;
    const sanitizedReactivatePerms = callerUser ? sanitizePermissionGrant(callerUser, permissions) : permissions;
    if (sanitizedReactivatePerms !== undefined) {
      existing.permissions = sanitizedReactivatePerms;
    }
    if (passcode) {
      const problem = passcodeProblem(String(passcode).trim(), existing.id);
      if (problem) return res.status(400).json({ success: false, error: problem });
      existing.passcode = String(passcode).trim();
    }
    persistTeam();

    recordAuditLog({
      userId: callerUser?.id || 'admin-owner-satyam',
      userName: callerUser?.name || 'Owner',
      userEmail: callerUser?.email || OWNER_EMAIL,
      role: callerUser?.role || 'owner',
      action: `Re-activated staff account for ${cleanEmail}`,
      module: 'staff',
      result: 'success',
      req,
      details: `Re-enabled access with role ${existing.role}.`,
    });

    return res.json({
      success: true,
      data: existing,
      message: `Re-activated staff access for ${cleanEmail}`,
    });
  }

  const validRole: AdminRole = allowedRoles.includes(role) ? role : 'manager';

  if (callerUser && !canManageRole(callerRole, validRole)) {
    return res.status(403).json({
      success: false,
      error: `Permission Denied: Role '${callerRole}' cannot grant or manage the '${validRole}' role.`,
    });
  }

  if (passcode !== undefined && passcode !== '') {
    const problem = passcodeProblem(String(passcode).trim());
    if (problem) return res.status(400).json({ success: false, error: problem });
  }

  const newAdminUser: AdminAccessUser = {
    id: `admin-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    email: cleanEmail,
    name: name?.trim() || cleanEmail.split('@')[0],
    role: validRole,
    restaurantId: RESTAURANT_ID,
    permissions: callerUser ? sanitizePermissionGrant(callerUser, permissions) : (Array.isArray(permissions) ? permissions : undefined),
    passcode: passcode?.trim() || generateStaffPasscode(),
    phone: typeof phone === 'string' && phone.trim() ? normalizePhone(phone) : undefined,
    addedBy,
    addedAt: new Date().toISOString(),
    isActive: true,
    notes: notes?.trim() || '',
  };

  store.adminUsers.push(newAdminUser);
  persistTeam();

  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Owner',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Created new staff account for ${newAdminUser.name} (${cleanEmail})`,
    module: 'staff',
    result: 'success',
    req,
    details: `Role: ${validRole}. Passcode generated.`,
  });

  res.status(201).json({
    success: true,
    data: newAdminUser,
    message: `Successfully created ${validRole.toUpperCase()} account for ${cleanEmail}`,
  });
});

// Edit existing staff member role, permissions, and details (Protected by staff.edit)
apiRouter.put('/admin/team/:id', requirePermission('staff.edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const target = store.adminUsers.find((u) => u.id === id);
  if (!target) {
    return res.status(404).json({ success: false, error: 'Staff member not found' });
  }

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;

  // Protect root owner from modifications by other staff
  if (target.email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim() || target.role === 'owner') {
    if (callerUser?.email.toLowerCase().trim() !== OWNER_EMAIL.toLowerCase().trim()) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify permissions or role of the primary restaurant owner.',
      });
    }
  }

  const { name, role, permissions, passcode, notes } = req.body;
  const callerRole: AdminRole = callerUser?.role || 'owner';
  const isTargetOwner = target.email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim();

  // Validate before changing anything, so a rejected request leaves the account untouched.
  if (passcode && typeof passcode === 'string') {
    if (isTargetOwner) {
      return res.status(400).json({
        success: false,
        error: "The owner's passcode is set on the server (OWNER_PASSCODE in backend/.env).",
      });
    }
    const problem = passcodeProblem(passcode.trim(), target.id);
    if (problem) return res.status(400).json({ success: false, error: problem });
  }

  if (name && typeof name === 'string') {
    target.name = name.trim();
  }

  // 'owner' is never an assignable role here (only the one seeded root account holds it),
  // and a caller can only assign/manage roles their own role is permitted to manage —
  // otherwise a manager delegated staff.edit could promote anyone (including themselves)
  // to a role with far more access than intended.
  if (role && !isTargetOwner && role !== 'owner') {
    const requestedRole = role as AdminRole;
    if (callerUser && (!canManageRole(callerRole, target.role) || !canManageRole(callerRole, requestedRole))) {
      return res.status(403).json({
        success: false,
        error: `Permission Denied: Role '${callerRole}' cannot assign or manage the '${requestedRole}' role.`,
      });
    }
    target.role = requestedRole;
  }

  if (Array.isArray(permissions) && !isTargetOwner) {
    const sanitized = callerUser ? sanitizePermissionGrant(callerUser, permissions) : permissions;
    if (sanitized !== undefined) {
      target.permissions = sanitized;
    }
  }

  if (passcode && typeof passcode === 'string') {
    target.passcode = passcode.trim();
    target.sessionToken = undefined; // a passcode change signs out existing sessions
  }

  if (notes !== undefined) {
    target.notes = String(notes).trim();
  }
  persistTeam();

  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Owner',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Updated staff profile and permissions for ${target.name} (${target.email})`,
    module: 'staff',
    result: 'success',
    req,
    details: `Updated role: ${target.role}. Permissions modified.`,
  });

  res.json({
    success: true,
    data: target,
    message: `Updated staff details for ${target.name} successfully`,
  });
});

// Toggle admin user active status (Protected by staff.deactivate)
apiRouter.patch('/admin/team/:id/toggle', requirePermission('staff.deactivate'), (req: Request, res: Response) => {
  const { id } = req.params;
  const target = store.adminUsers.find((u) => u.id === id);
  if (!target) {
    return res.status(404).json({ success: false, error: 'Admin team member not found' });
  }

  if (target.email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim() || target.role === 'owner') {
    return res.status(400).json({
      success: false,
      error: 'Cannot deactivate the primary restaurant owner.',
    });
  }

  target.isActive = !target.isActive;
  if (!target.isActive) target.sessionToken = undefined; // deactivation also ends their session
  persistTeam();

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Owner',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `${target.isActive ? 'Reactivated' : 'Deactivated'} staff account for ${target.name} (${target.email})`,
    module: 'staff',
    result: 'success',
    req,
  });

  res.json({
    success: true,
    data: target,
    message: `${target.name} (${target.email}) staff access ${target.isActive ? 'activated' : 'deactivated'}`,
  });
});

// Reset staff access passcode / generate fresh credentials (Protected by staff.reset_access)
apiRouter.post('/admin/team/:id/reset-access', requirePermission('staff.reset_access'), (req: Request, res: Response) => {
  const { id } = req.params;
  const target = store.adminUsers.find((u) => u.id === id);
  if (!target) {
    return res.status(404).json({ success: false, error: 'Staff member not found' });
  }

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  const newPasscode = generateStaffPasscode();
  target.passcode = newPasscode;
  target.sessionToken = undefined; // Revoke current session so they must re-authenticate
  persistTeam();

  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Owner',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Reset access credentials and passcode for ${target.name} (${target.email})`,
    module: 'staff',
    result: 'success',
    req,
    details: 'New 4-digit PIN generated; existing session invalidated.',
  });

  res.json({
    success: true,
    newPasscode,
    // api.resetAdminMemberAccess reads data.passcode / data.user. Without `data` the new
    // passcode was generated (old one already invalid) but never shown -- locking the staff
    // member out with a PIN nobody knew.
    data: { passcode: newPasscode, user: target },
    message: `Access credentials reset for ${target.name}.`,
  });
});

// Revoke active staff session immediately (Protected by staff.revoke_session)
apiRouter.post('/admin/team/:id/revoke-session', requirePermission('staff.revoke_session'), (req: Request, res: Response) => {
  const { id } = req.params;
  const target = store.adminUsers.find((u) => u.id === id);
  if (!target) {
    return res.status(404).json({ success: false, error: 'Staff member not found' });
  }

  target.sessionToken = undefined;
  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  persistTeam();

  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Owner',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Revoked active session for ${target.name} (${target.email})`,
    module: 'staff',
    result: 'success',
    req,
  });

  res.json({
    success: true,
    message: `Active session token revoked for ${target.name}. They will be required to log in again.`,
  });
});

// Remove admin access from user (Protected by staff.manage_permissions or staff.edit or root owner)
apiRouter.delete('/admin/team/:id', requirePermission(['staff.manage_permissions', 'staff.edit', 'staff.create', '*']), (req: Request, res: Response) => {
  const { id } = req.params;
  const target = store.adminUsers.find(
    (u) => u.id === id || u.email.toLowerCase().trim() === id.toLowerCase().trim()
  );
  if (!target) {
    return res.status(404).json({ success: false, error: 'Admin team member not found' });
  }

  if (target.email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim() || target.role === 'owner') {
    return res.status(400).json({
      success: false,
      error: 'Cannot remove root access from the primary restaurant owner.',
    });
  }

  store.adminUsers = store.adminUsers.filter(
    (u) => u.id !== target.id && u.email.toLowerCase().trim() !== target.email.toLowerCase().trim()
  );
  persistTeam();

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Owner',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Removed staff account: ${target.name} (${target.email})`,
    module: 'staff',
    result: 'success',
    req,
  });

  res.json({
    success: true,
    message: `Revoked admin access for ${target.name} (${target.email})`,
  });
});

// ==========================================
// DELIVERY FLEET MANAGEMENT (real, backend-persisted roster)
// ==========================================
// Every delivery partner is a real staff account (role: 'delivery_person') in
// store.adminUsers — the same list used for rider OTP login. This is the single
// source of truth; there is no separate mock/localStorage fleet list.

function toFleetShape(u: AdminAccessUser) {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone || '',
    vehicleType: u.vehicleType || 'bike',
    vehicleNumber: u.vehicleNumber || '',
    rating: u.rating ?? 4.8,
    totalDeliveries: u.totalDeliveries ?? 0,
    photoUrl: u.photoUrl,
    isOnDuty: u.isOnDuty !== false,
    notes: u.notes,
  };
}

// List the real delivery fleet (Protected by delivery.view)
apiRouter.get('/admin/delivery-partners', requirePermission('delivery.view'), (req: Request, res: Response) => {
  const partners = store.adminUsers.filter((u) => u.role === 'delivery_person' && u.isActive).map(toFleetShape);
  res.json({ success: true, data: partners });
});

// Register a new rider to the fleet (Protected by delivery.manage)
apiRouter.post('/admin/delivery-partners', requirePermission(['delivery.manage', 'staff.create', '*']), (req: Request, res: Response) => {
  const { name, phone, vehicleType, vehicleNumber, notes, photoUrl } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Rider full name is required' });
  }
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length < 10) {
    return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit mobile number' });
  }
  if (!vehicleNumber || typeof vehicleNumber !== 'string' || !vehicleNumber.trim()) {
    return res.status(400).json({ success: false, error: 'Vehicle registration plate number is required' });
  }

  const existing = store.adminUsers.find((u) => u.phone && normalizePhone(u.phone) === cleanPhone && u.isActive);
  if (existing) {
    return res.status(400).json({
      success: false,
      error: `A staff account with phone ${cleanPhone} is already registered (${existing.name}).`,
    });
  }

  const validVehicle = ['bike', 'scooter', 'van', 'electric_ev', 'car'].includes(vehicleType) ? vehicleType : 'bike';
  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;

  const newPartner: AdminAccessUser = {
    id: `admin-rider-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    email: `rider${cleanPhone}@outofthetownjaipur.com`,
    name: name.trim(),
    role: 'delivery_person',
    restaurantId: RESTAURANT_ID,
    passcode: generateStaffPasscode(),
    phone: cleanPhone,
    addedBy: callerUser ? `${callerUser.name} (${callerUser.email})` : `Owner (${OWNER_EMAIL})`,
    addedAt: new Date().toISOString(),
    isActive: true,
    notes: notes?.trim() || '',
    vehicleType: validVehicle,
    vehicleNumber: vehicleNumber.trim().toUpperCase(),
    rating: 4.8,
    totalDeliveries: 0,
    photoUrl: typeof photoUrl === 'string' && photoUrl.trim() ? photoUrl.trim() : undefined,
    isOnDuty: true,
  };

  store.adminUsers.push(newPartner);
  persistTeam();

  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Owner',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Registered new delivery partner ${newPartner.name} (+91 ${cleanPhone})`,
    module: 'delivery',
    result: 'success',
    req,
  });

  res.status(201).json({ success: true, data: toFleetShape(newPartner), message: `${newPartner.name} added to the delivery fleet` });
});

// Update a rider's profile / vehicle details (Protected by delivery.manage)
apiRouter.put('/admin/delivery-partners/:id', requirePermission(['delivery.manage', 'staff.edit', '*']), (req: Request, res: Response) => {
  const { id } = req.params;
  const target = store.adminUsers.find((u) => u.id === id && u.role === 'delivery_person');
  if (!target) {
    return res.status(404).json({ success: false, error: 'Delivery partner not found' });
  }

  const { name, phone, vehicleType, vehicleNumber, notes, photoUrl, isOnDuty } = req.body;

  if (name && typeof name === 'string' && name.trim()) target.name = name.trim();
  if (phone && typeof phone === 'string') {
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 10) {
      return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit mobile number' });
    }
    const clash = store.adminUsers.find((u) => u.id !== target.id && u.phone && normalizePhone(u.phone) === cleanPhone && u.isActive);
    if (clash) {
      return res.status(400).json({ success: false, error: `Phone ${cleanPhone} is already used by ${clash.name}.` });
    }
    target.phone = cleanPhone;
  }
  if (vehicleType && ['bike', 'scooter', 'van', 'electric_ev', 'car'].includes(vehicleType)) target.vehicleType = vehicleType;
  if (vehicleNumber && typeof vehicleNumber === 'string' && vehicleNumber.trim()) target.vehicleNumber = vehicleNumber.trim().toUpperCase();
  if (notes !== undefined) target.notes = String(notes).trim();
  if (typeof photoUrl === 'string') target.photoUrl = photoUrl.trim() || undefined;
  if (typeof isOnDuty === 'boolean') target.isOnDuty = isOnDuty;
  persistTeam();

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Owner',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Updated delivery partner profile for ${target.name}`,
    module: 'delivery',
    result: 'success',
    req,
  });

  res.json({ success: true, data: toFleetShape(target), message: `Updated ${target.name}'s fleet profile` });
});

// Toggle a rider's on-duty status — usable by admin/manager, or by the rider themselves
// from the Delivery Partner Portal using their own session token.
apiRouter.patch('/admin/delivery-partners/:id/duty', (req: Request, res: Response) => {
  const { id } = req.params;
  const target = store.adminUsers.find((u) => u.id === id && u.role === 'delivery_person');
  if (!target) {
    return res.status(404).json({ success: false, error: 'Delivery partner not found' });
  }

  const requester = resolveAdminUser(req);
  const isSelf = requester && requester.id === target.id;
  const isAuthorizedManager = requester && hasPermission(requester, 'delivery.manage');
  if (!isSelf && !isAuthorizedManager) {
    return res.status(403).json({ success: false, error: 'Not authorized to change this rider\'s duty status.' });
  }

  target.isOnDuty = typeof req.body?.isOnDuty === 'boolean' ? req.body.isOnDuty : !(target.isOnDuty !== false);
  persistTeam();

  res.json({ success: true, data: toFleetShape(target), message: `${target.name} marked as ${target.isOnDuty ? 'On-Duty' : 'Off-Duty'}` });
});

// Remove a rider from the fleet (Protected by delivery.manage)
apiRouter.delete('/admin/delivery-partners/:id', requirePermission(['delivery.manage', 'staff.edit', 'staff.create', '*']), (req: Request, res: Response) => {
  const { id } = req.params;
  const target = store.adminUsers.find((u) => u.id === id && u.role === 'delivery_person');
  if (!target) {
    return res.status(404).json({ success: false, error: 'Delivery partner not found' });
  }

  store.adminUsers = store.adminUsers.filter((u) => u.id !== target.id);
  persistTeam();

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Owner',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Removed delivery partner ${target.name} (+91 ${target.phone}) from the fleet`,
    module: 'delivery',
    result: 'success',
    req,
  });

  res.json({ success: true, message: `Removed ${target.name} from the delivery fleet` });
});

// ==========================================
// AUDIT LOGS ENDPOINT
// ==========================================

// Get system audit logs with filters (Protected by audit.view)
apiRouter.get('/admin/audit-logs', requirePermission('audit.view'), (req: Request, res: Response) => {
  const { module, role, search, limit = '100' } = req.query;

  let logs = [...store.auditLogs];

  if (module && typeof module === 'string' && module !== 'all') {
    logs = logs.filter((l) => l.module === module);
  }

  if (role && typeof role === 'string' && role !== 'all') {
    logs = logs.filter((l) => l.role === role);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase().trim();
    logs = logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.userName.toLowerCase().includes(q) ||
        l.userEmail.toLowerCase().includes(q) ||
        (l.details && l.details.toLowerCase().includes(q))
    );
  }

  const maxLogs = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 500);
  const slicedLogs = logs.slice(0, maxLogs);

  res.json({
    success: true,
    data: slicedLogs,
    total: store.auditLogs.length,
    filteredCount: logs.length,
  });
});

// ==========================================
// ADMIN PROTECTED MANAGEMENT ENDPOINTS
// ==========================================

// Get all orders (admin - strictly genuine customer orders)
apiRouter.get(
  '/admin/orders',
  requirePermission(['orders.view', 'orders.view_kitchen']),
  async (req: Request, res: Response) => {
    // Pull from MySQL if connected
    try {
      const dbOrders = await MySQLService.fetchOrders();
      if (dbOrders && dbOrders.length > 0) {
        // Purge any lingering fake orders in background
        const fakeOrders = dbOrders.filter(isFakeOrder);
        for (const fake of fakeOrders) {
          MySQLService.deleteOrder(fake.id).catch(() => {});
        }
        const realDb = dbOrders.filter((o) => !isFakeOrder(o));
        store.orders = mergeById(realDb, store.orders);
      }
    } catch {
      // In-memory fallback
    }
    // Ensure store is also 100% clean of fake orders
    store.orders = store.orders.filter((o) => !isFakeOrder(o));

    const callerUser = (req as any).adminUser as AdminAccessUser | undefined;

    // Kitchen staff view isolation: Only ordered items, quantities, modifiers, special instructions & prep status.
    // Financial numbers, prices, customer phone numbers, and full addresses are stripped.
    const KITCHEN_ONLY_ROLES: AdminRole[] = ['kitchen', 'kitchen_staff', 'kitchen_lead'];
    if (
      callerUser &&
      (KITCHEN_ONLY_ROLES.includes(callerUser.role) ||
        (!hasPermission(callerUser, 'orders.view') && hasPermission(callerUser, 'orders.view_kitchen')))
    ) {
      const sanitized = store.orders.map(sanitizeOrderForKitchen);
      return res.json({ success: true, data: sanitized });
    }

    res.json({ success: true, data: store.orders });
  }
);

// Purge any lingering demo / fake orders (admin - Owner only)
apiRouter.post('/admin/orders/purge-fake', requirePermission('*'), async (req: Request, res: Response) => {
  const fakeIds: string[] = [];
  store.orders = store.orders.filter((o) => {
    if (isFakeOrder(o)) {
      fakeIds.push(o.id);
      return false;
    }
    return true;
  });
  for (const id of [...fakeIds, ...Array.from(FAKE_ORDER_IDS)]) {
    await MySQLService.deleteOrder(id).catch(() => {});
  }

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Owner',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Purged demo/fake orders from system (${fakeIds.length} orders)`,
    module: 'orders',
    result: 'success',
    req,
  });

  // `data` is what api.purgeFakeOrders reads -- without it the dashboard reported every
  // successful purge as a failure.
  res.json({
    success: true,
    message: 'Scrubbed fake orders successfully',
    purgedCount: fakeIds.length,
    data: { purgedCount: fakeIds.length },
  });
});

// Purge all orders completely for a fresh clean state (admin - Root Owner only)
apiRouter.delete('/admin/orders-purge-all', requirePermission('*'), async (req: Request, res: Response) => {
  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  if (callerUser?.role !== 'owner') {
    return res.status(403).json({ success: false, error: 'Only the Restaurant Owner can purge all business orders.' });
  }

  const count = store.orders.length;
  for (const o of store.orders) {
    await MySQLService.deleteOrder(o.id).catch(() => {});
  }
  store.orders = [];

  recordAuditLog({
    userId: callerUser.id,
    userName: callerUser.name,
    userEmail: callerUser.email,
    role: callerUser.role,
    action: `Purged all ${count} recorded orders`,
    module: 'orders',
    result: 'success',
    req,
    details: 'Complete order database reset by Owner.',
  });

  res.json({ success: true, message: `Successfully deleted all ${count} recorded orders` });
});

// Update order status (admin)
apiRouter.patch('/admin/orders/:id/status', requirePermission('orders.update_status'), async (req: Request, res: Response) => {
  const validation = UpdateOrderStatusSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: 'Invalid status update', details: validation.error });
  }

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;

  // Kitchen Staff can strictly only transition through: NEW -> ACCEPTED -> PREPARING -> READY
  if (callerUser && (['kitchen', 'kitchen_staff', 'kitchen_lead'] as AdminRole[]).includes(callerUser.role)) {
    const allowedKitchenStatuses = ['accepted', 'preparing', 'ready'];
    if (!allowedKitchenStatuses.includes(validation.data.status)) {
      return res.status(403).json({
        success: false,
        error: `Kitchen staff workflow is restricted to: ACCEPTED, PREPARING, or READY. Status '${validation.data.status}' cannot be set by kitchen role.`,
      });
    }
  }

  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const previousStatus = order.status;
  order.status = validation.data.status;
  if (validation.data.statusNotes !== undefined) {
    order.statusNotes = validation.data.statusNotes;
  }
  if (validation.data.acceptedBy !== undefined) {
    order.acceptedBy = validation.data.acceptedBy;
  }
  if (validation.data.acceptedAt !== undefined) {
    order.acceptedAt = validation.data.acceptedAt;
  } else if ((validation.data.status === 'accepted' || validation.data.status === 'preparing') && !order.acceptedAt) {
    order.acceptedAt = new Date().toISOString();
  }
  if (validation.data.estimatedTimeMinutes !== undefined) {
    order.estimatedTimeMinutes = validation.data.estimatedTimeMinutes;
  }

  // Update in MySQL
  MySQLService.updateOrderStatus(order.id, order.status, {
    notes: order.statusNotes,
    acceptedBy: order.acceptedBy,
    acceptedAt: order.acceptedAt,
    estimatedTimeMinutes: order.estimatedTimeMinutes,
  }).catch((err) => {
    console.warn('Background MySQL order status update error:', err);
  });

  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Owner',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Updated Order #${order.id} status: ${previousStatus.toUpperCase()} → ${order.status.toUpperCase()}`,
    module: 'orders',
    result: 'success',
    req,
    details: validation.data.statusNotes || `Kitchen/Operations update`,
  });

  res.json({ success: true, message: 'Order status updated', data: order });
});

// Assign delivery partner to order (admin)
apiRouter.post('/admin/orders/:id/assign-delivery', requirePermission('orders.assign_delivery'), async (req: Request, res: Response) => {
  const validation = AssignDeliveryPartnerSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid delivery partner assignment data',
      details: validation.error,
    });
  }

  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const { partner, estimatedMinutes, notes, initialStage } = validation.data;
  const nowIso = new Date().toISOString();
  const arrivalDate = new Date(Date.now() + estimatedMinutes * 60 * 1000);
  const arrivalTimeStr = formatRestaurantTime(arrivalDate);

  order.deliveryPartner = partner as any;
  order.deliveryTracking = {
    partner: partner as any,
    stage: initialStage,
    statusNotes: notes || `Assigned to ${partner.name} (${partner.vehicleNumber})`,
    assignedAt: nowIso,
    arrivedAtPickupAt: initialStage !== 'assigned' ? nowIso : undefined,
    pickedUpAt:
      initialStage === 'picked_up' ||
      initialStage === 'on_the_way' ||
      initialStage === 'near_destination' ||
      initialStage === 'delivered'
        ? nowIso
        : undefined,
    deliveredAt: initialStage === 'delivered' ? nowIso : undefined,
    estimatedDeliveryMinutes: estimatedMinutes,
    estimatedArrivalTime: arrivalTimeStr,
    progressPercent:
      initialStage === 'assigned'
        ? 15
        : initialStage === 'arrived_at_pickup'
        ? 30
        : initialStage === 'picked_up'
        ? 50
        : initialStage === 'on_the_way'
        ? 78
        : initialStage === 'near_destination'
        ? 92
        : 100,
    currentLocationLabel:
      initialStage === 'assigned'
        ? `Heading towards OTT Restro Kukas`
        : initialStage === 'arrived_at_pickup'
        ? `At OTT Kitchen Counter`
        : initialStage === 'picked_up'
        ? `Leaving OTT Kukas on ${partner.vehicleNumber}`
        : initialStage === 'on_the_way'
        ? `Cruising NH-48 Jaipur-Delhi Road`
        : initialStage === 'near_destination'
        ? `Arrived in your locality / Gate`
        : `Delivered at doorstep`,
    pickupLocation: {
      name: store.cafeInfo.name,
      address: store.cafeInfo.address,
      phone: store.cafeInfo.phone,
      lat: 27.0543,
      lng: 75.8988,
    },
    deliveryLocation: {
      customerName: order.customerName,
      address: order.deliveryAddress || 'Delivery Address, Jaipur',
      phone: order.customerPhone,
      lat: 26.9855,
      lng: 75.8513,
    },
    waypoints: [
      {
        id: 'wp-1',
        name: 'Out of the Town (OTT) Restro',
        landmark: 'SP 41 B, NH-48, Kukas, Jaipur',
        distanceKm: 0,
        completed: initialStage !== 'assigned',
        active: initialStage === 'assigned' || initialStage === 'arrived_at_pickup',
        timeEstimate: '0 mins',
      },
      {
        id: 'wp-2',
        name: 'RIICO Industrial Area & Arya Junction',
        landmark: 'NH-48 Jaipur Bypass',
        distanceKm: 1.8,
        completed:
          initialStage === 'on_the_way' || initialStage === 'near_destination' || initialStage === 'delivered',
        active: initialStage === 'picked_up',
        timeEstimate: '5 mins',
      },
      {
        id: 'wp-3',
        name: 'Toll Plaza & Amity Corridor',
        landmark: 'Jaipur Corridor Stretch',
        distanceKm: 4.5,
        completed: initialStage === 'near_destination' || initialStage === 'delivered',
        active: initialStage === 'on_the_way',
        timeEstimate: '12 mins',
      },
      {
        id: 'wp-4',
        name: 'Destination Doorstep',
        landmark: order.deliveryAddress || 'Customer Address',
        distanceKm: 8.2,
        completed: initialStage === 'delivered',
        active: initialStage === 'near_destination',
        timeEstimate: `${estimatedMinutes} mins`,
      },
    ],
    timeline: [
      {
        stage: 'assigned',
        title: 'Delivery Partner Assigned',
        description: `${partner.name} (${partner.vehicleType.toUpperCase()} ${partner.vehicleNumber}) assigned for delivery`,
        timestamp: nowIso,
        completed: true,
      },
    ],
  };

  if (initialStage === 'picked_up' || initialStage === 'on_the_way') {
    order.status = 'ready';
    order.statusNotes = `Picked up by ${partner.name}`;
  } else if (initialStage === 'delivered') {
    order.status = 'delivered';
    order.statusNotes = `Delivered by ${partner.name}`;
  } else if (order.status === 'pending') {
    order.status = 'accepted';
  }

  // Create real-time notification record for assigned delivery partner
  const deliveryNotif: DeliveryNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    partnerId: partner.id,
    partnerName: partner.name,
    orderId: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.deliveryAddress || 'SP 41 B, Kukas, Jaipur',
    lat: order.deliveryTracking?.deliveryLocation?.lat || 26.9855,
    lng: order.deliveryTracking?.deliveryLocation?.lng || 75.8513,
    orderTotal: (order as any).totalAmount || order.total,
    itemsCount: order.items.length,
    itemsSummary: order.items.map((it) => `${it.quantity}x ${it.name}`).join(', '),
    paymentMethod: order.paymentMethod,
    notes: notes || (order as any).deliveryNotes || order.notes,
    assignedAt: nowIso,
    read: false,
  };
  store.deliveryNotifications.unshift(deliveryNotif);

  // Full save: the delivery assignment/tracking lives in extra_json, which a status-only
  // update would not write (so it was lost on restart).
  MySQLService.saveOrder(order).catch(() => {});

  res.json({
    success: true,
    message: `Delivery partner ${partner.name} assigned successfully to Order #${order.id}`,
    data: order,
  });
});

// Update delivery stage (admin)
apiRouter.patch('/admin/orders/:id/delivery-stage', requirePermission('delivery.update_status'), async (req: Request, res: Response) => {
  const validation = UpdateDeliveryStageSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid delivery stage update',
      details: validation.error,
    });
  }

  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  if (!order.deliveryTracking) {
    return res.status(400).json({
      success: false,
      error: 'Order does not have an assigned delivery partner yet',
    });
  }

  const { stage, notes, progressPercent, currentLocationLabel } = validation.data;
  const nowIso = new Date().toISOString();

  order.deliveryTracking.stage = stage;
  if (notes) order.deliveryTracking.statusNotes = notes;
  if (progressPercent !== undefined) {
    order.deliveryTracking.progressPercent = progressPercent;
  } else {
    order.deliveryTracking.progressPercent =
      stage === 'assigned'
        ? 15
        : stage === 'arrived_at_pickup'
        ? 30
        : stage === 'picked_up'
        ? 50
        : stage === 'on_the_way'
        ? 78
        : stage === 'near_destination'
        ? 92
        : 100;
  }

  if (currentLocationLabel) {
    order.deliveryTracking.currentLocationLabel = currentLocationLabel;
  } else {
    order.deliveryTracking.currentLocationLabel =
      stage === 'assigned'
        ? `Heading towards OTT Restro Kukas`
        : stage === 'arrived_at_pickup'
        ? `At OTT Kitchen Counter`
        : stage === 'picked_up'
        ? `Leaving OTT Kukas on ${order.deliveryPartner?.vehicleNumber || 'route'}`
        : stage === 'on_the_way'
        ? `Cruising NH-48 Jaipur-Delhi Road`
        : stage === 'near_destination'
        ? `Arrived in your locality / Gate`
        : `Delivered at doorstep`;
  }

  if (stage === 'arrived_at_pickup' && !order.deliveryTracking.arrivedAtPickupAt) {
    order.deliveryTracking.arrivedAtPickupAt = nowIso;
  }
  if (stage === 'picked_up') {
    order.deliveryTracking.pickedUpAt = nowIso;
    order.status = 'ready';
    order.statusNotes = `Food picked up by ${order.deliveryPartner?.name || 'delivery partner'}`;
  }
  if (stage === 'delivered') {
    order.deliveryTracking.deliveredAt = nowIso;
    order.status = 'delivered';
    order.statusNotes = 'Order delivered successfully';
  }

  // Update waypoints
  order.deliveryTracking.waypoints = order.deliveryTracking.waypoints.map((wp) => {
    if (stage === 'delivered') return { ...wp, completed: true, active: false };
    if (stage === 'near_destination' && wp.id === 'wp-4') return { ...wp, active: true, completed: false };
    if (stage === 'on_the_way' && (wp.id === 'wp-2' || wp.id === 'wp-3')) {
      return { ...wp, completed: wp.id === 'wp-2', active: wp.id === 'wp-3' };
    }
    return wp;
  });

  // Append timeline item if not duplicate
  if (!order.deliveryTracking.timeline.some((t) => t.stage === stage)) {
    const stageTitles: Record<string, string> = {
      assigned: 'Delivery Partner Assigned',
      arrived_at_pickup: 'Partner at OTT Kitchen',
      picked_up: 'Order Picked Up & Hot-Sealed',
      on_the_way: 'Food on the Way (NH-48 Transit)',
      near_destination: 'Rider Reached Locality',
      delivered: 'Delivered to Doorstep',
    };
    order.deliveryTracking.timeline.push({
      stage,
      title: stageTitles[stage] || stage,
      description: notes || order.deliveryTracking.currentLocationLabel,
      timestamp: nowIso,
      completed: true,
    });
  }

  // Full save: the delivery assignment/tracking lives in extra_json, which a status-only
  // update would not write (so it was lost on restart).
  MySQLService.saveOrder(order).catch(() => {});

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Staff',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Updated delivery stage for Order #${order.id} to ${stage.toUpperCase()}`,
    module: 'delivery',
    result: 'success',
    req,
  });

  res.json({
    success: true,
    message: `Delivery stage updated to ${stage}`,
    data: order,
  });
});

// ==========================================
// DELIVERY PARTNER PORTAL DEDICATED ROUTES
// ==========================================

// Get all delivery orders for Delivery Partner portal (can filter by partnerId)
// ==========================================
// DELIVERY PARTNER AUTHENTICATION
// ==========================================
// Real, verified rider login: a code is only ever issued for a phone number that
// matches an active delivery_person account the restaurant owner has already
// created (via Team & Access Management). This closes off self-declared "I'm a
// rider" access — a phone that isn't on file simply never receives a code.

apiRouter.post('/delivery/send-otp', otpSendLimiter, (req: Request, res: Response) => {
  const cleanPhone = normalizePhone(req.body?.phone);
  if (cleanPhone.length < 10) {
    return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit mobile number.' });
  }

  const partnerAccount = store.adminUsers.find(
    (u) => u.role === 'delivery_person' && u.isActive && u.phone && normalizePhone(u.phone) === cleanPhone
  );
  if (!partnerAccount) {
    return res.status(404).json({
      success: false,
      error: 'This number is not registered as a delivery partner. Ask the restaurant owner to add you first.',
    });
  }

  const otp = randomInt(100000, 1000000).toString(); // crypto.randomInt, not Math.random -- CSPRNG
  const key = `delivery:${cleanPhone}`;
  const expiresAt = Date.now() + 10 * 60 * 1000;
  store.pendingOtps.set(key, { otp, email: partnerAccount.email, phone: cleanPhone, expiresAt });

  console.log(`[DELIVERY OTP] Verification code issued for rider ${partnerAccount.name} (+91 ${cleanPhone})`);

  res.json({
    success: true,
    message: `Verification code sent to +91 ${cleanPhone}`,
    // No real SMS gateway is configured yet, so the code is echoed back for on-screen
    // display — same fallback used for customer OTP. Set DISABLE_OTP_PREVIEW=true the
    // moment a real provider (e.g. Twilio/MSG91) is wired up.
    ...(process.env.DISABLE_OTP_PREVIEW !== 'true' ? { otpPreview: otp } : {}),
  });
});

apiRouter.post('/delivery/verify-otp', otpVerifyLimiter, (req: Request, res: Response) => {
  const cleanPhone = normalizePhone(req.body?.phone);
  const otp = String(req.body?.otp || '').trim();
  const key = `delivery:${cleanPhone}`;
  const pending = store.pendingOtps.get(key);

  if (!pending || pending.otp !== otp || Date.now() > pending.expiresAt) {
    if (pending) {
      pending.attempts = (pending.attempts || 0) + 1;
      if (pending.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
        store.pendingOtps.delete(key);
        return res.status(400).json({
          success: false,
          error: 'Too many incorrect attempts. This code has been invalidated — please request a new one.',
        });
      }
    }
    return res.status(400).json({ success: false, error: 'Invalid or expired verification code.' });
  }
  store.pendingOtps.delete(key);

  const partnerAccount = store.adminUsers.find(
    (u) => u.role === 'delivery_person' && u.isActive && u.phone && normalizePhone(u.phone) === cleanPhone
  );
  if (!partnerAccount) {
    return res.status(404).json({ success: false, error: 'Delivery partner account no longer active.' });
  }

  const sessionToken = `staff_session_${partnerAccount.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  partnerAccount.sessionToken = sessionToken;
  partnerAccount.lastLogin = new Date().toISOString();
  partnerAccount.lastActiveAt = new Date().toISOString();

  // Persist whatever the rider submits at login onto their real account — this is the
  // one durable profile, not a per-login throwaway. Only overwrite fields they actually
  // provided so re-logging in without retyping details doesn't blank out saved values.
  if (typeof req.body?.name === 'string' && req.body.name.trim()) {
    partnerAccount.name = req.body.name.trim();
  }
  if (['bike', 'scooter', 'van', 'electric_ev', 'car'].includes(req.body?.vehicleType)) {
    partnerAccount.vehicleType = req.body.vehicleType;
  }
  if (typeof req.body?.vehicleNumber === 'string' && req.body.vehicleNumber.trim()) {
    partnerAccount.vehicleNumber = req.body.vehicleNumber.trim().toUpperCase();
  }
  if (!partnerAccount.vehicleType) partnerAccount.vehicleType = 'bike';
  if (!partnerAccount.vehicleNumber) partnerAccount.vehicleNumber = 'RJ-14';
  if (partnerAccount.isOnDuty === undefined) partnerAccount.isOnDuty = true;
  persistTeam();

  recordAuditLog({
    userId: partnerAccount.id,
    userName: partnerAccount.name,
    userEmail: partnerAccount.email,
    role: partnerAccount.role,
    action: `Delivery partner ${partnerAccount.name} signed into the rider portal`,
    module: 'auth',
    result: 'success',
    req,
  });

  res.json({
    success: true,
    token: sessionToken,
    partner: {
      id: partnerAccount.id,
      name: partnerAccount.name,
      phone: cleanPhone,
      vehicleType: partnerAccount.vehicleType,
      vehicleNumber: partnerAccount.vehicleNumber,
      rating: partnerAccount.rating ?? 4.8,
      totalDeliveries: partnerAccount.totalDeliveries ?? 0,
      photoUrl: partnerAccount.photoUrl,
      isOnDuty: partnerAccount.isOnDuty,
    },
  });
});

apiRouter.get('/delivery/orders', requireDeliveryPartner, async (req: Request, res: Response) => {
  // Always scope to the authenticated rider's own id — never trust a client-supplied
  // partnerId, which would otherwise let one rider read another rider's assignments.
  const partnerId = ((req as any).deliveryPartnerUser as AdminAccessUser).id;

  // Filter all genuine delivery orders: this rider's own assignments, plus anything
  // still unassigned and available to claim.
  const deliveryOrders = store.orders.filter(
    (o) =>
      o.orderType === 'delivery' &&
      o.status !== 'cancelled' &&
      (o.deliveryPartner?.id === partnerId || !o.deliveryPartner)
  );

  res.json({
    success: true,
    data: deliveryOrders,
    stats: {
      total: deliveryOrders.length,
      assigned: deliveryOrders.filter((o) => o.deliveryPartner?.id === partnerId && o.status !== 'delivered').length,
      completedToday: deliveryOrders.filter((o) => o.deliveryPartner?.id === partnerId && o.status === 'delivered').length,
      availableToClaim: deliveryOrders.filter((o) => !o.deliveryPartner && o.status !== 'delivered').length,
    },
  });
});

// Claim an unassigned delivery order by a partner
apiRouter.post('/delivery/orders/:id/claim', requireDeliveryPartner, async (req: Request, res: Response) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // The claiming rider's identity comes from their authenticated session, not from
  // whatever the client sends — only self-declared, non-sensitive equipment details
  // (vehicle type/number) are taken from the request body.
  const authedRider = (req as any).deliveryPartnerUser as AdminAccessUser;
  const bodyPartner = req.body?.partner || {};
  const partner = {
    id: authedRider.id,
    name: authedRider.name,
    phone: authedRider.phone || '',
    vehicleType: bodyPartner.vehicleType || 'bike',
    vehicleNumber: bodyPartner.vehicleNumber || 'RJ-14',
    rating: bodyPartner.rating || 4.9,
    totalDeliveries: bodyPartner.totalDeliveries || 0,
  };

  if (order.status === 'cancelled' || order.status === 'delivered' || order.orderType !== 'delivery') {
    return res.status(400).json({ success: false, error: 'This order is not available for delivery.' });
  }

  if (order.deliveryPartner && order.deliveryPartner.id !== partner.id) {
    return res.status(409).json({
      success: false,
      error: `This order is already claimed by another delivery partner (${order.deliveryPartner.name}).`,
    });
  }

  const nowIso = new Date().toISOString();
  order.deliveryPartner = partner;
  
  if (!order.deliveryTracking) {
    order.deliveryTracking = {
      partner,
      stage: 'assigned',
      statusNotes: `Claimed by ${partner.name} (${partner.vehicleNumber})`,
      assignedAt: nowIso,
      estimatedDeliveryMinutes: 25,
      estimatedArrivalTime: formatRestaurantTime(new Date(Date.now() + 25 * 60 * 1000)),
      progressPercent: 15,
      currentLocationLabel: 'Heading towards OTT Restro Kukas',
      pickupLocation: {
        name: store.cafeInfo.name,
        address: store.cafeInfo.address,
        phone: store.cafeInfo.phone,
        lat: 27.0543,
        lng: 75.8988,
      },
      deliveryLocation: {
        customerName: order.customerName,
        address: order.deliveryAddress || 'Kukas / Jaipur Delivery Address',
        phone: order.customerPhone,
        lat: 26.9855,
        lng: 75.8513,
      },
      waypoints: [
        { id: 'wp-1', name: 'Out of the Town (OTT) Restro', landmark: 'SP 41 B, NH-48, Kukas', distanceKm: 0, completed: false, active: true },
        { id: 'wp-2', name: 'RIICO Industrial Area', landmark: 'NH-48 Jaipur Bypass', distanceKm: 1.8, completed: false, active: false },
        { id: 'wp-3', name: 'Toll Plaza & Amity Corridor', landmark: 'Jaipur Corridor Stretch', distanceKm: 4.5, completed: false, active: false },
        { id: 'wp-4', name: 'Destination Doorstep', landmark: order.deliveryAddress || 'Customer Address', distanceKm: 8.2, completed: false, active: false },
      ],
      timeline: [
        {
          stage: 'assigned',
          title: 'Partner Assigned',
          description: `${partner.name} accepted this delivery run`,
          timestamp: nowIso,
          completed: true,
        },
      ],
    };
  } else {
    order.deliveryTracking.partner = partner;
    order.deliveryTracking.stage = 'assigned';
    order.deliveryTracking.statusNotes = `Assigned to ${partner.name} (${partner.vehicleNumber})`;
  }

  // Create notification record for claimed delivery
  const claimNotif: DeliveryNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    partnerId: partner.id,
    partnerName: partner.name,
    orderId: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.deliveryAddress || 'SP 41 B, Kukas, Jaipur',
    lat: order.deliveryTracking?.deliveryLocation?.lat || 26.9855,
    lng: order.deliveryTracking?.deliveryLocation?.lng || 75.8513,
    orderTotal: (order as any).totalAmount || order.total,
    itemsCount: order.items.length,
    itemsSummary: order.items.map((it) => `${it.quantity}x ${it.name}`).join(', '),
    paymentMethod: order.paymentMethod,
    notes: (order as any).deliveryNotes || order.notes,
    assignedAt: nowIso,
    read: false,
  };
  store.deliveryNotifications.unshift(claimNotif);

  // Full save: the delivery assignment/tracking lives in extra_json, which a status-only
  // update would not write (so it was lost on restart).
  MySQLService.saveOrder(order).catch(() => {});

  res.json({ success: true, message: `Order #${order.id} claimed successfully`, data: order });
});

// Delivery Partner updates stage directly from rider app
apiRouter.patch('/delivery/orders/:id/stage', requireDeliveryPartner, async (req: Request, res: Response) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const authedRider = (req as any).deliveryPartnerUser as AdminAccessUser;
  if (!order.deliveryTracking || order.deliveryTracking.partner?.id !== authedRider.id) {
    return res.status(403).json({
      success: false,
      error: 'You can only update delivery status for orders assigned to you.',
    });
  }

  const { stage, notes, currentLocationLabel, lat, lng, speedKmh } = req.body;
  // Same stage list the admin route validates with -- an unknown stage used to be stored as-is.
  const stageCheck = UpdateDeliveryStageSchema.shape.stage.safeParse(stage);
  if (!stageCheck.success) {
    return res.status(400).json({ success: false, error: 'Invalid delivery stage.' });
  }
  if (order.status === 'cancelled') {
    return res.status(400).json({ success: false, error: 'This order has been cancelled.' });
  }
  const nowIso = new Date().toISOString();

  order.deliveryTracking.stage = stage;
  if (notes) order.deliveryTracking.statusNotes = notes;

  // Update progress and location labels
  if (stage === 'assigned') {
    order.deliveryTracking.progressPercent = 15;
    order.deliveryTracking.currentLocationLabel = currentLocationLabel || 'Heading towards OTT Restro Kukas';
  } else if (stage === 'arrived_at_pickup') {
    order.deliveryTracking.progressPercent = 30;
    order.deliveryTracking.currentLocationLabel = currentLocationLabel || 'At OTT Kitchen Counter (Kukas)';
    if (!order.deliveryTracking.arrivedAtPickupAt) order.deliveryTracking.arrivedAtPickupAt = nowIso;
  } else if (stage === 'picked_up') {
    order.deliveryTracking.progressPercent = 50;
    order.deliveryTracking.currentLocationLabel = currentLocationLabel || 'Food picked up, starting transit';
    order.deliveryTracking.pickedUpAt = nowIso;
    order.status = 'ready';
  } else if (stage === 'on_the_way') {
    order.deliveryTracking.progressPercent = 78;
    order.deliveryTracking.currentLocationLabel = currentLocationLabel || 'Cruising NH-48 Jaipur-Delhi Road';
  } else if (stage === 'near_destination') {
    order.deliveryTracking.progressPercent = 92;
    order.deliveryTracking.currentLocationLabel = currentLocationLabel || 'Arrived in customer locality / Gate';
  } else if (stage === 'delivered') {
    order.deliveryTracking.progressPercent = 100;
    order.deliveryTracking.currentLocationLabel = currentLocationLabel || 'Delivered at customer doorstep';
    order.deliveryTracking.deliveredAt = nowIso;
    order.status = 'delivered';
    order.statusNotes = 'Delivered successfully by delivery partner';
  }

  // Update real-time GPS coordinates if provided
  if (lat !== undefined && lng !== undefined) {
    order.deliveryTracking.partnerLocation = {
      lat: Number(lat),
      lng: Number(lng),
      speedKmh: speedKmh ? Number(speedKmh) : undefined,
      updatedAt: nowIso,
    };
  }

  // Update timeline
  const stageTitles: Record<string, string> = {
    assigned: 'Delivery Partner Assigned',
    arrived_at_pickup: 'Partner at OTT Kitchen Counter',
    picked_up: 'Order Picked Up & Hot-Sealed',
    on_the_way: 'Food on the Way (NH-48 Transit)',
    near_destination: 'Rider Reached Customer Gate',
    delivered: 'Delivered to Doorstep',
  };

  if (!order.deliveryTracking.timeline.some((t) => t.stage === stage)) {
    order.deliveryTracking.timeline.push({
      stage,
      title: stageTitles[stage] || stage,
      description: notes || order.deliveryTracking.currentLocationLabel,
      timestamp: nowIso,
      completed: true,
    });
  }

  // Full save: the delivery assignment/tracking lives in extra_json, which a status-only
  // update would not write (so it was lost on restart).
  MySQLService.saveOrder(order).catch(() => {});

  res.json({ success: true, message: `Delivery stage updated to ${stage}`, data: order });
});

// Delivery Partner real-time GPS coordinate ping
apiRouter.post('/delivery/orders/:id/location', requireDeliveryPartner, async (req: Request, res: Response) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order || !order.deliveryTracking) {
    return res.status(404).json({ success: false, error: 'Order tracking not found' });
  }

  const authedRider = (req as any).deliveryPartnerUser as AdminAccessUser;
  if (order.deliveryTracking.partner?.id !== authedRider.id) {
    return res.status(403).json({
      success: false,
      error: 'You can only send location updates for orders assigned to you.',
    });
  }

  const { lat, lng, speedKmh, heading, currentLocationLabel } = req.body;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ success: false, error: 'Latitude and longitude are required' });
  }

  const nowIso = new Date().toISOString();
  order.deliveryTracking.partnerLocation = {
    lat: Number(lat),
    lng: Number(lng),
    speedKmh: speedKmh ? Number(speedKmh) : undefined,
    heading: heading ? Number(heading) : undefined,
    updatedAt: nowIso,
  };

  if (currentLocationLabel) {
    order.deliveryTracking.currentLocationLabel = currentLocationLabel;
  }

  res.json({
    success: true,
    data: order.deliveryTracking.partnerLocation,
    partnerLocation: order.deliveryTracking.partnerLocation,
  });
});

// Get delivery notifications for rider (always scoped to the authenticated rider's own id)
apiRouter.get('/delivery/notifications', requireDeliveryPartner, (req: Request, res: Response) => {
  const partnerId = ((req as any).deliveryPartnerUser as AdminAccessUser).id;
  const notifications = (store.deliveryNotifications || []).filter(
    (n) => n.partnerId === partnerId || n.partnerId === 'all' || !n.partnerId
  );
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({
    success: true,
    data: notifications,
    unreadCount,
  });
});

// Mark single notification as read
apiRouter.patch('/delivery/notifications/:id/read', requireDeliveryPartner, (req: Request, res: Response) => {
  const partnerId = ((req as any).deliveryPartnerUser as AdminAccessUser).id;
  // Only the rider's own notifications (one rider could previously mark another's as read).
  const notif = store.deliveryNotifications?.find((n) => n.id === req.params.id && n.partnerId === partnerId);
  if (notif) {
    notif.read = true;
  }
  res.json({ success: true, message: 'Notification marked as read', data: notif });
});

// Mark all notifications as read for the authenticated rider
apiRouter.post('/delivery/notifications/mark-all-read', requireDeliveryPartner, (req: Request, res: Response) => {
  const partnerId = ((req as any).deliveryPartnerUser as AdminAccessUser).id;
  if (store.deliveryNotifications) {
    store.deliveryNotifications.forEach((n) => {
      if (n.partnerId === partnerId) {
        n.read = true;
      }
    });
  }
  res.json({ success: true, message: 'All notifications marked as read' });
});

// Send test notification to self (rider previewing what an alert looks like)
apiRouter.post('/delivery/notifications/test', requireDeliveryPartner, (req: Request, res: Response) => {
  const authedRider = (req as any).deliveryPartnerUser as AdminAccessUser;
  const testNotif: DeliveryNotification = {
    id: `notif-test-${Date.now()}`,
    partnerId: authedRider.id,
    partnerName: authedRider.name,
    orderId: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName: 'Ananya Sharma',
    customerPhone: '+91 98290 55432',
    customerAddress: 'Villa 14, Royal Greens Enclave, Near Amity University Campus, NH-48 Kukas, Jaipur',
    lat: 26.9855,
    lng: 75.8513,
    orderTotal: 749,
    itemsCount: 3,
    itemsSummary: '1x OTT Special Royal Thali, 1x Kurkure Momos, 1x Tiramisu Cold Coffee',
    paymentMethod: 'cash',
    notes: 'Please ring bell twice. Call upon reaching main entrance gate.',
    assignedAt: new Date().toISOString(),
    read: false,
  };
  if (!store.deliveryNotifications) store.deliveryNotifications = [];
  store.deliveryNotifications.unshift(testNotif);

  res.json({
    success: true,
    message: 'Test notification triggered successfully',
    data: testNotif,
  });
});

// Cancel any order (admin)
apiRouter.post('/admin/orders/:id/cancel', requirePermission('orders.cancel'), async (req: Request, res: Response) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const reason =
    (typeof req.body?.reason === 'string' && req.body.reason.trim().slice(0, 200)) ||
    'Cancelled by restaurant management / customer request';
  order.status = 'cancelled';
  order.statusNotes = reason;

  await MySQLService.updateOrderStatus(order.id, 'cancelled', { notes: reason }).catch((err) => {
    console.warn('MySQL: failed to update cancelled status:', err);
  });

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  if (callerUser) {
    recordAuditLog({
      userId: callerUser.id,
      userName: callerUser.name,
      userEmail: callerUser.email,
      role: callerUser.role,
      action: `Cancelled order #${order.id}`,
      module: 'orders',
      result: 'success',
      req,
      details: reason,
    });
  }

  res.json({ success: true, message: `Order #${order.id} has been cancelled`, data: order });
});

// Delete / Remove order history record permanently (admin - Owner only, since this is irreversible)
apiRouter.delete('/admin/orders/:id', requirePermission('orders.delete'), async (req: Request, res: Response) => {
  const index = store.orders.findIndex((o) => o.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Order not found in records' });
  }

  const [deletedOrder] = store.orders.splice(index, 1);

  await MySQLService.deleteOrder(req.params.id).catch((err) => {
    console.warn(`MySQL: failed to delete order ${req.params.id}:`, err);
  });

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  if (callerUser) {
    recordAuditLog({
      userId: callerUser.id,
      userName: callerUser.name,
      userEmail: callerUser.email,
      role: callerUser.role,
      action: `Permanently deleted order #${req.params.id}`,
      module: 'orders',
      result: 'success',
      req,
    });
  }

  res.json({
    success: true,
    message: `Order #${req.params.id} permanently removed from history and database`,
    data: deletedOrder,
  });
});

// Generate and record invoice / bill in MySQL (admin)
apiRouter.post('/admin/orders/:id/invoice', requirePermission(['orders.view', 'finance.view_sales']), async (req: Request, res: Response) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const invoiceNumber = `INV-${order.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  const invoiceData = {
    id: `inv-${order.id}`,
    orderId: order.id,
    invoiceNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    subtotal: order.subtotal,
    discount: order.discount,
    deliveryFee: order.deliveryFee,
    tax: order.tax,
    total: order.total,
    paymentMethod: order.paymentMethod,
    items: order.items,
    createdAt: new Date().toISOString(),
  };

  await MySQLService.saveInvoice(invoiceData).catch((err) => {
    console.warn('MySQL: failed to save invoice record:', err);
  });

  res.json({
    success: true,
    message: 'Official invoice generated and saved to MySQL',
    data: {
      ...invoiceData,
      cafe: store.cafeInfo,
    },
  });
});

// Get all reservations (admin - strictly genuine customer reservations)
apiRouter.get('/admin/reservations', requirePermission('reservations.view'), async (req: Request, res: Response) => {
  try {
    const dbReservations = await MySQLService.fetchReservations();
    if (dbReservations && dbReservations.length > 0) {
      // Purge fake reservations in background
      const fakeResvs = dbReservations.filter(isFakeReservation);
      for (const fake of fakeResvs) {
        MySQLService.deleteReservation(fake.id).catch(() => {});
      }
      const realDb = dbReservations.filter((r) => !isFakeReservation(r));
      store.reservations = mergeById(realDb, store.reservations);
    }
  } catch {
    // In-memory fallback
  }
  store.reservations = store.reservations.filter((r) => !isFakeReservation(r));
  res.json({ success: true, data: store.reservations });
});

// Update reservation status (admin)
apiRouter.patch(
  '/admin/reservations/:id/status',
  requirePermission(['reservations.confirm', 'reservations.cancel']),
  async (req: Request, res: Response) => {
    const validation = UpdateReservationStatusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid status', details: validation.error });
    }

    const resv = store.reservations.find((r) => r.id === req.params.id);
    if (!resv) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    const previousStatus = resv.status;
    resv.status = validation.data.status;

    // Update in MySQL
    MySQLService.updateReservationStatus(resv.id, resv.status).catch((err) => {
      console.warn('Background MySQL reservation update error:', err);
    });

    const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
    recordAuditLog({
      userId: callerUser?.id || 'admin-owner-satyam',
      userName: callerUser?.name || 'Staff',
      userEmail: callerUser?.email || OWNER_EMAIL,
      role: callerUser?.role || 'owner',
      action: `Updated Reservation #${resv.id} status: ${previousStatus.toUpperCase()} → ${resv.status.toUpperCase()}`,
      module: 'reservations',
      result: 'success',
      req,
    });

    res.json({ success: true, message: 'Reservation status updated', data: resv });
  }
);

// Add new menu item (admin)
apiRouter.post('/admin/menu', requirePermission('menu.create'), async (req: Request, res: Response) => {
  const validation = MenuItemSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: 'Invalid menu item data', details: validation.error });
  }

  const newItem: MenuItem = {
    ...validation.data,
    id: `item-${Date.now()}`,
    isVeg: validation.data.isVeg ?? true,
    isAvailable: validation.data.isAvailable ?? true,
    rating: validation.data.rating ?? 4.5,
    reviewsCount: validation.data.reviewsCount ?? 1,
  };

  store.menuItems.unshift(newItem);
  await MySQLService.saveMenuItem(newItem).catch((err) => {
    console.warn('MySQL: failed to save menu item:', err);
  });

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Staff',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Created menu item: ${newItem.name} (₹${newItem.price})`,
    module: 'menu',
    result: 'success',
    req,
  });

  res.status(201).json({ success: true, message: 'Menu item created and saved to database', data: newItem });
});

// Edit menu item (admin)
apiRouter.put(
  '/admin/menu/:id',
  requirePermission(['menu.edit', 'menu.change_availability', 'menu.change_price']),
  async (req: Request, res: Response) => {
    const validation = MenuItemSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid menu item data', details: validation.error });
    }

    const index = store.menuItems.findIndex((m) => m.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    const previousItem = { ...store.menuItems[index] };
    store.menuItems[index] = {
      ...store.menuItems[index],
      ...onlySentFields(validation.data, req.body),
    };

    await MySQLService.saveMenuItem(store.menuItems[index]).catch((err) => {
      console.warn('MySQL: failed to update menu item:', err);
    });

    const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
    const item = store.menuItems[index];
    const changes: string[] = [];
    if (previousItem.isAvailable !== item.isAvailable) {
      changes.push(`Availability: ${item.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`);
    }
    if (previousItem.price !== item.price) {
      changes.push(`Price: ₹${previousItem.price} → ₹${item.price}`);
    }
    const details = changes.length > 0 ? changes.join(', ') : 'Updated attributes';

    recordAuditLog({
      userId: callerUser?.id || 'admin-owner-satyam',
      userName: callerUser?.name || 'Staff',
      userEmail: callerUser?.email || OWNER_EMAIL,
      role: callerUser?.role || 'owner',
      action: `Updated menu item: "${item.name}"`,
      module: 'menu',
      result: 'success',
      req,
      details,
    });

    res.json({ success: true, message: 'Menu item updated in database', data: store.menuItems[index] });
  }
);

// Delete menu item (admin)
apiRouter.delete('/admin/menu/:id', requirePermission('menu.delete'), async (req: Request, res: Response) => {
  const index = store.menuItems.findIndex((m) => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Menu item not found' });
  }

  const deleted = store.menuItems.splice(index, 1);
  await MySQLService.deleteMenuItem(req.params.id).catch((err) => {
    console.warn('MySQL: failed to delete menu item:', err);
  });

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Staff',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Deleted menu item: "${deleted[0].name}"`,
    module: 'menu',
    result: 'success',
    req,
  });

  res.json({ success: true, message: 'Menu item deleted from database', data: deleted[0] });
});

// ==========================================
// FOOD CATEGORIES MANAGEMENT (admin)
// ==========================================

// Add category
apiRouter.post('/admin/categories', requirePermission('menu.create'), (req: Request, res: Response) => {
  const { name, slug, description, image, icon } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: 'Category name is required' });
  }

  const newSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).trim();
  const newCat = {
    id: `cat-${Date.now()}`,
    name: name.trim(),
    slug: newSlug,
    icon: icon || 'UtensilsCrossed',
    description: description || `Handcrafted ${name}`,
    image: image || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80',
  };

  store.categories.push(newCat);

  // Regression note: this route (and the PUT/DELETE ones below) never called MySQLService at
  // all — the save/delete functions existed and worked (confirmed: the seeded categories sync
  // fine through the bulk sync path), they just weren't wired into the actual admin CRUD
  // routes, so anything an admin added/edited/removed here silently never reached MySQL.
  MySQLService.saveCategory(newCat).catch((err) => {
    console.warn('Background MySQL category sync error:', err);
  });

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Staff',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Added food category: "${newCat.name}"`,
    module: 'menu',
    result: 'success',
    req,
  });

  res.status(201).json({ success: true, message: 'Category added', data: newCat });
});

// Edit food category (admin)
apiRouter.put('/admin/categories/:id', requirePermission('menu.edit'), (req: Request, res: Response) => {
  const { name, slug, description, image, icon } = req.body;
  const index = store.categories.findIndex((c) => c.id === req.params.id || c.slug === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Category not found' });
  }

  const oldSlug = store.categories[index].slug;
  const updatedSlug = slug ? slug.trim() : (name ? name.toLowerCase().replace(/[^a-z0-9]/g, '-') : oldSlug);

  store.categories[index] = {
    ...store.categories[index],
    ...(name ? { name: name.trim() } : {}),
    ...(slug ? { slug: updatedSlug } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(image ? { image } : {}),
    ...(icon ? { icon } : {}),
  };

  // If the category slug changed, update all menu items in store that were mapped to oldSlug
  if (oldSlug && updatedSlug && oldSlug !== updatedSlug) {
    store.menuItems.forEach((item) => {
      if (item.category === oldSlug) {
        item.category = updatedSlug;
      }
    });
  }

  MySQLService.saveCategory(store.categories[index]).catch((err) => {
    console.warn('Background MySQL category sync error:', err);
  });

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Staff',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Updated food category: "${store.categories[index].name}"`,
    module: 'menu',
    result: 'success',
    req,
  });

  res.json({
    success: true,
    message: 'Food category updated successfully',
    data: store.categories[index],
    categories: store.categories,
  });
});

// Delete category
apiRouter.delete('/admin/categories/:id', requirePermission('menu.delete'), (req: Request, res: Response) => {
  const index = store.categories.findIndex((c) => c.id === req.params.id || c.slug === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Category not found' });
  }
  const deleted = store.categories.splice(index, 1);

  MySQLService.deleteCategory(deleted[0].id).catch((err) => {
    console.warn('Background MySQL category delete error:', err);
  });

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Staff',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Deleted food category: "${deleted[0].name}"`,
    module: 'menu',
    result: 'success',
    req,
  });

  res.json({ success: true, message: 'Category removed', data: deleted[0] });
});

// Manage Promotional Banners (admin)
apiRouter.get('/admin/banners', requirePermission('banners.view'), (req: Request, res: Response) => {
  res.json({ success: true, data: store.promoBanners });
});

apiRouter.post('/admin/banners', requirePermission('banners.manage'), async (req: Request, res: Response) => {
  const validation = PromoBannerSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: 'Invalid banner data', details: validation.error });
  }

  const newBanner: PromoBanner = {
    ...validation.data,
    id: `promo-${Date.now()}`,
    active: validation.data.active ?? true,
    badgeBgColor: validation.data.badgeBgColor || 'bg-amber-600',
  };

  store.promoBanners.unshift(newBanner);
  await MySQLService.saveBanner(newBanner).catch((err) => {
    console.warn('MySQL: failed to save banner:', err);
  });

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Staff',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Created promotional banner: "${newBanner.title}"`,
    module: 'marketing',
    result: 'success',
    req,
  });

  res.status(201).json({ success: true, message: 'Banner added and saved to database', data: newBanner });
});

apiRouter.put('/admin/banners/:id', requirePermission('banners.manage'), async (req: Request, res: Response) => {
  const validation = PromoBannerSchema.partial().safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: 'Invalid banner data', details: validation.error });
  }

  const index = store.promoBanners.findIndex((b) => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Banner not found' });
  }

  store.promoBanners[index] = {
    ...store.promoBanners[index],
    ...onlySentFields(validation.data, req.body),
  };

  await MySQLService.saveBanner(store.promoBanners[index]).catch((err) => {
    console.warn('MySQL: failed to update banner:', err);
  });

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Staff',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Updated promotional banner: "${store.promoBanners[index].title}"`,
    module: 'marketing',
    result: 'success',
    req,
  });

  res.json({ success: true, message: 'Banner updated in database', data: store.promoBanners[index] });
});

apiRouter.delete('/admin/banners/:id', requirePermission('banners.manage'), async (req: Request, res: Response) => {
  const index = store.promoBanners.findIndex((b) => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Banner not found' });
  }

  const deleted = store.promoBanners.splice(index, 1);
  await MySQLService.deleteBanner(req.params.id).catch((err) => {
    console.warn('MySQL: failed to delete banner:', err);
  });

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Staff',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Deleted promotional banner: "${deleted[0].title}"`,
    module: 'marketing',
    result: 'success',
    req,
  });

  res.json({ success: true, message: 'Banner deleted from database', data: deleted[0] });
});

// Update Cafe Info (admin)
apiRouter.put('/admin/cafe-info', requirePermission('settings.edit'), async (req: Request, res: Response) => {
  // Whitelist + type-check. This used to spread the raw body straight into cafeInfo, so any
  // key (or a closedUntil like "tomorrow evening" that parses to NaN) was stored as-is.
  const body = req.body || {};
  const updates: Partial<CafeInfo> = {};
  for (const key of ['name', 'tagline', 'phone', 'email', 'address', 'openingHours', 'announcement', 'closedReason'] as const) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string' || body[key].length > 1000) {
        return res.status(400).json({ success: false, error: `Invalid value for ${key}` });
      }
      (updates as any)[key] = body[key].trim();
    }
  }
  if (body.isOpen !== undefined) {
    if (typeof body.isOpen !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isOpen must be true or false' });
    }
    updates.isOpen = body.isOpen;
  }
  if (body.closedUntil !== undefined) {
    if (body.closedUntil === null || body.closedUntil === '') {
      updates.closedUntil = null;
    } else {
      // Must carry an explicit timezone (e.g. "...Z" or "+05:30"): a bare "2026-10-01T18:00"
      // would be read in the server's timezone (UTC on AWS), 5.5 hours off from IST.
      const hasZone = typeof body.closedUntil === 'string' && /(Z|[+-]\d{2}:?\d{2})$/.test(body.closedUntil);
      const t = hasZone ? new Date(body.closedUntil).getTime() : NaN;
      if (Number.isNaN(t)) {
        return res.status(400).json({ success: false, error: 'closedUntil must be an ISO date-time with timezone' });
      }
      if (t <= Date.now()) {
        return res.status(400).json({ success: false, error: 'The reopening time must be in the future' });
      }
      updates.closedUntil = new Date(t).toISOString();
    }
  }
  if (updates.isOpen === true && body.closedUntil === undefined) {
    // Reopening now cancels any scheduled closure too.
    updates.closedUntil = null;
  }

  store.cafeInfo = {
    ...store.cafeInfo,
    ...updates,
  };

  await MySQLService.saveCafeInfo(store.cafeInfo).catch((err) => {
    console.warn('MySQL: failed to save cafe info:', err);
  });

  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Staff',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Updated restaurant business details and settings`,
    module: 'settings',
    result: 'success',
    req,
  });

  res.json({ success: true, message: 'Cafe details updated and stored in database', data: store.cafeInfo });
});

// ==========================================
// MYSQL DATABASE MANAGEMENT ENDPOINTS
// ==========================================

// Check MySQL connection status
apiRouter.get('/admin/mysql/status', requirePermission('database.view'), async (req: Request, res: Response) => {
  const status = await MySQLService.checkStatus();
  res.json({ success: true, data: status });
});

// Public status endpoint (safe: only returns boolean connected / configured)
apiRouter.get('/mysql/status', async (req: Request, res: Response) => {
  const status = await MySQLService.checkStatus();
  res.json({
    success: true,
    data: {
      configured: status.configured,
      connected: status.connected,
      tablesFound: status.tablesFound,
    },
  });
});

// Get SQL DDL schema for MySQL
apiRouter.get('/admin/mysql/schema', requirePermission('database.view'), (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      sql: MySQLService.getSchemaSql(),
    },
  });
});

// Reusable complete data synchronization function for MySQL
export async function executeMySQLSync(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    syncedOrders: number;
    syncedReservations: number;
    syncedCategories: number;
    syncedMenu: number;
    syncedBanners: number;
    totalOrders: number;
    totalReservations: number;
    totalCategories: number;
    totalMenuItems: number;
    totalBanners: number;
  };
}> {
  try {
    let ordersCount = 0;
    let resvCount = 0;
    let menuCount = 0;
    let categoriesCount = 0;
    let bannersCount = 0;

    for (const order of store.orders) {
      const ok = await MySQLService.saveOrder(order);
      if (ok) ordersCount++;
    }

    for (const resv of store.reservations) {
      const ok = await MySQLService.saveReservation(resv);
      if (ok) resvCount++;
    }

    for (const cat of store.categories) {
      const ok = await MySQLService.saveCategory(cat);
      if (ok) categoriesCount++;
    }

    for (const m of store.menuItems) {
      const ok = await MySQLService.saveMenuItem(m);
      if (ok) menuCount++;
    }

    for (const b of store.promoBanners) {
      const ok = await MySQLService.saveBanner(b);
      if (ok) bannersCount++;
    }

    await MySQLService.saveCafeInfo(store.cafeInfo);

    // Also pull any recent updates from MySQL into memory store
    await MySQLService.hydrateStoreFromMySQL(store).catch((e) => {
      console.warn('[MySQL Sync] Hydration warning during cycle:', e.message);
    });

    return {
      success: true,
      message: `Synchronized ${ordersCount} orders, ${resvCount} reservations, ${categoriesCount} categories, ${menuCount} dishes, and ${bannersCount} banners with MySQL.`,
      data: {
        syncedOrders: ordersCount,
        syncedReservations: resvCount,
        syncedCategories: categoriesCount,
        syncedMenu: menuCount,
        syncedBanners: bannersCount,
        totalOrders: store.orders.length,
        totalReservations: store.reservations.length,
        totalCategories: store.categories.length,
        totalMenuItems: store.menuItems.length,
        totalBanners: store.promoBanners.length,
      },
    };
  } catch (err: any) {
    console.warn('[MySQL Sync] Error during sync cycle:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

// Bulk sync existing in-memory data to MySQL (orders, reservations, menu, banners, cafe-info)
apiRouter.post('/admin/mysql/sync-all', requirePermission('database.manage'), async (req: Request, res: Response) => {
  const result = await executeMySQLSync();
  const callerUser = (req as any).adminUser as AdminAccessUser | undefined;
  recordAuditLog({
    userId: callerUser?.id || 'admin-owner-satyam',
    userName: callerUser?.name || 'Staff',
    userEmail: callerUser?.email || OWNER_EMAIL,
    role: callerUser?.role || 'owner',
    action: `Executed complete database synchronization with MySQL`,
    module: 'database',
    result: result.success ? 'success' : 'failure',
    req,
    details: result.message || result.error,
  });
  res.json(result);
});

// Auto-hydrate store from MySQL on module load / server boot
MySQLService.hydrateStoreFromMySQL(store).catch((err) => {
  console.warn('Startup MySQL hydration error:', err);
});

// Catch-all for any /api/* path that didn't match a real route above (wrong method, typo,
// old/removed endpoint). Without this, an unmatched request here falls through to the SPA's
// own catch-all and silently gets back index.html with a 200 status instead of a clear 404 —
// which makes integration bugs (wrong URL, wrong verb) much harder to notice and debug.
apiRouter.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// 10-Minute Automatic MySQL Background Sync
const TEN_MINUTES_MS = 10 * 60 * 1000;
const mysqlSyncInterval = setInterval(async () => {
  console.log(`[MySQL Auto-Sync] Executing 10-minute automatic data synchronization cycle (${new Date().toLocaleTimeString()})...`);
  try {
    const result = await executeMySQLSync();
    if (result.success) {
      console.log(`[MySQL Auto-Sync] Success: ${result.message}`);
    } else {
      console.log(`[MySQL Auto-Sync] Skipped: ${result.error || 'Pool not ready'}`);
    }
  } catch (err: any) {
    console.warn('[MySQL Auto-Sync] Scheduled cycle error:', err.message);
  }
}, TEN_MINUTES_MS);

if (mysqlSyncInterval && typeof mysqlSyncInterval.unref === 'function') {
  mysqlSyncInterval.unref();
}
