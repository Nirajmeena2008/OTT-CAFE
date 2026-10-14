import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, MoveHorizontal } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { loadGoogleMaps, RESTAURANT_LOCATION } from '../utils/googleMaps';

// Google's published night-mode style (Maps JS docs) so the pin map matches the site's dark theme.
const NIGHT_MODE_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#263c3f' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b9a76' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#746855' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2835' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3d19c' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515c6d' }],
  },
];

interface DeliveryLocationMapProps {
  /** Current pin coordinates (GPS fix or a previous manual pick). */
  coords: { lat: number; lng: number };
  /** Fired when the customer drags the pin / taps the map. Parent resolves the address. */
  onPinChange: (lat: number, lng: number) => void;
  /** GPS accuracy in metres from the last fix, if known. */
  accuracyMeters?: number | null;
  /** True while the parent is reverse-geocoding the moved pin. */
  isResolving?: boolean;
}

/**
 * Inline Google map with a draggable delivery pin for the checkout drawer.
 * GPS alone is often off by 20-50m (or on the wrong side of a service lane),
 * so this lets the customer drop the pin on their exact gate/door. Renders
 * nothing when the Maps JS API is unavailable - the address textarea keeps
 * working either way.
 */
export const DeliveryLocationMap: React.FC<DeliveryLocationMapProps> = ({
  coords,
  onPinChange,
  accuracyMeters,
  isResolving = false,
}) => {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const themeRef = useRef(isDark);
  const [mapFailed, setMapFailed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Create the map + marker once the Maps JS API is available.
  useEffect(() => {
    let cancelled = false;
    let marker: any = null;

    loadGoogleMaps().then((maps) => {
      if (cancelled) return;
      if (!maps || !containerRef.current) {
        setMapFailed(true);
        return;
      }

      const center = { lat: coords.lat, lng: coords.lng };
      const map = new maps.Map(containerRef.current, {
        center,
        zoom: 17,
        mapTypeId: 'roadmap',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: 'greedy',
        zoomControl: true,
        styles: themeRef.current ? NIGHT_MODE_STYLE : undefined,
      });

      marker = new maps.Marker({
        position: center,
        map,
        draggable: true,
        title: 'Delivery location',
      });

      const emitPin = () => {
        const pos = marker.getPosition();
        if (pos) onPinChange(pos.lat(), pos.lng());
      };

      marker.addListener('dragend', emitPin);
      map.addListener('click', (e: any) => {
        if (e.latLng) {
          marker.setPosition(e.latLng);
          emitPin();
        }
      });

      mapRef.current = map;
      markerRef.current = marker;
      setIsReady(true);
    });

    return () => {
      cancelled = true;
      if (marker) marker.setMap(null);
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the map+marker in sync when coords change externally (e.g. a fresh GPS fix),
  // without re-triggering onPinChange (which the parent echoes back for drag picks).
  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    const current = marker.getPosition();
    if (current && Math.abs(current.lat() - coords.lat) < 1e-7 && Math.abs(current.lng() - coords.lng) < 1e-7) {
      return;
    }
    marker.setPosition({ lat: coords.lat, lng: coords.lng });
    map.panTo({ lat: coords.lat, lng: coords.lng });
  }, [coords]);

  // Swap light/dark map styling when the site theme toggles.
  useEffect(() => {
    themeRef.current = isDark;
    if (mapRef.current) {
      mapRef.current.setOptions({ styles: isDark ? NIGHT_MODE_STYLE : undefined });
    }
  }, [isDark]);

  if (mapFailed) return null;

  return (
    <div className="relative rounded-xl overflow-hidden border border-amber-300/80 dark:border-amber-700/60 shadow-2xs">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-amber-50 dark:bg-stone-900/90 border-b border-amber-200/70 dark:border-stone-800">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-[11px] font-bold text-amber-900 dark:text-amber-100 truncate">
            Confirm your exact delivery point
          </span>
        </div>
        {typeof accuracyMeters === 'number' && !isNaN(accuracyMeters) && (
          <span
            className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase ${
              accuracyMeters <= 30
                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                : 'bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300'
            }`}
          >
            GPS ±{Math.round(accuracyMeters)}m
          </span>
        )}
      </div>

      {/* Map canvas */}
      <div className="relative h-44 w-full bg-stone-200 dark:bg-stone-800">
        <div ref={containerRef} className="absolute inset-0" aria-label="Delivery location map" role="application" />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-stone-100 dark:bg-stone-900/80 text-stone-500 dark:text-stone-400 text-xs font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading map…
          </div>
        )}
        {isResolving && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/95 dark:bg-stone-900/95 shadow-md text-[10px] font-semibold text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700">
            <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
            Updating address…
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50/70 dark:bg-stone-900/70 text-[10px] text-stone-500 dark:text-stone-400 border-t border-amber-200/70 dark:border-stone-800">
        <MoveHorizontal className="w-3.5 h-3.5 shrink-0 text-amber-600" />
        <span>
          GPS can miss your lane or gate. Drag the pin (or tap the map) to your exact doorstep, then check the address
          below. Fallback centre: Out of the Town, {RESTAURANT_LOCATION.lat.toFixed(4)}, {RESTAURANT_LOCATION.lng.toFixed(4)}.
        </span>
      </div>
    </div>
  );
};
