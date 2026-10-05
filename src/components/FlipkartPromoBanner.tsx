import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Tag, ArrowRight } from 'lucide-react';
import type { PromoBanner } from '../types';

interface FlipkartPromoBannerProps {
  banners: PromoBanner[];
  onSelectBanner?: (banner: PromoBanner) => void;
  onSelectCategory?: (category: string) => void;
}

export const FlipkartPromoBanner: React.FC<FlipkartPromoBannerProps> = ({
  banners,
  onSelectBanner,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto rotate banner every 5.5 seconds
  useEffect(() => {
    if (!banners.length) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (!banners.length) return null;

  const safeIndex = currentIndex < banners.length ? currentIndex : 0;
  const current = banners[safeIndex];

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleBannerClick = () => {
    if (onSelectBanner) {
      onSelectBanner(current);
    }
  };

  return (
    <div className="w-full mb-8">
      {/* Flipkart-Style Main Carousel Slider */}
      <div
        id={`promo-banner-${current.id}`}
        onClick={handleBannerClick}
        className="relative w-full rounded-2xl overflow-hidden shadow-lg group bg-stone-900 aspect-[21/9] sm:aspect-[24/8] min-h-[220px] max-h-[340px] cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={`View combo deal and offer details for ${current.title}`}
      >
        {/* Background Image with Balanced Overlay for vibrant food visuals & readability */}
        <div className="absolute inset-0">
          <img
            src={current.imageUrl}
            alt={current.title}
            className="w-full h-full object-cover object-center transition-all duration-700 ease-out brightness-[0.82] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
        </div>

        {/* Banner Content */}
        <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-12 md:px-16 max-w-2xl text-white z-10">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white shadow-xs ${current.badgeBgColor}`}
            >
              <Sparkles className="w-3 h-3" />
              {current.highlightBadge}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-amber-400 text-stone-950 shadow-xs">
              <Tag className="w-3 h-3" />
              {current.discountText}
            </span>
          </div>

          {/* Heading & Subtitle with text shadow for crisp legibility */}
          <h2 className="text-xl sm:text-3xl md:text-4xl font-serif font-bold tracking-tight text-white mb-2 line-clamp-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] group-hover:text-amber-200 transition-colors">
            {current.title}
          </h2>
          <p className="text-xs sm:text-sm md:text-base text-stone-100 line-clamp-2 mb-4 max-w-xl font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
            {current.subtitle}
          </p>

          {/* Click Affordance Hint (No order now button and no code, shown only on click) */}
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-amber-300 group-hover:text-amber-200">
            <span className="px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center gap-1.5 group-hover:bg-white/25 transition-all">
              <span>View Pre-Selected Combo & Offer Details</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>

        {/* Carousel Navigation Chevrons */}
        <button
          onClick={handlePrev}
          aria-label="Previous promo slide"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-xs text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={handleNext}
          aria-label="Next promo slide"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-xs text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
