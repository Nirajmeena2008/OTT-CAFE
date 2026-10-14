/**
 * Google Maps JavaScript API loader + client-side reverse geocoding.
 *
 * Why client-side: our Maps key carries HTTP *referer* restrictions, which the
 * server-side Geocoding REST API rejects outright (REQUEST_DENIED). The Maps
 * JavaScript API is authenticated by the browser's Referer header instead, so
 * the same key works here. If anything fails (key missing, API disabled,
 * offline, blocked script...), every helper resolves to null and callers fall
 * back to the /api/maps/reverse-geocode proxy (which itself falls back to
 * OpenStreetMap).
 */

export interface ReverseGeocodeResult {
  formattedAddress: string;
  street?: string;
  sublocality?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  location?: { lat: number; lng: number };
  source: 'google' | 'osm' | 'coords';
}

// ---- Minimal typings for the parts of google.maps we use (no @types dep needed) ----
declare global {
  interface Window {
    google?: any;
    __ottGoogleMapsReady?: () => void;
  }
}

interface GmsAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GmsGeocodeResult {
  formatted_address: string;
  address_components: GmsAddressComponent[];
  geometry?: { location?: { lat: () => number; lng: () => number } };
}

interface GmsGeocoderResponse {
  status: string;
  results?: GmsGeocodeResult[];
}

const MAPS_JS_URL = 'https://maps.googleapis.com/maps/api/js';

// Fallback map center: the restaurant itself (Out of the Town, Kukas, NH-48, Jaipur).
export const RESTAURANT_LOCATION = { lat: 27.0955, lng: 75.0455 };

let mapsLoaderPromise: Promise<any> | null = null;

/**
 * Loads the Maps JavaScript API once per page. Resolves with the
 * `google.maps` namespace, or null when the key is absent or the script
 * fails to load (network block, InvalidKeyMapError, API not enabled, ...).
 */
export function loadGoogleMaps(): Promise<any | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  const already = (window as any).google?.maps;
  if (already?.Geocoder) return Promise.resolve((window as any).google.maps);

  if (mapsLoaderPromise) return mapsLoaderPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.resolve(null);

  mapsLoaderPromise = new Promise((resolve) => {
    const callbackName = '__ottGoogleMapsReady';
    (window as any)[callbackName] = () => {
      resolve((window as any).google?.maps ?? null);
    };

    const script = document.createElement('script');
    script.src = `${MAPS_JS_URL}?key=${encodeURIComponent(apiKey)}&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      mapsLoaderPromise = null; // allow a retry on a later interaction
      resolve(null);
    };
    document.head.appendChild(script);

    // Safety net: some failure modes (e.g. InvalidKeyMapError) call neither
    // callback nor onerror, so bail out rather than hang the caller forever.
    window.setTimeout(() => resolve((window as any).google?.maps ?? null), 12000);
  });

  return mapsLoaderPromise;
}

/**
 * Reverse geocodes coordinates with Google's Geocoder (browser-authenticated).
 * Resolves null on any failure so callers can fall back to the server proxy.
 */
export async function reverseGeocodeWithGoogle(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const maps = await loadGoogleMaps();
    if (!maps?.Geocoder) return null;

    const geocoder = new maps.Geocoder();
    const response: GmsGeocoderResponse = await new Promise((resolve, reject) => {
      geocoder.geocode(
        { location: { lat, lng } },
        (res: GmsGeocodeResult[] | { results?: GmsGeocodeResult[] } | null, status: string) => {
          // The JS API wraps the payload: newer versions pass { results, status },
          // classic ones pass (results[], status). Handle both shapes.
          if (status === 'OK') {
            const results = Array.isArray(res) ? res : res?.results || [];
            resolve({ status, results });
          } else {
            reject(new Error(status || 'GEOCODER_ERROR'));
          }
        }
      );
    });

    const top = response.results?.[0];
    if (!top) return null;

    const getComponent = (types: string[]): string | undefined => {
      const comp = (top.address_components || []).find((c) => types.some((t) => c.types.includes(t)));
      return comp ? comp.long_name : undefined;
    };

    const streetNumber = getComponent(['street_number']);
    const route = getComponent(['route']);
    const sublocality = getComponent(['sublocality_level_1', 'sublocality', 'neighborhood']);
    const city = getComponent(['locality', 'administrative_area_level_2']);
    const state = getComponent(['administrative_area_level_1']);
    const postalCode = getComponent(['postal_code']);

    return {
      formattedAddress: top.formatted_address,
      street: [streetNumber, route].filter(Boolean).join(' ') || undefined,
      sublocality,
      city: city || 'Jaipur',
      state: state || 'Rajasthan',
      postalCode,
      location: { lat, lng },
      source: 'google',
    };
  } catch {
    return null;
  }
}
