import React, { useState, useMemo } from 'react';
import {
  Cake,
  Search,
  Filter,
  Phone,
  MessageCircle,
  Calendar,
  Clock,
  MapPin,
  Store,
  CheckCircle2,
  ChefHat,
  AlertCircle,
  Eye,
  Plus,
  Printer,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Ban,
  Check,
  DollarSign,
  User,
  Heart,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import type { Order, OrderStatus, CustomCakeDetails, CafeInfo } from '../../types';
import { api } from '../../services/api';
import { SlideableOptionBar } from './SlideableOptionBar';
import { toLocalDateString } from '../../utils/date';

interface CustomCakesManagementProps {
  orders: Order[];
  token: string;
  onUpdateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    options?: {
      notes?: string;
      acceptedBy?: string;
      acceptedAt?: string;
      estimatedTimeMinutes?: number;
    } | string
  ) => Promise<void>;
  onDeleteOrder?: (orderId: string) => void;
  onCancelOrder?: (orderId: string, reason?: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  cafeInfo?: CafeInfo | null;
  onNewOrderCreated?: (newOrder: Order) => void;
}

export const CustomCakesManagement: React.FC<CustomCakesManagementProps> = ({
  orders,
  token,
  onUpdateOrderStatus,
  onDeleteOrder,
  onCancelOrder,
  onRefresh,
  isLoading,
  cafeInfo,
  onNewOrderCreated,
}) => {
  // Filter out custom cake orders
  const customCakeOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.isCustomCake ||
        !!o.customCakeDetails ||
        o.items?.some(
          (item) =>
            item.menuItemId === 'custom-cake-preorder' ||
            item.name?.toLowerCase().includes('custom cake') ||
            item.name?.toLowerCase().includes('made-to-order cake')
        )
    );
  }, [orders]);

  // Filtering and Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'all' | 'delivery' | 'pickup'>('all');

  // Expanded card tracking
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Image Zoom Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Manual Custom Cake Order Modal State
  const [isManualOrderOpen, setIsManualOrderOpen] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState('');

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    occasion: 'Birthday',
    flavor: 'Belgian Dark Chocolate Truffle',
    weightKg: 1,
    shape: 'Round',
    isEggless: true,
    messageOnCake: '',
    designDescription: '',
    referenceImageUrl: '',
    targetDate: toLocalDateString(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    targetTime: '06:00 PM - 08:00 PM',
    fulfillmentType: 'pickup' as 'pickup' | 'delivery',
    deliveryAddress: '',
    priceQuote: 850,
  });

  // Baker Staff Assignment Modal / Note state
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [bakerName, setBakerName] = useState('Chef Ramesh (Head Pastry Chef)');
  const [bakerNotes, setBakerNotes] = useState('');

  // Price Quote Editing
  const [editingPriceOrder, setEditingPriceOrder] = useState<Order | null>(null);
  const [updatedPrice, setUpdatedPrice] = useState<number>(0);

  // Print slip state
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  // Toggle card expansion
  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Status Metrics
  const metrics = useMemo(() => {
    const total = customCakeOrders.length;
    const pending = customCakeOrders.filter((o) => o.status === 'pending').length;
    const baking = customCakeOrders.filter((o) => o.status === 'accepted' || o.status === 'preparing').length;
    const ready = customCakeOrders.filter((o) => o.status === 'ready').length;
    const completed = customCakeOrders.filter((o) => o.status === 'delivered').length;
    const totalRevenue = customCakeOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return { total, pending, baking, ready, completed, totalRevenue };
  }, [customCakeOrders]);

  // Today's date string (YYYY-MM-DD)
  // Local calendar day -- toISOString() is UTC, a day behind in India before 5:30 AM.
  const todayStr = toLocalDateString(new Date());

  // Filtered list
  const filteredOrders = useMemo(() => {
    return customCakeOrders.filter((ord) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const details = ord.customCakeDetails;
        const matchName = ord.customerName.toLowerCase().includes(query);
        const matchPhone = ord.customerPhone.toLowerCase().includes(query);
        const matchId = ord.id.toLowerCase().includes(query);
        const matchFlavor = details?.flavor?.toLowerCase().includes(query);
        const matchOccasion = details?.occasion?.toLowerCase().includes(query);
        const matchMsg = details?.messageOnCake?.toLowerCase().includes(query);
        const matchDesc = details?.designDescription?.toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchId && !matchFlavor && !matchOccasion && !matchMsg && !matchDesc) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && ord.status !== statusFilter) {
        return false;
      }

      // Fulfillment
      if (fulfillmentFilter !== 'all' && ord.orderType !== fulfillmentFilter) {
        return false;
      }

      // Event Date Filter
      const eventDate = ord.customCakeDetails?.targetDate;
      if (dateFilter !== 'all' && eventDate) {
        if (dateFilter === 'today' && eventDate !== todayStr) return false;
        if (dateFilter === 'upcoming' && eventDate <= todayStr) return false;
        if (dateFilter === 'past' && eventDate >= todayStr) return false;
      }

      return true;
    });
  }, [customCakeOrders, searchQuery, statusFilter, dateFilter, fulfillmentFilter, todayStr]);

  // Handle Baker Assignment / Acceptance
  const handleConfirmAssignment = async () => {
    if (!assigningOrder) return;
    try {
      await onUpdateOrderStatus(assigningOrder.id, 'accepted', {
        acceptedBy: bakerName,
        acceptedAt: new Date().toISOString(),
        notes: bakerNotes ? `Baker Assigned: ${bakerName}. Notes: ${bakerNotes}` : `Baker Assigned: ${bakerName}`,
      });
      setAssigningOrder(null);
      setBakerNotes('');
    } catch (err) {
      console.error('Failed to assign baker:', err);
    }
  };

  // Handle Manual Order Submission (Phone Call / Walk-in)
  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.customerName.trim()) {
      setManualError('Please provide customer name.');
      return;
    }
    const cleanPhone = manualForm.customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setManualError('Please enter a valid 10-digit customer phone number.');
      return;
    }

    try {
      setIsSubmittingManual(true);
      setManualError('');

      const customCakeDetails: CustomCakeDetails = {
        itemType: 'custom_cake',
        occasion: manualForm.occasion,
        flavor: manualForm.flavor,
        weightKg: Number(manualForm.weightKg),
        shape: manualForm.shape,
        isEggless: manualForm.isEggless,
        messageOnCake: manualForm.messageOnCake.trim() || undefined,
        designDescription: manualForm.designDescription.trim() || `Custom ${manualForm.flavor} cake for ${manualForm.occasion}`,
        referenceImageUrl: manualForm.referenceImageUrl.trim() || undefined,
        targetDate: manualForm.targetDate,
        targetTime: manualForm.targetTime,
        estimatedPriceQuote: Number(manualForm.priceQuote),
      };

      const customCakeItem = {
        menuItemId: 'custom-cake-preorder',
        name: `Made-to-Order Cake: ${manualForm.occasion} (${manualForm.weightKg}kg ${manualForm.flavor})`,
        price: Number(manualForm.priceQuote),
        quantity: 1,
        isVeg: manualForm.isEggless,
        image: manualForm.referenceImageUrl || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
      };

      const payload = {
        customerName: manualForm.customerName.trim(),
        customerPhone: cleanPhone,
        customerEmail: manualForm.customerEmail.trim() || undefined,
        orderType: manualForm.fulfillmentType,
        deliveryAddress: manualForm.fulfillmentType === 'delivery' ? manualForm.deliveryAddress.trim() : undefined,
        items: [customCakeItem],
        paymentMethod: 'cash',
        isCustomCake: true,
        customCakeDetails,
        specialInstructions: `[PHONE ORDER / WALK-IN] Logged by Admin. Event: ${manualForm.targetDate} (${manualForm.targetTime}). Piping: "${manualForm.messageOnCake}". Notes: ${manualForm.designDescription}`,
      };

      // Staff token lets the server accept the quoted price and a phone order while closed.
      const created = await api.createOrder(payload, token);
      if (onNewOrderCreated) {
        onNewOrderCreated(created);
      }
      setIsManualOrderOpen(false);
      // Reset form
      setManualForm({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        occasion: 'Birthday',
        flavor: 'Belgian Dark Chocolate Truffle',
        weightKg: 1,
        shape: 'Round',
        isEggless: true,
        messageOnCake: '',
        designDescription: '',
        referenceImageUrl: '',
        targetDate: toLocalDateString(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        targetTime: '06:00 PM - 08:00 PM',
        fulfillmentType: 'pickup',
        deliveryAddress: '',
        priceQuote: 850,
      });
    } catch (err: any) {
      console.error('Failed to create manual custom cake order:', err);
      setManualError(err.message || 'Failed to save custom cake order.');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // Print Baking Sheet / KOT
  const handlePrintSlip = (ord: Order) => {
    setPrintingOrder(ord);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-900/90 via-amber-800/85 to-stone-900 p-5 sm:p-6 rounded-3xl text-white shadow-lg relative overflow-hidden border border-amber-800/30">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.15),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Cake className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide">
              Custom Cake &amp; Bakery Management
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
            Manage bespoke celebration orders, review customer reference artwork, coordinate delivery slots,
            and keep your head pastry chefs aligned with real-time updates.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2 shrink-0">
          <button
            id="admin-log-cake-phone-order-btn"
            onClick={() => setIsManualOrderOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-md transition-all hover:scale-102 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Phone / Walk-in Cake</span>
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh Custom Cake Orders"
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-300' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs">
          <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Total Cake Requests
          </p>
          <p className="text-2xl font-bold font-serif text-stone-900 dark:text-stone-100 mt-1">
            {metrics.total}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-900/50 shadow-2xs">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Pending Review
          </p>
          <p className="text-2xl font-bold font-serif text-amber-600 dark:text-amber-400 mt-1">
            {metrics.pending}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-900/50 shadow-2xs">
          <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
            <ChefHat className="w-3.5 h-3.5" />
            Baking &amp; Decorating
          </p>
          <p className="text-2xl font-bold font-serif text-blue-600 dark:text-blue-400 mt-1">
            {metrics.baking}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-900/50 shadow-2xs">
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ready for Pickup
          </p>
          <p className="text-2xl font-bold font-serif text-emerald-600 dark:text-emerald-400 mt-1">
            {metrics.ready}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs">
          <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Completed Celebrations
          </p>
          <p className="text-2xl font-bold font-serif text-stone-700 dark:text-stone-300 mt-1">
            {metrics.completed}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-300/40 dark:border-amber-800/40 shadow-2xs">
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
            Cake Revenue (Live)
          </p>
          <p className="text-2xl font-bold font-serif text-amber-700 dark:text-amber-300 mt-1">
            ₹{metrics.totalRevenue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone, flavor, occasion, or piping message..."
              className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 pl-9 pr-4 py-2.5 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Filters */}
          <div className="flex items-center flex-wrap gap-1.5">
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                dateFilter === 'all'
                  ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              All Dates
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                dateFilter === 'today'
                  ? 'bg-rose-600 text-white'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              Today's Celebrations
            </button>
            <button
              onClick={() => setDateFilter('upcoming')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                dateFilter === 'upcoming'
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              Upcoming Pre-Orders
            </button>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-stone-100 dark:border-stone-800">
          <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Status:</span>
          </span>

          <SlideableOptionBar
            activeId={statusFilter}
            className="flex-1 min-w-0"
            innerClassName="gap-1 py-0.5"
            scrollAmount={180}
          >
            {[
              { id: 'all', label: 'All Requests' },
              { id: 'pending', label: 'Pending Approval', color: 'bg-amber-500' },
              { id: 'confirmed', label: 'Chef Assigned', color: 'bg-blue-500' },
              { id: 'preparing', label: 'In Oven / Decorating', color: 'bg-indigo-500' },
              { id: 'ready', label: 'Ready for Pickup / Dispatch', color: 'bg-emerald-500' },
              { id: 'delivered', label: 'Delivered / Handed Over', color: 'bg-stone-600' },
              { id: 'cancelled', label: 'Cancelled', color: 'bg-rose-500' },
            ].map((st) => (
              <button
                key={st.id}
                data-tab-id={st.id}
                onClick={() => setStatusFilter(st.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 cursor-pointer transition-all flex items-center gap-1.5 ${
                  statusFilter === st.id
                    ? 'bg-amber-600 text-white shadow-2xs font-semibold'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                {st.color && <span className={`w-1.5 h-1.5 rounded-full ${st.color}`} />}
                <span>{st.label}</span>
              </button>
            ))}
          </SlideableOptionBar>
        </div>
      </div>

      {/* Orders List / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs">
          <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto mb-4">
            <Cake className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mb-1">
            {customCakeOrders.length === 0 ? 'No Custom Cake Orders Yet' : 'No Matching Cake Orders'}
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto mb-5">
            {customCakeOrders.length === 0
              ? 'When customers design custom cakes via the "Request Custom Cake" flow or when you log a phone order, they will appear here with reference photos and piping notes.'
              : 'Try clearing your search query or status filter to see more custom cake orders.'}
          </p>

          <button
            onClick={() => setIsManualOrderOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log First Custom Cake Order</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((ord) => {
            const details = ord.customCakeDetails;
            const isExpanded = expandedOrders[ord.id] ?? true;
            const refImg = details?.referenceImageUrl || ord.items?.[0]?.image;
            const isToday = details?.targetDate === todayStr;

            return (
              <div
                key={ord.id}
                className={`rounded-2xl border transition-all bg-white dark:bg-stone-900 shadow-2xs overflow-hidden ${
                  ord.status === 'pending'
                    ? 'border-amber-400/80 ring-1 ring-amber-400/40'
                    : isToday
                    ? 'border-rose-400/70'
                    : 'border-stone-200 dark:border-stone-800'
                }`}
              >
                {/* Main Card Header */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-stone-100 dark:border-stone-800/80">
                  <div className="flex items-start gap-3.5">
                    {/* Cake Thumbnail / Reference Photo */}
                    <div className="relative group shrink-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center">
                        {refImg ? (
                          <img
                            src={refImg}
                            alt="Cake reference"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <Cake className="w-8 h-8 text-stone-400" />
                        )}
                      </div>
                      {refImg && (
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ url: refImg, title: `${details?.flavor || 'Custom'} Cake Reference` })}
                          title="Zoom reference design photo"
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center text-white cursor-pointer"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    {/* Basic Order Info */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                          #{ord.id}
                        </span>

                        {isToday && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                            EVENT TODAY
                          </span>
                        )}

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            ord.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                              : ord.status === 'accepted'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300'
                              : ord.status === 'preparing'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300'
                              : ord.status === 'ready'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                              : ord.status === 'delivered'
                              ? 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {ord.status === 'pending'
                            ? 'Pending Chef Review'
                            : ord.status === 'accepted'
                            ? 'Chef Assigned'
                            : ord.status === 'preparing'
                            ? 'In Oven / Decorating'
                            : ord.status === 'ready'
                            ? 'Ready for Pickup / Dispatch'
                            : ord.status}
                        </span>

                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 flex items-center gap-1 font-medium">
                          {ord.orderType === 'delivery' ? (
                            <>
                              <MapPin className="w-3 h-3 text-amber-500" />
                              <span>Delivery</span>
                            </>
                          ) : (
                            <>
                              <Store className="w-3 h-3 text-stone-500" />
                              <span>Storefront Pickup</span>
                            </>
                          )}
                        </span>
                      </div>

                      <h4 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                        {details?.weightKg ? `${details.weightKg}kg ` : ''}
                        {details?.flavor || 'Custom Gourmet Cake'}
                        {details?.occasion ? ` for ${details.occasion}` : ''}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
                        <span className="flex items-center gap-1 text-stone-900 dark:text-stone-200 font-semibold">
                          <User className="w-3.5 h-3.5 text-stone-400" />
                          {ord.customerName}
                        </span>

                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5 text-stone-400" />
                          {ord.customerPhone}
                        </span>

                        {details?.targetDate && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <Calendar className="w-3.5 h-3.5" />
                            Target: {details.targetDate} ({details.targetTime || 'Anytime'})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer Quick Actions & Expand Toggle */}
                  <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                    {/* Call Customer */}
                    <a
                      href={`tel:${ord.customerPhone}`}
                      title="Call customer directly to confirm cake design"
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Customer</span>
                    </a>

                    {/* WhatsApp Customer with Pre-filled message */}
                    <a
                      href={`https://wa.me/91${ord.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `Hi ${ord.customerName}! Out of the Town (OTT) Bakery here regarding your custom cake order #${ord.id} (${details?.flavor || 'Custom Cake'}). We're reviewing your design proof!`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Chat on WhatsApp"
                      className="px-3 py-1.5 rounded-xl bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 hover:bg-green-100 text-xs font-bold border border-green-200 dark:border-green-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>

                    {/* Print Baking Slip */}
                    <button
                      onClick={() => handlePrintSlip(ord)}
                      title="Print Bakery Kitchen Order Ticket"
                      className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {/* Expand/Collapse */}
                    <button
                      onClick={() => toggleExpand(ord.id)}
                      className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 bg-stone-50/50 dark:bg-stone-900/50 space-y-4">
                    {/* Cake Specification Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block mb-0.5">
                          Dietary &amp; Shape
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-stone-800 dark:text-stone-200">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              details?.isEggless ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <span>{details?.isEggless ? '100% Eggless (Veg)' : 'Contains Egg'}</span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Shape: {details?.shape || 'Standard Round'}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block mb-0.5">
                          Occasion &amp; Size
                        </span>
                        <p className="font-bold text-stone-800 dark:text-stone-200">
                          {details?.occasion || 'Special Celebration'}
                        </p>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Weight: {details?.weightKg ? `${details.weightKg} kg` : '1.0 kg'}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block mb-0.5">
                          Fulfillment Details
                        </span>
                        <p className="font-bold text-stone-800 dark:text-stone-200 capitalize">
                          {ord.orderType === 'delivery' ? 'Delivery' : 'Pickup at OTT'}
                        </p>
                        <p className="text-[11px] text-stone-500 truncate mt-0.5" title={ord.deliveryAddress || 'Storefront'}>
                          {ord.deliveryAddress || 'OTT Restro, Kukas (NH-48)'}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block mb-0.5">
                          Payment &amp; Quote
                        </span>
                        <p className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                          ₹{ord.total}
                        </p>
                        <span
                          className={`inline-block text-[10px] px-1.5 py-0.5 rounded-md font-semibold mt-0.5 ${
                            ord.paymentStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {ord.paymentStatus === 'paid' ? 'Paid Online' : 'Payment Pending'}
                        </span>
                      </div>
                    </div>

                    {/* Message on Cake (Piping) */}
                    {details?.messageOnCake && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                            Piped Message on Cake / Board:
                          </p>
                          <p className="text-xs sm:text-sm font-serif italic font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                            "{details.messageOnCake}"
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Detailed Design Description & Notes */}
                    {details?.designDescription && (
                      <div className="p-3 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80 text-xs">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">
                          Design Description &amp; Custom Artwork Requests:
                        </span>
                        <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
                          {details.designDescription}
                        </p>
                      </div>
                    )}

                    {/* Special Instructions & Add-ons */}
                    {(details?.specialInstructions || ord.specialInstructions) && (
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        <span className="font-semibold text-stone-700 dark:text-stone-300">
                          Special Instructions / Add-ons:{' '}
                        </span>
                        {details?.specialInstructions || ord.specialInstructions}
                      </div>
                    )}

                    {/* Staff / Baker Assignment Info */}
                    {ord.acceptedBy && (
                      <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/60 flex items-center gap-2">
                        <ChefHat className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                          <strong>Assigned Pastry Chef:</strong> {ord.acceptedBy}
                          {ord.acceptedAt && ` (Accepted at ${new Date(ord.acceptedAt).toLocaleTimeString()})`}
                        </span>
                      </div>
                    )}

                    {/* Baker Workflow Actions Bar */}
                    <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status Change Buttons */}
                        {ord.status === 'pending' && (
                          <button
                            onClick={() => {
                              setAssigningOrder(ord);
                              setBakerNotes('');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <ChefHat className="w-3.5 h-3.5" />
                            <span>Accept &amp; Assign Baker</span>
                          </button>
                        )}

                        {(ord.status === 'pending' || ord.status === 'accepted') && (
                          <button
                            onClick={() => onUpdateOrderStatus(ord.id, 'preparing', 'Started baking & piping decoration')}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Start Baking &amp; Decorating</span>
                          </button>
                        )}

                        {ord.status === 'preparing' && (
                          <button
                            onClick={() => onUpdateOrderStatus(ord.id, 'ready', 'Cake boxed with cold storage')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Ready for Pickup / Delivery</span>
                          </button>
                        )}

                        {ord.status === 'ready' && (
                          <button
                            onClick={() => onUpdateOrderStatus(ord.id, 'delivered', 'Cake handed over to customer')}
                            className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark Handed Over / Delivered</span>
                          </button>
                        )}

                        {ord.status !== 'cancelled' && ord.status !== 'delivered' && (
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to cancel this custom cake pre-order?')) {
                                onCancelOrder?.(ord.id, 'Cancelled by Bakery Manager');
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold border border-rose-200 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5 inline mr-1" />
                            <span>Cancel Order</span>
                          </button>
                        )}
                      </div>

                      {/* Delete order */}
                      {onDeleteOrder && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Permanently delete order record #${ord.id}?`)) {
                              onDeleteOrder(ord.id);
                            }
                          }}
                          className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          title="Delete cake order record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: BAKER ASSIGNMENT MODAL */}
      {/* ============================================================== */}
      {assigningOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-500" />
                <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">
                  Assign Pastry Chef / Baker
                </h3>
              </div>
              <button
                onClick={() => setAssigningOrder(null)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400">
              Assign order #{assigningOrder.id} for{' '}
              <strong>{assigningOrder.customCakeDetails?.flavor || 'Custom Cake'}</strong> to a pastry chef.
            </p>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Select Head Baker / Decorator
              </label>
              <select
                value={bakerName}
                onChange={(e) => setBakerName(e.target.value)}
                className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-500"
              >
                <option value="Chef Ramesh (Head Pastry Chef)">Chef Ramesh (Head Pastry Chef)</option>
                <option value="Chef Priya (Fondant & Piping Specialist)">Chef Priya (Fondant &amp; Piping Specialist)</option>
                <option value="Chef Vikram (Tiered & Wedding Cakes)">Chef Vikram (Tiered &amp; Wedding Cakes)</option>
                <option value="Chef Sunita (Cheesecakes & Artisanal)">Chef Sunita (Cheesecakes &amp; Artisanal)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Internal Chef Kitchen Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={bakerNotes}
                onChange={(e) => setBakerNotes(e.target.value)}
                placeholder="e.g. Ensure pastel lavender color theme, extra gold leaf on edges..."
                className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssigningOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 dark:text-stone-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignment}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: REFERENCE PHOTO HIGH-RES ZOOM */}
      {/* ============================================================== */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative max-w-2xl w-full bg-stone-950 rounded-3xl overflow-hidden shadow-2xl border border-stone-800 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>{previewImage.title}</span>
              </h4>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-full text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 max-h-[75vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black">
              <img
                src={previewImage.url}
                alt="Reference design"
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: MANUAL PHONE / WALK-IN CAKE PRE-ORDER */}
      {/* ============================================================== */}
      {isManualOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Phone className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">
                    Log Phone / Walk-in Custom Cake Order
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Record custom cake orders received directly over restaurant telephone or counter.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManualOrderOpen(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {manualError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{manualError}</span>
              </div>
            )}

            <form onSubmit={handleCreateManualOrder} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualForm.customerName}
                    onChange={(e) => setManualForm({ ...manualForm, customerName: e.target.value })}
                    placeholder="e.g. Vikram Sharma"
                    className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Customer Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={manualForm.customerPhone}
                    onChange={(e) => setManualForm({ ...manualForm, customerPhone: e.target.value })}
                    placeholder="10-digit mobile number"
                    className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100 font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Occasion
                  </label>
                  <select
                    value={manualForm.occasion}
                    onChange={(e) => setManualForm({ ...manualForm, occasion: e.target.value })}
                    className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    <option value="Birthday">Birthday</option>
                    <option value="Anniversary">Anniversary</option>
                    <option value="Engagement">Engagement / Wedding</option>
                    <option value="Farewell">Farewell / Promotion</option>
                    <option value="Baby Shower">Baby Shower</option>
                    <option value="Other Celebration">Other Celebration</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={manualForm.weightKg}
                    onChange={(e) => setManualForm({ ...manualForm, weightKg: Number(e.target.value) })}
                    className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Dietary
                  </label>
                  <select
                    value={manualForm.isEggless ? 'eggless' : 'egg'}
                    onChange={(e) => setManualForm({ ...manualForm, isEggless: e.target.value === 'eggless' })}
                    className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    <option value="eggless">100% Eggless (Veg)</option>
                    <option value="egg">Contains Egg</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Cake Flavor &amp; Base
                </label>
                <input
                  type="text"
                  value={manualForm.flavor}
                  onChange={(e) => setManualForm({ ...manualForm, flavor: e.target.value })}
                  placeholder="e.g. Belgian Dark Chocolate Truffle, Red Velvet Cream Cheese, Mango Mania"
                  className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Message to Pipe on Cake
                </label>
                <input
                  type="text"
                  value={manualForm.messageOnCake}
                  onChange={(e) => setManualForm({ ...manualForm, messageOnCake: e.target.value })}
                  placeholder='e.g. "Happy 25th Birthday Sarah! ❤️"'
                  className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Event Date
                  </label>
                  <input
                    type="date"
                    required
                    value={manualForm.targetDate}
                    onChange={(e) => setManualForm({ ...manualForm, targetDate: e.target.value })}
                    className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Time Slot
                  </label>
                  <select
                    value={manualForm.targetTime}
                    onChange={(e) => setManualForm({ ...manualForm, targetTime: e.target.value })}
                    className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    <option value="11:00 AM - 01:00 PM">Morning (11:00 AM - 01:00 PM)</option>
                    <option value="02:00 PM - 04:00 PM">Afternoon (02:00 PM - 04:00 PM)</option>
                    <option value="06:00 PM - 08:00 PM">Evening (06:00 PM - 08:00 PM)</option>
                    <option value="09:00 PM - 11:00 PM">Midnight Party (09:00 PM - 11:00 PM)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Fulfillment
                  </label>
                  <select
                    value={manualForm.fulfillmentType}
                    onChange={(e) => setManualForm({ ...manualForm, fulfillmentType: e.target.value as any })}
                    className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    <option value="pickup">Storefront Pickup (OTT Kukas)</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Agreed Price Quote (₹)
                  </label>
                  <input
                    type="number"
                    value={manualForm.priceQuote}
                    onChange={(e) => setManualForm({ ...manualForm, priceQuote: Number(e.target.value) })}
                    className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100 font-mono font-bold"
                  />
                </div>
              </div>

              {manualForm.fulfillmentType === 'delivery' && (
                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Delivery Address
                  </label>
                  <input
                    type="text"
                    value={manualForm.deliveryAddress}
                    onChange={(e) => setManualForm({ ...manualForm, deliveryAddress: e.target.value })}
                    placeholder="Resort, hotel, room number or full address..."
                    className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Design Notes / Chef Instructions
                </label>
                <textarea
                  rows={2}
                  value={manualForm.designDescription}
                  onChange={(e) => setManualForm({ ...manualForm, designDescription: e.target.value })}
                  placeholder="Details agreed with customer on phone..."
                  className="w-full text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsManualOrderOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingManual ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Cake Order</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
