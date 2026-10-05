import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, LayoutGrid, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Category } from '../types';

export interface CategoryPillsProps {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (slug: string) => void;
  itemsCountByCategory: Record<string, number>;
  idPrefix?: string;
  className?: string;
  compact?: boolean;
}

// Fallback images matching Zomato's vibrant circular food icons
export const FALLBACK_CATEGORY_IMAGES: Record<string, string> = {
  all: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80',
  thali: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=300&q=80',
  bakery: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=300&q=80',
  bites: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=300&q=80',
  burgers: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80',
  italian: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80',
  mains: 'https://images.unsplash.com/photo-1596560314766-08c0c6890024?auto=format&fit=crop&w=300&q=80',
  shakes: 'https://images.unsplash.com/photo-1590373927063-cb2d69209a8b?auto=format&fit=crop&w=300&q=80',
  coffee: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=300&q=80',
};

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
  itemsCountByCategory,
  idPrefix = '',
  className = '',
  compact = false,
}) => {
  const p = (id: string) => (idPrefix ? `${idPrefix}-${id}` : id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [showAllModal, setShowAllModal] = useState(false);

  // Prevent background scrolling when modal is open and handle ESC key
  useEffect(() => {
    if (showAllModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowAllModal(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showAllModal]);

  // Mouse/touch drag state tracking for seamless thumb & mouse swiping
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Check scroll boundary state to show/hide overlapping side indicators
  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 12);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 12);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [categories, checkScroll]);

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
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 120);
  };

  const handleCategoryClick = (slug: string) => {
    // If the user was dragging/swiping with their thumb/mouse, ignore the click
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    onSelectCategory(slug);
  };

  return (
    <div className={`w-full max-w-full relative select-none overflow-hidden ${className ? className : 'mb-1 sm:mb-2'}`}>
      {/* Scroll Indicator - Left Side. Wrapped in a fade so the next circle peeking in from
          the edge softens into the background instead of looking sliced clean in half right
          at the viewport edge, which is what a bare floating button over raw content did. */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-30 w-10 pointer-events-none bg-gradient-to-r from-cream via-cream/85 to-transparent dark:from-stone-900 dark:via-stone-900/85">
          <button
            id={p('food-category-scroll-left')}
            onClick={slideLeft}
            aria-label="Scroll left"
            className="absolute left-1 top-[42%] -translate-y-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/50 hover:bg-black/75 shadow-md border border-white/25 flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all cursor-pointer backdrop-blur-xs pointer-events-auto"
          >
            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Scroll Indicator - Right Side. Same fade treatment as the left side. */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 z-30 w-10 pointer-events-none bg-gradient-to-l from-cream via-cream/85 to-transparent dark:from-stone-900 dark:via-stone-900/85">
          <button
            id={p('food-category-scroll-right')}
            onClick={slideRight}
            aria-label="Scroll right for more categories"
            className="absolute right-1 top-[42%] -translate-y-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/50 hover:bg-black/75 shadow-md border border-white/25 flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all cursor-pointer backdrop-blur-xs pointer-events-auto"
          >
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Scrollable Container with Compact Height & Thumb Sliding */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={`flex items-start gap-2.5 sm:gap-3.5 overflow-x-auto scrollbar-none scroll-smooth ${compact ? 'py-0.5 px-1' : 'py-0.5 px-2'} cursor-grab active:cursor-grabbing touch-pan-x`}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
        }}
        tabIndex={0}
        aria-label="Food category circular menu"
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat.slug;
          const count = itemsCountByCategory[cat.slug] ?? 0;
          const imageUrl = cat.image || FALLBACK_CATEGORY_IMAGES[cat.slug] || FALLBACK_CATEGORY_IMAGES.all;

          return (
            <button
              key={cat.id}
              id={p(`cat-circle-${cat.slug}`)}
              onClick={() => handleCategoryClick(cat.slug)}
              className="group flex flex-col items-center shrink-0 focus:outline-none cursor-pointer transition-transform duration-200 active:scale-95 py-0.5 px-0.5"
            >
              {/* Round Circular Image Container (Zomato Mobile App Style) */}
              <div
                className={`relative ${
                  compact
                    ? 'w-11 h-11 xs:w-12 xs:h-12 sm:w-13 sm:h-13'
                    : 'w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16'
                } rounded-full p-0.5 bg-white dark:bg-stone-900 transition-all duration-300 ${
                  isActive
                    ? 'ring-2.5 ring-candy-cherry-500 ring-offset-1 ring-offset-transparent shadow-md shadow-amber-400/40 scale-105'
                    : 'border-2 border-stone-200 dark:border-stone-700/80 group-hover:border-candy-cherry-400 group-hover:scale-105 shadow-sm'
                }`}
              >
                <div className="w-full h-full rounded-full overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={cat.name}
                    loading="lazy"
                    draggable={false}
                    className="w-full h-full object-cover object-center pointer-events-none transition-transform duration-500 ease-out group-hover:scale-110"
                  />
                </div>

                {/* Count indicator pill on circle */}
                {count > 0 && (
                  <span
                    className={`absolute -bottom-0.5 right-0 text-[8.5px] xs:text-[9px] font-bold px-1.5 py-0 rounded-full shadow-xs border ${
                      isActive
                        ? 'bg-candy-cherry-600 text-white border-white/50'
                        : 'bg-stone-900 text-white border-white/20 backdrop-blur-xs'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </div>

              {/* Food Type Name Directly Below Image */}
              <span
                className={`mt-1 ${
                  compact
                    ? 'text-[10px] xs:text-[10.5px] sm:text-[11px] max-w-[54px] xs:max-w-[60px] sm:max-w-[68px]'
                    : 'text-[10.5px] xs:text-[11px] sm:text-xs max-w-[56px] xs:max-w-[64px] sm:max-w-[72px]'
                } text-center leading-tight transition-colors truncate drop-shadow-xs ${
                  isActive
                    ? 'font-bold text-candy-cherry-600 dark:text-candy-cherry-400'
                    : 'font-medium text-stone-800 dark:text-stone-200 group-hover:text-candy-cherry-600 dark:group-hover:text-candy-cherry-400'
                }`}
              >
                {cat.name}
              </span>
            </button>
          );
        })}

        {/* "SEE ALL" OPTION AT THE LAST OF FOOD CATEGORY OPTIONS */}
        <button
          id={p('cat-circle-see-all')}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasDraggedRef.current) {
              hasDraggedRef.current = false;
              return;
            }
            setShowAllModal(true);
          }}
          className="group flex flex-col items-center shrink-0 focus:outline-none cursor-pointer transition-transform duration-200 active:scale-95 py-0.5 px-0.5"
          aria-label="See all food categories"
        >
          <div
            className={`${
              compact
                ? 'w-11 h-11 xs:w-12 xs:h-12 sm:w-13 sm:h-13'
                : 'w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16'
            } rounded-full bg-white dark:bg-stone-900 border-2 border-dashed border-amber-500 dark:border-amber-400 hover:border-amber-600 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm group-hover:scale-105 transition-all`}
          >
            <LayoutGrid className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <span
            className={`mt-1 ${
              compact
                ? 'text-[10px] xs:text-[10.5px] sm:text-[11px] max-w-[54px] xs:max-w-[60px] sm:max-w-[68px]'
                : 'text-[10.5px] xs:text-[11px] sm:text-xs max-w-[56px] xs:max-w-[64px] sm:max-w-[72px]'
            } font-bold text-amber-600 dark:text-amber-400 text-center leading-tight truncate drop-shadow-xs`}
          >
            See All
          </span>
        </button>
      </div>

      {/* ALL CATEGORIES MODAL (Mounted via createPortal to document.body so it is never trapped or clipped) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showAllModal && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
                onClick={() => setShowAllModal(false)}
                role="dialog"
                aria-modal="true"
              >
                <motion.div
                  initial={{ scale: 0.92, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.92, opacity: 0, y: 15 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-white dark:bg-stone-900 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 my-auto relative z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                        <LayoutGrid className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
                          All Food Categories
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          Explore all our specialties
                        </p>
                      </div>
                    </div>
                    <button
                      id={p('modal-close-all-categories')}
                      onClick={() => setShowAllModal(false)}
                      className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Grid of Categories */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-4 max-h-[60vh] overflow-y-auto pr-1">
                    {/* All Dishes Option */}
                    <button
                      onClick={() => {
                        onSelectCategory('all');
                        setShowAllModal(false);
                        const heading = document.getElementById('menu-heading');
                        if (heading) {
                          heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                        activeCategory === 'all'
                          ? 'bg-candy-cherry-500/10 border-candy-cherry-500 text-candy-cherry-700 dark:text-candy-cherry-50 font-bold'
                          : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 hover:border-candy-cherry-400'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-candy-cherry-500 to-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">All Dishes</div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400">
                          Full Menu
                        </div>
                      </div>
                    </button>

                    {/* Skip the 'all' category here -- it's already the dedicated "All Dishes"
                        tile above; without this filter it rendered a second, differently
                        labeled "All Dishes" tile right next to it. */}
                    {categories.filter((cat) => cat.slug !== 'all').map((cat) => {
                      const isActive = activeCategory === cat.slug;
                      const count = itemsCountByCategory[cat.slug] ?? 0;
                      const imageUrl = cat.image || FALLBACK_CATEGORY_IMAGES[cat.slug] || FALLBACK_CATEGORY_IMAGES.all;

                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            onSelectCategory(cat.slug);
                            setShowAllModal(false);
                            const heading = document.getElementById('menu-heading');
                            if (heading) {
                              heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            isActive
                              ? 'bg-candy-cherry-500/10 border-candy-cherry-500 text-candy-cherry-700 dark:text-candy-cherry-50 font-bold'
                              : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 hover:border-candy-cherry-400'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-stone-200 dark:border-stone-700">
                            <img
                              src={imageUrl}
                              alt={cat.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate">{cat.name}</div>
                            <div className="text-[10px] text-stone-500 dark:text-stone-400">
                              {count} {count === 1 ? 'item' : 'items'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setShowAllModal(false)}
                    className="w-full py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold text-xs hover:bg-stone-200 dark:hover:bg-stone-700 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};

