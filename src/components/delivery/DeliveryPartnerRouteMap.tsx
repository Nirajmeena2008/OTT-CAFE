import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  MapPin,
  Store,
  ExternalLink,
  Compass,
  Gauge,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  LocateFixed,
  Phone,
  MessageCircle,
} from 'lucide-react';
import type { Order, DeliveryTracking, DeliveryPartner } from '../../types';

interface DeliveryPartnerRouteMapProps {
  order: Order;
  partner?: DeliveryPartner;
  onUpdateLocation?: (lat: number, lng: number, speedKmh: number, label: string) => void;
  className?: string;
}

// Key Coordinates along the NH-48 Jaipur - Kukas corridor
const OTT_KITCHEN_COORDS = { lat: 27.0543, lng: 75.8988, name: 'OTT Restro & Bakery (Kukas)' };
const CORRIDOR_WAYPOINTS = [
  { lat: 27.0543, lng: 75.8988, label: 'OTT Restro Kitchen (SP 41 B, NH-48)' },
  { lat: 27.0421, lng: 75.8895, label: 'Arya College Flyover & Service Road' },
  { lat: 27.0254, lng: 75.8762, label: 'RIICO Industrial Area Kukas' },
  { lat: 27.0091, lng: 75.8645, label: 'Jaipur Toll Plaza' },
  { lat: 26.9855, lng: 75.8513, label: 'Customer Destination Gate' },
];

export const DeliveryPartnerRouteMap: React.FC<DeliveryPartnerRouteMapProps> = ({
  order,
  partner,
  onUpdateLocation,
  className = '',
}) => {
  // Destination coordinates from tracking or default
  const customerDest = {
    lat: order.deliveryTracking?.deliveryLocation?.lat || 26.9855,
    lng: order.deliveryTracking?.deliveryLocation?.lng || 75.8513,
    address: order.deliveryAddress || 'Customer Address, Jaipur',
  };

  // Live rider coordinates state (defaults to OTT or current partner position)
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number }>({
    lat: order.deliveryTracking?.partnerLocation?.lat || OTT_KITCHEN_COORDS.lat,
    lng: order.deliveryTracking?.partnerLocation?.lng || OTT_KITCHEN_COORDS.lng,
  });

  const [isUsingRealGps, setIsUsingRealGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [speedKmh, setSpeedKmh] = useState(38);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [audioMuted, setAudioMuted] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play subtle navigation beep
  const playNavChime = () => {
    if (audioMuted) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Calculate distance between two coordinates in km using Haversine formula
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  };

  // Distance from rider to customer
  const distanceRemainingKm = calculateDistanceKm(
    riderCoords.lat,
    riderCoords.lng,
    customerDest.lat,
    customerDest.lng
  );

  // ETA in minutes at current average speed (approx 35-40 km/h in transit)
  const etaMinutes = Math.max(1, Math.round((distanceRemainingKm / Math.max(speedKmh, 20)) * 60));

  // Device Geolocation Handler
  const toggleDeviceGps = () => {
    if (isUsingRealGps) {
      setIsUsingRealGps(false);
      setGpsError(null);
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('GPS geolocation not supported by this browser.');
      return;
    }

    setIsUsingRealGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setRiderCoords(newCoords);
        if (pos.coords.speed !== null && !isNaN(pos.coords.speed)) {
          setSpeedKmh(Math.round(pos.coords.speed * 3.6));
        }
        onUpdateLocation?.(
          newCoords.lat,
          newCoords.lng,
          speedKmh,
          'Live Device GPS Coordinates'
        );
      },
      (err) => {
        setGpsError(`GPS error: ${err.message}. Using simulated NH-48 GPS.`);
        setIsUsingRealGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Simulated GPS Movement along corridor
  useEffect(() => {
    if (!isSimulating) return;

    const timer = setInterval(() => {
      setSimStep((prev) => {
        const next = (prev + 1) % CORRIDOR_WAYPOINTS.length;
        const pt = CORRIDOR_WAYPOINTS[next];
        setRiderCoords({ lat: pt.lat, lng: pt.lng });
        const randomSpeed = Math.floor(32 + Math.random() * 18);
        setSpeedKmh(randomSpeed);
        playNavChime();
        onUpdateLocation?.(pt.lat, pt.lng, randomSpeed, pt.label);
        return next;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [isSimulating]);

  // Google Maps Driving Directions Link
  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${riderCoords.lat},${riderCoords.lng}&destination=${encodeURIComponent(
    order.deliveryAddress ? `${order.deliveryAddress}, Kukas, Jaipur` : `${customerDest.lat},${customerDest.lng}`
  )}&travelmode=driving`;

  // Determine stage & progress along route (0 to 100%)
  const maxDistance = 8.5;
  const progressRatio = Math.max(0, Math.min(100, Math.round(((maxDistance - distanceRemainingKm) / maxDistance) * 100)));

  return (
    <div className={`rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-white overflow-hidden shadow-xl ${className}`}>
      {/* Top Map Action Bar */}
      <div className="p-3 sm:p-4 bg-stone-50 dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Compass className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Rider Route &amp; GPS Guidance
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 font-mono">
                NH-48 Jaipur
              </span>
            </div>
            <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
              <span>
                {partner && partner.id !== 'unassigned' && partner.name
                  ? `${partner.name} (${(partner.vehicleType || 'bike').toUpperCase()} • ${partner.vehicleNumber || 'Assigned'})`
                  : 'Awaiting Assigned Rider (OTT Kitchen Dispatch)'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Device GPS Toggle */}
          <button
            type="button"
            onClick={toggleDeviceGps}
            title={isUsingRealGps ? 'Using Phone GPS' : 'Click to acquire Real Device GPS'}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isUsingRealGps
                ? 'bg-emerald-600 text-white shadow-emerald-600/30 shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700'
            }`}
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{isUsingRealGps ? 'Phone GPS Active' : 'Use Device GPS'}</span>
          </button>

          {/* Simulation Toggle */}
          <button
            type="button"
            onClick={() => setIsSimulating(!isSimulating)}
            title="Simulate rider movement along NH-48 corridor"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isSimulating
                ? 'bg-amber-500 text-stone-950 animate-pulse font-bold'
                : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700'
            }`}
          >
            {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden xs:inline">{isSimulating ? 'Simulating' : 'Simulate Ride'}</span>
          </button>

          {/* Audio Chime Mute/Unmute */}
          <button
            type="button"
            onClick={() => setAudioMuted(!audioMuted)}
            className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 transition-colors"
            title={audioMuted ? 'Unmute Navigation Audio' : 'Mute Navigation Audio'}
          >
            {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
          </button>

          {/* External Google Maps Button */}
          <a
            id="rider-open-google-maps-btn"
            href={googleMapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-102 active:scale-95"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Turn-by-Turn in Google Maps</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>
        </div>
      </div>

      {gpsError && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2 border-b border-amber-200 dark:border-amber-900/60">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* METRIC RIBBON: Distance, ETA, Speedometer & Next Turn */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-stone-50/90 dark:bg-stone-900/90 border-b border-stone-200 dark:border-stone-800 text-xs">
        {/* Remaining Distance */}
        <div className="p-2.5 rounded-xl bg-white dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800/80 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-rose-500 dark:text-rose-400" />
            <span>Distance to Doorstep</span>
          </div>
          <div className="mt-1 font-mono font-black text-lg text-stone-900 dark:text-white flex items-baseline gap-1">
            <span>{distanceRemainingKm}</span>
            <span className="text-xs font-normal text-stone-500 dark:text-stone-400">km</span>
          </div>
        </div>

        {/* Estimated Time of Arrival */}
        <div className="p-2.5 rounded-xl bg-white dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800/80 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <Navigation className="w-3 h-3 text-amber-500 dark:text-amber-400" />
            <span>Estimated Travel</span>
          </div>
          <div className="mt-1 font-mono font-black text-lg text-amber-600 dark:text-amber-400 flex items-baseline gap-1">
            <span>~{etaMinutes}</span>
            <span className="text-xs font-normal text-stone-500 dark:text-stone-400">mins</span>
          </div>
        </div>

        {/* Speedometer */}
        <div className="p-2.5 rounded-xl bg-white dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800/80 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
            <span>Current Speed</span>
          </div>
          <div className="mt-1 font-mono font-black text-lg text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1">
            <span>{speedKmh}</span>
            <span className="text-xs font-normal text-stone-500 dark:text-stone-400">km/h</span>
          </div>
        </div>

        {/* Live Traffic / Route Status */}
        <div className="p-2.5 rounded-xl bg-white dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800/80 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400">Route Traffic</div>
          <div className="mt-1 font-bold text-xs text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
            <span>NH-48 Smooth Flow</span>
          </div>
        </div>
      </div>

      {/* INTERACTIVE VECTOR ROUTE MAP CANVAS */}
      <div className="relative h-64 sm:h-72 w-full bg-stone-950 overflow-hidden select-none">
        {/* Subtle Map Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)] bg-[size:32px_32px] opacity-20 pointer-events-none" />

        {/* Simulated Topography & Road Shapes */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 600 240"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="60%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Secondary Arterial Roads (Jaipur / Amer rural bypasses) */}
          <path
            d="M 20,40 Q 150,90 280,70 T 560,110"
            fill="none"
            stroke="#334155"
            strokeWidth="2.5"
            strokeOpacity="0.4"
          />
          <path
            d="M 120,220 Q 250,160 400,190 T 580,180"
            fill="none"
            stroke="#334155"
            strokeWidth="2.5"
            strokeOpacity="0.4"
          />

          {/* MAIN ROUTE (NH-48 Corridor Track) */}
          <path
            d="M 50,130 C 180,60 320,190 540,110"
            fill="none"
            stroke="#1e293b"
            strokeWidth="18"
            strokeLinecap="round"
          />
          <path
            d="M 50,130 C 180,60 320,190 540,110"
            fill="none"
            stroke="#475569"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Dashed Road Divider */}
          <path
            d="M 50,130 C 180,60 320,190 540,110"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="6,8"
          />

          {/* ACTIVE ROUTE HIGHLIGHT (Rider to Customer) */}
          <path
            d="M 50,130 C 180,60 320,190 540,110"
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#glow)"
            strokeDasharray="1000"
            strokeDashoffset={1000 - (progressRatio * 10)}
            className="transition-all duration-700"
          />
        </svg>

        {/* RESTAURANT PICKUP PIN (Kukas Kitchen) */}
        <div className="absolute left-[6%] top-[45%] -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group cursor-pointer">
          <div className="px-2 py-0.5 rounded-md bg-amber-500 text-stone-950 font-black text-[9px] shadow-md uppercase tracking-wider mb-1 flex items-center gap-1 whitespace-nowrap">
            <Store className="w-2.5 h-2.5" />
            <span>OTT Kitchen</span>
          </div>
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shadow-lg">
              <Store className="w-4 h-4" />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          </div>
          <span className="text-[9px] font-mono text-stone-400 mt-0.5">Kukas NH-48</span>
        </div>

        {/* MID-ROUTE MILESTONE: RIICO & Arya Flyover */}
        <div className="absolute left-[38%] top-[25%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
          <div className="w-3.5 h-3.5 rounded-full bg-stone-700 border border-stone-500 flex items-center justify-center text-[8px] font-bold text-stone-300">
            •
          </div>
          <span className="text-[8px] font-medium text-stone-400 whitespace-nowrap mt-0.5">
            RIICO / Arya Bypass
          </span>
        </div>

        {/* MID-ROUTE MILESTONE: Toll Corridor */}
        <div className="absolute left-[65%] top-[72%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
          <div className="w-3.5 h-3.5 rounded-full bg-stone-700 border border-stone-500 flex items-center justify-center text-[8px] font-bold text-stone-300">
            •
          </div>
          <span className="text-[8px] font-medium text-stone-400 whitespace-nowrap mt-0.5">
            Toll Post
          </span>
        </div>

        {/* CUSTOMER DESTINATION PIN */}
        <div className="absolute right-[6%] top-[38%] translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group">
          <div className="px-2 py-0.5 rounded-md bg-emerald-500 text-white font-black text-[9px] shadow-md uppercase tracking-wider mb-1 flex items-center gap-1 whitespace-nowrap">
            <MapPin className="w-2.5 h-2.5" />
            <span>Customer Gate</span>
          </div>
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg animate-bounce">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[9px] font-bold text-stone-200 mt-0.5 max-w-[110px] truncate text-center">
            {order.customerName}
          </span>
        </div>

        {/* LIVE MOVING RIDER BIKE ICON */}
        <div
          className="absolute z-30 transition-all duration-700 ease-out flex flex-col items-center pointer-events-none"
          style={{
            left: `${Math.min(88, Math.max(12, 10 + progressRatio * 0.78))}%`,
            top: `${Math.sin((progressRatio / 100) * Math.PI) * 28 + 44}%`,
          }}
        >
          {/* Rider Label Tooltip */}
          <div className="px-2 py-0.5 rounded-md bg-purple-600 text-white text-[9px] font-extrabold shadow-md flex items-center gap-1 whitespace-nowrap mb-1">
            <span>{partner ? `${partner.name.split(' ')[0]} (Rider)` : 'OTT Dispatch'}</span>
            <span className="font-mono text-[8px] opacity-80">{speedKmh} km/h</span>
          </div>
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-purple-500 border-2 border-white text-white flex items-center justify-center shadow-xl shadow-purple-500/50">
              <Navigation className="w-5 h-5 transform rotate-45" />
            </div>
            <span className="absolute -inset-1 rounded-full border border-purple-400 animate-ping opacity-60 pointer-events-none" />
          </div>
        </div>

        {/* Bottom Coordinates Overlay */}
        <div className="absolute bottom-2 left-3 z-20 flex items-center gap-2 bg-stone-950/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-stone-800 text-[10px] font-mono text-stone-400">
          <LocateFixed className="w-3 h-3 text-amber-400" />
          <span>Lat: {riderCoords.lat.toFixed(4)}, Lng: {riderCoords.lng.toFixed(4)}</span>
        </div>

        <div className="absolute bottom-2 right-3 z-20 bg-stone-950/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-stone-800 text-[10px] text-stone-400 flex items-center gap-1">
          <span>NH-48 Jaipur Route</span>
        </div>
      </div>

      {/* TURN-BY-TURN STEP GUIDANCE CARD */}
      <div className="p-3 sm:p-4 bg-stone-50 dark:bg-stone-950 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-md">
            <Navigation className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">
              Next Navigation Step
            </div>
            <p className="font-bold text-sm text-stone-900 dark:text-stone-100 truncate">
              {progressRatio < 25
                ? 'Depart Out of the Town (OTT) onto NH-48 towards Jaipur Bypass'
                : progressRatio < 60
                ? 'Continue past Arya College & RIICO Industrial Junction'
                : progressRatio < 90
                ? 'Take the left service lane towards customer residential gate'
                : `Arrive at Customer Doorstep: ${order.deliveryAddress || 'Destination'}`}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
              Destination: {order.deliveryAddress || 'Kukas, Jaipur'} • Customer: {order.customerName} ({order.customerPhone})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`tel:${order.customerPhone}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/40 font-bold text-xs transition-all"
            title="Call Customer"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call Customer</span>
          </a>
          <a
            href={`https://wa.me/91${order.customerPhone.replace(/[^0-9]/g, '').slice(-10)}?text=Hello%20${encodeURIComponent(order.customerName)},%20${partner ? `I%20am%20your%20OTT%20delivery%20partner%20${encodeURIComponent(partner.name)}.` : 'This%20is%20from%20OTT%20delivery%20dispatch.'}%20I%20am%20on%20the%20way%20with%20your%20order%20%23${order.id}.`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all"
            title="WhatsApp Customer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};
