import type {
  MenuItem,
  Category,
  Order,
  Reservation,
  PromoBanner,
  CafeInfo,
  Customer,
  DeliveryPartner,
  DeliveryTrackingStage,
  DeliveryNotification,
  AdminAccessUser,
  AuditLog,
} from '../types';

// Defaults to a same-origin relative path (local dev, Vercel single-domain deploys).
// Set VITE_API_BASE_URL at build time when the backend is hosted on a separate
// domain/subdomain (e.g. https://api.ottcafe.in/api).
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  token?: string;
  retryAfterSeconds?: number;
}

function getCustomerAuthHeaders(token?: string, extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extraHeaders || {}) };
  let resolvedToken = token;

  if (typeof window !== 'undefined') {
    try {
      // Only the session token is sent -- the server identifies the customer from it. The
      // old phone/email/id/name headers were never read server-side, leaked personal data on
      // every request, and (not being CORS-allowed) got every signed-in request blocked once
      // the API moved to its own api.ottcafe.in origin.
      if (!resolvedToken) {
        resolvedToken = localStorage.getItem('ott_customer_token') || undefined;
      }
    } catch {
      // ignore
    }
  }

  if (resolvedToken) {
    headers['Authorization'] = `Bearer ${resolvedToken}`;
    headers['x-customer-token'] = resolvedToken;
  }

  return headers;
}

export const api = {
  // Customer Auth (Email + Mobile OTP)
  async sendCustomerOtp(payload: { email: string; phone: string; name?: string }): Promise<{
    message: string;
    phone: string;
    otpPreview?: string;
  }> {
    const res = await fetch(`${BASE_URL}/auth/customer/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to send verification code');
    return { message: json.message, phone: json.phone, otpPreview: json.otpPreview };
  },

  async verifyCustomerOtp(payload: {
    email: string;
    phone: string;
    otp: string;
    name?: string;
  }): Promise<{ customer: Customer; token: string }> {
    const res = await fetch(`${BASE_URL}/auth/customer/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success || !json.customer || !json.token) {
      throw new Error(json.error || 'Failed to verify code');
    }
    return { customer: json.customer, token: json.token };
  },

  async getCustomerProfile(token?: string): Promise<Customer> {
    const res = await fetch(`${BASE_URL}/user/profile`, {
      headers: getCustomerAuthHeaders(token),
    });
    const json: ApiResponse<Customer> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch customer profile');
    return json.data;
  },

  async getMyOrders(token?: string): Promise<Order[]> {
    const res = await fetch(`${BASE_URL}/user/orders`, {
      headers: getCustomerAuthHeaders(token),
    });
    const json: ApiResponse<Order[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch your orders');
    return json.data;
  },

  async getMyReservations(token?: string): Promise<Reservation[]> {
    const res = await fetch(`${BASE_URL}/user/reservations`, {
      headers: getCustomerAuthHeaders(token),
    });
    const json: ApiResponse<Reservation[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch your reservations');
    return json.data;
  },

  // Public
  async getCafeInfo(): Promise<CafeInfo> {
    const res = await fetch(`${BASE_URL}/cafe-info`);
    const json: ApiResponse<CafeInfo> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch cafe info');
    return json.data;
  },

  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${BASE_URL}/categories`);
    const json: ApiResponse<Category[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch categories');
    return json.data;
  },

  async getPromoBanners(): Promise<PromoBanner[]> {
    const res = await fetch(`${BASE_URL}/banners`);
    const json: ApiResponse<PromoBanner[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch banners');
    return json.data;
  },

  async getMenuItems(params?: { category?: string; isVeg?: boolean; search?: string }): Promise<MenuItem[]> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'all') query.append('category', params.category);
    if (params?.isVeg !== undefined) query.append('isVeg', String(params.isVeg));
    if (params?.search) query.append('search', params.search);

    const url = `${BASE_URL}/menu${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url);
    const json: ApiResponse<MenuItem[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch menu items');
    return json.data;
  },

  async createOrder(payload: any, token?: string): Promise<Order> {
    const headers = getCustomerAuthHeaders(token, { 'Content-Type': 'application/json' });
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<Order> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to place order');
    return json.data;
  },

  async reverseGeocodeLocation(lat: number, lng: number): Promise<{
    formattedAddress: string;
    street?: string;
    sublocality?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    source: 'google' | 'osm' | 'coords';
    location?: { lat: number; lng: number };
  }> {
    const res = await fetch(
      `${BASE_URL}/maps/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    );
    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.error || 'Failed to resolve location address');
    }
    return json.data;
  },

  async getOrder(id: string, token?: string, guestPhone?: string): Promise<Order> {
    const headers = getCustomerAuthHeaders(token);
    const query = !token && guestPhone ? `?phone=${encodeURIComponent(guestPhone)}` : '';
    const res = await fetch(`${BASE_URL}/orders/${id}${query}`, { headers });
    const json: ApiResponse<Order> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Order not found');
    return json.data;
  },

  async cancelOrder(id: string, reason?: string, token?: string, guestPhone?: string): Promise<Order> {
    const headers = getCustomerAuthHeaders(token, { 'Content-Type': 'application/json' });
    const res = await fetch(`${BASE_URL}/orders/${id}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason, phone: !token ? guestPhone : undefined }),
    });
    const json: ApiResponse<Order> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to cancel order');
    return json.data;
  },

  async createReservation(payload: any, token?: string): Promise<Reservation> {
    const headers = getCustomerAuthHeaders(token, { 'Content-Type': 'application/json' });
    const res = await fetch(`${BASE_URL}/reservations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<Reservation> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to make reservation');
    return json.data;
  },

  // Admin Auth
  async adminLogin(password: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const json: ApiResponse<void> = await res.json();
    if (!json.success || !json.token) throw new Error(json.error || 'Admin login failed');
    return json.token;
  },

  // Admin Actions
  async getAdminOrders(token: string): Promise<Order[]> {
    const res = await fetch(`${BASE_URL}/admin/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<Order[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to load admin orders');
    return json.data;
  },

  async updateOrderStatus(
    token: string,
    orderId: string,
    status: string,
    options?: {
      notes?: string;
      acceptedBy?: string;
      acceptedAt?: string;
      estimatedTimeMinutes?: number;
    } | string
  ): Promise<Order> {
    const payload: Record<string, any> = { status };
    if (typeof options === 'string') {
      payload.statusNotes = options;
    } else if (options) {
      if (options.notes !== undefined) payload.statusNotes = options.notes;
      if (options.acceptedBy !== undefined) payload.acceptedBy = options.acceptedBy;
      if (options.acceptedAt !== undefined) payload.acceptedAt = options.acceptedAt;
      if (options.estimatedTimeMinutes !== undefined) payload.estimatedTimeMinutes = options.estimatedTimeMinutes;
    }

    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<Order> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update order');
    return json.data;
  },

  async assignDeliveryPartner(
    token: string,
    orderId: string,
    payload: {
      partner: DeliveryPartner;
      estimatedMinutes?: number;
      notes?: string;
      initialStage?: DeliveryTrackingStage;
    }
  ): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/assign-delivery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<Order> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to assign delivery partner');
    return json.data;
  },

  async updateDeliveryStage(
    token: string,
    orderId: string,
    payload: {
      stage: DeliveryTrackingStage;
      notes?: string;
      progressPercent?: number;
      currentLocationLabel?: string;
    }
  ): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/delivery-stage`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<Order> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update delivery stage');
    return json.data;
  },

  // Real delivery fleet roster — backed by the same staff accounts used for rider login,
  // not a local mock list.
  async getDeliveryPartners(token: string): Promise<DeliveryPartner[]> {
    const res = await fetch(`${BASE_URL}/admin/delivery-partners`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<DeliveryPartner[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to load delivery fleet');
    return json.data;
  },

  async addDeliveryPartner(
    token: string,
    payload: { name: string; phone: string; vehicleType: string; vehicleNumber: string; notes?: string; photoUrl?: string }
  ): Promise<DeliveryPartner> {
    const res = await fetch(`${BASE_URL}/admin/delivery-partners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<DeliveryPartner> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to add delivery partner');
    return json.data;
  },

  async updateDeliveryPartner(
    token: string,
    id: string,
    payload: Partial<{ name: string; phone: string; vehicleType: string; vehicleNumber: string; notes: string; photoUrl: string; isOnDuty: boolean }>
  ): Promise<DeliveryPartner> {
    const res = await fetch(`${BASE_URL}/admin/delivery-partners/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<DeliveryPartner> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update delivery partner');
    return json.data;
  },

  async toggleDeliveryPartnerDuty(token: string, id: string, isOnDuty: boolean): Promise<DeliveryPartner> {
    const res = await fetch(`${BASE_URL}/admin/delivery-partners/${id}/duty`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isOnDuty }),
    });
    const json: ApiResponse<DeliveryPartner> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update duty status');
    return json.data;
  },

  async removeDeliveryPartner(token: string, id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/admin/delivery-partners/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<any> = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to remove delivery partner');
  },

  async getAdminReservations(token: string): Promise<Reservation[]> {
    const res = await fetch(`${BASE_URL}/admin/reservations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<Reservation[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to load reservations');
    return json.data;
  },

  async updateReservationStatus(token: string, reservationId: string, status: string): Promise<Reservation> {
    const res = await fetch(`${BASE_URL}/admin/reservations/${reservationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    const json: ApiResponse<Reservation> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update reservation');
    return json.data;
  },

  async addMenuItem(token: string, item: Partial<MenuItem>): Promise<MenuItem> {
    const res = await fetch(`${BASE_URL}/admin/menu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(item),
    });
    const json: ApiResponse<MenuItem> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to add menu item');
    return json.data;
  },

  async updateMenuItem(token: string, id: string, updates: Partial<MenuItem>): Promise<MenuItem> {
    const res = await fetch(`${BASE_URL}/admin/menu/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    const json: ApiResponse<MenuItem> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update menu item');
    return json.data;
  },

  async deleteMenuItem(token: string, id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/admin/menu/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<void> = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to delete menu item');
  },

  // Category Management (Admin)
  async addCategory(
    token: string,
    cat: { name: string; slug?: string; description?: string; icon?: string; image?: string }
  ): Promise<Category> {
    const res = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cat),
    });
    const json: ApiResponse<Category> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to add category');
    return json.data;
  },

  async updateCategory(
    token: string,
    idOrSlug: string,
    cat: { name?: string; slug?: string; description?: string; icon?: string; image?: string }
  ): Promise<Category> {
    const res = await fetch(`${BASE_URL}/admin/categories/${idOrSlug}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cat),
    });
    const json: ApiResponse<Category> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update category');
    return json.data;
  },

  async deleteCategory(token: string, idOrSlug: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/admin/categories/${idOrSlug}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<void> = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to delete category');
  },

  async addPromoBanner(token: string, banner: Partial<PromoBanner>): Promise<PromoBanner> {
    const res = await fetch(`${BASE_URL}/admin/banners`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(banner),
    });
    const json: ApiResponse<PromoBanner> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to add banner');
    return json.data;
  },

  async updatePromoBanner(token: string, id: string, banner: Partial<PromoBanner>): Promise<PromoBanner> {
    const res = await fetch(`${BASE_URL}/admin/banners/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(banner),
    });
    const json: ApiResponse<PromoBanner> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update banner');
    return json.data;
  },

  async deletePromoBanner(token: string, id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/admin/banners/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<void> = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to delete banner');
  },

  // Order Management: Cancel & Delete & Invoice
  async adminCancelOrder(token: string, orderId: string, reason?: string): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: reason || 'Cancelled by staff / customer request' }),
    });
    const json: ApiResponse<Order> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to cancel order');
    return json.data;
  },

  async deleteOrder(token: string, orderId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<void> = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to delete order history record');
  },

  async purgeFakeOrders(token: string): Promise<{ purgedCount: number }> {
    const res = await fetch(`${BASE_URL}/admin/orders/purge-fake`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<{ purgedCount: number }> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to purge fake orders');
    return json.data;
  },

  async purgeAllOrders(token: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/admin/orders-purge-all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<void> = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to clear all orders');
  },

  async registerInvoice(token: string, orderId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/invoice`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<any> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to register invoice');
    return json.data;
  },

  // MySQL Relational Database Management
  async getMySQLStatus(token: string): Promise<{
    configured: boolean;
    connectionStringSummary: string | null;
    host: string | null;
    database: string | null;
    connected: boolean;
    tablesFound: string[];
    tablesMissing: string[];
    error?: string;
  }> {
    const res = await fetch(`${BASE_URL}/admin/mysql/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<any> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to check MySQL status');
    return json.data;
  },

  async getMySQLSchema(token: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/admin/mysql/schema`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<{ sql: string }> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch MySQL schema');
    return json.data.sql;
  },

  async syncMySQLAll(token: string): Promise<{
    syncedOrders: number;
    syncedReservations: number;
    totalOrders: number;
    totalReservations: number;
    message?: string;
  }> {
    const res = await fetch(`${BASE_URL}/admin/mysql/sync-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<any> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to sync with MySQL');
    return json.data;
  },


  // Delivery Partner Portal Auth (real backend-verified rider login)
  async sendDeliveryOtp(phone: string): Promise<{ message: string; otpPreview?: string }> {
    const res = await fetch(`${BASE_URL}/delivery/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const json: ApiResponse<void> & { message?: string; otpPreview?: string } = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to send verification code');
    return { message: json.message || 'Verification code sent', otpPreview: json.otpPreview };
  },

  async verifyDeliveryOtp(
    phone: string,
    otp: string,
    profile?: { name?: string; vehicleType?: string; vehicleNumber?: string }
  ): Promise<{ token: string; partner: DeliveryPartner }> {
    const res = await fetch(`${BASE_URL}/delivery/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, ...profile }),
    });
    const json: ApiResponse<void> & { token?: string; partner?: DeliveryPartner } = await res.json();
    if (!json.success || !json.token || !json.partner) throw new Error(json.error || 'Verification failed');
    return { token: json.token, partner: json.partner };
  },

  // Delivery Partner Portal Dedicated Methods (require a real rider session token)
  async getDeliveryPartnerOrders(token: string, partnerId?: string): Promise<{
    orders: Order[];
    stats: {
      total: number;
      assigned: number;
      completedToday: number;
      availableToClaim: number;
    };
  }> {
    const query = partnerId ? `?partnerId=${encodeURIComponent(partnerId)}` : '';
    const res = await fetch(`${BASE_URL}/delivery/orders${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<Order[]> & { stats?: any } = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to load delivery orders');
    return {
      orders: json.data,
      stats: json.stats || {
        total: json.data.length,
        assigned: 0,
        completedToday: 0,
        availableToClaim: 0,
      },
    };
  },

  async claimDeliveryOrder(token: string, orderId: string, partner: DeliveryPartner): Promise<Order> {
    const res = await fetch(`${BASE_URL}/delivery/orders/${orderId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ partner }),
    });
    const json: ApiResponse<Order> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to claim delivery order');
    return json.data;
  },

  async updateRiderDeliveryStage(
    token: string,
    orderId: string,
    payload: {
      stage: DeliveryTrackingStage;
      notes?: string;
      currentLocationLabel?: string;
      lat?: number;
      lng?: number;
      speedKmh?: number;
    }
  ): Promise<Order> {
    const res = await fetch(`${BASE_URL}/delivery/orders/${orderId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<Order> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update delivery stage');
    return json.data;
  },

  async pingRiderLocation(
    token: string,
    orderId: string,
    payload: {
      lat: number;
      lng: number;
      speedKmh?: number;
      heading?: number;
      currentLocationLabel?: string;
    }
  ): Promise<{ lat: number; lng: number }> {
    const res = await fetch(`${BASE_URL}/delivery/orders/${orderId}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<{ lat: number; lng: number }> & { partnerLocation?: { lat: number; lng: number } } = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to send location ping');
    return (json.data || json.partnerLocation) as { lat: number; lng: number };
  },

  async getDeliveryNotifications(token: string, partnerId?: string): Promise<{
    notifications: DeliveryNotification[];
    unreadCount: number;
  }> {
    const query = partnerId ? `?partnerId=${encodeURIComponent(partnerId)}` : '';
    const res = await fetch(`${BASE_URL}/delivery/notifications${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<DeliveryNotification[]> & { unreadCount?: number } = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to load notifications');
    return {
      notifications: json.data,
      unreadCount: json.unreadCount || 0,
    };
  },

  async markDeliveryNotificationRead(token: string, id: string): Promise<void> {
    await fetch(`${BASE_URL}/delivery/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async markAllDeliveryNotificationsRead(token: string, partnerId?: string): Promise<void> {
    await fetch(`${BASE_URL}/delivery/notifications/mark-all-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ partnerId }),
    });
  },

  async sendTestDeliveryNotification(token: string, partnerId?: string, partnerName?: string): Promise<DeliveryNotification> {
    const res = await fetch(`${BASE_URL}/delivery/notifications/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ partnerId, partnerName }),
    });
    const json: ApiResponse<DeliveryNotification> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to send test notification');
    return json.data;
  },

  // ==========================================
  // ADMIN ACCESS & TEAM MANAGEMENT METHODS
  // ==========================================

  async checkAdminAccess(tokenOrEmail?: string): Promise<{
    hasAccess: boolean;
    user?: AdminAccessUser;
    adminToken?: string;
  }> {
    try {
      const headers: Record<string, string> = {};
      let url = `${BASE_URL}/admin/check-access`;
      if (tokenOrEmail) {
        if (tokenOrEmail.includes('@')) {
          url += `?email=${encodeURIComponent(tokenOrEmail)}`;
        } else {
          headers['Authorization'] = `Bearer ${tokenOrEmail}`;
        }
      }
      const res = await fetch(url, { headers });
      const json = await res.json();
      return json;
    } catch {
      return { hasAccess: false };
    }
  },

  async getAdminTeam(token: string): Promise<{ data: AdminAccessUser[]; ownerEmail: string }> {
    const res = await fetch(`${BASE_URL}/admin/team`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<AdminAccessUser[]> & { ownerEmail?: string } = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch admin team list');
    return { data: json.data, ownerEmail: json.ownerEmail || 'kumarsatyam5868@gmail.com' };
  },

  async addAdminTeamMember(
    token: string,
    payload: {
      email: string;
      name: string;
      role: string;
      permissions?: string[];
      passcode?: string;
      notes?: string;
    }
  ): Promise<AdminAccessUser> {
    const res = await fetch(`${BASE_URL}/admin/team`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<AdminAccessUser> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to add staff member');
    return json.data;
  },

  async updateAdminTeamMember(
    token: string,
    id: string,
    payload: Partial<AdminAccessUser>
  ): Promise<AdminAccessUser> {
    const res = await fetch(`${BASE_URL}/admin/team/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json: ApiResponse<AdminAccessUser> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update staff member');
    return json.data;
  },

  async resetAdminMemberAccess(
    token: string,
    id: string
  ): Promise<{ passcode: string; user: AdminAccessUser }> {
    const res = await fetch(`${BASE_URL}/admin/team/${id}/reset-access`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to reset staff access');
    return json.data;
  },

  async revokeAdminMemberSessions(
    token: string,
    id: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/admin/team/${id}/revoke-session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to revoke staff sessions');
    return json;
  },

  async toggleAdminTeamMember(token: string, id: string): Promise<AdminAccessUser> {
    const res = await fetch(`${BASE_URL}/admin/team/${id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<AdminAccessUser> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update admin access status');
    return json.data;
  },

  async removeAdminTeamMember(token: string, id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/admin/team/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<any> = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to revoke admin access');
  },

  async getAuditLogs(token: string, limit: number = 100): Promise<AuditLog[]> {
    const res = await fetch(`${BASE_URL}/admin/audit-logs?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json: ApiResponse<AuditLog[]> = await res.json();
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch audit logs');
    return json.data;
  },
};
