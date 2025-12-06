import { createClient } from '@/lib/supabase/server';
import { Entity, Transcription } from '@/types/database';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays, startOfDay, endOfDay } from 'date-fns';

const TIMEZONE = 'America/Chicago';

// Parse date-related queries to extract date ranges
function parseDateRange(query: string): { startDate: Date; endDate: Date } | null {
  const now = new Date();
  const lowerQuery = query.toLowerCase();

  // "last X days" or "past X days"
  const daysMatch = lowerQuery.match(/(?:last|past)\s+(\d+|five|four|three|two|seven|ten|thirty)\s+days?/);
  if (daysMatch) {
    const numMap: Record<string, number> = {
      'two': 2, 'three': 3, 'four': 4, 'five': 5, 'seven': 7, 'ten': 10, 'thirty': 30
    };
    const numDays = numMap[daysMatch[1]] || parseInt(daysMatch[1], 10);
    if (!isNaN(numDays)) {
      return {
        startDate: startOfDay(subDays(now, numDays)),
        endDate: endOfDay(now),
      };
    }
  }

  // "last week" or "past week"
  if (/(?:last|past)\s+week/.test(lowerQuery)) {
    return {
      startDate: startOfDay(subDays(now, 7)),
      endDate: endOfDay(now),
    };
  }

  // "last month" or "past month"
  if (/(?:last|past)\s+month/.test(lowerQuery)) {
    return {
      startDate: startOfDay(subDays(now, 30)),
      endDate: endOfDay(now),
    };
  }

  // "yesterday"
  if (/yesterday/.test(lowerQuery)) {
    const yesterday = subDays(now, 1);
    return {
      startDate: startOfDay(yesterday),
      endDate: endOfDay(yesterday),
    };
  }

  // "today"
  if (/\btoday\b/.test(lowerQuery)) {
    return {
      startDate: startOfDay(now),
      endDate: endOfDay(now),
    };
  }

  // "this week"
  if (/this\s+week/.test(lowerQuery)) {
    return {
      startDate: startOfDay(subDays(now, 7)),
      endDate: endOfDay(now),
    };
  }

  return null;
}

export async function getAboutMe(userId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('user_profiles')
    .select('about_me')
    .eq('user_id', userId)
    .single();

  return data?.about_me || null;
}

export async function getEntities(userId: string): Promise<Entity[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('entities')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  return data || [];
}

export async function searchTranscriptions(
  userId: string,
  query: string,
  limit: number = 50
): Promise<Transcription[]> {
  const supabase = await createClient();

  // Extract potential entity names or keywords from the query
  const words = query.toLowerCase().split(/\s+/);

  // First try full-text search
  const { data: searchResults } = await supabase
    .from('transcriptions')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .textSearch('search_vector', words.join(' | '), {
      type: 'websearch',
      config: 'english',
    })
    .order('date', { ascending: false })
    .limit(limit);

  if (searchResults && searchResults.length > 0) {
    return searchResults;
  }

  // Fallback to ILIKE search for entity names
  const { data: entityData } = await supabase
    .from('entities')
    .select('name')
    .eq('user_id', userId);

  const entityNames = entityData?.map(e => e.name.toLowerCase()) || [];
  const mentionedEntities = words.filter(w => entityNames.includes(w));

  if (mentionedEntities.length > 0) {
    const { data: entityResults } = await supabase
      .from('transcriptions')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .or(mentionedEntities.map(e => `transcription.ilike.%${e}%`).join(','))
      .order('date', { ascending: false })
      .limit(limit);

    return entityResults || [];
  }

  // Last resort: get recent transcriptions
  const { data: recentResults } = await supabase
    .from('transcriptions')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('date', { ascending: false })
    .limit(30);

  return recentResults || [];
}

export async function getTranscriptionsForDate(
  userId: string,
  date: Date
): Promise<Transcription[]> {
  const supabase = await createClient();

  // Format the date in Central Time to get the correct calendar day
  // This matches how transcriptions are stored (Central Time with Z suffix)
  const centralDateStr = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');

  // Create start and end of day boundaries in Central Time format
  // These match the "fake UTC" format used by the webhook server
  const dayStart = `${centralDateStr}T00:00:00Z`;
  const dayEnd = `${centralDateStr}T23:59:59.999Z`;

  const { data } = await supabase
    .from('transcriptions')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .gte('date', dayStart)
    .lte('date', dayEnd)
    .order('date');

  return data || [];
}

export async function getTranscriptionsForDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Transcription[]> {
  const supabase = await createClient();

  // Format dates in Central Time to match storage format
  const startStr = formatInTimeZone(startDate, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
  const endStr = formatInTimeZone(endDate, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

  const { data } = await supabase
    .from('transcriptions')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date');

  return data || [];
}

export interface FullContext {
  aboutMe: string | null;
  entities: Entity[];
  transcriptions: Transcription[];
}

export async function buildFullContext(
  userId: string,
  query: string
): Promise<FullContext> {
  // Check if the query contains a date range
  const dateRange = parseDateRange(query);

  // Fetch about me and entities in parallel
  const [aboutMe, entities] = await Promise.all([
    getAboutMe(userId),
    getEntities(userId),
  ]);

  let transcriptions: Transcription[];

  if (dateRange) {
    // If date range detected, fetch all transcriptions in that range
    console.log('Date range detected:', dateRange.startDate, 'to', dateRange.endDate);
    transcriptions = await getTranscriptionsForDateRange(
      userId,
      dateRange.startDate,
      dateRange.endDate
    );
    console.log(`Found ${transcriptions.length} transcriptions in date range`);
  } else {
    // Otherwise, use search
    transcriptions = await searchTranscriptions(userId, query);
  }

  return {
    aboutMe,
    entities,
    transcriptions,
  };
}
