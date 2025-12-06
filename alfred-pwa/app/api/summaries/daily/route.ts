import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSummary } from '@/lib/claude/client';
import { DAILY_SUMMARY_PROMPT, buildContextPrompt } from '@/lib/claude/prompts';
import { getTranscriptionsForDate, getAboutMe, getEntities } from '@/lib/claude/context';
import { format } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await request.json();
    const targetDate = date ? new Date(date) : new Date();

    // Get transcriptions for the date
    const transcriptions = await getTranscriptionsForDate(user.id, targetDate);

    if (transcriptions.length === 0) {
      return NextResponse.json(
        { error: 'No transcriptions found for this date' },
        { status: 404 }
      );
    }

    // Get user context
    const [aboutMe, entities] = await Promise.all([
      getAboutMe(user.id),
      getEntities(user.id),
    ]);

    // Build context
    const userContext = buildContextPrompt(
      aboutMe,
      entities.map(e => ({
        name: e.name,
        type: e.type,
        relationship: e.relationship,
        notes: e.notes,
      })),
      []
    );

    // Combine all transcriptions
    const combinedTranscript = transcriptions
      .map(t => `[${format(new Date(t.date), 'h:mm a')}]\n${t.transcription}`)
      .join('\n\n---\n\n');

    // Generate summary
    const fullPrompt = `${userContext}\n\n## Today's Transcript\n\n${combinedTranscript}`;
    const summary = await generateSummary(DAILY_SUMMARY_PROMPT, fullPrompt, 8192);

    // Save the summary
    const summaryDate = format(targetDate, 'yyyy-MM-dd');

    const { data: savedSummary, error: saveError } = await supabase
      .from('daily_summaries')
      .upsert({
        user_id: user.id,
        summary_date: summaryDate,
        content: summary,
        transcription_ids: transcriptions.map(t => t.id),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,summary_date',
      })
      .select()
      .single();

    if (saveError) {
      throw saveError;
    }

    return NextResponse.json({ summary: savedSummary });
  } catch (error) {
    console.error('Daily summary error:', error);
    return NextResponse.json(
      { error: 'Failed to generate daily summary' },
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

    if (date) {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('summary_date', date)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return NextResponse.json({ summary: data });
    }

    // Get all summaries
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('summary_date', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ summaries: data });
  } catch (error) {
    console.error('Get daily summaries error:', error);
    return NextResponse.json(
      { error: 'Failed to get summaries' },
      { status: 500 }
    );
  }
}
