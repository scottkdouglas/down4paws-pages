/**
 * Date helpers. Every function takes an explicit IANA timezone so the hub
 * renders the client's calendar, not the build machine's.
 *
 * Content dates come from date-only strings ("2026-09-27"), which parse to
 * midnight UTC. Reading those through a zone west of UTC would shift them a day
 * backwards, so a value sitting exactly on midnight UTC is treated as a plain
 * calendar date and read in UTC. Real timestamps still render in the hub zone.
 */

const MS_PER_DAY = 86_400_000;

function isDateOnly(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

function zoneFor(d: Date, tz: string): string {
  return isDateOnly(d) ? 'UTC' : tz;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? '';
}

/** YYYY-MM-DD for the given instant, read in `tz`. */
export function toISODate(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zoneFor(d, tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

/** Today's date in `tz` as YYYY-MM-DD. */
export function todayIn(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

/** True when a due date has already passed in `tz` and the item is not done. */
export function isOverdue(due: Date | undefined, done: boolean, tz: string): boolean {
  if (!due || done) return false;
  return toISODate(due, tz) < todayIn(tz);
}

/** "Sep 27" */
export function fmtDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zoneFor(d, tz),
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/** "Sep 27, 2026" */
export function fmtDateLong(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zoneFor(d, tz),
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/** Whole calendar days from `a` to `b`. Negative when `b` is earlier. */
export function daysBetween(a: Date, b: Date): number {
  const startOfDay = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((startOfDay(b) - startOfDay(a)) / MS_PER_DAY);
}
