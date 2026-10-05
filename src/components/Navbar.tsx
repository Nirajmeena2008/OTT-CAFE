import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  ShoppingBag,
  Coffee,
  X,
  Mic,
  MicOff,
  ChevronLeft,
  MapPin,
  Cake,
  User,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { FilterBar, FilterBarProps } from './FilterBar';
import type { Category, MenuItem } from '../types';
import { CategoryPills } from './CategoryPills';

export interface NavbarProps extends Omit<FilterBarProps, 'isSticky'> {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenProfileMenu: () => void;
  onOpenReservation?: () => void;
  onNavigateHome?: () => void;
  onOpenCustomCake?: () => void;
  isOfferDetailView?: boolean;
  isScrolled?: boolean;
  categories?: Category[];
  activeCategory?: string;
  onSelectCategory?: (slug: string) => void;
  itemsCountByCategory?: Record<string, number>;
  /** Live search matches shown in a dropdown right under the sticky search bar, so the
   * user doesn't have to scroll all the way down to the menu grid to see results. */
  searchResults?: MenuItem[];
  totalSearchMatches?: number;
  onSelectSearchResult?: (item: MenuItem) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  vegOnly,
  onToggleVegOnly,
  nonVegOnly,
  onToggleNonVegOnly,
  eggOnly,
  onToggleEggOnly,
  bestsellerOnly,
  onToggleBestseller,
  ratingOnly,
  onToggleRating,
  offersOnly,
  onToggleOffers,
  quickPrepOnly,
  onToggleQuickPrep,
  maxPrice,
  onSelectMaxPrice,
  sortBy,
  onSortChange,
  onClearAllFilters,
  totalFiltered,
  onOpenProfileMenu,
  onNavigateHome,
  onOpenCustomCake,
  isOfferDetailView = false,
  isScrolled = false,
  categories,
  activeCategory,
  onSelectCategory,
  itemsCountByCategory = {},
  searchResults = [],
  totalSearchMatches = 0,
  onSelectSearchResult,
}) => {
  const { totalItemsCount, total, setIsCartOpen } = useCart();
  const { customer, isAuthenticated } = useAuth();

  // Voice Search / Mic state
  const [isListening, setIsListening] = useState(false);

  // Live search results dropdown -- closes on outside click or Escape, and whenever the
  // query is cleared. Kept open while there's a non-empty query with results to show.
  const [isSearchResultsOpen, setIsSearchResultsOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setIsSearchResultsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Rotate search placeholder every 3.2 seconds
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

  return (
    <header
      id="zomato-sticky-navbar"
      className="fixed top-0 left-0 right-0 z-40 w-full backdrop-blur-md bg-cream/95 dark:bg-stone-900/95 border-b border-stone-200/90 dark:border-stone-800 transition-all duration-200 shadow-md"
    >
      {/* ROW 1: BRAND / BACK + SEARCH BAR + VEG MODE + CART */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 pt-2 pb-1 sm:pt-2.5 sm:pb-1.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand Identity or Back Button */}
        {isOfferDetailView ? (
          <button
            id="navbar-back-to-menu-btn"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold shrink-0 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Menu</span>
          </button>
        ) : (
          <button
            id="navbar-brand-logo-btn"
            onClick={onNavigateHome || (() => window.scrollTo({ top: 0, behavior: 'smooth' }))}
            className="flex items-center gap-2 shrink-0 text-left cursor-pointer group"
            title="Out of the Town"
          >
            <img
              src="/ott-logo.svg"
              alt="Out of the Town Logo"
              referrerPolicy="no-referrer"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full drop-shadow-xs border border-candy-cherry-500/30 object-contain group-hover:scale-105 transition-transform"
            />
            {/* Name only from tablet width up -- on phones the logo alone leaves the search box
                room; with the name shown too, this row was ~50px wider than a 390px screen and
                pushed the cart half off-screen and the profile button off it entirely. */}
            <div className="hidden md:block leading-tight">
              <span className="font-serif text-xs sm:text-sm font-extrabold text-stone-900 dark:text-stone-100 block">
                Out of the Town
              </span>
              <span className="text-[9px] sm:text-[10px] text-amber-700 dark:text-amber-400 font-semibold block">
                Restro &amp; Bakery
              </span>
            </div>
          </button>
        )}

        {/* Center: Zomato-Style Sticky Search Bar -- enlarged (was text-xs/tight padding, hard
            to read what you'd typed once scrolled) and paired with a live results dropdown so
            matches show right under the bar instead of requiring a scroll to the menu grid. */}
        <div ref={searchWrapRef} className="relative flex-1 min-w-0">
        <div className="flex items-center w-full rounded-xl sm:rounded-2xl bg-stone-100 dark:bg-stone-800/95 border border-stone-200/90 dark:border-stone-700/80 shadow-inner px-3 sm:px-4 py-2 sm:py-2.5 gap-2 focus-within:ring-2 focus-within:ring-amber-500 transition-all">
          <Search className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-rose-500 dark:text-rose-400 stroke-[2.5] shrink-0" />
          <div className="flex-1 min-w-0 flex items-center">
            <input
              id="sticky-search-menu-input"
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
                if (searchQuery.trim()) setIsSearchResultsOpen(true);
              }}
              placeholder={placeholders[placeholderIndex]}
              className="w-full bg-transparent text-sm sm:text-base font-normal text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  onSearchChange('');
                  setIsSearchResultsOpen(false);
                }}
                className="p-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer shrink-0"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Vertical Separator */}
          <div className="h-4 w-px bg-stone-200 dark:bg-stone-700 shrink-0" />

          {/* Microphone Voice Search Button */}
          <button
            id="sticky-btn-voice-search"
            onClick={handleMicClick}
            aria-label="Search by voice"
            className={`p-1 rounded-full transition-all cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 animate-pulse'
                : 'text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-stone-700'
            }`}
          >
            {isListening ? (
              <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-bounce" />
            ) : (
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
            )}
          </button>
        </div>

        {/* Live Search Results Dropdown -- appears right under the sticky search bar so
            matches are visible without scrolling down to the menu grid */}
        {isSearchResultsOpen && searchQuery.trim() && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl z-50 overflow-hidden">
            {searchResults.length > 0 ? (
              <>
                <div className="max-h-80 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
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
                    className="w-full text-center py-2.5 text-xs font-bold text-candy-cherry-600 dark:text-candy-cherry-400 hover:bg-stone-50 dark:hover:bg-stone-800 border-t border-stone-100 dark:border-stone-800 cursor-pointer transition-colors"
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
          </div>
        )}
        </div>

        {/* Right 1: Sticky VEG MODE Switch -- hidden on phones, where the "Pure Veg" chip in the
            filter row right below does the same thing (and this row had no room for both). */}
        <div className="hidden sm:flex items-center gap-1 sm:gap-1.5 shrink-0 bg-stone-100 dark:bg-stone-800/90 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs">
          <div className="flex flex-col items-center">
            <span className="text-[8px] sm:text-[9px] font-extrabold tracking-tight text-stone-800 dark:text-stone-200 leading-none">
              VEG
            </span>
            <span className="text-[7px] sm:text-[8px] font-extrabold tracking-wider text-stone-600 dark:text-stone-400 leading-none">
              MODE
            </span>
          </div>
          <button
            id="navbar-veg-mode-toggle"
            type="button"
            role="switch"
            aria-checked={vegOnly}
            aria-label="Pure Veg mode"
            onClick={onToggleVegOnly}
            className={`relative inline-flex h-4 w-7 sm:h-5 sm:w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              vegOnly ? 'bg-emerald-600 shadow-emerald-500/30 shadow-xs' : 'bg-stone-300 dark:bg-stone-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                vegOnly ? 'translate-x-3 sm:translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Right 2: Action Icons (Custom Cake, Cart, Profile) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Cart Trigger Button */}
          <button
            id="navbar-open-cart-btn"
            onClick={() => setIsCartOpen(true)}
            className="relative inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-gradient-to-r from-candy-cherry-500 to-amber-500 hover:from-candy-cherry-600 hover:to-amber-600 text-white font-bold text-xs rounded-full shadow-md shadow-candy-cherry-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cart</span>
            {totalItemsCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-white text-candy-cherry-600 rounded-full">
                {totalItemsCount}
              </span>
            )}
            {total > 0 && (
              <span className="hidden md:inline font-mono text-xs pl-1 border-l border-amber-500">
                ₹{Number.isInteger(total) ? total : total.toFixed(2)}
              </span>
            )}
          </button>

          {/* Customer Profile Button (Opens Customer Menu with Book Table, Night Mode, Account Sign Out, etc.) */}
          <button
            id="navbar-customer-profile-btn"
            onClick={onOpenProfileMenu}
            title={isAuthenticated && customer?.name && customer.name !== 'Valued Guest' ? `${customer.name} - Open Customer Menu` : "Customer Profile & Menu"}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 border border-blue-400/50"
            aria-label="Open Customer Profile Menu"
          >
            {isAuthenticated && customer?.name && customer.name !== 'Valued Guest' ? (
              customer.name.charAt(0).toUpperCase()
            ) : (
              <User className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* ROW 2: STICKY FOOD CATEGORIES TAB (Round images with text below just like Zomato mobile app) */}
      {!isOfferDetailView && categories && categories.length > 0 && onSelectCategory && (
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 border-t border-stone-100 dark:border-stone-800/80 bg-cream/95 dark:bg-stone-900/95 backdrop-blur-md py-1">
          <CategoryPills
            categories={categories}
            activeCategory={activeCategory || 'all'}
            onSelectCategory={(slug) => {
              onSelectCategory(slug);
              const heading = document.getElementById('menu-heading');
              if (heading) {
                heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            itemsCountByCategory={itemsCountByCategory}
            idPrefix="sticky"
            className="my-0 py-0.5"
            compact={true}
          />
        </div>
      )}

      {/* ROW 3: ZOMATO STICKY FILTER BAR (Filters, Sort, Pure Veg, Non Veg, Rating 4.5+, etc.) */}
      {!isOfferDetailView && (
        <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 border-t border-stone-100 dark:border-stone-800/80">
          <FilterBar
            vegOnly={vegOnly}
            onToggleVegOnly={onToggleVegOnly}
            nonVegOnly={nonVegOnly}
            onToggleNonVegOnly={onToggleNonVegOnly}
            eggOnly={eggOnly}
            onToggleEggOnly={onToggleEggOnly}
            bestsellerOnly={bestsellerOnly}
            onToggleBestseller={onToggleBestseller}
            ratingOnly={ratingOnly}
            onToggleRating={onToggleRating}
            offersOnly={offersOnly}
            onToggleOffers={onToggleOffers}
            quickPrepOnly={quickPrepOnly}
            onToggleQuickPrep={onToggleQuickPrep}
            maxPrice={maxPrice}
            onSelectMaxPrice={onSelectMaxPrice}
            sortBy={sortBy}
            onSortChange={onSortChange}
            onClearAllFilters={onClearAllFilters}
            totalFiltered={totalFiltered}
            isSticky={true}
            idPrefix="sticky"
          />
        </div>
      )}
    </header>
  );
};
