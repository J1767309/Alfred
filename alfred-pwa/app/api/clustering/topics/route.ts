import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSummary } from '@/lib/claude/client';

export const maxDuration = 60;

interface TranscriptInput {
  id: string;
  date: string;
  transcription: string;
}

interface TopicCluster {
  id: string;
  title: string;
  category: string;
  summary: string;
  sections: {
    heading: string;
    points: string[];
  }[];
  transcriptIds: string[];
  startTime: string;
  endTime: string;
}

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date, transcriptIds } = await request.json();

    if (!date && !transcriptIds) {
      return NextResponse.json({ error: 'Missing date or transcriptIds' }, { status: 400 });
    }

    // Fetch transcriptions
    let query = supabase
      .from('transcriptions')
      .select('id, date, transcription, created_at')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('date', { ascending: true });

    if (transcriptIds && transcriptIds.length > 0) {
      query = query.in('id', transcriptIds);
    } else if (date) {
      // Get transcriptions for the specific date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query = query
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
    }

    const { data: transcriptions, error } = await query;

    if (error) throw error;

    if (!transcriptions || transcriptions.length === 0) {
      return NextResponse.json({ topics: [] });
    }

    // Prepare transcripts for Claude
    const transcriptsForAnalysis = transcriptions.map((t, index) => ({
      index: index + 1,
      id: t.id,
      time: t.date,
      text: t.transcription?.slice(0, 500) || '', // Limit each transcript to prevent token overflow
    }));

    const userPrompt = `Here are ${transcriptions.length} voice transcriptions to analyze and cluster by topic:

${transcriptsForAnalysis.map(t =>
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
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        topics = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse clustering response:', parseError);
      console.error('Response was:', response);

      // Fallback: create a single topic with all transcripts
      topics = [{
        id: 'topic_1',
        title: 'Daily Conversations',
        category: 'General',
        summary: 'Various conversations throughout the day',
        sections: [],
        transcriptIds: transcriptions.map(t => t.id),
        startTime: transcriptions[0].date,
        endTime: transcriptions[transcriptions.length - 1].date,
      }];
    }

    // Enrich topics with full transcript data
    const enrichedTopics = topics.map(topic => ({
      ...topic,
      transcripts: transcriptions.filter(t => topic.transcriptIds.includes(t.id)),
    }));

    // Save to database if we have a date
    if (date) {
      await supabase.from('topic_clusters').upsert({
        user_id: user.id,
        cluster_date: date,
        topics: enrichedTopics,
        transcription_count: transcriptions.length,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,cluster_date',
      });
    }

    return NextResponse.json({ topics: enrichedTopics });
  } catch (error) {
    console.error('Clustering error:', error);
    return NextResponse.json(
      { error: 'Failed to cluster transcriptions' },
      { status: 500 }
    );
  }
}
