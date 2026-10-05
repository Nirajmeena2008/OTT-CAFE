import React, { useEffect } from 'react';
import {
  Bell,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  X,
  Volume2,
  Package,
  Receipt,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import type { DeliveryNotification } from '../../types';
import { playDeliveryNotificationChime } from '../../utils/deliveryAudio';

interface NewDeliveryAlertModalProps {
  notification: DeliveryNotification;
  onAccept: (notification: DeliveryNotification) => void;
  onDismiss: (notification: DeliveryNotification) => void;
}

export const NewDeliveryAlertModal: React.FC<NewDeliveryAlertModalProps> = ({
  notification,
  onAccept,
  onDismiss,
}) => {
  // Play chime on mount
  useEffect(() => {
    playDeliveryNotificationChime();
  }, [notification.id]);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    notification.customerAddress || 'Kukas, Jaipur'
  )}`;

  const cleanPhone = notification.customerPhone?.replace(/\D/g, '') || '';
  const whatsappUrl = `https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(
    `Hello ${notification.customerName}, I am your OTT Delivery Partner for Order #${notification.orderId}. I am on my way with your fresh food!`
  )}`;

  return (
    <div
      id="new-delivery-alert-overlay"
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-stone-900 border-2 border-amber-500 shadow-2xl shadow-amber-500/20 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Animated Top Pulse Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 p-4 text-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-950 text-amber-400 shadow-md">
                <Bell className="w-5 h-5 animate-bounce" />
              </span>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
              </span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider block text-stone-900/80">
                Incoming Dispatch Alert
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                New Delivery Assigned To You!
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => playDeliveryNotificationChime()}
              title="Play Alert Tone Again"
              className="p-2 rounded-xl bg-stone-950/10 hover:bg-stone-950/20 text-stone-950 transition-colors cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDismiss(notification)}
              className="p-2 rounded-xl bg-stone-950/10 hover:bg-stone-950/20 text-stone-950 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Order Header Summary */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800">
            <div>
              <span className="text-[11px] text-stone-500 dark:text-stone-400 uppercase font-bold block">
                Order Reference
              </span>
              <span className="font-mono text-base font-black text-stone-900 dark:text-white">
                #{notification.orderId}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 uppercase font-bold block">
                Order Value
              </span>
              <span className="font-mono text-base font-black text-amber-600 dark:text-amber-400">
                ₹{notification.orderTotal}
              </span>
            </div>
          </div>

          {/* Payment Status Pill */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Payment Method:</span>
            {notification.paymentMethod === 'cash' ? (
              <span className="font-bold text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 font-mono">
                COLLECT CASH: ₹{notification.orderTotal}
              </span>
            ) : (
              <span className="font-bold text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800">
                PREPAID (No Cash Collection)
              </span>
            )}
          </div>

          {/* CUSTOMER & DROP-OFF LOCATION CARD */}
          <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                Customer &amp; Drop-off Destination
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-300 font-bold">
                Kukas Corridor
              </span>
            </div>

            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">
                {notification.customerName}
              </h3>
              <p className="text-xs text-stone-700 dark:text-stone-300 mt-1 leading-relaxed">
                {notification.customerAddress || 'Kukas, Jaipur, Rajasthan'}
              </p>
            </div>

            {/* Direct Communication Buttons with Customer */}
            <div className="pt-2 border-t border-amber-500/20 grid grid-cols-2 gap-2">
              <a
                href={`tel:${notification.customerPhone}`}
                id="btn-alert-call-customer"
                className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Customer</span>
              </a>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                id="btn-alert-whatsapp-customer"
                className="py-2 px-3 rounded-xl bg-emerald-700/90 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>

            {/* GPS Navigation Direct Button */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="btn-alert-open-google-maps"
              className="w-full py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              <Navigation className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
              <span>Navigate on Google Maps</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>

          {/* Items Preview */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 text-xs">
            <div className="flex items-center gap-2 font-bold text-stone-700 dark:text-stone-300 mb-1">
              <Package className="w-3.5 h-3.5 text-amber-500" />
              <span>Package Items ({notification.itemsCount}):</span>
            </div>
            <p className="text-stone-600 dark:text-stone-400 line-clamp-2">
              {notification.itemsSummary}
            </p>
            {notification.notes && (
              <div className="mt-2 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-900/50">
                <strong>Customer Note:</strong> {notification.notes}
              </div>
            )}
          </div>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => onDismiss(notification)}
              className="py-3 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 font-bold text-xs sm:text-sm transition-all cursor-pointer"
            >
              Dismiss
            </button>

            <button
              type="button"
              id="btn-alert-accept-delivery"
              onClick={() => onAccept(notification)}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Accept &amp; Start Route</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
