import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { apiRouter } from './routes';
import { generalApiLimiter, secondRateLimiter, staffApiLimiter, perUserRateLimit } from './middleware/rateLimiter';
import { sanitizeInputs } from './middleware/sanitize';

/**
 * Express application instance configured for both:
 * 1. Traditional Node.js runtime / Cloud Run container (via server.ts)
 * 2. Vercel Serverless Function deployment (via api/index.ts)
 */
const app = express();

// Trust exactly one reverse-proxy hop (Vercel/Cloud Run/nginx) so Express reads the real
// client IP from the proxy's own header, not an arbitrary value injected earlier in the chain.
app.set('trust proxy', 1);

// Framework fingerprinting -- costs nothing to remove.
app.disable('x-powered-by');

// CORS origin allowlist -- replaces a blanket "Access-Control-Allow-Origin: *" that used to
// apply even to /api/admin and /api/delivery. localhost covers local dev; *.vercel.app covers
// every preview/production URL Vercel generates (a new, unpredictable subdomain per deploy,
// so this can't be a fixed string); ALLOWED_ORIGIN lets a real custom domain be added via env
// the moment one exists, with no further code change.
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost:\d+$/,
  /^https?:\/\/127\.0\.0\.1:\d+$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
];
// Comma-separated list allowed. The www. variant of each origin is allowed automatically --
// www.ottcafe.in serves the same site, and was blocked when only https://ottcafe.in was listed.
for (const raw of (process.env.ALLOWED_ORIGIN || '').split(',')) {
  const origin = raw.trim().replace(/\/+$/, '');
  if (!origin) continue;
  const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withOptionalWww = escaped.replace(/^(https?:\/\/)(www\\\.)?/, '$1(www\\.)?');
  ALLOWED_ORIGIN_PATTERNS.push(new RegExp(`^${withOptionalWww}$`));
}
function isAllowedOrigin(origin: string | undefined): origin is string {
  return !!origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

// Standard CORS & security headers for multi-environment deployments
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  // Must list every custom header the frontend sends: now that the site (ottcafe.in) and API
  // (api.ottcafe.in) are separate origins, the browser preflights each request and silently
  // blocks any whose headers aren't allowed here -- X-Customer-Token missing from this list
  // broke every signed-in customer request (reservations, orders, profile).
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, X-Customer-Token, X-Restaurant-Id'
  );

  // Baseline security headers, applied to every response (not just /api).
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  // CSP is production-only: Vite's dev-mode HMR relies on inline/eval'd module transforms
  // that a strict policy would break, and there is no security benefit to protecting a local
  // dev server that isn't reachable from the internet in the first place.
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        // Menu/gallery imagery is served from Unsplash and similar hosts, not self-hosted.
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self'",
        "connect-src 'self'",
        // The location section embeds a Google Maps iframe.
        "frame-src https://www.google.com https://maps.google.com",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; ')
    );
  }

  // Handle browser preflight requests immediately
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Small, fixed-shape auth/OTP payloads never legitimately need anywhere near the 10MB
// allowance below (that exists for base64 invoices/receipts elsewhere) -- capping these
// specific routes at 10KB means a flood of oversized bodies aimed at them gets rejected by
// the parser itself instead of costing real memory/CPU to buffer and parse. Registered before
// the general parser below: body-parser marks the request as already-parsed once it succeeds,
// so the wider 10mb instance just passes through for these paths rather than re-parsing.
const SMALL_PAYLOAD_AUTH_ROUTES = [
  '/api/auth/customer/send-otp',
  '/api/auth/customer/verify-otp',
  '/api/delivery/send-otp',
  '/api/delivery/verify-otp',
  '/api/admin/login',
];
app.use(SMALL_PAYLOAD_AUTH_ROUTES, express.json({ limit: '10kb' }));

// Parsers (allowing larger payload for base64 invoices/receipts)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Anti-XSS and input sanitization
app.use(sanitizeInputs);

// Limit user requests to 10 per second at most to prevent bombing attacks and server overload
app.use('/api', secondRateLimiter);

// Authenticated dashboard/rider polling gets its own, much higher budget than public traffic.
app.use(['/api/admin', '/api/delivery'], staffApiLimiter);

// Per-user rate limits on authenticated routes (prevents compromised token DoS)
app.use('/api/admin', perUserRateLimit(100, 60_000));
app.use('/api/delivery', perUserRateLimit(60, 60_000));

// General rate limiter on public API routes to protect against DDoS
app.use('/api', generalApiLimiter);

// API health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    cafe: 'Out of the Town - Restro and Bakery',
    platform: process.env.VERCEL ? 'vercel-serverless' : 'node-container',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    cafe: 'Out of the Town - Restro and Bakery',
    platform: process.env.VERCEL ? 'vercel-serverless' : 'node-container',
    timestamp: new Date().toISOString(),
  });
});

// Primary API Router mounted at /api
app.use('/api', apiRouter);

// Fallback routing for Vercel Serverless rewrites where the /api prefix may be stripped.
// Only engage this on Vercel itself: apiRouter now ends in its own catch-all 404 (see
// routes.ts), so unconditionally re-routing every non-/api request through it here — as this
// used to do — swallowed the entire website (every real page request, starting with '/'
// itself) into that 404 before it ever reached the SPA. Gating on process.env.VERCEL keeps
// the intended rewrite-compatibility behavior on Vercel without breaking the Node/container
// deployment, where no prefix-stripping ever happens.
if (process.env.VERCEL) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api')) {
      return (apiRouter as any)(req, res, next);
    }
    next();
  });
}

// Global Error Handler for API consistency
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error occurred',
  });
});

export { app };
export default app;
