import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * ============================================================================
 * RATE LIMITING & ANTI-BOMBING MIDDLEWARE
 * ============================================================================
 * Protects against DDoS attacks, automated script bombing, order spam, and
 * brute-force admin attacks.
 */

// Rate-limit key is the connection IP as resolved by Express's own `req.ip`, which honors
// the single trusted proxy hop set via `app.set('trust proxy', 1)` in server/app.ts.
// Do NOT hand-parse X-Forwarded-For/Forwarded here — those headers are client-controlled
// beyond the trusted hop, and keying on them lets an attacker rotate the value per request
// to bypass every limiter below.
// Disabled only under the automated test suite (vitest sets NODE_ENV=test) — tests fire many
// requests within the same second on purpose, which would otherwise trip the per-second
// limiter and turn every other test's result into a false "429" failure. Never true outside
// of `vitest run`; production/dev behavior is completely unaffected.
const isTestEnv = process.env.NODE_ENV === 'test';

const commonRateLimitOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
};

// Small, local duplicate of routes.ts's own normalizePhone — importing that function here
// would create a circular import (routes.ts already imports this file for the limiters
// below), and the logic is a single, stable one-liner not worth restructuring the module
// graph over. Same behavior: strip everything but digits, keep the last 10.
function normalizePhoneForRateLimit(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\D/g, '').slice(-10);
}

// Per-phone key (falling back to IP only if no usable phone was submitted) — an OTP abuse
// limiter keyed solely on IP is exactly what lets one attacker rotate IPs/proxies to keep
// hammering the same victim's phone number, or lets many different phones behind one shared
// IP (an office, a campus NAT) get needlessly throttled by each other's requests.
function otpPhoneKey(req: Request): string {
  const phone = normalizePhoneForRateLimit((req.body as any)?.phone);
  return phone.length === 10 ? `phone:${phone}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
}

// 0. Strict 10 Requests Per Second Anti-Bombing Rate Limiter
// Maximum 10 requests per second per IP to prevent bombing attacks and server overload
export const secondRateLimiter = rateLimit({
  ...commonRateLimitOptions,
  windowMs: 1000, // 1 second window
  max: 10, // At most 10 requests per second
  // Authenticated admin/rider routes are covered by staffApiLimiter instead (same exemption as
  // generalApiLimiter). Opening the dashboard fires ~a dozen requests at once, so this cap
  // 429'd some of them (e.g. reservations) and those panels silently stayed empty.
  skip: (req: Request) => isTestEnv || req.path.startsWith('/admin') || req.path.startsWith('/delivery'),
  message: {
    success: false,
    error: 'Too many requests. Limit is 10 requests per second to prevent bombing attacks and server overload.',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Limit is 10 requests per second to prevent bombing attacks and server overload. Please slow down.',
      retryAfterSeconds: 1,
    });
  },
});

// 1. General API Rate Limiter — for PUBLIC, unauthenticated traffic only (menu browsing,
// cafe info, order/reservation lookups). Admin and delivery routes are excluded here and
// covered by staffApiLimiter below instead: they already require a valid session token, and
// 150 req/10min is far too tight for a dashboard that legitimately polls every few seconds —
// one logged-in owner's own tab was enough to 429 the whole site (customers included, since
// they can share an IP) during completely normal use, not an attack.
export const generalApiLimiter = rateLimit({
  ...commonRateLimitOptions,
  windowMs: 10 * 60 * 1000,
  max: 150,
  skip: (req: Request) => isTestEnv || req.path.startsWith('/admin') || req.path.startsWith('/delivery'),
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again in a few minutes.',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Anti-bombing protection triggered. Please wait a moment before trying again.',
      retryAfterSeconds: Math.ceil(10 * 60),
    });
  },
});

// 1b. Staff/Rider API Limiter — authenticated dashboard & delivery-portal polling gets a much
// higher budget than anonymous public traffic, since the auth requirement itself is the real
// abuse control here.
export const staffApiLimiter = rateLimit({
  ...commonRateLimitOptions,
  windowMs: 10 * 60 * 1000,
  max: 1800, // ~3 req/sec sustained — comfortable for several open dashboard/rider tabs
  message: {
    success: false,
    error: 'Too many requests from this account. Please try again shortly.',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a moment before trying again.',
      retryAfterSeconds: 30,
    });
  },
});

// 2. Strict Anti-Bombing Limiter for Orders & Checkout
// Max 12 order creations per 10 minutes per IP
export const orderLimiter = rateLimit({
  ...commonRateLimitOptions,
  windowMs: 10 * 60 * 1000,
  max: 12,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Order request rate limit exceeded. To prevent duplicate charges or spam, please wait 5 minutes before placing another order.',
      retryAfterSeconds: 300,
    });
  },
});

// 3. Anti-Bombing Limiter for Table Reservations
// Max 8 reservations per 15 minutes per IP
export const reservationLimiter = rateLimit({
  ...commonRateLimitOptions,
  windowMs: 15 * 60 * 1000,
  max: 8,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Reservation submission limit reached. Please call the cafe directly if you need multiple immediate bookings.',
      retryAfterSeconds: 450,
    });
  },
});

// 4. Brute-force Limiter for Admin Authentication
// Max 6 attempts per 15 minutes
export const adminAuthLimiter = rateLimit({
  ...commonRateLimitOptions,
  windowMs: 15 * 60 * 1000,
  max: 6,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many failed admin authentication attempts. For security reasons, this endpoint is temporarily locked for 15 minutes.',
      retryAfterSeconds: 900,
    });
  },
});

// 5. OTP Send Limiter — customer & delivery-partner login alike. Keyed per-phone (see
// otpPhoneKey above), not just per-IP: without this, nothing stopped a single phone number
// from being sent unlimited verification codes (SMS-bombing the moment a real SMS provider
// replaces today's on-screen preview), regardless of how many different IPs requested them.
export const otpSendLimiter = rateLimit({
  ...commonRateLimitOptions,
  windowMs: 10 * 60 * 1000,
  max: 4, // 4 codes per phone number per 10 minutes
  keyGenerator: otpPhoneKey,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many verification code requests for this number. Please wait a few minutes before requesting another code.',
      retryAfterSeconds: 600,
    });
  },
});

// 6. OTP Verify Limiter — coarse per-phone cap on verification attempts, independent of
// (and in addition to) the per-code attempt lockout enforced inside the route handler itself
// (see routes.ts's verify-otp — that one invalidates the specific pending code after 5 wrong
// guesses; this one stops someone from just requesting fresh codes to keep guessing past it).
export const otpVerifyLimiter = rateLimit({
  ...commonRateLimitOptions,
  windowMs: 10 * 60 * 1000,
  max: 15,
  keyGenerator: otpPhoneKey,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many verification attempts for this number. Please request a new code after a short wait.',
      retryAfterSeconds: 600,
    });
  },
});

// Per-user rate limiter for authenticated routes (admin/delivery)
// Keys by session token (user) instead of IP, so compromised tokens can't DoS other users
export function perUserRateLimit(max = 100, windowMs = 60_000) {
  return rateLimit({
    ...commonRateLimitOptions,
    windowMs,
    max,
    keyGenerator: (req: Request) => {
      // Use session token from header or query as user identifier
      const token = (req.headers['x-session-token'] as string) ||
                    (req.query['sessionToken'] as string) ||
                    (req.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '') ||
                    ipKeyGenerator(req.ip ?? '');
      return `user:${token}`;
    },
    message: {
      success: false,
      error: 'Too many requests from this account. Please try again shortly.',
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      });
    },
  });
}
