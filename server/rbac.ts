import type { AdminAccessUser, AdminRole, Permission, AuditLog, Order } from '../src/types';
import { store, OWNER_EMAIL } from './store';
import { MySQLService } from './mysqlService';
import type { Request } from 'express';

export const RESTAURANT_ID = 'ott-kukas-jaipur';

/**
 * Standard default permissions matrix based on system roles
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<AdminRole, Permission[]> = {
  owner: ['*'],
  manager: [
    'orders.full',
    'orders.view',
    'orders.create',
    'orders.accept',
    'orders.reject',
    'orders.update_status',
    'orders.cancel',
    'orders.assign_delivery',
    'menu.edit',
    'menu.view',
    'menu.create',
    'menu.change_price',
    'menu.change_availability',
    'inventory.manage',
    'inventory.view',
    'inventory.update_stock',
    'finance.limited',
    'finance.view_sales',
    'staff.limited',
    'staff.view',
    'marketing.view',
    'banners.view',
    'delivery.manage',
    'delivery.view',
    'delivery.assign',
    'delivery.update_status',
    'reports.operational',
    'settings.limited',
    'settings.view',
    'reservations.view',
    'reservations.confirm',
    'reservations.cancel',
    'audit.view',
  ],
  staff: [
    'orders.manage',
    'orders.view',
    'orders.create',
    'orders.accept',
    'orders.reject',
    'orders.update_status',
    'orders.cancel',
    'menu.view',
    'inventory.view',
    'delivery.view',
    'reports.limited',
    'reservations.view',
    'reservations.confirm',
  ],
  counter_staff: [
    'orders.manage',
    'orders.view',
    'orders.create',
    'orders.accept',
    'orders.reject',
    'orders.update_status',
    'orders.cancel',
    'menu.view',
    'inventory.view',
    'delivery.view',
    'reports.limited',
    'reservations.view',
    'reservations.confirm',
  ],
  kitchen: [
    'orders.view',
    'orders.view_kitchen',
    'orders.update_status',
    'menu.view',
    'inventory.view',
  ],
  kitchen_staff: [
    'orders.view',
    'orders.view_kitchen',
    'orders.update_status',
    'menu.view',
    'inventory.view',
  ],
  kitchen_lead: [
    'orders.view',
    'orders.view_kitchen',
    'orders.update_status',
    'menu.view',
    'inventory.view',
  ],
  accountant: [
    'orders.view',
    'finance.full',
    'finance.view_sales',
    'finance.view_transactions',
    'finance.view_settlements',
    'finance.export',
    'reports.financial',
    'audit.view',
  ],
  marketing: [
    'menu.content',
    'menu.view',
    'marketing.full',
    'banners.view',
    'banners.manage',
    'reports.marketing',
    'marketing.view_analytics',
  ],
  marketing_staff: [
    'menu.content',
    'menu.view',
    'marketing.full',
    'banners.view',
    'banners.manage',
    'reports.marketing',
    'marketing.view_analytics',
  ],
  delivery: [
    'orders.assigned',
    'delivery.assigned',
    'delivery.view_assigned',
    'delivery.update_status',
    'reports.own',
  ],
  delivery_person: [
    'orders.assigned',
    'delivery.assigned',
    'delivery.view_assigned',
    'delivery.update_status',
    'reports.own',
  ],
};

/**
 * Get full consolidated permissions list for a user
 */
export function getUserPermissions(user: AdminAccessUser): Permission[] {
  if (user.role === 'owner' || user.email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim()) {
    return ['*'];
  }

  const defaultPerms = ROLE_DEFAULT_PERMISSIONS[user.role] || [];
  if (!user.permissions || user.permissions.length === 0) {
    return defaultPerms;
  }

  // Combine defaults and custom permissions, deduplicating
  const set = new Set<Permission>([...defaultPerms, ...user.permissions]);
  return Array.from(set);
}

/**
 * Check if an admin/staff user has a required permission
 */
export function hasPermission(user: AdminAccessUser, requiredPermission: Permission): boolean {
  if (!user.isActive) return false;

  // Root owner always has all permissions
  if (user.role === 'owner' || user.email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim()) {
    return true;
  }

  const perms = getUserPermissions(user);
  if (perms.includes('*')) return true;

  return perms.includes(requiredPermission);
}

/**
 * Check if caller can perform operations on target user
 * Owner can manage anyone; Managers cannot manage Owner; Staff cannot manage anyone.
 */
export function canManageRole(actorRole: AdminRole, targetRole: AdminRole): boolean {
  if (actorRole === 'owner') return true;
  if (actorRole === 'manager') {
    return targetRole !== 'owner' && targetRole !== 'manager';
  }
  return false;
}

/**
 * Restrict a permission grant to what the granting user is actually allowed to hand out.
 *
 * Without this, anyone holding staff.create/staff.edit (which an owner can delegate as a
 * narrow custom permission, e.g. "let this manager add kitchen staff") could create or edit
 * an account with `permissions: ['*']` and grant themselves or an accomplice full owner-level
 * access regardless of the role field — the classic "cannot delegate more than you have"
 * privilege-escalation gap. Only the owner may hand out '*' or any permission they don't
 * themselves hold.
 */
export function sanitizePermissionGrant(
  grantingUser: AdminAccessUser,
  requestedPermissions: unknown
): Permission[] | undefined {
  if (!Array.isArray(requestedPermissions)) return undefined;

  if (grantingUser.role === 'owner' || grantingUser.email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim()) {
    return requestedPermissions as Permission[];
  }

  const granterPerms = new Set(getUserPermissions(grantingUser));
  if (granterPerms.has('*')) {
    return requestedPermissions as Permission[];
  }

  return (requestedPermissions as Permission[]).filter((p) => granterPerms.has(p));
}

/**
 * Record an audit log entry for system actions
 */
export function recordAuditLog(entry: {
  userId: string;
  userName: string;
  userEmail: string;
  restaurantId?: string;
  role: AdminRole;
  action: string;
  module: AuditLog['module'];
  result?: 'success' | 'failure';
  req?: Request;
  details?: string;
}): AuditLog {
  const ip =
    entry.req?.headers['x-forwarded-for']?.toString()?.slice(0, 200) ||
    entry.req?.socket?.remoteAddress ||
    '127.0.0.1';

  const log: AuditLog = {
    id: `audit-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    userId: entry.userId,
    userName: entry.userName,
    userEmail: entry.userEmail,
    restaurantId: entry.restaurantId || RESTAURANT_ID,
    role: entry.role,
    action: entry.action,
    module: entry.module,
    timestamp: new Date().toISOString(),
    result: entry.result || 'success',
    ip,
    details: entry.details,
  };

  store.auditLogs.unshift(log);

  // Keep recent 1,000 logs in memory
  if (store.auditLogs.length > 1000) {
    store.auditLogs = store.auditLogs.slice(0, 1000);
  }

  MySQLService.saveAuditLog(log).catch(() => {});

  return log;
}

/**
 * Sanitize orders for Kitchen Staff (strip customer phone, email, full address, prices, profit)
 */
export function sanitizeOrderForKitchen(order: Order): Order {
  return {
    ...order,
    customerPhone: '***-***-****',
    customerEmail: undefined,
    deliveryAddress: order.orderType === 'dine-in' ? `Table: ${order.tableNumber || 'Dine-In'}` : 'Delivery (Restricted)',
    subtotal: 0,
    total: 0,
    discount: 0,
    deliveryFee: 0,
    tax: 0,
    items: order.items.map((item) => ({
      ...item,
      price: 0, // kitchen staff does not view financial prices
    })),
  };
}
