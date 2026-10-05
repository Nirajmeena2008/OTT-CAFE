import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  Printer,
  Search,
  Check,
  X,
  UserCheck,
  UtensilsCrossed,
  Eye,
  Filter,
  CreditCard,
  Bike,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  Trash2,
  Ban,
  Download,
  Calendar,
  User,
  Hash,
  Database,
  Cake,
  Navigation,
  Send,
} from 'lucide-react';
import type {
  Order,
  OrderStatus,
  OrderType,
  CafeInfo,
  DeliveryPartner,
  DeliveryTrackingStage,
  AdminAccessUser,
  AdminRole,
} from '../../types';
import { api } from '../../services/api';
import { generateOrderInvoicePdf } from '../../utils/invoicePdf';
import { STAGE_CONFIG } from '../../utils/deliveryFleet';
import { SlideableOptionBar } from './SlideableOptionBar';
import { AssignDeliveryPartnerModal } from './AssignDeliveryPartnerModal';
import { ROLE_CONFIGS } from './AdminAccessManagement';
import { isImageLike } from '../../utils/isImageLike';

interface OrdersManagementProps {
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
  onPurgeAllOrders?: () => void;
  onRefresh: () => void;
  onOpenRevenueAnalysis?: () => void;
  isLoading?: boolean;
  cafeInfo?: CafeInfo | null;
  currentUser?: AdminAccessUser | null;
}

const PRESET_STAFF_MEMBERS = [
  'Chef Vikram Singh',
  'Captain Sitaram',
  'Sunita (Bakery Lead)',
  'Manager Satyam',
  'Kitchen In-charge Rahul',
];

const PRESET_PREP_TIMES = [15, 20, 25, 35, 45];

export const OrdersManagement: React.FC<OrdersManagementProps> = ({
  orders,
  token,
  onUpdateOrderStatus,
  onDeleteOrder,
  onCancelOrder,
  onPurgeAllOrders,
  onRefresh,
  onOpenRevenueAnalysis,
  isLoading = false,
  cafeInfo,
  currentUser,
}) => {
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Permission helpers
  const userRole: AdminRole = currentUser?.role || 'owner';
  const hasPerm = (perm: string): boolean => {
    if (userRole === 'owner') return true;
    if (currentUser?.permissions && currentUser.permissions.includes(perm as any)) return true;
    const defaults = ROLE_CONFIGS[userRole]?.defaultPerms;
    return defaults ? defaults.includes(perm as any) : false;
  };

  const canAcceptOrder = hasPerm('orders.accept');
  const canUpdateStatus = hasPerm('orders.update_status');
  const canCancelOrder = hasPerm('orders.cancel');
  const canDeleteOrder = hasPerm('orders.cancel') || userRole === 'owner';
  const canAssignDelivery = hasPerm('delivery.assign') || hasPerm('orders.assign_delivery');
  const isOwner = userRole === 'owner';
  // Expand / Collapse State (Default: all orders collapsed)
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Staff Acceptance Modal State
  const [acceptingOrder, setAcceptingOrder] = useState<Order | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>(PRESET_STAFF_MEMBERS[0]);
  const [customStaffName, setCustomStaffName] = useState<string>('');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number>(20);
  const [kitchenNotes, setKitchenNotes] = useState<string>('');
  const [isSubmittingAcceptance, setIsSubmittingAcceptance] = useState<boolean>(false);

  // Cancel Order Modal State
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Customer requested cancellation / Out of stock');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);

  // Delete Order History Modal State
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);

  // Clear All Orders Modal State
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [isSubmittingPurge, setIsSubmittingPurge] = useState<boolean>(false);

  // Invoice Download State
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

  // Order Details / KOT Modal State
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);
  const [isKotMode, setIsKotMode] = useState<boolean>(false);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delivery Partner Assignment State
  const [assigningDeliveryOrder, setAssigningDeliveryOrder] = useState<Order | null>(null);
  const [updatingDeliveryOrderId, setUpdatingDeliveryOrderId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAssignDeliveryPartner = async (data: {
    partner: DeliveryPartner;
    estimatedMinutes: number;
    notes: string;
    initialStage: DeliveryTrackingStage;
  }) => {
    if (!assigningDeliveryOrder) return;
    try {
      await api.assignDeliveryPartner(token, assigningDeliveryOrder.id, data);
      showToast(`Assigned ${data.partner.name} to Order #${assigningDeliveryOrder.id}`);
      onRefresh();
    } catch (err: any) {
      showToast(`Failed: ${err.message || 'Error assigning delivery partner'}`);
      throw err;
    }
  };

  const handleUpdateDeliveryStage = async (
    orderId: string,
    stage: DeliveryTrackingStage,
    notes?: string
  ) => {
    try {
      setUpdatingDeliveryOrderId(orderId);
      await api.updateDeliveryStage(token, orderId, { stage, notes });
      const stageName = STAGE_CONFIG[stage]?.label || stage;
      showToast(`Updated to stage: ${stageName}`);
      onRefresh();
    } catch (err: any) {
      showToast(`Failed: ${err.message || 'Error updating delivery stage'}`);
    } finally {
      setUpdatingDeliveryOrderId(null);
    }
  };

  // Toggle single order expand / collapse
  const toggleExpandOrder = (orderId: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Expand All / Collapse All
  const handleExpandAll = () => {
    setExpandedOrderIds(new Set(filteredOrders.map((o) => o.id)));
  };

  const handleCollapseAll = () => {
    setExpandedOrderIds(new Set());
  };

  // Calculated Summary Metrics
  const metrics = useMemo(() => {
    const totalCount = orders.length;
    const pendingCount = orders.filter((o) => o.status === 'pending').length;
    const acceptedCount = orders.filter((o) => o.status === 'accepted').length;
    const preparingCount = orders.filter((o) => o.status === 'preparing').length;
    const readyCount = orders.filter((o) => o.status === 'ready').length;
    const deliveredCount = orders.filter((o) => o.status === 'delivered').length;
    const cancelledCount = orders.filter((o) => o.status === 'cancelled').length;
    const customCakeCount = orders.filter((o) => o.isCustomCake || o.customCakeDetails).length;
    const totalRevenue = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0);

    return {
      totalCount,
      pendingCount,
      inKitchenCount: acceptedCount + preparingCount,
      readyCount,
      deliveredCount,
      cancelledCount,
      customCakeCount,
      totalRevenue,
    };
  }, [orders]);

  // Filtered Orders List (with intelligent Order Number matching)
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'custom-cakes') {
          if (!order.isCustomCake && !order.customCakeDetails) return false;
        } else if (statusFilter === 'in-kitchen') {
          if (order.status !== 'accepted' && order.status !== 'preparing') return false;
        } else if (order.status !== statusFilter) {
          return false;
        }
      }

      // Order type filter
      if (typeFilter !== 'all' && order.orderType !== typeFilter) {
        return false;
      }

      // Search query (Prioritizes Order Number, then Customer Name, Phone, Items)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim().replace(/^#/, '');
        const orderIdClean = order.id.toLowerCase().replace(/^#/, '');

        const matchesId = orderIdClean.includes(q);
        const matchesCustomer = order.customerName.toLowerCase().includes(q);
        const matchesPhone = order.customerPhone.toLowerCase().includes(q);
        const matchesTable = order.tableNumber?.toLowerCase().includes(q);
        const matchesAddress = order.deliveryAddress?.toLowerCase().includes(q);
        const matchesItem = order.items.some((it) => it.name.toLowerCase().includes(q));

        if (!matchesId && !matchesCustomer && !matchesPhone && !matchesTable && !matchesAddress && !matchesItem) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusFilter, typeFilter, searchQuery]);

  // Open the Accept Order modal
  const handleOpenAcceptModal = (order: Order) => {
    setAcceptingOrder(order);
    setSelectedStaff(PRESET_STAFF_MEMBERS[0]);
    setCustomStaffName('');
    setPrepTimeMinutes(order.estimatedTimeMinutes || (order.orderType === 'delivery' ? 30 : 20));
    setKitchenNotes('Order accepted by staff. Kitchen preparation initiated.');
  };

  // Submit staff acceptance
  const handleConfirmAcceptance = async () => {
    if (!acceptingOrder) return;
    const staffName = customStaffName.trim() || selectedStaff;
    if (!staffName) return;

    try {
      setIsSubmittingAcceptance(true);
      await onUpdateOrderStatus(acceptingOrder.id, 'accepted', {
        acceptedBy: staffName,
        acceptedAt: new Date().toISOString(),
        estimatedTimeMinutes: prepTimeMinutes,
        notes: kitchenNotes.trim() || `Accepted by ${staffName}`,
      });
      showToast(`Order #${acceptingOrder.id} accepted by ${staffName}`);
      setAcceptingOrder(null);
    } catch (err: any) {
      showToast('Error accepting order: ' + err.message);
    } finally {
      setIsSubmittingAcceptance(false);
    }
  };

  // Submit Cancel Order - Instant Optimistic Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellingOrder) return;
    const targetOrder = cancellingOrder;
    const reason = cancelReason;
    setCancellingOrder(null);
    onCancelOrder?.(targetOrder.id, reason);
    showToast(`Order #${targetOrder.id} cancelled`);

    try {
      await api.cancelOrder(token, targetOrder.id, reason);
    } catch (err: any) {
      showToast('Failed to cancel order: ' + err.message);
      onRefresh();
    }
  };

  // Submit Delete / Remove Order History - Instant Optimistic Removal
  const handleConfirmDelete = async () => {
    if (!deletingOrder) return;
    const targetOrder = deletingOrder;
    setDeletingOrder(null);
    onDeleteOrder?.(targetOrder.id);
    showToast('removed order');

    try {
      await api.deleteOrder(token, targetOrder.id);
    } catch (err: any) {
      showToast('Failed to delete order record: ' + err.message);
      onRefresh();
    }
  };

  // Submit Purge All Orders - Clean Start
  const handleConfirmPurgeAll = async () => {
    try {
      setIsSubmittingPurge(true);
      await api.purgeAllOrders(token);
      onPurgeAllOrders?.();
      onRefresh();
      setShowPurgeModal(false);
      showToast('All orders cleared successfully');
    } catch (err: any) {
      showToast('Failed to clear orders: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingPurge(false);
    }
  };

  // Download Invoice PDF & Store in MySQL
  const handleDownloadInvoice = async (order: Order) => {
    try {
      setDownloadingInvoiceId(order.id);
      // 1. Register invoice into database
      await api.registerInvoice(token, order.id).catch((err) => {
        console.warn('Invoice registration notice:', err);
      });
      // 2. Generate and download PDF
      generateOrderInvoicePdf(order, cafeInfo || undefined);
      showToast(`Bill/Invoice for Order #${order.id} downloaded successfully!`);
    } catch (err: any) {
      showToast('Error generating invoice: ' + err.message);
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  // Quick status transition
  const handleQuickStatusChange = async (orderId: string, status: OrderStatus, defaultNotes?: string) => {
    try {
      await onUpdateOrderStatus(orderId, status, { notes: defaultNotes });
      showToast(`Order #${orderId} marked as ${status}`);
    } catch (err: any) {
      showToast('Status update failed: ' + err.message);
    }
  };

  // Print KOT
  const handlePrintKot = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-4 border border-stone-700 dark:border-stone-300">
          <Database className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
              Orders Management
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
              Live Orders ({orders.length})
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Search orders by order number, expand to view full breakdown, cancel orders, download PDF bills, and manage order history.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isOwner && orders.length > 0 && (
            <button
              id="btn-clear-all-orders"
              onClick={() => setShowPurgeModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 shadow-xs cursor-pointer transition-all"
              title="Clear all orders to start completely fresh"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear All Orders</span>
            </button>
          )}

          <button
            id="btn-refresh-orders"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 shadow-xs cursor-pointer transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Orders */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total</span>
            <ShoppingBag className="w-4 h-4 text-stone-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 dark:text-stone-100">
            {metrics.totalCount}
          </p>
          <span className="text-[10px] text-stone-500">Recorded orders</span>
        </div>

        {/* Needs Acceptance (Pending) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          className={`p-3.5 rounded-2xl border shadow-xs cursor-pointer transition-all ${
            metrics.pendingCount > 0
              ? 'bg-amber-500/10 border-amber-500/40 dark:bg-amber-500/15 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
            <AlertCircle className={`w-4 h-4 ${metrics.pendingCount > 0 ? 'animate-bounce' : ''}`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {metrics.pendingCount}
            </p>
            {metrics.pendingCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                New
              </span>
            )}
          </div>
          <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-medium">
            Awaiting acceptance
          </span>
        </div>

        {/* In Kitchen (Accepted & Preparing) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'in-kitchen' ? 'all' : 'in-kitchen')}
          className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs cursor-pointer hover:border-blue-400 transition-all"
        >
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Kitchen</span>
            <ChefHat className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 dark:text-stone-100">
            {metrics.inKitchenCount}
          </p>
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
            Cooking / Preparing
          </span>
        </div>

        {/* Ready for Pickup / Delivery */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'ready' ? 'all' : 'ready')}
          className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs cursor-pointer hover:border-purple-400 transition-all"
        >
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Ready</span>
            <Bike className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 dark:text-stone-100">
            {metrics.readyCount}
          </p>
          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
            Packed & Ready
          </span>
        </div>

        {/* Completed */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}
          className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs cursor-pointer hover:border-emerald-400 transition-all"
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Fulfilled</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 dark:text-stone-100">
            {metrics.deliveredCount}
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            Delivered / Served
          </span>
        </div>
      </div>

      {/* Prominent Search and Filter Bar with Order Number Focus */}
      <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Dedicated Order Number & Customer Search Bar */}
          <div className="relative flex-1">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-stone-400 pointer-events-none">
              <Search className="w-4 h-4" />
              <Hash className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <input
              id="input-orders-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order Number (e.g. 1001 or #ORD-1001), Customer Name, or Phone..."
              className="w-full pl-14 pr-8 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer p-1"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Expand All / Collapse All Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExpandAll}
              className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer flex items-center gap-1"
              title="Expand all order details"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Expand All</span>
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer flex items-center gap-1"
              title="Collapse all to order number & name only"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Collapse All</span>
            </button>
          </div>
        </div>

        {/* Status Filter Chips & Type Selector */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xs text-stone-400 flex items-center gap-1 mr-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Status:</span>
            </span>
            <SlideableOptionBar
              activeId={statusFilter}
              className="flex-1 min-w-0"
              innerClassName="gap-1 py-0.5"
              scrollAmount={200}
            >
              {[
                { id: 'all', label: 'All Orders' },
                { id: 'custom-cakes', label: '🎂 Custom Cakes', count: metrics.customCakeCount },
                { id: 'pending', label: 'Pending', count: metrics.pendingCount },
                { id: 'accepted', label: 'Accepted' },
                { id: 'preparing', label: 'Preparing' },
                { id: 'ready', label: 'Ready' },
                { id: 'delivered', label: 'Completed' },
                { id: 'cancelled', label: 'Cancelled', count: metrics.cancelledCount },
              ].map((st) => (
                <button
                  key={st.id}
                  data-tab-id={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    statusFilter === st.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  {st.label}
                  {st.count !== undefined && st.count > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-stone-950 font-bold text-[10px]">
                      {st.count}
                    </span>
                  )}
                </button>
              ))}
            </SlideableOptionBar>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="delivery">Delivery</option>
              <option value="dine-in">Dine-In</option>
              <option value="pickup">Takeaway / Pickup</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notice Banner explaining Default Collapsed Mode */}
      <div className="flex items-center justify-between text-xs px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-300">
        <div className="flex items-center gap-2">
          <ChevronDown className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Compact Overview Active:</strong> Showing Order Number, Date & Time, and Customer Name by default. Click any order row to expand its dishes, download PDF invoice, cancel, or delete.
          </span>
        </div>
        <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400 shrink-0 ml-2">
          {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'} matching
        </span>
      </div>

      {/* Main Orders Display: Cards View or Table View */}
      {filteredOrders.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-400 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">No Orders Found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No orders match your search criteria. Check your order number or clear filters.'
              : 'No orders have been recorded in the database yet. When customers order online, they will appear here.'}
          </p>
          {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* ============================================================== */
        /* COMPACT CARDS VIEW (DEFAULT) */
        /* ============================================================== */
        <div className="space-y-3">
          {filteredOrders.map((ord) => {
            const isExpanded = expandedOrderIds.has(ord.id);
            const isPending = ord.status === 'pending';
            const isAccepted = ord.status === 'accepted';
            const isPreparing = ord.status === 'preparing';
            const isReady = ord.status === 'ready';
            const isDelivered = ord.status === 'delivered';
            const isCancelled = ord.status === 'cancelled';

            return (
              <div
                key={ord.id}
                id={`admin-order-card-${ord.id}`}
                className={`rounded-2xl bg-white dark:bg-stone-900 border transition-all shadow-xs overflow-hidden ${
                  isPending
                    ? 'border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-500/10'
                    : isCancelled
                    ? 'border-rose-200 dark:border-rose-900/50 opacity-90'
                    : 'border-stone-200 dark:border-stone-800'
                }`}
              >
                {/* ============================================================== */}
                {/* COLLAPSED HEADER: Shows ONLY Order Number, Date & Time, Customer Name */}
                {/* ============================================================== */}
                <div
                  onClick={() => toggleExpandOrder(ord.id)}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors select-none ${
                    isExpanded ? 'bg-stone-50/50 dark:bg-stone-850/50 border-b border-stone-200 dark:border-stone-800' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Order Number Badge */}
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <Hash className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      {/* Order Number & Customer Name */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-base text-stone-900 dark:text-stone-100">
                          #{ord.id}
                        </span>
                        <span className="text-stone-300 dark:text-stone-700">•</span>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-stone-400" />
                          <span className="font-bold text-sm text-stone-900 dark:text-stone-100 truncate">
                            {ord.customerName}
                          </span>
                        </div>
                      </div>

                      {/* Date and Time */}
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>
                          {new Date(ord.createdAt).toLocaleDateString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                          ,{' '}
                          {new Date(ord.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side: Status Pill & Expand Trigger */}
                  <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-center flex-wrap justify-end">
                    {(ord.isCustomCake || ord.customCakeDetails) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 ring-1 ring-rose-400/50 flex items-center gap-1">
                        <Cake className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        <span>Custom Cake</span>
                      </span>
                    )}

                    {/* Delivery Partner Status Badge */}
                    {(ord.orderType === 'delivery' || ord.deliveryAddress) && (
                      ord.deliveryPartner ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 ring-1 ring-purple-400/50 flex items-center gap-1">
                          <Bike className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          <span>
                            {ord.deliveryPartner.name} • {STAGE_CONFIG[ord.deliveryTracking?.stage || 'assigned']?.label || 'Assigned'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 flex items-center gap-1">
                          <Bike className="w-3 h-3 text-amber-600" />
                          <span>Unassigned Rider</span>
                        </span>
                      )
                    )}

                    {/* Status Pill */}
                    <span
                      className={`text-[11px] uppercase font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${
                        isPending
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 ring-1 ring-amber-400/40 animate-pulse'
                          : isAccepted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : isPreparing
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : isReady
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : isDelivered
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {isPending && <AlertCircle className="w-3 h-3" />}
                      {isAccepted && <Check className="w-3 h-3" />}
                      {isPreparing && <ChefHat className="w-3 h-3" />}
                      {isReady && <Bike className="w-3 h-3" />}
                      {isDelivered && <CheckCircle2 className="w-3 h-3" />}
                      {isCancelled && <Ban className="w-3 h-3" />}
                      <span>{isPending ? 'Pending Acceptance' : ord.status}</span>
                    </span>

                    {/* Expand/Collapse Button */}
                    <div className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-amber-600 transition-colors">
                      <span className="hidden sm:inline">{isExpanded ? 'Collapse' : 'Details'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-stone-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-stone-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* ============================================================== */}
                {/* EXPANDED SECTION: ALL OTHER DETAILS ONLY SHOW UP WHEN EXPANDED */}
                {/* ============================================================== */}
                {isExpanded && (
                  <div className="p-5 space-y-4 bg-stone-50/30 dark:bg-stone-900/30 animate-in fade-in duration-200">
                    {/* Top Secondary Info: Type, Phone, Address/Table */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 text-xs">
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold tracking-wider">
                          Order Type & Channel
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="uppercase font-bold text-[11px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                            {ord.orderType}
                          </span>
                          {ord.orderType === 'dine-in' && ord.tableNumber && (
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              Table: {ord.tableNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold tracking-wider">
                          Customer Contact
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-stone-400" />
                          <a
                            href={`tel:${ord.customerPhone}`}
                            className="font-bold text-amber-600 dark:text-amber-400 hover:underline"
                          >
                            {ord.customerPhone}
                          </a>
                        </div>
                      </div>

                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold tracking-wider">
                          Payment Mode & Status
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CreditCard className="w-3.5 h-3.5 text-stone-400" />
                          <span className="font-bold uppercase text-stone-800 dark:text-stone-200">
                            {ord.paymentMethod}
                          </span>
                          <span className="text-stone-300">•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 capitalize font-bold">
                            {ord.paymentStatus}
                          </span>
                        </div>
                      </div>

                      {ord.deliveryAddress && (
                        <div className="sm:col-span-3 pt-2 border-t border-stone-100 dark:border-stone-800 flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                          <span className="text-stone-600 dark:text-stone-300">
                            <strong>Delivery Address:</strong> {ord.deliveryAddress}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Staff Acceptance Highlight Banner */}
                    {ord.acceptedBy ? (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <UserCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                              Accepted by {ord.acceptedBy}
                            </p>
                            {ord.acceptedAt && (
                              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-mono">
                                at {new Date(ord.acceptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                        {ord.estimatedTimeMinutes && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-mono">
                            {ord.estimatedTimeMinutes} min prep
                          </span>
                        )}
                      </div>
                    ) : isPending ? (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                            Pending kitchen staff review and acceptance
                          </p>
                        </div>
                        {canAcceptOrder && (
                          <button
                            id={`btn-accept-order-${ord.id}`}
                            onClick={() => handleOpenAcceptModal(ord)}
                            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <ChefHat className="w-3.5 h-3.5" />
                            <span>Accept Order</span>
                          </button>
                        )}
                      </div>
                    ) : null}

                    {/* Dedicated Made-to-Order Cake Specification Box */}
                    {(ord.isCustomCake || ord.customCakeDetails) && (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-rose-500/10 via-amber-500/10 to-transparent border-2 border-rose-300 dark:border-rose-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                              <Cake className="w-4 h-4" />
                            </span>
                            <div>
                              <span className="text-[10px] uppercase font-extrabold tracking-wider text-rose-600 dark:text-rose-400">
                                Made-to-Order Custom Bakery
                              </span>
                              <h5 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                                {ord.customCakeDetails?.occasion || 'Celebration Cake'}
                              </h5>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-200 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200">
                            Custom Pre-Order
                          </span>
                        </div>

                        {/* Reference Image & Specs Grid */}
                        <div className="flex flex-col sm:flex-row gap-3 bg-white/80 dark:bg-stone-850 p-3.5 rounded-xl border border-rose-200/60 dark:border-rose-900/40">
                          {ord.customCakeDetails?.referenceImageUrl && (
                            <div className="shrink-0 flex flex-col items-center gap-1.5">
                              <img
                                src={ord.customCakeDetails.referenceImageUrl}
                                alt="Cake reference photo"
                                referrerPolicy="no-referrer"
                                className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl object-cover border border-stone-300 dark:border-stone-700 shadow-sm"
                              />
                              <a
                                href={ord.customCakeDetails.referenceImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                              >
                                View Full Image
                              </a>
                            </div>
                          )}
                          <div className="flex-1 min-w-0 text-xs space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-stone-700 dark:text-stone-300">
                              <div>
                                <span className="text-[10px] text-stone-400 block uppercase font-bold">Weight &amp; Flavor</span>
                                <span className="font-bold text-stone-900 dark:text-stone-100">
                                  {ord.customCakeDetails?.weightKg || 1} kg • {ord.customCakeDetails?.flavor}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-stone-400 block uppercase font-bold">Dietary &amp; Shape</span>
                                <span className="font-bold text-stone-900 dark:text-stone-100">
                                  {ord.customCakeDetails?.isEggless ? '100% Eggless' : 'Contains Egg'} • {ord.customCakeDetails?.shape || 'Round'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-stone-400 block uppercase font-bold">Target Date &amp; Slot</span>
                                <span className="font-bold text-amber-700 dark:text-amber-400">
                                  {ord.customCakeDetails?.targetDate || 'Not specified'} ({ord.customCakeDetails?.targetTime || 'Evening'})
                                </span>
                              </div>
                            </div>

                            {ord.customCakeDetails?.messageOnCake && (
                              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-900/30 text-rose-900 dark:text-rose-200">
                                <span className="font-bold text-[10px] uppercase block text-rose-700 dark:text-rose-400">Piped Message On Cake:</span>
                                <span className="font-semibold text-xs italic">"{ord.customCakeDetails.messageOnCake}"</span>
                              </div>
                            )}

                            {ord.customCakeDetails?.designDescription && (
                              <div className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                                <span className="font-bold text-[10px] uppercase block text-stone-500">Design Instructions:</span>
                                <span className="text-xs">{ord.customCakeDetails.designDescription}</span>
                              </div>
                            )}

                            {ord.customCakeDetails?.specialInstructions && (
                              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                                <strong>Bakery Notes:</strong> {ord.customCakeDetails.specialInstructions}
                              </p>
                            )}

                            <div className="pt-1 flex items-center gap-2">
                              <a
                                href={`https://wa.me/91${ord.customerPhone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs"
                              >
                                <span>WhatsApp Customer (+91 {ord.customerPhone})</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ============================================================== */}
                    {/* DEDICATED DELIVERY PARTNER ASSIGNMENT & PICKUP / TRANSIT BLOCK */}
                    {/* ============================================================== */}
                    {(ord.orderType === 'delivery' || ord.deliveryAddress) && (
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/5 via-stone-50 to-amber-500/5 dark:from-purple-950/20 dark:via-stone-900 dark:to-amber-950/20 border border-purple-200/80 dark:border-purple-900/50 shadow-xs space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-purple-200/50 dark:border-purple-900/40">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                              <Bike className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-950 dark:text-purple-300">
                                  Delivery Fleet Dispatch &amp; Route Tracking
                                </h4>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold border border-purple-300/40">
                                  NH-48 Kukas Corridor
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                                Pickup from OTT Restaurant kitchen counter to customer doorstep
                              </p>
                            </div>
                          </div>

                          {/* Reassign / Assign Button */}
                          {canAssignDelivery && (
                            <button
                              type="button"
                              onClick={() => setAssigningDeliveryOrder(ord)}
                              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
                            >
                              <Bike className="w-3.5 h-3.5" />
                              <span>{ord.deliveryPartner ? 'Reassign / Edit Fleet' : 'Assign Delivery Partner'}</span>
                            </button>
                          )}
                        </div>

                        {!ord.deliveryPartner ? (
                          /* Not Assigned State */
                          <div className="p-4 rounded-xl bg-white dark:bg-stone-850 border border-dashed border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <AlertCircle className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                                  Awaiting Rider Assignment
                                </p>
                                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                                  Assign an OTT rider so the kitchen can dispatch food and the customer can track pickup and live transit.
                                </p>
                              </div>
                            </div>
                            {canAssignDelivery && (
                              <button
                                type="button"
                                onClick={() => setAssigningDeliveryOrder(ord)}
                                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
                              >
                                <Bike className="w-4 h-4" />
                                <span>Assign Rider Now</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          /* Assigned Delivery Partner Details & Stage Stepper */
                          <div className="space-y-3.5">
                            {/* Rider Information Header Card */}
                            <div className="p-3.5 rounded-xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                {ord.deliveryPartner.photoUrl && isImageLike(ord.deliveryPartner.photoUrl) ? (
                                  <img
                                    src={ord.deliveryPartner.photoUrl}
                                    alt={ord.deliveryPartner.name}
                                    referrerPolicy="no-referrer"
                                    className="w-11 h-11 rounded-xl object-cover border border-purple-200 dark:border-purple-800 shrink-0 shadow-2xs"
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
                                    <Bike className="w-5 h-5" />
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <h5 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                                      {ord.deliveryPartner.name}
                                    </h5>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold uppercase">
                                      OTT Fleet
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-600 dark:text-stone-400">
                                    <span className="font-mono font-semibold uppercase">
                                      {ord.deliveryPartner.vehicleNumber} ({ord.deliveryPartner.vehicleType})
                                    </span>
                                    {ord.deliveryPartner.rating && (
                                      <>
                                        <span>•</span>
                                        <span className="text-amber-600 font-semibold">⭐ {ord.deliveryPartner.rating}</span>
                                      </>
                                    )}
                                    {ord.deliveryPartner.totalDeliveries && (
                                      <>
                                        <span>•</span>
                                        <span>{ord.deliveryPartner.totalDeliveries}+ trips</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Rider Contact Actions */}
                              <div className="flex items-center gap-2">
                                <a
                                  href={`tel:${ord.deliveryPartner.phone}`}
                                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                >
                                  <Phone className="w-3.5 h-3.5 text-stone-500" />
                                  <span>{ord.deliveryPartner.phone}</span>
                                </a>
                                <a
                                  href={`https://wa.me/91${ord.deliveryPartner.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                    `Hello ${ord.deliveryPartner.name}, regarding OTT Order #${ord.id} for ${ord.customerName}. Status update needed.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>WhatsApp</span>
                                </a>
                              </div>
                            </div>

                            {/* Live Stage & Progress Visualizer */}
                            <div className="p-3.5 rounded-xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <div>
                                  <span className="text-[10px] uppercase font-bold text-stone-400 block">
                                    Current Live Status
                                  </span>
                                  <p className="font-bold text-purple-900 dark:text-purple-300 text-sm">
                                    {STAGE_CONFIG[ord.deliveryTracking?.stage || 'assigned']?.label || 'Assigned'}
                                  </p>
                                  <p className="text-[11px] text-stone-500 mt-0.5">
                                    {ord.deliveryTracking?.currentLocationLabel || 'Dispatched, en route'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] uppercase font-bold text-stone-400 block">
                                    ETA Window
                                  </span>
                                  <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                                    {ord.deliveryTracking?.estimatedArrivalTime || '25 mins'}
                                  </span>
                                  <span className="text-[10px] text-stone-400 block">
                                    Progress: {ord.deliveryTracking?.progressPercent || 15}%
                                  </span>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-purple-600 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${ord.deliveryTracking?.progressPercent || 15}%` }}
                                />
                              </div>

                              {/* Quick Stage Progression Stepper for Admin */}
                              <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                                <span className="text-[10px] uppercase font-bold text-stone-400 block mb-2">
                                  Quick Stage Advance (Dispatches Live GPS to Customer)
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                                  {[
                                    { stage: 'arrived_at_pickup' as DeliveryTrackingStage, label: '1. At Kitchen' },
                                    { stage: 'picked_up' as DeliveryTrackingStage, label: '2. Picked Up' },
                                    { stage: 'on_the_way' as DeliveryTrackingStage, label: '3. En Route (NH-48)' },
                                    { stage: 'near_destination' as DeliveryTrackingStage, label: '4. In Locality' },
                                    { stage: 'delivered' as DeliveryTrackingStage, label: '5. Delivered' },
                                  ].map((s) => {
                                    const isCurrent = ord.deliveryTracking?.stage === s.stage;
                                    return (
                                      <button
                                        key={s.stage}
                                        type="button"
                                        disabled={updatingDeliveryOrderId === ord.id}
                                        onClick={() => handleUpdateDeliveryStage(ord.id, s.stage)}
                                        className={`px-2 py-1.5 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer ${
                                          isCurrent
                                            ? 'bg-purple-600 text-white shadow-xs'
                                            : 'bg-stone-100 dark:bg-stone-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                                        }`}
                                      >
                                        {s.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ordered Items Breakdown */}
                    <div className="bg-white dark:bg-stone-850 p-4 rounded-xl border border-stone-200 dark:border-stone-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
                        <span className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                          Ordered Items ({ord.items.length})
                        </span>
                        <span className="text-xs text-stone-400 font-mono">Item Total Breakdown</span>
                      </div>

                      <div className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
                        {ord.items.map((it, i) => (
                          <div key={i} className="py-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md">
                                {it.quantity}x
                              </span>
                              <span className="font-medium text-stone-800 dark:text-stone-200 truncate">
                                {it.name}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                                  it.isVeg
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                }`}
                              >
                                {it.isVeg ? 'Veg' : 'Non-Veg'}
                              </span>
                            </div>
                            <span className="font-mono text-stone-700 dark:text-stone-300 font-bold shrink-0">
                              ₹{(it.price * it.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Pricing Totals */}
                      <div className="pt-3 border-t border-stone-200 dark:border-stone-700 text-xs space-y-1">
                        <div className="flex justify-between text-stone-500">
                          <span>Subtotal:</span>
                          <span className="font-mono">₹{ord.subtotal.toFixed(2)}</span>
                        </div>
                        {ord.discount > 0 && (
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                            <span>Promo Discount {ord.promoCode ? `(${ord.promoCode})` : ''}:</span>
                            <span className="font-mono">-₹{ord.discount.toFixed(2)}</span>
                          </div>
                        )}
                        {ord.deliveryFee > 0 && (
                          <div className="flex justify-between text-stone-500">
                            <span>Delivery:</span>
                            <span className="font-mono">₹{ord.deliveryFee.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-stone-500">
                          <span>Taxes & GST (5%):</span>
                          <span className="font-mono">₹{ord.tax.toFixed(2)}</span>
                        </div>
                        <div className="pt-2 border-t border-stone-200 dark:border-stone-700 flex justify-between items-center font-bold text-sm">
                          <span className="text-stone-900 dark:text-stone-100">Grand Total:</span>
                          <span className="text-amber-600 dark:text-amber-400 font-mono text-base">
                            ₹{ord.total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Notes if any */}
                    {ord.statusNotes && (
                      <p className="text-xs text-stone-500 dark:text-stone-400 italic bg-white dark:bg-stone-850 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800">
                        <strong>Kitchen Note:</strong> "{ord.statusNotes}"
                      </p>
                    )}

                    {/* ============================================================== */}
                    {/* EXPANDED ACTION BUTTONS: Invoice Download, Cancel, Remove, Status */}
                    {/* ============================================================== */}
                    <div className="pt-2 flex items-center justify-between gap-2 flex-wrap border-t border-stone-200 dark:border-stone-800">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Download Invoice (PDF) Button - Backed by MySQL */}
                        <button
                          id={`btn-download-invoice-${ord.id}`}
                          onClick={() => handleDownloadInvoice(ord)}
                          disabled={downloadingInvoiceId === ord.id}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                          title="Generate official Tax Invoice PDF and store record in MySQL database"
                        >
                          {downloadingInvoiceId === ord.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>Download Bill (PDF)</span>
                        </button>

                        {/* Details / KOT Modal Button */}
                        <button
                          onClick={() => {
                            setInspectingOrder(ord);
                            setIsKotMode(false);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold border border-stone-200 dark:border-stone-700 cursor-pointer flex items-center gap-1"
                          title="View Kitchen Ticket (KOT)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>KOT / Ticket</span>
                        </button>

                        {/* Advance to Preparing */}
                        {canUpdateStatus && (isPending || isAccepted) && (
                          <button
                            onClick={() =>
                              handleQuickStatusChange(ord.id, 'preparing', 'Chef started cooking in the kitchen')
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-semibold border border-blue-200 dark:border-blue-900 cursor-pointer flex items-center gap-1"
                          >
                            <ChefHat className="w-3.5 h-3.5" />
                            <span>Start Cooking</span>
                          </button>
                        )}

                        {/* Advance to Ready */}
                        {canUpdateStatus && (isAccepted || isPreparing) && (
                          <button
                            onClick={() =>
                              handleQuickStatusChange(ord.id, 'ready', 'Packed & ready for customer/delivery')
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-semibold border border-purple-200 dark:border-purple-900 cursor-pointer flex items-center gap-1"
                          >
                            <Bike className="w-3.5 h-3.5" />
                            <span>Mark Ready</span>
                          </button>
                        )}

                        {/* Advance to Delivered / Completed */}
                        {canUpdateStatus && (isPreparing || isReady) && (
                          <button
                            onClick={() =>
                              handleQuickStatusChange(ord.id, 'delivered', 'Order served / delivered successfully')
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 text-xs font-semibold border border-emerald-200 dark:border-emerald-900 cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Delivered</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Cancel Order Functionality - Can cancel any order */}
                        {canCancelOrder && !isCancelled && (
                          <button
                            id={`btn-cancel-order-${ord.id}`}
                            onClick={() => setCancellingOrder(ord)}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900 text-xs font-semibold border border-rose-200 dark:border-rose-900 cursor-pointer flex items-center gap-1 transition-all"
                            title="Cancel this order"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancel Order</span>
                          </button>
                        )}

                        {/* Remove / Delete Order History Button */}
                        {canDeleteOrder && (
                          <button
                            id={`btn-delete-order-${ord.id}`}
                            onClick={() => setDeletingOrder(ord)}
                            className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-600 dark:hover:text-rose-400 text-stone-600 dark:text-stone-400 text-xs font-semibold border border-stone-200 dark:border-stone-700 hover:border-rose-300 cursor-pointer flex items-center gap-1 transition-all"
                            title="Permanently remove this order from history and MySQL database"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove History</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: STAFF ACCEPTANCE DIALOG */}
      {/* ============================================================== */}
      {acceptingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100">
                    Accept Kitchen Order
                  </h3>
                  <p className="text-xs font-mono text-stone-500">
                    #{acceptingOrder.id} • {acceptingOrder.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAcceptingOrder(null)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 text-xs space-y-1.5">
              <div className="flex justify-between font-bold text-stone-700 dark:text-stone-300">
                <span>Items to Prepare:</span>
                <span className="font-mono text-amber-600">Total ₹{acceptingOrder.total.toFixed(2)}</span>
              </div>
              <p className="text-stone-600 dark:text-stone-400 text-[11px]">
                {acceptingOrder.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                Assigning Staff / Chef Member
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_STAFF_MEMBERS.map((staff) => (
                  <button
                    key={staff}
                    type="button"
                    onClick={() => {
                      setSelectedStaff(staff);
                      setCustomStaffName('');
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold cursor-pointer border transition-all ${
                      selectedStaff === staff && !customStaffName
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    {staff}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customStaffName}
                onChange={(e) => setCustomStaffName(e.target.value)}
                placeholder="Or type custom staff / captain name..."
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                  Estimated Prep Time (Minutes)
                </label>
                <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                  {prepTimeMinutes} mins
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {PRESET_PREP_TIMES.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setPrepTimeMinutes(mins)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer border transition-all ${
                      prepTimeMinutes === mins
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                Status Note / Kitchen Instructions
              </label>
              <input
                type="text"
                value={kitchenNotes}
                onChange={(e) => setKitchenNotes(e.target.value)}
                placeholder="e.g. Order accepted, bakery items in oven"
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAcceptingOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-accept-order"
                type="button"
                disabled={isSubmittingAcceptance}
                onClick={handleConfirmAcceptance}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              >
                {isSubmittingAcceptance ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm & Accept</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: CANCEL ANY ORDER CONFIRMATION DIALOG */}
      {/* ============================================================== */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100">
                    Cancel Order
                  </h3>
                  <p className="text-xs font-mono text-stone-500">
                    Order #{cancellingOrder.id} • {cancellingOrder.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCancellingOrder(null)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Are you sure you want to cancel order <strong>#{cancellingOrder.id}</strong>? The status will be changed to <strong>Cancelled</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                Reason for Cancellation
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Specify reason (e.g. customer called to cancel, kitchen ran out of ingredients)..."
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 cursor-pointer"
              >
                Dismiss
              </button>
              <button
                id="btn-confirm-cancel-order"
                type="button"
                disabled={isSubmittingCancel}
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              >
                {isSubmittingCancel ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    <span>Confirm Cancellation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: DELETE / REMOVE ORDER HISTORY RECORD DIALOG */}
      {/* ============================================================== */}
      {deletingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-stone-900 text-rose-500 flex items-center justify-center font-bold">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100">
                    Remove Order History
                  </h3>
                  <p className="text-xs font-mono text-stone-500">
                    Permanently delete #{deletingOrder.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeletingOrder(null)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Permanent Order Deletion</span>
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-400">
                This action will permanently wipe order <strong>#{deletingOrder.id}</strong> (Customer: {deletingOrder.customerName}, ₹{deletingOrder.total.toFixed(2)}) from the order history. This cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 cursor-pointer"
              >
                Keep Order
              </button>
              <button
                id="btn-confirm-delete-order"
                type="button"
                disabled={isSubmittingDelete}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              >
                {isSubmittingDelete ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Record Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3B: WIPE ALL ORDERS (START FRESH) */}
      {/* ============================================================== */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100">
                    Clear All Orders
                  </h3>
                  <p className="text-xs text-stone-500">
                    Wipe all {orders.length} order records
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPurgeModal(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-300 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Confirm Database Wipe</span>
              </p>
              <p className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-400">
                This will permanently delete all existing order history so your dashboard only reflects genuine orders placed by live customers moving forward. This cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-purge-all"
                type="button"
                disabled={isSubmittingPurge}
                onClick={handleConfirmPurgeAll}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              >
                {isSubmittingPurge ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Clear All Orders</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: DETAILED ORDER INSPECTION & KITCHEN ORDER TICKET (KOT) */}
      {/* ============================================================== */}
      {inspectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-850/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                      Order Details & KOT
                    </h3>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                      #{inspectingOrder.id}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 font-mono">
                    Placed on {new Date(inspectingOrder.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsKotMode(!isKotMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors flex items-center gap-1.5 ${
                    isKotMode
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isKotMode ? 'Exit KOT' : 'Kitchen KOT'}</span>
                </button>
                <button
                  onClick={() => setInspectingOrder(null)}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto no-scrollbar">
              {isKotMode ? (
                /* Kitchen Order Ticket (KOT) Thermal Receipt Preview */
                <div
                  id="kot-print-area"
                  className="p-6 rounded-2xl bg-stone-50 text-stone-900 font-mono border-2 border-dashed border-stone-300 space-y-4 shadow-inner"
                >
                  <div className="text-center pb-3 border-b border-dashed border-stone-400">
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-600">
                      KITCHEN ORDER TICKET (KOT)
                    </p>
                    <h4 className="text-lg font-bold">OUT OF THE TOWN - RESTRO & BAKERY</h4>
                    <p className="text-[11px] text-stone-500">NH-48 Kukas, Jaipur</p>
                    <p className="text-xs font-bold mt-1 text-stone-700">
                      ORDER #{inspectingOrder.id} • TYPE: {inspectingOrder.orderType.toUpperCase()}
                      {inspectingOrder.tableNumber && ` (TABLE: ${inspectingOrder.tableNumber})`}
                    </p>
                  </div>

                  <div className="flex justify-between text-xs pb-2 border-b border-stone-300">
                    <span>Customer: {inspectingOrder.customerName}</span>
                    <span>{new Date(inspectingOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {inspectingOrder.acceptedBy && (
                    <div className="text-xs font-bold text-stone-800 pb-2 border-b border-stone-300">
                      ACCEPTED BY: {inspectingOrder.acceptedBy.toUpperCase()} (PREP: {inspectingOrder.estimatedTimeMinutes}M)
                    </div>
                  )}

                  <div className="space-y-2 py-2">
                    <div className="flex justify-between font-bold text-xs pb-1 border-b border-stone-300">
                      <span>QTY & ITEM NAME</span>
                      <span>PREP</span>
                    </div>
                    {inspectingOrder.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-xs py-1 border-b border-stone-200">
                        <span className="font-bold">
                          [{it.quantity}X] {it.name.toUpperCase()} {it.isVeg ? '(VEG)' : '(NON-VEG)'}
                        </span>
                        <span className="text-stone-500">HOT</span>
                      </div>
                    ))}
                  </div>

                  {inspectingOrder.deliveryAddress && (
                    <div className="text-[11px] pt-2 border-t border-dashed border-stone-400">
                      <span className="font-bold">DELIVERY TO:</span> {inspectingOrder.deliveryAddress}
                    </div>
                  )}

                  <div className="pt-2 flex justify-between items-center text-xs">
                    <button
                      onClick={handlePrintKot}
                      className="px-4 py-2 rounded-xl bg-stone-900 text-white font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print KOT</span>
                    </button>
                    <span className="text-[11px] text-stone-500">
                      Total Items: {inspectingOrder.items.reduce((acc, it) => acc + it.quantity, 0)}
                    </span>
                  </div>
                </div>
              ) : (
                /* Full Order Details */
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase font-bold text-amber-700 dark:text-amber-300">
                        Current Status
                      </span>
                      <p className="text-base font-bold text-stone-900 dark:text-stone-100 capitalize mt-0.5">
                        {inspectingOrder.status}
                      </p>
                      {inspectingOrder.acceptedBy && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold mt-1">
                          Staff assigned: {inspectingOrder.acceptedBy}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs uppercase font-bold text-stone-500">Fulfillment</span>
                      <p className="text-sm font-bold text-stone-900 dark:text-stone-100 capitalize">
                        {inspectingOrder.orderType}
                      </p>
                      {inspectingOrder.tableNumber && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                          Table: {inspectingOrder.tableNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-2 text-xs">
                    <h4 className="font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                      Customer Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-stone-400">Full Name</span>
                        <p className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                          {inspectingOrder.customerName}
                        </p>
                      </div>
                      <div>
                        <span className="text-stone-400">Phone Number</span>
                        <p>
                          <a
                            href={`tel:${inspectingOrder.customerPhone}`}
                            className="font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{inspectingOrder.customerPhone}</span>
                          </a>
                        </p>
                      </div>
                      {inspectingOrder.deliveryAddress && (
                        <div className="sm:col-span-2">
                          <span className="text-stone-400">Delivery Address</span>
                          <p className="font-medium text-stone-700 dark:text-stone-300 flex items-start gap-1 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                            <span>{inspectingOrder.deliveryAddress}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-3">
                    <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                      Ordered Dishes & Bakery Items
                    </h4>
                    <div className="divide-y divide-stone-200 dark:divide-stone-700 text-xs">
                      {inspectingOrder.items.map((it, idx) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={it.image}
                              alt={it.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-xl object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                            />
                            <div>
                              <p className="font-bold text-stone-900 dark:text-stone-100">{it.name}</p>
                              <p className="text-[11px] text-stone-400 font-mono">
                                ₹{it.price.toFixed(2)} × {it.quantity}
                              </p>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-stone-800 dark:text-stone-200 text-sm">
                            ₹{(it.price * it.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-stone-200 dark:border-stone-700 space-y-1.5 text-xs">
                      <div className="flex justify-between text-stone-500">
                        <span>Subtotal</span>
                        <span className="font-mono">₹{inspectingOrder.subtotal.toFixed(2)}</span>
                      </div>
                      {inspectingOrder.discount > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span>Discount</span>
                          <span className="font-mono">-₹{inspectingOrder.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-stone-500">
                        <span>GST (5%)</span>
                        <span className="font-mono">₹{inspectingOrder.tax.toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-stone-200 dark:border-stone-700 flex justify-between items-center font-bold text-sm">
                        <span>Grand Total</span>
                        <span className="font-mono text-amber-600 dark:text-amber-400 text-base">
                          ₹{inspectingOrder.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-850/50">
              <button
                onClick={() => handleDownloadInvoice(inspectingOrder)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Bill (PDF)</span>
              </button>
              <button
                onClick={() => setInspectingOrder(null)}
                className="px-4 py-2 rounded-xl bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-800 dark:text-stone-200 text-xs font-semibold cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Delivery Partner Modal */}
      {assigningDeliveryOrder && (
        <AssignDeliveryPartnerModal
          isOpen={Boolean(assigningDeliveryOrder)}
          order={assigningDeliveryOrder}
          token={token}
          onClose={() => setAssigningDeliveryOrder(null)}
          onAssign={handleAssignDeliveryPartner}
        />
      )}
    </div>
  );
};
