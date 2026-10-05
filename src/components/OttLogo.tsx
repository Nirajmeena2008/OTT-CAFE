import React from 'react';

interface OttLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  lightText?: boolean;
  onClick?: () => void;
}

export const OttLogo: React.FC<OttLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  lightText = false,
  onClick,
}) => {
  const sizeMap = {
    sm: 'w-7 h-7 sm:w-8 sm:h-8',
    md: 'w-9 h-9 sm:w-11 sm:h-11',
    lg: 'w-12 h-12 sm:w-14 sm:h-14',
    xl: 'w-16 h-16 sm:w-20 sm:h-20',
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <img
        src="/ott-logo.svg"
        alt="Out Of The Town (OTT) Cafe Logo"
        referrerPolicy="no-referrer"
        className={`${sizeMap[size]} shrink-0 drop-shadow-md rounded-full object-contain transition-transform duration-200 group-hover:scale-105`}
      />
      {showText && (
        <div className="leading-tight text-left min-w-0">
          <span
            className={`font-serif font-bold text-sm sm:text-base tracking-tight block truncate ${
              lightText ? 'text-white' : 'text-stone-900 dark:text-stone-100'
            }`}
          >
            Out of the Town
          </span>
          <span
            className={`text-[10px] sm:text-xs font-semibold block tracking-wide truncate ${
              lightText ? 'text-amber-300/90' : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            Restro &amp; Bakery
          </span>
        </div>
      )}
    </div>
  );
};
