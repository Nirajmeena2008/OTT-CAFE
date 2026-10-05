import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Cake,
  Upload,
  Image as ImageIcon,
  Calendar,
  Clock,
  Sparkles,
  Heart,
  Check,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Store,
  Phone,
  User,
  Mail,
  AlertCircle,
  HelpCircle,
  Camera,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { Order, CustomCakeDetails } from '../types';
import { toLocalDateString } from '../utils/date';

interface CustomCakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderSuccess?: (order: Order) => void;
  onOrderPlaced?: (order: Order) => void;
  initialReferenceImage?: string;
  initialFlavor?: string;
}

// Popular reference cake gallery images for quick inspiration
const INSPIRATION_GALLERY = [
  {
    title: 'Vintage Lambeth & Cherries',
    flavor: 'Belgian Dark Chocolate Truffle',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
    tag: 'Trending',
  },
  {
    title: 'Pastel Floral Watercolor',
    flavor: 'Red Velvet with Cream Cheese',
    image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=600&q=80',
    tag: 'Anniversary & Birthday',
  },
  {
    title: 'Royal Chocolate Ganache Drip',
    flavor: 'Ferrero Rocher & Roasted Hazelnut',
    image: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=600&q=80',
    tag: 'Chocoholic Favorite',
  },
  {
    title: 'Fresh Berry Forest Gateau',
    flavor: 'Fresh Alphonso Mango & Sweet Cream',
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=600&q=80',
    tag: 'Fresh Fruit',
  },
  {
    title: 'Minimalist Korean Bento / Palette',
    flavor: 'Lotus Biscoff Caramel Crunch',
    image: 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&w=600&q=80',
    tag: 'Aesthetic & Clean',
  },
  {
    title: 'Saffron Pistachio Fusion',
    flavor: 'Signature Rasmalai Saffron & Pistachio',
    image: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=600&q=80',
    tag: 'OTT Signature Fusion',
  },
];

const FLAVOR_OPTIONS = [
  { id: 'belgian_chocolate', name: 'Belgian Dark Chocolate Truffle', desc: '70% pure dark cocoa ganache' },
  { id: 'red_velvet', name: 'Red Velvet with Cream Cheese', desc: 'Velvety sponge with cream cheese frosting' },
  { id: 'rasmalai_saffron', name: 'Signature Rasmalai Saffron & Pistachio', desc: 'Infused with cardamom milk and saffron' },
  { id: 'fresh_fruit', name: 'Fresh Seasonal Fruit & Sweet Cream', desc: 'Loaded with kiwi, grapes, and berries' },
  { id: 'lotus_biscoff', name: 'Lotus Biscoff Caramel Crunch', desc: 'Speculoos cookie butter buttercream' },
  { id: 'ferrero_rocher', name: 'Ferrero Rocher & Roasted Hazelnut', desc: 'Nutella mousse and crispy wafer crunch' },
  { id: 'black_forest', name: 'Classic Black Forest with Cherries', desc: 'Whipped cream and Italian sour cherries' },
  { id: 'butterscotch', name: 'Butterscotch Praline Crunch', desc: 'Caramelized cashew praline and cream' },
  { id: 'vanilla_strawberry', name: 'Madagascar Vanilla & Strawberry', desc: 'Pure vanilla bean with fruit compote' },
  { id: 'custom_flavor', name: 'Custom Blend / Specific Request', desc: 'Specify your custom flavor in design notes' },
];

// Customers in some regions prefer kg, so that's the headline unit on the size cards; lb
// stays printed underneath in small type.
const WEIGHT_OPTIONS = [
  { weightKg: 0.5, label: '0.5 kg', lbLabel: '1.1 lb', serves: '4–5 Servings', basePrice: 550 },
  { weightKg: 1.0, label: '1.0 kg', lbLabel: '2.2 lb', serves: '8–10 Servings (Most Popular)', basePrice: 950 },
  { weightKg: 1.5, label: '1.5 kg', lbLabel: '3.3 lb', serves: '12–15 Servings', basePrice: 1400 },
  { weightKg: 2.0, label: '2.0 kg', lbLabel: '4.4 lb', serves: '18–20 Servings', basePrice: 1800 },
  { weightKg: 3.0, label: '3.0 kg+', lbLabel: '6.6 lb+', serves: '25+ Servings (Tiered Party Cake)', basePrice: 2700 },
];

const OCCASIONS = [
  'Birthday Celebration',
  'Wedding & Reception',
  'Anniversary',
  'Baby Shower / Gender Reveal',
  'Farewell & Graduation',
  'Festive / Corporate Party',
  'House Party & Special Milestone',
];

const SHAPES = ['Classic Round', 'Romantic Heart', 'Modern Square', '2-Tier Stacked', 'Custom Number / Shape'];

const TIME_SLOTS = [
  'Morning Slot (10:00 AM – 1:00 PM)',
  'Afternoon Slot (1:00 PM – 5:00 PM)',
  'Evening Prime (5:00 PM – 8:30 PM)',
  'Late Night Celebration (8:30 PM – 10:30 PM)',
];

// Extracts a slot's END time (e.g. "8:30 PM" from "...(5:00 PM – 8:30 PM)") as
// minutes-since-midnight, so a same-day pre-order can hide windows that have fully passed.
const slotEndMinutes = (slot: string): number => {
  const matches = [...slot.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)];
  const last = matches[matches.length - 1];
  if (!last) return Infinity;
  let hours = parseInt(last[1], 10) % 12;
  if (last[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + parseInt(last[2], 10);
};

export const CustomCakeModal: React.FC<CustomCakeModalProps> = ({
  isOpen,
  onClose,
  onOrderSuccess,
  onOrderPlaced,
  initialReferenceImage,
  initialFlavor,
}) => {
  const { customer, customerToken, isAuthenticated } = useAuth();

  // Helper to format default tomorrow date (YYYY-MM-DD), in local time -- see utils/date.ts.
  const tomorrowStr = React.useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toLocalDateString(tomorrow);
  }, []);

  // Form State
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0]);
  const [flavor, setFlavor] = useState<string>(initialFlavor || FLAVOR_OPTIONS[0].name);
  const [weightKg, setWeightKg] = useState<number>(1.0);
  const [shape, setShape] = useState<string>(SHAPES[0]);
  const [isEggless, setIsEggless] = useState<boolean>(true);
  const [messageOnCake, setMessageOnCake] = useState<string>('');
  const [designDescription, setDesignDescription] = useState<string>('');
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>(initialReferenceImage || '');

  React.useEffect(() => {
    if (initialReferenceImage) {
      setReferenceImageUrl(initialReferenceImage);
    }
    if (initialFlavor) {
      setFlavor(initialFlavor);
    }
  }, [initialReferenceImage, initialFlavor, isOpen]);
  const [targetDate, setTargetDate] = useState<string>(tomorrowStr);
  const [targetTime, setTargetTime] = useState<string>(TIME_SLOTS[2]);
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');

  // Hide pre-order windows that have already fully ended when the target date is today --
  // otherwise nothing stopped choosing e.g. "Morning Slot (10:00 AM - 1:00 PM)" at 9pm tonight.
  const isTargetDateToday = targetDate === toLocalDateString(new Date());
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const availableCakeSlots = isTargetDateToday
    ? TIME_SLOTS.filter((slot) => slotEndMinutes(slot) > nowMinutes)
    : TIME_SLOTS;

  React.useEffect(() => {
    if (!availableCakeSlots.includes(targetTime)) {
      setTargetTime(availableCakeSlots[0] || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  // Customer Contact
  const [customerName, setCustomerName] = useState<string>(customer?.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(customer?.phone || '');
  const [customerEmail, setCustomerEmail] = useState<string>(customer?.email || '');

  // Add-ons
  const [includeCandlesKnife, setIncludeCandlesKnife] = useState<boolean>(true);
  const [includeSparklerCandle, setIncludeSparklerCandle] = useState<boolean>(false);
  const [includeAcrylicTopper, setIncludeAcrylicTopper] = useState<boolean>(false);

  // UI state
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Base price calculation
  const selectedWeightObj = WEIGHT_OPTIONS.find((w) => w.weightKg === weightKg) || WEIGHT_OPTIONS[1];
  const addonsTotal = (includeSparklerCandle ? 50 : 0) + (includeAcrylicTopper ? 80 : 0);
  const estimatedSubtotal = selectedWeightObj.basePrice + addonsTotal;
  const estimatedDeliveryFee = fulfillmentType === 'delivery' ? (estimatedSubtotal >= 499 ? 0 : 40) : 0;
  const estimatedTax = Math.round(estimatedSubtotal * 0.05 * 100) / 100;
  const estimatedTotal = Math.round((estimatedSubtotal + estimatedDeliveryFee + estimatedTax) * 100) / 100;

  // Handle local image file upload & convert to Data URL
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image file is too large. Please select an image under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReferenceImageUrl(reader.result);
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectInspiration = (item: (typeof INSPIRATION_GALLERY)[0]) => {
    setReferenceImageUrl(item.image);
    setFlavor(item.flavor);
    if (!designDescription) {
      setDesignDescription(`Theme inspired by "${item.title}". Elegant artisanal finish with clean borders and premium palette.`);
    }
  };

  // Submit Order to Server
  const handleSubmitCustomCake = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validations
    if (!targetTime) {
      setErrorMessage('Please select a pre-order time slot -- all slots for today have already passed, pick another date above.');
      return;
    }
    if (!customerName.trim()) {
      setErrorMessage('Please provide your full name for the order confirmation.');
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit phone number so our baker can coordinate design proofs.');
      return;
    }
    if (fulfillmentType === 'delivery' && (!deliveryAddress || deliveryAddress.trim().length < 5)) {
      setErrorMessage('Please provide a complete delivery address with landmark (min 5 characters).');
      return;
    }
    if (!designDescription.trim() && !referenceImageUrl) {
      setErrorMessage('Please provide either a design description or an image reference for your custom cake.');
      return;
    }

    try {
      setIsSubmitting(true);

      const customCakeDetails: CustomCakeDetails = {
        itemType: 'custom_cake',
        occasion,
        flavor,
        weightKg,
        shape,
        isEggless,
        messageOnCake: messageOnCake.trim() || undefined,
        designDescription: designDescription.trim() || `Custom ${flavor} celebration cake for ${occasion}`,
        referenceImageUrl: referenceImageUrl || undefined,
        targetDate,
        targetTime,
        specialInstructions: [
          includeCandlesKnife ? 'Complimentary candles & knife required' : '',
          includeSparklerCandle ? 'Add sparkling celebration fountain candle (+₹50)' : '',
          includeAcrylicTopper ? `Add gold acrylic celebration topper (+₹80)` : '',
        ]
          .filter(Boolean)
          .join(', '),
        estimatedPriceQuote: estimatedTotal,
        // Sent as flags so the server can price the extras itself (it ignores client prices).
        addSparklerCandle: includeSparklerCandle,
        addAcrylicTopper: includeAcrylicTopper,
      };

      const customCakeItem = {
        menuItemId: 'custom-cake-preorder',
        name: `Made-to-Order Cake: ${occasion} (${weightKg}kg ${flavor})`,
        price: estimatedSubtotal,
        quantity: 1,
        isVeg: isEggless,
        image: referenceImageUrl || INSPIRATION_GALLERY[0].image,
      };

      const payload = {
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        customerEmail: customerEmail.trim() || undefined,
        orderType: fulfillmentType,
        deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress.trim() : undefined,
        items: [customCakeItem],
        paymentMethod: 'upi',
        isCustomCake: true,
        customCakeDetails,
        specialInstructions: `[CUSTOM BAKERY PRE-ORDER] Event Date: ${targetDate}, Slot: ${targetTime}. Occasion: ${occasion}. Message on cake: "${messageOnCake}". Notes: ${designDescription}`,
      };

      const createdOrder = await api.createOrder(payload, customerToken || undefined);
      if (onOrderSuccess) onOrderSuccess(createdOrder);
      if (onOrderPlaced) onOrderPlaced(createdOrder);
      onClose();
    } catch (err: any) {
      console.error('Failed to submit custom cake order:', err);
      setErrorMessage(err.message || 'Unable to place custom cake request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="custom-cake-modal-backdrop"
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/75 backdrop-blur-xs text-stone-900 dark:text-stone-100"
    >
      <div className="relative w-full max-w-3xl rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header with Luxury Cafe Bakery Banner */}
        <div className="relative bg-gradient-to-r from-candy-cherry-700 via-candy-cherry-800 to-stone-900 dark:from-candy-cherry-950 dark:via-stone-900 dark:to-stone-950 p-5 sm:p-6 text-white shrink-0 border-b border-candy-cherry-500/30 dark:border-stone-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/25 shadow-md">
                <Cake className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 shadow-2xs">
                    Artisan Bakery Studio
                  </span>
                  <span className="text-[10px] text-amber-200 hidden xs:inline">
                    • Out of the Town Kukas
                  </span>
                </div>
                <h2 className="text-lg sm:text-2xl font-serif font-extrabold tracking-tight mt-0.5 drop-shadow-xs">
                  Made-to-Order Custom Cake &amp; Bakery
                </h2>
                <p className="text-xs text-amber-100 dark:text-amber-200/90 hidden sm:block">
                  Upload your dream cake reference image, choose handcrafted flavors, and celebrate in style.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-black/20 hover:bg-black/40 text-white/90 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Close Custom Cake Order Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper tabs */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 mt-4 pt-3 border-t border-white/20 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className={`flex-1 min-w-0 py-1.5 px-1.5 sm:px-2 rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                activeStep === 1
                  ? 'bg-white text-stone-900 shadow-sm font-bold'
                  : 'text-amber-100/90 hover:bg-white/10'
              }`}
            >
              <span className="w-4 h-4 shrink-0 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
              <span className="truncate min-w-0">Cake &amp; Flavor</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className={`flex-1 min-w-0 py-1.5 px-1.5 sm:px-2 rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                activeStep === 2
                  ? 'bg-white text-stone-900 shadow-sm font-bold'
                  : 'text-amber-100/90 hover:bg-white/10'
              }`}
            >
              <span className="w-4 h-4 shrink-0 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
              <span className="truncate min-w-0">Photo &amp; Design Notes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className={`flex-1 min-w-0 py-1.5 px-1.5 sm:px-2 rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                activeStep === 3
                  ? 'bg-white text-stone-900 shadow-sm font-bold'
                  : 'text-amber-100/90 hover:bg-white/10'
              }`}
            >
              <span className="w-4 h-4 shrink-0 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">3</span>
              <span className="truncate min-w-0">Delivery &amp; Quote</span>
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmitCustomCake} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 1: CAKE FLAVOR, WEIGHT, OCCASION & DIETARY */}
          {/* ============================================================== */}
          {activeStep === 1 && (
            <div className="space-y-5 animate-fadeIn">
              {/* Occasion Selection */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-2">
                  1. Select Celebration Occasion
                </label>
                <div className="flex flex-wrap gap-2">
                  {OCCASIONS.map((occ) => (
                    <button
                      key={occ}
                      type="button"
                      onClick={() => setOccasion(occ)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        occasion === occ
                          ? 'bg-candy-cherry-600 text-white border-candy-cherry-600 shadow-xs scale-102'
                          : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {occ}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weight & Servings */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                    2. Select Cake Size &amp; Weight
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                    Starting ₹{selectedWeightObj.basePrice}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {WEIGHT_OPTIONS.map((w) => (
                    <button
                      key={w.weightKg}
                      type="button"
                      onClick={() => setWeightKg(w.weightKg)}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        weightKg === w.weightKg
                          ? 'bg-candy-cherry-50 dark:bg-candy-cherry-950/30 border-candy-cherry-500 shadow-sm ring-1 ring-candy-cherry-500'
                          : 'bg-stone-50 dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 hover:border-stone-400'
                      }`}
                    >
                      <div>
                        <span className="font-serif font-black text-sm text-stone-900 dark:text-stone-100 block">
                          {w.label}
                        </span>
                        <span className="text-[9px] text-stone-400 dark:text-stone-500 block">
                          {w.lbLabel}
                        </span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block mt-0.5">
                          {w.serves}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-extrabold text-amber-600 dark:text-amber-400 mt-2">
                        ₹{w.basePrice}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dietary Toggle & Shape */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 100% Eggless Switch */}
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-sm border border-emerald-600 flex items-center justify-center p-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      </span>
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                        100% Eggless (Pure Veg)
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      Baked fresh in our dedicated vegetarian patisserie
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEggless}
                    onClick={() => setIsEggless(!isEggless)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      isEggless ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ${
                        isEggless ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Cake Shape */}
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1.5">
                    Cake Silhouette / Shape
                  </label>
                  <select
                    value={shape}
                    onChange={(e) => setShape(e.target.value)}
                    className="w-full text-xs font-medium rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-3 py-2 text-stone-800 dark:text-stone-200 focus:outline-hidden focus:ring-2 focus:ring-candy-cherry-500"
                  >
                    {SHAPES.map((sh) => (
                      <option key={sh} value={sh}>
                        {sh}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Handcrafted Flavors */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-2">
                  3. Select Flavor Profile
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {FLAVOR_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFlavor(f.name)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        flavor === f.name
                          ? 'bg-candy-cherry-50 dark:bg-candy-cherry-950/30 border-candy-cherry-500 shadow-sm ring-1 ring-candy-cherry-500'
                          : 'bg-stone-50 dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-stone-900 dark:text-stone-100">{f.name}</p>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">{f.desc}</p>
                      </div>
                      {flavor === f.name && (
                        <div className="w-5 h-5 rounded-full bg-candy-cherry-600 text-white flex items-center justify-center shrink-0 ml-2">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 1 Next Button */}
              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-candy-cherry-500 to-amber-500 hover:from-candy-cherry-600 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all hover:scale-102"
                >
                  <span>Next: Photo &amp; Design Notes</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 2: REFERENCE PHOTO UPLOAD & DESIGN DESCRIPTION */}
          {/* ============================================================== */}
          {activeStep === 2 && (
            <div className="space-y-5 animate-fadeIn">
              {/* Reference Photo Upload Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-candy-cherry-600" />
                    <span>Upload Reference Image of Your Cake (Recommended)</span>
                  </label>
                  <span className="text-[11px] text-stone-400">JPG, PNG, WebP up to 5MB</span>
                </div>

                {referenceImageUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-candy-cherry-500 bg-stone-950 p-2 flex items-center gap-4">
                    <img
                      src={referenceImageUrl}
                      alt="Reference cake design"
                      referrerPolicy="no-referrer"
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border border-white/20 shadow-md shrink-0"
                    />
                    <div className="flex-1 text-white pr-2">
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-1">
                        <Check className="w-4 h-4" />
                        <span>Reference Image Attached</span>
                      </div>
                      <p className="text-[11px] text-stone-300 line-clamp-2">
                        Our master baker will recreate this style according to your selected weight and flavor.
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          Change Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => setReferenceImageUrl('')}
                          className="px-3 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-candy-cherry-500 dark:hover:border-candy-cherry-500 rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all bg-stone-50/50 dark:bg-stone-800/40 hover:bg-candy-cherry-50/40 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-candy-cherry-100 dark:bg-candy-cherry-950/60 text-candy-cherry-600 dark:text-candy-cherry-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Click to upload cake reference photo or drag and drop
                    </p>
                    <p className="text-[11px] text-stone-400 mt-1 max-w-sm mx-auto">
                      Found an inspiration photo on Instagram or Pinterest? Upload it here and our pastry chef will recreate it for your party!
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileUpload}
                  className="hidden"
                />
              </div>

              {/* Inspiration Gallery Picker */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-2">
                  Or Pick from Out of the Town Popular Design Themes
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {INSPIRATION_GALLERY.map((gal) => (
                    <button
                      key={gal.title}
                      type="button"
                      onClick={() => handleSelectInspiration(gal)}
                      className={`relative rounded-2xl overflow-hidden border text-left group cursor-pointer transition-all ${
                        referenceImageUrl === gal.image
                          ? 'border-candy-cherry-500 ring-2 ring-candy-cherry-500 shadow-md'
                          : 'border-stone-200 dark:border-stone-700 hover:border-candy-cherry-400'
                      }`}
                    >
                      <div className="relative h-24 sm:h-28 w-full overflow-hidden bg-stone-900">
                        <img
                          src={gal.image}
                          alt={gal.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                        <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-amber-300">
                          {gal.tag}
                        </span>
                        {referenceImageUrl === gal.image && (
                          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-candy-cherry-500 text-white flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                        <p className="absolute bottom-2 left-2 right-2 text-[11px] font-bold text-white line-clamp-1">
                          {gal.title}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Design Description Input */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5">
                  Detailed Design Description &amp; Custom Requests
                </label>
                <textarea
                  rows={3}
                  value={designDescription}
                  onChange={(e) => setDesignDescription(e.target.value)}
                  placeholder="Describe colors (e.g. pastel lilac and gold leaf), frosting style (vintage Lambeth, semi-naked, fresh floral drip), toppers, figurine ideas, or special dietary notes..."
                  className="w-full text-xs rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-3 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-candy-cherry-500 leading-relaxed"
                />

                {/* Call the Restaurant Directly Button */}
                <div className="mt-2.5 p-3 rounded-xl bg-candy-cherry-50/90 dark:bg-stone-800/90 border border-candy-cherry-200 dark:border-stone-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-candy-cherry-500 text-white flex items-center justify-center shrink-0">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                        Prefer to discuss your cake directly?
                      </p>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400">
                        Call our bakery kitchen to discuss custom artwork, tiers or urgent orders.
                      </p>
                    </div>
                  </div>
                  <a
                    id="call-restaurant-cake-btn"
                    href="tel:+919828919626"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all shrink-0 cursor-pointer active:scale-98"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Call Restaurant (+91 98289 19626)</span>
                  </a>
                </div>
              </div>

              {/* Message on Cake */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5">
                  Message to Pipe on Cake / Board
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={100}
                    value={messageOnCake}
                    onChange={(e) => setMessageOnCake(e.target.value)}
                    placeholder='e.g. "Happy 25th Birthday Rhea! ❤️" or "Forever & Always Rahul & Tanya"'
                    className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 pl-3.5 pr-14 py-2.5 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-candy-cherry-500 font-medium"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 font-mono bg-stone-50 dark:bg-stone-800 pl-1">
                    {messageOnCake.length}/100
                  </span>
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-candy-cherry-500 to-amber-500 hover:from-candy-cherry-600 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all hover:scale-102"
                >
                  <span>Next: Delivery &amp; Quote</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 3: FULFILLMENT, CONTACT & ESTIMATED QUOTATION */}
          {/* ============================================================== */}
          {activeStep === 3 && (
            <div className="space-y-5 animate-fadeIn">
              {/* Event Timing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5">
                    Target Event / Pre-Order Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      min={toLocalDateString(new Date())}
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full text-xs font-medium rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3.5 py-2.5 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-candy-cherry-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5">
                    Preferred Time Slot
                  </label>
                  <select
                    value={targetTime}
                    onChange={(e) => setTargetTime(e.target.value)}
                    disabled={availableCakeSlots.length === 0}
                    className="w-full text-xs font-medium rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3.5 py-2.5 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-candy-cherry-500 disabled:opacity-60"
                  >
                    {availableCakeSlots.length === 0 && <option value="">No slots left today</option>}
                    {availableCakeSlots.map((ts) => (
                      <option key={ts} value={ts}>
                        {ts}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fulfillment Type */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-2">
                  Fulfillment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('delivery')}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      fulfillmentType === 'delivery'
                        ? 'bg-candy-cherry-50 dark:bg-candy-cherry-950/30 border-candy-cherry-500 shadow-sm ring-1 ring-candy-cherry-500'
                        : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-candy-cherry-500 text-white flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-900 dark:text-stone-100">Doorstep Delivery</p>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400">Jaipur &amp; Kukas Hotel / Home</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFulfillmentType('pickup')}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      fulfillmentType === 'pickup'
                        ? 'bg-candy-cherry-50 dark:bg-candy-cherry-950/30 border-candy-cherry-500 shadow-sm ring-1 ring-candy-cherry-500'
                        : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-stone-700 text-white flex items-center justify-center shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-900 dark:text-stone-100">Storefront Pickup</p>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400">OTT Restro, Kukas (NH-48)</p>
                    </div>
                  </button>
                </div>

                {fulfillmentType === 'delivery' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Enter delivery venue, hotel name, room number or complete address..."
                      className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3.5 py-2.5 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-candy-cherry-500"
                    />
                  </div>
                )}
              </div>

              {/* Customer Contact Information */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  Customer Contact (For WhatsApp Proof &amp; Coordination)
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Your Name"
                        className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 pl-8 pr-3 py-2 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-candy-cherry-500"
                        required
                      />
                      <User className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                      Mobile Number (WhatsApp) *
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="10-digit mobile number"
                        className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 pl-8 pr-3 py-2 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-candy-cherry-500 font-mono"
                        required
                      />
                      <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    Email Address (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="For invoice and order receipt"
                      className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 pl-8 pr-3 py-2 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-candy-cherry-500"
                    />
                    <Mail className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>

              {/* Add-ons Checklist */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block">
                  Celebration Extras
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCandlesKnife}
                      onChange={(e) => setIncludeCandlesKnife(e.target.checked)}
                      className="rounded-sm text-amber-600"
                    />
                    <span>Candles &amp; Knife (Free)</span>
                  </label>

                  <label className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSparklerCandle}
                      onChange={(e) => setIncludeSparklerCandle(e.target.checked)}
                      className="rounded-sm text-amber-600"
                    />
                    <span>Sparkler Candle (+₹50)</span>
                  </label>

                  <label className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeAcrylicTopper}
                      onChange={(e) => setIncludeAcrylicTopper(e.target.checked)}
                      className="rounded-sm text-amber-600"
                    />
                    <span>Acrylic Topper (+₹80)</span>
                  </label>
                </div>
              </div>

              {/* Live Quotation Summary Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-candy-cherry-500/10 via-candy-cherry-500/5 to-transparent border border-candy-cherry-300/80 dark:border-candy-cherry-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-600 dark:text-stone-400">
                    Base Price ({selectedWeightObj.label}
                    <span className="text-[9px] text-stone-400 dark:text-stone-500"> / {selectedWeightObj.lbLabel}</span>
                    {' '}• {flavor}):
                  </span>
                  <span className="font-mono font-bold">₹{selectedWeightObj.basePrice}</span>
                </div>
                {addonsTotal > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600 dark:text-stone-400">Celebration Add-ons:</span>
                    <span className="font-mono font-bold">+₹{addonsTotal}</span>
                  </div>
                )}
                {estimatedDeliveryFee > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600 dark:text-stone-400">Doorstep Delivery:</span>
                    <span className="font-mono font-bold">+₹{estimatedDeliveryFee}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-600 dark:text-stone-400">GST (5% Restaurant Tax):</span>
                  <span className="font-mono font-bold">+₹{estimatedTax}</span>
                </div>
                <div className="pt-2 border-t border-candy-cherry-200 dark:border-candy-cherry-800 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-stone-900 dark:text-stone-100 block">
                      Estimated Pre-Order Total
                    </span>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400">
                      Master baker will review &amp; confirm exact quote
                    </span>
                  </div>
                  <span className="text-lg font-serif font-black text-candy-cherry-600 dark:text-candy-cherry-400 font-mono">
                    ₹{estimatedTotal}
                  </span>
                </div>
              </div>

              {/* Navigation and Submit */}
              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !targetTime}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-candy-cherry-500 to-amber-500 hover:from-candy-cherry-600 hover:to-amber-600 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-candy-cherry-600/25 cursor-pointer transition-all hover:scale-102 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span>Submitting Request...</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-200" />
                      <span>Submit Custom Cake Order</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
