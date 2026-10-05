import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  SlidersHorizontal,
  ArrowUpDown,
  Flame,
  Star,
  Percent,
  Clock,
  Tag,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
} from 'lucide-react';

export interface FilterBarProps {
  vegOnly: boolean;
  onToggleVegOnly: () => void;
  nonVegOnly: boolean;
  onToggleNonVegOnly: () => void;
  eggOnly?: boolean;
  onToggleEggOnly?: () => void;
  bestsellerOnly: boolean;
  onToggleBestseller: () => void;
  ratingOnly: boolean;
  onToggleRating: () => void;
  offersOnly: boolean;
  onToggleOffers: () => void;
  quickPrepOnly: boolean;
  onToggleQuickPrep: () => void;
  maxPrice: number | null;
  onSelectMaxPrice: (price: number | null) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  onClearAllFilters: () => void;
  totalFiltered: number;
  isSticky?: boolean;
  idPrefix?: string;
  className?: string;
  showIndicatorButtons?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  vegOnly,
  onToggleVegOnly,
  nonVegOnly,
  onToggleNonVegOnly,
  eggOnly = false,
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
  isSticky = false,
  idPrefix = '',
  className = '',
  showIndicatorButtons = true,
}) => {
  const p = (id: string) => (idPrefix ? `${idPrefix}-${id}` : id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Zomato Filter Modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'sort' | 'diet' | 'rating' | 'price' | 'more'>('sort');

  // Quick Sort Dropdown popover
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Mouse/touch drag state tracking for smooth swiping on mobile & desktop
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Check scroll boundary state to show/hide overlapping side indicators
  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
  }, []);

  useEffect(() => {
    checkScroll();
    const timer = setTimeout(checkScroll, 100);
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
      return () => {
        clearTimeout(timer);
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
    return () => clearTimeout(timer);
  }, [checkScroll]);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const slideLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -220, behavior: 'smooth' });
    }
  };

  const slideRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 220, behavior: 'smooth' });
    }
  };

  // Mouse drag support for smooth swiping on any screen
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isPointerDownRef.current = true;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftStartRef.current = scrollRef.current.scrollLeft;
    hasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPointerDownRef.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const distance = x - startXRef.current;
    if (Math.abs(distance) > 6) {
      hasDraggedRef.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeftStartRef.current - distance;
  };

  const handleMouseUpOrLeave = () => {
    isPointerDownRef.current = false;
  };

  const wrapClick = (action: () => void) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    action();
  };

  // Count how many non-default filters are active
  const activeFiltersCount =
    (vegOnly ? 1 : 0) +
    (nonVegOnly ? 1 : 0) +
    (eggOnly ? 1 : 0) +
    (bestsellerOnly ? 1 : 0) +
    (ratingOnly ? 1 : 0) +
    (offersOnly ? 1 : 0) +
    (quickPrepOnly ? 1 : 0) +
    (maxPrice !== null ? 1 : 0) +
    (sortBy !== 'popular' ? 1 : 0);

  const sortLabels: Record<string, string> = {
    popular: 'Popularity',
    rating: 'Rating: High to Low',
    'price-asc': 'Cost: Low to High',
    'price-desc': 'Cost: High to Low',
    time: 'Prep Time (< 20m)',
  };

  return (
    <div
      className={`w-full max-w-full relative select-none overflow-hidden ${
        className ? className : isSticky ? 'my-0 py-1' : 'my-1 py-0.5'
      }`}
    >
      {/* Scroll Indicator - Left Side. Faded backdrop so the next pill peeking in from the
          edge softens out instead of being sliced clean in half by a bare floating button. */}
      {showIndicatorButtons && canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-30 w-10 pointer-events-none bg-gradient-to-r from-cream via-cream/85 to-transparent dark:from-stone-900 dark:via-stone-900/85">
          <button
            id={p('filter-scroll-left')}
            onClick={slideLeft}
            aria-label="Scroll left"
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/50 hover:bg-black/75 shadow-md border border-white/25 flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all cursor-pointer backdrop-blur-xs pointer-events-auto"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Scroll Indicator - Right Side. Same fade treatment as the left side. */}
      {showIndicatorButtons && canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 z-30 w-10 pointer-events-none bg-gradient-to-l from-cream via-cream/85 to-transparent dark:from-stone-900 dark:via-stone-900/85">
          <button
            id={p('filter-scroll-right')}
            onClick={slideRight}
            aria-label="Scroll right for more filters"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/50 hover:bg-black/75 shadow-md border border-white/25 flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all cursor-pointer backdrop-blur-xs pointer-events-auto"
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Horizontal Scrollable Filter Pills Container (Thumb Swipe on Mobile) */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="flex items-center gap-2 overflow-x-auto scrollbar-none scroll-smooth py-1 px-1 cursor-grab active:cursor-grabbing touch-pan-x"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
        }}
        tabIndex={0}
        aria-label="Food filter options"
      >
        {/* 1. Main Zomato "Filters" Button (Opens Filter Sheet) */}
        <button
          id={p('btn-open-zomato-filters')}
          onClick={() => wrapClick(() => setIsFilterModalOpen(true))}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all cursor-pointer shadow-2xs ${
            activeFiltersCount > 0
              ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-amber-500/20 shadow-sm'
              : 'bg-white dark:bg-stone-800/90 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:border-amber-400 hover:bg-stone-50 dark:hover:bg-stone-700'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-white text-amber-700 font-bold text-[10px] flex items-center justify-center shrink-0">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* 2. Sort by Pill with Quick Dropdown */}
        <div className="relative shrink-0" ref={sortDropdownRef}>
          <button
            id={p('btn-sort-dropdown')}
            onClick={() => wrapClick(() => setIsSortDropdownOpen(!isSortDropdownOpen))}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
              sortBy !== 'popular'
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                : 'bg-white dark:bg-stone-800/90 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:border-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
            <span>{sortBy === 'popular' ? 'Sort by' : sortLabels[sortBy] || 'Sort'}</span>
            <span className="text-[10px] opacity-60">▾</span>
          </button>

          {/* Quick Dropdown Menu */}
          {isSortDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-48 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl shadow-xl z-50 py-1 text-xs">
              {[
                { key: 'popular', label: 'Popularity (Default)' },
                { key: 'rating', label: 'Rating: High to Low' },
                { key: 'price-asc', label: 'Cost: Low to High' },
                { key: 'price-desc', label: 'Cost: High to Low' },
                { key: 'time', label: 'Prep Time (< 20m)' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    onSortChange(item.key);
                    setIsSortDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-amber-50 dark:hover:bg-stone-800 transition-colors ${
                    sortBy === item.key
                      ? 'text-amber-600 dark:text-amber-400 font-bold bg-amber-50/60 dark:bg-stone-800/60'
                      : 'text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <span>{item.label}</span>
                  {sortBy === item.key && <Check className="w-3.5 h-3.5 text-amber-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Pure Veg Pill */}
        <button
          id={p('filter-pure-veg')}
          onClick={() => wrapClick(onToggleVegOnly)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all cursor-pointer shadow-2xs ${
            vegOnly
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-stone-800/90 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700'
          }`}
        >
          <span className="w-3.5 h-3.5 rounded-xs border border-emerald-600 flex items-center justify-center p-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          </span>
          <span>Pure Veg</span>
          {vegOnly && <X className="w-3 h-3 text-emerald-600" />}
        </button>

        {/* 4. Non-Veg Pill */}
        <button
          id={p('filter-non-veg')}
          onClick={() => wrapClick(onToggleNonVegOnly)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all cursor-pointer shadow-2xs ${
            nonVegOnly
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-400 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-stone-800/90 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700'
          }`}
        >
          <span className="w-3.5 h-3.5 rounded-xs border border-rose-600 flex items-center justify-center p-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
          </span>
          <span>Non-Veg</span>
          {nonVegOnly && <X className="w-3 h-3 text-rose-600" />}
        </button>

        {/* 4b. Egg Pill */}
        {onToggleEggOnly && (
          <button
            id={p('filter-egg')}
            onClick={() => wrapClick(onToggleEggOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all cursor-pointer shadow-2xs ${
              eggOnly
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                : 'bg-white dark:bg-stone-800/90 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700'
            }`}
          >
            <span className="w-3.5 h-3.5 rounded-xs border border-amber-600 flex items-center justify-center p-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            </span>
            <span>Contains Egg</span>
            {eggOnly && <X className="w-3 h-3 text-amber-600" />}
          </button>
        )}

        {/* 5. Rating 4.5+ Pill */}
        <button
          id={p('filter-rating')}
          onClick={() => wrapClick(onToggleRating)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all cursor-pointer shadow-2xs ${
            ratingOnly
              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-stone-800/90 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700'
          }`}
        >
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span>Rating 4.5+</span>
          {ratingOnly && <X className="w-3 h-3 text-amber-600" />}
        </button>

        {/* 6. Bestsellers Pill */}
        <button
          id={p('filter-bestseller')}
          onClick={() => wrapClick(onToggleBestseller)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all cursor-pointer shadow-2xs ${
            bestsellerOnly
              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-stone-800/90 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          <span>Bestsellers</span>
          {bestsellerOnly && <X className="w-3 h-3 text-amber-600" />}
        </button>

        {/* 7. Great Offers / Discounts Pill */}
        <button
          id={p('filter-offers')}
          onClick={() => wrapClick(onToggleOffers)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all cursor-pointer shadow-2xs ${
            offersOnly
              ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
              : 'bg-white dark:bg-stone-800/90 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700'
          }`}
        >
          <Percent className="w-3.5 h-3.5 text-purple-500" />
          <span>Great Offers</span>
          {offersOnly && <X className="w-3 h-3 text-purple-600" />}
        </button>

        {/* 8. Under ₹250 / Budget Friendly Pill */}
        <button
          id={p('filter-under-250')}
          onClick={() => wrapClick(() => onSelectMaxPrice(maxPrice === 250 ? null : 250))}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all cursor-pointer shadow-2xs ${
            maxPrice === 250
              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
              : 'bg-white dark:bg-stone-800/90 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700'
          }`}
        >
          <Tag className="w-3.5 h-3.5 text-blue-500" />
          <span>Under ₹250</span>
          {maxPrice === 250 && <X className="w-3 h-3 text-blue-600" />}
        </button>

        {/* 9. Fast Prep (< 20 mins) Pill */}
        <button
          id={p('filter-quick-prep')}
          onClick={() => wrapClick(onToggleQuickPrep)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all cursor-pointer shadow-2xs ${
            quickPrepOnly
              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-stone-800/90 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span>Fast Prep (&le; 20m)</span>
          {quickPrepOnly && <X className="w-3 h-3 text-amber-600" />}
        </button>

        {/* 10. Clear All Filters Button (Visible only when filters active) */}
        {activeFiltersCount > 0 && (
          <button
            id={p('filter-clear-all')}
            onClick={() => wrapClick(onClearAllFilters)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* Zomato-Style Filter Bottom-Sheet / Modal Dialog -- portaled to <body>. Rendered in
          place, it was trapped inside the category/filter row's stacking layer (and, in the
          sticky header, inside a transformed parent that re-anchors `position: fixed`), so
          later page sections -- the "Book a Table" slider, its arrows -- painted on top of it. */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                    <span>Filters and Sort</span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Showing {totalFiltered} delicious dishes
                  </p>
                </div>
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body: Zomato 2-Column Tab Layout */}
              <div className="flex-1 flex overflow-hidden min-h-[320px]">
                {/* Left Navigation Tabs */}
                <div className="w-36 sm:w-40 border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/60 p-2 space-y-1">
                  {[
                    { id: 'sort', label: 'Sort by', count: sortBy !== 'popular' ? 1 : 0 },
                    { id: 'diet', label: 'Dietary', count: (vegOnly ? 1 : 0) + (nonVegOnly ? 1 : 0) + (eggOnly ? 1 : 0) },
                    { id: 'rating', label: 'Rating', count: ratingOnly ? 1 : 0 },
                    { id: 'price', label: 'Cost / Price', count: maxPrice !== null ? 1 : 0 },
                    { id: 'more', label: 'Offers & More', count: (bestsellerOnly ? 1 : 0) + (offersOnly ? 1 : 0) + (quickPrepOnly ? 1 : 0) },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveModalTab(tab.id as any)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        activeModalTab === tab.id
                          ? 'bg-white dark:bg-stone-800 text-amber-600 dark:text-amber-400 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count > 0 && (
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Right Tab Content */}
                <div className="flex-1 p-5 overflow-y-auto space-y-4">
                  {/* Sort By Tab */}
                  {activeModalTab === 'sort' && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Sort Dishes By
                      </h4>
                      {[
                        { key: 'popular', label: 'Popularity (Default)' },
                        { key: 'rating', label: 'Rating: High to Low' },
                        { key: 'price-asc', label: 'Cost: Low to High' },
                        { key: 'price-desc', label: 'Cost: High to Low' },
                        { key: 'time', label: 'Fast Delivery / Prep Time' },
                      ].map((s) => (
                        <label
                          key={s.key}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                            sortBy === s.key
                              ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 font-bold'
                              : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                          }`}
                        >
                          <span>{s.label}</span>
                          <input
                            type="radio"
                            name="sortOption"
                            checked={sortBy === s.key}
                            onChange={() => onSortChange(s.key)}
                            className="text-amber-600 focus:ring-amber-500 accent-amber-500"
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Dietary Tab */}
                  {activeModalTab === 'diet' && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Dietary Preference
                      </h4>
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            if (vegOnly) onToggleVegOnly();
                            if (nonVegOnly) onToggleNonVegOnly();
                            if (eggOnly && onToggleEggOnly) onToggleEggOnly();
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            !vegOnly && !nonVegOnly && !eggOnly
                              ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300'
                              : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <span>All Dishes</span>
                          {!vegOnly && !nonVegOnly && !eggOnly && <Check className="w-4 h-4 text-amber-500" />}
                        </button>

                        <button
                          onClick={onToggleVegOnly}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            vegOnly
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded-xs border border-emerald-600 flex items-center justify-center p-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            </span>
                            <span>Pure Veg Only</span>
                          </div>
                          {vegOnly && <Check className="w-4 h-4 text-emerald-600" />}
                        </button>

                        <button
                          onClick={onToggleNonVegOnly}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            nonVegOnly
                              ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                              : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded-xs border border-rose-600 flex items-center justify-center p-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            </span>
                            <span>Non-Veg Only</span>
                          </div>
                          {nonVegOnly && <Check className="w-4 h-4 text-rose-600" />}
                        </button>

                        {onToggleEggOnly && (
                          <button
                            onClick={onToggleEggOnly}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                              eggOnly
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-3.5 h-3.5 rounded-xs border border-amber-600 flex items-center justify-center p-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                              </span>
                              <span>Contains Egg Only</span>
                            </div>
                            {eggOnly && <Check className="w-4 h-4 text-amber-600" />}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rating Tab */}
                  {activeModalTab === 'rating' && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Customer Rating
                      </h4>
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            if (ratingOnly) onToggleRating();
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            !ratingOnly
                              ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300'
                              : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <span>Any Rating</span>
                          {!ratingOnly && <Check className="w-4 h-4 text-amber-500" />}
                        </button>

                        <button
                          onClick={onToggleRating}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            ratingOnly
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            <span>Top Rated (4.5+ Stars)</span>
                          </div>
                          {ratingOnly && <Check className="w-4 h-4 text-amber-500" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Price Tab */}
                  {activeModalTab === 'price' && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Maximum Cost / Price
                      </h4>
                      <div className="space-y-2">
                        {[
                          { label: 'Any Price', val: null },
                          { label: 'Budget Friendly (Under ₹200)', val: 200 },
                          { label: 'Under ₹250', val: 250 },
                          { label: 'Under ₹400', val: 400 },
                        ].map((p) => (
                          <button
                            key={p.label}
                            onClick={() => onSelectMaxPrice(p.val)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                              maxPrice === p.val
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                            }`}
                          >
                            <span>{p.label}</span>
                            {maxPrice === p.val && <Check className="w-4 h-4 text-amber-500" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Offers & More Tab */}
                  {activeModalTab === 'more' && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Discounts & Preparation
                      </h4>
                      <div className="space-y-2">
                        <button
                          onClick={onToggleBestseller}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            bestsellerOnly
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Flame className="w-4 h-4 text-amber-500" />
                            <span>Bestsellers Only</span>
                          </div>
                          {bestsellerOnly && <Check className="w-4 h-4 text-amber-500" />}
                        </button>

                        <button
                          onClick={onToggleOffers}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            offersOnly
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                              : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Percent className="w-4 h-4 text-purple-500" />
                            <span>Great Offers & Discounts</span>
                          </div>
                          {offersOnly && <Check className="w-4 h-4 text-purple-600" />}
                        </button>

                        <button
                          onClick={onToggleQuickPrep}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            quickPrepOnly
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <span>Fast Prep (&le; 20 mins)</span>
                          </div>
                          {quickPrepOnly && <Check className="w-4 h-4 text-amber-500" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 bg-stone-50 dark:bg-stone-950/80 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                <button
                  onClick={onClearAllFilters}
                  disabled={activeFiltersCount === 0}
                  className={`text-xs font-semibold px-4 py-2 rounded-xl transition-colors ${
                    activeFiltersCount > 0
                      ? 'text-stone-700 dark:text-stone-300 hover:text-amber-600 cursor-pointer'
                      : 'text-stone-400 dark:text-stone-600 cursor-not-allowed'
                  }`}
                >
                  Clear all
                </button>

                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                >
                  Apply & Show {totalFiltered} Dishes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
};
