import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateSummary } from '@/lib/claude/client';
import { DAILY_SUMMARY_PROMPT, buildContextPrompt } from '@/lib/claude/prompts';
import { format, subHours } from 'date-fns';
import webpush from 'web-push';

// Configure web-push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'noreply@example.com'}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
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

    // Get all users with transcriptions today
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const { data: usersWithTranscriptions } = await supabase
      .from('transcriptions')
      .select('user_id')
      .gte('date', startOfDay.toISOString())
      .not('user_id', 'is', null);

    if (!usersWithTranscriptions || usersWithTranscriptions.length === 0) {
      return NextResponse.json({ message: 'No users with transcriptions today' });
    }

    // Get unique user IDs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userIds = Array.from(new Set(usersWithTranscriptions.map((t: any) => t.user_id)));

    const results: { userId: unknown; status: string; error?: string }[] = [];

    for (const userId of userIds) {
      try {
        // Get user's transcriptions for today
        const { data: transcriptions } = await supabase
          .from('transcriptions')
          .select('*')
          .eq('user_id', userId)
          .gte('date', startOfDay.toISOString())
          .order('date');

        if (!transcriptions || transcriptions.length === 0) continue;

        // Get user profile and entities
        const [profileResult, entitiesResult] = await Promise.all([
          supabase.from('user_profiles').select('about_me').eq('user_id', userId).single(),
          supabase.from('entities').select('*').eq('user_id', userId),
        ]);

        const aboutMe = profileResult.data?.about_me || null;
        const entities = entitiesResult.data || [];

        // Build context
        const userContext = buildContextPrompt(
          aboutMe,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entities.map((e: any) => ({
            name: e.name,
            type: e.type,
            relationship: e.relationship,
            notes: e.notes,
          })),
          []
        );

        // Combine transcriptions
        const combinedTranscript = transcriptions
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((t: any) => `[${format(new Date(t.date), 'h:mm a')}]\n${t.transcription}`)
          .join('\n\n---\n\n');

        // Generate summary
        const fullPrompt = `${userContext}\n\n## Today's Transcript\n\n${combinedTranscript}`;
        const summary = await generateSummary(DAILY_SUMMARY_PROMPT, fullPrompt, 8192);

        // Save summary
        const summaryDate = format(today, 'yyyy-MM-dd');

        await supabase.from('daily_summaries').upsert({
          user_id: userId,
          summary_date: summaryDate,
          content: summary,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transcription_ids: transcriptions.map((t: any) => t.id),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,summary_date',
        });

        // Send push notification
        const { data: pushSubscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', userId);

        if (pushSubscriptions && pushSubscriptions.length > 0) {
          for (const sub of pushSubscriptions) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: sub.keys as { p256dh: string; auth: string },
                },
                JSON.stringify({
                  title: 'Daily Summary Ready',
                  body: 'Your daily reflection is ready to view',
                  icon: '/icons/icon-192.png',
                  url: '/daily-summaries',
                })
              );
            } catch (pushError) {
              console.error('Push notification error:', pushError);
              // Remove invalid subscription
              if ((pushError as { statusCode?: number }).statusCode === 410) {
                await supabase.from('push_subscriptions').delete().eq('id', sub.id);
              }
            }
          }
        }

        results.push({ userId, status: 'success' });
      } catch (userError) {
        console.error(`Error processing user ${userId}:`, userError);
        results.push({ userId, status: 'error', error: String(userError) });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to run cron job' },
      { status: 500 }
    );
  }
}
