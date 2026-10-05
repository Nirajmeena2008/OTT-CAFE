import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  Search,
  Mic,
  MicOff,
  Sparkles,
  ShoppingBag,
  CalendarCheck,
  Shield,
  Sun,
  Moon,
  X,
  Tag,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Info,
  UtensilsCrossed,
  Flame,
  MapPin,
  LogOut,
  LogIn,
  Cake,
  User,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { PromoBanner, MenuItem } from '../types';

interface TopPromotionalHeroProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  vegOnly: boolean;
  onToggleVegOnly: () => void;
  onOpenReservation: () => void;
  onOpenProfileMenu?: () => void;
  onOpenCustomCake?: () => void;
  banners: PromoBanner[];
  onSelectBanner: (banner: PromoBanner) => void;
  onSelectCategory?: (category: string) => void;
  showOverlayHeader?: boolean;
  /** Live search matches shown in a dropdown right under the hero search bar, matched
   * against the full menu regardless of category/filter state -- see App.tsx. */
  searchResults?: MenuItem[];
  totalSearchMatches?: number;
  onSelectSearchResult?: (item: MenuItem) => void;
  /** True once the page has scrolled far enough for App.tsx to mount the sticky Navbar
   * on top -- this hero stays mounted underneath it (it's only unmounted when viewing
   * an offer banner), so its own search dropdown/focus state must be force-closed here.
   * Otherwise both search bars share the same searchQuery while each keeps its own
   * independent open/focused state, and the hero's stale dropdown can keep "open" behind
   * the sticky header, fighting with the new one as you keep typing or deleting. */
  isScrolled?: boolean;
}

export const TopPromotionalHero: React.FC<TopPromotionalHeroProps> = ({
  searchQuery,
  onSearchChange,
  vegOnly,
  onToggleVegOnly,
  onOpenReservation,
  onOpenProfileMenu,
  onOpenCustomCake,
  banners,
  onSelectBanner,
  showOverlayHeader = true,
  searchResults = [],
  totalSearchMatches = 0,
  onSelectSearchResult,
  isScrolled = false,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { totalItemsCount, total, setIsCartOpen, applyPromo, appliedPromo } = useCart();
  const { customer, isAuthenticated, logout, openAuthModal } = useAuth();

  // Unified Promotional Carousel Slide index (Slides 0..N: Promotional Combos)
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const totalSlides = banners?.length || 0;

  // Real-time customer location (replaces the static restaurant-address pill) --
  // resolved silently on mount via browser geolocation + reverse geocoding, with
  // graceful fallbacks so a denied/unsupported/slow request never blocks the hero.
  const [customerLocationLabel, setCustomerLocationLabel] = useState<string | null>(null);
  const [customerLocationState, setCustomerLocationState] = useState<
    'idle' | 'loading' | 'success' | 'denied' | 'error'
  >('idle');

  const detectCustomerLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setCustomerLocationState('error');
      return;
    }
    setCustomerLocationState('loading');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await api.reverseGeocodeLocation(latitude, longitude);
          const label = res.sublocality
            ? `${res.sublocality}, ${res.city || ''}`.replace(/, $/, '')
            : res.city || res.formattedAddress;
          setCustomerLocationLabel(label || res.formattedAddress);
          setCustomerLocationState('success');
        } catch {
          setCustomerLocationState('error');
        }
      },
      (error) => {
        setCustomerLocationState(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  useEffect(() => {
    detectCustomerLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Touch gesture tracking for mobile swipe
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);

  // Auto-rotate promotional carousel sliding right at fixed 4.5s interval like Zomato
  useEffect(() => {
    if (isPaused || totalSlides <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused, totalSlides]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (touchStartXRef.current !== null) {
      if (touchDeltaXRef.current < -35) {
        // Swiped left -> slide right (next slide)
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
      } else if (touchDeltaXRef.current > 35) {
        // Swiped right -> slide left (previous slide)
        setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
      }
    }
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
  };

  // Modals & Popovers
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [copiedCouponToast, setCopiedCouponToast] = useState<string | null>(null);

  // Dynamic header height to ensure promotional banner text starts just a line below the search bar without overlap
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(140);

  useEffect(() => {
    if (!headerRef.current) return;
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };
    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(headerRef.current);
    window.addEventListener('resize', updateHeaderHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  // Voice Search / Mic state
  const [isListening, setIsListening] = useState(false);

  // Live search results dropdown -- mirrors the sticky Navbar's dropdown so suggestions
  // show up immediately while typing here too, not only after scrolling far enough to
  // trigger the sticky header. Also drives the "enlarge on tap" focused state below.
  const [isSearchResultsOpen, setIsSearchResultsOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // The dropdown is portalled outside searchWrapRef, so it must count as "inside" too --
      // otherwise mousedown on a result closes the dropdown before its click can register.
      if (searchWrapRef.current?.contains(target) || searchDropdownRef.current?.contains(target)) return;
      setIsSearchResultsOpen(false);
      setIsSearchFocused(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The hero (and its carousel wrapper) are overflow-hidden, which clipped this dropdown at
  // the banner's bottom edge. It's portalled to <body> and pinned to the search bar instead.
  const dropdownOpen = isSearchResultsOpen && searchQuery.trim().length > 0;
  useEffect(() => {
    if (!dropdownOpen) return;
    const measure = () => {
      const r = searchWrapRef.current?.getBoundingClientRect();
      if (r) setDropdownPos({ top: r.bottom + 8, left: r.left, width: r.width });
    };
    measure();
    // The search card animates its padding on focus, so track its size, not just the window.
    const ro = new ResizeObserver(measure);
    if (searchWrapRef.current) ro.observe(searchWrapRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [dropdownOpen]);

  // Force-close this search bar's own dropdown/focus state once the sticky Navbar takes
  // over (see the isScrolled prop doc above) -- this hero never unmounts on scroll, so
  // without this its dropdown could stay "open" behind the sticky header indefinitely.
  useEffect(() => {
    if (isScrolled) {
      setIsSearchResultsOpen(false);
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
    }
  }, [isScrolled]);

  // Rotating placeholder keywords featuring Out of the Town specialty dishes
  const placeholders = [
    'Search "OTT Royal Thali"',
    'Search "Artisan Blueberry Cheesecake"',
    'Search "Crispy Kurkure Momos"',
    'Search "Farmhouse Stone-Baked Pizza"',
    'Search "Dal Makhani & Garlic Naan"',
    'Search "Nutella Hazelnut Freakshake"',
    'Search "Sizzling Walnut Brownie"',
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Rotate search placeholder every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [placeholders.length]);

  // Handle Speech Recognition for Microphone button
  const handleMicClick = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback if browser doesn't support Web Speech API
      setIsListening(true);
      setTimeout(() => {
        onSearchChange('paratha');
        setIsListening(false);
      }, 1500);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onSearchChange(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleApplyCoupon = (code: string, label: string) => {
    const res = applyPromo(code);
    setCopiedCouponToast(res.message || `🎉 ${label} applied successfully!`);
    setTimeout(() => {
      setCopiedCouponToast(null);
    }, 3500);
  };

  return (
    <div
      className="relative w-full overflow-hidden select-none bg-cream dark:bg-stone-950"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 
        ========================================================================
        FULL-BLEED PROMOTIONAL BANNER CAROUSEL EXTENDING TO THE BOTTOM
        The background image extends to the bottom and slowly fades with white background
        ========================================================================
      */}
      <div
        className={`relative w-full ${
          showOverlayHeader
            ? 'min-h-[275px] xs:min-h-[290px] sm:min-h-[310px] md:min-h-[335px]'
            : 'min-h-[210px] xs:min-h-[230px] sm:min-h-[260px] md:min-h-[290px]'
        } flex flex-col justify-between overflow-hidden`}
      >
        {/* Sliding Track for promotional banners and deals */}
        {(() => {
          const safeSlide = totalSlides > 0 ? (currentSlide >= totalSlides ? 0 : currentSlide) : 0;
          return (
            <div
              className="absolute inset-0 flex w-full h-full transition-transform duration-500 ease-out z-0"
              style={{
                transform: `translateX(-${safeSlide * 100}%)`,
              }}
            >
              {/* PROMOTIONAL COMBOS & DEALS EXTENDING FULL BLEED TO THE TOP AND BOTTOM */}
              {banners.map((combo) => (
                <div
                  key={combo.id}
                  id={`hero-combo-${combo.id}`}
                  onClick={() => onSelectBanner(combo)}
                  className={`w-full h-full shrink-0 relative cursor-pointer overflow-hidden flex flex-col ${
                    showOverlayHeader ? 'justify-start' : 'justify-end'
                  } pb-5 sm:pb-7 px-4 sm:px-10 md:px-16 bg-cream dark:bg-stone-950 group`}
                  style={{ paddingTop: showOverlayHeader ? `${headerHeight + 28}px` : '16px' }}
                >
                  {/* Full-bleed food promotional banner image extending fully to bottom */}
                  <img
                    src={combo.imageUrl}
                    alt={combo.title}
                    className="absolute inset-0 w-full h-full object-cover object-center brightness-[0.82] group-hover:scale-105 transition-transform duration-700"
                  />

                  {/* Top scrim: keeps header, logo, search bar & combo title text high-contrast and readable */}
              <div className="absolute inset-x-0 top-0 h-44 sm:h-56 bg-gradient-to-b from-black/75 via-black/40 to-transparent pointer-events-none" />

              {/* Bottom slow fade: starts 1 line lower, extending smoothly to the bottom white background */}
              <div className="absolute inset-x-0 bottom-0 h-24 sm:h-32 bg-gradient-to-b from-transparent via-cream/20 via-40% via-cream/60 via-68% via-cream/92 via-88% to-cream dark:via-stone-950/20 dark:via-stone-950/60 dark:via-stone-950/92 dark:to-stone-950 pointer-events-none" />

              {/* Lower combo details — extra horizontal inset on mobile only, so the title/subtitle
                  text never renders underneath the prev/next chevron buttons (which sit at
                  left-1.5/right-1.5 with a 28px width, i.e. reach ~34px in from each edge) */}
              <div className="relative z-20 max-w-2xl text-white px-5 sm:px-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 text-[9.5px] sm:text-[10.5px] font-bold uppercase px-2.5 py-0.5 rounded-full text-white shadow-xs ${combo.badgeBgColor}`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {combo.highlightBadge}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9.5px] sm:text-[10.5px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 font-extrabold shadow-xs">
                    <Tag className="w-3 h-3" />
                    {combo.discountText}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold tracking-tight text-white mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {combo.title}
                </h2>
                <p className="text-xs sm:text-sm text-stone-100/95 font-medium line-clamp-2 max-w-xl drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] leading-relaxed">
                  {combo.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
          );
        })()}

        {/* 
          =============================================================
          OVERLAPPING OPTIONS ON TOP OF THE PROMOTIONAL BANNER
          - Top Bar (Location, Book Table, Wallet, Theme, Cart, Profile)
          - Search Bar + Veg Mode Toggle
          =============================================================
        */}
        {showOverlayHeader && (
          <div
            ref={headerRef}
            className="relative z-20 w-full max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 pt-2.5 sm:pt-4 pointer-events-auto"
          >
            {/* ROW 1: TOP BAR OVERLAPPING BANNER */}
            <div className="w-full flex items-center justify-between gap-1 sm:gap-4 mb-3 sm:mb-4">
              {/* Cafe Name with Circular Logo (Matching User Provided Logo Image) */}
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <img
                  src="/ott-logo.svg"
                  alt="Out of the Town OTT Logo"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full drop-shadow-md shrink-0 border border-white/40 object-contain hover:scale-105 transition-transform"
                />
                <div className="leading-tight min-w-0">
                  <span className="font-serif font-extrabold text-sm sm:text-base text-white tracking-tight truncate block drop-shadow-xs">
                    Out of the Town
                  </span>
                  <span className="text-[10px] sm:text-xs text-amber-300 font-semibold tracking-wide truncate block drop-shadow-xs">
                    Restro &amp; Bakery
                  </span>
                </div>
              </div>

              {/* Right Action Icons Overlapping Banner */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Customer's Real-Time Location (replaces the static restaurant-address pill) --
                    detected on load via geolocation + reverse geocoding; click retries detection
                    when denied/failed, or refreshes it once resolved. */}
                <button
                  id="hero-customer-location-btn"
                  onClick={detectCustomerLocation}
                  disabled={customerLocationState === 'loading'}
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-black/40 hover:bg-black/60 text-white font-medium text-xs rounded-full backdrop-blur-md border border-white/30 shadow-md transition-all hover:scale-105 cursor-pointer shrink-0 text-left group disabled:opacity-80 disabled:cursor-wait"
                  title={
                    customerLocationState === 'success' && customerLocationLabel
                      ? `Delivering to your current location: ${customerLocationLabel} • Click to refresh`
                      : customerLocationState === 'denied'
                        ? 'Location access denied • Click to try again'
                        : 'Detecting your current location…'
                  }
                >
                  <div className="relative shrink-0 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 fill-rose-400 group-hover:scale-110 transition-transform" />
                    {customerLocationState === 'success' && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col leading-tight whitespace-nowrap max-w-[110px] sm:max-w-[160px]">
                    {customerLocationState === 'loading' && (
                      <span className="text-[10px] sm:text-xs font-bold text-white animate-pulse">
                        Locating you…
                      </span>
                    )}
                    {customerLocationState === 'success' && (
                      <span className="text-[10px] sm:text-xs font-bold text-white truncate">
                        {customerLocationLabel}
                      </span>
                    )}
                    {(customerLocationState === 'denied' || customerLocationState === 'error') && (
                      <>
                        <span className="text-[10px] sm:text-xs font-bold text-white">
                          Set Location
                        </span>
                        <span className="text-[8px] sm:text-[9px] font-semibold text-amber-300 hidden xs:inline">
                          {customerLocationState === 'denied' ? 'Access denied • Tap to retry' : 'Tap to detect'}
                        </span>
                      </>
                    )}
                    {customerLocationState === 'idle' && (
                      <span className="text-[10px] sm:text-xs font-bold text-white">
                        Detecting…
                      </span>
                    )}
                  </div>
                </button>

                {/* Cart Button */}
                <button
                  id="btn-open-cart-hero"
                  onClick={() => setIsCartOpen(true)}
                  className="relative inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-gradient-to-r from-candy-cherry-500 to-amber-500 hover:from-candy-cherry-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm rounded-full shadow-lg shadow-candy-cherry-500/40 transition-all hover:scale-105 cursor-pointer shrink-0"
                >
                  <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Cart</span>
                  {totalItemsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-white text-candy-cherry-600 font-bold text-[10px]">
                      {totalItemsCount}
                    </span>
                  )}
                </button>

                {/* User Profile Avatar "S" - Opens Customer Profile Menu */}
                <button
                  id="btn-profile-avatar"
                  onClick={() => {
                    if (onOpenProfileMenu) {
                      onOpenProfileMenu();
                    } else {
                      setShowProfileModal(true);
                    }
                  }}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-2 border-white/80 shadow-md flex items-center justify-center font-bold text-xs sm:text-sm hover:scale-105 transition-all cursor-pointer shrink-0"
                  aria-label="Customer Profile Menu"
                  title={isAuthenticated && customer?.name && customer.name !== 'Valued Guest' ? `${customer.name} Profile & Menu` : 'Customer Profile Menu'}
                >
                  {isAuthenticated && customer?.name && customer.name !== 'Valued Guest' ? (
                    customer.name.charAt(0).toUpperCase()
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* ROW 2: SEARCH BAR + VEG MODE TOGGLE OVERLAPPING BANNER */}
            <div className="w-full max-w-3xl mx-auto flex items-center justify-center gap-2 sm:gap-3">
              {/* Main Rounded Search Card -- ref'd wrapper so the live results dropdown
                  below can be positioned against it and closed on outside click */}
              <div ref={searchWrapRef} className="relative flex-1 min-w-0">
              <div
                className={`flex items-center bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl border border-white/50 dark:border-stone-700/80 shadow-xl gap-2 sm:gap-2.5 transition-all focus-within:ring-2 focus-within:ring-amber-500 ${
                  isSearchFocused ? 'px-3.5 sm:px-5 py-3 sm:py-4' : 'px-3 sm:px-4 py-2 sm:py-3'
                }`}
              >
                {/* Pinkish/Amber Magnifying Glass */}
                <Search className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-rose-500 dark:text-rose-400 stroke-[2.5] shrink-0" />

                {/* Animated / User Controlled Search Input -- enlarges (bigger text, no
                    truncation) once tapped/focused so a long typed query stays fully
                    readable instead of being clipped in the compact resting state */}
                <div className="flex-1 min-w-0 relative flex items-center">
                  <input
                    id="search-input-top-hero"
                    ref={searchInputRef}
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={searchQuery}
                    onChange={(e) => {
                      onSearchChange(e.target.value);
                      setIsSearchResultsOpen(true);
                    }}
                    onFocus={() => {
                      setIsSearchFocused(true);
                      if (searchQuery.trim()) setIsSearchResultsOpen(true);
                    }}
                    placeholder={placeholders[placeholderIndex]}
                    className={`w-full bg-transparent font-normal text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-hidden transition-all ${
                      isSearchFocused ? 'text-sm sm:text-lg' : 'text-xs sm:text-base truncate'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        onSearchChange('');
                        setIsSearchResultsOpen(false);
                      }}
                      className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer shrink-0"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>

                {/* Vertical Separator */}
                <div className="h-5 sm:h-6 w-px bg-stone-200 dark:bg-stone-700 shrink-0" />

                {/* Microphone Button with Voice Search Animation */}
                <button
                  id="btn-voice-search"
                  onClick={handleMicClick}
                  aria-label="Search by voice"
                  className={`p-1 sm:p-1.5 rounded-full transition-all cursor-pointer shrink-0 ${
                    isListening
                      ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 animate-pulse'
                      : 'text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-stone-800'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4 sm:w-5 sm:h-5 animate-bounce" />
                  ) : (
                    <Mic className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                  )}
                </button>
              </div>

              {/* Live Search Results Dropdown -- matches shown right under the hero search
                  bar the moment you start typing, no scrolling required */}
              {dropdownOpen && dropdownPos && createPortal(
                <div
                  ref={searchDropdownRef}
                  style={{
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    width: dropdownPos.width,
                    maxHeight: `calc(100dvh - ${dropdownPos.top + 12}px)`,
                  }}
                  className="fixed flex flex-col bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl z-[60] overflow-hidden"
                >
                  {searchResults.length > 0 ? (
                    <>
                      <div className="max-h-80 min-h-0 flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
                        {searchResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              onSelectSearchResult?.(item);
                              setIsSearchResultsOpen(false);
                            }}
                            className="w-full flex items-center gap-3 p-2.5 sm:p-3 hover:bg-stone-50 dark:hover:bg-stone-800 text-left transition-colors cursor-pointer"
                          >
                            <img
                              src={item.image}
                              alt={item.name}
                              loading="lazy"
                              className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg object-cover shrink-0 border border-stone-200 dark:border-stone-700"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                                {item.name}
                              </div>
                              <div className="text-xs text-stone-500 dark:text-stone-400">₹{item.price}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                      {totalSearchMatches > searchResults.length && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsSearchResultsOpen(false);
                            const el = document.getElementById('menu-heading');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="w-full shrink-0 text-center py-2.5 text-xs font-bold text-candy-cherry-600 dark:text-candy-cherry-400 hover:bg-stone-50 dark:hover:bg-stone-800 border-t border-stone-100 dark:border-stone-800 cursor-pointer transition-colors"
                        >
                          See all {totalSearchMatches} results
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="p-4 text-center text-xs text-stone-500 dark:text-stone-400">
                      No dishes match &quot;{searchQuery}&quot;
                    </div>
                  )}
                </div>,
                document.body
              )}
              </div>

              {/* VEG MODE Toggle Overlapping Banner */}
              <div className="flex flex-col items-center justify-center shrink-0 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl border border-white/50 dark:border-stone-700/80 shadow-xl">
                <span className="text-[9px] sm:text-[10px] font-extrabold tracking-tight text-stone-800 dark:text-stone-200 leading-tight text-center">
                  VEG
                </span>
                <span className="text-[8px] sm:text-[9px] font-extrabold tracking-wider text-stone-600 dark:text-stone-400 -mt-0.5 leading-tight text-center">
                  MODE
                </span>
                <button
                  id="veg-mode-toggle-switch"
                  type="button"
                  role="switch"
                  aria-checked={vegOnly}
                  aria-label="Pure Veg mode"
                  onClick={onToggleVegOnly}
                  className={`relative mt-0.5 sm:mt-1 inline-flex h-5 w-9 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    vegOnly ? 'bg-emerald-600 shadow-emerald-500/30 shadow-xs' : 'bg-stone-300 dark:bg-stone-700'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      vegOnly ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Left & Right Chevron Controls */}
        {totalSlides > 1 && (
          <>
            <button
              id="hero-banner-prev"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
              }}
              aria-label="Previous slide"
              style={{
                top: showOverlayHeader
                  ? `calc(${headerHeight}px + (100% - ${headerHeight}px) / 2)`
                  : '50%',
              }}
              className="absolute left-1.5 sm:left-3 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/40 text-white border border-white/30 backdrop-blur-md shadow-lg flex items-center justify-center hover:bg-black/65 hover:scale-110 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </button>
            <button
              id="hero-banner-next"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSlide((prev) => (prev + 1) % totalSlides);
              }}
              aria-label="Next slide"
              style={{
                top: showOverlayHeader
                  ? `calc(${headerHeight}px + (100% - ${headerHeight}px) / 2)`
                  : '50%',
              }}
              className="absolute right-1.5 sm:right-3 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/40 text-white border border-white/30 backdrop-blur-md shadow-lg flex items-center justify-center hover:bg-black/65 hover:scale-110 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </button>
          </>
        )}
      </div>

      {/* TOAST: When user taps on Welcome coupon */}
      <AnimatePresence>
        {copiedCouponToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white dark:bg-white dark:text-stone-900 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-stone-700 dark:border-stone-200 text-xs sm:text-sm font-semibold"
          >
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{copiedCouponToast}</span>
            <button
              onClick={() => setCopiedCouponToast(null)}
              className="text-stone-400 hover:text-white dark:hover:text-stone-900"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: PROFILE MODAL */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-stone-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-stone-200 dark:border-stone-800"
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black flex items-center justify-center text-base shrink-0 shadow-sm">
                    {isAuthenticated && customer?.name && customer.name !== 'Valued Guest' ? (
                      customer.name.charAt(0).toUpperCase()
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 truncate">
                      {isAuthenticated ? (customer?.name || 'Customer') : 'Guest Visitor'}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                      {isAuthenticated ? (customer?.email || `+91 ${customer?.phone}`) : 'Not signed in'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="p-1 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-2 text-xs">
                {isAuthenticated ? (
                  <button
                    onClick={() => {
                      logout();
                      setShowProfileModal(false);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/50 font-semibold text-rose-700 dark:text-rose-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span>Sign Out ({customer?.name})</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-rose-400" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowProfileModal(false);
                      openAuthModal('account');
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 font-semibold text-amber-800 dark:text-amber-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <LogIn className="w-4 h-4 text-amber-600" />
                      <span>Sign In with Mobile OTP</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-600" />
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    onOpenReservation();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 border border-stone-100 dark:border-stone-800 font-semibold text-stone-700 dark:text-stone-300"
                >
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-amber-600" />
                    <span>My Table Reservations</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400" />
                </button>
              </div>

              <button
                onClick={() => setShowProfileModal(false)}
                className="w-full py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
