import { formatDistanceToNow, parseISO, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Chicago'; // Central Time

export function formatDate(date: string | Date, formatStr: string = 'PPP'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, TIMEZONE, formatStr);
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatDateCentral(date: string | Date, formatStr: string = 'PPP'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, TIMEZONE, formatStr);
}

export function getTodayCentral(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

export function getStartOfDayCentral(date: Date): Date {
  const zonedDate = toZonedTime(date, TIMEZONE);
  return startOfDay(zonedDate);
}

export function getEndOfDayCentral(date: Date): Date {
  const zonedDate = toZonedTime(date, TIMEZONE);
  return endOfDay(zonedDate);
}

export function formatTimeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return formatDate(d, 'MMM d');
}

export function getDayLabel(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;

  // Get today's date in Central Time
  const todayStr = formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');

  // Get the date string in Central Time
  const dateStr = formatInTimeZone(d, TIMEZONE, 'yyyy-MM-dd');

  // Parse as dates for comparison
  const todayDate = new Date(todayStr);
  const inputDate = new Date(dateStr);

  const diffDays = Math.floor((todayDate.getTime() - inputDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return formatInTimeZone(d, TIMEZONE, 'EEEE');

  return formatInTimeZone(d, TIMEZONE, 'MMM d, yyyy');
}

/**
 * Get UTC boundaries for a Central Time date
 * Returns start and end of day in Central Time, converted to UTC ISO strings
 */
export function getCentralDayBoundariesUTC(dateStr: string): { startUTC: string; endUTC: string } {
  // dateStr is in format 'yyyy-MM-dd'
  const [year, month, day] = dateStr.split('-').map(Number);

  // Get timezone offset for this date (handles DST automatically)
  const tzOffset = getTimezoneOffset(TIMEZONE, new Date(year, month - 1, day));

  // Create UTC dates that correspond to Central Time boundaries
  // When it's midnight Central, add the offset to get UTC
  const startUTCDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) + tzOffset);
  const endUTCDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) + tzOffset);

  return {
    startUTC: startUTCDate.toISOString(),
    endUTC: endUTCDate.toISOString(),
  };
}

// Helper to get timezone offset in milliseconds
function getTimezoneOffset(timeZone: string, date: Date): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
  return (utcDate.getTime() - tzDate.getTime());
}

export function groupByDate<T extends { created_at?: string; conversation_date?: string; summary_date?: string; date?: string }>(
  items: T[],
  dateField: 'created_at' | 'conversation_date' | 'summary_date' | 'date' = 'created_at'
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  items.forEach(item => {
    const dateValue = item[dateField];
    if (!dateValue) return;

    // Use Central Time for date grouping
    const dateKey = formatInTimeZone(parseISO(dateValue), TIMEZONE, 'yyyy-MM-dd');
    const existing = groups.get(dateKey) || [];
    existing.push(item);
    groups.set(dateKey, existing);
  });

  return groups;
}
