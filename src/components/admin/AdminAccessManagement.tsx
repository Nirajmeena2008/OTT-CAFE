import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Lock,
  Mail,
  User,
  Crown,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ChefHat,
  Briefcase,
  Shield,
  Phone,
  Info,
  CreditCard,
  DollarSign,
  Megaphone,
  Bike,
  KeyRound,
  FileText,
  Check,
  Settings,
  Activity,
  Edit3,
  X,
  LogOut,
} from 'lucide-react';
import { api } from '../../services/api';
import type { AdminAccessUser, AdminRole, Permission, ModuleName } from '../../types';
import { RoleAccessMatrixTable } from './RoleAccessMatrixTable';
import {
  ROLE_MODULE_MATRIX,
  normalizeRole,
  getRoleDefaultPermissions,
  getRoleModuleAccess,
  getAccessBadgeStyle,
} from '../../utils/rbacMatrix';

interface AdminAccessManagementProps {
  token: string;
  currentUser?: AdminAccessUser | null;
  onNotification?: (msg: string) => void;
}

export const ROLE_CONFIGS: Record<
  AdminRole,
  { label: string; badgeClass: string; desc: string; icon: React.ElementType; defaultPerms: Permission[] }
> = {
  owner: {
    label: 'Owner',
    badgeClass: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40',
    desc: 'Full root authority: Orders, Menu, Inventory, Finance, Staff, Marketing, Delivery, Reports, and Settings.',
    icon: Crown,
    defaultPerms: ['*'],
  },
  manager: {
    label: 'Manager',
    badgeClass: 'bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-500/40',
    desc: 'Orders (Full) • Menu (Edit) • Inventory (Manage) • Finance (Limited) • Staff (Limited) • Marketing (View) • Delivery (Manage) • Reports (Operational) • Settings (Limited)',
    icon: Briefcase,
    defaultPerms: getRoleDefaultPermissions('manager'),
  },
  staff: {
    label: 'Staff',
    badgeClass: 'bg-teal-500/20 text-teal-800 dark:text-teal-300 border-teal-500/40',
    desc: 'Orders (Manage) • Menu (View) • Inventory (View) • Delivery (View) • Reports (Limited)',
    icon: CreditCard,
    defaultPerms: getRoleDefaultPermissions('staff'),
  },
  kitchen: {
    label: 'Kitchen',
    badgeClass: 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40',
    desc: 'Orders (View) • Menu (View) • Inventory (View)',
    icon: ChefHat,
    defaultPerms: getRoleDefaultPermissions('kitchen'),
  },
  accountant: {
    label: 'Accountant',
    badgeClass: 'bg-violet-500/20 text-violet-800 dark:text-violet-300 border-violet-500/40',
    desc: 'Orders (View) • Finance (Full) • Reports (Financial)',
    icon: DollarSign,
    defaultPerms: getRoleDefaultPermissions('accountant'),
  },
  marketing: {
    label: 'Marketing',
    badgeClass: 'bg-pink-500/20 text-pink-800 dark:text-pink-300 border-pink-500/40',
    desc: 'Menu (Content) • Marketing (Full) • Reports (Marketing)',
    icon: Megaphone,
    defaultPerms: getRoleDefaultPermissions('marketing'),
  },
  delivery: {
    label: 'Delivery',
    badgeClass: 'bg-orange-500/20 text-orange-800 dark:text-orange-300 border-orange-500/40',
    desc: 'Orders (Assigned) • Delivery (Assigned) • Reports (Own)',
    icon: Bike,
    defaultPerms: getRoleDefaultPermissions('delivery'),
  },
  // Backward compatibility aliases
  counter_staff: {
    label: 'Staff',
    badgeClass: 'bg-teal-500/20 text-teal-800 dark:text-teal-300 border-teal-500/40',
    desc: 'Orders (Manage) • Menu (View) • Inventory (View) • Delivery (View) • Reports (Limited)',
    icon: CreditCard,
    defaultPerms: getRoleDefaultPermissions('staff'),
  },
  kitchen_staff: {
    label: 'Kitchen',
    badgeClass: 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40',
    desc: 'Orders (View) • Menu (View) • Inventory (View)',
    icon: ChefHat,
    defaultPerms: getRoleDefaultPermissions('kitchen'),
  },
  kitchen_lead: {
    label: 'Kitchen',
    badgeClass: 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40',
    desc: 'Orders (View) • Menu (View) • Inventory (View)',
    icon: ChefHat,
    defaultPerms: getRoleDefaultPermissions('kitchen'),
  },
  marketing_staff: {
    label: 'Marketing',
    badgeClass: 'bg-pink-500/20 text-pink-800 dark:text-pink-300 border-pink-500/40',
    desc: 'Menu (Content) • Marketing (Full) • Reports (Marketing)',
    icon: Megaphone,
    defaultPerms: getRoleDefaultPermissions('marketing'),
  },
  delivery_person: {
    label: 'Delivery',
    badgeClass: 'bg-orange-500/20 text-orange-800 dark:text-orange-300 border-orange-500/40',
    desc: 'Orders (Assigned) • Delivery (Assigned) • Reports (Own)',
    icon: Bike,
    defaultPerms: getRoleDefaultPermissions('delivery'),
  },
};

const ALL_PERMISSION_MODULES: {
  module: string;
  label: string;
  icon: React.ElementType;
  permissions: { key: Permission; label: string; desc: string }[];
}[] = [
  {
    module: 'orders',
    label: 'Orders & POS Operations',
    icon: CreditCard,
    permissions: [
      { key: 'orders.view', label: 'View Orders', desc: 'Browse incoming and historical orders' },
      { key: 'orders.create', label: 'Create Orders', desc: 'Create counter or telephone POS orders' },
      { key: 'orders.accept', label: 'Accept Orders', desc: 'Accept orders into kitchen preparation' },
      { key: 'orders.reject', label: 'Reject Orders', desc: 'Decline orders with cancellation reason' },
      { key: 'orders.update_status', label: 'Update Order Status', desc: 'Advance order to preparing, ready, or dispatched' },
      { key: 'orders.cancel', label: 'Cancel Orders', desc: 'Cancel confirmed orders and issue refunds' },
    ],
  },
  {
    module: 'menu',
    label: 'Menu & Dishes',
    icon: ChefHat,
    permissions: [
      { key: 'menu.view', label: 'View Menu Items', desc: 'Inspect catalog and pricing' },
      { key: 'menu.create', label: 'Add New Dishes', desc: 'Create dishes with images & pricing' },
      { key: 'menu.edit', label: 'Edit Dishes', desc: 'Modify dish names, recipes, & categories' },
      { key: 'menu.delete', label: 'Delete Dishes', desc: 'Permanently remove dishes from catalog' },
      { key: 'menu.change_price', label: 'Change Pricing', desc: 'Update selling and original prices' },
      { key: 'menu.change_availability', label: 'Toggle Availability', desc: 'Mark items as In-Stock or Sold-Out' },
    ],
  },
  {
    module: 'finance',
    label: 'Finance & Revenue',
    icon: DollarSign,
    permissions: [
      { key: 'finance.view_sales', label: 'View Sales Figures', desc: 'Inspect daily, weekly, and monthly sales' },
      { key: 'finance.view_transactions', label: 'View Transactions', desc: 'Inspect payment gateways & UPI refs' },
      { key: 'finance.view_settlements', label: 'View Settlements', desc: 'Review bank settlements and bank accounts' },
      { key: 'finance.export', label: 'Export Financial Reports', desc: 'Download CSV / Excel sales & tax audit exports' },
    ],
  },
  {
    module: 'staff',
    label: 'Staff & Permissions',
    icon: ShieldCheck,
    permissions: [
      { key: 'staff.view', label: 'View Staff Accounts', desc: 'Inspect team accounts and roles' },
      { key: 'staff.create', label: 'Create Staff Accounts', desc: 'Add new staff and generate passcodes' },
      { key: 'staff.edit', label: 'Edit Staff Details', desc: 'Update staff roles and assigned shifts' },
      { key: 'staff.deactivate', label: 'Suspend / Deactivate Staff', desc: 'Temporarily pause staff access' },
      { key: 'staff.manage_permissions', label: 'Granular Permissions', desc: 'Assign individual permission overrides' },
    ],
  },
  {
    module: 'delivery',
    label: 'Delivery & Logistics',
    icon: Bike,
    permissions: [
      { key: 'delivery.view', label: 'View All Deliveries', desc: 'Inspect all active delivery dispatches' },
      { key: 'delivery.assign', label: 'Assign Couriers', desc: 'Assign delivery partners to orders' },
      { key: 'delivery.update_status', label: 'Update Transit Stage', desc: 'Update waypoints, pickup, and delivery' },
      { key: 'delivery.view_assigned', label: 'View Assigned Deliveries', desc: 'Restricted view for assigned courier only' },
    ],
  },
  {
    module: 'settings',
    label: 'Settings & Security',
    icon: Settings,
    permissions: [
      { key: 'settings.view', label: 'View Restaurant Settings', desc: 'Inspect business profile and address' },
      { key: 'settings.edit', label: 'Edit Restaurant Settings', desc: 'Update hours, contact info, and tax rates' },
      { key: 'settings.security', label: 'Security Administration', desc: 'Bank accounts, ownership, and secret keys' },
    ],
  },
  {
    module: 'marketing',
    label: 'Promotions & Marketing',
    icon: Megaphone,
    permissions: [
      { key: 'banners.view', label: 'View Banners', desc: 'Inspect active promotional banners' },
      { key: 'banners.manage', label: 'Manage Banners', desc: 'Create, edit, and schedule promotional banners' },
    ],
  },
  {
    module: 'database',
    label: 'Database & Audit',
    icon: Activity,
    permissions: [
      { key: 'database.view', label: 'View Database Schema & Status', desc: 'Check MySQL health and table count' },
      { key: 'database.manage', label: 'Trigger Database Sync', desc: 'Run full MySQL bulk synchronization' },
      { key: 'audit.view', label: 'View Audit Logs', desc: 'Inspect immutable administrative audit trails' },
    ],
  },
];

const OWNER_EMAIL = 'kumarsatyam5868@gmail.com';

export const AdminAccessManagement: React.FC<AdminAccessManagementProps> = ({
  token,
  currentUser,
  onNotification,
}) => {
  // Mirrors the backend's requirePermission checks in server/routes.ts for these same
  // endpoints, so a role that will get a 403 from the API never sees the button at all.
  const canManage = (perm: Permission): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'owner') return true;
    const perms = currentUser.permissions?.length
      ? currentUser.permissions
      : getRoleDefaultPermissions(currentUser.role);
    return perms.includes('*') || perms.includes(perm);
  };
  const canCreateStaff = canManage('staff.create') || canManage('staff.manage_permissions');
  const canEditStaff = canManage('staff.edit');
  const canDeactivateStaff = canManage('staff.deactivate');
  const canResetAccess = canManage('staff.reset_access');
  const canRevokeSessions = canManage('staff.revoke_session');
  const canDeleteStaff = canManage('staff.manage_permissions') || canManage('staff.edit') || canManage('staff.create');

  const [team, setTeam] = useState<AdminAccessUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'roster' | 'matrix'>('roster');

  // Add / Invite staff modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('manager');
  const [newPasscode, setNewPasscode] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [customPerms, setCustomPerms] = useState<Permission[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit staff modal state
  const [editingUser, setEditingUser] = useState<AdminAccessUser | null>(null);
  const [editRole, setEditRole] = useState<AdminRole>('manager');
  const [editPerms, setEditPerms] = useState<Permission[]>([]);
  const [editNotes, setEditNotes] = useState('');

  // Passcode reset notification & confirmation modals (safely replaces window.confirm for iframe)
  const [userToReset, setUserToReset] = useState<AdminAccessUser | null>(null);
  const [userToRevoke, setUserToRevoke] = useState<AdminAccessUser | null>(null);
  const [resetModalData, setResetModalData] = useState<{ name: string; email: string; passcode: string } | null>(null);

  // Delete staff modal state (avoids window.confirm which is blocked in iframes)
  const [staffToDelete, setStaffToDelete] = useState<AdminAccessUser | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);

  const fetchTeam = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAdminTeam(token);
      if (res && res.data) {
        setTeam(res.data);
      }
    } catch (err: any) {
      console.warn('Could not fetch admin team:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [token]);

  // When newRole changes in add modal, auto-seed default permissions
  useEffect(() => {
    const config = ROLE_CONFIGS[newRole];
    if (config) {
      setCustomPerms(config.defaultPerms);
    }
  }, [newRole]);

  // Open edit modal
  const handleOpenEdit = (user: AdminAccessUser) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditPerms(user.permissions || ROLE_CONFIGS[user.role]?.defaultPerms || []);
    setEditNotes(user.notes || '');
  };

  // Submit Grant / Add Staff Access
  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newEmail.trim()) {
      setFormError('Please provide a staff email address, username, or phone number.');
      return;
    }

    let emailTrimmed = newEmail.trim().toLowerCase();
    if (!emailTrimmed.includes('@')) {
      emailTrimmed = `${emailTrimmed.replace(/[^a-z0-9._-]/g, '')}@outofthetownjaipur.com`;
    }

    if (!newName.trim()) {
      setFormError('Please enter the team member name or job title.');
      return;
    }

    // Check duplicate
    if (team.some((u) => u.email.toLowerCase().trim() === emailTrimmed && u.isActive)) {
      setFormError(`Staff access is already active for ${emailTrimmed}.`);
      return;
    }

    setIsLoading(true);
    try {
      const created = await api.addAdminTeamMember(token, {
        email: emailTrimmed,
        name: newName.trim(),
        role: newRole,
        permissions: customPerms,
        passcode: newPasscode.trim() || undefined,
        notes: newNotes.trim() || undefined,
      });

      setTeam((prev) => {
        const filtered = prev.filter((u) => u.email.toLowerCase() !== emailTrimmed);
        return [...filtered, created];
      });

      onNotification?.(`Staff account created for ${newName.trim()} (${newRole.toUpperCase()})`);
      setIsAddModalOpen(false);
      setNewEmail('');
      setNewName('');
      setNewRole('manager');
      setNewPasscode('');
      setNewNotes('');

      if (created.passcode) {
        setResetModalData({
          name: created.name,
          email: created.email,
          passcode: created.passcode,
        });
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to grant admin access.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Edit Staff
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setActionLoadingId(editingUser.id);
    try {
      const updated = await api.updateAdminTeamMember(token, editingUser.id, {
        role: editRole,
        permissions: editPerms,
        notes: editNotes,
      });

      setTeam((prev) => prev.map((u) => (u.id === editingUser.id ? updated : u)));
      onNotification?.(`Updated role & permissions for ${editingUser.name}`);
      setEditingUser(null);
    } catch (err: any) {
      onNotification?.('Failed to update: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Toggle Staff Status (Suspend / Reactivate)
  const handleToggleStatus = async (user: AdminAccessUser) => {
    if (user.email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim() || user.role === 'owner') {
      onNotification?.('Cannot deactivate the root restaurant owner.');
      return;
    }

    setActionLoadingId(user.id);
    try {
      const updated = await api.toggleAdminTeamMember(token, user.id);
      setTeam((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      onNotification?.(
        `${user.name} access ${updated.isActive ? 'activated' : 'suspended'} successfully`
      );
    } catch (err: any) {
      onNotification?.('Failed to update status: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reset Staff Access / Passcode
  const handleResetAccess = (user: AdminAccessUser) => {
    if (user.role === 'owner' && user.email.toLowerCase() === OWNER_EMAIL) {
      onNotification?.('Root owner credentials cannot be reset here.');
      return;
    }
    setUserToReset(user);
  };

  const confirmResetAccess = async () => {
    if (!userToReset) return;
    const user = userToReset;
    setUserToReset(null);
    setActionLoadingId(user.id);
    try {
      const res = await api.resetAdminMemberAccess(token, user.id);
      setTeam((prev) => prev.map((u) => (u.id === user.id ? res.user : u)));
      setResetModalData({
        name: user.name,
        email: user.email,
        passcode: res.passcode,
      });
      onNotification?.(`New passcode generated for ${user.name}`);
    } catch (err: any) {
      onNotification?.('Failed to reset access: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Revoke All Active Sessions
  const handleRevokeSessions = (user: AdminAccessUser) => {
    setUserToRevoke(user);
  };

  const confirmRevokeSessions = async () => {
    if (!userToRevoke) return;
    const user = userToRevoke;
    setUserToRevoke(null);
    setActionLoadingId(user.id);
    try {
      await api.revokeAdminMemberSessions(token, user.id);
      onNotification?.(`All active sessions revoked for ${user.name}`);
    } catch (err: any) {
      onNotification?.('Failed to revoke sessions: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Permanently Remove Staff (replaces window.confirm with in-app confirmation modal)
  const confirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    if (staffToDelete.email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim() || staffToDelete.role === 'owner') {
      onNotification?.('Cannot delete the root restaurant owner.');
      setStaffToDelete(null);
      return;
    }

    setIsDeletingStaff(true);
    try {
      await api.removeAdminTeamMember(token, staffToDelete.id);
      setTeam((prev) => prev.filter((u) => u.id !== staffToDelete.id && u.email.toLowerCase().trim() !== staffToDelete.email.toLowerCase().trim()));
      onNotification?.(`Staff account permanently removed for ${staffToDelete.name} (${staffToDelete.email})`);
      setStaffToDelete(null);
    } catch (err: any) {
      onNotification?.('Failed to remove staff member: ' + err.message);
    } finally {
      setIsDeletingStaff(false);
    }
  };

  const filteredTeam = team.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.notes && u.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner / Privacy & Security Brief */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-stone-800/10 dark:from-amber-950/40 dark:via-stone-900/60 dark:to-stone-900 border border-amber-500/30 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
                  Staff &amp; Permissions
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  Staff Accounts &amp; Access
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                  Unlimited Staff • No Limit
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-1 max-w-2xl leading-relaxed">
                Configure staff accounts, operational roles, login passcodes, and active sessions across all restaurant teams. Add unlimited staff members without any cap.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <button
              onClick={fetchTeam}
              disabled={isLoading}
              title="Refresh Staff List"
              className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {canCreateStaff && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-md cursor-pointer transition-all active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Staff Account</span>
              </button>
            )}
          </div>
        </div>

        {/* Highlight Root Owner Banner */}
        <div className="mt-5 pt-4 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-amber-500/10 dark:bg-amber-950/30 p-3.5 rounded-xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-stone-700 dark:text-stone-300 font-medium">
              Primary Restaurant Owner &amp; Root Admin:
            </span>
            <strong className="font-mono text-stone-900 dark:text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded">
              {OWNER_EMAIL}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Root Protection Active (Full Access • Immutable)</span>
          </div>
        </div>
      </div>

      {/* View Switcher: Staff Members Roster vs Role & Access Matrix */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('roster')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              viewMode === 'roster'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Staff Accounts</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              viewMode === 'roster' ? 'bg-amber-800/40 text-white' : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
            }`}>
              {team.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              viewMode === 'matrix'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Access Options &amp; Features Matrix</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
              9 Modules × 7 Roles
            </span>
          </button>
        </div>

        <span className="text-xs text-stone-500 dark:text-stone-400">
          {viewMode === 'matrix'
            ? 'Interactive table matching role & privilege matrix'
            : `Showing ${filteredTeam.length} staff accounts`}
        </span>
      </div>

      {/* MATRIX VIEW */}
      {viewMode === 'matrix' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <RoleAccessMatrixTable />
        </div>
      )}

      {/* ROSTER VIEW */}
      {viewMode === 'roster' && (
      <div className="space-y-4">
        {/* Search & Counter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Staff Members:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800">
                {team.filter((t) => t.isActive).length} Active
              </span>
              <span className="font-bold text-stone-800 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 rounded-lg">
                {team.length} Total
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hidden sm:inline">
                (Unlimited)
              </span>
            </div>
          </div>

          {/* Grid of Staff Members */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTeam.map((member) => {
              const normRole = normalizeRole(member.role);
              const roleConfig = ROLE_CONFIGS[normRole] || ROLE_CONFIGS.manager;
              const RoleIcon = roleConfig.icon;
              const isRootOwner = member.email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim();
              const permsCount = member.permissions?.length || roleConfig.defaultPerms.length;

              return (
                <div
                  key={member.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isRootOwner
                      ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/40 ring-1 ring-amber-500/20'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 shadow-2xs'
                  } ${!member.isActive ? 'opacity-60 bg-stone-100 dark:bg-stone-900/50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                          isRootOwner
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-600 dark:text-amber-400'
                            : normRole === 'manager'
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-600 dark:text-blue-400'
                            : normRole === 'staff'
                            ? 'bg-teal-500/20 border-teal-500/40 text-teal-600 dark:text-teal-400'
                            : normRole === 'kitchen'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : normRole === 'accountant'
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-600 dark:text-violet-400'
                            : normRole === 'marketing'
                            ? 'bg-pink-500/20 border-pink-500/40 text-pink-600 dark:text-pink-400'
                            : 'bg-orange-500/20 border-orange-500/40 text-orange-600 dark:text-orange-400'
                        }`}
                      >
                        <RoleIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 truncate">
                            {member.name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleConfig.badgeClass}`}
                          >
                            {roleConfig.label}
                          </span>
                          {member.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Suspended
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 font-mono mt-1 truncate">
                          <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    {!isRootOwner ? (
                      <div className="flex items-center gap-1 shrink-0">
                        {canEditStaff && (
                          <button
                            onClick={() => handleOpenEdit(member)}
                            title="Edit role & granular permissions"
                            className="p-1.5 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {canDeactivateStaff && (
                          <button
                            onClick={() => handleToggleStatus(member)}
                            disabled={actionLoadingId === member.id}
                            title={member.isActive ? 'Suspend staff access' : 'Reactivate access'}
                            className={`px-2.5 py-1 text-xs rounded-lg font-semibold border cursor-pointer transition-colors ${
                              member.isActive
                                ? 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                                : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                            }`}
                          >
                            {member.isActive ? 'Suspend' : 'Activate'}
                          </button>
                        )}
                        {canDeleteStaff && (
                          <button
                            onClick={() => {
                              if (isRootOwner) {
                                onNotification?.('Cannot delete the root restaurant owner.');
                                return;
                              }
                              setStaffToDelete(member);
                            }}
                            disabled={actionLoadingId === member.id || isDeletingStaff}
                            title="Delete staff account"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40">
                        <Lock className="w-3 h-3" />
                        Owner (Immutable)
                      </span>
                    )}
                  </div>

                  {/* Module Capabilities Bar */}
                  <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-stone-800">
                    <div className="text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500 mb-1.5 flex items-center justify-between">
                      <span>Module Access</span>
                      <span className="font-mono text-stone-500">9 Modules</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {(['orders', 'menu', 'inventory', 'finance', 'staff', 'marketing', 'delivery', 'reports', 'settings'] as ModuleName[]).map((m) => {
                        const lvl = isRootOwner ? 'Full' : getRoleModuleAccess(normRole, m);
                        const { badgeClass } = getAccessBadgeStyle(lvl);
                        return (
                          <span
                            key={m}
                            className={`text-[9px] px-1.5 py-0.5 rounded border capitalize ${
                              lvl === '—'
                                ? 'bg-stone-50 dark:bg-stone-900 border-stone-100 dark:border-stone-800 text-stone-400'
                                : badgeClass
                            }`}
                            title={`${m}: ${lvl}`}
                          >
                            <span className="font-medium">{m}: </span>
                            <strong>{lvl}</strong>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Role description & notes */}
                  <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-800/80 text-xs text-stone-500 dark:text-stone-400 space-y-2">
                    <p className="leading-relaxed">{roleConfig.desc}</p>
                    {member.notes && (
                      <p className="text-stone-600 dark:text-stone-300 italic">
                        Note: {member.notes}
                      </p>
                    )}

                    {/* Permissions summary badge & controls */}
                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Shield className="w-3.5 h-3.5 text-amber-600" />
                        <span>Permissions:</span>
                        <span className="font-bold text-stone-900 dark:text-stone-100 font-mono bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                          {isRootOwner ? 'Full Access (All Modules)' : `${permsCount} actions`}
                        </span>
                      </div>

                      {!isRootOwner && (canResetAccess || canRevokeSessions) && (
                        <div className="flex items-center gap-2">
                          {canResetAccess && (
                            <button
                              onClick={() => handleResetAccess(member)}
                              disabled={actionLoadingId === member.id}
                              className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Generate new passcode and reset access"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Reset Passcode</span>
                            </button>
                          )}
                          {canRevokeSessions && (
                            <button
                              onClick={() => handleRevokeSessions(member)}
                              disabled={actionLoadingId === member.id}
                              className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Disconnect all currently active sessions"
                            >
                              <LogOut className="w-3 h-3" />
                              <span>Revoke Sessions</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-stone-400 dark:text-stone-500 pt-1 flex items-center justify-between border-t border-stone-100 dark:border-stone-800">
                      <span>Added by: {member.addedBy}</span>
                      <span>{new Date(member.addedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTeam.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
              <Shield className="w-10 h-10 text-stone-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                No staff member matching "{searchQuery}"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD STAFF ACCOUNT & ASSIGN ROLE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in overflow-hidden">
          <div className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl max-w-2xl w-full border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden my-auto">
            {/* Header (fixed shrink-0) */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 leading-tight">
                    Create Staff Account &amp; Assign Role
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Provision operational credentials with role-based permissions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg cursor-pointer transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleGrantAccess} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 sm:space-y-4 overscroll-contain">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Staff Details (2-Column on PC / Tablet, 1-Column on Mobile) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Staff Email or ID / Phone <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. kailash@outofthetownjaipur.com or 9876543210"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
                    Unique login username or email
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Staff Full Name / Job Title <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vikram Singh (Head Chef)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
                    Displayed on tickets and logs
                  </p>
                </div>
              </div>

              {/* Role Picker matching 6 canonical assignable roles */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                    Select Role &amp; Access Tier
                  </label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    Current: {ROLE_CONFIGS[newRole]?.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['manager', 'staff', 'kitchen', 'accountant', 'marketing', 'delivery'] as AdminRole[]).map((r) => {
                    const cfg = ROLE_CONFIGS[r];
                    const isSelected = newRole === r;
                    const RIcon = cfg.icon;
                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setNewRole(r)}
                        className={`p-2 sm:p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-500 shadow-2xs'
                            : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                        }`}
                      >
                        <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <RIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">{cfg.label}</span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-1" />}
                        </div>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1 leading-tight">
                          {cfg.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Role Live Module Rights Grid */}
                <div className="mt-2.5 p-2.5 sm:p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                      Module Access for {ROLE_CONFIGS[newRole]?.label}:
                    </span>
                    <span className="text-[10px] font-mono text-stone-400">9 Canonical Modules</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 sm:gap-1.5 text-[10px] sm:text-[11px]">
                    {(['orders', 'menu', 'inventory', 'finance', 'staff', 'marketing', 'delivery', 'reports', 'settings'] as ModuleName[]).map((m) => {
                      const lvl = getRoleModuleAccess(newRole, m);
                      const { badgeClass } = getAccessBadgeStyle(lvl);
                      return (
                        <div key={m} className="flex items-center justify-between px-2 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                          <span className="capitalize text-[10px] text-stone-600 dark:text-stone-400 font-medium truncate mr-1">{m}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${badgeClass}`}>{lvl}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Passcode & Notes (2-Column on PC / Tablet, 1-Column on Mobile) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                      Login Passcode (Optional)
                    </label>
                    <span className="text-[10px] text-stone-400">Auto if blank</span>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. OTT9828 or ChefPass26"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Notes / Shift / Contact (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Evening Kitchen Shift, Phone: +91 98289"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </form>

            {/* Footer Action Buttons (fixed shrink-0) */}
            <div className="p-3.5 sm:p-4 border-t border-stone-100 dark:border-stone-800 shrink-0 bg-stone-50/80 dark:bg-stone-900/80 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-semibold text-xs hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleGrantAccess(e as any);
                }}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isLoading ? 'Creating...' : 'Create Staff Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT ROLE & INDIVIDUAL PERMISSIONS */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in overflow-hidden">
          <div className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl max-w-2xl w-full border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden my-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 leading-tight">
                    Edit Role &amp; Granular Permissions
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Updating credentials for {editingUser.name} ({editingUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg cursor-pointer transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  Change Role
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['manager', 'staff', 'kitchen', 'accountant', 'marketing', 'delivery'] as AdminRole[]).map((r) => {
                    const cfg = ROLE_CONFIGS[r];
                    const isSelected = editRole === r;
                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => {
                          setEditRole(r);
                          setEditPerms(cfg.defaultPerms);
                        }}
                        className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-500'
                            : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                        }`}
                      >
                        <span className="text-xs font-bold block text-stone-900 dark:text-stone-100">
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Role Live Module Rights Grid */}
                <div className="mt-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                      Module Access for {ROLE_CONFIGS[editRole]?.label}:
                    </span>
                    <span className="text-[10px] font-mono text-stone-400">9 Modules</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                    {(['orders', 'menu', 'inventory', 'finance', 'staff', 'marketing', 'delivery', 'reports', 'settings'] as ModuleName[]).map((m) => {
                      const lvl = getRoleModuleAccess(editRole, m);
                      const { badgeClass } = getAccessBadgeStyle(lvl);
                      return (
                        <div key={m} className="flex items-center justify-between px-2 py-1 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                          <span className="capitalize text-[10px] text-stone-600 dark:text-stone-400 font-medium">{m}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${badgeClass}`}>{lvl}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Granular Individual Permissions Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                    Individual Permissions Override ({editPerms.length} active)
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditPerms(ROLE_CONFIGS[editRole]?.defaultPerms || [])}
                    className="text-[11px] font-semibold text-amber-600 hover:underline cursor-pointer"
                  >
                    Reset to Role Defaults
                  </button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto border border-stone-200 dark:border-stone-800 rounded-xl p-3 bg-stone-50/50 dark:bg-stone-800/40">
                  {ALL_PERMISSION_MODULES.map((mod) => (
                    <div key={mod.module} className="space-y-1.5">
                      <h4 className="text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1">
                        <span>{mod.label}</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {mod.permissions.map((perm) => {
                          const isChecked = editPerms.includes(perm.key);
                          return (
                            <label
                              key={perm.key}
                              className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditPerms([...editPerms, perm.key]);
                                  } else {
                                    setEditPerms(editPerms.filter((p) => p !== perm.key));
                                  }
                                }}
                                className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                              <div>
                                <span className="font-semibold text-stone-800 dark:text-stone-200 block leading-tight">
                                  {perm.label}
                                </span>
                                <span className="text-[10px] text-stone-500 dark:text-stone-400 block mt-0.5">
                                  {perm.desc}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              </div>

              <div className="p-3.5 sm:p-4 border-t border-stone-100 dark:border-stone-800 shrink-0 bg-stone-50/80 dark:bg-stone-900/80 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-semibold text-xs hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === editingUser.id}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{actionLoadingId === editingUser.id ? 'Saving...' : 'Save Permissions'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PASSCODE RESET / CREATION RESULT DIALOG */}
      {resetModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-sm w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                Staff Credentials Generated
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Share this passcode with {resetModalData.name} ({resetModalData.email})
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1">
                Access Passcode
              </span>
              <strong className="text-xl font-mono text-amber-600 dark:text-amber-400 tracking-wider">
                {resetModalData.passcode}
              </strong>
            </div>

            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              They can enter this passcode at the <strong>Restaurant Admin Suite</strong> prompt to unlock their role.
            </p>

            <button
              onClick={() => setResetModalData(null)}
              className="w-full py-2.5 bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 text-white dark:text-stone-900 font-bold text-xs rounded-xl cursor-pointer"
            >
              Done &amp; Dismiss
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: IN-APP DELETE STAFF CONFIRMATION DIALOG */}
      {staffToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Delete Staff Member
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Permanently remove credentials and account access
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 dark:text-stone-100">{staffToDelete.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 uppercase">
                  {staffToDelete.role}
                </span>
              </div>
              <p className="text-stone-600 dark:text-stone-400 font-mono text-[11px]">{staffToDelete.email}</p>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Are you sure you want to permanently delete <strong>{staffToDelete.name}</strong> from staff access? Their login passcode will be invalidated immediately. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                disabled={isDeletingStaff}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteStaff}
                disabled={isDeletingStaff}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer active:scale-95 transition-all disabled:opacity-60"
              >
                {isDeletingStaff ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete Staff</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: IN-APP RESET PASSCODE CONFIRMATION DIALOG */}
      {userToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Reset Passcode &amp; Access
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Generate new login credentials for staff
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 dark:text-stone-100">{userToReset.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 uppercase">
                  {userToReset.role}
                </span>
              </div>
              <p className="text-stone-600 dark:text-stone-400 font-mono text-[11px]">{userToReset.email}</p>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Generate a new login passcode and reset active access for <strong>{userToReset.name}</strong>? Any previous passcode will cease to work.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToReset(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmResetAccess}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm cursor-pointer active:scale-95 transition-all"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Yes, Generate New Passcode</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: IN-APP REVOKE SESSIONS CONFIRMATION DIALOG */}
      {userToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full p-6 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <LogOut className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Revoke Active Sessions
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Disconnect all logged-in devices immediately
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 dark:text-stone-100">{userToRevoke.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 uppercase">
                  {userToRevoke.role}
                </span>
              </div>
              <p className="text-stone-600 dark:text-stone-400 font-mono text-[11px]">{userToRevoke.email}</p>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Immediately disconnect and terminate all active login sessions across phones, tablets, and computers for <strong>{userToRevoke.name}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToRevoke(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRevokeSessions}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer active:scale-95 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Yes, Disconnect All Sessions</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
