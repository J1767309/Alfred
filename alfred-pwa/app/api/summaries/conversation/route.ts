import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSummary } from '@/lib/claude/client';
import { CONVERSATION_SUMMARY_PROMPT } from '@/lib/claude/prompts';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transcriptionId } = await request.json();

    if (!transcriptionId) {
      return NextResponse.json({ error: 'Missing transcriptionId' }, { status: 400 });
    }

    // Get the transcription
    const { data: transcription, error: fetchError } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('id', transcriptionId)
      .single();

    if (fetchError || !transcription) {
      return NextResponse.json({ error: 'Transcription not found' }, { status: 404 });
    }

    // Generate summary using Claude
    const summaryJson = await generateSummary(
      CONVERSATION_SUMMARY_PROMPT,
      transcription.transcription
    );

    // Parse the JSON response
    let parsedSummary;
    try {
      // Extract JSON from the response (in case it's wrapped in markdown)
      const jsonMatch = summaryJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedSummary = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      // If parsing fails, create a basic summary
      parsedSummary = {
        title: 'Conversation Summary',
        participants: [],
        summary: summaryJson.slice(0, 500),
        key_points: [],
        action_items: [],
      };
    }

    // Save the summary
    const { data: savedSummary, error: saveError } = await supabase
      .from('conversation_summaries')
      .insert({
        user_id: user.id,
        transcription_id: transcriptionId,
        title: parsedSummary.title,
        participants: parsedSummary.participants,
        summary: parsedSummary.summary,
        key_points: parsedSummary.key_points,
        action_items: parsedSummary.action_items,
        conversation_date: transcription.date,
      })
      .select()
      .single();

    if (saveError) {
      throw saveError;
    }

    return NextResponse.json({ summary: savedSummary });
  } catch (error) {
    console.error('Conversation summary error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    let query = supabase
      .from('conversation_summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('conversation_date', { ascending: false });

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query = query
        .gte('conversation_date', startOfDay.toISOString())
        .lte('conversation_date', endOfDay.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ summaries: data });
  } catch (error) {
    console.error('Get summaries error:', error);
    return NextResponse.json(
      { error: 'Failed to get summaries' },
      { status: 500 }
    );
  }
}
