import React from 'react';
import { Star, Plus, Minus, Clock, Flame } from 'lucide-react';
import type { MenuItem } from '../types';
import { useCart } from '../context/CartContext';

interface MenuItemCardProps {
  item: MenuItem;
  onOpenDetails?: (item: MenuItem) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, onOpenDetails }) => {
  const { getItemQuantity, addItem, updateQuantity } = useCart();
  const quantity = getItemQuantity(item.id);

  return (
    <div
      id={`menu-item-${item.id}`}
      className="group relative flex flex-col justify-between h-full min-h-[220px] p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-candy-cherry-400 dark:hover:border-candy-cherry-500 shadow-xs hover:shadow-xl hover:shadow-candy-cherry-500/10 hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className="flex gap-3.5 sm:gap-4 h-full">
        {/* Left Dish Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
          <div>
            {/* Dietary Badge & Bestseller Flag - Fixed height container */}
            <div className="h-5 flex items-center gap-2 mb-1.5 flex-nowrap overflow-hidden">
              {/* Veg / Non-Veg / Egg Icon */}
              <span
                title={item.isEgg ? 'Contains Egg' : item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                className={`w-4 h-4 rounded-xs border flex items-center justify-center p-0.5 shrink-0 ${
                  item.isEgg ? 'border-amber-600' : item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    item.isEgg ? 'bg-amber-600' : item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                />
              </span>

              {item.isEgg && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                  Egg
                </span>
              )}

              {item.isBestseller && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gradient-to-r from-candy-cherry-500 to-amber-500 text-white shadow-2xs shrink-0">
                  <Flame className="w-2.5 h-2.5 fill-white" />
                  Bestseller
                </span>
              )}

              {item.isVegan && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
                  Vegan
                </span>
              )}
            </div>

            {/* Dish Title - Fixed 2-line height container for uniform vertical baseline */}
            <div className="min-h-[2.5rem] flex items-center mb-1">
              <h3
                onClick={() => onOpenDetails?.(item)}
                className="text-base font-serif font-bold text-stone-900 dark:text-stone-100 group-hover:text-candy-cherry-600 dark:group-hover:text-candy-cherry-400 transition-colors line-clamp-2 cursor-pointer leading-snug"
                title={item.name}
              >
                {item.name}
              </h3>
            </div>

            {/* Rating & Reviews - Fixed height container */}
            <div className="h-5 flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-md bg-emerald-700 text-white shadow-2xs shrink-0">
                <span>{item.rating.toFixed(1)}</span>
                <Star className="w-2.5 h-2.5 fill-white" />
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium truncate">
                ({item.reviewsCount} reviews)
              </span>
              {item.preparationTimeMinutes && (
                <span className="inline-flex items-center gap-1 text-[11px] text-stone-400 font-medium shrink-0 ml-auto sm:ml-0">
                  <Clock className="w-3 h-3" />
                  {item.preparationTimeMinutes}m
                </span>
              )}
            </div>

            {/* Price & Discount - Fixed height container */}
            <div className="h-6 flex items-baseline gap-2 mb-1.5">
              <span className="text-base sm:text-lg font-bold font-mono text-stone-900 dark:text-stone-100">
                ₹{item.price}
              </span>
              {item.originalPrice && (
                <span className="text-xs sm:text-sm font-mono text-stone-400 line-through">
                  ₹{item.originalPrice}
                </span>
              )}
            </div>

            {/* Description - Fixed 2-line clamped height */}
            <div className="h-9 mb-2 overflow-hidden">
              <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed font-normal">
                {item.description}
              </p>
            </div>
          </div>

          {/* Tags - Uniform height slot so cards with or without tags maintain equal height */}
          <div className="h-6 flex items-center gap-1.5 overflow-hidden">
            {item.tags && item.tags.length > 0 ? (
              item.tags.slice(0, 2).map((tag, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-medium truncate max-w-[110px]"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-stone-400 dark:text-stone-600 italic">
                Fresh gourmet prep
              </span>
            )}
          </div>
        </div>

        {/* Right Dish Image & Fixed ADD Button */}
        <div className="relative shrink-0 flex flex-col items-center justify-start self-start pt-0.5">
          <div
            onClick={() => onOpenDetails?.(item)}
            className="w-28 sm:w-32 h-28 sm:h-32 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 cursor-pointer shadow-sm border border-stone-200/70 dark:border-stone-800"
          >
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              onError={(e) => {
                // High-quality fallback image if image link is unreachable
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80';
              }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>

          {/* Overlay ADD / Counter Button */}
          <div className="absolute -bottom-3 w-[88%] z-10">
            {!item.isAvailable ? (
              <div className="w-full py-1.5 bg-stone-300 dark:bg-stone-700 text-stone-600 dark:text-stone-400 text-xs font-bold rounded-xl text-center shadow-xs cursor-not-allowed uppercase tracking-wider">
                Sold Out
              </div>
            ) : quantity === 0 ? (
              <button
                id={`add-btn-${item.id}`}
                onClick={() => addItem(item)}
                className="w-full py-2 bg-white dark:bg-stone-900 border-2 border-candy-cherry-500 dark:border-candy-cherry-500 text-candy-cherry-600 dark:text-candy-cherry-400 hover:bg-gradient-to-r hover:from-candy-cherry-500 hover:to-amber-500 hover:text-white hover:border-transparent font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer tracking-wider"
              >
                <span>ADD</span>
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            ) : (
              <div className="w-full py-1.5 px-2 bg-gradient-to-r from-candy-cherry-500 to-amber-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-between">
                <button
                  id={`decrement-btn-${item.id}`}
                  onClick={() => updateQuantity(item.id, -1)}
                  aria-label="Decrease quantity"
                  className="w-6 h-6 flex items-center justify-center hover:bg-black/15 rounded-md transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <span className="font-mono font-bold text-sm px-1">{quantity}</span>
                <button
                  id={`increment-btn-${item.id}`}
                  onClick={() => updateQuantity(item.id, 1)}
                  aria-label="Increase quantity"
                  className="w-6 h-6 flex items-center justify-center hover:bg-black/15 rounded-md transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
