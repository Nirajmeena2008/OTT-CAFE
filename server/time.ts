// The restaurant runs on India time, but the server does not: on AWS the process clock is UTC,
// 5.5 hours behind. Anything that means "today", "now" or a wall-clock time for customers or
// staff must go through these helpers instead of `new Date().getDate()` / `toLocaleTimeString()`.
export const RESTAURANT_TIME_ZONE = 'Asia/Kolkata';

// YYYY-MM-DD for the restaurant's calendar day.
export function restaurantDateString(date: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTAURANT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Minutes since midnight on the restaurant's clock.
export function restaurantMinutesOfDay(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RESTAURANT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  return hour * 60 + minute;
}

// "08:15 PM" on the restaurant's clock.
export function formatRestaurantTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: RESTAURANT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Parses a reservation slot such as "07:30 PM" (the format ReservationModal sends) or "19:30".
// Returns null when the string isn't a real time of day.
export function slotToMinutes(slot: string): number | null {
  const m = slot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  if (minutes > 59) return null;
  if (m[3]) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

// Adds whole days to a YYYY-MM-DD string (calendar arithmetic, no timezone involved).
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
