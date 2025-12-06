import { formatDistanceToNow, parseISO, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Chicago'; // Central Time
// Use UTC for formatting since DB stores Central Time values labeled as UTC
const DISPLAY_TIMEZONE = 'UTC';

/**
 * Normalize a date string from the database for parsing.
 *
 * IMPORTANT: Our database stores Central Time values with a +00 suffix.
 * For example, '2025-12-05 23:08:08+00' actually means 11:08 PM Central on Dec 5.
 * The +00 is a LIE - the value is actually Central Time.
 *
 * We normalize to ISO format and keep as UTC for consistent display.
 */
function normalizeTimestamp(dateStr: string): string {
  // Replace space with T for ISO compatibility
  let normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');

  // Ensure we have a timezone suffix for consistent parsing
  // If no timezone, add Z (UTC) since our DB values are labeled as UTC
  if (!normalized.match(/[+-]\d{2}(:\d{2})?$/) && !normalized.endsWith('Z')) {
    normalized += 'Z';
  }

  // Normalize +00 to Z for consistency
  normalized = normalized.replace(/\+00(:00)?$/, 'Z');

  return normalized;
}

/**
 * Parse a date string from the database into a Date object.
 */
function parseTimestamp(dateStr: string): Date {
  return parseISO(normalizeTimestamp(dateStr));
}

export function formatDate(date: string | Date, formatStr: string = 'PPP'): string {
  const d = typeof date === 'string' ? parseTimestamp(date) : date;
  // Format in UTC since DB stores Central Time values as UTC
  return formatInTimeZone(d, DISPLAY_TIMEZONE, formatStr);
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseTimestamp(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatDateCentral(date: string | Date, formatStr: string = 'PPP'): string {
  const d = typeof date === 'string' ? parseTimestamp(date) : date;
  // Format in UTC since DB stores Central Time values labeled as UTC
  return formatInTimeZone(d, DISPLAY_TIMEZONE, formatStr);
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
  const d = typeof date === 'string' ? parseTimestamp(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return formatDate(d, 'MMM d');
}

export function getDayLabel(date: string | Date): string {
  const d = typeof date === 'string' ? parseTimestamp(date) : date;

  // Get today's date in Central Time (actual current time)
  const todayStr = formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');

  // Get the date string from DB value (format in UTC since DB stores Central as UTC)
  const dateStr = formatInTimeZone(d, DISPLAY_TIMEZONE, 'yyyy-MM-dd');

  // Parse as dates for comparison
  const todayDate = new Date(todayStr);
  const inputDate = new Date(dateStr);

  const diffDays = Math.floor((todayDate.getTime() - inputDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return formatInTimeZone(d, DISPLAY_TIMEZONE, 'EEEE');

  return formatInTimeZone(d, DISPLAY_TIMEZONE, 'MMM d, yyyy');
}

/**
 * Get date boundaries for querying transcriptions
 * Since DB stores Central Time directly, we just need start/end of that day
 */
export function getCentralDayBoundaries(dateStr: string): { start: string; end: string } {
  // dateStr is in format 'yyyy-MM-dd'
  return {
    start: `${dateStr}T00:00:00.000`,
    end: `${dateStr}T23:59:59.999`,
  };
}

// Keep old function name for compatibility but redirect to new one
export function getCentralDayBoundariesUTC(dateStr: string): { startUTC: string; endUTC: string } {
  const { start, end } = getCentralDayBoundaries(dateStr);
  return { startUTC: start, endUTC: end };
}

export function groupByDate<T extends { created_at?: string; conversation_date?: string; summary_date?: string; date?: string }>(
  items: T[],
  dateField: 'created_at' | 'conversation_date' | 'summary_date' | 'date' = 'created_at'
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  items.forEach(item => {
    const dateValue = item[dateField];
    if (!dateValue) return;

    // Parse the timestamp and format in UTC (since DB stores Central Time as UTC)
    const parsed = parseTimestamp(dateValue);
    const dateKey = formatInTimeZone(parsed, DISPLAY_TIMEZONE, 'yyyy-MM-dd');

    // Debug: log first item's conversion
    if (groups.size === 0) {
      console.log('[groupByDate] Sample:', {
        input: dateValue,
        dateKey: dateKey
      });
    }

    const existing = groups.get(dateKey) || [];
    existing.push(item);
    groups.set(dateKey, existing);
  });

  return groups;
}
