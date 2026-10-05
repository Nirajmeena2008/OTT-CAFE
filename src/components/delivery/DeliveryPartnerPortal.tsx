import React, { useState, useEffect } from 'react';
import {
  Bike,
  Navigation,
  MapPin,
  Phone,
  MessageCircle,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  X,
  TrendingUp,
  User,
  Power,
  Store,
  Receipt,
  Cake,
  CheckSquare,
  Square,
  Sun,
  Moon,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  Send,
  LogOut,
  Sparkles,
  Bell,
  Volume2,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';
import type {
  Order,
  DeliveryPartner,
  DeliveryTrackingStage,
  DeliveryPartnerVehicle,
  DeliveryNotification,
} from '../../types';
import { DeliveryPartnerRouteMap } from './DeliveryPartnerRouteMap';
import { NewDeliveryAlertModal } from './NewDeliveryAlertModal';
import { playDeliveryNotificationChime } from '../../utils/deliveryAudio';
import { useTheme } from '../../context/ThemeContext';

interface DeliveryPartnerPortalProps {
  onClose: () => void;
  onOpenOrderDetails?: (order: Order) => void;
}

export const DeliveryPartnerPortal: React.FC<DeliveryPartnerPortalProps> = ({
  onClose,
  onOpenOrderDetails,
}) => {
  const { theme, toggleTheme, isDark } = useTheme();

  // Authentication State for Delivery Persons — a stale "authenticated" flag with no real
  // session token (e.g. from before real rider login existed) must NOT count as logged in.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem('ott_delivery_rider_authenticated') === 'true' &&
        !!localStorage.getItem('ott_delivery_rider_token')
      );
    } catch {
      return false;
    }
  });

  const [authPhone, setAuthPhone] = useState<string>(() => {
    try {
      return localStorage.getItem('ott_delivery_rider_phone') || '';
    } catch {
      return '';
    }
  });

  // Real backend session token, issued by /api/delivery/verify-otp. Required on every
  // delivery API call — without it the backend now rejects the request outright.
  const [deliveryToken, setDeliveryToken] = useState<string>(() => {
    try {
      return localStorage.getItem('ott_delivery_rider_token') || '';
    } catch {
      return '';
    }
  });

  // SMS Login Form State
  const [smsPhoneInput, setSmsPhoneInput] = useState<string>('');
  const [riderNameInput, setRiderNameInput] = useState<string>('');
  const [vehicleNumberInput, setVehicleNumberInput] = useState<string>('');
  const [vehicleTypeInput, setVehicleTypeInput] = useState<DeliveryPartnerVehicle>('bike');
  const [vehicleTypeTouched, setVehicleTypeTouched] = useState(false);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpInput, setOtpInput] = useState<string>('');
  const [otpCountdown, setOtpCountdown] = useState<number>(0);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);

  // Active delivery partner — restored from the last real verify-otp response for this
  // device, but always re-synced against the backend record (see fetchOrders/duty toggle).
  const [selectedPartner, setSelectedPartner] = useState<DeliveryPartner>(() => {
    try {
      const saved = localStorage.getItem('ott_active_delivery_partner');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      id: 'RIDER-DEFAULT',
      name: 'OTT Delivery Partner',
      phone: '',
      vehicleType: 'bike',
      vehicleNumber: 'RJ-14',
    };
  });

  const [isOnline, setIsOnline] = useState<boolean>(() => selectedPartner.isOnDuty !== false);
  const [isTogglingDuty, setIsTogglingDuty] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'available' | 'completed'>('active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Real-time Delivery Assignment Notifications
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);
  const [activeAlertNotif, setActiveAlertNotif] = useState<DeliveryNotification | null>(null);
  const [showNotifMenu, setShowNotifMenu] = useState<boolean>(false);
  const [alertedNotifIds, setAlertedNotifIds] = useState<Set<string>>(() => new Set());

  // Countdown timer for resend OTP
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  // Save selected partner
  useEffect(() => {
    try {
      localStorage.setItem('ott_active_delivery_partner', JSON.stringify(selectedPartner));
    } catch {
      // ignore
    }
  }, [selectedPartner]);

  // Load orders for delivery partner
  const fetchOrders = async (showLoadingState = true) => {
    try {
      if (showLoadingState) setLoading(true);
      setRefreshing(true);
      setError(null);
      const res = await api.getDeliveryPartnerOrders(deliveryToken, selectedPartner.id);
      setOrders(res.orders || []);

      // If no order is selected, select the first active delivery
      const activeRuns = (res.orders || []).filter(
        (o) =>
          o.deliveryPartner?.id === selectedPartner.id &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled'
      );
      if (activeRuns.length > 0 && !selectedOrderId) {
        setSelectedOrderId(activeRuns[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load delivery orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch real-time delivery assignment notifications
  const fetchNotifications = async () => {
    try {
      const res = await api.getDeliveryNotifications(deliveryToken, selectedPartner.id);
      setNotifications(res.notifications || []);
      const unreadList = (res.notifications || []).filter((n) => !n.read);
      if (unreadList.length > 0) {
        const latest = unreadList[0];
        if (!alertedNotifIds.has(latest.id)) {
          setAlertedNotifIds((prev) => new Set(prev).add(latest.id));
          setActiveAlertNotif(latest);
          playDeliveryNotificationChime();
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders(true);
      fetchNotifications();
      // Poll every 6 seconds for new order dispatches & notifications
      const interval = setInterval(() => {
        fetchOrders(false);
        fetchNotifications();
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [selectedPartner.id, isAuthenticated]);

  // Listen for instant in-tab or cross-tab delivery assignments
  useEffect(() => {
    const handleAssignmentEvent = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      if (detail.partnerId === selectedPartner.id || detail.partnerId === 'all') {
        fetchOrders(false);
        setActiveAlertNotif(detail);
        playDeliveryNotificationChime();
        setNotifications((prev) => [detail, ...prev]);
        setAlertedNotifIds((prev) => new Set(prev).add(detail.id));
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ott_latest_delivery_assigned' && e.newValue) {
        try {
          const detail = JSON.parse(e.newValue);
          if (detail.partnerId === selectedPartner.id || detail.partnerId === 'all') {
            fetchOrders(false);
            setActiveAlertNotif(detail);
            playDeliveryNotificationChime();
            setNotifications((prev) => [detail, ...prev]);
            setAlertedNotifIds((prev) => new Set(prev).add(detail.id));
          }
        } catch {}
      }
    };

    window.addEventListener('ott_delivery_assigned', handleAssignmentEvent);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('ott_delivery_assigned', handleAssignmentEvent);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [selectedPartner.id]);

  const handleAcceptAlert = async (notif: DeliveryNotification) => {
    try {
      await api.markDeliveryNotificationRead(deliveryToken, notif.id);
    } catch {}
    setActiveAlertNotif(null);
    setSelectedOrderId(notif.orderId);
    setActiveTab('active');
    fetchOrders(false);
    fetchNotifications();
  };

  const handleDismissAlert = async (notif: DeliveryNotification) => {
    try {
      await api.markDeliveryNotificationRead(deliveryToken, notif.id);
    } catch {}
    setActiveAlertNotif(null);
    fetchNotifications();
  };

  const handleTriggerTestAlert = async () => {
    try {
      const testNotif = await api.sendTestDeliveryNotification(
        deliveryToken,
        selectedPartner.id,
        selectedPartner.name
      );
      setActiveAlertNotif(testNotif);
      playDeliveryNotificationChime();
      fetchNotifications();
      fetchOrders(false);
    } catch (err: any) {
      alert(`Test notification failed: ${err.message}`);
    }
  };

  // Only used for the on-screen "here's your code" preview until a real SMS gateway is
  // configured — never used to bypass verification.
  const [otpPreview, setOtpPreview] = useState<string | null>(null);

  // Handle Send SMS OTP — now a real backend call. A phone that isn't a registered
  // delivery partner account (added by the owner in Team & Access Management) never
  // receives a code.
  const handleSendSmsOtp = async () => {
    setSmsError(null);
    const cleaned = smsPhoneInput.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setSmsError('Please enter a valid 10-digit mobile number');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await api.sendDeliveryOtp(cleaned);
      setOtpSent(true);
      setOtpCountdown(30);
      setOtpPreview(res.otpPreview || null);
    } catch (err: any) {
      setSmsError(err.message || 'Failed to send verification code');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle Verify SMS OTP — now checked against the real code the backend generated.
  const handleVerifySmsOtp = async () => {
    setSmsError(null);
    if (!otpInput.trim()) {
      setSmsError('Please enter the 6-digit verification code');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const cleaned = smsPhoneInput.replace(/\D/g, '');
      // The name/vehicle fields (if the rider filled them in) are sent along and persisted
      // onto their real backend account — this is their durable profile, not a per-device copy.
      const { token, partner } = await api.verifyDeliveryOtp(cleaned, otpInput.trim(), {
        name: riderNameInput.trim() || undefined,
        vehicleType: vehicleTypeTouched ? vehicleTypeInput : undefined,
        vehicleNumber: vehicleNumberInput.trim() || undefined,
      });

      setSelectedPartner(partner);
      setIsOnline(partner.isOnDuty !== false);
      setDeliveryToken(token);
      setIsAuthenticated(true);
      setAuthPhone(cleaned);

      try {
        localStorage.setItem('ott_delivery_rider_authenticated', 'true');
        localStorage.setItem('ott_delivery_rider_phone', cleaned);
        localStorage.setItem('ott_delivery_rider_token', token);
        localStorage.setItem('ott_active_delivery_partner', JSON.stringify(partner));
      } catch {
        // ignore
      }
    } catch (err: any) {
      setSmsError(err.message || 'Verification failed');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Handle Sign Out from Fleet
  const handleSignOut = () => {
    try {
      localStorage.removeItem('ott_delivery_rider_authenticated');
      localStorage.removeItem('ott_delivery_rider_phone');
      localStorage.removeItem('ott_delivery_rider_token');
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setDeliveryToken('');
    setOtpSent(false);
    setOtpInput('');
    setOtpPreview(null);
  };

  // Orders filtered by category
  const activeDeliveries = orders.filter(
    (o) =>
      o.deliveryPartner?.id === selectedPartner.id &&
      o.status !== 'delivered' &&
      o.status !== 'cancelled'
  );

  const availableOrders = orders.filter(
    (o) => !o.deliveryPartner && o.status !== 'delivered' && o.status !== 'cancelled'
  );

  const completedDeliveries = orders.filter(
    (o) => o.deliveryPartner?.id === selectedPartner.id && o.status === 'delivered'
  );

  // Active selected order
  const currentActiveOrder =
    orders.find((o) => o.id === selectedOrderId) || activeDeliveries[0] || null;

  // Claim unassigned order
  const handleClaimOrder = async (orderId: string) => {
    try {
      setRefreshing(true);
      const updated = await api.claimDeliveryOrder(deliveryToken, orderId, selectedPartner);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      setSelectedOrderId(orderId);
      setActiveTab('active');
    } catch (err: any) {
      alert(`Could not claim order: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  // Update delivery stage
  const handleUpdateStage = async (orderId: string, stage: DeliveryTrackingStage) => {
    try {
      setRefreshing(true);
      const updated = await api.updateRiderDeliveryStage(deliveryToken, orderId, {
        stage,
        notes: `Updated to ${stage} by ${selectedPartner.name}`,
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (err: any) {
      alert(`Could not update delivery status: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  // Check item verification in bag
  const toggleItemCheck = (key: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Calculate today's earnings
  const todaysEarnings = completedDeliveries.length * 65 + completedDeliveries.length * 15;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 dark:bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 lg:p-6 transition-colors">
      <div className="relative w-full max-w-6xl rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 shadow-2xl overflow-hidden flex flex-col max-h-[95vh] my-auto">
        {/* TOP HEADER */}
        <div className="p-4 sm:p-5 bg-stone-50 dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-stone-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-serif font-black text-stone-900 dark:text-white">
                  OTT Fleet &amp; Delivery Partner Portal
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  Rider Hub
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Out of the Town • Kukas NH-48 Express Fleet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            {/* Daylight / Night-Shift Theme Toggle */}
            <button
              id="delivery-portal-theme-toggle"
              type="button"
              onClick={toggleTheme}
              className="px-2.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-300 dark:border-stone-700 shadow-2xs"
              title={isDark ? 'Switch to Sunlight Daylight Mode' : 'Switch to Night-Shift Dark Mode'}
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Day Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-stone-700" />
                  <span className="hidden sm:inline">Night Mode</span>
                </>
              )}
            </button>

            {isAuthenticated && (
              <>
                {/* Rider Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold border border-stone-300 dark:border-stone-700">
                  <Bike className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{selectedPartner.name}</span>
                  <span className="text-stone-400 text-[11px] font-mono">({selectedPartner.vehicleNumber})</span>
                </div>

                {/* Shift Duty Status Toggle — real, persisted to the backend */}
                <button
                  type="button"
                  disabled={isTogglingDuty}
                  onClick={async () => {
                    const next = !isOnline;
                    setIsOnline(next);
                    setIsTogglingDuty(true);
                    try {
                      const updated = await api.toggleDeliveryPartnerDuty(deliveryToken, selectedPartner.id, next);
                      setSelectedPartner(updated);
                      try {
                        localStorage.setItem('ott_active_delivery_partner', JSON.stringify(updated));
                      } catch {
                        // ignore
                      }
                    } catch {
                      setIsOnline(!next); // revert on failure
                    } finally {
                      setIsTogglingDuty(false);
                    }
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border disabled:opacity-60 disabled:cursor-not-allowed ${
                    isOnline
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/40'
                      : 'bg-stone-100 text-stone-500 border-stone-300 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOnline ? 'bg-emerald-500 dark:bg-emerald-400 animate-ping' : 'bg-stone-400'
                    }`}
                  />
                  <span>{isOnline ? 'On Duty' : 'Off Duty'}</span>
                </button>

                {/* Real-time Notifications Bell with Badge */}
                <div className="relative">
                  <button
                    id="btn-delivery-notifications-bell"
                    type="button"
                    onClick={() => setShowNotifMenu(!showNotifMenu)}
                    className="relative p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-700 transition-colors cursor-pointer"
                    title="Delivery Assignment Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {notifications.filter((n) => !n.read).length > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                        {notifications.filter((n) => !n.read).length}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Menu of Notifications */}
                  {showNotifMenu && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl z-50 p-3 space-y-2 animate-in fade-in zoom-in-95">
                      <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-amber-500" />
                          <span className="text-xs font-bold uppercase tracking-wider text-stone-900 dark:text-white">
                            Dispatch Notifications ({notifications.length})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleTriggerTestAlert}
                            className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                          >
                            + Test Alert
                          </button>
                          {notifications.some((n) => !n.read) && (
                            <button
                              type="button"
                              onClick={async () => {
                                await api.markAllDeliveryNotificationsRead(deliveryToken, selectedPartner.id);
                                fetchNotifications();
                              }}
                              className="text-[10px] text-stone-500 dark:text-stone-400 hover:underline cursor-pointer"
                            >
                              Mark All Read
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-stone-500 dark:text-stone-400 text-center py-4">
                            No dispatch notifications yet. When an order is assigned to you, it will appear here with a chime!
                          </p>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                setShowNotifMenu(false);
                                setSelectedOrderId(n.orderId);
                                setActiveTab('active');
                                api.markDeliveryNotificationRead(deliveryToken, n.id);
                                fetchNotifications();
                              }}
                              className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                                !n.read
                                  ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-stone-900 dark:text-white'
                                  : 'bg-stone-50 dark:bg-stone-850 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100'
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span className="font-mono text-amber-600 dark:text-amber-400">
                                  #{n.orderId}
                                </span>
                                <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
                                  ₹{n.orderTotal}
                                </span>
                              </div>
                              <div className="font-medium text-[11px] mt-0.5 text-stone-800 dark:text-stone-200">
                                {n.customerName} • {n.customerPhone}
                              </div>
                              <div className="flex items-start gap-1 text-[10px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-1">
                                <MapPin className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                                <span>{n.customerAddress}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Test Alert Button */}
                <button
                  id="btn-test-rider-chime"
                  type="button"
                  onClick={handleTriggerTestAlert}
                  className="px-2.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1 border border-amber-400/40 transition-colors cursor-pointer"
                  title="Simulate incoming delivery alert with chime"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span className="hidden sm:inline">Test Alert</span>
                </button>

                {/* Sign Out / Switch Account */}
                <button
                  id="btn-rider-signout"
                  type="button"
                  onClick={handleSignOut}
                  className="px-2.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold flex items-center gap-1 border border-stone-300 dark:border-stone-700 transition-colors cursor-pointer"
                  title="Sign out of SMS session"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>

                {/* Refresh Orders */}
                <button
                  type="button"
                  onClick={() => fetchOrders(false)}
                  className={`p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 transition-colors cursor-pointer ${
                    refreshing ? 'animate-spin text-amber-500' : ''
                  }`}
                  title="Refresh Orders"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Close Modal */}
            <button
              id="btn-close-delivery-portal"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 border border-stone-300 dark:border-stone-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONDITIONAL RENDERING: IF NOT AUTHENTICATED -> SHOW SMS SIGN-IN */}
        {!isAuthenticated ? (
          <div className="p-4 sm:p-8 overflow-y-auto flex-1 flex items-center justify-center bg-stone-50/50 dark:bg-stone-900/50">
            <div className="w-full max-w-md bg-white dark:bg-stone-950 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 sm:p-8 shadow-xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-stone-950 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/25">
                  <Bike className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-white">
                  Delivery Partner Sign In
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Verify your registered phone number via SMS to access Out of the Town route dispatch &amp; customer delivery runs.
                </p>
              </div>

              {smsError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 font-medium">
                  {smsError}
                </div>
              )}

              {/* STEP 1: ENTER PHONE NUMBER & RIDER INFO */}
              {!otpSent ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                      Delivery Person Mobile Number *
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
                        +91
                      </span>
                      <input
                        id="sms-login-phone-input"
                        type="tel"
                        maxLength={10}
                        value={smsPhoneInput}
                        onChange={(e) => setSmsPhoneInput(e.target.value)}
                        placeholder="Enter 10-digit mobile number"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white font-mono text-sm font-semibold focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Rider Profile Fields — optional; only fill these in to update your
                      saved profile. Leave blank to sign in with what's already on file. */}
                  <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Optional — leave blank to keep your saved name &amp; vehicle details.
                    </p>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1">
                        Rider Full Name
                      </label>
                      <input
                        type="text"
                        value={riderNameInput}
                        onChange={(e) => setRiderNameInput(e.target.value)}
                        placeholder="Only needed to update your saved name"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-900 dark:text-white focus:outline-hidden focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1">
                          Vehicle Plate No.
                        </label>
                        <input
                          type="text"
                          value={vehicleNumberInput}
                          onChange={(e) => setVehicleNumberInput(e.target.value)}
                          placeholder="e.g. RJ-14-XX-1234"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs font-mono uppercase font-semibold text-stone-900 dark:text-white focus:outline-hidden focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1">
                          Vehicle Type
                        </label>
                        <select
                          value={vehicleTypeInput}
                          onChange={(e) => {
                            setVehicleTypeInput(e.target.value as DeliveryPartnerVehicle);
                            setVehicleTypeTouched(true);
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-900 dark:text-white focus:outline-hidden focus:border-amber-500"
                        >
                          <option value="bike">Motorcycle</option>
                          <option value="scooter">Scooter</option>
                          <option value="electric_ev">EV Bike</option>
                          <option value="van">Cool-Van</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    id="btn-send-sms-otp"
                    type="button"
                    onClick={handleSendSmsOtp}
                    disabled={isSendingOtp}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSendingOtp ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{isSendingOtp ? 'Sending SMS OTP...' : 'Send SMS Verification Code'}</span>
                  </button>
                </div>
              ) : (
                /* STEP 2: ENTER OTP */
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <div>
                      <span>Code sent to </span>
                      <strong className="font-mono font-bold">+91 {smsPhoneInput}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-amber-700 dark:text-amber-400 font-bold hover:underline cursor-pointer ml-2"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block mb-1.5">
                      Enter 6-Digit SMS Code
                    </label>
                    <input
                      id="sms-login-otp-input"
                      type="text"
                      maxLength={6}
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      placeholder="123456"
                      className="w-full px-4 py-3 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white font-mono text-center text-xl tracking-[0.4em] font-bold focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  {/* On-screen code preview: shown only because no real SMS gateway is
                      configured yet. Remove this once one is (see server ADMIN setup). */}
                  {otpPreview && (
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      No SMS provider configured — your code: <strong className="font-mono text-stone-700 dark:text-stone-200">{otpPreview}</strong>
                    </div>
                  )}

                  <button
                    id="btn-verify-sms-otp"
                    type="button"
                    onClick={handleVerifySmsOtp}
                    disabled={isVerifyingOtp}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isVerifyingOtp ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>{isVerifyingOtp ? 'Verifying Rider...' : 'Verify & Open Delivery Hub'}</span>
                  </button>

                  <div className="text-center pt-1">
                    {otpCountdown > 0 ? (
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        Resend OTP in <strong className="text-amber-600 dark:text-amber-400 font-mono">{otpCountdown}s</strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendSmsOtp}
                        className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                      >
                        Resend SMS OTP
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* AUTHENTICATED DELIVERY DASHBOARD */
          <>
            {/* METRICS BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-stone-100/70 dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-xs">
              <div className="p-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Bike className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 uppercase font-bold block">
                    Active Deliveries
                  </span>
                  <span className="font-mono text-lg font-black text-stone-900 dark:text-white">
                    {activeDeliveries.length}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 uppercase font-bold block">
                    Completed Today
                  </span>
                  <span className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {completedDeliveries.length} runs
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 uppercase font-bold block">
                    Est. Payout Today
                  </span>
                  <span className="font-mono text-lg font-black text-purple-600 dark:text-purple-400">
                    ₹{todaysEarnings}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 uppercase font-bold block">
                    Waiting for Pickup
                  </span>
                  <span className="font-mono text-lg font-black text-blue-600 dark:text-blue-400">
                    {availableOrders.length} orders
                  </span>
                </div>
              </div>
            </div>

            {/* NAVIGATION TABS */}
            <div className="px-4 sm:px-6 pt-3 border-b border-stone-200 dark:border-stone-800 flex items-center gap-2 bg-stone-50 dark:bg-stone-950/30">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
                  activeTab === 'active'
                    ? 'border-amber-500 text-amber-700 dark:text-amber-400 bg-white dark:bg-stone-900'
                    : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Active Run &amp; Live Route Map</span>
                {activeDeliveries.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[10px] font-black">
                    {activeDeliveries.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('available')}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
                  activeTab === 'available'
                    ? 'border-amber-500 text-amber-700 dark:text-amber-400 bg-white dark:bg-stone-900'
                    : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Available Kitchen Orders</span>
                {availableOrders.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-black">
                    {availableOrders.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
                  activeTab === 'completed'
                    ? 'border-amber-500 text-amber-700 dark:text-amber-400 bg-white dark:bg-stone-900'
                    : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed Today ({completedDeliveries.length})</span>
              </button>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-stone-50/50 dark:bg-stone-900/30">
              {/* TAB 1: ACTIVE RUN & ROUTE MAP */}
              {activeTab === 'active' && (
                <div className="space-y-6">
                  {activeDeliveries.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-3xl bg-white dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 shadow-xs">
                      <div className="w-14 h-14 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-400 flex items-center justify-center mx-auto mb-3">
                        <Bike className="w-7 h-7" />
                      </div>
                      <h3 className="text-lg font-bold text-stone-800 dark:text-stone-200">
                        No Active Delivery Runs
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto mt-1">
                        You currently don&apos;t have any active orders assigned. Switch to &ldquo;Available Kitchen Orders&rdquo; tab to claim freshly prepared delivery packages from OTT Kitchen.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('available')}
                        className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                      >
                        View Available Orders ({availableOrders.length})
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Active Order Selector if rider has multiple */}
                      {activeDeliveries.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                          <span className="text-xs text-stone-500 dark:text-stone-400 font-bold shrink-0">
                            Active Runs:
                          </span>
                          {activeDeliveries.map((ord) => (
                            <button
                              key={ord.id}
                              type="button"
                              onClick={() => setSelectedOrderId(ord.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                ord.id === currentActiveOrder?.id
                                  ? 'bg-amber-500 text-stone-950'
                                  : 'bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-300 hover:bg-stone-300'
                              }`}
                            >
                              Order #{ord.id} • {ord.customerName}
                            </button>
                          ))}
                        </div>
                      )}

                      {currentActiveOrder && (
                        <div className="space-y-6">
                          {/* 1. THE ROUTE MAP */}
                          <DeliveryPartnerRouteMap
                            order={currentActiveOrder}
                            partner={selectedPartner}
                            onUpdateLocation={(lat, lng, speed, label) => {
                              api
                                .pingRiderLocation(deliveryToken, currentActiveOrder.id, {
                                  lat,
                                  lng,
                                  speedKmh: speed,
                                  currentLocationLabel: label,
                                })
                                .catch(() => {});
                            }}
                          />

                          {/* 2. STAGE UPDATE CONTROLLER */}
                          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 shadow-xs">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                  Order Delivery Progress
                                </span>
                                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                                  #{currentActiveOrder.id}
                                </span>
                              </div>
                              <span className="text-xs text-stone-500 dark:text-stone-400">
                                Current Stage:{' '}
                                <strong className="text-amber-600 dark:text-amber-300 capitalize font-bold">
                                  {currentActiveOrder.deliveryTracking?.stage || 'assigned'}
                                </strong>
                              </span>
                            </div>

                            {/* One-Tap Stage Action Buttons */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateStage(currentActiveOrder.id, 'arrived_at_pickup')}
                                className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center text-center transition-all cursor-pointer ${
                                  currentActiveOrder.deliveryTracking?.stage === 'arrived_at_pickup'
                                    ? 'bg-amber-500 text-stone-950 ring-2 ring-amber-400'
                                    : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700'
                                }`}
                              >
                                <Store className="w-4 h-4 mb-1" />
                                <span>1. Reached OTT Kitchen</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleUpdateStage(currentActiveOrder.id, 'picked_up')}
                                className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center text-center transition-all cursor-pointer ${
                                  currentActiveOrder.deliveryTracking?.stage === 'picked_up'
                                    ? 'bg-amber-500 text-stone-950 ring-2 ring-amber-400'
                                    : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700'
                                }`}
                              >
                                <Package className="w-4 h-4 mb-1" />
                                <span>2. Picked Up Food</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleUpdateStage(currentActiveOrder.id, 'on_the_way')}
                                className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center text-center transition-all cursor-pointer ${
                                  currentActiveOrder.deliveryTracking?.stage === 'on_the_way'
                                    ? 'bg-amber-500 text-stone-950 ring-2 ring-amber-400'
                                    : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700'
                                }`}
                              >
                                <Bike className="w-4 h-4 mb-1" />
                                <span>3. On The Way</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleUpdateStage(currentActiveOrder.id, 'near_destination')}
                                className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center text-center transition-all cursor-pointer ${
                                  currentActiveOrder.deliveryTracking?.stage === 'near_destination'
                                    ? 'bg-amber-500 text-stone-950 ring-2 ring-amber-400'
                                    : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700'
                                }`}
                              >
                                <MapPin className="w-4 h-4 mb-1" />
                                <span>4. At Customer Gate</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Confirm order #${currentActiveOrder.id} has been safely handed over to ${currentActiveOrder.customerName}?`
                                    )
                                  ) {
                                    handleUpdateStage(currentActiveOrder.id, 'delivered');
                                  }
                                }}
                                className="p-2.5 rounded-xl text-xs font-bold flex flex-col items-center text-center transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-md hover:scale-102 col-span-2 sm:col-span-1"
                              >
                                <CheckCircle2 className="w-4 h-4 mb-1" />
                                <span>5. Mark Delivered</span>
                              </button>
                            </div>
                          </div>

                          {/* 3. ORDER DETAILS & PACKING CHECKLIST */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Customer & Address Details */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-3.5 shadow-xs">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                                  Customer &amp; Dropoff Location
                                </h4>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                                  Kukas Corridor
                                </span>
                              </div>

                              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800/80 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-bold text-stone-900 dark:text-white">
                                    {currentActiveOrder.customerName}
                                  </div>
                                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                                    ₹{currentActiveOrder.total}
                                  </span>
                                </div>

                                <div className="text-xs text-stone-700 dark:text-stone-300 flex items-start gap-1.5 leading-relaxed">
                                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                  <span>{currentActiveOrder.deliveryAddress || 'SP 41 B, Kukas, Jaipur'}</span>
                                </div>

                                {/* Call & WhatsApp Customer Action Bar */}
                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200 dark:border-stone-800">
                                  <a
                                    href={`tel:${currentActiveOrder.customerPhone}`}
                                    className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>Call Customer</span>
                                  </a>

                                  <a
                                    href={`https://wa.me/91${(currentActiveOrder.customerPhone || '').replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(
                                      `Hello ${currentActiveOrder.customerName}, I am your OTT Delivery Partner (${selectedPartner.name}) for Order #${currentActiveOrder.id}. I am on my way!`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>WhatsApp</span>
                                  </a>
                                </div>

                                {/* One-Tap Google Maps GPS Route */}
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                                    currentActiveOrder.deliveryAddress || 'SP 41 B Kukas Jaipur'
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full py-2.5 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                                >
                                  <Navigation className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
                                  <span>Open Google Maps Turn-by-Turn GPS</span>
                                  <ExternalLink className="w-3 h-3 opacity-60" />
                                </a>
                              </div>

                              {currentActiveOrder.notes && (
                                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-300">
                                  <strong>Customer Dropoff Note:</strong> {currentActiveOrder.notes}
                                </div>
                              )}

                              {/* Payment Collection Warning */}
                              <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs">
                                <span className="text-stone-500 dark:text-stone-400">Payment Due:</span>
                                {currentActiveOrder.paymentMethod === 'cash' ? (
                                  <span className="font-bold text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40">
                                    COLLECT CASH: ₹{currentActiveOrder.total}
                                  </span>
                                ) : (
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40">
                                    PREPAID (Do Not Collect Cash)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Items Checklist for Rider Verification */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-3 shadow-xs">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                  Package Items Checklist
                                </h4>
                                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                                  {currentActiveOrder.items.length} items
                                </span>
                              </div>

                              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                {currentActiveOrder.items.map((item, idx) => {
                                  const key = `${currentActiveOrder.id}-${idx}`;
                                  const isChecked = checkedItems[key] || false;
                                  return (
                                    <div
                                      key={idx}
                                      onClick={() => toggleItemCheck(key)}
                                      className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                                        isChecked
                                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                                          : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        {isChecked ? (
                                          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        ) : (
                                          <Square className="w-4 h-4 text-stone-400 shrink-0" />
                                        )}
                                        <span className="font-medium">
                                          {item.quantity}x {item.name}
                                        </span>
                                      </div>
                                      <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
                                        ₹{item.price * item.quantity}
                                      </span>
                                    </div>
                                  );
                                })}

                                {currentActiveOrder.customCakeDetails && (
                                  <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Cake className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                      <span>
                                        Custom Cake ({currentActiveOrder.customCakeDetails.flavor},{' '}
                                        {currentActiveOrder.customCakeDetails.weightKg}kg)
                                      </span>
                                    </div>
                                    <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">
                                      Handle with Care
                                    </span>
                                  </div>
                                )}
                              </div>

                              <p className="text-[10px] text-stone-500 dark:text-stone-400 italic">
                                Tap items above to verify tamper-proof sealed containers before leaving the kitchen.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: AVAILABLE ORDERS (UNASSIGNED PICKUPS) */}
              {activeTab === 'available' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                        Orders Awaiting Rider Pickup
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Fresh delivery orders placed at Out of the Town Restro &amp; Bakery
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchOrders(false)}
                      className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Queue</span>
                    </button>
                  </div>

                  {availableOrders.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-3xl bg-white dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 shadow-xs">
                      <Package className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
                        All Orders are Currently Dispatched
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                        Check back in a few minutes or wait for new incoming orders from Kukas &amp; Jaipur customers.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="p-4 rounded-2xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 hover:border-amber-500 transition-all space-y-3 shadow-md"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                                  #{ord.id}
                                </span>
                                <span className="text-xs font-bold text-stone-900 dark:text-white">
                                  {ord.customerName}
                                </span>
                              </div>
                              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span className="truncate">{ord.deliveryAddress || 'Kukas, Jaipur'}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400 block">
                                ₹{ord.total}
                              </span>
                              <span className="text-[10px] text-stone-500 uppercase">{ord.paymentMethod}</span>
                            </div>
                          </div>

                          <div className="text-xs text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-900 p-2 rounded-xl border border-stone-200 dark:border-stone-800">
                            <span className="text-stone-500 dark:text-stone-400">Items: </span>
                            {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                            {ord.customCakeDetails && ` • Custom Cake (${ord.customCakeDetails.flavor})`}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-850">
                            <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-500" />
                              <span>Status: {ord.status}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleClaimOrder(ord.id)}
                              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Bike className="w-3.5 h-3.5" />
                              <span>Accept &amp; Deliver</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: COMPLETED DELIVERIES */}
              {activeTab === 'completed' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                        Today&apos;s Delivered Orders
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Runs completed by {selectedPartner.name} on {selectedPartner.vehicleNumber}
                      </p>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                      Total Earned: ₹{todaysEarnings}
                    </div>
                  </div>

                  {completedDeliveries.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-3xl bg-white dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 shadow-xs">
                      <CheckCircle2 className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
                        No Completed Runs Today Yet
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                        When you finish your active deliveries, your delivery history and earnings will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {completedDeliveries.map((ord) => (
                        <div
                          key={ord.id}
                          className="p-3.5 rounded-2xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-stone-700 dark:text-stone-200">
                                  #{ord.id}
                                </span>
                                <span className="font-bold text-stone-900 dark:text-white">
                                  {ord.customerName}
                                </span>
                              </div>
                              <span className="text-stone-500 dark:text-stone-400 text-[11px] truncate block">
                                {ord.deliveryAddress || 'Jaipur Doorstep'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                                +₹80 payout
                              </span>
                              <span className="text-[10px] text-stone-500 dark:text-stone-400">
                                {ord.deliveryTracking?.deliveredAt
                                  ? new Date(ord.deliveryTracking.deliveredAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : 'Delivered'}
                              </span>
                            </div>
                            {onOpenOrderDetails && (
                              <button
                                type="button"
                                onClick={() => onOpenOrderDetails(ord)}
                                className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
                                title="View Full Order Invoice"
                              >
                                <Receipt className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* FOOTER CONTROLS */}
            <div className="p-4 bg-white dark:bg-stone-950 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 dark:text-stone-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  OTT Kitchen Dispatch: <strong className="text-stone-800 dark:text-stone-200">SP 41 B, RIICO Kukas (NH-48)</strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href="tel:+919828919626"
                  className="hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-500" />
                  <span>Kitchen Helpline: +91 98289 19626</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold border border-stone-300 dark:border-stone-700 transition-colors cursor-pointer"
                >
                  Close Portal
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Real-time Delivery Assignment Modal with Chime & Customer Location */}
      {activeAlertNotif && (
        <NewDeliveryAlertModal
          notification={activeAlertNotif}
          onAccept={handleAcceptAlert}
          onDismiss={handleDismissAlert}
        />
      )}
    </div>
  );
};
