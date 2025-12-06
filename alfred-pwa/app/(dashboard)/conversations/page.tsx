'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Transcription } from '@/types/database';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import { getDayLabel, groupByDate } from '@/lib/utils/dates';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';

interface DateStats {
  date: string;
  count: number;
  preview: string;
}

export default function ConversationsPage() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('date', { ascending: false });

      if (error) throw error;
      setTranscriptions(data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group transcriptions by date and compute stats
  const dateStats = useMemo(() => {
    const grouped = groupByDate(transcriptions, 'created_at');
    const stats: DateStats[] = [];

    grouped.forEach((dayTranscriptions, dateKey) => {
      // Create a preview from the first few transcriptions
      const previewText = dayTranscriptions
        .slice(0, 3)
        .map(t => t.transcription?.slice(0, 50))
        .filter(Boolean)
        .join(' ... ');

      stats.push({
        date: dateKey,
        count: dayTranscriptions.length,
        preview: previewText.slice(0, 150) + (previewText.length > 150 ? '...' : ''),
      });
    });

    return stats;
  }, [transcriptions]);

  // Get dates with transcriptions for calendar highlighting
  const datesWithTranscriptions = useMemo(() => {
    return new Set(dateStats.map(s => s.date));
  }, [dateStats]);

  // Calendar navigation
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleDateClick = (date: string) => {
    router.push(`/conversations/date/${date}`);
  };

  return (
    <>
      <Header
        title="Conversations"
        subtitle="Your transcriptions organized by date"
        actions={
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className={`p-2 rounded-lg transition-colors ${
              showCalendar ? 'bg-brand-primary text-white' : 'bg-dark-card text-gray-400 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Calendar View */}
        {showCalendar && (
          <Card className="mb-6 p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-dark-hover rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="text-lg font-semibold text-white">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 hover:bg-dark-hover rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before the first of the month */}
              {Array.from({ length: calendarDays[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="h-10" />
              ))}

              {calendarDays.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const hasTranscriptions = datesWithTranscriptions.has(dateKey);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={dateKey}
                    onClick={() => hasTranscriptions && handleDateClick(dateKey)}
                    disabled={!hasTranscriptions}
                    className={`h-10 rounded-lg text-sm transition-colors relative ${
                      hasTranscriptions
                        ? 'hover:bg-brand-primary/20 text-white cursor-pointer'
                        : 'text-gray-600 cursor-default'
                    } ${isToday ? 'ring-2 ring-brand-primary' : ''}`}
                  >
                    {format(day, 'd')}
                    {hasTranscriptions && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-brand-primary rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Date List View */}
        {loading ? (
          <div className="space-y-4 max-w-3xl">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-dark-card border border-dark-border rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-dark-hover rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-dark-hover rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-dark-hover rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : dateStats.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No transcriptions yet</h3>
            <p className="text-gray-400">
              Transcriptions from your Fieldly device will appear here
            </p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-3">
            {dateStats.map((stat) => (
              <Card
                key={stat.date}
                hover
                onClick={() => handleDateClick(stat.date)}
                className="p-5 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {getDayLabel(stat.date)}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {stat.count} conversation{stat.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    {stat.preview && (
                      <p className="text-gray-400 text-sm leading-relaxed pl-[52px] line-clamp-2">
                        {stat.preview}
                      </p>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-gray-500 flex-shrink-0 mt-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
