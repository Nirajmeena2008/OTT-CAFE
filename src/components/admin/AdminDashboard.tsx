import React, { useState, useEffect, useRef } from 'react';
import {
  Store,
  UtensilsCrossed,
  Tag,
  ShoppingBag,
  CalendarCheck,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  Eye,
  LogOut,
  Sparkles,
  AlertCircle,
  Clock,
  MapPin,
  Phone,
  TrendingUp,
  FolderEdit,
  Layers,
  Volume2,
  VolumeX,
  Printer,
  Database,
  Cake,
  ShieldCheck,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { api } from '../../services/api';
import { readFileAsDataUrl, MAX_UPLOAD_FILE_SIZE_BYTES } from '../../utils/readFileAsDataUrl';
import type { MenuItem, PromoBanner, Order, Reservation, CafeInfo, OrderStatus, Category, AdminAccessUser } from '../../types';
import { OrdersManagement } from './OrdersManagement';
import { RevenueAnalysis } from './RevenueAnalysis';
import { KitchenOrderTicket } from './KitchenOrderTicket';
import { CategoryManagementView } from './CategoryManagementView';
import { CustomCakesManagement } from './CustomCakesManagement';
import { SlideableOptionBar } from './SlideableOptionBar';
import { MySQLManagement } from './MySQLManagement';
import { AdminAccessManagement, ROLE_CONFIGS } from './AdminAccessManagement';
import { canUserAccessModule, normalizeRole, getRoleModuleAccess } from '../../utils/rbacMatrix';
import { bellSound } from '../../utils/sound';

interface AdminDashboardProps {
  token: string;
  onLogout: () => void;
  onClose: () => void;
  menuItems?: MenuItem[];
  promoBanners?: PromoBanner[];
  cafeInfo?: CafeInfo | null;
  categories?: Category[];
  onUpdateMenuItems?: (items: MenuItem[]) => void;
  onUpdatePromoBanners?: (banners: PromoBanner[]) => void;
  onUpdateCategories?: (cats: Category[]) => void;
  onMenuUpdated?: () => void;
}

type AdminTab =
  | 'orders'
  | 'reservations'
  | 'cakes'
  | 'menu'
  | 'categories'
  | 'banners'
  | 'revenue'
  | 'database'
  | 'team_access'
  | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  token,
  onLogout,
  onClose,
  menuItems: initialMenuItems,
  promoBanners: initialPromoBanners,
  cafeInfo: initialCafeInfo,
  categories: initialCategories,
  onUpdateMenuItems,
  onUpdatePromoBanners,
  onUpdateCategories,
  onMenuUpdated,
}) => {
  const isMasterToken = token === '123' || token === 'aura_cafe_admin_sec_token_123' || token.includes('master');

  const [currentUser, setCurrentUser] = useState<AdminAccessUser | null>(() => {
    try {
      const saved = sessionStorage.getItem('aura_cafe_admin_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const userRole = normalizeRole(currentUser?.role || (isMasterToken ? 'owner' : 'staff'));

  // Permission evaluation helper: Owner / Master token always returns true; other roles check explicit perms, module matrix, or defaults
  const hasPerm = (perm: string): boolean => {
    if (isMasterToken) return true;
    if (userRole === 'owner' || currentUser?.email?.toLowerCase() === 'kumarsatyam5868@gmail.com') return true;
    if (currentUser?.permissions && (currentUser.permissions.includes('*') || currentUser.permissions.includes(perm as any))) return true;

    // Check by module access matrix
    if (perm.startsWith('orders.')) return canUserAccessModule(currentUser, 'orders', token);
    if (perm.startsWith('menu.')) return canUserAccessModule(currentUser, 'menu', token);
    if (perm.startsWith('inventory.')) return canUserAccessModule(currentUser, 'inventory', token);
    if (perm.startsWith('finance.')) return canUserAccessModule(currentUser, 'finance', token);
    if (perm.startsWith('staff.')) return canUserAccessModule(currentUser, 'staff', token);
    if (perm.startsWith('marketing.') || perm.startsWith('banners.')) return canUserAccessModule(currentUser, 'marketing', token);
    if (perm.startsWith('reports.')) return canUserAccessModule(currentUser, 'reports', token);
    if (perm.startsWith('settings.')) return canUserAccessModule(currentUser, 'settings', token);
    if (perm.startsWith('database.')) return false;

    const defaults = ROLE_CONFIGS[userRole]?.defaultPerms;
    return defaults ? defaults.includes(perm as any) : false;
  };

  const canAccessTab = (tab: AdminTab): boolean => {
    if (isMasterToken || userRole === 'owner' || currentUser?.email?.toLowerCase() === 'kumarsatyam5868@gmail.com') return true;
    switch (tab) {
      case 'orders':
      case 'reservations':
        return canUserAccessModule(currentUser, 'orders', token);
      case 'cakes':
        return canUserAccessModule(currentUser, 'orders', token) || canUserAccessModule(currentUser, 'menu', token);
      case 'menu':
      case 'categories':
        return canUserAccessModule(currentUser, 'menu', token);
      case 'banners':
        return canUserAccessModule(currentUser, 'marketing', token);
      case 'revenue':
        return canUserAccessModule(currentUser, 'finance', token) || canUserAccessModule(currentUser, 'reports', token);
      case 'database':
        return false;
      case 'team_access':
        return canUserAccessModule(currentUser, 'staff', token);
      case 'settings':
        return canUserAccessModule(currentUser, 'settings', token);
      default:
        return false;
    }
  };

  const tabPermMap: Record<AdminTab, string> = {
    orders: 'orders.view',
    reservations: 'reservations.view',
    cakes: 'orders.view',
    menu: 'menu.view',
    categories: 'menu.view',
    banners: 'banners.view',
    revenue: 'finance.view_sales',
    database: 'database.view',
    team_access: 'staff.view',
    settings: 'settings.view',
  };

  const getInitialTab = (): AdminTab => {
    try {
      const savedUserStr = sessionStorage.getItem('aura_cafe_admin_user');
      if (savedUserStr) {
        const u: AdminAccessUser = JSON.parse(savedUserStr);
        if (u.role === 'owner' || u.email?.toLowerCase() === 'kumarsatyam5868@gmail.com') return 'orders';
        if (canUserAccessModule(u, 'orders', token)) return 'orders';
        if (canUserAccessModule(u, 'menu', token)) return 'menu';
        if (canUserAccessModule(u, 'marketing', token)) return 'banners';
        if (canUserAccessModule(u, 'finance', token) || canUserAccessModule(u, 'reports', token)) return 'revenue';
        if (canUserAccessModule(u, 'staff', token)) return 'team_access';
      }
    } catch {}
    return 'orders';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialTab);

  // Fetch current authenticated staff/owner profile
  useEffect(() => {
    let isMounted = true;
    api
      .checkAdminAccess(token)
      .then((res) => {
        if (isMounted && res.hasAccess && res.user) {
          setCurrentUser(res.user);
          try {
            sessionStorage.setItem('aura_cafe_admin_user', JSON.stringify(res.user));
          } catch {}
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Automatically switch tab if current activeTab is restricted for this role
  useEffect(() => {
    if (userRole === 'owner') return;
    if (!hasPerm(tabPermMap[activeTab])) {
      const allowed = (Object.keys(tabPermMap) as AdminTab[]).find((t) => hasPerm(tabPermMap[t]));
      if (allowed) setActiveTab(allowed);
    }
  }, [currentUser, userRole, activeTab]);

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('aura_cafe_admin_user');
      sessionStorage.removeItem('aura_cafe_admin_token');
    } catch {}
    onLogout();
  };

  // State collections initialized immediately from props for zero-lag display
  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems || []);
  const [banners, setBanners] = useState<PromoBanner[]>(initialPromoBanners || []);
  const [cafeInfo, setCafeInfo] = useState<CafeInfo | null>(initialCafeInfo || null);
  const [categories, setCategories] = useState<Category[]>(
    initialCategories && initialCategories.length > 0
      ? initialCategories
      : [
          { id: 'cat-all', name: 'All Dishes', slug: 'all', icon: 'Sparkles' },
          { id: 'cat-thali', name: 'Special Thalis', slug: 'thali', icon: 'UtensilsCrossed' },
          { id: 'cat-bakery', name: 'Bakery & Cakes', slug: 'bakery', icon: 'Cake' },
          { id: 'cat-bites', name: 'Bites & Chaat', slug: 'bites', icon: 'Flame' },
          { id: 'cat-burgers', name: 'Burgers & Wraps', slug: 'burgers', icon: 'Sandwich' },
          { id: 'cat-italian', name: 'Pizzas & Pastas', slug: 'italian', icon: 'Pizza' },
          { id: 'cat-mains', name: 'North Indian Mains', slug: 'mains', icon: 'Soup' },
          { id: 'cat-shakes', name: 'Shakes & Coolers', slug: 'shakes', icon: 'Wine' },
          { id: 'cat-coffee', name: 'Coffee & Kulhad Chai', slug: 'coffee', icon: 'Coffee' },
        ]
  );
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormSlug, setCategoryFormSlug] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('all');

  // Bulk discount: lets the admin multi-select dishes and apply one discount % to all of them
  const [isBulkDiscountMode, setIsBulkDiscountMode] = useState(false);
  const [discountSelectedIds, setDiscountSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState(10);
  const [isApplyingBulkDiscount, setIsApplyingBulkDiscount] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Auto KOT & Bell Sound State
  const [autoKotOrder, setAutoKotOrder] = useState<Order | null>(null);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialOrdersLoadRef = useRef<boolean>(true);

  // Sync with prop updates if available
  useEffect(() => {
    if (initialMenuItems && initialMenuItems.length > 0) {
      setMenuItems(initialMenuItems);
    }
  }, [initialMenuItems]);

  useEffect(() => {
    if (initialPromoBanners && initialPromoBanners.length > 0) {
      setBanners(initialPromoBanners);
    }
  }, [initialPromoBanners]);

  useEffect(() => {
    if (initialCafeInfo) {
      setCafeInfo(initialCafeInfo);
    }
  }, [initialCafeInfo]);

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setCategories(initialCategories);
    }
  }, [initialCategories]);

  // MySQL 10-Minute Auto-Sync status
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  // Real connection state — the badge must never claim active cloud sync when MySQL
  // isn't actually configured/reachable. null = not checked yet.
  const [mysqlConnected, setMysqlConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!hasPerm('database.view')) return;
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const status = await api.getMySQLStatus(token);
        if (!cancelled) setMysqlConnected(Boolean(status.configured && status.connected));
      } catch {
        if (!cancelled) setMysqlConnected(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // New Menu Item form modal state
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState({
    name: '',
    category: 'thali',
    description: '',
    price: 180,
    originalPrice: 220,
    isVeg: true,
    isBestseller: false,
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    preparationTimeMinutes: 15,
  });

  // New Banner form modal state
  const [isAddBannerOpen, setIsAddBannerOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PromoBanner | null>(null);
  const menuImageInputRef = useRef<HTMLInputElement>(null);
  const bannerImageInputRef = useRef<HTMLInputElement>(null);
  const [bannerForm, setBannerForm] = useState({
    title: '',
    subtitle: '',
    highlightBadge: 'SPECIAL OFFER',
    discountText: '20% OFF',
    code: 'SAVE20',
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80',
    badgeBgColor: 'bg-amber-600',
    targetCategory: 'all',
  });

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Shared "upload image from device" handler for both the dish and banner
  // image fields -- reads the picked file to a Data URL and hands it to the
  // caller's setter, so no server upload endpoint is required.
  const handleImageFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onLoaded: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      showNotification('Image is too large — please choose a file under 5MB');
      return;
    }
    try {
      onLoaded(await readFileAsDataUrl(file));
    } catch {
      showNotification('Failed to read the selected image file');
    }
  };

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      const [oList, rList, mList, bList, cInfo, catList] = await Promise.all([
        api.getAdminOrders(token),
        api.getAdminReservations(token),
        api.getMenuItems(),
        api.getPromoBanners(),
        api.getCafeInfo(),
        api.getCategories().catch(() => []),
      ]);
      setOrders(oList);
      (oList || []).forEach((o) => knownOrderIdsRef.current.add(o.id));
      isInitialOrdersLoadRef.current = false;
      setReservations(rList);
      setMenuItems(mList);
      setBanners(bList);
      setCafeInfo(cInfo);
      if (catList && catList.length > 0) {
        setCategories(catList);
      }
    } catch (err: any) {
      showNotification('Failed to sync management data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Category Management Handlers
  const handleUpdateCategory = async (catId: string, name: string, slug?: string) => {
    if (!name.trim()) return;
    const prevCats = categories;
    const targetCat = categories.find((c) => c.id === catId || c.slug === catId);
    const oldSlug = targetCat?.slug;
    const newSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).trim();

    const updatedCats = categories.map((c) =>
      c.id === catId || c.slug === catId
        ? { ...c, name: name.trim(), slug: newSlug }
        : c
    );
    setCategories(updatedCats);
    onUpdateCategories?.(updatedCats);

    // Also update any menu items mapped to this category locally
    if (oldSlug && newSlug && oldSlug !== newSlug) {
      const updatedMenuItems = menuItems.map((item) =>
        item.category === oldSlug ? { ...item, category: newSlug } : item
      );
      setMenuItems(updatedMenuItems);
      onUpdateMenuItems?.(updatedMenuItems);
    }

    showNotification(`Category updated to "${name}"`);
    setEditingCategory(null);

    try {
      await api.updateCategory(token, catId, { name, slug: newSlug });
      onMenuUpdated?.();
    } catch (err: any) {
      setCategories(prevCats);
      showNotification('Failed to update category: ' + err.message);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const name = newCatName.trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const tempCat: Category = {
      id: `cat-${Date.now()}`,
      name,
      slug,
      icon: 'UtensilsCrossed',
    };
    const nextCats = [...categories, tempCat];
    setCategories(nextCats);
    onUpdateCategories?.(nextCats);
    setNewCatName('');
    showNotification(`Category "${name}" added`);

    try {
      const saved = await api.addCategory(token, { name, slug });
      setCategories((curr) => curr.map((c) => (c.id === tempCat.id ? saved : c)));
      onMenuUpdated?.();
    } catch (err: any) {
      setCategories(categories);
      showNotification('Failed to add category: ' + err.message);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    const prevCats = categories;
    const nextCats = categories.filter((c) => c.id !== catId && c.slug !== catId);
    setCategories(nextCats);
    onUpdateCategories?.(nextCats);
    showNotification('Category removed');

    try {
      await api.deleteCategory(token, catId);
      onMenuUpdated?.();
    } catch (err: any) {
      setCategories(prevCats);
      showNotification('Failed to remove category: ' + err.message);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [token]);

  // Order arrival listener: rings the bell sound exclusively on the admin's device & auto-generates KOT
  useEffect(() => {
    // Unlock browser audio context on first administrator interaction
    const unlockAudio = () => {
      bellSound.unlock();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    // Poll every 3.5 seconds to detect fresh incoming customer orders
    const pollInterval = setInterval(async () => {
      try {
        const freshOrders = await api.getAdminOrders(token);
        if (!freshOrders || !Array.isArray(freshOrders)) return;

        // If this is first sync, record existing order IDs to avoid ringing for historical orders
        if (isInitialOrdersLoadRef.current) {
          freshOrders.forEach((o) => knownOrderIdsRef.current.add(o.id));
          isInitialOrdersLoadRef.current = false;
          setOrders(freshOrders);
          return;
        }

        // Detect brand-new pending orders that were placed since last poll
        const newlyArrived = freshOrders.filter(
          (o) => !knownOrderIdsRef.current.has(o.id) && o.status === 'pending'
        );

        // Update known order IDs
        freshOrders.forEach((o) => knownOrderIdsRef.current.add(o.id));
        setOrders(freshOrders);

        if (newlyArrived.length > 0) {
          // Play the order bell sound exclusively on the admin device!
          if (!isSoundMuted) {
            bellSound.ringOrderBell();
          }

          const incomingOrder = newlyArrived[0];
          showNotification(
            `🔔 NEW ORDER #${incomingOrder.id.slice(-6).toUpperCase()} RECEIVED! (${incomingOrder.customerName || 'Customer'})`
          );

          // Prepare KOT modal for administrative review
          setAutoKotOrder(incomingOrder);
        }
      } catch (err) {
        // Continue polling silently
      }
    }, 3500);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [token, isSoundMuted]);

  // 10-Minute Automatic Cloud Sync with MySQL & comprehensive data refresh — skipped
  // entirely when MySQL isn't actually connected, so this doesn't fire a doomed network
  // call forever and the badge never has to fake a "synced" timestamp.
  useEffect(() => {
    if (!mysqlConnected) return;
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const autoSyncTimer = setInterval(async () => {
      try {
        setIsSyncing(true);
        console.log('[Admin Dashboard] Executing 10-minute automatic cloud sync with MySQL...');
        await api.syncMySQLAll(token).catch((err) => {
          console.warn('[Admin Dashboard] Auto-sync warning:', err.message);
        });
        await loadAllData();
        setLastSyncTime(new Date());
      } catch (err: any) {
        console.warn('[Admin Dashboard] 10-minute auto-sync failed:', err);
      } finally {
        setIsSyncing(false);
      }
    }, TEN_MINUTES_MS);

    return () => clearInterval(autoSyncTimer);
  }, [token, mysqlConnected]);

  // Handle Order status update - INSTANT OPTIMISTIC UPDATE
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    options?: {
      notes?: string;
      acceptedBy?: string;
      acceptedAt?: string;
      estimatedTimeMinutes?: number;
    } | string
  ) => {
    const prevOrders = orders;
    const optObj = typeof options === 'object' ? options : {};
    const updated = orders.map((o) => {
      if (o.id === orderId) {
        return {
          ...o,
          status,
          ...(optObj.acceptedBy ? { acceptedBy: optObj.acceptedBy } : {}),
          ...(optObj.acceptedAt ? { acceptedAt: optObj.acceptedAt } : {}),
          ...(optObj.estimatedTimeMinutes ? { estimatedTimeMinutes: optObj.estimatedTimeMinutes } : {}),
          ...(optObj.notes ? { specialInstructions: (o.specialInstructions ? o.specialInstructions + ' | ' : '') + optObj.notes } : {}),
        };
      }
      return o;
    });
    setOrders(updated);
    const staffInfo = typeof options === 'object' && options?.acceptedBy ? ` by ${options.acceptedBy}` : '';
    showNotification(`Order ${orderId} marked as ${status}${staffInfo}`);

    try {
      const serverUpdated = await api.updateOrderStatus(token, orderId, status, options);
      setOrders((curr) => curr.map((o) => (o.id === orderId ? serverUpdated : o)));
    } catch (err: any) {
      setOrders(prevOrders);
      showNotification('Failed to update order status: ' + err.message);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const handlePurgeAllOrders = () => {
    setOrders([]);
    knownOrderIdsRef.current.clear();
  };

  const handleCancelOrder = (orderId: string, reason?: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'cancelled' as OrderStatus,
              specialInstructions: (o.specialInstructions ? o.specialInstructions + ' | ' : '') + `Cancelled: ${reason || 'Customer request'}`,
            }
          : o
      )
    );
  };

  // Handle Reservation status update - INSTANT OPTIMISTIC UPDATE
  const handleUpdateReservationStatus = async (resvId: string, status: string) => {
    const prevReservations = reservations;
    const updated = reservations.map((r) => (r.id === resvId ? { ...r, status: status as any } : r));
    setReservations(updated);
    showNotification(`Reservation ${resvId} updated to ${status}`);

    try {
      const serverUpdated = await api.updateReservationStatus(token, resvId, status);
      setReservations((curr) => curr.map((r) => (r.id === resvId ? serverUpdated : r)));
    } catch (err: any) {
      setReservations(prevReservations);
      showNotification('Failed to update reservation: ' + err.message);
    }
  };

  // Quick toggle bestseller tag on dish
  const handleToggleBestseller = async (item: MenuItem) => {
    const nextBestseller = !item.isBestseller;
    const prevItems = menuItems;
    const nextItems = menuItems.map((m) =>
      m.id === item.id ? { ...m, isBestseller: nextBestseller } : m
    );
    setMenuItems(nextItems);
    onUpdateMenuItems?.(nextItems);
    showNotification(
      nextBestseller
        ? `⭐ "${item.name}" marked as Bestseller!`
        : `"${item.name}" removed from Bestsellers`
    );

    try {
      await api.updateMenuItem(token, item.id, { isBestseller: nextBestseller });
      onMenuUpdated?.();
    } catch (err: any) {
      setMenuItems(prevItems);
      onUpdateMenuItems?.(prevItems);
      showNotification('Failed to update bestseller tag: ' + err.message);
    }
  };

  // Save / Edit Menu item - INSTANT ADDITION & EDIT
  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      const prevItems = menuItems;
      const updated: MenuItem = {
        ...editingItem,
        name: menuForm.name,
        category: menuForm.category,
        description: menuForm.description,
        price: Number(menuForm.price),
        originalPrice: menuForm.originalPrice ? Number(menuForm.originalPrice) : undefined,
        isVeg: menuForm.isVeg,
        isBestseller: menuForm.isBestseller,
        image: menuForm.image,
        preparationTimeMinutes: Number(menuForm.preparationTimeMinutes) || 15,
      };
      const nextItems = prevItems.map((m) => (m.id === editingItem.id ? updated : m));
      // INSTANT UI UPDATE
      setMenuItems(nextItems);
      onUpdateMenuItems?.(nextItems);
      setIsAddMenuOpen(false);
      setEditingItem(null);
      showNotification('Dish updated successfully');

      try {
        const saved = await api.updateMenuItem(token, editingItem.id, menuForm);
        setMenuItems((curr) => curr.map((m) => (m.id === saved.id ? saved : m)));
        onUpdateMenuItems?.(nextItems.map((m) => (m.id === saved.id ? saved : m)));
      } catch (err: any) {
        setMenuItems(prevItems);
        onUpdateMenuItems?.(prevItems);
        showNotification('Failed to update dish: ' + err.message);
      }
    } else {
      const tempId = 'dish_' + Date.now();
      const newItem: MenuItem = {
        id: tempId,
        name: menuForm.name,
        category: menuForm.category,
        description: menuForm.description,
        price: Number(menuForm.price),
        originalPrice: menuForm.originalPrice ? Number(menuForm.originalPrice) : undefined,
        isVeg: menuForm.isVeg,
        isBestseller: menuForm.isBestseller,
        isAvailable: true,
        image: menuForm.image,
        rating: 4.8,
        reviewsCount: 1,
        preparationTimeMinutes: Number(menuForm.preparationTimeMinutes) || 15,
        tags: [menuForm.category, menuForm.isVeg ? 'Veg' : 'Non-Veg'],
      };
      const prevItems = menuItems;
      const nextItems = [newItem, ...prevItems];
      // INSTANT UI UPDATE
      setMenuItems(nextItems);
      onUpdateMenuItems?.(nextItems);
      setIsAddMenuOpen(false);
      showNotification('New dish added to digital menu');

      try {
        const created = await api.addMenuItem(token, menuForm);
        setMenuItems((curr) => curr.map((m) => (m.id === tempId ? created : m)));
        onUpdateMenuItems?.(nextItems.map((m) => (m.id === tempId ? created : m)));
      } catch (err: any) {
        setMenuItems(prevItems);
        onUpdateMenuItems?.(prevItems);
        showNotification('Failed to add dish: ' + err.message);
      }
    }
  };

  const toggleDiscountSelection = (id: string) => {
    setDiscountSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Apply one discount % across every selected dish - INSTANT OPTIMISTIC UPDATE.
  // originalPrice is only set the first time (preserving the true original price
  // across repeated discount applications) and price is recomputed from it, so
  // re-running this on already-discounted dishes doesn't compound the discount.
  const handleApplyBulkDiscount = async () => {
    if (discountSelectedIds.size === 0 || bulkDiscountPercent <= 0) return;
    setIsApplyingBulkDiscount(true);
    const prevItems = menuItems;
    const nextItems = prevItems.map((item) => {
      if (!discountSelectedIds.has(item.id)) return item;
      const basePrice = item.originalPrice || item.price;
      const discountedPrice = Math.round(basePrice * (1 - bulkDiscountPercent / 100));
      return { ...item, originalPrice: basePrice, price: discountedPrice };
    });
    setMenuItems(nextItems);
    onUpdateMenuItems?.(nextItems);

    const targets = nextItems.filter((item) => discountSelectedIds.has(item.id));
    const results = await Promise.allSettled(
      targets.map((item) =>
        api.updateMenuItem(token, item.id, { originalPrice: item.originalPrice, price: item.price })
      )
    );
    const failures = results.filter((r) => r.status === 'rejected').length;

    setIsApplyingBulkDiscount(false);
    setIsBulkDiscountMode(false);
    setDiscountSelectedIds(new Set());

    if (failures > 0) {
      showNotification(`Applied ${bulkDiscountPercent}% off to ${targets.length - failures} dish(es); ${failures} failed to save`);
    } else {
      showNotification(`${bulkDiscountPercent}% off applied to ${targets.length} dish(es)`);
    }
  };

  // Toggle item availability - INSTANT OPTIMISTIC UPDATE
  const handleToggleAvailability = async (item: MenuItem) => {
    const prevItems = menuItems;
    const updated: MenuItem = { ...item, isAvailable: !item.isAvailable };
    const nextItems = prevItems.map((m) => (m.id === item.id ? updated : m));
    setMenuItems(nextItems);
    onUpdateMenuItems?.(nextItems);
    showNotification(`${item.name} marked ${!item.isAvailable ? 'Available' : 'Sold Out'}`);

    try {
      await api.updateMenuItem(token, item.id, { isAvailable: !item.isAvailable });
    } catch (err: any) {
      setMenuItems(prevItems);
      onUpdateMenuItems?.(prevItems);
      showNotification('Failed to toggle availability: ' + err.message);
    }
  };

  // Delete Menu item - INSTANT OPTIMISTIC REMOVAL
  const handleDeleteMenuItem = async (id: string) => {
    const prevItems = menuItems;
    const nextItems = prevItems.filter((m) => m.id !== id);
    // INSTANT: disappears immediately
    setMenuItems(nextItems);
    onUpdateMenuItems?.(nextItems);
    showNotification('Menu item deleted');

    try {
      await api.deleteMenuItem(token, id);
    } catch (err: any) {
      setMenuItems(prevItems);
      onUpdateMenuItems?.(prevItems);
      showNotification('Failed to delete menu item: ' + err.message);
    }
  };

  // Save / Edit Banner - INSTANT OPTIMISTIC UPDATE
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingBanner) {
      const prevBanners = banners;
      const updated: PromoBanner = { ...editingBanner, ...bannerForm };
      const nextBanners = prevBanners.map((b) => (b.id === editingBanner.id ? updated : b));
      setBanners(nextBanners);
      onUpdatePromoBanners?.(nextBanners);
      setIsAddBannerOpen(false);
      setEditingBanner(null);
      showNotification('Banner updated');

      try {
        const saved = await api.updatePromoBanner(token, editingBanner.id, bannerForm);
        setBanners((curr) => curr.map((b) => (b.id === saved.id ? saved : b)));
        onUpdatePromoBanners?.(nextBanners.map((b) => (b.id === saved.id ? saved : b)));
      } catch (err: any) {
        setBanners(prevBanners);
        onUpdatePromoBanners?.(prevBanners);
        showNotification('Failed to update banner: ' + err.message);
      }
      return;
    }

    const tempId = 'banner_' + Date.now();
    const newBanner: PromoBanner = {
      id: tempId,
      title: bannerForm.title,
      subtitle: bannerForm.subtitle,
      highlightBadge: bannerForm.highlightBadge,
      discountText: bannerForm.discountText,
      code: bannerForm.code,
      imageUrl: bannerForm.imageUrl,
      badgeBgColor: bannerForm.badgeBgColor,
      targetCategory: bannerForm.targetCategory,
      active: true,
    };
    const prevBanners = banners;
    const nextBanners = [newBanner, ...prevBanners];
    // INSTANT: appears immediately
    setBanners(nextBanners);
    onUpdatePromoBanners?.(nextBanners);
    setIsAddBannerOpen(false);
    showNotification('New promotional banner created');

    try {
      const created = await api.addPromoBanner(token, bannerForm);
      setBanners((curr) => curr.map((b) => (b.id === tempId ? created : b)));
      onUpdatePromoBanners?.(nextBanners.map((b) => (b.id === tempId ? created : b)));
    } catch (err: any) {
      setBanners(prevBanners);
      onUpdatePromoBanners?.(prevBanners);
      showNotification('Failed to add banner: ' + err.message);
    }
  };

  // Delete Banner - INSTANT OPTIMISTIC REMOVAL
  const handleDeleteBanner = async (id: string) => {
    const prevBanners = banners;
    const nextBanners = prevBanners.filter((b) => b.id !== id);
    // INSTANT: disappears immediately
    setBanners(nextBanners);
    onUpdatePromoBanners?.(nextBanners);
    showNotification('Banner removed');

    try {
      await api.deletePromoBanner(token, id);
    } catch (err: any) {
      setBanners(prevBanners);
      onUpdatePromoBanners?.(prevBanners);
      showNotification('Failed to remove banner: ' + err.message);
    }
  };

  return (
    <div
      id="admin-management-portal"
      data-admin-portal="true"
      className="fixed inset-0 z-50 overflow-y-auto no-scrollbar admin-portal-scroll bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col overscroll-contain"
    >
      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shrink-0">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-serif font-bold text-stone-900 dark:text-stone-100 truncate">
                Restaurant Management Portal
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                Live
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
              {cafeInfo?.name || 'Out of the Town - Restro and Bakery'}
            </p>
          </div>
        </div>

        {/* overflow-x-auto is a safety net: with the title block, sound toggle, refresh, and
            the Storefront/Logout buttons all unconditionally visible and none of them able to
            shrink, this row measured wider than a ~390px phone screen with nowhere to scroll --
            Storefront and Logout were completely unreachable, not just visually cramped. */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar shrink-0">
          {/* Sound Mute/Unmute toggle */}
          <button
            type="button"
            onClick={() => {
              setIsSoundMuted(!isSoundMuted);
              showNotification(isSoundMuted ? 'Order Bell Sound Unmuted' : 'Order Bell Sound Muted');
            }}
            title={isSoundMuted ? 'Unmute Order Bell Sound' : 'Mute Order Bell Sound'}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
              isSoundMuted
                ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
            }`}
          >
            {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Cloud Auto-Sync badge - Visible only if database.view permission. Its color
              and label reflect the REAL MySQL connection state, checked every minute —
              never claims active sync when nothing is actually connected. */}
          {hasPerm('database.view') && (
            <button
              onClick={() => setActiveTab('database')}
              title={
                mysqlConnected
                  ? `Automatic Cloud Sync: Continuously syncs data with MySQL every 10 minutes. Click to inspect MySQL status. Last synced: ${lastSyncTime.toLocaleTimeString()}`
                  : 'MySQL is not connected — data is stored locally only and will not survive a server restart. Click to configure MySQL.'
              }
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                mysqlConnected
                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-100'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
              }`}
            >
              <Database className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-500' : mysqlConnected ? 'text-sky-500' : 'text-amber-500'}`} />
              <span>{mysqlConnected === null ? 'Checking MySQL...' : mysqlConnected ? 'MySQL Auto-Sync (10m)' : 'MySQL Not Connected'}</span>
            </button>
          )}

          {/* Logged in User & Role Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-semibold text-stone-700 dark:text-stone-300 truncate max-w-[130px]">
              {currentUser?.name || (userRole === 'owner' ? 'Owner (Satyam)' : 'Staff Member')}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25 shrink-0">
              {userRole.replace('_', ' ')}
            </span>
          </div>

          <button
            onClick={loadAllData}
            title="Refresh database records"
            className="p-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 rounded-xl border border-stone-200 dark:border-stone-700 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Storefront</span>
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold shadow-2xl flex items-center gap-2 border border-stone-700 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Navigation Tabs Bar with slide function on mobile */}
      <div className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-2 sm:px-8">
        <SlideableOptionBar
          activeId={activeTab}
          className="py-1"
          innerClassName="gap-1 sm:gap-2.5 py-1.5"
          scrollAmount={240}
        >
          {canAccessTab('orders') && (
            <button
              data-tab-id="orders"
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                activeTab === 'orders'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Orders & Staff Acceptance</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 text-white font-mono">
                {orders.length}
              </span>
              {orders.some((o) => o.status === 'pending') && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          )}

          {canAccessTab('reservations') && (
            <button
              data-tab-id="reservations"
              onClick={() => setActiveTab('reservations')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                activeTab === 'reservations'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Reservations</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 text-white font-mono">
                {reservations.length}
              </span>
            </button>
          )}

          {canAccessTab('cakes') && (
            <button
              id="admin-tab-cakes-btn"
              data-tab-id="cakes"
              onClick={() => setActiveTab('cakes')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                activeTab === 'cakes'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Cake className="w-4 h-4" />
              <span>Custom Cakes &amp; Bakery</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 text-white font-mono">
                {orders.filter(
                  (o) =>
                    o.isCustomCake ||
                    !!o.customCakeDetails ||
                    o.items?.some(
                      (i) =>
                        i.menuItemId === 'custom-cake-preorder' ||
                        i.name?.toLowerCase().includes('custom cake') ||
                        i.name?.toLowerCase().includes('made-to-order cake')
                    )
                ).length}
              </span>
              {orders.some(
                (o) =>
                  (o.isCustomCake ||
                    !!o.customCakeDetails ||
                    o.items?.some((i) => i.menuItemId === 'custom-cake-preorder')) &&
                  o.status === 'pending'
              ) && (
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              )}
            </button>
          )}

          {canAccessTab('menu') && (
            <button
              data-tab-id="menu"
              onClick={() => setActiveTab('menu')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                activeTab === 'menu'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Menu Dishes</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 text-white font-mono">
                {menuItems.length}
              </span>
            </button>
          )}

          {canAccessTab('categories') && (
            <button
              data-tab-id="categories"
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                activeTab === 'categories'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Food Categories</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 text-white font-mono">
                {categories.filter((c) => c.slug !== 'all').length}
              </span>
            </button>
          )}

          {canAccessTab('banners') && (
            <button
              data-tab-id="banners"
              onClick={() => setActiveTab('banners')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                activeTab === 'banners'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Promotional Banners</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 text-white font-mono">
                {banners.length}
              </span>
            </button>
          )}

          {canAccessTab('revenue') && (
            <button
              data-tab-id="revenue"
              onClick={() => setActiveTab('revenue')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                activeTab === 'revenue'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Revenue Analysis</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 text-white font-mono">
                Live
              </span>
            </button>
          )}

          {canAccessTab('database') && (
            <button
              data-tab-id="database"
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                activeTab === 'database'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>MySQL Database</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-200 font-mono">
                InnoDB
              </span>
            </button>
          )}

          {canAccessTab('team_access') && (
            <button
              id="admin-tab-team-access-btn"
              data-tab-id="team_access"
              onClick={() => setActiveTab('team_access')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                activeTab === 'team_access'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Staff &amp; Permissions</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-200 font-mono">
                RBAC
              </span>
            </button>
          )}
        </SlideableOptionBar>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* ============================================================== */}
        {/* TAB 1: ONLINE FOOD ORDERS & STAFF ACCEPTANCE */}
        {/* ============================================================== */}
        {activeTab === 'orders' && canAccessTab('orders') && (
          <OrdersManagement
            orders={orders}
            token={token}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onDeleteOrder={handleDeleteOrder}
            onCancelOrder={handleCancelOrder}
            onPurgeAllOrders={handlePurgeAllOrders}
            onRefresh={loadAllData}
            isLoading={isLoading}
            cafeInfo={cafeInfo}
            currentUser={currentUser}
            onOpenRevenueAnalysis={() => setActiveTab('revenue')}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 2: TABLE RESERVATIONS */}
        {/* ============================================================== */}
        {activeTab === 'reservations' && canAccessTab('reservations') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  Table Reservations
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Review booking requests, assign tables, approve or cancel.
                </p>
              </div>
            </div>

            {reservations.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
                <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-400 flex items-center justify-center mx-auto">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">No Reservations Found</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  No table bookings have been recorded yet. When customers reserve a table, they will appear here.
                </p>
              </div>
            ) : (
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-stone-850 text-stone-500 dark:text-stone-400 uppercase tracking-wider font-semibold border-b border-stone-200 dark:border-stone-800">
                    <tr>
                      <th className="p-4">Ref ID</th>
                      <th className="p-4">Guest</th>
                      <th className="p-4">Date & Time</th>
                      <th className="p-4">Party Size</th>
                      <th className="p-4">Seating</th>
                      <th className="p-4">Special Requests</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-stone-700 dark:text-stone-300">
                    {reservations.map((r) => (
                      <tr key={r.id} className="hover:bg-stone-50 dark:hover:bg-stone-850/50">
                        <td className="p-4 font-mono font-bold text-stone-900 dark:text-stone-100">
                          {r.id}
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-stone-900 dark:text-stone-100">{r.customerName}</p>
                          <p className="text-[11px] text-stone-400">{r.customerPhone}</p>
                          <p className="text-[11px] text-stone-400">{r.customerEmail}</p>
                        </td>
                        <td className="p-4 font-medium">
                          {r.date} <br />
                          <span className="text-stone-500">{r.time}</span>
                        </td>
                        <td className="p-4 font-bold">{r.guestCount} Guests</td>
                        <td className="p-4 capitalize">{r.seatingArea.replace('_', ' ')}</td>
                        <td className="p-4 max-w-xs truncate text-stone-500">
                          {r.specialRequests || 'None'}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              r.status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : r.status === 'pending'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-1">
                          {r.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateReservationStatus(r.id, 'confirmed')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {r.status !== 'cancelled' && (
                            <button
                              onClick={() => handleUpdateReservationStatus(r.id, 'cancelled')}
                              className="px-2.5 py-1 bg-stone-200 dark:bg-stone-800 hover:bg-rose-100 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2.5: CUSTOM CAKE & CELEBRATION BAKERY MANAGEMENT */}
        {/* ============================================================== */}
        {activeTab === 'cakes' && canAccessTab('cakes') && (
          <CustomCakesManagement
            orders={orders}
            token={token}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onDeleteOrder={handleDeleteOrder}
            onCancelOrder={handleCancelOrder}
            onRefresh={loadAllData}
            isLoading={isLoading}
            cafeInfo={cafeInfo}
            onNewOrderCreated={(newOrd) => {
              setOrders((prev) => [newOrd, ...prev]);
              showNotification(`New custom cake order #${newOrd.id} logged!`);
            }}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 3: MENU DISHES MANAGEMENT */}
        {/* ============================================================== */}
        {activeTab === 'menu' && canAccessTab('menu') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  Digital Menu Management
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Add new offerings, adjust prices, edit descriptions, and toggle stock availability.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="admin-manage-categories-btn"
                  onClick={() => setActiveTab('categories')}
                  className="px-3.5 py-2.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Edit existing food categories or create new categories"
                >
                  <FolderEdit className="w-4 h-4 text-amber-600" />
                  <span>Edit Categories ({categories.filter((c) => c.slug !== 'all').length})</span>
                </button>

                <button
                  id="admin-bulk-discount-toggle-btn"
                  onClick={() => {
                    setIsBulkDiscountMode((prev) => !prev);
                    setDiscountSelectedIds(new Set());
                  }}
                  className={`px-3.5 py-2.5 text-xs font-bold rounded-xl border shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                    isBulkDiscountMode
                      ? 'bg-candy-cherry-600 hover:bg-candy-cherry-700 text-white border-candy-cherry-600'
                      : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border-stone-300 dark:border-stone-700'
                  }`}
                  title="Select multiple dishes and apply one discount percentage to all of them"
                >
                  <Tag className="w-4 h-4" />
                  <span>{isBulkDiscountMode ? 'Cancel Bulk Discount' : 'Bulk Discount'}</span>
                </button>

                <button
                  id="admin-add-food-item-btn"
                  onClick={() => {
                    setEditingItem(null);
                    setIsCustomCategoryMode(false);
                    setMenuForm({
                      name: '',
                      category: categories.find((c) => c.slug !== 'all')?.slug || 'thali',
                      description: '',
                      price: 180,
                      originalPrice: 220,
                      isVeg: true,
                      isBestseller: false,
                      image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
                      preparationTimeMinutes: 15,
                    });
                    setIsAddMenuOpen(true);
                  }}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Food Item</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills Bar with Mobile Slide */}
            <div className="bg-stone-50 dark:bg-stone-900/60 p-2 rounded-2xl border border-stone-200 dark:border-stone-800">
              <SlideableOptionBar
                activeId={selectedMenuCategory}
                innerClassName="gap-1.5 py-0.5"
                scrollAmount={180}
              >
                <button
                  type="button"
                  data-tab-id="all"
                  onClick={() => setSelectedMenuCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                    selectedMenuCategory === 'all'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700'
                  }`}
                >
                  <span>All Dishes</span>
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-[10px]">
                    {menuItems.length}
                  </span>
                </button>

                {categories
                  .filter((c) => c.slug !== 'all')
                  .map((cat) => {
                    const count = menuItems.filter(
                      (m) =>
                        m.category === cat.slug ||
                        m.category?.toLowerCase() === cat.name.toLowerCase()
                    ).length;
                    return (
                      <button
                        key={cat.id || cat.slug}
                        type="button"
                        data-tab-id={cat.slug}
                        onClick={() => setSelectedMenuCategory(cat.slug)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all flex items-center gap-1.5 ${
                          selectedMenuCategory === cat.slug
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        <span>{cat.name}</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-[10px]">
                          {count}
                        </span>
                      </button>
                    );
                  })}
              </SlideableOptionBar>
            </div>

            {/* Bulk Discount Selection Toolbar - sticky so it stays reachable while scrolling the grid */}
            {isBulkDiscountMode && (
              <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 p-3.5 rounded-2xl bg-candy-cherry-50 dark:bg-candy-cherry-950/30 border border-candy-cherry-300 dark:border-candy-cherry-800 shadow-md">
                <span className="text-xs font-bold text-candy-cherry-700 dark:text-candy-cherry-300">
                  {discountSelectedIds.size} dish{discountSelectedIds.size === 1 ? '' : 'es'} selected
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={bulkDiscountPercent}
                    onChange={(e) => setBulkDiscountPercent(Math.min(90, Math.max(1, Number(e.target.value) || 0)))}
                    className="w-16 px-2 py-1.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs font-bold text-center"
                  />
                  <span className="text-xs font-bold text-stone-600 dark:text-stone-400">% off</span>
                </div>
                <button
                  onClick={handleApplyBulkDiscount}
                  disabled={discountSelectedIds.size === 0 || isApplyingBulkDiscount}
                  className="px-3.5 py-1.5 bg-candy-cherry-600 hover:bg-candy-cherry-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {isApplyingBulkDiscount ? 'Applying…' : `Apply to ${discountSelectedIds.size}`}
                </button>
                <button
                  onClick={() => setDiscountSelectedIds(new Set())}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 cursor-pointer"
                >
                  Clear selection
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems
                .filter(
                  (item) =>
                    selectedMenuCategory === 'all' ||
                    item.category === selectedMenuCategory ||
                    item.category?.toLowerCase() ===
                      categories
                        .find((c) => c.slug === selectedMenuCategory)
                        ?.name.toLowerCase()
                )
                .map((item) => (
                <div
                  key={item.id}
                  onClick={() => isBulkDiscountMode && toggleDiscountSelection(item.id)}
                  className={`relative rounded-2xl bg-white dark:bg-stone-900 border p-4 shadow-xs flex gap-3 ${
                    isBulkDiscountMode
                      ? `cursor-pointer ${discountSelectedIds.has(item.id) ? 'border-candy-cherry-500 ring-2 ring-candy-cherry-500/30' : 'border-stone-200 dark:border-stone-800 hover:border-candy-cherry-300'}`
                      : 'border-stone-200 dark:border-stone-800'
                  }`}
                >
                  {isBulkDiscountMode && (
                    <div
                      className={`absolute top-2.5 left-2.5 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                        discountSelectedIds.has(item.id)
                          ? 'bg-candy-cherry-600 border-candy-cherry-600'
                          : 'bg-white/90 dark:bg-stone-900/90 border-stone-300 dark:border-stone-600'
                      }`}
                    >
                      {discountSelectedIds.has(item.id) && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  )}
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-stone-100 dark:bg-stone-800">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className={`flex-1 min-w-0 flex flex-col justify-between ${isBulkDiscountMode ? 'pointer-events-none' : ''}`}>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {item.name}
                        </h4>
                        {item.isBestseller && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[9px] flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            <span>BESTSELLER</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                        ₹{item.price}{' '}
                        {item.originalPrice && (
                          <span className="line-through text-stone-400">
                            ₹{item.originalPrice}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-stone-400 uppercase font-semibold">
                        Category: {item.category}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleAvailability(item)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer ${
                            item.isAvailable
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                          }`}
                        >
                          {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleBestseller(item)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors flex items-center gap-1 ${
                            item.isBestseller
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : 'bg-stone-100 text-stone-500 hover:text-amber-700 dark:bg-stone-800 dark:text-stone-400'
                          }`}
                          title={item.isBestseller ? 'Remove Bestseller tag' : 'Add Bestseller tag'}
                        >
                          <Sparkles className={`w-3 h-3 ${item.isBestseller ? 'fill-amber-500 text-amber-500' : ''}`} />
                          <span>{item.isBestseller ? 'Bestseller' : '+ Bestseller'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setMenuForm({
                              name: item.name,
                              category: item.category,
                              description: item.description,
                              price: item.price,
                              originalPrice: item.originalPrice || item.price,
                              isVeg: item.isVeg,
                              isBestseller: !!item.isBestseller,
                              image: item.image,
                              preparationTimeMinutes: item.preparationTimeMinutes || 10,
                            });
                            setIsAddMenuOpen(true);
                          }}
                          className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMenuItem(item.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB: FOOD CATEGORIES MANAGEMENT */}
        {/* ============================================================== */}
        {activeTab === 'categories' && canAccessTab('categories') && (
          <CategoryManagementView
            categories={categories}
            menuItems={menuItems}
            token={token}
            onUpdateCategories={onUpdateCategories}
            onUpdateMenuItems={onUpdateMenuItems}
            onMenuUpdated={onMenuUpdated}
            showNotification={showNotification}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 4: FLIPKART PROMOTIONAL BANNERS */}
        {/* ============================================================== */}
        {activeTab === 'banners' && canAccessTab('banners') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  Promotional Banners
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Customize the rotating hero banner slider and promotional discounts.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingBanner(null);
                  setBannerForm({
                    title: '',
                    subtitle: '',
                    highlightBadge: 'SPECIAL OFFER',
                    discountText: '20% OFF',
                    code: 'SAVE20',
                    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80',
                    badgeBgColor: 'bg-amber-600',
                    targetCategory: 'all',
                  });
                  setIsAddBannerOpen(true);
                }}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Promo Slide</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs flex flex-col justify-between"
                >
                  <div className="relative h-36 bg-stone-800">
                    <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 p-4 flex flex-col justify-between text-white">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.badgeBgColor}`}>
                          {b.highlightBadge}
                        </span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-400 text-stone-950">
                          {b.code}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white line-clamp-1">{b.title}</h4>
                        <p className="text-xs text-stone-300 line-clamp-1">{b.subtitle}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {b.discountText}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setEditingBanner(b);
                          setBannerForm({
                            title: b.title,
                            subtitle: b.subtitle,
                            highlightBadge: b.highlightBadge,
                            discountText: b.discountText,
                            code: b.code,
                            imageUrl: b.imageUrl,
                            badgeBgColor: b.badgeBgColor,
                            targetCategory: b.targetCategory || 'all',
                          });
                          setIsAddBannerOpen(true);
                        }}
                        className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteBanner(b.id)}
                        className="text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: REVENUE & SALES COMPREHENSIVE ANALYSIS */}
        {/* ============================================================== */}
        {activeTab === 'revenue' && canAccessTab('revenue') && (
          <RevenueAnalysis
            orders={orders}
            onBack={() => setActiveTab('orders')}
            token={token}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 6: MYSQL RELATIONAL DATABASE MANAGEMENT */}
        {/* ============================================================== */}
        {activeTab === 'database' && canAccessTab('database') && (
          <MySQLManagement
            token={token}
            onRefreshAll={loadAllData}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 7: STAFF & ADMIN ACCESS CONTROL (OWNER & DELEGATES) */}
        {/* ============================================================== */}
        {activeTab === 'team_access' && canAccessTab('team_access') && (
          <AdminAccessManagement
            token={token}
            currentUser={currentUser}
            onNotification={showNotification}
          />
        )}

        {/* Fallback when activeTab is not permitted for current role */}
        {!canAccessTab(activeTab) && (
          <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 my-8 max-w-md mx-auto shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Access Restricted</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Your staff account does not have permission to access this section. Please contact the owner ({'kumarsatyam5868@gmail.com'}) if you need access.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT MENU ITEM */}
      {isAddMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-serif">
                {editingItem ? 'Edit Dish' : 'Add New Dish to Menu'}
              </h3>
              <button
                onClick={() => setIsAddMenuOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMenuItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold">Category *</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCustomCategoryMode(!isCustomCategoryMode)}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
                    >
                      {isCustomCategoryMode ? '← Choose from list' : '✏️ Custom / Edit Category'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsManageCategoriesOpen(true)}
                      className="text-[11px] font-bold text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 underline cursor-pointer"
                    >
                      Manage All Categories
                    </button>
                  </div>
                </div>

                {isCustomCategoryMode ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      required
                      placeholder="Enter category name or slug (e.g. Continental, Desserts, Chinese)"
                      value={menuForm.category}
                      onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-400 dark:border-amber-600 text-stone-900 dark:text-stone-100 font-semibold"
                    />
                    <div className="flex flex-wrap gap-1">
                      {categories
                        .filter((c) => c.slug !== 'all')
                        .map((c) => (
                          <button
                            key={c.id || c.slug}
                            type="button"
                            onClick={() => setMenuForm({ ...menuForm, category: c.slug || c.name.toLowerCase() })}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                              menuForm.category === (c.slug || c.name.toLowerCase())
                                ? 'bg-amber-600 text-white'
                                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                            }`}
                          >
                            {c.name}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : (
                  <select
                    value={menuForm.category}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomCategoryMode(true);
                      } else {
                        setMenuForm({ ...menuForm, category: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                  >
                    {categories
                      .filter((c) => c.slug !== 'all')
                      .map((c) => (
                        <option key={c.id || c.slug} value={c.slug || c.name.toLowerCase()}>
                          {c.name}
                        </option>
                      ))}
                    <option value="__custom__">✏️ + Custom / Enter New Category...</option>
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Original Price (₹)</label>
                  <input
                    type="number"
                    step="1"
                    value={menuForm.originalPrice || ''}
                    onChange={(e) => setMenuForm({ ...menuForm, originalPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="Optional for discount"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Culinary Description *</label>
                <textarea
                  rows={2}
                  required
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 resize-none"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Dish Image *</label>
                <div className="flex items-center gap-3">
                  {menuForm.image && (
                    <img
                      src={menuForm.image}
                      alt="Dish preview"
                      className="w-14 h-14 rounded-xl object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                    />
                  )}
                  <div className="flex-1 space-y-2 min-w-0">
                    <input
                      type="url"
                      required
                      placeholder="Paste an image URL…"
                      value={menuForm.image}
                      onChange={(e) => setMenuForm({ ...menuForm, image: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                    />
                    <button
                      type="button"
                      onClick={() => menuImageInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-[11px] cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload from Device
                    </button>
                  </div>
                </div>
                <input
                  ref={menuImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageFileSelect(e, (dataUrl) => setMenuForm((prev) => ({ ...prev, image: dataUrl })))}
                />
              </div>

              {/* Bestseller & Highlight Tags Section */}
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-bold text-stone-900 dark:text-stone-100 text-xs">
                        Bestseller Dish Tag
                      </p>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400">
                        Shows ⭐ Bestseller badge and boosts visibility on customer storefront
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={menuForm.isBestseller}
                      onChange={(e) => setMenuForm({ ...menuForm, isBestseller: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-200 peer-focus:outline-hidden rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-stone-600 peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {menuForm.isBestseller && (
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] uppercase tracking-wider font-extrabold shadow-2xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3 fill-white text-white" />
                      <span>⭐ BESTSELLER PREVIEW</span>
                    </span>
                    <span>Featured with golden badge in menu and filters!</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={menuForm.isVeg}
                    onChange={(e) => setMenuForm({ ...menuForm, isVeg: e.target.checked })}
                    className="rounded-sm text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Pure Vegetarian</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl mt-3 cursor-pointer"
              >
                {editingItem ? 'Save Updates' : 'Add Dish'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD PROMO BANNER */}
      {isAddBannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-serif">
                {editingBanner ? 'Edit Promotional Banner' : 'Add Promotional Banner'}
              </h3>
              <button
                onClick={() => {
                  setIsAddBannerOpen(false);
                  setEditingBanner(null);
                }}
                className="p-1 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">Headline Campaign *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sourdough Brunch Combo Fest"
                  value={bannerForm.title}
                  onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Subtitle / Deal Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Buy any 2 toasts and get a complimentary cold brew"
                  value={bannerForm.subtitle}
                  onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Coupon Code *</label>
                  <input
                    type="text"
                    required
                    value={bannerForm.code}
                    onChange={(e) => setBannerForm({ ...bannerForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Discount Tag *</label>
                  <input
                    type="text"
                    required
                    value={bannerForm.discountText}
                    onChange={(e) => setBannerForm({ ...bannerForm, discountText: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Banner Image *</label>
                <div className="flex items-center gap-3">
                  {bannerForm.imageUrl && (
                    <img
                      src={bannerForm.imageUrl}
                      alt="Banner preview"
                      className="w-16 h-14 rounded-xl object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                    />
                  )}
                  <div className="flex-1 space-y-2 min-w-0">
                    <input
                      type="url"
                      required
                      placeholder="Paste an image URL…"
                      value={bannerForm.imageUrl}
                      onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                    />
                    <button
                      type="button"
                      onClick={() => bannerImageInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-[11px] cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload from Device
                    </button>
                  </div>
                </div>
                <input
                  ref={bannerImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageFileSelect(e, (dataUrl) => setBannerForm((prev) => ({ ...prev, imageUrl: dataUrl })))}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl mt-3 cursor-pointer"
              >
                {editingBanner ? 'Save Changes' : 'Create Banner'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE & EDIT FOOD CATEGORIES */}
      {isManageCategoriesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-serif flex items-center gap-2">
                  <FolderEdit className="w-5 h-5 text-amber-600" />
                  <span>Food Categories Management</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Edit or rename existing categories, adjust slugs, or add new food categories.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsManageCategoriesOpen(false);
                  setEditingCategory(null);
                }}
                className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add New Category Bar */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 mb-4">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1.5">
                Add New Food Category
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. South Indian, Mocktails, Desserts"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 text-stone-900 dark:text-stone-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!newCatName.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Category</span>
                </button>
              </div>
            </div>

            {/* Categories List */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 pr-1 text-xs">
              {categories
                .filter((c) => c.slug !== 'all')
                .map((cat) => {
                  const dishCount = menuItems.filter(
                    (m) => m.category === cat.slug || m.category.toLowerCase() === cat.name.toLowerCase()
                  ).length;
                  const isEditingThis = editingCategory?.id === cat.id;

                  return (
                    <div
                      key={cat.id || cat.slug}
                      className="p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850/60 flex flex-col gap-2"
                    >
                      {isEditingThis ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-0.5">
                                Category Name
                              </label>
                              <input
                                type="text"
                                value={categoryFormName}
                                onChange={(e) => setCategoryFormName(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-semibold text-stone-900 dark:text-stone-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-0.5">
                                Slug identifier
                              </label>
                              <input
                                type="text"
                                value={categoryFormSlug}
                                onChange={(e) => setCategoryFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'))}
                                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-mono text-stone-700 dark:text-stone-300"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingCategory(null)}
                              className="px-3 py-1 text-xs font-bold text-stone-600 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateCategory(cat.id, categoryFormName, categoryFormSlug)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save Changes</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm shrink-0">
                              {cat.name.charAt(0)}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm truncate">
                                {cat.name}
                              </h4>
                              <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                                <span className="font-mono bg-stone-200/60 dark:bg-stone-800 px-1.5 py-0.5 rounded-md">
                                  {cat.slug}
                                </span>
                                <span>•</span>
                                <span>{dishCount} {dishCount === 1 ? 'dish' : 'dishes'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategory(cat);
                                setCategoryFormName(cat.name);
                                setCategoryFormSlug(cat.slug);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Remove category "${cat.name}"?`)) {
                                  handleDeleteCategory(cat.id);
                                }
                              }}
                              className="p-1.5 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                              title="Delete Category"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsManageCategoriesOpen(false);
                  setEditingCategory(null);
                }}
                className="px-5 py-2 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-bold text-xs cursor-pointer hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automatically Generated Kitchen Order Ticket (KOT) on incoming order */}
      {autoKotOrder && (
        <KitchenOrderTicket
          order={autoKotOrder}
          cafeInfo={cafeInfo}
          isAutoGenerated={true}
          onClose={() => setAutoKotOrder(null)}
        />
      )}
    </div>
  );
};
