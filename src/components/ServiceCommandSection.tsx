import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarCheck,
  Utensils,
  Cake,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Clock,
  MapPin,
  Flame,
} from 'lucide-react';

export interface ServiceCommandSectionProps {
  onOpenCustomCake: (initialImage?: string, initialFlavor?: string) => void;
  onOpenReservation: () => void;
  onSelectFoodService: () => void;
  className?: string;
}

interface ServiceSlide {
  id: 'book_table' | 'order_food' | 'custom_cake';
  title: string;
  shortTitle: string;
  badge: string;
  badgeColor: string;
  tagline: string;
  description: string;
  ctaText: string;
  imageUrl: string;
  highlights: string[];
}

const SERVICES: ServiceSlide[] = [
  {
    id: 'order_food',
    title: 'Order Food & Sizzlers',
    shortTitle: 'Order Food',
    badge: 'Express Food Delivery',
    badgeColor: 'bg-amber-500 text-stone-950',
    tagline: 'Wood-Fired Specialties & North Indian Feasts',
    description: '100% pure veg sizzlers & thalis, delivered fast to your door.',
    ctaText: 'Explore Food Menu',
    imageUrl:
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=80',
    highlights: ['15-Min Quick Prep', 'Pure Veg Kitchen', 'Car & Doorstep Delivery'],
  },
  {
    id: 'book_table',
    title: 'Book a Table for Any Occasion',
    shortTitle: 'Book Table',
    badge: 'Table Reservations',
    badgeColor: 'bg-emerald-500 text-stone-950',
    tagline: 'Garden Lawn, AC Family Lounge & Banquet Hall',
    description: 'Instant confirmation, zero booking charges — reserved in seconds.',
    ctaText: 'Reserve Table Now',
    imageUrl:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80',
    highlights: ['Zero Booking Fee', 'Instant SMS Confirmation', 'Family AC & Garden Lawn'],
  },
  {
    id: 'custom_cake',
    title: 'Design & Order a Custom Cake',
    shortTitle: 'Design Cake',
    badge: 'Artisanal Bakery Studio',
    badgeColor: 'bg-amber-500 text-stone-950',
    tagline: 'Upload Reference Photo & Custom Gourmet Flavors',
    description: 'Upload a reference photo, pick flavors & make it yours.',
    ctaText: 'Open Cake Studio',
    imageUrl:
      'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1600&q=80',
    highlights: ['Upload Reference Photo', 'Belgian Truffle & Lotus Biscoff', '100% Eggless Option'],
  },
];

export const ServiceCommandSection: React.FC<ServiceCommandSectionProps> = ({
  onOpenCustomCake,
  onOpenReservation,
  onSelectFoodService,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const optionsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeftOptions, setCanScrollLeftOptions] = useState(false);
  const [canScrollRightOptions, setCanScrollRightOptions] = useState(false);

  // Check scrollability of the 3 options for mobile view
  const checkOptionsScroll = () => {
    const el = optionsScrollRef.current;
    if (!el) return;
    setCanScrollLeftOptions(el.scrollLeft > 4);
    setCanScrollRightOptions(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = optionsScrollRef.current;
    if (!el) return;
    checkOptionsScroll();
    el.addEventListener('scroll', checkOptionsScroll, { passive: true });
    window.addEventListener('resize', checkOptionsScroll);
    return () => {
      el.removeEventListener('scroll', checkOptionsScroll);
      window.removeEventListener('resize', checkOptionsScroll);
    };
  }, []);

  // Slide options left / right
  const slideOptionsLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (optionsScrollRef.current) {
      optionsScrollRef.current.scrollBy({ left: -180, behavior: 'smooth' });
    }
  };

  const slideOptionsRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (optionsScrollRef.current) {
      optionsScrollRef.current.scrollBy({ left: 180, behavior: 'smooth' });
    }
  };

  // Auto-slide to the right periodically (every 4.5s) like promotional banners
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % SERVICES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isPaused]);

  // Synchronize periodic slide: automatically smooth scroll the options container to the active option card
  useEffect(() => {
    const container = optionsScrollRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>(`#btn-service-opt-${SERVICES[currentIndex].id}`);
    if (activeEl) {
      const containerWidth = container.clientWidth;
      const targetLeft = activeEl.offsetLeft - (containerWidth - activeEl.offsetWidth) / 2;
      container.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: 'smooth',
      });
    }
  }, [currentIndex]);

  const currentService = SERVICES[currentIndex];

  const handleOpenCurrentService = (serviceId: ServiceSlide['id']) => {
    if (serviceId === 'book_table') {
      onOpenReservation();
    } else if (serviceId === 'order_food') {
      onSelectFoodService();
    } else if (serviceId === 'custom_cake') {
      onOpenCustomCake();
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % SERVICES.length);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + SERVICES.length) % SERVICES.length);
  };

  return (
    <section
      id="service-selector-section"
      className={`w-full mb-8 ${className}`}
      aria-label="Select Restaurant Service"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={(e) => {
        setIsPaused(true);
        touchStartXRef.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        setIsPaused(false);
        if (touchStartXRef.current !== null) {
          const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
          if (deltaX < -40) {
            handleNext();
          } else if (deltaX > 40) {
            handlePrev();
          }
        }
        touchStartXRef.current = null;
      }}
    >
      {/* Header bar for Service Section */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
          <h2 className="font-serif font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100">
            Select Your Service
          </h2>
          <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
            3 Quick Services
          </span>
        </div>

        <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 hidden sm:inline">
          Choose a service or explore below
        </span>
      </div>

      {/* 1. THREE SERVICE OPTIONS: Book Table, Order Food, Design Cake (Placed ABOVE the service banners) */}
      <div className="relative mb-3.5 group/service-options">
        {/* Left Slide Button for Mobile Overflow */}
        {canScrollLeftOptions && (
          <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pr-3 bg-gradient-to-r from-stone-50 via-stone-50/90 to-transparent dark:from-stone-950 dark:via-stone-950/90 pointer-events-none sm:hidden">
            <button
              type="button"
              onClick={slideOptionsLeft}
              aria-label="Slide service options left"
              className="w-7 h-7 rounded-full bg-stone-900/80 hover:bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-md flex items-center justify-center pointer-events-auto transition-transform active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable / Grid options container */}
        <div
          ref={optionsScrollRef}
          className="flex sm:grid sm:grid-cols-3 gap-2.5 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory py-1 px-0.5"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {SERVICES.map((srv, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={srv.id}
                id={`btn-service-opt-${srv.id}`}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx);
                  handleOpenCurrentService(srv.id);
                }}
                className={`snap-center shrink-0 w-[84vw] max-w-[310px] sm:w-auto sm:max-w-none sm:min-w-0 sm:flex-1 p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex items-center gap-3 group ${
                  isActive
                    ? 'bg-white dark:bg-stone-900 border-amber-500/80 dark:border-amber-400/80 shadow-md ring-2 ring-amber-500/20'
                    : 'bg-white/80 dark:bg-stone-900/60 border-stone-200/80 dark:border-stone-800 hover:border-amber-400/50 dark:hover:border-amber-500/50 hover:bg-white dark:hover:bg-stone-900'
                }`}
              >
                {/* Active Indicator Accent Bar & Countdown Progress */}
                {isActive && (
                  <>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                    {!isPaused && (
                      <motion.div
                        key={`progress-bar-${currentIndex}`}
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 4.5, ease: 'linear' }}
                        className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400 z-10"
                      />
                    )}
                  </>
                )}

                {/* Service Icon Badge */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-108 ${
                    srv.id === 'book_table'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : srv.id === 'order_food'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {srv.id === 'book_table' && <CalendarCheck className="w-5 h-5" />}
                  {srv.id === 'order_food' && <Utensils className="w-5 h-5" />}
                  {srv.id === 'custom_cake' && <Cake className="w-5 h-5" />}
                </div>

                {/* Text Labels */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {srv.id === 'book_table'
                        ? 'Book Table'
                        : srv.id === 'order_food'
                        ? 'Order Food'
                        : 'Design Cake'}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                    {srv.id === 'book_table'
                      ? 'Lounge, Lawn & Banquet Hall'
                      : srv.id === 'order_food'
                      ? 'Express Food Delivery'
                      : 'Custom Bakery Studio'}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isActive
                      ? 'text-amber-500 translate-x-0.5'
                      : 'text-stone-400 group-hover:translate-x-1'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Mobile slide indicator dots for options */}
        <div className="flex sm:hidden items-center justify-center gap-1.5 pt-1.5">
          {SERVICES.map((srv, idx) => (
            <button
              key={srv.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Slide to ${srv.shortTitle || srv.title}`}
              className={`h-1 rounded-full transition-all cursor-pointer ${
                idx === currentIndex
                  ? 'w-5 bg-amber-500'
                  : 'w-1.5 bg-stone-300 dark:bg-stone-700'
              }`}
            />
          ))}
        </div>

        {/* Right Slide Button for Mobile Overflow */}
        {canScrollRightOptions && (
          <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pl-3 bg-gradient-to-l from-stone-50 via-stone-50/90 to-transparent dark:from-stone-950 dark:via-stone-950/90 pointer-events-none sm:hidden">
            <button
              type="button"
              onClick={slideOptionsRight}
              aria-label="Slide service options right"
              className="w-7 h-7 rounded-full bg-stone-900/80 hover:bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-md flex items-center justify-center pointer-events-auto transition-transform active:scale-95 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 2. PROMOTIONAL SERVICE BANNERS: Shifted BELOW the three options */}
      <div
        id={`service-slide-${currentService.id}`}
        onClick={() => handleOpenCurrentService(currentService.id)}
        className="relative w-full rounded-3xl overflow-hidden shadow-xl group bg-stone-950 min-h-[210px] sm:min-h-[250px] cursor-pointer border border-stone-200/80 dark:border-stone-800 select-none"
        role="button"
        tabIndex={0}
        aria-label={`Open ${currentService.title}`}
      >
        {/* Sliding Background Track */}
        <div className="absolute inset-0">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentService.id}
              src={currentService.imageUrl}
              alt={currentService.title}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="w-full h-full object-cover object-center brightness-[0.78] group-hover:scale-103 transition-transform duration-700"
            />
          </AnimatePresence>
          {/* Subtle multi-stop gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
        </div>

        {/* Content Container */}
        <div className="relative z-10 h-full flex flex-col justify-between p-5 sm:p-8 md:p-10 max-w-2xl text-white">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md ${currentService.badgeColor}`}
            >
              <Sparkles className="w-3 h-3" />
              {currentService.badge}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-stone-200 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full">
              <Clock className="w-3 h-3 text-amber-300" />
              {currentService.tagline}
            </span>
          </div>

          {/* Heading & Description */}
          <div className="my-auto py-3">
            <h3 className="text-xl sm:text-3xl md:text-4xl font-serif font-black tracking-tight text-white mb-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] group-hover:text-amber-200 transition-colors">
              {currentService.title}
            </h3>
            <p className="text-xs sm:text-sm text-stone-100/95 font-medium line-clamp-1 max-w-xl drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] leading-relaxed mb-2.5">
              {currentService.description}
            </p>

            {/* Feature Highlights Pills */}
            <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {currentService.highlights.map((h, i) => (
                <span
                  key={i}
                  className="text-[10px] sm:text-xs font-semibold text-white/90 bg-black/40 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-lg"
                >
                  ✓ {h}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom Action CTA Button */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenCurrentService(currentService.id);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>{currentService.ctaText}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>

            <span className="text-[11px] font-medium text-stone-300/90 hidden xs:inline">
              Click slide to open options
            </span>
          </div>
        </div>

        {/* Carousel Navigation Arrow Controls */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous service slide"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer border border-white/20 shadow-md"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next service slide"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer border border-white/20 shadow-md"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Carousel Progress Indicators / Dots */}
        <div className="absolute bottom-3 right-4 sm:bottom-4 sm:right-6 flex items-center gap-1.5 z-20">
          {SERVICES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              aria-label={`Jump to service slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentIndex ? 'w-6 bg-amber-400' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
