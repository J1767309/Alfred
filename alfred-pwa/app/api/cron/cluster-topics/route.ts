import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateSummary } from '@/lib/claude/client';
import { formatInTimeZone } from 'date-fns-tz';
import { getCentralDayBoundariesUTC } from '@/lib/utils/dates';
import { getAboutMe, getEntities } from '@/lib/claude/context';
import { Entity } from '@/types/database';

const TIMEZONE = 'America/Chicago';

export const maxDuration = 300; // 5 minutes for batched processing

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
- Use entity context to correctly identify who is being discussed

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

interface TranscriptInput {
  id: string;
  date: string;
  transcription: string;
}

// Maximum transcripts per batch for Claude processing
const MAX_BATCH_SIZE = 40;
// Time gap (in minutes) to consider as a conversation break
const CONVERSATION_GAP_MINUTES = 30;

/**
 * Groups transcripts into time-based segments.
 */
function groupByTimeProximity(transcripts: TranscriptInput[]): TranscriptInput[][] {
  if (transcripts.length === 0) return [];

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
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
    } else {
      currentGroup.push(sorted[i]);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Combines time-proximity groups into batches that fit within MAX_BATCH_SIZE.
 */
function createBatches(timeGroups: TranscriptInput[][]): TranscriptInput[][] {
  const batches: TranscriptInput[][] = [];
  let currentBatch: TranscriptInput[] = [];

  for (const group of timeGroups) {
    if (group.length > MAX_BATCH_SIZE) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
      }
      for (let i = 0; i < group.length; i += MAX_BATCH_SIZE) {
        batches.push(group.slice(i, i + MAX_BATCH_SIZE));
      }
    } else if (currentBatch.length + group.length > MAX_BATCH_SIZE) {
      batches.push(currentBatch);
      currentBatch = [...group];
    } else {
      currentBatch.push(...group);
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Process a single batch of transcripts with Claude
 */
async function processBatch(
  transcripts: TranscriptInput[],
  contextSection: string,
  batchIndex: number,
  totalBatches: number
): Promise<TopicCluster[]> {
  const textLimit = 300;

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

Analyze these transcriptions and group them into topic clusters. Return the JSON array of clusters.`;

  console.log(`[Cron Clustering] Processing batch ${batchIndex + 1}/${totalBatches} with ${transcripts.length} transcripts`);

  const response = await generateSummary(CLUSTERING_PROMPT, userPrompt, 8192);

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((topic: TopicCluster, idx: number) => ({
          ...topic,
          id: `batch${batchIndex}_topic_${idx + 1}`,
        }));
      }
    }
  } catch (parseError) {
    console.error(`[Cron Clustering] Failed to parse batch ${batchIndex + 1} response:`, parseError);
  }

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

export async function GET(request: NextRequest) {
  console.log('[Cron Clustering] Starting scheduled clustering job');

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Get today's date in Central Time
    const todayStr = formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
    const { startUTC, endUTC } = getCentralDayBoundariesUTC(todayStr);

    console.log('[Cron Clustering] Processing date:', todayStr);

    // Get all users with transcriptions today
    const { data: usersWithTranscriptions } = await supabase
      .from('transcriptions')
      .select('user_id')
      .gte('date', startUTC)
      .lte('date', endUTC)
      .not('user_id', 'is', null);

    if (!usersWithTranscriptions || usersWithTranscriptions.length === 0) {
      return NextResponse.json({ message: 'No users with transcriptions today' });
    }

    const userIds = Array.from(new Set(usersWithTranscriptions.map((t: { user_id: string }) => t.user_id))) as string[];
    console.log('[Cron Clustering] Found', userIds.length, 'users with transcriptions');

    const results: { userId: string; status: string; topicCount?: number; error?: string }[] = [];

    for (const userId of userIds) {
      try {
        // Get user's transcriptions for today
        const { data: transcriptions, error: fetchError } = await supabase
          .from('transcriptions')
          .select('id, date, transcription, created_at')
          .eq('user_id', userId)
          .gte('date', startUTC)
          .lte('date', endUTC)
          .order('date', { ascending: true });

        if (fetchError) throw fetchError;
        if (!transcriptions || transcriptions.length === 0) continue;

        console.log(`[Cron Clustering] User ${userId}: ${transcriptions.length} transcriptions`);

        // Check if we already have recent clusters with same transcript count
        const { data: existingCluster } = await supabase
          .from('topic_clusters')
          .select('updated_at, transcription_count')
          .eq('user_id', userId)
          .eq('cluster_date', todayStr)
          .single();

        if (existingCluster) {
          const lastUpdate = new Date(existingCluster.updated_at);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

          if (lastUpdate > hourAgo && existingCluster.transcription_count === transcriptions.length) {
            console.log(`[Cron Clustering] User ${userId}: Skipping - recent clusters exist`);
            results.push({ userId, status: 'skipped', topicCount: 0 });
            continue;
          }
        }

        // Get user context
        const [aboutMe, entities] = await Promise.all([
          getAboutMe(userId),
          getEntities(userId),
        ]);

        // Build context section
        const contextParts: string[] = [];
        if (aboutMe) {
          contextParts.push(`## About the User\n${aboutMe}`);
        }
        if (entities.length > 0) {
          const entityList = entities.map((e: Entity) => {
            const parts = [`- ${e.name} (${e.type})`];
            if (e.relationship) parts[0] += `: ${e.relationship}`;
            if (e.notes) parts.push(`  Notes: ${e.notes}`);
            return parts.join('\n');
          }).join('\n');
          contextParts.push(`## Known Entities\n${entityList}`);
        }
        const contextSection = contextParts.length > 0
          ? `# User Context\n\n${contextParts.join('\n\n')}\n\n---\n\n`
          : '';

        let allTopics: TopicCluster[] = [];

        // For small datasets, process in one shot
        if (transcriptions.length <= MAX_BATCH_SIZE) {
          allTopics = await processBatch(transcriptions, contextSection, 0, 1);
        } else {
          // For large datasets, batch by time proximity
          const timeGroups = groupByTimeProximity(transcriptions);
          const batches = createBatches(timeGroups);
          console.log(`[Cron Clustering] User ${userId}: Processing ${batches.length} batches`);

          for (let i = 0; i < batches.length; i++) {
            try {
              const batchTopics = await processBatch(batches[i], contextSection, i, batches.length);
              allTopics.push(...batchTopics);

              if (i < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } catch (batchError) {
              console.error(`[Cron Clustering] Batch ${i + 1} failed for user ${userId}:`, batchError);
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
        }

        // Enrich topics with full transcript data
        const enrichedTopics = allTopics.map(topic => ({
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

        console.log(`[Cron Clustering] User ${userId}: Generated ${allTopics.length} topics`);
        results.push({ userId, status: 'success', topicCount: allTopics.length });
      } catch (userError) {
        console.error(`[Cron Clustering] Error processing user ${userId}:`, userError);
        results.push({ userId, status: 'error', error: String(userError) });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} users`,
      results
    });
  } catch (error) {
    console.error('[Cron Clustering] Job error:', error);
    return NextResponse.json(
      { error: 'Failed to run clustering cron job' },
      { status: 500 }
    );
  }
}
