export type SeasonalTheme = 'diwali' | 'christmas' | 'holi' | null;

/**
 * Which festive decor (if any) should be showing right now. Indian festivals (Diwali, Holi)
 * follow a lunisolar calendar and shift every year, so exact day-precision isn't feasible here
 * without a maintained almanac -- these are deliberately generous calendar-month windows
 * (roughly "Diwali season", not the single Diwali night) so the decor is never off by a
 * wildly wrong amount even without updating this file annually.
 *
 * `?season=diwali|christmas|holi|off` overrides the date check, e.g. for a preview link or to
 * kick off a festival's decor a few days early for marketing -- `off` forces plain/no decor.
 */
export function getActiveSeasonalTheme(now: Date = new Date()): SeasonalTheme {
  if (typeof window !== 'undefined') {
    const override = new URLSearchParams(window.location.search).get('season');
    if (override === 'off') return null;
    if (override === 'diwali' || override === 'christmas' || override === 'holi') return override;
  }

  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  // Diwali / festive-lights season: Oct 1 - Nov 15
  if ((month === 10) || (month === 11 && day <= 15)) return 'diwali';

  // Christmas & New Year: Dec 10 - Jan 5
  if ((month === 12 && day >= 10) || (month === 1 && day <= 5)) return 'christmas';

  // Holi / spring color season: Mar 1 - Mar 20
  if (month === 3 && day <= 20) return 'holi';

  return null;
}
