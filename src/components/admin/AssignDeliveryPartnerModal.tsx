import React, { useState, useEffect } from 'react';
import {
  X,
  Bike,
  CheckCircle2,
  Phone,
  Clock,
  Navigation,
  Car,
  ShieldCheck,
  UserCheck,
  MapPin,
  Sparkles,
  AlertCircle,
  ChevronRight,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import type { Order, DeliveryPartner, DeliveryTrackingStage, DeliveryPartnerVehicle } from '../../types';
import { api } from '../../services/api';

interface AssignDeliveryPartnerModalProps {
  isOpen: boolean;
  order: Order;
  token: string;
  onClose: () => void;
  onAssign: (data: {
    partner: DeliveryPartner;
    estimatedMinutes: number;
    notes: string;
    initialStage: DeliveryTrackingStage;
  }) => Promise<void>;
}

export const AssignDeliveryPartnerModal: React.FC<AssignDeliveryPartnerModalProps> = ({
  isOpen,
  order,
  token,
  onClose,
  onAssign,
}) => {
  const [registeredPartners, setRegisteredPartners] = useState<DeliveryPartner[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [partnersError, setPartnersError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPartnersLoading(true);
    api
      .getDeliveryPartners(token)
      .then((list) => {
        if (cancelled) return;
        setRegisteredPartners(list);
        if (!order.deliveryPartner) {
          if (list.length > 0) {
            setSelectedPartnerId(list[0].id);
            setIsNewRider(false);
          } else {
            setIsNewRider(true);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setPartnersError(err.message || 'Failed to load delivery fleet');
      })
      .finally(() => {
        if (!cancelled) setPartnersLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, token]);

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(order.deliveryPartner?.id || 'new');
  const [isNewRider, setIsNewRider] = useState<boolean>(!order.deliveryPartner);
  const [riderName, setRiderName] = useState<string>(order.deliveryPartner?.name || '');
  const [riderPhone, setRiderPhone] = useState<string>(order.deliveryPartner?.phone || '');
  const [vehicleNumber, setVehicleNumber] = useState<string>(order.deliveryPartner?.vehicleNumber || '');
  const [vehicleType, setVehicleType] = useState<DeliveryPartnerVehicle>(order.deliveryPartner?.vehicleType || 'bike');

  const [initialStage, setInitialStage] = useState<DeliveryTrackingStage>(
    order.deliveryTracking?.stage || 'assigned'
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(
    order.deliveryTracking?.estimatedDeliveryMinutes || (order.isCustomCake ? 40 : 25)
  );
  const [notes, setNotes] = useState<string>(
    order.deliveryTracking?.statusNotes ||
      (order.isCustomCake
        ? 'Tiered cake packed with cooling ice-packs. Handle upright.'
        : 'Fresh restro meal sealed with tamper-proof seal.')
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectExisting = (p: DeliveryPartner) => {
    setSelectedPartnerId(p.id);
    setIsNewRider(false);
    setRiderName(p.name);
    setRiderPhone(p.phone);
    setVehicleNumber(p.vehicleNumber);
    setVehicleType(p.vehicleType);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let partner: DeliveryPartner;
    try {
      if (isNewRider || registeredPartners.length === 0) {
        if (!riderName.trim()) {
          setError('Please enter the delivery partner name');
          return;
        }
        if (!riderPhone.trim() || riderPhone.replace(/\D/g, '').length < 10) {
          setError('Please enter a valid 10-digit phone number for the rider');
          return;
        }
        if (!vehicleNumber.trim()) {
          setError('Please enter the vehicle registration plate number');
          return;
        }

        setIsSubmitting(true);
        const existingId = order.deliveryPartner?.id;
        const payload = {
          name: riderName.trim(),
          phone: riderPhone.trim(),
          vehicleType,
          vehicleNumber: vehicleNumber.trim().toUpperCase(),
        };
        partner = existingId
          ? await api.updateDeliveryPartner(token, existingId, payload)
          : await api.addDeliveryPartner(token, payload);
      } else {
        const found = registeredPartners.find((p) => p.id === selectedPartnerId);
        if (!found) {
          setError('Please select a delivery partner from the registered fleet or enter new rider details');
          return;
        }
        partner = found;
        setIsSubmitting(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save delivery partner details');
      setIsSubmitting(false);
      return;
    }

    try {
      await onAssign({
        partner,
        estimatedMinutes,
        notes: notes.trim(),
        initialStage,
      });

      // Broadcast real-time delivery assignment event with customer location
      try {
        const notifPayload = {
          id: `notif-${Date.now()}`,
          partnerId: partner.id,
          partnerName: partner.name,
          orderId: order.id,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerAddress: order.deliveryAddress || 'SP 41 B, Kukas, Jaipur',
          orderTotal: order.total,
          itemsCount: order.items?.length || 1,
          itemsSummary: order.items?.map((i) => `${i.quantity}x ${i.name}`).join(', ') || 'Food items',
          notes: notes.trim() || order.deliveryNotes,
          assignedAt: new Date().toISOString(),
          read: false,
        };
        window.dispatchEvent(new CustomEvent('ott_delivery_assigned', { detail: notifPayload }));
        localStorage.setItem('ott_latest_delivery_assigned', JSON.stringify(notifPayload));
      } catch {
        // ignore
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to assign delivery partner');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center shadow-xs">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  OTT Fleet Dispatch
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                  #{order.id}
                </span>
              </div>
              <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                Assign Delivery Partner &amp; Live Tracking
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Destination Details */}
        <div className="px-6 py-3 bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200">
            <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-bold">Destination:</span>
            <span className="truncate max-w-sm">{order.deliveryAddress || 'Kukas Locality'}</span>
          </div>
          <div className="flex items-center gap-3 font-semibold text-stone-600 dark:text-stone-300">
            <span>Customer: {order.customerName}</span>
            <span>•</span>
            <span>+91 {order.customerPhone}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {partnersError && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2 border border-amber-200 dark:border-amber-900">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Couldn't load the registered fleet ({partnersError}) — you can still enter new rider details below.</span>
            </div>
          )}

          {partnersLoading && (
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Loading registered fleet...</span>
            </div>
          )}

          {/* Partner Selection / Form */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                Delivery Partner Details
              </label>
              {registeredPartners.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setIsNewRider(false)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      !isNewRider
                        ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                  >
                    Registered Riders ({registeredPartners.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewRider(true);
                      setRiderName('');
                      setRiderPhone('');
                      setVehicleNumber('');
                    }}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1 ${
                      isNewRider
                        ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>+ New Rider</span>
                  </button>
                </div>
              )}
            </div>

            {!isNewRider && registeredPartners.length > 0 ? (
              /* Registered Fleet Cards */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {registeredPartners.map((p) => {
                  const isSelected = selectedPartnerId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectExisting(p)}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 relative ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 shadow-md ring-2 ring-amber-500/20'
                          : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 bg-stone-50/50 dark:bg-stone-800/40'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
                        <Bike className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 truncate">
                            {p.name}
                          </h4>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                          {p.vehicleType === 'van' ? <Car className="w-3.5 h-3.5" /> : <Bike className="w-3.5 h-3.5" />}
                          <span className="font-mono font-semibold">{p.vehicleNumber}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-500 dark:text-stone-400">
                          <span>{p.phone}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Rider Input Form */
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Rider Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter rider name"
                      value={riderName}
                      onChange={(e) => setRiderName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Phone Number (for Customer &amp; WhatsApp) *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9828012345"
                      value={riderPhone}
                      onChange={(e) => setRiderPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-stone-900 dark:text-stone-100 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Vehicle Type
                    </label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value as DeliveryPartnerVehicle)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-stone-900 dark:text-stone-100"
                    >
                      <option value="bike">Motorcycle / Bike</option>
                      <option value="scooter">Scooter</option>
                      <option value="electric_ev">Electric EV Bike</option>
                      <option value="van">Cool-Van (Cakes &amp; Bulk Orders)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Vehicle Registration Plate *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. RJ-14-XX-1234"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-stone-900 dark:text-stone-100 uppercase font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Initial Stage & Progress */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2">
              Initial Delivery Status Stage
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { stage: 'assigned' as DeliveryTrackingStage, label: '1. Assigned', desc: 'Heading to OTT' },
                { stage: 'arrived_at_pickup' as DeliveryTrackingStage, label: '2. At Restro', desc: 'Waiting at Kitchen' },
                { stage: 'picked_up' as DeliveryTrackingStage, label: '3. Picked Up', desc: 'Hot-sealed & leaving' },
                { stage: 'on_the_way' as DeliveryTrackingStage, label: '4. En Route', desc: 'NH-48 Transit' },
              ].map((s) => (
                <button
                  key={s.stage}
                  type="button"
                  onClick={() => setInitialStage(s.stage)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    initialStage === s.stage
                      ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/20 text-stone-900 dark:text-stone-100 font-bold'
                      : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300'
                  }`}
                >
                  <p className="font-bold text-xs">{s.label}</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Delivery Time */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Estimated Delivery Window</span>
              </label>
              <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                {estimatedMinutes} Minutes
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[15, 25, 35, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setEstimatedMinutes(mins)}
                  className={`flex-1 py-2 text-xs rounded-xl font-bold border transition-all ${
                    estimatedMinutes === mins
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 border-transparent shadow-xs'
                      : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Dispatch Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
              Rider Dispatch &amp; Safety Instructions
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Call upon reaching guard gate, keep soup vertical"
              className="w-full px-3 py-2.5 text-xs rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-stone-900 dark:text-stone-100"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 flex items-center gap-2 shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Assigning Fleet...</span>
              ) : (
                <>
                  <Bike className="w-4 h-4" />
                  <span>Confirm Fleet Assignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
