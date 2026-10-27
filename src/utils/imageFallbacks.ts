// Resilient image fallback handlers & offline SVG data URIs
// Ensures promotional banners, dishes, categories, and ambiance photos NEVER disappear.

export const SVG_FOOD_FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2a1b18" />
          <stop offset="50%" stop-color="#1f1614" />
          <stop offset="100%" stop-color="#140f0e" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <circle cx="400" cy="300" r="260" fill="url(#glow)" />
      
      <!-- Gourmet Cloche Platter Illustration -->
      <g transform="translate(400, 300) scale(1.6)" text-anchor="middle" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M-40,25 L40,25" stroke="#fbbf24" stroke-width="3" />
        <path d="M-36,20 C-36,-15 36,-15 36,20 Z" fill="#78350f" fill-opacity="0.3" stroke="#f59e0b" stroke-width="2.5" />
        <circle cx="0" cy="-18" r="4" fill="#fbbf24" />
        <path d="M-12,-28 Q-6,-34 0,-28 Q6,-34 12,-28" stroke="#f59e0b" stroke-opacity="0.6" stroke-width="1.5" />
      </g>
      
      <text x="400" y="410" font-family="serif" font-size="28" font-weight="bold" fill="#fef3c7" text-anchor="middle" letter-spacing="1">
        Out of the Town
      </text>
      <text x="400" y="440" font-family="sans-serif" font-size="14" font-weight="600" fill="#f59e0b" text-anchor="middle" letter-spacing="3">
        GOURMET RESTRO &amp; BAKERY
      </text>
    </svg>
  `.trim());

export const SVG_BANNER_FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600">
      <defs>
        <linearGradient id="bannerBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b1d11" />
          <stop offset="50%" stop-color="#24120b" />
          <stop offset="100%" stop-color="#130804" />
        </linearGradient>
        <radialGradient id="bannerGlow" cx="65%" cy="50%" r="55%">
          <stop offset="0%" stop-color="#ec4899" stop-opacity="0.3" />
          <stop offset="50%" stop-color="#f59e0b" stop-opacity="0.25" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bannerBg)" />
      <rect width="100%" height="100%" fill="url(#bannerGlow)" />
      
      <!-- Architectural Neon Arches Motif (Signature OTT feature) -->
      <g stroke="#f59e0b" stroke-opacity="0.35" fill="none" stroke-width="2">
        <path d="M 500,600 C 500,220 700,220 700,600" />
        <path d="M 530,600 C 530,260 670,260 670,600" stroke="#ec4899" stroke-opacity="0.25" />
      </g>
      
      <g transform="translate(600, 320) scale(2.2)" text-anchor="middle" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round">
        <path d="M-30,20 L30,20" stroke-width="3" />
        <path d="M-26,16 C-26,-12 26,-12 26,16 Z" fill="#78350f" fill-opacity="0.4" />
        <circle cx="0" cy="-14" r="3.5" fill="#f59e0b" />
      </g>
      
      <text x="600" y="440" font-family="serif" font-size="36" font-weight="bold" fill="#fffbeb" text-anchor="middle" letter-spacing="1.5">
        Out of the Town Special
      </text>
      <text x="600" y="480" font-family="sans-serif" font-size="16" font-weight="bold" fill="#f59e0b" text-anchor="middle" letter-spacing="4">
        SIGNATURE CHEF SELECTION • KUKAS JAIPUR
      </text>
    </svg>
  `.trim());

export const FALLBACK_FOOD_IMAGE = SVG_FOOD_FALLBACK;
export const FALLBACK_BANNER_IMAGE = SVG_BANNER_FALLBACK;

/**
 * Universal safe image onError handler
 * Prevents broken image icons and infinite error loops
 */
export function handleImageFallback(
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackUrl: string = FALLBACK_FOOD_IMAGE
) {
  const img = event.currentTarget;
  if (!img) return;

  // Prevent infinite loop if fallback also fails
  if (img.dataset.hasFailedFallback === 'true') {
    img.src = SVG_FOOD_FALLBACK;
    return;
  }

  img.dataset.hasFailedFallback = 'true';
  img.src = fallbackUrl;
}
