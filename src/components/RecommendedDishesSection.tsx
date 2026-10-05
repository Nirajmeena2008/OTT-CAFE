import React, { useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Heart,
  Star,
  Plus,
  Minus,
  Clock,
  ThumbsUp,
  Flame,
} from 'lucide-react';
import type { MenuItem, Order, Category } from '../types';
import { useCart } from '../context/CartContext';

export interface RecommendedDishesSectionProps {
  menuItems: MenuItem[];
  previousOrders: Order[];
  categories: Category[];
  customerName?: string;
  vegOnly?: boolean;
  nonVegOnly?: boolean;
  eggOnly?: boolean;
  activeCategory?: string;
  onSelectItemDetail: (item: MenuItem) => void;
}

interface RecommendedItem {
  item: MenuItem;
  reason: string;
  badgeType: 'reorder' | 'pairing' | 'taste_profile' | 'bestseller';
  score: number;
}

export const RecommendedDishesSection: React.FC<RecommendedDishesSectionProps> = ({
  menuItems,
  previousOrders,
  categories,
  customerName,
  vegOnly = false,
  nonVegOnly = false,
  eggOnly = false,
  activeCategory = 'all',
  onSelectItemDetail,
}) => {
  const { getItemQuantity, addItem, updateQuantity } = useCart();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Compute personalized recommendations based on previous orders
  const { recommendations, subtitleText, hasPreviousOrders } = useMemo(() => {
    // 1. Gather all previously ordered items & category frequencies
    const orderedItemIdCounts = new Map<string, number>();
    const orderedItemNames = new Set<string>();
    const orderedCategoryCounts = new Map<string, number>();

    previousOrders.forEach((order) => {
      (order.items || []).forEach((orderItem) => {
        const id = orderItem.menuItemId;
        orderedItemIdCounts.set(id, (orderedItemIdCounts.get(id) || 0) + orderItem.quantity);
        orderedItemNames.add(orderItem.name.toLowerCase());

        // Find corresponding menu item to get category
        const matched = menuItems.find((m) => m.id === id || m.name.toLowerCase() === orderItem.name.toLowerCase());
        if (matched?.category) {
          orderedCategoryCounts.set(
            matched.category,
            (orderedCategoryCounts.get(matched.category) || 0) + orderItem.quantity
          );
        }
      });
    });

    const hasOrders = orderedItemIdCounts.size > 0;

    // Find customer's top favored categories
    let topCategory = '';
    let topCategoryCount = 0;
    orderedCategoryCounts.forEach((count, cat) => {
      if (count > topCategoryCount) {
        topCategoryCount = count;
        topCategory = cat;
      }
    });

    // Complementary category pairings dictionary
    const complementaryMap: Record<string, { categories: string[]; label: string }> = {
      thali: { categories: ['coffee', 'bakery', 'chinese', 'continental'], label: 'Pairs with your Thali' },
      coffee: { categories: ['bakery', 'burgers', 'chinese', 'thali'], label: 'Pairs with your Coffee' },
      bakery: { categories: ['coffee', 'beverages', 'continental'], label: 'Pairs with your Desserts' },
      burgers: { categories: ['coffee', 'bakery', 'continental'], label: 'Pairs with your Bites' },
      chinese: { categories: ['coffee', 'continental', 'bakery'], label: 'Pairs with your Quick Bites' },
      continental: { categories: ['bakery', 'coffee'], label: 'Pairs with Continental' },
    };

    const complementary = topCategory ? complementaryMap[topCategory] : null;

    // 2. Score candidate items
    const scoredList: RecommendedItem[] = [];

    menuItems.forEach((item) => {
      // Must be available
      if (!item.isAvailable) return;

      // Filter by dietary choice
      if (vegOnly && !item.isVeg) return;
      if (nonVegOnly && item.isVeg) return;
      if (eggOnly && !item.isEgg) return;

      let score = 0;
      let reason = "Chef's Recommendation";
      let badgeType: RecommendedItem['badgeType'] = 'bestseller';

      const orderCount = orderedItemIdCounts.get(item.id) || 0;

      if (hasOrders) {
        if (orderCount > 0) {
          // Reorder favorite
          score += 60 + orderCount * 10;
          reason = orderCount > 1 ? `Ordered ${orderCount} times by you` : 'Your previous favorite';
          badgeType = 'reorder';
        } else if (item.category === topCategory) {
          // In customer's favorite category
          score += 35;
          const catObj = categories.find((c) => c.slug === topCategory);
          reason = `Because you enjoy ${catObj?.name || 'this category'}`;
          badgeType = 'taste_profile';
        } else if (complementary && complementary.categories.includes(item.category)) {
          // Complementary pairing
          score += 30;
          reason = complementary.label;
          badgeType = 'pairing';
        } else {
          score += 10;
          reason = 'Recommended pairing';
          badgeType = 'taste_profile';
        }
      } else {
        // Fallback for new visitors or guests: curate top rated bestsellers
        score += 20;
        if (item.isBestseller) {
          score += 25;
          reason = 'Most Loved';
          badgeType = 'bestseller';
        }
      }

      // Add rating & review boost
      score += (item.rating || 4.5) * 6;
      if (item.isBestseller) score += 10;

      // Category boost if user is browsing a specific category
      if (activeCategory !== 'all' && item.category === activeCategory) {
        score += 20;
      }

      scoredList.push({
        item,
        reason,
        badgeType,
        score,
      });
    });

    // Sort descending by score
    scoredList.sort((a, b) => b.score - a.score);

    // Limit to top 8 recommendations for a clean, non-overwhelming row
    const topRecs = scoredList.slice(0, 8);

    let subText = 'Handcrafted favorites tailored to your palate & previous orders.';
    if (hasOrders) {
      const topCatName = categories.find((c) => c.slug === topCategory)?.name;
      subText = topCatName
        ? `Curated based on your love for ${topCatName} & recent orders.`
        : 'Curated dishes based on what you previously enjoyed at OTT.';
    } else {
      subText = 'Popular signature dishes • Place an order to unlock personalized recommendations!';
    }

    return {
      recommendations: topRecs,
      subtitleText: subText,
      hasPreviousOrders: hasOrders,
    };
  }, [menuItems, previousOrders, categories, vegOnly, nonVegOnly, activeCategory]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <section
      id="recommended-dishes-section"
      aria-label="Recommended Dishes"
      className="mb-8 p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-500/8 via-rose-500/5 to-transparent dark:from-amber-500/10 dark:via-rose-950/20 dark:to-stone-900/40 border border-amber-300/40 dark:border-amber-500/20 relative overflow-hidden"
    >
      {/* Subtle Background Glow Accent */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-400/15 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 text-[11px] font-extrabold uppercase tracking-wide border border-amber-400/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-amber-500" />
              {hasPreviousOrders ? 'Personalized For You' : 'Chef Curated'}
            </span>

            {hasPreviousOrders && customerName && (
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                for {customerName.split(' ')[0]}
              </span>
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100 mt-1">
            Recommended Dishes
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 line-clamp-1 mt-0.5">
            {subtitleText}
          </p>
        </div>

        {/* Carousel Scroll Controls */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => scroll('left')}
            aria-label="Scroll recommended items left"
            className="w-8 h-8 rounded-full bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label="Scroll recommended items right"
            className="w-8 h-8 rounded-full bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-2 pt-1 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-stone-300 dark:scrollbar-thumb-stone-700 -mx-1 px-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {recommendations.map(({ item, reason, badgeType }) => {
          const quantity = getItemQuantity(item.id);

          return (
            <div
              key={`rec-${item.id}`}
              className="snap-start shrink-0 w-[240px] sm:w-[260px] rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-amber-400/80 dark:hover:border-amber-500/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Image Banner */}
              <div
                onClick={() => onSelectItemDetail(item)}
                className="relative h-32 sm:h-34 w-full bg-stone-100 dark:bg-stone-800 overflow-hidden cursor-pointer"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Veg / Non-Veg / Egg Indicator */}
                <div className="absolute top-2.5 left-2.5 z-10 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xs p-1 rounded-md shadow-xs">
                  <span
                    className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center ${
                      item.isEgg ? 'border-amber-600' : item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.isEgg ? 'bg-amber-600' : item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    />
                  </span>
                </div>

                {/* Contextual Recommendation Badge */}
                <div className="absolute top-2.5 right-2.5 z-10">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs backdrop-blur-sm ${
                      badgeType === 'reorder'
                        ? 'bg-rose-600 text-white'
                        : badgeType === 'pairing'
                        ? 'bg-amber-600 text-white'
                        : badgeType === 'taste_profile'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-emerald-700 text-white'
                    }`}
                  >
                    {badgeType === 'reorder' && <RotateCw className="w-2.5 h-2.5 animate-spin-slow" />}
                    {badgeType === 'pairing' && <Sparkles className="w-2.5 h-2.5 fill-current" />}
                    {badgeType === 'taste_profile' && <Heart className="w-2.5 h-2.5 fill-current" />}
                    {badgeType === 'bestseller' && <Flame className="w-2.5 h-2.5 fill-current" />}
                    <span className="truncate max-w-[130px]">{reason}</span>
                  </span>
                </div>

                {/* Rating overlay */}
                <div className="absolute bottom-2 left-2.5 z-10 flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white backdrop-blur-xs">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>{item.rating.toFixed(1)}</span>
                  <span className="text-[10px] text-stone-300 font-normal">({item.reviewsCount})</span>
                </div>

                {item.preparationTimeMinutes && (
                  <div className="absolute bottom-2 right-2.5 z-10 flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/70 text-white backdrop-blur-xs">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{item.preparationTimeMinutes}m</span>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
                <div
                  onClick={() => onSelectItemDetail(item)}
                  className="cursor-pointer"
                >
                  <h4
                    className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-1"
                    title={item.name}
                  >
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Price & Action Row */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-stone-100 dark:border-stone-800">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-serif font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                      ₹{item.price}
                    </span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-[11px] text-stone-400 line-through">
                        ₹{item.originalPrice}
                      </span>
                    )}
                  </div>

                  {/* Quantity Controller / Add Button */}
                  {quantity === 0 ? (
                    <button
                      id={`rec-add-btn-${item.id}`}
                      onClick={() => addItem(item)}
                      className="px-3 py-1 bg-gradient-to-r from-candy-cherry-500 to-amber-500 hover:from-candy-cherry-600 hover:to-amber-600 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Add</span>
                    </button>
                  ) : (
                    <div className="flex items-center bg-gradient-to-r from-candy-cherry-500 to-amber-500 text-white rounded-lg px-1 py-0.5 font-bold text-xs shadow-xs">
                      <button
                        onClick={() => updateQuantity(item.id, quantity - 1)}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 active:scale-90 cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-xs px-1.5">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, quantity + 1)}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 active:scale-90 cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
