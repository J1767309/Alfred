import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateSummary } from '@/lib/claude/client';
import { format } from 'date-fns';

export const maxDuration = 60;

const CLUSTERING_PROMPT = `You are an AI that analyzes voice transcriptions and groups them into coherent topic clusters.

Given a list of transcriptions with timestamps, your task is to:
1. Identify distinct conversations or topics
2. Group related transcriptions together (they may be fragments of the same conversation)
3. Generate a descriptive title for each topic
4. Assign a category (e.g., "Work Meeting", "Personal", "Planning", "Social", "Technical Discussion", etc.)
5. Create a structured summary with key sections and bullet points

Return your response as a JSON array of topic clusters. Each cluster should have:
- id: A unique identifier (use "topic_1", "topic_2", etc.)
- title: A concise, descriptive title (3-6 words)
- category: The category type
- summary: A brief 1-2 sentence summary
- sections: An array of {heading: string, points: string[]} for key topics discussed
- transcriptIds: Array of transcript IDs that belong to this topic
- startTime: ISO timestamp of earliest transcript in cluster
- endTime: ISO timestamp of latest transcript in cluster

Important guidelines:
- Group transcripts that are clearly part of the same conversation
- Transcripts close in time likely belong together
- Create separate topics for distinctly different subjects
- Make titles engaging and descriptive like a news headline
- Sections should capture the main themes discussed

Respond ONLY with the JSON array, no other text.`;

interface TopicCluster {
  id: string;
  title: string;
  category: string;
  summary: string;
  sections: { heading: string; points: string[] }[];
  transcriptIds: string[];
  startTime: string;
  endTime: string;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Get today's date
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all users with transcriptions today
    const { data: usersWithTranscriptions } = await supabase
      .from('transcriptions')
      .select('user_id')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .not('user_id', 'is', null);

    if (!usersWithTranscriptions || usersWithTranscriptions.length === 0) {
      return NextResponse.json({ message: 'No users with transcriptions today' });
    }

    // Get unique user IDs
    const userIds = Array.from(new Set(usersWithTranscriptions.map((t: { user_id: string }) => t.user_id))) as string[];

    const results: { userId: string; status: string; topicCount?: number; error?: string }[] = [];

    for (const userId of userIds) {
      try {
        // Get user's transcriptions for today
        const { data: transcriptions, error: fetchError } = await supabase
          .from('transcriptions')
          .select('id, date, transcription, created_at')
          .eq('user_id', userId)
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString())
          .order('date', { ascending: true });

        if (fetchError) throw fetchError;
        if (!transcriptions || transcriptions.length === 0) continue;

        // Check if we already have clusters for today that are recent (within last hour)
        const { data: existingCluster } = await supabase
          .from('topic_clusters')
          .select('updated_at, transcription_count')
          .eq('user_id', userId)
          .eq('cluster_date', todayStr)
          .single();

        // Skip if we have recent clusters with same transcript count
        if (existingCluster) {
          const lastUpdate = new Date(existingCluster.updated_at);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

          if (lastUpdate > hourAgo && existingCluster.transcription_count === transcriptions.length) {
            results.push({ userId, status: 'skipped', topicCount: 0 });
            continue;
          }
        }

        // Prepare transcripts for Claude
        const transcriptsForAnalysis = transcriptions.map((t: { id: string; date: string; transcription: string }, index: number) => ({
          index: index + 1,
          id: t.id,
          time: t.date,
          text: t.transcription?.slice(0, 500) || '',
        }));

        const userPrompt = `Here are ${transcriptions.length} voice transcriptions to analyze and cluster by topic:

${transcriptsForAnalysis.map((t: { index: number; id: string; time: string; text: string }) =>
  `[Transcript ${t.index}]
ID: ${t.id}
Time: ${t.time}
Text: ${t.text}
---`
).join('\n\n')}

Analyze these transcriptions and group them into topic clusters. Return the JSON array of clusters.`;

        // Call Claude to cluster
        const response = await generateSummary(CLUSTERING_PROMPT, userPrompt, 4096);

        // Parse the response
        let topics: TopicCluster[] = [];
        try {
          const jsonMatch = response.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            topics = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.error('Failed to parse clustering response:', parseError);
          topics = [{
            id: 'topic_1',
            title: 'Daily Conversations',
            category: 'General',
            summary: 'Various conversations throughout the day',
            sections: [],
            transcriptIds: transcriptions.map((t: { id: string }) => t.id),
            startTime: transcriptions[0].date,
            endTime: transcriptions[transcriptions.length - 1].date,
          }];
        }

        // Enrich topics with full transcript data
        const enrichedTopics = topics.map(topic => ({
          ...topic,
          transcripts: transcriptions.filter((t: { id: string }) => topic.transcriptIds.includes(t.id)),
        }));

        // Save to database
        await supabase.from('topic_clusters').upsert({
          user_id: userId,
          cluster_date: todayStr,
          topics: enrichedTopics,
          transcription_count: transcriptions.length,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,cluster_date',
        });

        results.push({ userId, status: 'success', topicCount: topics.length });
      } catch (userError) {
        console.error(`Error processing user ${userId}:`, userError);
        results.push({ userId, status: 'error', error: String(userError) });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} users`,
      results
    });
  } catch (error) {
    console.error('Clustering cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to run clustering cron job' },
      { status: 500 }
    );
  }
}
