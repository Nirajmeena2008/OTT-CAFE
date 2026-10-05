import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

interface ConnectionErrorStateProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

/**
 * Friendly full-page "can't reach the kitchen" state for when the initial menu/category
 * fetch fails (network drop, timeout, server down). Previously a failed fetch just logged to
 * the console and left the page looking like a restaurant with zero dishes -- no explanation,
 * no way to recover short of a manual browser refresh.
 *
 * The illustration is a plain inline SVG (no network request) since this is exactly the
 * screen shown when the network itself is the problem.
 */
export const ConnectionErrorState: React.FC<ConnectionErrorStateProps> = ({ onRetry, isRetrying = false }) => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 text-center">
      <svg
        viewBox="0 0 200 180"
        className="w-48 h-44 sm:w-56 sm:h-52 mb-2 animate-[puppy-bob_2.6s_ease-in-out_infinite]"
        aria-hidden="true"
      >
        {/* Ground shadow */}
        <ellipse cx="100" cy="164" rx="48" ry="8" fill="currentColor" className="text-stone-900/10 dark:text-black/30" />

        {/* Tail, wagging slowly */}
        <path
          d="M 152 118 Q 175 108 172 88"
          stroke="#c2703d"
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
          className="origin-[152px_118px] animate-[puppy-tail_1.1s_ease-in-out_infinite]"
        />

        {/* Body */}
        <ellipse cx="100" cy="128" rx="46" ry="34" fill="#dd9057" />
        <ellipse cx="100" cy="140" rx="30" ry="18" fill="#f3d9b8" />

        {/* Front paws */}
        <ellipse cx="78" cy="158" rx="9" ry="7" fill="#dd9057" />
        <ellipse cx="122" cy="158" rx="9" ry="7" fill="#dd9057" />

        {/* Head */}
        <circle cx="100" cy="78" r="40" fill="#e2a06a" />
        {/* Ears, drooping (a little sad/confused) */}
        <path d="M 66 58 Q 46 66 54 98 Q 68 92 74 68 Z" fill="#c2703d" />
        <path d="M 134 58 Q 154 66 146 98 Q 132 92 126 68 Z" fill="#c2703d" />
        {/* Muzzle */}
        <ellipse cx="100" cy="92" rx="20" ry="14" fill="#f3d9b8" />
        <ellipse cx="100" cy="86" rx="6" ry="4.5" fill="#5b3a29" />

        {/* Confused/sad eyes (curved, looking up) */}
        <path d="M 82 72 Q 86 66 92 71" stroke="#3d2a1e" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M 108 71 Q 114 66 118 72" stroke="#3d2a1e" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Little worried brow */}
        <path d="M 78 64 Q 84 60 90 63" stroke="#3d2a1e" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />

        {/* Wifi-off signal above head */}
        <g transform="translate(122, 24)" className="text-stone-400 dark:text-stone-500">
          <path
            d="M -14 14 Q 0 0 14 14"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.55"
          />
          <path
            d="M -7 20 Q 0 13 7 20"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
          <circle cx="0" cy="27" r="2.6" fill="currentColor" />
          <line x1="-18" y1="-4" x2="18" y2="30" stroke="#ec2f56" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>

      <style>{`
        @keyframes puppy-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes puppy-tail { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-12deg); } }
      `}</style>

      <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100 mt-2">
        Oops, we lost the signal to the kitchen
      </h2>
      <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mt-1.5">
        This usually means a slow or dropped connection. Give it another try -- your menu will be right back.
      </p>

      <button
        id="btn-retry-connection"
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-candy-cherry-500 to-amber-500 hover:from-candy-cherry-600 hover:to-amber-600 disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-candy-cherry-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
      >
        <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
        <span>{isRetrying ? 'Reconnecting...' : 'Try Again'}</span>
      </button>

      <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-stone-400 dark:text-stone-600">
        <WifiOff className="w-3.5 h-3.5" />
        <span>Check your internet connection if this keeps happening</span>
      </div>
    </div>
  );
};
