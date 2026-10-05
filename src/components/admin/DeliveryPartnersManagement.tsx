import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bike,
  Plus,
  Search,
  RefreshCw,
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  CheckCircle2,
  Navigation,
  AlertCircle,
  Edit3,
  Trash2,
  X,
  Sparkles,
  Car,
  Zap,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  UserX,
  Compass,
  Smartphone,
  Upload,
  FileText,
} from 'lucide-react';
import type {
  Order,
  DeliveryPartner,
  DeliveryPartnerVehicle,
  DeliveryTrackingStage,
  AdminAccessUser,
  AdminRole,
} from '../../types';
import { STAGE_CONFIG } from '../../utils/deliveryFleet';
import { AssignDeliveryPartnerModal } from './AssignDeliveryPartnerModal';
import { api } from '../../services/api';
import { ROLE_CONFIGS } from './AdminAccessManagement';
import { readFileAsDataUrl, MAX_UPLOAD_FILE_SIZE_BYTES } from '../../utils/readFileAsDataUrl';
import { isImageLike } from '../../utils/isImageLike';

interface DeliveryPartnersManagementProps {
  orders: Order[];
  token: string;
  onRefreshOrders: () => void;
  onUpdateOrderStatus?: (orderId: string, status: any, options?: any) => Promise<void>;
  onNotification?: (msg: string) => void;
  currentUser?: AdminAccessUser | null;
  onOpenRiderPortal?: () => void;
}

export const DeliveryPartnersManagement: React.FC<DeliveryPartnersManagementProps> = ({
  orders,
  token,
  onRefreshOrders,
  onUpdateOrderStatus,
  onNotification,
  currentUser,
  onOpenRiderPortal,
}) => {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [activeTab, setActiveTab] = useState<'fleet' | 'dispatches'>('fleet');
  const [searchQuery, setSearchQuery] = useState('');
  const [dispatchFilter, setDispatchFilter] = useState<'all' | 'unassigned' | 'in_transit' | 'delivered'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Assign Delivery Partner Modal
  const [orderToAssign, setOrderToAssign] = useState<Order | null>(null);

  // Add / Edit Delivery Partner Modal
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicleType: 'bike' as DeliveryPartnerVehicle,
    vehicleNumber: '',
    notes: '',
    rating: 4.9,
    photoUrl: '',
    isOnDuty: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingPartner, setIsSavingPartner] = useState(false);
  const partnerDocInputRef = useRef<HTMLInputElement>(null);
  const [partnerDocFileName, setPartnerDocFileName] = useState<string | null>(null);

  const handlePartnerDocFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      setFormError('File is too large — please choose one under 5MB.');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFormData((prev) => ({ ...prev, photoUrl: dataUrl }));
      setPartnerDocFileName(file.name);
      setFormError(null);
    } catch {
      setFormError('Failed to read the selected file.');
    }
  };
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [partnersError, setPartnersError] = useState<string | null>(null);

  // Delete Partner Confirmation Modal
  const [partnerToDelete, setPartnerToDelete] = useState<DeliveryPartner | null>(null);
  const [isDeletingPartner, setIsDeletingPartner] = useState(false);

  // User permissions helper
  const userRole: AdminRole = currentUser?.role || 'owner';
  const hasPerm = (perm: string): boolean => {
    if (userRole === 'owner') return true;
    if (currentUser?.permissions && currentUser.permissions.includes(perm as any)) return true;
    const defaults = ROLE_CONFIGS[userRole]?.defaultPerms;
    return defaults ? defaults.includes(perm as any) : false;
  };

  const canAssign = hasPerm('delivery.assign');
  const canUpdateStatus = hasPerm('delivery.update_status');
  const canManageFleet = userRole === 'owner' || hasPerm('staff.create') || hasPerm('delivery.assign');

  // Load the real fleet roster from the backend
  const loadPartners = async () => {
    setPartnersError(null);
    try {
      const list = await api.getDeliveryPartners(token);
      setPartners(list);
    } catch (err: any) {
      setPartnersError(err.message || 'Failed to load delivery fleet');
    } finally {
      setPartnersLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadPartners(), onRefreshOrders()]);
      onNotification?.('Delivery fleet & dispatches refreshed');
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter delivery orders
  const deliveryOrders = useMemo(() => {
    return orders.filter(
      (o) => o.orderType === 'delivery' || !!o.deliveryAddress || !!o.deliveryPartner
    );
  }, [orders]);

  // Compute fleet & order KPIs
  const kpis = useMemo(() => {
    const totalFleet = partners.length;
    const onDutyCount = partners.filter((p) => p.isOnDuty !== false).length;
    const unassignedCount = deliveryOrders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'delivered' && !o.deliveryPartner
    ).length;
    const inTransitCount = deliveryOrders.filter(
      (o) =>
        o.status !== 'cancelled' &&
        o.status !== 'delivered' &&
        o.deliveryPartner &&
        o.deliveryTracking?.stage !== 'delivered'
    ).length;
    const completedDeliveries = deliveryOrders.filter(
      (o) => o.status === 'delivered' || o.deliveryTracking?.stage === 'delivered'
    ).length;

    return {
      totalFleet,
      onDutyCount,
      unassignedCount,
      inTransitCount,
      completedDeliveries,
    };
  }, [partners, deliveryOrders]);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.vehicleNumber.toLowerCase().includes(q) ||
        p.vehicleType.toLowerCase().includes(q)
    );
  }, [partners, searchQuery]);

  // Filtered dispatches
  const filteredDispatches = useMemo(() => {
    return deliveryOrders.filter((ord) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ord.id.toLowerCase().includes(q) ||
        ord.customerName?.toLowerCase().includes(q) ||
        ord.customerPhone?.includes(q) ||
        ord.deliveryAddress?.toLowerCase().includes(q) ||
        ord.deliveryPartner?.name.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (dispatchFilter === 'unassigned') {
        return ord.status !== 'cancelled' && ord.status !== 'delivered' && !ord.deliveryPartner;
      }
      if (dispatchFilter === 'in_transit') {
        return (
          ord.status !== 'cancelled' &&
          ord.status !== 'delivered' &&
          ord.deliveryPartner &&
          ord.deliveryTracking?.stage !== 'delivered'
        );
      }
      if (dispatchFilter === 'delivered') {
        return ord.status === 'delivered' || ord.deliveryTracking?.stage === 'delivered';
      }
      return true;
    });
  }, [deliveryOrders, searchQuery, dispatchFilter]);

  // Handle duty toggle
  const handleToggleDuty = async (partner: DeliveryPartner) => {
    const newStatus = partner.isOnDuty === false ? true : false;
    try {
      await api.toggleDeliveryPartnerDuty(token, partner.id, newStatus);
      await loadPartners();
      onNotification?.(`${partner.name} marked as ${newStatus ? 'On-Duty' : 'Off-Duty'}`);
    } catch (err: any) {
      onNotification?.(err.message || 'Failed to update duty status');
    }
  };

  // Open Add Partner Modal
  const handleOpenAdd = () => {
    setEditingPartner(null);
    setFormData({
      name: '',
      phone: '',
      vehicleType: 'bike',
      vehicleNumber: '',
      notes: '',
      rating: 4.9,
      photoUrl: '',
      isOnDuty: true,
    });
    setPartnerDocFileName(null);
    setFormError(null);
    setIsAddEditOpen(true);
  };

  // Open Edit Partner Modal
  const handleOpenEdit = (partner: DeliveryPartner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      phone: partner.phone,
      vehicleType: partner.vehicleType || 'bike',
      vehicleNumber: partner.vehicleNumber || '',
      notes: partner.notes || '',
      rating: partner.rating || 4.9,
      photoUrl: partner.photoUrl || '',
      isOnDuty: partner.isOnDuty !== false,
    });
    setPartnerDocFileName(null);
    setFormError(null);
    setIsAddEditOpen(true);
  };

  // Save Partner (Create or Update)
  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.name.trim()) {
      setFormError('Partner full name is required');
      return;
    }
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!formData.vehicleNumber.trim()) {
      setFormError('Vehicle registration plate number is required');
      return;
    }

    setIsSavingPartner(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: cleanPhone,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber.trim().toUpperCase(),
        notes: formData.notes.trim(),
        photoUrl: formData.photoUrl.trim(),
      };

      if (editingPartner) {
        await api.updateDeliveryPartner(token, editingPartner.id, { ...payload, isOnDuty: formData.isOnDuty });
      } else {
        await api.addDeliveryPartner(token, payload);
      }

      await loadPartners();
      setIsAddEditOpen(false);
      onNotification?.(
        editingPartner
          ? `Updated rider ${payload.name}`
          : `Registered ${payload.name} to delivery fleet`
      );
    } catch (err: any) {
      setFormError(err.message || 'Failed to save delivery partner');
    } finally {
      setIsSavingPartner(false);
    }
  };

  // Confirm delete partner
  const handleConfirmDelete = async () => {
    if (!partnerToDelete) return;
    setIsDeletingPartner(true);
    try {
      await api.removeDeliveryPartner(token, partnerToDelete.id);
      await loadPartners();
      onNotification?.(`Removed ${partnerToDelete.name} from delivery fleet`);
      setPartnerToDelete(null);
    } catch (err: any) {
      onNotification?.(err.message || 'Failed to remove delivery partner');
    } finally {
      setIsDeletingPartner(false);
    }
  };

  // Advance stage for an order
  const handleAdvanceStage = async (order: Order, nextStage: DeliveryTrackingStage) => {
    if (!canUpdateStatus) {
      onNotification?.('You do not have permission to update delivery transit stages');
      return;
    }
    try {
      const stageConfig = STAGE_CONFIG[nextStage];
      await api.updateDeliveryStage(token, order.id, {
        stage: nextStage,
        notes: stageConfig.description,
        progressPercent: stageConfig.progressPercent,
        currentLocationLabel: stageConfig.label,
      });

      if (nextStage === 'delivered' && onUpdateOrderStatus) {
        await onUpdateOrderStatus(order.id, 'delivered', {
          notes: 'Delivered by courier partner',
        });
      } else {
        await onRefreshOrders();
      }
      onNotification?.(`Delivery #${order.id} stage updated: ${stageConfig.label}`);
    } catch (err: any) {
      onNotification?.(`Failed to update delivery stage: ${err.message || 'Error'}`);
    }
  };

  const getVehicleBadge = (vType?: DeliveryPartnerVehicle) => {
    switch (vType) {
      case 'electric_ev':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <Zap className="w-3 h-3 text-emerald-500" />
            <span>EV Electric</span>
          </span>
        );
      case 'scooter':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
            <Bike className="w-3 h-3 text-amber-600" />
            <span>Scooter</span>
          </span>
        );
      case 'car':
      case 'van':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
            <Car className="w-3 h-3 text-blue-600" />
            <span>Vehicle Van/Car</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            <Bike className="w-3 h-3 text-purple-600" />
            <span>Motorcycle</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/25 shadow-xs">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                Delivery Partners &amp; Fleet Logistics
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-orange-500/20 text-orange-800 dark:text-orange-300 border border-orange-500/30">
                Kukas NH-48 Corridor
              </span>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-2xl">
              Manage registered restaurant couriers, vehicle numbers, on-duty status, and live customer delivery dispatches.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenRiderPortal && (
            <button
              onClick={onOpenRiderPortal}
              title="Open the courier mobile dispatch portal"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-xs font-semibold border border-purple-200 dark:border-purple-800 cursor-pointer transition-all active:scale-95"
            >
              <Smartphone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Courier App View</span>
              <span className="sm:hidden">Rider App</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold border border-stone-200 dark:border-stone-700 cursor-pointer transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Fleet</span>
          </button>

          {canManageFleet && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Delivery Partner</span>
            </button>
          )}
        </div>
      </div>

      {/* Fleet KPI Metric Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Fleet Size</span>
            <Bike className="w-4 h-4 text-stone-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 dark:text-stone-100">
            {kpis.totalFleet}
          </p>
          <span className="text-[10px] text-stone-500">Registered riders</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">On-Duty</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {kpis.onDutyCount}
          </p>
          <span className="text-[10px] text-emerald-600/80 font-medium">Available for orders</span>
        </div>

        <div
          onClick={() => {
            setActiveTab('dispatches');
            setDispatchFilter('unassigned');
          }}
          className={`p-3.5 rounded-2xl border shadow-xs cursor-pointer transition-all ${
            kpis.unassignedCount > 0
              ? 'bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Needs Partner</span>
            <AlertCircle className={`w-4 h-4 ${kpis.unassignedCount > 0 ? 'animate-bounce' : ''}`} />
          </div>
          <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {kpis.unassignedCount}
          </p>
          <span className="text-[10px] text-amber-600/90 font-medium">Unassigned orders</span>
        </div>

        <div
          onClick={() => {
            setActiveTab('dispatches');
            setDispatchFilter('in_transit');
          }}
          className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs cursor-pointer hover:border-purple-400 transition-all"
        >
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Out En-Route</span>
            <Navigation className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
            {kpis.inTransitCount}
          </p>
          <span className="text-[10px] text-purple-600/80 font-medium">Active dispatches</span>
        </div>

        <div
          onClick={() => {
            setActiveTab('dispatches');
            setDispatchFilter('delivered');
          }}
          className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs cursor-pointer hover:border-emerald-400 transition-all"
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Fulfilled</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 dark:text-stone-100">
            {kpis.completedDeliveries}
          </p>
          <span className="text-[10px] text-emerald-600/80 font-medium">Delivered to doorstep</span>
        </div>
      </div>

      {/* Tab Switcher & Search Bar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-stone-800 shrink-0">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'fleet'
                ? 'bg-white dark:bg-stone-900 text-orange-600 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>Fleet Directory</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 font-mono">
              {partners.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('dispatches')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dispatches'
                ? 'bg-white dark:bg-stone-900 text-orange-600 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>Live Dispatches</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 font-mono">
              {deliveryOrders.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              activeTab === 'fleet'
                ? 'Search riders by name, phone, plate #...'
                : 'Search order #, customer, address...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dispatch Filter Pills (only when dispatches tab is active) */}
        {activeTab === 'dispatches' && (
          <div className="flex items-center flex-wrap gap-1 text-xs">
            {(['all', 'unassigned', 'in_transit', 'delivered'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setDispatchFilter(filterKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${
                  dispatchFilter === filterKey
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                }`}
              >
                {filterKey.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB A: FLEET DIRECTORY VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'fleet' && (
        <div className="space-y-4">
          {partnersLoading ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
              <RefreshCw className="w-6 h-6 text-stone-300 dark:text-stone-700 mx-auto animate-spin" />
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">Loading delivery fleet...</p>
            </div>
          ) : partnersError ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-white dark:bg-stone-900 border border-rose-200 dark:border-rose-900 shadow-xs space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{partnersError}</p>
              <button
                onClick={() => { setPartnersLoading(true); loadPartners(); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
              <Bike className="w-12 h-12 text-stone-300 dark:text-stone-700 mx-auto" />
              <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
                No Delivery Partners Found
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                {searchQuery
                  ? `No riders match "${searchQuery}". Try a different name or phone number.`
                  : 'Add delivery personnel to your restaurant fleet to handle delivery orders.'}
              </p>
              {canManageFleet && (
                <button
                  onClick={handleOpenAdd}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold cursor-pointer hover:bg-orange-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register First Rider</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPartners.map((partner) => {
                const isOnDuty = partner.isOnDuty !== false;
                // Find if partner is currently active on an order
                const activeTrip = deliveryOrders.find(
                  (o) =>
                    o.deliveryPartner?.id === partner.id &&
                    o.status !== 'delivered' &&
                    o.status !== 'cancelled' &&
                    o.deliveryTracking?.stage !== 'delivered'
                );

                return (
                  <div
                    key={partner.id}
                    className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs hover:border-stone-300 dark:hover:border-stone-700 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Top Row: Avatar, Name, Status Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {partner.photoUrl && isImageLike(partner.photoUrl) ? (
                            <img
                              src={partner.photoUrl}
                              alt={partner.name}
                              className="w-12 h-12 rounded-2xl object-cover border border-stone-200 dark:border-stone-700 shadow-xs shrink-0"
                            />
                          ) : partner.photoUrl ? (
                            <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800/60 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-base shrink-0">
                              {partner.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                              <span>{partner.name}</span>
                              {partner.rating && (
                                <span className="text-xs text-amber-500 font-semibold font-mono">
                                  ★ {partner.rating.toFixed(1)}
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-stone-500 font-mono mt-0.5">
                              +91 {partner.phone}
                            </p>
                          </div>
                        </div>

                        {/* On Duty Status Badge & Toggle */}
                        <button
                          onClick={() => handleToggleDuty(partner)}
                          title="Click to toggle On-Duty / Off-Duty status"
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all ${
                            isOnDuty
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border border-stone-300 dark:border-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOnDuty ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
                            }`}
                          />
                          <span>{isOnDuty ? 'On Duty' : 'Off Duty'}</span>
                        </button>
                      </div>

                      {/* Vehicle & Plate details */}
                      <div className="mt-3.5 flex items-center gap-2 flex-wrap text-xs">
                        {getVehicleBadge(partner.vehicleType)}
                        <span className="font-mono font-bold text-stone-800 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700">
                          {partner.vehicleNumber}
                        </span>
                        {partner.totalDeliveries !== undefined && partner.totalDeliveries > 0 && (
                          <span className="text-[11px] text-stone-500">
                            {partner.totalDeliveries}+ trips
                          </span>
                        )}
                      </div>

                      {partner.notes && (
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-2.5 line-clamp-2 bg-stone-50 dark:bg-stone-800/40 p-2 rounded-xl">
                          {partner.notes}
                        </p>
                      )}

                      {/* Active Trip Banner */}
                      {activeTrip ? (
                        <div className="mt-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs space-y-1">
                          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 font-semibold">
                            <span className="flex items-center gap-1">
                              <Navigation className="w-3.5 h-3.5 animate-spin text-purple-600" />
                              <span>En Route: Order #{activeTrip.id}</span>
                            </span>
                            <span className="text-[10px] font-bold uppercase">
                              {STAGE_CONFIG[activeTrip.deliveryTracking?.stage || 'assigned']?.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-600 dark:text-stone-400 truncate">
                            To: {activeTrip.deliveryAddress || 'Kukas'}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 p-2 rounded-xl bg-stone-50 dark:bg-stone-800/30 text-[11px] text-stone-500 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Ready for new delivery assignments</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Call Button */}
                        <a
                          href={`tel:${partner.phone}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>

                        {/* WhatsApp Button */}
                        <a
                          href={`https://wa.me/91${partner.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Hello ${partner.name}, regarding delivery dispatch from Out of the Town (OTT) Kukas.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </div>

                      {canManageFleet && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(partner)}
                            title="Edit partner details"
                            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPartnerToDelete(partner)}
                            title="Remove partner"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB B: LIVE DISPATCHES VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'dispatches' && (
        <div className="space-y-4">
          {filteredDispatches.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
              <Navigation className="w-12 h-12 text-stone-300 dark:text-stone-700 mx-auto" />
              <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
                No Delivery Orders In This View
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                {searchQuery
                  ? `No delivery dispatches match "${searchQuery}".`
                  : 'Customer delivery orders will appear here automatically for courier assignment and transit updates.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDispatches.map((ord) => {
                const isDelivered =
                  ord.status === 'delivered' || ord.deliveryTracking?.stage === 'delivered';
                const hasPartner = !!ord.deliveryPartner;
                const currentStage = ord.deliveryTracking?.stage || 'assigned';
                const stageCfg = STAGE_CONFIG[currentStage] || STAGE_CONFIG.assigned;

                return (
                  <div
                    key={ord.id}
                    className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs hover:border-stone-300 dark:hover:border-stone-700 transition-all space-y-3.5"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-sm bg-orange-500/15 text-orange-800 dark:text-orange-300 px-2.5 py-1 rounded-xl border border-orange-500/30">
                          #{ord.id}
                        </span>
                        <div>
                          <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                            {ord.customerName}
                          </span>
                          <span className="text-xs text-stone-500 ml-2 font-mono">
                            {ord.customerPhone}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Overall Status Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            isDelivered
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : hasPartner
                              ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                              : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isDelivered
                            ? 'Delivered'
                            : hasPartner
                            ? stageCfg.label
                            : 'Needs Delivery Partner'}
                        </span>

                        <span className="text-xs font-mono font-bold text-stone-900 dark:text-stone-100">
                          ₹{ord.total.toFixed(0)}
                        </span>
                      </div>
                    </div>

                    {/* Destination Address */}
                    {ord.deliveryAddress && (
                      <div className="flex items-start gap-2 text-xs text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-800/40 p-2.5 rounded-xl border border-stone-200/60 dark:border-stone-700/60">
                        <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-stone-900 dark:text-stone-100">Deliver to:</strong>{' '}
                          {ord.deliveryAddress}
                        </div>
                      </div>
                    )}

                    {/* Delivery Partner Details & Stage Progression */}
                    {hasPartner ? (
                      <div className="p-3.5 rounded-2xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              <Bike className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-900 dark:text-stone-100">
                                  {ord.deliveryPartner!.name}
                                </span>
                                {getVehicleBadge(ord.deliveryPartner!.vehicleType)}
                                <span className="font-mono text-[11px] text-stone-500">
                                  {ord.deliveryPartner!.vehicleNumber}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500 font-mono">
                                Ph: {ord.deliveryPartner!.phone}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${ord.deliveryPartner!.phone}`}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:text-stone-900 text-xs font-semibold border border-stone-200 dark:border-stone-700 flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>Call</span>
                            </a>
                            <a
                              href={`https://wa.me/91${ord.deliveryPartner!.phone.replace(
                                /\D/g,
                                ''
                              )}?text=${encodeURIComponent(
                                `Hello ${ord.deliveryPartner!.name}, status update for OTT Order #${ord.id} to ${ord.customerName}.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </a>

                            {canAssign && (
                              <button
                                onClick={() => setOrderToAssign(ord)}
                                className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 text-xs font-semibold"
                              >
                                Reassign
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-stone-500">
                            <span>Stage: {stageCfg.label}</span>
                            <span className="font-mono font-bold text-orange-600">
                              {ord.deliveryTracking?.progressPercent || stageCfg.progressPercent}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                              style={{
                                width: `${ord.deliveryTracking?.progressPercent || stageCfg.progressPercent}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Stage Progression Buttons (Click to advance stage) */}
                        {canUpdateStatus && !isDelivered && (
                          <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-bold text-stone-500 mr-1">
                              Update Stage:
                            </span>
                            {(
                              [
                                { stage: 'arrived_at_pickup', label: 'At Restaurant' },
                                { stage: 'picked_up', label: 'Food Picked Up' },
                                { stage: 'on_the_way', label: 'On The Way' },
                                { stage: 'near_destination', label: 'Arriving Soon' },
                                { stage: 'delivered', label: 'Mark Delivered' },
                              ] as const
                            ).map((s) => (
                              <button
                                key={s.stage}
                                onClick={() => handleAdvanceStage(ord, s.stage)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                  currentStage === s.stage
                                    ? 'bg-orange-600 text-white shadow-xs'
                                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700'
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Unassigned Order Prompt */
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            No delivery courier assigned yet. Order is ready or cooking in kitchen.
                          </span>
                        </div>
                        {canAssign && (
                          <button
                            onClick={() => setOrderToAssign(ord)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95"
                          >
                            <Bike className="w-3.5 h-3.5" />
                            <span>Assign Delivery Partner</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT DELIVERY PARTNER */}
      {/* ========================================================================= */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-lg w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-600 flex items-center justify-center">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-serif">
                    {editingPartner ? 'Edit Delivery Partner' : 'Register New Delivery Partner'}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Add courier rider to the Kukas delivery fleet
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSavePartner} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Rider Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Gurjar"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Mobile Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9829012345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Vehicle Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.vehicleType}
                    onChange={(e) =>
                      setFormData({ ...formData, vehicleType: e.target.value as DeliveryPartnerVehicle })
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500 cursor-pointer"
                  >
                    <option value="bike">Motorcycle / Bike</option>
                    <option value="scooter">Scooter (Activa / Jupiter)</option>
                    <option value="electric_ev">Electric Scooter / EV</option>
                    <option value="car">Car / Delivery Van</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Vehicle Number Plate <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RJ 14 BK 4022"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm uppercase font-mono rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-stone-700 dark:text-stone-300">
                    ID / Document Photo (Optional)
                  </label>
                  <span className="text-[10px] text-stone-400">Image or PDF/DOC, up to 5MB</span>
                </div>

                {formData.photoUrl ? (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
                    {isImageLike(formData.photoUrl) ? (
                      <img
                        src={formData.photoUrl}
                        alt="Document preview"
                        className="w-12 h-12 rounded-lg object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                        {partnerDocFileName || 'Document attached'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => partnerDocInputRef.current?.click()}
                          className="text-[11px] font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, photoUrl: '' });
                            setPartnerDocFileName(null);
                          }}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => partnerDocInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-orange-500 dark:hover:border-orange-500 rounded-xl p-4 text-center cursor-pointer transition-all bg-stone-50/50 dark:bg-stone-800/40 hover:bg-orange-50/40"
                  >
                    <Upload className="w-4 h-4 mx-auto mb-1 text-orange-600 dark:text-orange-400" />
                    <p className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                      Click to upload photo or ID document
                    </p>
                  </div>
                )}

                <input
                  ref={partnerDocInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={handlePartnerDocFile}
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Operating Zone &amp; Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kukas RIICO & NH-48 express route"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rider-is-on-duty"
                  checked={formData.isOnDuty}
                  onChange={(e) => setFormData({ ...formData, isOnDuty: e.target.checked })}
                  className="w-4 h-4 rounded-md text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <label
                  htmlFor="rider-is-on-duty"
                  className="font-bold text-stone-800 dark:text-stone-200 cursor-pointer"
                >
                  On Duty &amp; Available for Delivery Dispatches immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  disabled={isSavingPartner}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPartner}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingPartner && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {isSavingPartner ? 'Saving...' : editingPartner ? 'Update Partner' : 'Save Delivery Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DELETE PARTNER CONFIRMATION */}
      {/* ========================================================================= */}
      {partnerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Remove Delivery Partner
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Remove rider from restaurant fleet registry
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Are you sure you want to remove <strong>{partnerToDelete.name}</strong> ({partnerToDelete.vehicleNumber}) from the delivery fleet? This will remove them from the active couriers list.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPartnerToDelete(null)}
                disabled={isDeletingPartner}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingPartner}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeletingPartner && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {isDeletingPartner ? 'Removing...' : 'Yes, Remove Partner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ASSIGN DELIVERY PARTNER TO ORDER */}
      {/* ========================================================================= */}
      {orderToAssign && (
        <AssignDeliveryPartnerModal
          isOpen={true}
          order={orderToAssign}
          token={token}
          onClose={() => setOrderToAssign(null)}
          onAssign={async (data) => {
            try {
              await api.assignDeliveryPartner(token, orderToAssign.id, {
                partner: data.partner,
                estimatedMinutes: data.estimatedMinutes,
                notes: data.notes,
                initialStage: data.initialStage,
              });
              setOrderToAssign(null);
              await onRefreshOrders();
              loadPartners();
              onNotification?.(
                `Assigned ${data.partner.name} to Order #${orderToAssign.id}`
              );
            } catch (err: any) {
              onNotification?.(`Failed to assign partner: ${err.message || 'Error'}`);
            }
          }}
        />
      )}
    </div>
  );
};
