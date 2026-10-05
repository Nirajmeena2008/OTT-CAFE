import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Calendar,
  Download,
  ArrowLeft,
  PieChart,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  ChevronRight,
  Utensils,
  Bike,
  Sparkles,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import type { Order, OrderStatus } from '../../types';

interface RevenueAnalysisProps {
  orders: Order[];
  onBack: () => void;
  token: string;
}

export const RevenueAnalysis: React.FC<RevenueAnalysisProps> = ({ orders, onBack }) => {
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Filter orders by time range
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = todayStart - 30 * 24 * 60 * 60 * 1000;

    return orders.filter((o) => {
      const orderTime = new Date(o.createdAt).getTime();
      if (timeRange === 'today') return orderTime >= todayStart;
      if (timeRange === 'week') return orderTime >= weekAgo;
      if (timeRange === 'month') return orderTime >= monthAgo;
      return true;
    });
  }, [orders, timeRange]);

  // Financial Metrics Calculation
  const metrics = useMemo(() => {
    let totalGrossRevenue = 0;
    let realizedRevenue = 0; // Delivered / completed
    let inProgressRevenue = 0; // Preparing / ready / pending
    let cancelledRevenue = 0;
    let totalItemsSold = 0;
    let taxCollected = 0;

    const byType: Record<string, { count: number; revenue: number }> = {
      'dine-in': { count: 0, revenue: 0 },
      delivery: { count: 0, revenue: 0 },
      // Orders are stored as 'pickup'; a 'takeaway' key here kept the Takeaway row at ₹0 forever.
      pickup: { count: 0, revenue: 0 },
    };

    const byPayment: Record<string, { count: number; revenue: number }> = {
      upi: { count: 0, revenue: 0 },
      cash: { count: 0, revenue: 0 },
      card: { count: 0, revenue: 0 },
    };

    const itemRevenueMap = new Map<
      string,
      { name: string; quantity: number; revenue: number; category?: string }
    >();

    const hourlyMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = 0;

    let nonCancelledOrderCount = 0;

    filteredOrders.forEach((o) => {
      const orderTotal = o.total || 0;
      const orderTax = o.tax || 0;

      if (o.status === 'cancelled') {
        cancelledRevenue += orderTotal;
        return;
      }

      nonCancelledOrderCount += 1;
      totalGrossRevenue += orderTotal;
      taxCollected += orderTax;

      if (o.status === 'delivered') {
        realizedRevenue += orderTotal;
      } else {
        inProgressRevenue += orderTotal;
      }

      // Group by order type
      const typeKey = o.orderType || 'dine-in';
      if (!byType[typeKey]) byType[typeKey] = { count: 0, revenue: 0 };
      byType[typeKey].count += 1;
      byType[typeKey].revenue += orderTotal;

      // Group by payment method
      const payKey = o.paymentMethod || 'upi';
      if (!byPayment[payKey]) byPayment[payKey] = { count: 0, revenue: 0 };
      byPayment[payKey].count += 1;
      byPayment[payKey].revenue += orderTotal;

      // Hourly distribution
      try {
        const orderHour = new Date(o.createdAt).getHours();
        hourlyMap[orderHour] = (hourlyMap[orderHour] || 0) + orderTotal;
      } catch {
        // ignore date parse errors
      }

      // Item breakdown
      o.items.forEach((it) => {
        totalItemsSold += it.quantity;
        const existing = itemRevenueMap.get(it.name) || {
          name: it.name,
          quantity: 0,
          revenue: 0,
          category: 'Dish',
        };
        existing.quantity += it.quantity;
        existing.revenue += it.price * it.quantity;
        itemRevenueMap.set(it.name, existing);
      });
    });

    const averageOrderValue =
      nonCancelledOrderCount > 0 ? totalGrossRevenue / nonCancelledOrderCount : 0;

    const dishList = Array.from(itemRevenueMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    return {
      totalGrossRevenue,
      realizedRevenue,
      inProgressRevenue,
      cancelledRevenue,
      totalOrders: filteredOrders.length,
      totalItemsSold,
      taxCollected,
      averageOrderValue,
      byType,
      byPayment,
      dishList,
      hourlyMap,
    };
  }, [filteredOrders]);

  // Export CSV summary
  const handleExportCsv = () => {
    const csvRows = [
      ['Metric', 'Value'],
      ['Time Period', timeRange.toUpperCase()],
      ['Total Recorded Orders', metrics.totalOrders.toString()],
      ['Total Gross Revenue (INR)', `Rs. ${metrics.totalGrossRevenue.toFixed(2)}`],
      ['Realized / Completed Revenue', `Rs. ${metrics.realizedRevenue.toFixed(2)}`],
      ['In Progress Revenue', `Rs. ${metrics.inProgressRevenue.toFixed(2)}`],
      ['Cancelled Revenue', `Rs. ${metrics.cancelledRevenue.toFixed(2)}`],
      ['Average Order Value (AOV)', `Rs. ${metrics.averageOrderValue.toFixed(2)}`],
      ['Total Items Prepared', metrics.totalItemsSold.toString()],
      ['Estimated GST 5%', `Rs. ${metrics.taxCollected.toFixed(2)}`],
      ['', ''],
      ['Top Grossing Dishes', 'Units Sold', 'Total Revenue (INR)'],
      ...metrics.dishList.map((d) => [d.name, d.quantity.toString(), d.revenue.toFixed(2)]),
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      csvRows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OTT_Revenue_Analysis_${timeRange}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="revenue-analysis-page" className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <button
            id="back-to-orders-btn"
            onClick={onBack}
            className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-750 transition-all cursor-pointer shadow-xs"
            title="Back to Orders Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold font-serif text-stone-900 dark:text-stone-100 tracking-tight">
                Revenue &amp; Sales Analysis
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300/40">
                Live Insights
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Comprehensive financial breakdown, sales channels, dish performance &amp; GST overview
            </p>
          </div>
        </div>

        {/* Filter controls & export */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Time range selector */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeRange === 'all'
                  ? 'bg-white dark:bg-stone-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeRange === 'today'
                  ? 'bg-white dark:bg-stone-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeRange === 'week'
                  ? 'bg-white dark:bg-stone-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              Past 7 Days
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeRange === 'month'
                  ? 'bg-white dark:bg-stone-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              This Month
            </button>
          </div>

          <button
            id="export-revenue-csv-btn"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gross Revenue */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent border border-amber-300 dark:border-amber-800/60 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Revenue</span>
            <div className="p-2 rounded-xl bg-amber-500/20">
              <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-stone-900 dark:text-stone-100 tracking-tight">
            ₹{metrics.totalGrossRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
            Across {metrics.totalOrders} total incoming orders
          </p>
        </div>

        {/* Realized / Fulfilled Revenue */}
        <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Fulfilled Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
            ₹{metrics.realizedRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
            Delivered &amp; completed orders
          </p>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Average Order Value</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-stone-900 dark:text-stone-100 tracking-tight">
            ₹{metrics.averageOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
            Avg revenue per guest transaction
          </p>
        </div>

        {/* Items Sold & GST */}
        <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Items Sold</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950">
              <Utensils className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-stone-900 dark:text-stone-100 tracking-tight">
            {metrics.totalItemsSold}
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
            GST Collected: ₹{metrics.taxCollected.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Breakdown by Order Channel & Payment Method */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sales by Dining Channel */}
        <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-600" />
              <span>Revenue by Dining Channel</span>
            </h3>
            <span className="text-xs text-stone-400">Channel split</span>
          </div>

          <div className="space-y-3 pt-2">
            {/* Dine In */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-amber-600" />
                  <span>Dine-In Tables</span>
                </span>
                <span className="font-mono font-bold">
                  ₹{metrics.byType['dine-in']?.revenue.toFixed(0)} ({metrics.byType['dine-in']?.count} order{metrics.byType['dine-in']?.count === 1 ? '' : 's'})
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      metrics.totalGrossRevenue > 0
                        ? ((metrics.byType['dine-in']?.revenue || 0) / metrics.totalGrossRevenue) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Delivery */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-blue-600" />
                  <span>Delivery</span>
                </span>
                <span className="font-mono font-bold">
                  ₹{metrics.byType['delivery']?.revenue.toFixed(0)} ({metrics.byType['delivery']?.count} order{metrics.byType['delivery']?.count === 1 ? '' : 's'})
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      metrics.totalGrossRevenue > 0
                        ? ((metrics.byType['delivery']?.revenue || 0) / metrics.totalGrossRevenue) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Takeaway */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Takeaway / Counter</span>
                </span>
                <span className="font-mono font-bold">
                  ₹{metrics.byType['pickup']?.revenue.toFixed(0)} ({metrics.byType['pickup']?.count} order{metrics.byType['pickup']?.count === 1 ? '' : 's'})
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      metrics.totalGrossRevenue > 0
                        ? ((metrics.byType['pickup']?.revenue || 0) / metrics.totalGrossRevenue) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Revenue by Payment Method */}
        <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Revenue by Payment Method</span>
            </h3>
            <span className="text-xs text-stone-400">Payment split</span>
          </div>

          <div className="space-y-3 pt-2">
            {/* UPI */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  ⚡ UPI / QR Instant Pay
                </span>
                <span className="font-mono font-bold">
                  ₹{metrics.byPayment['upi']?.revenue.toFixed(0)} ({metrics.byPayment['upi']?.count} order{metrics.byPayment['upi']?.count === 1 ? '' : 's'})
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      metrics.totalGrossRevenue > 0
                        ? ((metrics.byPayment['upi']?.revenue || 0) / metrics.totalGrossRevenue) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Cash on Delivery */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  💵 Cash at Counter / COD
                </span>
                <span className="font-mono font-bold">
                  ₹{metrics.byPayment['cash']?.revenue.toFixed(0)} ({metrics.byPayment['cash']?.count} order{metrics.byPayment['cash']?.count === 1 ? '' : 's'})
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      metrics.totalGrossRevenue > 0
                        ? ((metrics.byPayment['cash']?.revenue || 0) / metrics.totalGrossRevenue) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Card */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  💳 Debit / Credit Card
                </span>
                <span className="font-mono font-bold">
                  ₹{metrics.byPayment['card']?.revenue.toFixed(0)} ({metrics.byPayment['card']?.count} order{metrics.byPayment['card']?.count === 1 ? '' : 's'})
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      metrics.totalGrossRevenue > 0
                        ? ((metrics.byPayment['card']?.revenue || 0) / metrics.totalGrossRevenue) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Dishes by Revenue */}
      <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
              Best Selling Dishes &amp; Product Revenue
            </h3>
            <p className="text-xs text-stone-500">
              Ranked by total revenue generated and unit sales volume
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
            {metrics.dishList.length} Unique Dishes Sold
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-400 font-semibold uppercase tracking-wider text-[10.5px]">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Dish / Item Name</th>
                <th className="py-3 px-3 text-center">Units Sold</th>
                <th className="py-3 px-3 text-right">Total Revenue</th>
                <th className="py-3 px-3 text-right">% of Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {metrics.dishList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-stone-400">
                    No sales recorded for selected time period.
                  </td>
                </tr>
              ) : (
                metrics.dishList.map((dish, idx) => {
                  const share =
                    metrics.totalGrossRevenue > 0
                      ? ((dish.revenue / metrics.totalGrossRevenue) * 100).toFixed(1)
                      : '0';

                  return (
                    <tr key={dish.name} className="hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-stone-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-stone-900 dark:text-stone-100">
                        {dish.name}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-stone-700 dark:text-stone-300">
                        {dish.quantity}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        ₹{dish.revenue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-stone-500">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-[10px] font-bold">
                          {share}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
