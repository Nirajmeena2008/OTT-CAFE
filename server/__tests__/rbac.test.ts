import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canManageRole,
  sanitizePermissionGrant,
  getUserPermissions,
} from '../rbac';
import { normalizePhone } from '../routes';
import type { AdminAccessUser } from '../../src/types';

function makeUser(overrides: Partial<AdminAccessUser> = {}): AdminAccessUser {
  return {
    id: 'admin-test-1',
    email: 'staff@outofthetownjaipur.com',
    name: 'Test Staff',
    role: 'manager',
    restaurantId: 'ott-kukas-jaipur',
    addedBy: 'test',
    addedAt: new Date().toISOString(),
    isActive: true,
    ...overrides,
  };
}

describe('normalizePhone', () => {
  it('strips a leading 91 country code from a 12-digit number', () => {
    expect(normalizePhone('919828919626')).toBe('9828919626');
  });
  it('leaves a plain 10-digit number untouched', () => {
    expect(normalizePhone('9828919626')).toBe('9828919626');
  });
  it('strips formatting characters (+91, spaces, dashes)', () => {
    expect(normalizePhone('+91 98289-19626')).toBe('9828919626');
  });
  it('returns an empty string for undefined input', () => {
    expect(normalizePhone(undefined)).toBe('');
  });
});

describe('hasPermission', () => {
  it('grants the owner every permission regardless of role field content', () => {
    const owner = makeUser({ role: 'owner', permissions: [] });
    expect(hasPermission(owner, 'orders.delete')).toBe(true);
    expect(hasPermission(owner, 'database.manage')).toBe(true);
  });

  it('grants the owner-email account every permission even if role is somehow not owner', () => {
    const spoofedRole = makeUser({ role: 'manager', email: 'kumarsatyam5868@gmail.com' });
    expect(hasPermission(spoofedRole, 'orders.delete')).toBe(true);
  });

  it('denies an inactive user every permission, even one they would otherwise hold', () => {
    const inactiveManager = makeUser({ role: 'manager', isActive: false });
    expect(hasPermission(inactiveManager, 'orders.view')).toBe(false);
  });

  it('grants a manager only their default permission set', () => {
    const manager = makeUser({ role: 'manager' });
    expect(hasPermission(manager, 'orders.view')).toBe(true);
    expect(hasPermission(manager, 'database.view')).toBe(false);
    expect(hasPermission(manager, 'staff.create')).toBe(false);
  });

  it('grants a delegated wildcard permission everything (this is legitimate only when the OWNER granted it)', () => {
    const delegatedOwnerLevel = makeUser({ role: 'manager', permissions: ['*'] });
    expect(hasPermission(delegatedOwnerLevel, 'database.manage')).toBe(true);
  });
});

describe('canManageRole — regression coverage for the privilege-escalation fix', () => {
  it('owner can manage every role including other owners', () => {
    expect(canManageRole('owner', 'manager')).toBe(true);
    expect(canManageRole('owner', 'owner')).toBe(true);
  });

  it('manager cannot manage the owner role', () => {
    expect(canManageRole('manager', 'owner')).toBe(false);
  });

  it('manager cannot manage another manager (regression: this is what stopped a delegated manager from self-promoting a peer account)', () => {
    expect(canManageRole('manager', 'manager')).toBe(false);
  });

  it('manager CAN manage a lower-privilege operational role', () => {
    expect(canManageRole('manager', 'kitchen_staff')).toBe(true);
    expect(canManageRole('manager', 'counter_staff')).toBe(true);
  });

  it('a plain staff/operational role can manage no one', () => {
    expect(canManageRole('kitchen_staff', 'delivery_person')).toBe(false);
    expect(canManageRole('counter_staff', 'kitchen_staff')).toBe(false);
  });
});

describe('sanitizePermissionGrant — regression coverage for the wildcard-escalation fix', () => {
  it('the owner may grant the wildcard permission to anyone', () => {
    const owner = makeUser({ role: 'owner' });
    const result = sanitizePermissionGrant(owner, ['*']);
    expect(result).toEqual(['*']);
  });

  it('a non-owner manager with no custom permissions cannot grant the wildcard (regression: this is the exact exploit that was found and fixed)', () => {
    const plainManager = makeUser({ role: 'manager' });
    const result = sanitizePermissionGrant(plainManager, ['*']);
    expect(result).not.toContain('*');
    expect(result).toEqual([]);
  });

  it('a manager can only grant permissions that are a subset of their own effective permissions', () => {
    const manager = makeUser({ role: 'manager' }); // default perms include orders.view, staff.view, etc.
    const requested = ['orders.view', 'database.manage', 'staff.create'];
    const result = sanitizePermissionGrant(manager, requested);
    expect(result).toContain('orders.view'); // manager's own default permission
    expect(result).not.toContain('database.manage'); // not held by manager
    expect(result).not.toContain('staff.create'); // not held by manager by default
  });

  it('a delegated manager who WAS granted a custom permission can pass that specific one on', () => {
    const delegated = makeUser({ role: 'manager', permissions: ['staff.create', 'orders.view'] });
    const result = sanitizePermissionGrant(delegated, ['staff.create', 'database.manage']);
    expect(result).toContain('staff.create');
    expect(result).not.toContain('database.manage');
  });

  it('non-array input is passed through as undefined (caller should then fall back to role defaults)', () => {
    const manager = makeUser({ role: 'manager' });
    expect(sanitizePermissionGrant(manager, 'not-an-array')).toBeUndefined();
    expect(sanitizePermissionGrant(manager, undefined)).toBeUndefined();
  });
});

describe('getUserPermissions', () => {
  it('a manager with no custom permissions falls back to the role default list', () => {
    const manager = makeUser({ role: 'manager', permissions: [] });
    const perms = getUserPermissions(manager);
    expect(perms).toContain('orders.view');
    expect(perms).not.toContain('*');
  });

  it('owner always resolves to the wildcard regardless of stored permissions field', () => {
    const owner = makeUser({ role: 'owner', permissions: [] });
    expect(getUserPermissions(owner)).toEqual(['*']);
  });
});
