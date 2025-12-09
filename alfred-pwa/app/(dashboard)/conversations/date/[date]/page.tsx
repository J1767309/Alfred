'use client';

import { useState, useEffect, useMemo } from 'react';
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
  const [copiedTopicId, setCopiedTopicId] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [selectedTranscripts, setSelectedTranscripts] = useState<Set<string>>(new Set());
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());
  const [showTrash, setShowTrash] = useState(false);
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
      const loadedTranscriptions = transcriptionsResult.data || [];
      setTranscriptions(loadedTranscriptions);

      // If we have saved clusters, load them and join with transcriptions
      if (clustersResult.data?.topics) {
        // Create a lookup map for transcriptions
        const transcriptionMap = new Map(loadedTranscriptions.map(t => [t.id, t]));

        // Enrich topics with transcript data (they're stored without full text to reduce DB size)
        const enrichedTopics = (clustersResult.data.topics as TopicCluster[]).map(topic => ({
          ...topic,
          transcripts: topic.transcriptIds
            .map(id => transcriptionMap.get(id))
            .filter((t): t is Transcription => t !== undefined),
        }));

        const sortedTopics = enrichedTopics.sort(
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
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

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

  // Find transcripts that aren't in any cluster (excluding trashed)
  const unclusteredTranscripts = useMemo(() => {
    if (topics.length === 0) return [];
    const clusteredIds = new Set(topics.flatMap(t => t.transcriptIds));
    return transcriptions
      .filter(t => !clusteredIds.has(t.id) && !trashedIds.has(t.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [topics, transcriptions, trashedIds]);

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

  const handleCopyTopicTranscripts = async (topic: TopicCluster, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent expanding/collapsing the topic
    const sorted = [...(topic.transcripts || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const text = sorted
      .map(t => `[${formatDate(t.date, 'h:mm a')}] ${t.transcription}`)
      .join('\n\n');

    await navigator.clipboard.writeText(text);
    setCopiedTopicId(topic.id);
    setTimeout(() => setCopiedTopicId(null), 2000);
  };

  // Save topics to database (without full transcript text to reduce DB size)
  const saveTopics = async (newTopics: TopicCluster[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Strip out transcripts field before saving - only keep transcriptIds
      const topicsForStorage = newTopics.map(({ transcripts, ...rest }) => rest);

      await supabase.from('topic_clusters').upsert({
        user_id: user.id,
        cluster_date: dateParam,
        topics: topicsForStorage,
        transcription_count: transcriptions.length,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,cluster_date',
      });
    } catch (error) {
      console.error('Error saving topics:', error);
    }
  };

  // Cluster only new (unclustered) transcripts
  const handleClusterNew = async () => {
    if (unclusteredTranscripts.length === 0) return;

    setClustering(true);
    setClusterError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
      const response = await fetch('/api/clustering/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateParam,
          transcriptIds: unclusteredTranscripts.map(t => t.id)
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.topics && data.topics.length > 0) {
        // Merge new topics with existing ones
        const allTopics = [...topics, ...data.topics];
        const sortedTopics = allTopics.sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        setTopics(sortedTopics);
        await saveTopics(sortedTopics);
      }
    } catch (error) {
      console.error('[Frontend] Clustering error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setClusterError('Request timed out.');
      } else {
        setClusterError(error instanceof Error ? error.message : 'Failed to cluster.');
      }
    } finally {
      clearTimeout(timeoutId);
      setClustering(false);
    }
  };

  // Delete a topic
  const handleDeleteTopic = async (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTopics = topics.filter(t => t.id !== topicId);
    setTopics(newTopics);
    setSelectedTopics(prev => {
      const next = new Set(prev);
      next.delete(topicId);
      return next;
    });
    await saveTopics(newTopics);
  };

  // Move transcript to trash (session-only, clears on refresh)
  const handleDeleteTranscript = (transcriptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTrashedIds(prev => {
      const next = new Set(Array.from(prev));
      next.add(transcriptId);
      return next;
    });
    setSelectedTranscripts(prev => {
      const next = new Set(prev);
      next.delete(transcriptId);
      return next;
    });
  };

  // Restore transcript from trash
  const handleRestoreTranscript = (transcriptId: string) => {
    setTrashedIds(prev => {
      const next = new Set(prev);
      next.delete(transcriptId);
      return next;
    });
  };

  // Permanently delete all trashed items
  const handleEmptyTrash = async () => {
    if (trashedIds.size === 0) return;

    if (!confirm(`Permanently delete ${trashedIds.size} transcript${trashedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('transcriptions')
        .delete()
        .in('id', Array.from(trashedIds));

      if (error) throw error;

      // Remove from local state
      setTranscriptions(prev => prev.filter(t => !trashedIds.has(t.id)));
      setTrashedIds(new Set());
      setShowTrash(false);
    } catch (error) {
      console.error('Error permanently deleting transcripts:', error);
    }
  };

  // Get trashed transcripts
  const trashedTranscripts = useMemo(() => {
    return transcriptions.filter(t => trashedIds.has(t.id));
  }, [transcriptions, trashedIds]);

  // Start editing a topic title
  const startEditingTopic = (topicId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTopicId(topicId);
    setEditingTitle(currentTitle);
  };

  // Save edited topic title
  const saveTopicTitle = async (topicId: string) => {
    if (!editingTitle.trim()) {
      setEditingTopicId(null);
      return;
    }

    const newTopics = topics.map(t =>
      t.id === topicId ? { ...t, title: editingTitle.trim() } : t
    );
    setTopics(newTopics);
    setEditingTopicId(null);
    await saveTopics(newTopics);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingTopicId(null);
    setEditingTitle('');
  };

  // Toggle topic selection for merge
  const toggleTopicSelection = (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  // Toggle transcript selection
  const toggleTranscriptSelection = (transcriptId: string) => {
    setSelectedTranscripts(prev => {
      const next = new Set(prev);
      if (next.has(transcriptId)) {
        next.delete(transcriptId);
      } else {
        next.add(transcriptId);
      }
      return next;
    });
  };

  // Cluster selected transcripts
  const handleClusterSelected = async () => {
    if (selectedTranscripts.size === 0) return;

    setClustering(true);
    setClusterError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
      const response = await fetch('/api/clustering/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateParam,
          transcriptIds: Array.from(selectedTranscripts)
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.topics && data.topics.length > 0) {
        const allTopics = [...topics, ...data.topics];
        const sortedTopics = allTopics.sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        setTopics(sortedTopics);
        setSelectedTranscripts(new Set());
        await saveTopics(sortedTopics);
      }
    } catch (error) {
      console.error('[Frontend] Clustering error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setClusterError('Request timed out.');
      } else {
        setClusterError(error instanceof Error ? error.message : 'Failed to cluster.');
      }
    } finally {
      clearTimeout(timeoutId);
      setClustering(false);
    }
  };

  // Re-cluster all transcripts (undo merges)
  const handleReclusterAll = async () => {
    if (!confirm('This will delete all current topic clusters and re-analyze all transcripts. Continue?')) {
      return;
    }

    setClustering(true);
    setClusterError(null);
    setTopics([]); // Clear existing topics
    setSelectedTopics(new Set());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
      const response = await fetch('/api/clustering/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateParam }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.topics && data.topics.length > 0) {
        const sortedTopics = [...data.topics].sort(
          (a: TopicCluster, b: TopicCluster) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        setTopics(sortedTopics);
        setViewMode('topics');
      }
    } catch (error) {
      console.error('[Frontend] Re-clustering error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setClusterError('Request timed out.');
      } else {
        setClusterError(error instanceof Error ? error.message : 'Failed to re-cluster.');
      }
    } finally {
      clearTimeout(timeoutId);
      setClustering(false);
    }
  };

  // Merge selected topics
  const handleMergeTopics = async () => {
    if (selectedTopics.size < 2) return;

    const toMerge = topics.filter(t => selectedTopics.has(t.id));
    const remaining = topics.filter(t => !selectedTopics.has(t.id));

    // Show confirmation with topic names
    const topicNames = toMerge.map(t => `• ${t.title}`).join('\n');
    if (!confirm(`Merge these ${toMerge.length} topics?\n\n${topicNames}`)) {
      return;
    }

    console.log('[Merge] Merging topics:', toMerge.map(t => ({ id: t.id, title: t.title })));

    // Combine all transcripts and IDs
    const allTranscripts = toMerge.flatMap(t => t.transcripts || []);
    const allTranscriptIds = toMerge.flatMap(t => t.transcriptIds);

    // Sort transcripts by date
    allTranscripts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Create merged topic using first topic's title/category or combine them
    const mergedTopic: TopicCluster = {
      id: `merged_${Date.now()}`,
      title: toMerge.map(t => t.title).join(' + '),
      category: toMerge[0].category,
      summary: toMerge.map(t => t.summary).join(' '),
      sections: toMerge.flatMap(t => t.sections || []),
      transcriptIds: Array.from(new Set(allTranscriptIds)),
      transcripts: allTranscripts,
      startTime: allTranscripts[0]?.date || toMerge[0].startTime,
      endTime: allTranscripts[allTranscripts.length - 1]?.date || toMerge[toMerge.length - 1].endTime,
    };

    const newTopics = [...remaining, mergedTopic].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    setTopics(newTopics);
    setSelectedTopics(new Set());
    await saveTopics(newTopics);
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div className="text-sm text-gray-500">
                {transcriptions.length} conversation{transcriptions.length !== 1 ? 's' : ''}
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                {viewMode === 'list' && topics.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setViewMode('topics')}
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Topics View
                  </Button>
                )}
                {/* Merge button - show when 2+ topics selected */}
                {selectedTopics.size >= 2 && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleMergeTopics}
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Merge ({selectedTopics.size})
                  </Button>
                )}
                {/* Cluster Selected - when transcripts are selected */}
                {selectedTranscripts.size > 0 && (
                  <Button
                    size="sm"
                    onClick={handleClusterSelected}
                    loading={clustering}
                    variant="primary"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    {clustering ? 'Clustering...' : `Cluster Selected (${selectedTranscripts.size})`}
                  </Button>
                )}
                {/* Cluster All New - only when there are unclustered transcripts and none selected */}
                {unclusteredTranscripts.length > 0 && selectedTranscripts.size === 0 && (
                  <Button
                    size="sm"
                    onClick={handleClusterNew}
                    loading={clustering}
                    variant="secondary"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {clustering ? 'Clustering...' : `Cluster All (${unclusteredTranscripts.length})`}
                  </Button>
                )}
                {/* Initial cluster button - only when no clusters exist */}
                {topics.length === 0 && unclusteredTranscripts.length === 0 && (
                  <Button
                    size="sm"
                    onClick={handleClusterTopics}
                    loading={clustering}
                    variant="primary"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    {clustering ? 'Clustering...' : 'Cluster by Topic'}
                  </Button>
                )}
                {/* Re-cluster All button - when clusters exist */}
                {topics.length > 0 && selectedTopics.size === 0 && selectedTranscripts.size === 0 && (
                  <Button
                    size="sm"
                    onClick={handleReclusterAll}
                    loading={clustering}
                    variant="secondary"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {clustering ? 'Re-clustering...' : 'Re-cluster All'}
                  </Button>
                )}
                {/* Trash button - show when there are trashed items */}
                {trashedIds.size > 0 && (
                  <Button
                    size="sm"
                    onClick={() => setShowTrash(true)}
                    variant="secondary"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Trash ({trashedIds.size})
                  </Button>
                )}
              </div>
            </div>

            {/* Topics View */}
            {viewMode === 'topics' && topics.length > 0 && (
              <div className="space-y-4">
                {/* Unclustered transcripts at the top */}
                {unclusteredTranscripts.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-400">
                        Unclustered ({unclusteredTranscripts.length})
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {unclusteredTranscripts.map((transcription) => (
                        <Card
                          key={transcription.id}
                          className={`p-4 border-dashed ${selectedTranscripts.has(transcription.id) ? 'border-brand-primary ring-2 ring-brand-primary' : 'border-gray-600'}`}
                        >
                          <div className="flex items-start">
                            {/* Selection checkbox - larger touch target for mobile */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTranscriptSelection(transcription.id);
                              }}
                              className={`-ml-2 -mt-1 p-2 flex-shrink-0 flex items-center justify-center transition-colors touch-manipulation`}
                            >
                              <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                selectedTranscripts.has(transcription.id)
                                  ? 'bg-brand-primary border-brand-primary'
                                  : 'border-gray-500'
                              }`}>
                                {selectedTranscripts.has(transcription.id) && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm text-gray-400">
                                    {formatDate(transcription.date, 'h:mm a')}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded">
                                    New
                                  </span>
                                </div>
                                {/* Delete transcript button */}
                                <button
                                  onClick={(e) => handleDeleteTranscript(transcription.id, e)}
                                  className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                                  title="Delete transcript"
                                >
                                  <svg className="w-4 h-4 text-gray-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                              <p className="text-gray-300 text-sm whitespace-pre-wrap">
                                {transcription.transcription}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {topics.map((topic) => (
                  <Card key={topic.id} className={`overflow-hidden ${selectedTopics.has(topic.id) ? 'ring-2 ring-brand-primary bg-brand-primary/5' : ''}`}>
                    {/* Topic Header - Always visible */}
                    <div
                      className="flex items-start p-5 cursor-pointer touch-manipulation"
                      onClick={() => toggleTopicExpand(topic.id)}
                    >
                      {/* Selection checkbox - larger touch target for mobile */}
                      <button
                        onClick={(e) => toggleTopicSelection(topic.id, e)}
                        className="-ml-2 -mt-1 p-2 flex-shrink-0 flex items-center justify-center transition-colors touch-manipulation"
                      >
                        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedTopics.has(topic.id)
                            ? 'bg-brand-primary border-brand-primary'
                            : 'border-gray-500'
                        }`}>
                          {selectedTopics.has(topic.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                      </button>

                      {/* Topic content */}
                      <div className="flex-1 text-left ml-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-gray-500">
                                {formatDate(topic.startTime, 'h:mm a')} - {formatDate(topic.endTime, 'h:mm a')}
                              </span>
                            </div>
                            {editingTopicId === topic.id ? (
                              <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveTopicTitle(topic.id);
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                  className="flex-1 bg-dark-hover border border-dark-border rounded px-2 py-1 text-lg font-semibold text-white focus:outline-none focus:border-brand-primary"
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveTopicTitle(topic.id)}
                                  className="p-1.5 rounded bg-brand-primary/20 hover:bg-brand-primary/30 transition-colors"
                                  title="Save"
                                >
                                  <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="p-1.5 rounded hover:bg-dark-hover transition-colors"
                                  title="Cancel"
                                >
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <h3 className="text-lg font-semibold text-white mb-2">
                                {topic.title}
                              </h3>
                            )}
                            <div className="flex items-center gap-2 mb-3">
                              <span className="px-2.5 py-1 bg-brand-primary/10 text-brand-primary text-xs rounded-full">
                                {topic.category}
                              </span>
                              <span className="text-xs text-gray-500">
                                {topic.transcripts?.length || topic.transcriptIds.length} transcript{(topic.transcripts?.length || topic.transcriptIds.length) !== 1 ? 's' : ''}
                              </span>
                              <button
                                onClick={(e) => handleCopyTopicTranscripts(topic, e)}
                                className="ml-2 p-1.5 rounded hover:bg-dark-hover transition-colors"
                                title="Copy transcripts"
                              >
                                {copiedTopicId === topic.id ? (
                                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                              {/* Edit button */}
                              <button
                                onClick={(e) => startEditingTopic(topic.id, topic.title, e)}
                                className="p-1.5 rounded hover:bg-dark-hover transition-colors"
                                title="Rename cluster"
                              >
                                <svg className="w-4 h-4 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {/* Delete button */}
                              <button
                                onClick={(e) => handleDeleteTopic(topic.id, e)}
                                className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                                title="Delete cluster"
                              >
                                <svg className="w-4 h-4 text-gray-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                            <p className="text-gray-400 text-sm">{topic.summary}</p>
                          </div>
                          <svg
                            className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${
                              expandedTopic === topic.id ? 'rotate-180' : ''
                            }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

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

      {/* Trash Modal */}
      {showTrash && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card border border-dark-border rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <h2 className="text-lg font-semibold text-white">
                  Trash ({trashedTranscripts.length})
                </h2>
              </div>
              <button
                onClick={() => setShowTrash(false)}
                className="p-2 rounded hover:bg-dark-hover transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {trashedTranscripts.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Trash is empty</p>
              ) : (
                trashedTranscripts.map((transcript) => (
                  <div
                    key={transcript.id}
                    className="p-3 bg-dark-hover/50 rounded-lg border border-dark-border"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <span className="text-xs text-gray-500 block mb-1">
                          {formatDate(transcript.date, 'h:mm a')}
                        </span>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-3">
                          {transcript.transcription}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreTranscript(transcript.id)}
                        className="flex-shrink-0 p-2 rounded bg-brand-primary/10 hover:bg-brand-primary/20 transition-colors"
                        title="Restore"
                      >
                        <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-dark-border">
              <p className="text-xs text-gray-500">
                Trash clears when you refresh the page
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowTrash(false)}
                >
                  Close
                </Button>
                {trashedTranscripts.length > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleEmptyTrash}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete All Permanently
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
