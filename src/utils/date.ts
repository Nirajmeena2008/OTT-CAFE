/**
 * Local (not UTC) YYYY-MM-DD. `Date#toISOString()` converts to UTC first, which lands on a
 * different calendar day than the caller's local date for part of every day in any timezone
 * ahead of UTC -- all of India (UTC+5:30) included, roughly 12:00am-5:29am IST. Using it for
 * "today"/"tomorrow" date-only calculations let date pickers accept, or default to, a day that
 * had already fully elapsed in the customer's local time.
 */
export const toLocalDateString = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
