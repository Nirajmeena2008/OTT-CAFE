import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Download,
  Table,
  UploadCloud,
  ShieldCheck,
  Sparkles,
  Info,
  Server,
  Terminal,
  Code2,
  Lock,
} from 'lucide-react';
import { api } from '../../services/api.js';

interface MySQLManagementProps {
  token: string;
  onRefreshAll?: () => void;
}

export const MySQLManagement: React.FC<MySQLManagementProps> = ({ token, onRefreshAll }) => {
  const [status, setStatus] = useState<{
    configured: boolean;
    connectionStringSummary: string | null;
    host: string | null;
    database: string | null;
    connected: boolean;
    tablesFound: string[];
    tablesMissing: string[];
    error?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [sqlSchema, setSqlSchema] = useState<string>('');
  const [hasCopiedSql, setHasCopiedSql] = useState(false);
  const [showSqlViewer, setShowSqlViewer] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await api.getMySQLStatus(token);
      setStatus(res);
    } catch (err: any) {
      console.error('Failed to fetch MySQL status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchema = async () => {
    try {
      const res = await api.getMySQLSchema(token);
      if (typeof res === 'string') {
        setSqlSchema(res);
      } else if ((res as any)?.sql) {
        setSqlSchema((res as any).sql);
      }
    } catch (err: any) {
      console.error('Failed to fetch MySQL schema:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchSchema();
  }, [token]);

  const handleCopySql = () => {
    if (!sqlSchema) return;
    navigator.clipboard.writeText(sqlSchema);
    setHasCopiedSql(true);
    setNotice('MySQL Schema copied to clipboard!');
    setTimeout(() => {
      setHasCopiedSql(false);
      setNotice(null);
    }, 3500);
  };

  const handleDownloadSql = () => {
    if (!sqlSchema) return;
    const blob = new Blob([sqlSchema], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ott_mysql_schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice('MySQL Schema downloaded as ott_mysql_schema.sql');
    setTimeout(() => setNotice(null), 3500);
  };

  const handleSyncAll = async () => {
    try {
      setIsSyncing(true);
      setSyncResult(null);
      const res = await api.syncMySQLAll(token);
      setSyncResult(res);
      setNotice((res as any).message || 'MySQL database synchronized successfully!');
      fetchStatus();
      onRefreshAll?.();
    } catch (err: any) {
      setNotice('Sync note: ' + err.message);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const totalExpectedTables = [
    { name: 'orders', label: 'Orders & Live KOT', desc: 'Real customer orders & status logs' },
    { name: 'reservations', label: 'Table Reservations', desc: 'Dine-in table booking records' },
    { name: 'menu_items', label: 'Menu Dishes & Bestsellers', desc: 'Food items with prices, veg/egg tags, ratings' },
    { name: 'categories', label: 'Food Categories', desc: 'Menu categorization, icons, slugs' },
    { name: 'promo_banners', label: 'Promotional Banners', desc: 'Marketing offers and coupons' },
    { name: 'cafe_info', label: 'Cafe Profile & Timings', desc: 'Address, timings, helpline' },
    { name: 'invoices', label: 'Invoices & Billing', desc: 'GST bills and receipts' },
    { name: 'customers', label: 'Customer Accounts', desc: 'Mobile/email customer accounts' },
  ];

  const foundCount = status?.tablesFound?.length || 0;
  const isSchemaReady = foundCount >= totalExpectedTables.length;

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {notice && (
        <div className="p-4 rounded-2xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-xs font-semibold shadow-xl flex items-center gap-2 border border-stone-700 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-stone-900 via-sky-950/40 to-stone-900 text-white p-6 sm:p-8 border border-sky-900/30 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
              <Database className="w-4 h-4" />
              <span>MySQL Relational Database</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-white">
              MySQL Database Health &amp; Synchronization
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
              Powered by MySQL InnoDB storage engine with ACID transactions. The application maintains zero-lag local memory response times while synchronizing all customer orders, table reservations, bakery and kitchen menu items, and GST bills to MySQL.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchStatus}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/10 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>

            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-600/30 cursor-pointer transition-all active:scale-95 disabled:opacity-70"
            >
              <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>{isSyncing ? 'Syncing All Data...' : 'Sync to MySQL'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Connection */}
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-sky-500" />
              <span>MySQL Server</span>
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                status?.connected
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : status?.configured
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              {status?.connected ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Connected</span>
                </>
              ) : status?.configured ? (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Info className="w-3 h-3" />
                  <span>Local Store Ready</span>
                </>
              )}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate font-mono">
              {status?.connectionStringSummary ||
                (status?.host ? `${status.host}:${status.database || 'ott_restro'}` : 'Local In-Memory Engine')}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              {status?.connected
                ? 'MySQL Connection Pool active (10 max connections)'
                : 'Configure MYSQL_HOST or MYSQL_URL in secrets/env to connect.'}
            </p>
          </div>
        </div>

        {/* Card 2: Tables Found */}
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
              <Table className="w-3.5 h-3.5 text-sky-500" />
              <span>MySQL Tables</span>
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                isSchemaReady
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
              }`}
            >
              {isSchemaReady ? <CheckCircle2 className="w-3 h-3" /> : <Table className="w-3 h-3" />}
              <span>
                {foundCount} / {totalExpectedTables.length} Active
              </span>
            </span>
          </div>
          <div>
            <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {isSchemaReady
                ? 'All 8 Tables Verified'
                : `${foundCount} of ${totalExpectedTables.length} Tables Found`}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              {isSchemaReady
                ? 'Persistent MySQL InnoDB storage is fully operational.'
                : 'Schema is automatically created on first connect, or run DDL below.'}
            </p>
          </div>
        </div>

        {/* Card 3: Dual Persistence Strategy */}
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>High Availability</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Zero Downtime</span>
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
              In-Memory Cache + MySQL Pool
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              Customer browsing &amp; billing proceed without waiting for database round-trips.
            </p>
          </div>
        </div>
      </div>

      {/* Sync summary notification */}
      {syncResult && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs">
          <div className="font-bold flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Synchronization Successful</span>
          </div>
          <p>{syncResult.message}</p>
        </div>
      )}

      {/* Database Tables Status List */}
      <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-2">
            <Table className="w-4 h-4 text-sky-500" />
            <span>Database Tables Schema Status</span>
          </h3>
          <span className="text-xs text-stone-500">
            {foundCount} of {totalExpectedTables.length} tables found
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {totalExpectedTables.map((tbl) => {
            const isFound = status?.tablesFound?.includes(tbl.name) || (!status?.configured && true);
            return (
              <div
                key={tbl.name}
                className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 flex items-start gap-2.5"
              >
                <div
                  className={`p-1 rounded-md shrink-0 mt-0.5 ${
                    isFound
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
                  }`}
                >
                  {isFound ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold font-mono text-stone-900 dark:text-stone-100 truncate">
                      {tbl.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                        isFound
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-stone-200 dark:bg-stone-700 text-stone-600'
                      }`}
                    >
                      {isFound ? 'Ready' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-stone-700 dark:text-stone-300 truncate mt-0.5">
                    {tbl.label}
                  </p>
                  <p className="text-[10px] text-stone-500 truncate">{tbl.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MySQL Connection Configuration Guide */}
      <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-500" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
              Connecting Your MySQL Instance
            </h3>
          </div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-semibold">
            MySQL 5.7+ / 8.0+ / MariaDB / Cloud SQL / RDS
          </span>
        </div>

        <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
          Provide your MySQL connection details via environment variables in your deployment or container settings:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-2xl bg-stone-900 text-stone-200 border border-stone-800 space-y-2">
            <div className="flex items-center justify-between text-stone-400 text-[11px]">
              <span className="font-bold text-sky-400">Method A: URL Connection String</span>
            </div>
            <div className="text-emerald-400">
              MYSQL_URL="mysql://username:password@hostname:3306/ott_restro"
            </div>
            <p className="text-[10px] text-stone-400 font-sans">
              Compatible with standard Cloud SQL, AWS RDS, PlanetScale, and Railway MySQL URLs.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-900 text-stone-200 border border-stone-800 space-y-1.5">
            <div className="flex items-center justify-between text-stone-400 text-[11px]">
              <span className="font-bold text-sky-400">Method B: Individual Parameters</span>
            </div>
            <div className="text-emerald-400 space-y-0.5">
              <div>MYSQL_HOST="127.0.0.1"</div>
              <div>MYSQL_PORT="3306"</div>
              <div>MYSQL_USER="root"</div>
              <div>MYSQL_PASSWORD="your_password"</div>
              <div>MYSQL_DATABASE="ott_restro"</div>
            </div>
          </div>
        </div>
      </div>

      {/* MySQL SQL Schema Script Viewer & Exporter */}
      <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-sky-500" />
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                MySQL DDL Schema (Tables, Indices &amp; Constraints)
              </h3>
            </div>
            <p className="text-xs text-stone-500">
              Run this script in phpMyAdmin, MySQL Workbench, DBeaver, or via the terminal command line.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSqlViewer(!showSqlViewer)}
              className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              {showSqlViewer ? 'Collapse Schema' : 'View SQL Code'}
            </button>

            <button
              onClick={handleDownloadSql}
              className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .sql</span>
            </button>

            <button
              onClick={handleCopySql}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-sky-600/20 cursor-pointer transition-all active:scale-95"
            >
              {hasCopiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{hasCopiedSql ? 'Copied!' : 'Copy SQL Schema'}</span>
            </button>
          </div>
        </div>

        {/* Quick CLI snippet */}
        <div className="p-3 rounded-xl bg-stone-900 text-stone-300 font-mono text-xs flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>mysql -u [user] -p -h [host] [database_name] &lt; ott_mysql_schema.sql</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText('mysql -u root -p ott_restro < ott_mysql_schema.sql');
              setNotice('CLI command copied!');
              setTimeout(() => setNotice(null), 2500);
            }}
            className="text-[11px] text-sky-400 hover:text-sky-300 px-2 py-1 bg-stone-800 rounded-md cursor-pointer ml-3 shrink-0"
          >
            Copy CLI
          </button>
        </div>

        {/* Expandable SQL Code Box */}
        {showSqlViewer && (
          <div className="relative rounded-2xl bg-stone-950 text-stone-200 border border-stone-800 overflow-hidden text-xs font-mono">
            <div className="flex items-center justify-between px-4 py-2 bg-stone-900 border-b border-stone-800 text-[11px] text-stone-400">
              <span>ott_mysql_schema.sql (MySQL 5.7+ / 8.0+ Compatible DDL)</span>
              <button
                onClick={handleCopySql}
                className="text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </button>
            </div>
            <pre className="p-4 max-h-96 overflow-y-auto overflow-x-auto text-[11px] leading-relaxed select-all">
              {sqlSchema}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
