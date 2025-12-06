'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Transcription } from '@/types/database';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatDate, getDayLabel, getCentralDayBoundariesUTC } from '@/lib/utils/dates';
import { parseISO, addDays, subDays, format } from 'date-fns';

interface TopicSection {
  heading: string;
  points: string[];
}

interface TopicCluster {
  id: string;
  title: string;
  category: string;
  summary: string;
  sections: TopicSection[];
  transcriptIds: string[];
  transcripts: Transcription[];
  startTime: string;
  endTime: string;
}

export default function ConversationsDatePage() {
  const params = useParams();
  const router = useRouter();
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [topics, setTopics] = useState<TopicCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'topics'>('list');
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  const dateParam = params.date as string;
  const currentDate = parseISO(dateParam);

  useEffect(() => {
    loadData();
  }, [dateParam]);

  // Auto-cluster when we have transcriptions but no saved clusters
  useEffect(() => {
    if (!loading && transcriptions.length > 0 && topics.length === 0 && !clustering && viewMode === 'list') {
      handleClusterTopics();
    }
  }, [loading, transcriptions.length, topics.length]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get Central Time day boundaries in UTC for database query
      const { startUTC, endUTC } = getCentralDayBoundariesUTC(dateParam);

      // Debug: log the boundaries
      console.log('[DatePage] Querying for date:', dateParam, 'UTC boundaries:', { startUTC, endUTC });

      // Load transcriptions and saved clusters in parallel
      // Query by 'date' field (when transcription occurred) not 'created_at' (when inserted)
      const [transcriptionsResult, clustersResult] = await Promise.all([
        supabase
          .from('transcriptions')
          .select('*')
          .or(`user_id.eq.${user.id},user_id.is.null`)
          .gte('date', startUTC)
          .lte('date', endUTC)
          .order('date', { ascending: false }),
        supabase
          .from('topic_clusters')
          .select('topics')
          .eq('user_id', user.id)
          .eq('cluster_date', dateParam)
          .single()
      ]);

      if (transcriptionsResult.error) throw transcriptionsResult.error;
      setTranscriptions(transcriptionsResult.data || []);

      // If we have saved clusters, load them automatically (sorted by most recent first)
      if (clustersResult.data?.topics) {
        const sortedTopics = [...(clustersResult.data.topics as TopicCluster[])].sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        setTopics(sortedTopics);
        setViewMode('topics');
      } else {
        setTopics([]);
        // Will trigger auto-clustering via useEffect if we have transcriptions
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClusterTopics = async () => {
    if (transcriptions.length === 0) return;

    setClustering(true);
    setClusterError(null);

    // Use AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout

    try {
      console.log('[Frontend] Starting clustering for date:', dateParam);

      const response = await fetch('/api/clustering/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateParam }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('[Frontend] Failed to parse response:', parseError);
        throw new Error('Failed to parse server response');
      }

      console.log('[Frontend] Response status:', response.status, 'topics:', data.topics?.length);

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.topics && data.topics.length > 0) {
        // Sort topics by most recent first
        const sortedTopics = [...data.topics].sort(
          (a: TopicCluster, b: TopicCluster) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        setTopics(sortedTopics);
        setViewMode('topics');
      } else {
        setClusterError('No topics could be identified from the conversations.');
      }
    } catch (error) {
      console.error('[Frontend] Clustering error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setClusterError('Request timed out. The server is taking too long to process. Please try again.');
      } else {
        setClusterError(error instanceof Error ? error.message : 'Failed to cluster topics. Please try again.');
      }
    } finally {
      clearTimeout(timeoutId);
      setClustering(false);
    }
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev'
      ? subDays(currentDate, 1)
      : addDays(currentDate, 1);
    router.push(`/conversations/date/${format(newDate, 'yyyy-MM-dd')}`);
  };

  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopic(expandedTopic === topicId ? null : topicId);
  };

  const handleCopyTranscripts = async () => {
    // Sort by date ascending for chronological reading
    const sorted = [...transcriptions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const text = sorted
      .map(t => `[${formatDate(t.date, 'h:mm a')}] ${t.transcription}`)
      .join('\n\n');

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            {/* Error message */}
            {clusterError && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{clusterError}</p>
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm text-gray-500">
                {transcriptions.length} conversation{transcriptions.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyTranscripts}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4 mr-1.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy All
                    </>
                  )}
                </Button>
                {viewMode === 'topics' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    List View
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleClusterTopics}
                  loading={clustering}
                  variant={topics.length > 0 ? 'secondary' : 'primary'}
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  {clustering ? 'Clustering...' : topics.length > 0 ? 'Re-cluster' : 'Cluster by Topic'}
                </Button>
              </div>
            </div>

            {/* Topics View */}
            {viewMode === 'topics' && topics.length > 0 && (
              <div className="space-y-4">
                {topics.map((topic) => (
                  <Card key={topic.id} className="overflow-hidden">
                    {/* Topic Header - Always visible */}
                    <button
                      onClick={() => toggleTopicExpand(topic.id)}
                      className="w-full p-5 text-left hover:bg-dark-hover/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500">
                              {formatDate(topic.startTime, 'h:mm a')}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-2">
                            {topic.title}
                          </h3>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-2.5 py-1 bg-brand-primary/10 text-brand-primary text-xs rounded-full">
                              {topic.category}
                            </span>
                            <span className="text-xs text-gray-500">
                              {topic.transcripts?.length || topic.transcriptIds.length} transcript{(topic.transcripts?.length || topic.transcriptIds.length) !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm">{topic.summary}</p>
                        </div>
                        <svg
                          className={`w-5 h-5 text-gray-500 transition-transform ${
                            expandedTopic === topic.id ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {expandedTopic === topic.id && (
                      <div className="border-t border-dark-border">
                        {/* Sections */}
                        {topic.sections && topic.sections.length > 0 && (
                          <div className="p-5 border-b border-dark-border">
                            {topic.sections.map((section, idx) => (
                              <div key={idx} className="mb-4 last:mb-0">
                                <h4 className="text-sm font-semibold text-white mb-2 flex items-center">
                                  <span className="text-brand-primary mr-2">#</span>
                                  {section.heading}
                                </h4>
                                <ul className="space-y-1.5 pl-4">
                                  {section.points.map((point, pointIdx) => (
                                    <li key={pointIdx} className="text-sm text-gray-400 flex items-start">
                                      <span className="text-gray-600 mr-2">•</span>
                                      {point}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Individual Transcripts */}
                        <div className="p-5">
                          <h4 className="text-sm font-semibold text-gray-500 mb-3">Transcripts</h4>
                          <div className="space-y-3">
                            {(topic.transcripts || []).map((transcript) => (
                              <div
                                key={transcript.id}
                                className="p-3 bg-dark-hover/50 rounded-lg"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs text-gray-500">
                                    {formatDate(transcript.date, 'h:mm a')}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-300 whitespace-pre-wrap">
                                  {transcript.transcription}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="space-y-4">
                {transcriptions.map((transcription) => (
                  <Card key={transcription.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm text-gray-400">
                            {formatDate(transcription.date, 'h:mm a')}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap">
                          {transcription.transcription}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
