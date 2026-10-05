import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  X,
  ChevronRight,
  ShoppingBag,
  LogOut,
  LogIn,
  Clock,
  AlertCircle,
  RefreshCw,
  Cake,
  Bike,
  Navigation,
  MapPin,
  Moon,
  Sun,
  Calendar,
  Utensils,
  ThumbsUp,
  Info,
  Phone,
  Settings,
  Plus,
  Trash2,
  Edit3,
  Check,
  ExternalLink,
  Sparkles,
  Store,
  ShieldCheck,
  Award,
  Ban,
  MapPinned,
  User,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { Order, Reservation } from '../types';
import {
  getSavedAddresses,
  saveAddress,
  deleteAddress,
  setDefaultAddress,
  type SavedAddress,
} from '../utils/savedAddresses';

export interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReservation: () => void;
  onOpenAdmin?: () => void;
  isAuthorizedAdmin?: boolean;
  onOpenCustomCake?: () => void;
  onSelectOrder?: (order: Order) => void;
  vegOnly?: boolean;
  onToggleVegOnly?: () => void;
}

type ProfileView = 'main' | 'orders' | 'reservations' | 'address_book' | 'about';

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenReservation,
  onOpenAdmin,
  isAuthorizedAdmin = false,
  onOpenCustomCake,
  onSelectOrder,
  vegOnly = false,
  onToggleVegOnly,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { customer, customerToken, isAuthenticated, logout, openAuthModal } = useAuth();

  // Internal views: 'main', 'orders', 'reservations', 'address_book', 'about'
  const [currentView, setCurrentView] = useState<ProfileView>('main');

  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Address Book state
  const [addresses, setAddresses] = useState<SavedAddress[]>(() => getSavedAddresses());
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrLabel, setAddrLabel] = useState<'Home' | 'Work' | 'Campus' | 'Other'>('Home');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrLine, setAddrLine] = useState('');
  const [addrLandmark, setAddrLandmark] = useState('');
  const [addrPincode, setAddrPincode] = useState('302038');
  const [addrIsDefault, setAddrIsDefault] = useState(false);

  // Cancelling order in orders list
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  // Load customer's private data
  const fetchCustomerData = async () => {
    if (!isOpen || (!isAuthenticated && !customer)) {
      setOrders([]);
      setReservations([]);
      return;
    }

    try {
      setIsLoadingData(true);
      setLoadError(null);
      const [userOrders, userResvs] = await Promise.all([
        api.getMyOrders(customerToken || undefined),
        api.getMyReservations(customerToken || undefined),
      ]);
      setOrders(userOrders);
      setReservations(userResvs);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load your personal orders');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isOpen && (isAuthenticated || customer)) {
      fetchCustomerData();
    }
  }, [isOpen, isAuthenticated, customerToken, currentView]);

  if (!isOpen) return null;

  const handleOpenLogin = () => {
    onClose();
    openAuthModal('account');
  };

  // Extract initial for avatar (skip the generic "Valued Guest" placeholder name)
  const hasRealName = isAuthenticated && customer?.name && customer.name !== 'Valued Guest';
  const initial = hasRealName ? customer!.name.charAt(0).toUpperCase() : null;

  const displayName = isAuthenticated && customer?.name
    ? customer.name
    : 'Guest Customer';

  const displayEmail = isAuthenticated && customer?.email
    ? customer.email
    : isAuthenticated && customer?.phone
    ? `+91 ${customer.phone}`
    : 'Sign in to view orders & bookings';

  // Address book actions
  const handleOpenAddAddress = () => {
    setEditingAddrId(null);
    setAddrLabel('Home');
    setAddrRecipient(customer?.name || '');
    setAddrPhone(customer?.phone || '');
    setAddrLine('');
    setAddrLandmark('');
    setAddrPincode('302038');
    setAddrIsDefault(addresses.length === 0);
    setIsEditingAddress(true);
  };

  const handleOpenEditAddress = (addr: SavedAddress) => {
    setEditingAddrId(addr.id);
    setAddrLabel((addr.label as any) || 'Home');
    setAddrRecipient(addr.recipientName);
    setAddrPhone(addr.recipientPhone);
    setAddrLine(addr.addressLine);
    setAddrLandmark(addr.landmark || '');
    setAddrPincode(addr.pincode || '302038');
    setAddrIsDefault(Boolean(addr.isDefault));
    setIsEditingAddress(true);
  };

  const handleSaveAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrLine.trim() || !addrRecipient.trim() || !addrPhone.trim()) {
      showToast('Please fill required address fields');
      return;
    }

    const updated = saveAddress({
      id: editingAddrId || undefined,
      label: addrLabel,
      recipientName: addrRecipient.trim(),
      recipientPhone: addrPhone.trim(),
      addressLine: addrLine.trim(),
      landmark: addrLandmark.trim() || undefined,
      pincode: addrPincode.trim() || undefined,
      isDefault: addrIsDefault,
    });

    setAddresses(updated);
    setIsEditingAddress(false);
    showToast(editingAddrId ? 'Address updated successfully' : 'New address saved to your address book');
  };

  const handleDeleteAddress = (id: string) => {
    const updated = deleteAddress(id);
    setAddresses(updated);
    showToast('Address removed from address book');
  };

  const handleSetDefaultAddress = (id: string) => {
    const updated = setDefaultAddress(id);
    setAddresses(updated);
    showToast('Default delivery address updated');
  };

  const handleCancelOrderFromList = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to cancel Order #${orderId}? This cannot be undone.`)) {
      return;
    }
    try {
      setCancellingOrderId(orderId);
      const updated = await api.cancelOrder(orderId, 'Cancelled by customer from profile orders', customerToken || undefined);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      showToast(`Order #${orderId} has been cancelled`);
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel order. It may have already been dispatched.');
    } finally {
      setCancellingOrderId(null);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="customer-profile-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs overflow-hidden"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 25, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 25, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md h-full sm:h-[90vh] sm:max-h-[820px] bg-[#f4f5f7] dark:bg-stone-950 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-stone-900 dark:text-stone-100 border-0 sm:border border-stone-200/80 dark:border-stone-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Sticky Navigation Bar with Back Arrow */}
          <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#f4f5f7] dark:bg-stone-950 border-b border-stone-200/60 dark:border-stone-800/60">
            <button
              id="customer-menu-back-btn"
              onClick={() => {
                if (currentView !== 'main') {
                  setCurrentView('main');
                } else {
                  onClose();
                }
              }}
              className="p-2 -ml-2 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <span className="font-bold text-sm text-stone-800 dark:text-stone-200">
              {currentView === 'main'
                ? ''
                : currentView === 'orders'
                ? 'Your Orders'
                : currentView === 'reservations'
                ? 'Your Table Bookings'
                : currentView === 'address_book'
                ? 'Address Book'
                : 'About Out of the Town'}
            </span>

            <button
              id="customer-menu-close-btn"
              onClick={onClose}
              className="p-2 -mr-2 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Toast Notification */}
          {feedbackToast && (
            <div className="mx-4 mt-2 p-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
              <span>{feedbackToast}</span>
              <button onClick={() => setFeedbackToast(null)} className="text-stone-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3 space-y-3.5">
            {/* VIEW 1: ZOMATO-STYLE MAIN CUSTOMER MENU */}
            {currentView === 'main' && (
              <>
                {/* 1. TOP PROFILE CARD OR AUTH BUTTONS */}
                {isAuthenticated ? (
                  <div className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl p-4 shadow-2xs border border-stone-200/70 dark:border-stone-800/80">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Avatar Circle */}
                        <div className="w-13 h-13 rounded-full font-extrabold text-xl flex items-center justify-center shrink-0 shadow-inner bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
                          {initial ?? <User className="w-6 h-6 text-blue-500 dark:text-blue-400" />}
                        </div>

                        <div className="min-w-0 leading-tight">
                          <h2 className="font-bold text-lg sm:text-xl text-stone-900 dark:text-stone-100 truncate">
                            {displayName}
                          </h2>
                          <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                            {displayEmail}
                          </p>
                          <button
                            onClick={handleOpenLogin}
                            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-0.5 mt-1.5 cursor-pointer"
                          >
                            <span>Edit profile</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl p-5 shadow-2xs border border-stone-200/70 dark:border-stone-800/80 space-y-4">
                    <div className="text-center mb-1">
                      <h2 className="font-bold text-lg text-stone-900 dark:text-stone-100">Welcome to OTT Cafe</h2>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-[250px] mx-auto">
                        Sign in or create an account to view your orders and track deliveries.
                      </p>
                    </div>
                    <div className="flex gap-2.5">
                       <button
                          onClick={handleOpenLogin}
                          className="flex-[5] py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-sm shadow-md transition-colors cursor-pointer"
                        >
                          Sign Up
                        </button>
                        <button
                          onClick={handleOpenLogin}
                          className="flex-[4] py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-bold text-sm shadow-sm transition-colors cursor-pointer"
                        >
                          Log In
                        </button>
                    </div>
                  </div>
                )}

                {/* 2. GROUP 1: YOUR PREFERENCES */}
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs tracking-wide text-stone-700 dark:text-stone-300 mb-2 px-1">
                    <span className="w-0.5 h-3.5 bg-rose-600 rounded-full inline-block" />
                    <span>Your preferences</span>
                  </div>

                  <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/70 dark:border-stone-800/80 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800/70 shadow-2xs">
                    {/* Veg Mode */}
                    <button
                      type="button"
                      onClick={() => {
                        onToggleVegOnly?.();
                        showToast(`Pure Veg Mode ${!vegOnly ? 'Enabled' : 'Disabled'}`);
                      }}
                      className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        {/* Green Veg Icon */}
                        <div className="w-5 h-5 rounded-md border-2 border-emerald-600 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                        </div>
                        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                          Veg Mode
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${vegOnly ? 'text-emerald-600' : 'text-stone-400'}`}>
                          {vegOnly ? 'On' : 'Off'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>

                    {/* Appearance */}
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 flex items-center justify-center text-stone-600 dark:text-stone-300">
                          {isDark ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
                        </div>
                        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                          Appearance
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-stone-400 font-medium">
                          {isDark ? 'Dark' : 'Light'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  </div>
                </div>

                {/* 4. GROUP 2: FOOD DELIVERY */}
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs tracking-wide text-stone-700 dark:text-stone-300 mb-2 px-1">
                    <span className="w-0.5 h-3.5 bg-rose-600 rounded-full inline-block" />
                    <span>Food delivery</span>
                  </div>

                  <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/70 dark:border-stone-800/80 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800/70 shadow-2xs">
                    {/* Your orders */}
                    <button
                      type="button"
                      onClick={() => setCurrentView('orders')}
                      className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <ShoppingBag className="w-4.5 h-4.5 text-stone-600 dark:text-stone-300" />
                        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                          Your orders
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {orders.length > 0 && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                            {orders.length}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>

                    {/* Your Table Bookings */}
                    <button
                      type="button"
                      onClick={() => setCurrentView('reservations')}
                      className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4.5 h-4.5 text-stone-600 dark:text-stone-300" />
                        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                          Table Bookings
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {reservations.length > 0 && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                            {reservations.length}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>

                    {/* Address book */}
                    <button
                      type="button"
                      onClick={() => setCurrentView('address_book')}
                      className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
                        <div>
                          <span className="text-sm font-semibold text-stone-800 dark:text-stone-200 block">
                            Address book
                          </span>
                          <span className="text-[11px] text-stone-400 block">
                            {addresses.length} saved {addresses.length === 1 ? 'address' : 'addresses'} for Kukas &amp; Jaipur
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Exclusive Admin Panel Access - Visible ONLY to the authenticated owner or authorized staff */}
                    {onOpenAdmin && isAuthenticated && (isAuthorizedAdmin || (customer?.email && customer.email.toLowerCase().trim() === 'kumarsatyam5868@gmail.com')) && (
                      <button
                        type="button"
                        id="profile-menu-admin-portal-btn"
                        onClick={() => {
                          onClose();
                          onOpenAdmin();
                        }}
                        className="w-full flex items-center justify-between p-3 bg-linear-to-r from-amber-500/10 via-amber-600/15 to-amber-700/10 hover:from-amber-500/20 hover:to-amber-700/20 text-left transition-all cursor-pointer group border-t border-amber-500/25"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <ShieldCheck className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                                Restaurant Admin Suite
                              </span>
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-600 text-white shadow-2xs">
                                {customer?.email?.toLowerCase().trim() === 'kumarsatyam5868@gmail.com' ? 'Owner' : 'Staff'}
                              </span>
                            </div>
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium block">
                              Orders, Menu, Staff Access &amp; Revenue
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. GROUP 3: DINING & EXPERIENCES */}
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs tracking-wide text-stone-700 dark:text-stone-300 mb-2 px-1">
                    <span className="w-0.5 h-3.5 bg-rose-600 rounded-full inline-block" />
                    <span>Dining &amp; experiences</span>
                  </div>

                  <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/70 dark:border-stone-800/80 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800/70 shadow-2xs">
                    {/* Your bookings */}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReservation();
                      }}
                      className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4.5 h-4.5 text-stone-600 dark:text-stone-300" />
                        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                          Your bookings &amp; table reservation
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-emerald-600 font-bold">Book Table</span>
                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>

                    {/* Custom Cake Studio */}
                    {onOpenCustomCake && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCustomCake();
                        }}
                        className="w-full flex items-center justify-between p-3 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <Cake className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                          <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                            Design a Cake &amp; Bakery Pre-order
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    )}

                    {/* Dining help */}
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = 'tel:+919828919626';
                      }}
                      className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <Utensils className="w-4.5 h-4.5 text-stone-600 dark:text-stone-300" />
                        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                          Dining Help &amp; Concierge
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* 6. GROUP 4: MORE & HELPLINE */}
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs tracking-wide text-stone-700 dark:text-stone-300 mb-2 px-1">
                    <span className="w-0.5 h-3.5 bg-rose-600 rounded-full inline-block" />
                    <span>More</span>
                  </div>

                  <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/70 dark:border-stone-800/80 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800/70 shadow-2xs">
                    {/* Your feedback */}
                    <button
                      type="button"
                      onClick={() => {
                        window.open('https://maps.google.com/?q=Out+of+the+Town+-+Restro+and+Bakery,+Kukas,+Jaipur', '_blank');
                      }}
                      className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <ThumbsUp className="w-4.5 h-4.5 text-stone-600 dark:text-stone-300" />
                        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                          Your feedback &amp; reviews
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* About with full dedicated interactive view */}
                    <button
                      type="button"
                      onClick={() => setCurrentView('about')}
                      className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <Info className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <span className="text-sm font-semibold text-stone-800 dark:text-stone-200 block">
                            About Out of the Town (Kukas)
                          </span>
                          <span className="text-[11px] text-stone-400 block">
                            Restro, Bakery &amp; Party Hall
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Direct Cafe Helpline */}
                    <a
                      href="tel:+919828919626"
                      className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <Phone className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <div className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                            Call Cafe Direct
                          </div>
                          <div className="text-[11px] text-stone-400">
                            +91 98289 19626 • 11:00 AM – 12:00 AM
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Call Now
                      </span>
                    </a>

                    {/* Log out / Sign in */}
                    {isAuthenticated ? (
                      <button
                        type="button"
                        id="customer-menu-logout-row"
                        onClick={() => {
                          logout();
                          showToast('Signed out successfully');
                        }}
                        className="w-full flex items-center justify-between p-3 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <LogOut className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
                          <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                            Log out
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        id="customer-menu-login-row"
                        onClick={handleOpenLogin}
                        className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <LogIn className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                          <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                            Sign in to your account
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2 pb-6 text-center text-[11px] text-stone-400">
                  <span>Out of the Town • Kukas, Jaipur (NH-48)</span>
                  <p className="text-[10px] text-stone-400/80 mt-0.5">Version 2.4.0 • Made with ❤️</p>
                </div>
              </>
            )}

            {/* VIEW 2: YOUR ORDERS */}
            {currentView === 'orders' && (
              <div className="space-y-3 pb-6">
                {isLoadingData ? (
                  <div className="py-16 text-center text-stone-400 flex flex-col items-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
                    <span className="text-xs">Loading your orders...</span>
                  </div>
                ) : loadError ? (
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-xs flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{loadError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={fetchCustomerData}
                      className="self-start inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-16 text-center text-stone-500">
                    <ShoppingBag className="w-12 h-12 mx-auto text-stone-300 dark:text-stone-700 mb-3" />
                    <p className="font-bold text-base text-stone-800 dark:text-stone-200">No orders yet</p>
                    <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                      Your delicious orders placed will appear here with live tracking.
                    </p>
                    <button
                      onClick={onClose}
                      className="mt-4 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-md"
                    >
                      Explore Food Menu
                    </button>
                  </div>
                ) : (
                  orders.map((ord) => {
                    const isDeliveryOrder = ord.orderType === 'delivery' || Boolean(ord.deliveryAddress);
                    const isOrderActive = ord.status !== 'delivered' && ord.status !== 'cancelled';

                    return (
                      <div
                        key={ord.id}
                        onClick={() => {
                          onSelectOrder?.(ord);
                          onClose();
                        }}
                        className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 hover:border-amber-500 transition-all cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-stone-900 dark:text-stone-100 group-hover:text-amber-600 transition-colors">
                                #{ord.id}
                              </span>
                              {(ord.isCustomCake || ord.customCakeDetails) && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1">
                                  <Cake className="w-3 h-3" /> Custom Cake
                                </span>
                              )}
                              {isDeliveryOrder && isOrderActive && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                  Live GPS
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-400 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(ord.createdAt).toLocaleDateString()} at {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            ord.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : ord.status === 'cancelled'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {ord.status === 'ready' && isDeliveryOrder ? 'Out for Delivery' : ord.status}
                          </span>
                        </div>

                        {/* Items list preview */}
                        <div className="text-xs text-stone-600 dark:text-stone-300 space-y-1 mb-3 pt-2 border-t border-stone-100 dark:border-stone-800">
                          {ord.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span>{item.quantity}x {item.name}</span>
                              <span className="font-mono">₹{item.price * item.quantity}</span>
                            </div>
                          ))}
                        </div>

                        {/* Card Footer with Price & Track Button */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-stone-100 dark:border-stone-800 text-xs">
                          <div>
                            <span className="text-stone-400 text-[10px] block">Total Amount</span>
                            <span className="font-bold font-mono text-stone-900 dark:text-stone-100 text-sm">
                              ₹{ord.total}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Cancel order button if not yet picked up by rider */}
                            {(() => {
                              const isDispatched =
                                ord.status === 'ready' ||
                                ord.status === 'delivered' ||
                                ord.status === 'cancelled' ||
                                ord.deliveryTracking?.stage === 'picked_up' ||
                                ord.deliveryTracking?.stage === 'on_the_way' ||
                                ord.deliveryTracking?.stage === 'near_destination';
                              const canCancelThis = !isDispatched && ['pending', 'accepted', 'preparing'].includes(ord.status);
                              if (!canCancelThis) return null;
                              return (
                                <button
                                  type="button"
                                  disabled={cancellingOrderId === ord.id}
                                  onClick={(e) => handleCancelOrderFromList(ord.id, e)}
                                  className="px-2.5 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>{cancellingOrderId === ord.id ? 'Cancelling...' : 'Cancel'}</span>
                                </button>
                              );
                            })()}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectOrder?.(ord);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs flex items-center gap-1.5 shadow-xs"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>Track Order</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* VIEW 3: YOUR RESERVATIONS */}
            {currentView === 'reservations' && (
              <div className="space-y-3 pb-6">
                {reservations.length === 0 ? (
                  <div className="py-16 text-center text-stone-500">
                    <Calendar className="w-12 h-12 mx-auto text-stone-300 mb-3" />
                    <p className="font-bold text-base text-stone-800 dark:text-stone-200">No table bookings yet</p>
                    <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                      Reserve a starlit terrace table or family AC dining at Kukas restro.
                    </p>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenReservation();
                      }}
                      className="mt-4 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-md"
                    >
                      Book Table Now
                    </button>
                  </div>
                ) : (
                  reservations.map((resv) => (
                    <div
                      key={resv.id}
                      className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-bold text-xs">Booking #{resv.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            resv.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : resv.status === 'cancelled'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {resv.status === 'confirmed' ? 'APPROVED' : resv.status === 'cancelled' ? 'CANCELLED' : 'PENDING'}
                        </span>
                      </div>
                      <div className="text-xs space-y-1 text-stone-600 dark:text-stone-300">
                        <div><strong>Date &amp; Time:</strong> {resv.date} at {resv.time}</div>
                        <div><strong>Guests:</strong> {resv.guestCount} Guests</div>
                        <div><strong>Seating Area:</strong> {resv.seatingArea.replace('_', ' ')}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* VIEW 4: ADDRESS BOOK */}
            {currentView === 'address_book' && (
              <div className="space-y-4 pb-6">
                {/* Header row with Add button */}
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                      Saved Delivery Addresses
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Manage your home, office, college or other locations.
                    </p>
                  </div>
                  {!isEditingAddress && (
                    <button
                      type="button"
                      onClick={handleOpenAddAddress}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New</span>
                    </button>
                  )}
                </div>

                {/* Form when adding or editing address */}
                {isEditingAddress ? (
                  <form
                    onSubmit={handleSaveAddressSubmit}
                    className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-amber-500/40 shadow-md space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
                      <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                        {editingAddrId ? 'Edit Address' : 'Add New Address'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingAddress(false)}
                        className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Address Tag Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                        Address Label
                      </label>
                      <div className="flex items-center gap-1.5">
                        {['Home', 'Work', 'Campus', 'Other'].map((lbl) => (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() => setAddrLabel(lbl as any)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              addrLabel === lbl
                                ? 'bg-amber-500 text-stone-950 shadow-xs'
                                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Recipient details */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                          Contact Person *
                        </label>
                        <input
                          type="text"
                          required
                          value={addrRecipient}
                          onChange={(e) => setAddrRecipient(e.target.value)}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full p-2.5 rounded-xl text-xs border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          required
                          value={addrPhone}
                          onChange={(e) => setAddrPhone(e.target.value)}
                          placeholder="e.g. 9828919626"
                          className="w-full p-2.5 rounded-xl text-xs border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                        />
                      </div>
                    </div>

                    {/* Street Address */}
                    <div>
                      <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                        House / Flat / Street Address *
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={addrLine}
                        onChange={(e) => setAddrLine(e.target.value)}
                        placeholder="e.g. Flat 302, Green View Apartments, Near Arya College Campus"
                        className="w-full p-2.5 rounded-xl text-xs border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                      />
                    </div>

                    {/* Landmark & Pincode */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                          Nearby Landmark
                        </label>
                        <input
                          type="text"
                          value={addrLandmark}
                          onChange={(e) => setAddrLandmark(e.target.value)}
                          placeholder="e.g. Opposite Leela Palace"
                          className="w-full p-2.5 rounded-xl text-xs border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                          Pincode
                        </label>
                        <input
                          type="text"
                          value={addrPincode}
                          onChange={(e) => setAddrPincode(e.target.value)}
                          placeholder="302038"
                          className="w-full p-2.5 rounded-xl text-xs border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                        />
                      </div>
                    </div>

                    {/* Default address checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={addrIsDefault}
                        onChange={(e) => setAddrIsDefault(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs text-stone-700 dark:text-stone-300 font-medium">
                        Set as default delivery address
                      </span>
                    </label>

                    {/* Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                      <button
                        type="button"
                        onClick={() => setIsEditingAddress(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-xs"
                      >
                        Save Address
                      </button>
                    </div>
                  </form>
                ) : null}

                {/* List of saved addresses */}
                {addresses.length === 0 ? (
                  <div className="py-12 text-center text-stone-500 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
                    <MapPin className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-700 mb-2" />
                    <p className="font-bold text-stone-800 dark:text-stone-200 text-sm">No saved addresses</p>
                    <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                      Save your home, university campus, or office location for 1-click checkout.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenAddAddress}
                      className="mt-3 px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs"
                    >
                      Add First Address
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className={`p-4 rounded-2xl bg-white dark:bg-stone-900 border transition-all shadow-2xs ${
                          addr.isDefault
                            ? 'border-amber-500/80 ring-1 ring-amber-500/20'
                            : 'border-stone-200/80 dark:border-stone-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold text-xs">
                              {addr.label}
                            </span>
                            {addr.isDefault && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] flex items-center gap-1">
                                <Check className="w-3 h-3" /> Default
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditAddress(addr)}
                              className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                              title="Edit address"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Delete address"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-stone-700 dark:text-stone-300 space-y-1">
                          <p className="font-bold text-stone-900 dark:text-stone-100">
                            {addr.recipientName} • <span className="font-mono">{addr.recipientPhone}</span>
                          </p>
                          <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                            {addr.addressLine}
                          </p>
                          {addr.landmark && (
                            <p className="text-[11px] text-stone-500">
                              <strong>Landmark:</strong> {addr.landmark}
                            </p>
                          )}
                          {addr.pincode && (
                            <p className="text-[11px] text-stone-400 font-mono">
                              PIN: {addr.pincode}
                            </p>
                          )}
                        </div>

                        {!addr.isDefault && (
                          <div className="mt-3 pt-2 border-t border-stone-100 dark:border-stone-800">
                            <button
                              type="button"
                              onClick={() => handleSetDefaultAddress(addr.id)}
                              className="text-xs font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                            >
                              Set as default address
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 5: ABOUT OUT OF THE TOWN (KUKAS) */}
            {currentView === 'about' && (
              <div className="space-y-4 pb-6">
                {/* Hero Card */}
                <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-stone-900 via-stone-850 to-amber-950 text-white p-5 border border-stone-800 shadow-xl relative">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-2 border border-amber-500/30">
                    <Sparkles className="w-3 h-3" />
                    <span>Nearby Landmark</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-serif font-black text-amber-400">
                    Out of the Town
                  </h3>
                  <p className="text-xs text-stone-300 font-medium mt-0.5">
                    Restro, Artisan European Bakery &amp; Celebration Retreat
                  </p>
                  <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                    A multi-sensory oasis along NH-48 Kukas featuring signature peach &amp; sage green illuminated neon arches, plush velvet seating, an authentic North Indian kitchen, and European artisan bakery.
                  </p>
                </div>

                {/* Location & Timings Card */}
                <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 space-y-3 shadow-2xs">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Location &amp; Operating Hours
                  </h4>
                  <div className="space-y-2 text-xs text-stone-700 dark:text-stone-300">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <strong>Address:</strong>
                        <p className="text-stone-500 dark:text-stone-400">
                          SP 41 B, RIICO Industrial Area, NH-48, Kukas, Jaipur, Rajasthan 302038
                        </p>
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                          (Opposite Leela Palace Bypass • Near Arya &amp; Amity College Campuses)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <strong>Hours:</strong> 11:00 AM – 12:00 Midnight (Open Daily 7 Days)
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                      <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <strong>Concierge Helpline:</strong>{' '}
                        <a href="tel:+919828919626" className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                          +91 98289 19626
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Experiences & Pillars */}
                <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 space-y-3 shadow-2xs">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    What Makes Out of the Town Special
                  </h4>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <Utensils className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <strong className="text-stone-900 dark:text-stone-100">Multi-Cuisine Royal Dining:</strong>
                        <p className="text-stone-500 dark:text-stone-400 mt-0.5">
                          Slow-simmered Dal Bukhara, Paneer Tikka platters, wood-fired thin crust pizzas, and gourmet Indian delicacies.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                        <Cake className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <strong className="text-stone-900 dark:text-stone-100">Fresh Artisan European Bakery:</strong>
                        <p className="text-stone-500 dark:text-stone-400 mt-0.5">
                          Daily handcrafted cheesecakes, Belgian chocolate brownies, and custom celebration cakes made fresh on-site.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <strong className="text-stone-900 dark:text-stone-100">Dedicated Celebration Party Hall:</strong>
                        <p className="text-stone-500 dark:text-stone-400 mt-0.5">
                          Private party space with dark botanical wallpapers, balloon arches, and sound setup for up to 35 guests.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <Bike className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <strong className="text-stone-900 dark:text-stone-100">Express Takeaway &amp; GPS Delivery:</strong>
                        <p className="text-stone-500 dark:text-stone-400 mt-0.5">
                          Quick 15-min pickup and live GPS-tracked doorstep delivery across Kukas and surrounding colleges.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compliance & FSSAI */}
                <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 text-[11px] flex items-center justify-between border border-stone-200 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>FSSAI License: <strong>22223074000184</strong></span>
                  </div>
                  <span className="font-bold text-emerald-600">100% Food Safety Certified</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      window.open('https://maps.google.com/?q=Out+of+the+Town+-+Restro+and+Bakery,+Kukas,+Jaipur', '_blank');
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-800 hover:bg-stone-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Get Directions on Maps</span>
                  </button>
                  <a
                    href="tel:+919828919626"
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Restaurant</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
