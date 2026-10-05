import React, { useState } from 'react';
import {
  ArrowLeft,
  Tag,
  Sparkles,
  Copy,
  Check,
  ShoppingBag,
  Clock,
  Star,
  CheckCircle2,
  Calendar,
  UtensilsCrossed,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import type { PromoBanner, MenuItem } from '../types';
import { useCart } from '../context/CartContext';

interface OfferComboViewProps {
  banner: PromoBanner;
  allMenuItems: MenuItem[];
  onBack: () => void;
  onOpenReservation?: () => void;
  onSelectDishDetail?: (item: MenuItem) => void;
}

export const OfferComboView: React.FC<OfferComboViewProps> = ({
  banner,
  allMenuItems,
  onBack,
  onOpenReservation,
  onSelectDishDetail,
}) => {
  const { addItem, applyPromo, appliedPromo, setIsCartOpen } = useCart();
  const [copiedCode, setCopiedCode] = useState(false);
  const [comboAddedSuccess, setComboAddedSuccess] = useState(false);

  // Match combo items from allMenuItems using banner.comboItemIds
  const comboItems: MenuItem[] = React.useMemo(() => {
    if (!banner.comboItemIds || banner.comboItemIds.length === 0) {
      // Fallback: pick 2-3 popular items from targetCategory or overall
      if (banner.targetCategory && banner.targetCategory !== 'all') {
        return allMenuItems.filter((i) => i.category === banner.targetCategory).slice(0, 3);
      }
      return allMenuItems.filter((i) => i.isBestseller).slice(0, 3);
    }
    return banner.comboItemIds
      .map((id) => allMenuItems.find((item) => item.id === id))
      .filter((item): item is MenuItem => Boolean(item));
  }, [banner, allMenuItems]);

  // Calculate pricing
  const regularTotal = comboItems.reduce((sum, item) => sum + item.price, 0);

  // Compute estimated discount for this specific combo
  let estimatedDiscount = 0;
  if (banner.code === 'OTTTHALI') {
    estimatedDiscount = regularTotal >= 400 ? 100 : 50;
  } else if (banner.code === 'BAKERY25') {
    estimatedDiscount = Math.min(150, Math.round(regularTotal * 0.25));
  } else if (banner.code === 'CAMPUS30') {
    estimatedDiscount = Math.min(150, Math.round(regularTotal * 0.3));
  } else if (banner.code === 'WELCOME50') {
    estimatedDiscount = regularTotal >= 200 ? 50 : 25;
  } else {
    estimatedDiscount = Math.round(regularTotal * 0.2);
  }

  const comboDealPrice = Math.max(0, regularTotal - estimatedDiscount);

  const handleCopyAndApplyCode = () => {
    navigator.clipboard.writeText(banner.code);
    applyPromo(banner.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleAddEntireCombo = () => {
    // Add all combo items to cart
    comboItems.forEach((item) => {
      addItem(item);
    });

    // Apply the banner's promo code
    applyPromo(banner.code);

    // Show success banner and open cart
    setComboAddedSuccess(true);
    setTimeout(() => {
      setComboAddedSuccess(false);
      setIsCartOpen(true);
    }, 900);
  };

  const isCodeApplied = appliedPromo === banner.code;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-stone-200 dark:border-stone-800">
        <button
          id="back-to-menu-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Dishes</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-stone-400">
          <span>Home</span>
          <span>/</span>
          <span>Special Offers</span>
          <span>/</span>
          <span className="font-semibold text-amber-600 dark:text-amber-400 truncate max-w-[200px]">
            {banner.title}
          </span>
        </div>
      </div>

      {/* Success Notification Alert */}
      {comboAddedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-emerald-800 dark:text-emerald-200 shadow-sm animate-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1 text-xs sm:text-sm font-medium">
            <strong>All {comboItems.length} dishes added to your cart!</strong> Promo code{' '}
            <span className="font-mono font-bold uppercase">{banner.code}</span> applied successfully.
          </div>
        </div>
      )}

      {/* Hero Offer Banner Card */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl bg-stone-900 border border-stone-800">
        {/* Background Image with Balanced Warm Ambient Tone */}
        <div className="absolute inset-0">
          <img
            src={banner.imageUrl}
            alt={banner.title}
            className="w-full h-full object-cover object-center brightness-[0.76]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/35 to-transparent" />
        </div>

        {/* Content Box */}
        <div className="relative z-10 p-6 sm:p-10 md:p-12 text-white max-w-3xl space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white shadow-xs ${banner.badgeBgColor}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {banner.highlightBadge}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase px-3 py-1 rounded-full bg-amber-400 text-stone-950">
              <Tag className="w-3.5 h-3.5" />
              {banner.discountText}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-xs text-white">
              <Clock className="w-3.5 h-3.5" />
              Limited Time Offer
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-white tracking-tight">
            {banner.title}
          </h1>

          <p className="text-sm sm:text-base text-stone-200 leading-relaxed max-w-2xl">
            {banner.subtitle}
          </p>

          {banner.comboDescription && (
            <p className="text-xs sm:text-sm text-amber-200/90 italic bg-amber-950/40 p-3 rounded-xl border border-amber-500/30">
              "{banner.comboDescription}"
            </p>
          )}

          {/* Coupon Code Strip */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="inline-flex items-center gap-3 p-2 pl-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/25">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-stone-300 font-sans">Coupon Code:</span>
                <span className="font-mono font-bold text-base text-amber-300 tracking-wider">
                  {banner.code}
                </span>
              </div>
              <button
                id={`apply-code-btn-${banner.code}`}
                onClick={handleCopyAndApplyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                {copiedCode || isCodeApplied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Applied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy & Apply</span>
                  </>
                )}
              </button>
            </div>

            {isCodeApplied && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Code currently applied in cart
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Two-Column Section: Pre-selected Combo Dishes + Pricing Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Pre-selected Combo Dishes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                Pre-Selected Dishes in this Combo ({comboItems.length} Items)
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Every dish in this curated feast has been handpicked by Out of the Town chefs.
              </p>
            </div>
          </div>

          {/* Dishes List */}
          <div className="space-y-3">
            {comboItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs hover:border-amber-400/50 transition-all"
              >
                {/* Index / Badge */}
                <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                  {index + 1}
                </div>

                {/* Dish Image */}
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 cursor-pointer"
                  onClick={() => onSelectDishDetail && onSelectDishDetail(item)}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </div>

                {/* Dish Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Veg indicator */}
                    <div
                      className={`w-3.5 h-3.5 border rounded-xs p-0.5 flex items-center justify-center shrink-0 ${
                        item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      />
                    </div>
                    <h3
                      onClick={() => onSelectDishDetail && onSelectDishDetail(item)}
                      className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer truncate"
                    >
                      {item.name}
                    </h3>
                    {item.isBestseller && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded-sm uppercase">
                        Bestseller
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2">
                    {item.description}
                  </p>

                  <div className="flex items-center gap-3 pt-1 text-xs">
                    <span className="font-bold text-stone-900 dark:text-stone-100 font-mono text-sm">
                      ₹{item.price}
                    </span>
                    <span className="text-stone-400">•</span>
                    <span className="text-stone-500 font-medium capitalize">
                      {item.category}
                    </span>
                    <span className="text-stone-400">•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Included in Combo
                    </span>
                  </div>
                </div>

                {/* Individual Add Button */}
                <button
                  onClick={() => addItem(item)}
                  className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-amber-500 hover:text-amber-600 text-xs font-semibold shrink-0 cursor-pointer"
                  title="Add an extra portion of this dish"
                >
                  <span>+ Extra</span>
                </button>
              </div>
            ))}
          </div>

          {/* Offer Conditions / Terms */}
          {banner.terms && banner.terms.length > 0 && (
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 space-y-2">
              <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                Offer Terms & Highlights
              </h4>
              <ul className="space-y-1 text-xs text-stone-600 dark:text-stone-400">
                {banner.terms.map((term, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Column 3: Combo Pricing Summary & 1-Click Order Action */}
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-lg space-y-5 sticky top-24">
            <div className="space-y-1 pb-4 border-b border-stone-100 dark:border-stone-800">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                Exclusive Deal Bundle
              </span>
              <h3 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
                Combo Order Summary
              </h3>
              <p className="text-xs text-stone-500">
                {comboItems.length} signature dishes bundled together
              </p>
            </div>

            {/* Price Calculations */}
            <div className="space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between text-stone-500 dark:text-stone-400">
                <span>Total Items Price (Ala Carte)</span>
                <span className="font-mono line-through text-stone-400">₹{regularTotal}</span>
              </div>

              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  Promo Discount ({banner.code})
                </span>
                <span className="font-mono">-₹{estimatedDiscount}</span>
              </div>

              <div className="flex justify-between text-stone-500 dark:text-stone-400 text-xs">
                <span>Restaurant GST</span>
                <span>5% at checkout</span>
              </div>

              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-stone-500 block">Offer Combo Price</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Save ₹{estimatedDiscount}!
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-serif font-bold text-amber-600 dark:text-amber-400 font-mono">
                    ₹{comboDealPrice}
                  </span>
                </div>
              </div>
            </div>

            {/* Big 1-Click Order Combo Button */}
            <button
              id="order-entire-combo-btn"
              onClick={handleAddEntireCombo}
              className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-stone-950 font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>Apply {banner.code} & Add Combo (₹{comboDealPrice})</span>
            </button>

            {/* Table Reservation Alternative */}
            {onOpenReservation && (
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 text-center space-y-2">
                <p className="text-xs text-stone-500">
                  Prefer dining in at our Kukas garden patio?
                </p>
                <button
                  onClick={onOpenReservation}
                  className="w-full py-2.5 px-4 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-amber-500 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>Book a Table for this Meal</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
