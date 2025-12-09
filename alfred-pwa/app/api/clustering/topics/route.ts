import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCentralDayBoundariesUTC } from '@/lib/utils/dates';
import { getAboutMe, getEntities } from '@/lib/claude/context';
import { Entity } from '@/types/database';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300; // 5 minutes for batched processing

// Use Sonnet for faster, more reliable clustering
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

You will be provided with:
1. Context about the user (who they are, their background)
2. A list of known entities (people, places, organizations) with their relationships to the user
3. Voice transcriptions with timestamps

Use the user context and entities to better understand and interpret the transcriptions. When you recognize names or places mentioned, use the entity information to provide more meaningful summaries.

Your task is to:
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
- Use entity context to correctly identify who is being discussed (e.g., if "Mike" is mentioned and there's an entity "Mike - Brother", reference him appropriately)

Respond ONLY with the JSON array, no other text.`;

// Maximum transcripts per batch for Claude processing (smaller = faster per batch)
const MAX_BATCH_SIZE = 25;
// Time gap (in minutes) to consider as a conversation break
const CONVERSATION_GAP_MINUTES = 30;

/**
 * Groups transcripts into time-based segments.
 * Transcripts within CONVERSATION_GAP_MINUTES of each other are grouped together.
 */
function groupByTimeProximity(transcripts: TranscriptInput[]): TranscriptInput[][] {
  if (transcripts.length === 0) return [];

  // Sort by date
  const sorted = [...transcripts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const groups: TranscriptInput[][] = [];
  let currentGroup: TranscriptInput[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].date).getTime();
    const currTime = new Date(sorted[i].date).getTime();
    const gapMinutes = (currTime - prevTime) / (1000 * 60);

    if (gapMinutes > CONVERSATION_GAP_MINUTES) {
      // Start a new group
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
    } else {
      currentGroup.push(sorted[i]);
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Combines time-proximity groups into batches that fit within MAX_BATCH_SIZE.
 * Tries to keep related conversations together while respecting the size limit.
 */
function createBatches(timeGroups: TranscriptInput[][]): TranscriptInput[][] {
  const batches: TranscriptInput[][] = [];
  let currentBatch: TranscriptInput[] = [];

  for (const group of timeGroups) {
    // If this single group exceeds max size, split it
    if (group.length > MAX_BATCH_SIZE) {
      // Flush current batch first
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
      }
      // Split the large group into chunks
      for (let i = 0; i < group.length; i += MAX_BATCH_SIZE) {
        batches.push(group.slice(i, i + MAX_BATCH_SIZE));
      }
    } else if (currentBatch.length + group.length > MAX_BATCH_SIZE) {
      // Adding this group would exceed limit, start a new batch
      batches.push(currentBatch);
      currentBatch = [...group];
    } else {
      // Add to current batch
      currentBatch.push(...group);
    }
  }

  // Don't forget the last batch
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Process a single batch of transcripts with Claude Sonnet (faster for clustering)
 */
async function processBatch(
  transcripts: TranscriptInput[],
  contextSection: string,
  batchIndex: number,
  totalBatches: number
): Promise<TopicCluster[]> {
  // Reduce text limit for larger batches to stay within context limits
  const textLimit = transcripts.length > 20 ? 150 : 250;

  const transcriptsForAnalysis = transcripts.map((t, index) => ({
    index: index + 1,
    id: t.id,
    time: t.date,
    text: t.transcription?.slice(0, textLimit) || '',
  }));

  const userPrompt = `${contextSection}# Transcriptions (Batch ${batchIndex + 1} of ${totalBatches})

Here are ${transcripts.length} voice transcriptions to analyze and cluster by topic:

${transcriptsForAnalysis.map(t =>
  `[${t.index}] ${t.time}: ${t.text}${t.text.length >= textLimit ? '...' : ''} (ID:${t.id})`
).join('\n')}

Analyze these transcriptions and group them into topic clusters. Use the user context and entity information above to better understand who and what is being discussed. Return the JSON array of clusters.`;

  console.log(`[Clustering] Processing batch ${batchIndex + 1}/${totalBatches} with ${transcripts.length} transcripts`);

  try {
    // Use Sonnet for faster, more reliable clustering
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: CLUSTERING_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.text || '';

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Prefix topic IDs with batch index to ensure uniqueness
        return parsed.map((topic: TopicCluster, idx: number) => ({
          ...topic,
          id: `batch${batchIndex}_topic_${idx + 1}`,
        }));
      }
    }
  } catch (error) {
    console.error(`[Clustering] Failed to process batch ${batchIndex + 1}:`, error);
  }

  // Fallback: create a single topic for this batch
  return [{
    id: `batch${batchIndex}_topic_1`,
    title: `Conversations (Part ${batchIndex + 1})`,
    category: 'General',
    summary: 'Grouped conversations from this time period',
    sections: [],
    transcriptIds: transcripts.map(t => t.id),
    startTime: transcripts[0].date,
    endTime: transcripts[transcripts.length - 1].date,
  }];
}

export async function POST(request: NextRequest) {
  console.log('[Clustering] Starting topic clustering request');

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('[Clustering] Unauthorized - no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, transcriptIds } = body;
    console.log('[Clustering] Request params:', { date, transcriptIdsCount: transcriptIds?.length });

    if (!date && !transcriptIds) {
      return NextResponse.json({ error: 'Missing date or transcriptIds' }, { status: 400 });
    }

    // Fetch user context (about me and entities) in parallel
    const [aboutMe, entities] = await Promise.all([
      getAboutMe(user.id),
      getEntities(user.id),
    ]);

    console.log('[Clustering] User context loaded:', {
      hasAboutMe: !!aboutMe,
      entityCount: entities.length
    });

    // Fetch transcriptions
    let query = supabase
      .from('transcriptions')
      .select('id, date, transcription, created_at')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('date', { ascending: true });

    if (transcriptIds && transcriptIds.length > 0) {
      query = query.in('id', transcriptIds);
    } else if (date) {
      // Get transcriptions for the specific date using Central Time boundaries
      const { startUTC, endUTC } = getCentralDayBoundariesUTC(date);
      console.log('[Clustering] Date boundaries for', date, ':', { startUTC, endUTC });

      // Query by 'date' field (when transcription occurred) not 'created_at'
      query = query
        .gte('date', startUTC)
        .lte('date', endUTC);
    }

    const { data: transcriptions, error } = await query;

    if (error) {
      console.error('[Clustering] Supabase query error:', error);
      throw error;
    }

    console.log('[Clustering] Found transcriptions:', transcriptions?.length || 0);

    if (!transcriptions || transcriptions.length === 0) {
      return NextResponse.json({ topics: [] });
    }

    // Build context section once (shared across all batches)
    const contextParts: string[] = [];

    if (aboutMe) {
      contextParts.push(`## About the User\n${aboutMe}`);
    }

    if (entities.length > 0) {
      const entityList = entities.map((e: Entity) => {
        const parts = [`- ${e.name} (${e.type})`];
        if (e.relationship) parts[0] += `: ${e.relationship}`;
        if (e.notes) parts.push(`  Notes: ${e.notes}`);
        if (e.context) parts.push(`  Context: ${e.context}`);
        return parts.join('\n');
      }).join('\n');
      contextParts.push(`## Known Entities\n${entityList}`);
    }

    const contextSection = contextParts.length > 0
      ? `# User Context\n\n${contextParts.join('\n\n')}\n\n---\n\n`
      : '';

    // For small datasets, process in one shot
    if (transcriptions.length <= MAX_BATCH_SIZE) {
      console.log('[Clustering] Small dataset, processing in single batch');
      const topics = await processBatch(transcriptions, contextSection, 0, 1);

      // Save to database if we have a date - store only IDs, not full transcripts
      if (date) {
        await supabase.from('topic_clusters').upsert({
          user_id: user.id,
          cluster_date: date,
          topics: topics,
          transcription_count: transcriptions.length,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,cluster_date',
        });
      }

      // Enrich topics with full transcript data for the response
      const enrichedTopics = topics.map(topic => ({
        ...topic,
        transcripts: transcriptions.filter(t => topic.transcriptIds.includes(t.id)),
      }));

      return NextResponse.json({ topics: enrichedTopics });
    }

    // For large datasets, batch by time proximity
    console.log('[Clustering] Large dataset, using batched processing');

    // Group by time proximity first
    const timeGroups = groupByTimeProximity(transcriptions);
    console.log('[Clustering] Created', timeGroups.length, 'time-proximity groups');

    // Create batches that fit within size limit
    const batches = createBatches(timeGroups);
    console.log('[Clustering] Created', batches.length, 'batches for processing');

    // Process batches sequentially to avoid rate limits
    const allTopics: TopicCluster[] = [];

    for (let i = 0; i < batches.length; i++) {
      try {
        const batchTopics = await processBatch(batches[i], contextSection, i, batches.length);
        allTopics.push(...batchTopics);

        // Small delay between batches to be nice to the API
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (batchError) {
        console.error(`[Clustering] Batch ${i + 1} failed:`, batchError);
        // Create fallback topic for failed batch
        const batch = batches[i];
        allTopics.push({
          id: `batch${i}_fallback`,
          title: `Conversations (Part ${i + 1})`,
          category: 'General',
          summary: 'Grouped conversations from this time period',
          sections: [],
          transcriptIds: batch.map(t => t.id),
          startTime: batch[0].date,
          endTime: batch[batch.length - 1].date,
        });
      }
    }

    console.log('[Clustering] Total topics generated:', allTopics.length);

    // Save to database if we have a date - store only IDs, not full transcripts
    if (date) {
      await supabase.from('topic_clusters').upsert({
        user_id: user.id,
        cluster_date: date,
        topics: allTopics,
        transcription_count: transcriptions.length,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,cluster_date',
      });
    }

    // Enrich topics with full transcript data for the response
    const enrichedTopics = allTopics.map(topic => ({
      ...topic,
      transcripts: transcriptions.filter(t => topic.transcriptIds.includes(t.id)),
    }));

    return NextResponse.json({ topics: enrichedTopics });
  } catch (error) {
    console.error('Clustering error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to cluster transcriptions: ${errorMessage}` },
      { status: 500 }
    );
  }
}
