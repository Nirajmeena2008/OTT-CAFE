import React, { useState } from 'react';
import {
  Shield,
  CreditCard,
  ChefHat,
  Package,
  DollarSign,
  Users,
  Megaphone,
  Bike,
  BarChart3,
  Settings,
  Crown,
  Briefcase,
  UserCheck,
  Calculator,
  Compass,
  Info,
  CheckCircle2,
} from 'lucide-react';
import {
  SYSTEM_MODULES,
  SYSTEM_ROLES,
  ROLE_MODULE_MATRIX,
  getAccessBadgeStyle,
} from '../../utils/rbacMatrix';
import type { ModuleName, AdminRole, AccessLevel } from '../../types';

const MODULE_ICONS: Record<ModuleName, React.ElementType> = {
  orders: CreditCard,
  menu: ChefHat,
  inventory: Package,
  finance: DollarSign,
  staff: Users,
  marketing: Megaphone,
  delivery: Bike,
  reports: BarChart3,
  settings: Settings,
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  owner: Crown,
  manager: Briefcase,
  staff: UserCheck,
  kitchen: ChefHat,
  accountant: Calculator,
  marketing: Megaphone,
  delivery: Compass,
};

const ACCESS_EXPLANATIONS: Record<string, string> = {
  'orders-Full': 'Complete authority: create, view, accept, prep, dispatch, cancel, delete, and assign courier fleet.',
  'orders-Manage': 'Operational processing: accept incoming orders, advance kitchen status, and process cancellations.',
  'orders-View': 'Read-only order ticket view: inspect item list, table number, order time, and kitchen KOT status.',
  'orders-Assigned': 'Restricted dispatch: view only orders assigned to this rider with customer phone and delivery navigation.',
  'orders-—': 'No access to customer order stream.',

  'menu-Full': 'Full catalog management: add dishes, edit descriptions, adjust prices, and toggle in/out of stock.',
  'menu-Edit': 'Catalog editor: modify dish details, set selling prices, and toggle stock availability.',
  'menu-View': 'Catalog viewer: browse menu items, active pricing, allergens, and availability.',
  'menu-Content': 'Creative marketing: edit promotional badges (Bestseller, Chef Pick), hero photos, and combo descriptions.',
  'menu-—': 'No access to menu management.',

  'inventory-Full': 'Master inventory control: ingredient costs, supplier batch logs, reorder thresholds, and stock adjustments.',
  'inventory-Manage': 'Operational stock management: update current stock quantities and mark items out-of-stock.',
  'inventory-View': 'Inventory observer: view real-time stock levels, low-stock warnings, and ingredient availability.',
  'inventory-—': 'No access to inventory records.',

  'finance-Full': 'Master financial ledger: net profits, GST/tax reports, payment gateway settlements, and CSV audit exports.',
  'finance-Limited': 'Operational daily sales: today’s order totals, average ticket size, and register sales overview.',
  'finance-—': 'Financial data and revenue analysis strictly hidden.',

  'staff-Full': 'Master team management: invite staff, assign roles, generate passcodes, reset credentials, and remove accounts.',
  'staff-Limited': 'Staff directory: view on-duty staff roster, contact info, and assigned operational roles.',
  'staff-—': 'No access to staff credentials or team roster.',

  'marketing-Full': 'Master promotions: create, edit, schedule, and delete homepage banners, discounts, and combo deals.',
  'marketing-View': 'Marketing viewer: inspect active promotional banners, current discount codes, and campaign terms.',
  'marketing-—': 'No access to marketing campaign controls.',

  'delivery-Full': 'Master fleet logistics: add riders, remove personnel, toggle on-duty shifts, and direct dispatch.',
  'delivery-Manage': 'Fleet dispatch manager: assign/reassign riders to orders and monitor transit waypoints.',
  'delivery-View': 'Delivery observer: view active courier dispatches, estimated delivery times, and rider assignments.',
  'delivery-Assigned': 'Courier navigation: accept delivery task, view customer address, call customer, and mark delivered.',
  'delivery-—': 'No access to delivery logistics.',

  'reports-Full': 'Master analytics: financial P&L, sales trends, operational speed, cancellation ratios, and marketing ROI.',
  'reports-Operational': 'Operations analytics: kitchen preparation speed, hourly order peaks, and turnaround time.',
  'reports-Limited': 'Shift summary: orders processed during active shift and front-desk cash register balance.',
  'reports-Financial': 'Auditor ledger: GST tax reports, payment reconciliation, settlement logs, and downloadable spreadsheets.',
  'reports-Marketing': 'Campaign metrics: promo code redemptions, banner click-through rate, and combo conversion.',
  'reports-Own': 'Personal courier stats: trips completed, on-time percentage, distance traveled, and customer feedback.',
  'reports-—': 'Analytics and reporting disabled.',

  'settings-Full': 'Master cafe configuration: restaurant address, phone, GST rate, UPI payment keys, and database sync.',
  'settings-Limited': 'Operational configuration: update opening hours, holiday notices, and public greeting announcement.',
  'settings-—': 'Settings panel restricted.',
};

export const RoleAccessMatrixTable: React.FC = () => {
  const [selectedCell, setSelectedCell] = useState<{
    module: ModuleName;
    role: AdminRole;
    level: AccessLevel;
  } | null>(null);

  return (
    <div className="space-y-4">
      {/* Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-950/60 text-xs text-stone-500 dark:text-stone-400">
              <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100 min-w-[130px]">
                Module
              </th>
              {SYSTEM_ROLES.map((role) => {
                const Icon = ROLE_ICONS[role.key] || Shield;
                return (
                  <th
                    key={role.key}
                    className="py-3.5 px-3 font-bold text-center text-stone-800 dark:text-stone-200 min-w-[95px]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-6 h-6 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold">{role.label}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80 text-xs">
            {SYSTEM_MODULES.map((mod) => {
              const ModIcon = MODULE_ICONS[mod.key] || Shield;
              return (
                <tr
                  key={mod.key}
                  className="hover:bg-amber-50/30 dark:hover:bg-stone-800/30 transition-colors"
                >
                  {/* Module Name & Icon */}
                  <td className="py-3.5 px-4 font-semibold text-stone-900 dark:text-stone-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <ModIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-stone-900 dark:text-stone-100">{mod.label}</div>
                        <div className="text-[10px] text-stone-400 dark:text-stone-500 hidden sm:block">
                          {mod.description}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Access Levels for Each Role */}
                  {SYSTEM_ROLES.map((role) => {
                    const level: AccessLevel =
                      ROLE_MODULE_MATRIX[
                        role.key as 'owner' | 'manager' | 'staff' | 'kitchen' | 'accountant' | 'marketing' | 'delivery'
                      ]?.[mod.key] || '—';
                    const { badgeClass } = getAccessBadgeStyle(level);
                    const isSelected =
                      selectedCell?.module === mod.key && selectedCell?.role === role.key;

                    return (
                      <td
                        key={role.key}
                        onClick={() =>
                          setSelectedCell({
                            module: mod.key,
                            role: role.key,
                            level,
                          })
                        }
                        className="py-3 px-2 text-center cursor-pointer transition-all hover:scale-105"
                      >
                        <div
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg border text-xs transition-all ${
                            level === '—'
                              ? 'border-transparent text-stone-400 dark:text-stone-600 font-bold'
                              : `${badgeClass} shadow-2xs`
                          } ${isSelected ? 'ring-2 ring-amber-500 ring-offset-1' : ''}`}
                        >
                          {level}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected Cell Detail Inspector */}
      {selectedCell && (
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 animate-in fade-in flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>
                  {SYSTEM_MODULES.find((m) => m.key === selectedCell.module)?.label} Module
                </span>
                <span className="text-stone-400">•</span>
                <span className="capitalize">{selectedCell.role} Role</span>
                <span className="text-stone-400">•</span>
                <span className="px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                  {selectedCell.level}
                </span>
              </div>
              <p className="text-stone-600 dark:text-stone-300 mt-1 leading-relaxed">
                {ACCESS_EXPLANATIONS[`${selectedCell.module}-${selectedCell.level}`] ||
                  `Access level '${selectedCell.level}' applies to ${selectedCell.module} for ${selectedCell.role}.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedCell(null)}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 font-bold text-xs p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Access Tier Legend */}
      <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs">
        <div className="font-bold text-stone-800 dark:text-stone-200 mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Access Level Hierarchy &amp; Legend:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold">
            Full (Read/Write/Delete/Admin)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-semibold">
            Manage (Operations &amp; Status)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold">
            Edit (Pricing &amp; Catalog)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-semibold">
            Content (Creative &amp; Marketing)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-medium">
            View (Read-Only)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-medium">
            Assigned (Courier Specific)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium">
            Limited (Restricted Summary)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-400 font-bold">
            — (No Access / Hidden)
          </span>
        </div>
      </div>
    </div>
  );
};
