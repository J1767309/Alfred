'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Transcription, ConversationSummary } from '@/types/database';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatDate, getDayLabel } from '@/lib/utils/dates';
import { parseISO, startOfDay, endOfDay, addDays, subDays, format } from 'date-fns';

export default function ConversationsDatePage() {
  const params = useParams();
  const router = useRouter();
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const supabase = createClient();

  const dateParam = params.date as string;
  const currentDate = parseISO(dateParam);

  useEffect(() => {
    loadData();
  }, [dateParam]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get start and end of the day in ISO format
      const dayStart = startOfDay(currentDate).toISOString();
      const dayEnd = endOfDay(currentDate).toISOString();

      // Load transcriptions for this specific date
      const [transcriptionsResult, summariesResult] = await Promise.all([
        supabase
          .from('transcriptions')
          .select('*')
          .or(`user_id.eq.${user.id},user_id.is.null`)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd)
          .order('date', { ascending: false }),
        supabase
          .from('conversation_summaries')
          .select('*')
          .eq('user_id', user.id)
          .eq('conversation_date', dateParam),
      ]);

      setTranscriptions(transcriptionsResult.data || []);
      setSummaries(summariesResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async (transcription: Transcription) => {
    setGenerating(transcription.id);
    try {
      const response = await fetch('/api/summaries/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptionId: transcription.id }),
      });

      if (!response.ok) throw new Error('Failed to generate summary');
      loadData();
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setGenerating(null);
    }
  };

  const getSummaryForTranscription = (transcriptionId: string) => {
    return summaries.find(s => s.transcription_id === transcriptionId);
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev'
      ? subDays(currentDate, 1)
      : addDays(currentDate, 1);
    router.push(`/conversations/date/${format(newDate, 'yyyy-MM-dd')}`);
  };

  return (
    <>
      <Header
        title={getDayLabel(dateParam)}
        subtitle={formatDate(dateParam, 'EEEE, MMMM d, yyyy')}
        actions={
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateDay('prev')}
              className="p-2 bg-dark-card hover:bg-dark-hover rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => navigateDay('next')}
              className="p-2 bg-dark-card hover:bg-dark-hover rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <Button variant="secondary" onClick={() => router.push('/conversations')}>
              All Dates
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-4 max-w-3xl">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-dark-card border border-dark-border rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-dark-hover rounded w-1/4 mb-3"></div>
                <div className="h-4 bg-dark-hover rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-dark-hover rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : transcriptions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No conversations this day</h3>
            <p className="text-gray-400 mb-4">
              There are no transcriptions recorded for {getDayLabel(dateParam).toLowerCase()}
            </p>
            <Button variant="secondary" onClick={() => router.push('/conversations')}>
              Back to All Dates
            </Button>
          </div>
        ) : (
          <div className="max-w-3xl space-y-4">
            <div className="text-sm text-gray-500 mb-4">
              {transcriptions.length} conversation{transcriptions.length !== 1 ? 's' : ''}
            </div>

            {transcriptions.map((transcription) => {
              const summary = getSummaryForTranscription(transcription.id);
              return (
                <Card key={transcription.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm text-gray-400">
                          {formatDate(transcription.date, 'h:mm a')}
                        </span>
                        {summary && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                            Summarized
                          </span>
                        )}
                      </div>

                      {summary ? (
                        <div>
                          <h3 className="font-medium text-white mb-2">{summary.title}</h3>
                          <p className="text-gray-400 text-sm mb-3">{summary.summary}</p>
                          {summary.key_points && Array.isArray(summary.key_points) && summary.key_points.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs text-gray-500 mb-1">Key Points:</p>
                              <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                                {(summary.key_points as unknown as string[]).slice(0, 3).map((point, i) => (
                                  <li key={i}>{point}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <button
                            onClick={() => router.push(`/conversations/${summary.id}`)}
                            className="text-brand-primary hover:text-brand-secondary text-sm"
                          >
                            View full summary
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-300 text-sm whitespace-pre-wrap mb-3">
                            {transcription.transcription}
                          </p>
                          <Button
                            size="sm"
                            onClick={() => handleGenerateSummary(transcription)}
                            loading={generating === transcription.id}
                          >
                            Generate Summary
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
