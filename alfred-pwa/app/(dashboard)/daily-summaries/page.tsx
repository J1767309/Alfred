'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DailySummary } from '@/types/database';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatDate, getDayLabel } from '@/lib/utils/dates';

export default function DailySummariesPage() {
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [trashedCount, setTrashedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadSummaries();
  }, []);

  const loadSummaries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load active summaries
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('summary_date', { ascending: false });

      if (error) throw error;
      setSummaries(data || []);

      // Count trashed summaries
      const { count } = await supabase
        .from('daily_summaries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null);

      setTrashedCount(count || 0);
    } catch (error) {
      console.error('Error loading summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateToday = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/summaries/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: new Date().toISOString() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate summary');
      }

      const data = await response.json();
      router.push(`/daily-summaries/${data.summary.summary_date}`);
    } catch (error) {
      console.error('Error generating summary:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setGenerating(false);
    }
  };

  const getExcerpt = (content: string): string => {
    // Try to find the Executive Summary section
    const execMatch = content.match(/##\s*Executive Summary[\s\S]*?(?=##|$)/i);
    if (execMatch) {
      const text = execMatch[0].replace(/##\s*Executive Summary/i, '').trim();
      const cleaned = text.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
      return cleaned.slice(0, 180) + (cleaned.length > 180 ? '...' : '');
    }
    // Fallback to first paragraph
    const firstParagraph = content.split('\n\n')[0]?.replace(/[#*]/g, '').trim() || '';
    return firstParagraph.slice(0, 180) + (firstParagraph.length > 180 ? '...' : '');
  };

  return (
    <>
      <Header
        title="Daily Summaries"
        subtitle="AI-generated reflections on your day"
        actions={
          <div className="flex items-center space-x-3">
            {trashedCount > 0 && (
              <Button
                variant="secondary"
                onClick={() => router.push('/daily-summaries/trash')}
                className="relative"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Trash
                <span className="ml-2 bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
                  {trashedCount}
                </span>
              </Button>
            )}
            <Button onClick={handleGenerateToday} loading={generating}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate Today's Summary
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
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
        ) : summaries.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No summaries yet</h3>
            <p className="text-gray-400 mb-4">
              Generate your first daily summary based on today's transcriptions
            </p>
            <Button onClick={handleGenerateToday} loading={generating}>
              Generate Today's Summary
            </Button>
          </div>
        ) : (
          <div className="max-w-3xl space-y-3">
            {summaries.map((summary) => (
              <Card
                key={summary.id}
                hover
                onClick={() => router.push(`/daily-summaries/${summary.summary_date}`)}
                className="p-5 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {getDayLabel(summary.summary_date)}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {formatDate(summary.summary_date, 'MMMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed pl-[52px]">
                      {getExcerpt(summary.content)}
                    </p>
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
