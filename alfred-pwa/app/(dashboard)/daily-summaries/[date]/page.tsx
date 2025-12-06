'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DailySummary } from '@/types/database';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import SummaryContent from '@/components/summaries/SummaryContent';
import { formatDate, getDayLabel } from '@/lib/utils/dates';

export default function DailySummaryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadSummary();
  }, [params.date]);

  const loadSummary = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('summary_date', params.date)
        .is('deleted_at', null)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setSummary(data);
    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!summary) return;
    setRegenerating(true);

    try {
      const response = await fetch('/api/summaries/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: summary.summary_date }),
      });

      if (!response.ok) throw new Error('Failed to regenerate');

      loadSummary();
    } catch (error) {
      console.error('Error regenerating:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!summary) return;
    if (!confirm('Move this summary to trash? It will be permanently deleted after 15 days.')) return;

    setDeleting(true);
    try {
      // Soft delete - set deleted_at timestamp
      const { error } = await supabase
        .from('daily_summaries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', summary.id);

      if (error) throw error;
      router.push('/daily-summaries');
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete summary');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Loading..." />
        <div className="flex-1 overflow-auto p-6">
          <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
            <div className="h-8 bg-dark-hover rounded w-1/4"></div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-8">
              <div className="space-y-4">
                <div className="h-6 bg-dark-hover rounded w-1/3"></div>
                <div className="h-4 bg-dark-hover rounded w-full"></div>
                <div className="h-4 bg-dark-hover rounded w-5/6"></div>
                <div className="h-4 bg-dark-hover rounded w-4/5"></div>
                <div className="h-6 bg-dark-hover rounded w-1/4 mt-6"></div>
                <div className="h-4 bg-dark-hover rounded w-full"></div>
                <div className="h-4 bg-dark-hover rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!summary) {
    return (
      <>
        <Header title="Summary Not Found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-400 mb-4">No summary found for this date.</p>
            <Button onClick={() => router.push('/daily-summaries')}>
              Back to Summaries
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={getDayLabel(summary.summary_date)}
        subtitle={formatDate(summary.summary_date, 'EEEE, MMMM d, yyyy')}
        actions={
          <div className="flex space-x-2">
            <Button variant="secondary" onClick={() => router.push('/daily-summaries')}>
              Back
            </Button>
            <Button variant="secondary" onClick={handleRegenerate} loading={regenerating}>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-dark-card border border-dark-border rounded-xl p-8">
            <SummaryContent content={summary.content} />
          </div>

          <div className="mt-4 text-sm text-gray-500 text-center">
            Last updated: {formatDate(summary.updated_at, 'PPpp')}
          </div>
        </div>
      </div>
    </>
  );
}
