'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DailySummary } from '@/types/database';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatDate, getDayLabel } from '@/lib/utils/dates';
import { differenceInDays, parseISO } from 'date-fns';

export default function TrashPage() {
  const [trashedSummaries, setTrashedSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadTrashedSummaries();
  }, []);

  const loadTrashedSummaries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      setTrashedSummaries(data || []);
    } catch (error) {
      console.error('Error loading trashed summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (summary: DailySummary) => {
    setActionLoading(summary.id);
    try {
      const { error } = await supabase
        .from('daily_summaries')
        .update({ deleted_at: null })
        .eq('id', summary.id);

      if (error) throw error;
      setTrashedSummaries(prev => prev.filter(s => s.id !== summary.id));
    } catch (error) {
      console.error('Error restoring summary:', error);
      alert('Failed to restore summary');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (summary: DailySummary) => {
    if (!confirm('Permanently delete this summary? This action cannot be undone.')) return;

    setActionLoading(summary.id);
    try {
      const { error } = await supabase
        .from('daily_summaries')
        .delete()
        .eq('id', summary.id);

      if (error) throw error;
      setTrashedSummaries(prev => prev.filter(s => s.id !== summary.id));
    } catch (error) {
      console.error('Error deleting summary:', error);
      alert('Failed to delete summary');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm(`Permanently delete all ${trashedSummaries.length} summaries in trash? This action cannot be undone.`)) return;

    setActionLoading('empty');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('daily_summaries')
        .delete()
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null);

      if (error) throw error;
      setTrashedSummaries([]);
    } catch (error) {
      console.error('Error emptying trash:', error);
      alert('Failed to empty trash');
    } finally {
      setActionLoading(null);
    }
  };

  const getDaysUntilDeletion = (deletedAt: string | null): number => {
    if (!deletedAt) return 15;
    const daysElapsed = differenceInDays(new Date(), parseISO(deletedAt));
    return Math.max(0, 15 - daysElapsed);
  };

  const getExcerpt = (content: string): string => {
    const execMatch = content.match(/##\s*Executive Summary[\s\S]*?(?=##|$)/i);
    if (execMatch) {
      const text = execMatch[0].replace(/##\s*Executive Summary/i, '').trim();
      const cleaned = text.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
      return cleaned.slice(0, 120) + (cleaned.length > 120 ? '...' : '');
    }
    const firstParagraph = content.split('\n\n')[0]?.replace(/[#*]/g, '').trim() || '';
    return firstParagraph.slice(0, 120) + (firstParagraph.length > 120 ? '...' : '');
  };

  return (
    <>
      <Header
        title="Trash"
        subtitle="Deleted summaries are permanently removed after 15 days"
        actions={
          <div className="flex items-center space-x-3">
            <Button variant="secondary" onClick={() => router.push('/daily-summaries')}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Button>
            {trashedSummaries.length > 0 && (
              <Button
                variant="danger"
                onClick={handleEmptyTrash}
                loading={actionLoading === 'empty'}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Empty Trash
              </Button>
            )}
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
        ) : trashedSummaries.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Trash is empty</h3>
            <p className="text-gray-400 mb-4">
              Deleted summaries will appear here
            </p>
            <Button variant="secondary" onClick={() => router.push('/daily-summaries')}>
              Back to Summaries
            </Button>
          </div>
        ) : (
          <div className="max-w-3xl space-y-3">
            {trashedSummaries.map((summary) => {
              const daysLeft = getDaysUntilDeletion(summary.deleted_at);
              const isLoading = actionLoading === summary.id;

              return (
                <Card key={summary.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-white">
                            {getDayLabel(summary.summary_date)}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {formatDate(summary.summary_date, 'MMMM d, yyyy')}
                            </span>
                            <span className="text-xs text-red-400">
                              • {daysLeft} day{daysLeft !== 1 ? 's' : ''} until deletion
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-500 text-sm leading-relaxed pl-[52px]">
                        {getExcerpt(summary.content)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRestore(summary)}
                        loading={isLoading}
                        disabled={actionLoading !== null}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handlePermanentDelete(summary)}
                        loading={isLoading}
                        disabled={actionLoading !== null}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
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
