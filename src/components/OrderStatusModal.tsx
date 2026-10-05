import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  ChefHat,
  Bike,
  PackageCheck,
  RefreshCw,
  Phone,
  Cake,
  Calendar,
  Sparkles,
  Image as ImageIcon,
  Navigation,
  Utensils,
  MapPin,
  MessageCircle,
} from 'lucide-react';
import { api } from '../services/api';
import type { Order, OrderStatus } from '../types';
import { OTT_MENU_ITEMS } from '../data/ottPdfMenu';

import { AlertTriangle, Ban, AlertOctagon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface OrderStatusModalProps {
  order: Order;
  onClose: () => void;
  onOrderUpdated?: (order: Order) => void;
}


const DINE_IN_STEPS: { status: OrderStatus; label: string; desc?: string; icon: React.ReactNode }[] = [
  { status: 'pending', label: 'Order Placed & Received', desc: 'Awaiting confirmation from staff', icon: <CheckCircle2 className="w-4 h-4" /> },
  { status: 'accepted', label: 'Accepted by Staff', desc: 'Order is confirmed and queued', icon: <ChefHat className="w-4 h-4" /> },
  { status: 'preparing', label: 'Kitchen Preparing', desc: 'Chefs are currently preparing your food', icon: <ChefHat className="w-4 h-4" /> },
  { status: 'ready', label: 'Ready for Serving', desc: 'Food is prepared and ready to be served', icon: <Utensils className="w-4 h-4" /> },
  { status: 'delivered', label: 'Completed', desc: 'Order has been fulfilled. Enjoy!', icon: <PackageCheck className="w-4 h-4" /> },
];

const DELIVERY_STEPS: { status: OrderStatus; label: string; desc?: string; icon: React.ReactNode }[] = [
  { status: 'pending', label: 'Order Placed & Received', desc: 'Kitchen dispatch team received your order', icon: <CheckCircle2 className="w-4 h-4" /> },
  { status: 'accepted', label: 'Accepted & Partner Assigned', desc: 'Order verified and nearest rider coordinated', icon: <ChefHat className="w-4 h-4" /> },
  { status: 'preparing', label: 'Kitchen Preparing & Packing', desc: 'Food is being cooked and safely hot-sealed', icon: <ChefHat className="w-4 h-4" /> },
  { status: 'ready', label: 'Out for Delivery (On the Way)', desc: 'Rider picked up the order and is cruising towards you', icon: <Bike className="w-4 h-4" /> },
  { status: 'delivered', label: 'Delivered to Doorstep', desc: 'Package handed over. Enjoy your meal!', icon: <PackageCheck className="w-4 h-4" /> },
];

export const OrderStatusModal: React.FC<OrderStatusModalProps> = ({ order: initialOrder, onClose, onOrderUpdated }) => {
  const { customerToken } = useAuth();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isDelivery = order.orderType === 'delivery' || Boolean(order.deliveryAddress);
  const activeSteps = isDelivery ? DELIVERY_STEPS : DINE_IN_STEPS;

  // Calculate ETA based on preparation time + distance
  const calculatedTimeInfo = useMemo(() => {
    // Default OTT Cafe coordinates (Kukas)
    const cafeLat = 27.0543;
    const cafeLon = 75.8988;

    // Customer coordinates (fallback if missing)
    const custLat = order.deliveryTracking?.deliveryLocation?.lat || 26.9855;
    const custLon = order.deliveryTracking?.deliveryLocation?.lng || 75.8513;

    // Haversine distance
    const R = 6371; // km
    const dLat = (custLat - cafeLat) * (Math.PI / 180);
    const dLon = (custLon - cafeLon) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(cafeLat * (Math.PI / 180)) *
        Math.cos(custLat * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // Travel time at approx 25 km/h avg city speed
    const travelSpeedKmh = 25;
    const travelTimeMins = Math.ceil((distanceKm / travelSpeedKmh) * 60);

    // Max preparation time from all items
    let maxPrep = 10; // min 10 mins
    order.items.forEach((item) => {
      const menuItem = OTT_MENU_ITEMS.find((m) => m.id === item.menuItemId);
      if (menuItem?.preparationTimeMinutes && menuItem.preparationTimeMinutes > maxPrep) {
        maxPrep = menuItem.preparationTimeMinutes;
      }
    });

    const packingTime = 5;
    const totalMins = maxPrep + packingTime + (isDelivery ? travelTimeMins : 0);

    return {
      distanceKm: distanceKm.toFixed(1),
      maxPrep,
      travelTimeMins,
      packingTime,
      totalMins,
    };
  }, [order, isDelivery]);
  // Cancel order state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Placed order by mistake');
  const [customReason, setCustomReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Cancellation rule:
  // Customer can cancel BEFORE rider picks up the order or before it is out for delivery.
  // After delivery rider picks up the order (picked_up, on_the_way, ready, delivered, cancelled), the cancel order button DISAPPEARS.
  const isRiderDispatched =
    order.status === 'ready' ||
    order.status === 'delivered' ||
    order.status === 'cancelled' ||
    order.deliveryTracking?.stage === 'picked_up' ||
    order.deliveryTracking?.stage === 'on_the_way' ||
    order.deliveryTracking?.stage === 'near_destination';

  const canCancel = !isRiderDispatched && ['pending', 'accepted', 'preparing'].includes(order.status);

  // Auto-polling for live updates (order status, rider GPS position)
  useEffect(() => {
    if (order.status === 'delivered' || order.status === 'cancelled') return;
    const interval = setInterval(() => {
      api
        .getOrder(order.id, customerToken || undefined, order.customerPhone)
        .then((fresh) => {
          if (fresh) {
            setOrder(fresh);
            onOrderUpdated?.(fresh);
          }
        })
        .catch(() => {});
    }, 7000);
    return () => clearInterval(interval);
  }, [order.id, order.status, customerToken]);

  const handleCancelOrder = async () => {
    const finalReason = cancelReason === 'Other' ? (customReason.trim() || 'Other reason') : cancelReason;
    try {
      setIsCancelling(true);
      setCancelError(null);
      const updated = await api.cancelOrder(order.id, finalReason, customerToken || undefined, order.customerPhone);
      setOrder(updated);
      onOrderUpdated?.(updated);
      setShowCancelModal(false);
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel order. It may have already been dispatched.');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 0;
      case 'accepted': return 1;
      case 'preparing': return 2;
      case 'ready': return 3;
      case 'delivered': return 4;
      case 'cancelled': return -1;
    }
  };

  const currentStep = getStepIndex(order.status);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const updated = await api.getOrder(order.id, customerToken || undefined, order.customerPhone);
      if (updated) {
        setOrder(updated);
        onOrderUpdated?.(updated);
      }
    } catch {
      // Keep existing state
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-xl sm:max-w-2xl rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/90 dark:bg-stone-900/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-black text-amber-600 dark:text-amber-400">
                {isDelivery ? 'Live Delivery & Food Tracker' : 'Live Kitchen Tracker'}
              </span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                #{order.id}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100 mt-1">
              {order.status === 'cancelled'
                ? 'Order Cancelled'
                : order.status === 'delivered'
                ? 'Order Completed'
                : 'Order In Progress'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>



        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Cancelled Banner if Order is Cancelled */}
          {order.status === 'cancelled' && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <Ban className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-rose-900 dark:text-rose-200 text-sm">
                  This Order Has Been Cancelled
                </h4>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                  {order.statusNotes || 'Cancelled by customer before rider dispatch.'}
                </p>
                <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1">
                  If any advance online payment was processed, a full refund is initiated back to your original source within 2-4 business days.
                </p>
              </div>
            </div>
          )}

          {/* KITCHEN STEPS & FOOD BREAKDOWN */}
          <div className="space-y-6">
              {/* Calculated ETA Info */}
              <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold">
                    <Clock className={`w-5 h-5 ${order.status !== 'delivered' && order.status !== 'cancelled' ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <p className="text-xs text-amber-900 dark:text-amber-300 font-semibold">
                      {order.status === 'delivered' ? 'Completed' : isDelivery ? 'Estimated Delivery Time' : 'Estimated Prep Time'}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums tracking-wide">
                        {order.status === 'delivered' || order.status === 'cancelled' ? '—' : `${calculatedTimeInfo.totalMins} Mins`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className="text-[10px] text-amber-800 dark:text-amber-400 font-medium">
                    Prep & Pack: {calculatedTimeInfo.maxPrep + calculatedTimeInfo.packingTime}m
                  </span>
                  {isDelivery && (
                    <span className="text-[10px] text-amber-800 dark:text-amber-400 font-medium">
                      Travel ({calculatedTimeInfo.distanceKm}km): {calculatedTimeInfo.travelTimeMins}m
                    </span>
                  )}
                </div>
              </div>

              {/* Delivery Partner Highlight if assigned */}
              {order.deliveryPartner && (
                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                      <Bike className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-purple-950 dark:text-purple-300">
                        Rider Assigned: {order.deliveryPartner.name}
                      </p>
                      <p className="text-[11px] text-stone-500 font-mono">
                        {order.deliveryPartner.vehicleNumber} ({order.deliveryPartner.vehicleType})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {order.deliveryPartner.phone && (
                      <a
                        href={`tel:${order.deliveryPartner.phone}`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call Partner</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Stepper Progress */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Order Status Milestones
                  </h4>
                  <div className="flex items-center gap-2">
                    <button onClick={handleRefresh} className="text-[11px] font-bold text-amber-600 flex items-center gap-1 cursor-pointer hover:text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md transition-colors shadow-xs">
                      <RefreshCw className="w-3 h-3" /> Refresh Status
                    </button>
                  </div>
                </div>
                
                <div className="relative pl-6 border-l-2 border-stone-200 dark:border-stone-700 space-y-5">
                  {activeSteps.map((step, idx) => {
                    const isPassed = currentStep >= idx;
                    const isCurrent = currentStep === idx;

                    return (
                      <div key={step.status} className="relative">
                        {/* Circle Node */}
                        <div
                          className={`absolute -left-[31px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${
                            isPassed
                              ? 'bg-amber-600 text-white ring-4 ring-amber-100 dark:ring-amber-950'
                              : 'bg-stone-200 dark:bg-stone-800 text-stone-400'
                          }`}
                        >
                          {step.icon}
                        </div>
                        <div>
                          <p
                            className={`text-xs font-bold ${
                              isCurrent
                                ? 'text-amber-600 dark:text-amber-400'
                                : isPassed
                                ? 'text-stone-900 dark:text-stone-200'
                                : 'text-stone-400 dark:text-stone-500'
                            }`}
                          >
                            {step.label}
                          </p>
                          {step.desc && (
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                              {step.desc}
                            </p>
                          )}
                          {step.status === 'accepted' && order.acceptedBy && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold mt-0.5">
                              Staff: {order.acceptedBy} {order.acceptedAt ? `(${new Date(order.acceptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
                            </p>
                          )}
                          {isCurrent && order.statusNotes && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                              Note: {order.statusNotes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Celebration Cake Details Card */}
              {(order.isCustomCake || order.customCakeDetails) && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 via-amber-500/10 to-transparent border border-rose-200 dark:border-rose-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
                        <Cake className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          Made-to-Order Celebration Cake
                        </span>
                        <h5 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 font-serif">
                          {order.customCakeDetails?.occasion || 'Special Celebration'}
                        </h5>
                      </div>
                    </div>
                    {order.customCakeDetails?.isEggless && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        100% Eggless
                      </span>
                    )}
                  </div>

                  {/* Reference Image and Specs */}
                  <div className="flex items-start gap-3 bg-white/60 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200 dark:border-stone-800">
                    {order.customCakeDetails?.referenceImageUrl && (
                      <img
                        src={order.customCakeDetails.referenceImageUrl}
                        alt="Custom Cake Reference"
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-stone-300 dark:border-stone-700 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 text-xs space-y-1">
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        <span className="text-stone-500 font-normal">Flavor &amp; Size:</span>{' '}
                        {((order.customCakeDetails?.weightKg || 1) * 2.20462).toFixed(1)} lb{' '}
                        <span className="text-[9px] font-normal text-stone-400 dark:text-stone-500">
                          ({order.customCakeDetails?.weightKg || 1} kg)
                        </span>{' '}
                        • {order.customCakeDetails?.flavor}
                      </p>
                      {order.customCakeDetails?.shape && (
                        <p className="text-stone-600 dark:text-stone-400">
                          <span className="text-stone-500">Shape:</span> {order.customCakeDetails.shape}
                        </p>
                      )}
                      {order.customCakeDetails?.targetDate && (
                        <p className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Event Date: {order.customCakeDetails.targetDate} ({order.customCakeDetails.targetTime})</span>
                        </p>
                      )}
                      {order.customCakeDetails?.messageOnCake && (
                        <p className="text-rose-600 dark:text-rose-400 font-medium">
                          Piped Message: "{order.customCakeDetails.messageOnCake}"
                        </p>
                      )}
                    </div>
                  </div>

                  {order.customCakeDetails?.designDescription && (
                    <div className="text-xs bg-stone-100/70 dark:bg-stone-800/70 p-2.5 rounded-xl text-stone-700 dark:text-stone-300">
                      <span className="font-bold text-stone-900 dark:text-stone-100">Design Instructions: </span>
                      {order.customCakeDetails.designDescription}
                    </div>
                  )}

                  <p className="text-[11px] text-stone-500 dark:text-stone-400 italic">
                    Our pastry chef will review your reference image and contact you on WhatsApp/Phone for proof confirmation.
                  </p>
                </div>
              )}

              {/* Items Summary */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2">
                <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                  Items Ordered
                </h4>
                <div className="divide-y divide-stone-200 dark:divide-stone-700 text-xs">
                  {order.items.map((it, i) => (
                    <div key={i} className="py-2 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-stone-500 dark:text-stone-400">{it.quantity}x</span>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">{it.name}</span>
                      </div>
                      <span className="font-mono text-stone-700 dark:text-stone-300">
                        ₹{(it.price * it.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-stone-200 dark:border-stone-700 flex justify-between font-bold text-xs">
                  <span className="text-stone-800 dark:text-stone-200">Total Bill</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 text-sm">
                    ₹{order.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Delivery or Table Info */}
              <div className="text-xs text-stone-500 dark:text-stone-400 space-y-1">
                {order.deliveryAddress && (
                  <p>
                    <strong>Delivery Address:</strong> {order.deliveryAddress}
                  </p>
                )}
                {order.tableNumber && (
                  <p>
                    <strong>Table:</strong> {order.tableNumber}
                  </p>
                )}
              </div>
            </div>

          {/* Restaurant Call Support Button */}
          <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500">
            <span>Need immediate help with your order?</span>
            <a
              href="tel:+919828919626"
              className="font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Out of the Town (+91 98289 19626)</span>
            </a>
          </div>
        </div>

        <div className="p-4 bg-stone-50 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
            <Phone className="w-3.5 h-3.5 text-amber-600" />
            <span>Need help? Call OTT at +91 98289 19626</span>
          </div>
          <div className="flex items-center gap-2">
            {canCancel && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="px-3.5 py-2 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Cancel Order
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-stone-900 dark:bg-stone-700 text-white rounded-xl font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* CUSTOMER CANCEL ORDER CONFIRMATION MODAL */}
        {showCancelModal && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                    Cancel Order #{order.id}?
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                    Orders can be cancelled before our delivery partner picks them up. Once the rider departs, cancellation is closed.
                  </p>
                </div>
              </div>

              {cancelError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                  {cancelError}
                </div>
              )}

              <div className="space-y-2 text-xs">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  Please select a reason for cancellation:
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                >
                  <option value="Placed order by mistake">Placed order by mistake</option>
                  <option value="Changed delivery address or contact number">Changed delivery address or contact number</option>
                  <option value="Need to modify food items">Need to modify food items</option>
                  <option value="Change of plans / dining elsewhere">Change of plans / dining elsewhere</option>
                  <option value="Taking longer than expected">Taking longer than expected</option>
                  <option value="Other">Other reason</option>
                </select>

                {cancelReason === 'Other' && (
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter reason..."
                    rows={2}
                    className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelError(null);
                  }}
                  disabled={isCancelling}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={isCancelling}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {isCancelling ? (
                    <span>Cancelling...</span>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>Confirm Cancellation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
