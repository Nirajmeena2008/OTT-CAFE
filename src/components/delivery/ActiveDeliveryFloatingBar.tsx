import React, { useState } from 'react';
import {
  Bike,
  Navigation,
  Phone,
  Clock,
  ChevronUp,
  ChevronDown,
  X,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import type { Order } from '../../types';

interface ActiveDeliveryFloatingBarProps {
  activeOrder: Order;
  onOpenTracking: (order: Order) => void;
  onDismiss?: () => void;
}

export const ActiveDeliveryFloatingBar: React.FC<ActiveDeliveryFloatingBarProps> = ({
  activeOrder,
  onOpenTracking,
  onDismiss,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const partner = activeOrder.deliveryPartner;
  const tracking = activeOrder.deliveryTracking;
  const stage = tracking?.stage || 'assigned';

  const getStageLabel = () => {
    switch (stage) {
      case 'assigned':
        return partner ? `${partner.name} Assigned` : 'Partner Assigned';
      case 'arrived_at_pickup':
        return 'Rider at OTT Kitchen';
      case 'picked_up':
        return 'Food Picked Up';
      case 'on_the_way':
        return 'On NH-48';
      case 'near_destination':
        return 'Arriving At Your Gate';
      case 'delivered':
        return 'Delivered';
      default:
        return activeOrder.status === 'preparing'
          ? 'Fresh In OTT Kitchen Oven'
          : activeOrder.status === 'accepted'
          ? 'Order Confirmed'
          : 'Live Tracking';
    }
  };

  const cleanPhone = partner?.phone?.replace(/\D/g, '') || '9828919626';

  return (
    <aside
      aria-label="Active Delivery Tracking"
      id="active-delivery-floating-bar"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] sm:w-auto animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto shadow-2xl rounded-2xl"
    >
      <div className="rounded-2xl bg-white/95 dark:bg-stone-900/95 text-stone-900 dark:text-white border border-amber-200 dark:border-amber-500/40 backdrop-blur-md shadow-2xl overflow-hidden ring-1 ring-amber-200 dark:ring-amber-500/30">
        {/* Minimized Pill View */}
        {isMinimized ? (
          <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-white dark:bg-stone-900">
            <button
              type="button"
              onClick={() => onOpenTracking(activeOrder)}
              className="flex items-center gap-2.5 text-left cursor-pointer hover:opacity-90"
            >
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </div>
              <Bike className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <div className="text-xs">
                <span className="font-bold block">Order #{activeOrder.id} • {getStageLabel()}</span>
              </div>
            </button>

            <div className="flex items-center gap-1.5">
              {partner ? (
                <a
                  href={`tel:${partner.phone}`}
                  title={`Call ${partner.name}`}
                  className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              ) : (
                <a
                  href="tel:+919828919626"
                  title="Call OTT Restro"
                  className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                title="Expand Tracking Bar"
                className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 cursor-pointer"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Expanded Card View */
          <div>
            {/* Top Bar */}
            <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-600/30 dark:to-amber-500/20 border-b border-amber-200 dark:border-amber-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </div>
                <span className="font-mono font-bold text-amber-800 dark:text-amber-400">
                  LIVE DELIVERY IN PROGRESS • #{activeOrder.id}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  title="Minimize"
                  className="p-1 rounded-md text-amber-700 hover:text-amber-900 hover:bg-amber-200 dark:text-stone-400 dark:hover:text-white dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {onDismiss && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    title="Hide Floating Tracker"
                    className="p-1 rounded-md text-amber-700 hover:text-amber-900 hover:bg-amber-200 dark:text-stone-400 dark:hover:text-white dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Content Body */}
            <div className="p-3.5 sm:p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white dark:text-stone-950 flex items-center justify-center font-bold shrink-0 shadow-md">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider block">
                      Status: {getStageLabel()}
                    </span>
                    <span className="text-xs text-stone-600 dark:text-stone-300 font-medium line-clamp-1">
                      {tracking?.currentLocationLabel || activeOrder.deliveryAddress || 'En route to your location'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Partner Details & Quick Direct Calling */}
              {partner ? (
                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700/80 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 flex items-center justify-center font-black shrink-0">
                      {partner.name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-stone-900 dark:text-stone-200 block text-[11px]">
                        Rider: {partner.name}
                      </span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
                        {partner.vehicleNumber} ({partner.vehicleType})
                      </span>
                    </div>
                  </div>

                  {/* Immediate Direct Call & WhatsApp to Delivery Partner */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`tel:${partner.phone}`}
                      id="btn-call-delivery-partner-float"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all active:scale-95"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call Partner</span>
                    </a>

                    <a
                      href={`https://wa.me/91${cleanPhone.slice(-10)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp Delivery Partner"
                      className="p-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700/80 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">
                    Kitchen coordinating your rider...
                  </span>
                  <a
                    href="tel:+919828919626"
                    className="px-2.5 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 dark:bg-stone-700 dark:hover:bg-stone-600 dark:text-white font-bold text-[11px] flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Call Desk</span>
                  </a>
                </div>
              )}

              {/* Action: Open Full Live Tracking Map */}
              <button
                type="button"
                id="btn-open-live-package-tracking"
                onClick={() => onOpenTracking(activeOrder)}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-98 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Track Package Live Anytime</span>
                <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
