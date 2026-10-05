import React, { useMemo } from 'react';
import { getActiveSeasonalTheme } from '../utils/season';

/**
 * Ambient, site-wide festive decoration for the current Indian festival season (Diwali,
 * Christmas/New Year, Holi) -- see utils/season.ts for the date windows and the `?season=`
 * override. Deliberately sparse and slow: a handful of small particles, CSS-only animation
 * (transform/opacity, GPU-cheap), `pointer-events-none` throughout, so it reads as ambience
 * rather than something that fights the site's "smooth, eye-soothing" feel or blocks taps.
 * Outside all three windows it renders nothing.
 */
export const SeasonalDecor: React.FC = () => {
  const theme = useMemo(() => getActiveSeasonalTheme(), []);

  if (!theme) return null;

  // Deterministic-but-varied per-particle placement/timing (no Math.random on every render).
  const particles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        left: (i * 9.7 + 3) % 100,
        delay: (i * 1.37) % 8,
        duration: 9 + ((i * 2.3) % 6),
        size: 6 + ((i * 3) % 7),
      })),
    []
  );

  return (
    <div className="fixed inset-0 z-30 overflow-hidden pointer-events-none" aria-hidden="true">
      <style>{`
        @keyframes seasonal-fall {
          0% { transform: translateY(-8vh) translateX(0) rotate(0deg); opacity: 0; }
          8% { opacity: var(--seasonal-opacity, 0.8); }
          92% { opacity: var(--seasonal-opacity, 0.8); }
          100% { transform: translateY(108vh) translateX(var(--seasonal-drift, 20px)) rotate(180deg); opacity: 0; }
        }
        @keyframes seasonal-rise {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { opacity: var(--seasonal-opacity, 0.55); }
          85% { opacity: var(--seasonal-opacity, 0.55); }
          100% { transform: translateY(-92vh) scale(1); opacity: 0; }
        }
        @keyframes seasonal-twinkle {
          0%, 100% { opacity: 0.35; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>

      {theme === 'diwali' && (
        <>
          {/* Warm diya glow along the very top edge */}
          <div className="absolute top-0 inset-x-0 h-1 flex justify-around px-4">
            {particles.slice(0, 8).map((p, i) => (
              <span
                key={`diya-${i}`}
                className="block w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_3px_rgba(245,165,36,0.55)]"
                style={{
                  animation: `seasonal-twinkle ${2.4 + (i % 3) * 0.5}s ease-in-out infinite`,
                  animationDelay: `${p.delay * 0.3}s`,
                }}
              />
            ))}
          </div>
          {/* Slow-drifting golden sparks */}
          {particles.map((p, i) => (
            <span
              key={`spark-${i}`}
              className="absolute rounded-full bg-gradient-to-br from-amber-300 to-candy-cherry-400"
              style={{
                left: `${p.left}%`,
                width: `${p.size * 0.6}px`,
                height: `${p.size * 0.6}px`,
                ['--seasonal-opacity' as any]: 0.5,
                ['--seasonal-drift' as any]: `${(i % 2 === 0 ? 1 : -1) * 24}px`,
                animation: `seasonal-fall ${p.duration}s linear infinite`,
                animationDelay: `${p.delay}s`,
                boxShadow: '0 0 6px 2px rgba(245,165,36,0.5)',
              }}
            />
          ))}
        </>
      )}

      {theme === 'christmas' && (
        <>
          {particles.map((p, i) => (
            <span
              key={`snow-${i}`}
              className="absolute rounded-full bg-white dark:bg-stone-200"
              style={{
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                ['--seasonal-opacity' as any]: 0.75,
                ['--seasonal-drift' as any]: `${(i % 2 === 0 ? 1 : -1) * 40}px`,
                animation: `seasonal-fall ${p.duration + 3}s linear infinite`,
                animationDelay: `${p.delay}s`,
                filter: 'blur(0.3px)',
              }}
            />
          ))}
        </>
      )}

      {theme === 'holi' && (
        <>
          {particles.map((p, i) => {
            const colors = ['#ec2f56', '#f5a524', '#22c55e', '#3b82f6', '#d946ef'];
            const color = colors[i % colors.length];
            return (
              <span
                key={`gulal-${i}`}
                className="absolute rounded-full blur-[2px]"
                style={{
                  left: `${p.left}%`,
                  bottom: 0,
                  width: `${p.size + 6}px`,
                  height: `${p.size + 6}px`,
                  backgroundColor: color,
                  ['--seasonal-opacity' as any]: 0.4,
                  animation: `seasonal-rise ${p.duration + 2}s ease-in infinite`,
                  animationDelay: `${p.delay}s`,
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
};
