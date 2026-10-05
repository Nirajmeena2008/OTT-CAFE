import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SlideableOptionBarProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  scrollAmount?: number;
  activeId?: string;
}

/**
 * SlideableOptionBar: Enables smooth horizontal sliding for tab/option bars
 * when their contents exceed the screen width (especially on mobile views).
 * Provides left/right chevron slide buttons and edge gradient indicators.
 */
export const SlideableOptionBar: React.FC<SlideableOptionBarProps> = ({
  children,
  className = '',
  innerClassName = '',
  scrollAmount = 200,
  activeId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        checkScroll();
      });
      resizeObserver.observe(el);
    }

    const onResize = () => checkScroll();
    window.addEventListener('resize', onResize);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [checkScroll, children]);

  // If an active item changes, optionally ensure it's scrolled into view
  useEffect(() => {
    if (!activeId || !containerRef.current) return;
    const activeEl = containerRef.current.querySelector(`[data-tab-id="${activeId}"]`);
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeId]);

  const slideLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  const slideRight = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className={`relative group/slider w-full ${className}`}>
      {/* Left Slide Button & Gradient Mask */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pr-4 bg-gradient-to-r from-white via-white/90 to-transparent dark:from-stone-900 dark:via-stone-900/90 pointer-events-none">
          <button
            type="button"
            onClick={slideLeft}
            aria-label="Slide options left"
            className="w-7 h-7 rounded-full bg-stone-900/80 hover:bg-stone-900 text-white dark:bg-stone-100/90 dark:hover:bg-white dark:text-stone-900 shadow-md flex items-center justify-center pointer-events-auto transition-transform active:scale-95 ml-0.5 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Options Scroll Container */}
      <div
        ref={containerRef}
        className={`overflow-x-auto no-scrollbar scroll-smooth flex items-center overscroll-x-contain ${innerClassName}`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>

      {/* Right Slide Button & Gradient Mask */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pl-4 bg-gradient-to-l from-white via-white/90 to-transparent dark:from-stone-900 dark:via-stone-900/90 pointer-events-none">
          <button
            type="button"
            onClick={slideRight}
            aria-label="Slide options right"
            className="w-7 h-7 rounded-full bg-stone-900/80 hover:bg-stone-900 text-white dark:bg-stone-100/90 dark:hover:bg-white dark:text-stone-900 shadow-md flex items-center justify-center pointer-events-auto transition-transform active:scale-95 mr-0.5 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
