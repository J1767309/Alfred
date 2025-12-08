'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ConversationSummary, Transcription } from '@/types/database';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatDate, getDayLabel, groupByDate } from '@/lib/utils/dates';

export default function ConversationsPage() {
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load both summaries and transcriptions
      const [summariesResult, transcriptionsResult] = await Promise.all([
        supabase
          .from('conversation_summaries')
          .select('*')
          .eq('user_id', user.id)
          .order('conversation_date', { ascending: false }),
        supabase
          .from('transcriptions')
          .select('*')
          .or(`user_id.eq.${user.id},user_id.is.null`)
          .order('date', { ascending: false })
          .limit(50),
      ]);

      setSummaries(summariesResult.data || []);
      setTranscriptions(transcriptionsResult.data || []);
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

  // Group transcriptions by date
  const groupedTranscriptions = groupByDate(transcriptions, 'created_at');

  return (
    <>
      <Header
        title="Conversation Summaries"
        subtitle="AI-generated summaries of your transcribed conversations"
      />

      <div className="bg-yellow-500 text-black px-4 py-2 text-center font-medium">
        Greetings John
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-6 bg-dark-hover rounded w-32 mb-4"></div>
                <div className="bg-dark-card border border-dark-border rounded-xl p-4">
                  <div className="h-4 bg-dark-hover rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-dark-hover rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : transcriptions.length === 0 ? (
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
          <div className="space-y-8">
            {Array.from(groupedTranscriptions.entries()).map(([dateKey, dayTranscriptions]) => (
              <div key={dateKey}>
                <h2 className="text-lg font-semibold text-white mb-4 sticky top-0 bg-dark-bg py-2">
                  {getDayLabel(dateKey)}
                </h2>
                <div className="space-y-4">
                  {dayTranscriptions.map((transcription) => {
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
                                  className="text-alfred-primary hover:text-alfred-secondary text-sm"
                                >
                                  View full summary
                                </button>
                              </div>
                            ) : (
                              <div>
                                <p className="text-gray-400 text-sm line-clamp-3 mb-3">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
