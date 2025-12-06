'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ConversationSummary } from '@/types/database';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardHeader } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils/dates';

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadSummary();
  }, [params.id]);

  const loadSummary = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('conversation_summaries')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setSummary(data);
    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!summary) return;
    if (!confirm('Are you sure you want to delete this summary?')) return;

    try {
      await supabase
        .from('conversation_summaries')
        .delete()
        .eq('id', summary.id);

      router.push('/conversations');
    } catch (error) {
      console.error('Error deleting summary:', error);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Loading..." />
        <div className="flex-1 overflow-auto p-6">
          <div className="animate-pulse space-y-4 max-w-3xl">
            <div className="h-8 bg-dark-hover rounded w-1/2"></div>
            <div className="h-4 bg-dark-hover rounded w-1/4"></div>
            <div className="h-32 bg-dark-hover rounded"></div>
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
            <p className="text-gray-400 mb-4">This summary could not be found.</p>
            <Button onClick={() => router.push('/conversations')}>
              Back to Conversations
            </Button>
          </div>
        </div>
      </>
    );
  }

  const keyPoints = summary.key_points as string[] | null;
  const actionItems = summary.action_items as string[] | null;

  return (
    <>
      <Header
        title={summary.title || 'Conversation Summary'}
        subtitle={formatDate(summary.conversation_date, 'EEEE, MMMM d, yyyy')}
        actions={
          <div className="flex space-x-2">
            <Button variant="secondary" onClick={() => router.push('/conversations')}>
              Back
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl space-y-6">
          {/* Participants */}
          {summary.participants && summary.participants.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Participants</h3>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {summary.participants.map((participant, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-dark-hover rounded-full text-sm"
                    >
                      {participant}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Summary</h3>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 whitespace-pre-wrap">{summary.summary}</p>
            </CardContent>
          </Card>

          {/* Key Points */}
          {keyPoints && keyPoints.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Key Points</h3>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <svg
                        className="w-5 h-5 text-alfred-primary flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-gray-300">{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Action Items */}
          {actionItems && actionItems.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Action Items</h3>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {actionItems.map((item, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <svg
                        className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardContent className="text-sm text-gray-500">
              <p>Created: {formatDate(summary.created_at, 'PPpp')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
