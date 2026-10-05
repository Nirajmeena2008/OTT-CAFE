import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Tag,
  ArrowRight,
  Bike,
  Store,
  Utensils,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  MapPin,
  LocateFixed,
  User,
  Phone,
  LogOut,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { Order, OrderType, PaymentMethod } from '../types';
import { HungryCartIllustration } from './HungryCartIllustration';

interface CartDrawerProps {
  onOrderSuccess: (order: Order) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onOrderSuccess }) => {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeItem,
    clearCart,
    orderType,
    setOrderType,
    promoCode,
    setPromoCode,
    appliedPromo,
    applyPromo,
    removePromo,
    subtotal,
    discount,
    deliveryFee,
    tax,
    total,
  } = useCart();

  const { customer, customerToken, isAuthenticated, requireAuth, logout } = useAuth();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');

  const [promoInput, setPromoInput] = useState('');
  const [promoMessage, setPromoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Google Maps Auto-fetch state
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Field validation error tracking for necessary fields
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    address?: string;
    tableNumber?: string;
  }>({});

  // Sync customer details when authenticated
  useEffect(() => {
    if (customer) {
      if (customer.name) setCustomerName(customer.name);
      if (customer.phone) setCustomerPhone(customer.phone);
      if (customer.email) setCustomerEmail(customer.email);
    }
  }, [customer]);

  if (!isCartOpen) return null;

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    const result = applyPromo(promoInput);
    if (result.success) {
      setPromoMessage({ type: 'success', text: result.message });
      setPromoInput('');
    } else {
      setPromoMessage({ type: 'error', text: result.message });
    }
  };

  // Auto-fetch customer address via Google Maps / Geolocation
  const handleAutoFetchAddress = () => {
    setLocationError(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please enter your address manually.');
      return;
    }

    setIsLocatingAddress(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCoords({ lat, lng });

          const res = await api.reverseGeocodeLocation(lat, lng);
          if (res && res.formattedAddress) {
            setDeliveryAddress(res.formattedAddress);
            // Clear address error
            setFieldErrors((prev) => ({ ...prev, address: undefined }));
            setOrderError(null);
          } else {
            setLocationError('Unable to resolve a street address from your GPS location. Please enter it manually.');
          }
        } catch (err: any) {
          setLocationError(err.message || 'Could not fetch address via Google Maps. Please enter manually.');
        } finally {
          setIsLocatingAddress(false);
        }
      },
      (error) => {
        setIsLocatingAddress(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Please allow location access in your browser or type address manually.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('Location information is unavailable on your device. Please enter address manually.');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Location request timed out. Please try again or type address manually.');
        } else {
          setLocationError('Failed to retrieve location. Please enter address manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const validateRequiredFields = (overrideName?: string, overridePhone?: string): boolean => {
    const effectiveName = (overrideName || customerName || customer?.name || '').trim();
    const effectivePhone = (overridePhone || customerPhone || customer?.phone || '').trim();
    const cleanPhone = effectivePhone.replace(/\D/g, '');

    const errors: { name?: string; phone?: string; address?: string; tableNumber?: string } = {};

    if (!effectiveName || effectiveName.length < 2) {
      errors.name = 'Full name is required (minimum 2 characters)';
    }

    if (!effectivePhone || cleanPhone.length < 10) {
      errors.phone = 'Valid 10-digit phone number is required';
    }

    if (orderType === 'delivery') {
      if (!deliveryAddress.trim() || deliveryAddress.trim().length < 5) {
        errors.address = 'Delivery address is required for doorstep delivery (minimum 5 characters)';
      }
    }

    if (orderType === 'dine-in') {
      if (!tableNumber.trim()) {
        errors.tableNumber = 'Table number is required for dine-in orders';
      }
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setOrderError('Please fill out all necessary required fields (Name, Phone, and Address) before placing order.');
      return false;
    }

    return true;
  };

  const executeOrderSubmission = async (overrideName?: string, overridePhone?: string, overrideEmail?: string) => {
    setOrderError(null);

    const isValid = validateRequiredFields(overrideName, overridePhone);
    if (!isValid) return;

    const effectiveName = (overrideName || customerName || customer?.name || '').trim();
    const effectivePhone = (overridePhone || customerPhone || customer?.phone || '').trim();
    const effectiveEmail = (overrideEmail || customerEmail || customer?.email || '').trim();

    try {
      setIsSubmitting(true);

      const payload = {
        customerName: effectiveName,
        customerPhone: effectivePhone,
        customerEmail: effectiveEmail || undefined,
        orderType,
        deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
        tableNumber: orderType === 'dine-in' ? tableNumber.trim() : undefined,
        items: items.map((i) => ({
          menuItemId: i.item.id,
          name: i.item.name,
          price: i.item.price,
          quantity: i.quantity,
          isVeg: i.item.isVeg,
          image: i.item.image,
        })),
        promoCode: appliedPromo || undefined,
        paymentMethod,
      };

      const order = await api.createOrder(payload, customerToken || undefined);
      clearCart();
      setIsCartOpen(false);
      onOrderSuccess(order);
    } catch (err: any) {
      setOrderError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);

    // Strictly validate required fields first before any proceeding
    const isValid = validateRequiredFields();
    if (!isValid) return;

    const effectiveName = (customerName || customer?.name || '').trim();
    const effectivePhone = (customerPhone || customer?.phone || '').trim();

    // Require customer authentication before placing order
    if (!isAuthenticated) {
      requireAuth(() => {
        executeOrderSubmission(effectiveName, effectivePhone, customerEmail.trim());
      }, 'order');
      return;
    }

    await executeOrderSubmission(effectiveName, effectivePhone, customerEmail.trim());
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-stone-900 shadow-2xl flex flex-col border-l border-stone-200 dark:border-stone-800">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
                  Your Order Cart
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {items.length} {items.length === 1 ? 'item' : 'items'} selected
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {items.length === 0 ? (
            /* Empty Cart View */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <HungryCartIllustration />
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mb-1 mt-1">
                Looks like someone's hungry!
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mb-6">
                Your cart is empty. Explore our single-origin pour-overs, artisanal sourdough bakes, and gourmet dishes.
              </p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="px-6 py-2.5 bg-gradient-to-r from-candy-cherry-500 to-amber-500 hover:from-candy-cherry-600 hover:to-amber-600 text-white font-semibold text-sm rounded-xl transition-all shadow-md cursor-pointer"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            /* Filled Cart & Checkout Form */
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
              {/* Order Type Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">
                  Order Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType('delivery')}
                    className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      orderType === 'delivery'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-600 text-amber-700 dark:text-amber-400 shadow-xs'
                        : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    <Bike className="w-4 h-4 mb-1" />
                    <span>Delivery</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType('pickup')}
                    className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      orderType === 'pickup'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-600 text-amber-700 dark:text-amber-400 shadow-xs'
                        : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    <Store className="w-4 h-4 mb-1" />
                    <span>Takeaway</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType('dine-in')}
                    className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      orderType === 'dine-in'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-600 text-amber-700 dark:text-amber-400 shadow-xs'
                        : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    <Utensils className="w-4 h-4 mb-1" />
                    <span>Dine-In</span>
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Selected Items
                  </span>
                  <button
                    onClick={clearCart}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                </div>

                <div className="divide-y divide-stone-100 dark:divide-stone-800 rounded-2xl bg-stone-50 dark:bg-stone-800 p-3 border border-stone-200 dark:border-stone-700">
                  {items.map(({ item, quantity }) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-3 h-3 rounded-xs border flex items-center justify-center shrink-0 ${
                            item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                            ₹{item.price * quantity}
                          </p>
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-mono font-bold w-4 text-center">
                          {quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Promo Code Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Have a Promo Code?
                </label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-emerald-600" />
                      <span>Code <strong>{appliedPromo}</strong> applied</span>
                    </div>
                    <button
                      onClick={removePromo}
                      className="text-rose-600 hover:text-rose-700 font-bold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyPromo} className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type="text"
                        placeholder="Try OTTTHALI, BAKERY25 or CAMPUS30"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-stone-900 dark:bg-stone-700 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 cursor-pointer"
                    >
                      Apply
                    </button>
                  </form>
                )}
                {promoMessage && (
                  <p
                    className={`text-[11px] font-medium ${
                      promoMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {promoMessage.text}
                  </p>
                )}
              </div>

              {/* Customer Delivery / Table Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    Contact & Delivery Details
                  </span>
                  <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800">
                    * Required fields
                  </span>
                </div>

                <div className="space-y-2.5">


                  {/* Full Name Field */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                        Full Name <span className="text-rose-500 font-bold">*</span>
                      </label>
                      {fieldErrors.name && (
                        <span className="text-[10px] text-rose-500 font-medium animate-pulse">
                          {fieldErrors.name}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Your Full Name *"
                        required
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                        }}
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-stone-50 dark:bg-stone-800 border text-stone-900 dark:text-stone-100 focus:outline-hidden transition-colors ${
                          fieldErrors.name
                            ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20'
                            : 'border-stone-200 dark:border-stone-700 focus:border-amber-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Phone Number Field */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                        Phone Number <span className="text-rose-500 font-bold">*</span>
                      </label>
                      {fieldErrors.phone && (
                        <span className="text-[10px] text-rose-500 font-medium animate-pulse">
                          {fieldErrors.phone}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        placeholder="10-digit mobile number (e.g. 98289 19626) *"
                        required
                        value={customerPhone}
                        onChange={(e) => {
                          setCustomerPhone(e.target.value);
                          if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
                        }}
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-stone-50 dark:bg-stone-800 border text-stone-900 dark:text-stone-100 focus:outline-hidden transition-colors ${
                          fieldErrors.phone
                            ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20'
                            : 'border-stone-200 dark:border-stone-700 focus:border-amber-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Delivery Address Field & Google Maps Auto-Fetch */}
                  {orderType === 'delivery' && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                          Delivery Address <span className="text-rose-500 font-bold">*</span>
                        </label>
                        {fieldErrors.address && (
                          <span className="text-[10px] text-rose-500 font-medium animate-pulse">
                            {fieldErrors.address}
                          </span>
                        )}
                      </div>

                      {/* Google Maps Auto-Fetch Button */}
                      <button
                        type="button"
                        onClick={handleAutoFetchAddress}
                        disabled={isLocatingAddress}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl border border-amber-300/80 dark:border-amber-700/60 bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 dark:from-amber-950/40 dark:via-stone-900 dark:to-amber-950/30 text-amber-950 dark:text-amber-200 hover:border-amber-500 transition-all text-xs font-semibold cursor-pointer shadow-2xs group"
                      >
                        <div className="flex items-center gap-2 text-left">
                          {isLocatingAddress ? (
                            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/80 text-amber-700">
                              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-lg bg-amber-200/80 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 group-hover:scale-105 transition-transform">
                              <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[11px] sm:text-xs text-amber-900 dark:text-amber-100">
                                {isLocatingAddress ? 'Locating via Google Maps...' : 'Auto-Fetch via Google Map'}
                              </span>
                              <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-bold tracking-wide uppercase">
                                Instant
                              </span>
                            </div>
                            <p className="text-[10px] text-stone-500 dark:text-stone-400 font-normal">
                              Fetch your doorstep location via GPS & Google Maps
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-amber-600 font-medium text-[11px] shrink-0">
                          <LocateFixed className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                        </div>
                      </button>

                      {locationError && (
                        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-400 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                          <span className="flex-1">{locationError}</span>
                        </div>
                      )}

                      <textarea
                        placeholder="House/Flat No., Building Name, Street, Landmark, Area *"
                        rows={2}
                        required
                        value={deliveryAddress}
                        onChange={(e) => {
                          setDeliveryAddress(e.target.value);
                          if (fieldErrors.address) setFieldErrors((p) => ({ ...p, address: undefined }));
                        }}
                        className={`w-full px-3 py-2 text-xs rounded-xl bg-stone-50 dark:bg-stone-800 border text-stone-900 dark:text-stone-100 focus:outline-hidden transition-colors resize-none ${
                          fieldErrors.address
                            ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20'
                            : 'border-stone-200 dark:border-stone-700 focus:border-amber-500'
                        }`}
                      />
                    </div>
                  )}

                  {/* Dine-in Table Number Field */}
                  {orderType === 'dine-in' && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                          Table Number <span className="text-rose-500 font-bold">*</span>
                        </label>
                        {fieldErrors.tableNumber && (
                          <span className="text-[10px] text-rose-500 font-medium animate-pulse">
                            {fieldErrors.tableNumber}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Table Number (e.g. Table 4 / Patio 2) *"
                        required
                        value={tableNumber}
                        onChange={(e) => {
                          setTableNumber(e.target.value);
                          if (fieldErrors.tableNumber) setFieldErrors((p) => ({ ...p, tableNumber: undefined }));
                        }}
                        className={`w-full px-3 py-2 text-xs rounded-xl bg-stone-50 dark:bg-stone-800 border text-stone-900 dark:text-stone-100 focus:outline-hidden transition-colors ${
                          fieldErrors.tableNumber
                            ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20'
                            : 'border-stone-200 dark:border-stone-700 focus:border-amber-500'
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <span className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">
                  Payment Method
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`py-2 px-2 rounded-xl border font-semibold text-center ${
                      paymentMethod === 'upi'
                        ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    UPI / QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`py-2 px-2 rounded-xl border font-semibold text-center ${
                      paymentMethod === 'card'
                        ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('counter')}
                    className={`py-2 px-2 rounded-xl border font-semibold text-center ${
                      paymentMethod === 'counter'
                        ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    Pay at Counter
                  </button>
                </div>
              </div>

              {/* Bill Details Breakdown */}
              <div className="rounded-2xl bg-stone-50 dark:bg-stone-800 p-4 border border-stone-200 dark:border-stone-700 space-y-2 text-xs">
                <h4 className="font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider text-[11px] mb-2">
                  Bill Summary
                </h4>
                <div className="flex justify-between text-stone-600 dark:text-stone-400">
                  <span>Item Subtotal</span>
                  <span className="font-mono">₹{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Promo Discount</span>
                    <span className="font-mono">-₹{discount.toFixed(2)}</span>
                  </div>
                )}
                {orderType === 'delivery' && (
                  <div className="flex justify-between text-stone-600 dark:text-stone-400">
                    <span>Delivery Partner</span>
                    <span className="font-mono">
                      {deliveryFee === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {subtotal >= 499 ? 'FREE (Above ₹499)' : 'FREE'}
                        </span>
                      ) : (
                        `₹${deliveryFee.toFixed(2)}`
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-stone-600 dark:text-stone-400">
                  <span>Restaurant GST (5%)</span>
                  <span className="font-mono">₹{tax.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-stone-200 dark:border-stone-700 flex justify-between font-bold text-stone-900 dark:text-stone-100 text-sm">
                  <span>To Pay</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 text-base">
                    ₹{total.toFixed(2)}
                  </span>
                </div>
              </div>

              {orderError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-400 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}
            </div>
          )}

          {/* Drawer Footer Checkout Button */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
              <button
                id="place-order-btn"
                type="button"
                onClick={handleCheckout}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-candy-cherry-500 to-amber-500 hover:from-candy-cherry-600 hover:to-amber-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-lg shadow-candy-cherry-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Placing Secure Order...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Order • ₹{total.toFixed(2)}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-stone-400 mt-2">
                🔒 Safe & encrypted checkout with instant live kitchen tracking
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
