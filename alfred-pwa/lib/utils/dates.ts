import { format, formatDistanceToNow, parseISO, startOfDay, endOfDay } from 'date-fns';
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
  const today = startOfDay(new Date());
  const dateDay = startOfDay(d);

  const diffDays = Math.floor((today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return format(d, 'EEEE');

  return format(d, 'MMM d, yyyy');
}

export function groupByDate<T extends { created_at?: string; conversation_date?: string; summary_date?: string }>(
  items: T[],
  dateField: 'created_at' | 'conversation_date' | 'summary_date' = 'created_at'
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  items.forEach(item => {
    const dateValue = item[dateField];
    if (!dateValue) return;

    const dateKey = format(parseISO(dateValue), 'yyyy-MM-dd');
    const existing = groups.get(dateKey) || [];
    existing.push(item);
    groups.set(dateKey, existing);
  });

  return groups;
}
