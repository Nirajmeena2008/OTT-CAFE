import React from 'react';

/**
 * Cute "hungry" mascot for the empty-cart state -- replaces the generic shopping-bag icon
 * with something that actually communicates "empty" in a way that fits a food brand: a
 * round, big-eyed character with a rumbling tummy, bouncing gently.
 */
export const HungryCartIllustration: React.FC = () => {
  return (
    <svg viewBox="0 0 200 180" className="w-32 h-32 sm:w-36 sm:h-36" aria-hidden="true">
      <ellipse cx="100" cy="162" rx="42" ry="7" fill="currentColor" className="text-stone-900/10 dark:text-black/30" />

      <g className="origin-[100px_150px] animate-[hungry-bounce_1.8s_ease-in-out_infinite]">
        {/* Body */}
        <circle cx="100" cy="95" r="52" fill="#f5b649" />
        <circle cx="100" cy="95" r="52" fill="url(#hungryShine)" opacity="0.5" />

        {/* Rosy cheeks */}
        <circle cx="62" cy="102" r="8" fill="#ec2f56" opacity="0.35" />
        <circle cx="138" cy="102" r="8" fill="#ec2f56" opacity="0.35" />

        {/* Big hungry eyes */}
        <ellipse cx="80" cy="84" rx="7" ry="9" fill="#3d2a1e" />
        <ellipse cx="120" cy="84" rx="7" ry="9" fill="#3d2a1e" />
        <circle cx="82.5" cy="80.5" r="2.2" fill="#fff" />
        <circle cx="122.5" cy="80.5" r="2.2" fill="#fff" />

        {/* Open, wanting-food mouth */}
        <ellipse cx="100" cy="112" rx="14" ry="11" fill="#7a3a1d" />
        <path d="M 88 112 Q 100 122 112 112" stroke="#3d2a1e" strokeWidth="0" fill="#c0522a" opacity="0.6" />

        {/* Little arms reaching out */}
        <ellipse cx="46" cy="108" rx="9" ry="6" fill="#f5b649" transform="rotate(-20 46 108)" />
        <ellipse cx="154" cy="108" rx="9" ry="6" fill="#f5b649" transform="rotate(20 154 108)" />
      </g>

      {/* Empty plate underneath, tipped over */}
      <ellipse cx="100" cy="150" rx="26" ry="7" fill="none" stroke="#d6d3d1" strokeWidth="4" />

      {/* Hungry "..." rumble marks */}
      <g className="animate-[hungry-fade_1.8s_ease-in-out_infinite]">
        <circle cx="146" cy="56" r="3" fill="#ec2f56" />
        <circle cx="158" cy="46" r="2.4" fill="#ec2f56" />
        <circle cx="168" cy="38" r="1.8" fill="#ec2f56" />
      </g>

      <defs>
        <radialGradient id="hungryShine" cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <style>{`
        @keyframes hungry-bounce { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-8px) rotate(-2deg); } }
        @keyframes hungry-fade { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.25; } }
      `}</style>
    </svg>
  );
};
