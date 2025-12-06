import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Delete summaries that have been in trash for more than 15 days
    const cutoffDate = subDays(new Date(), 15);

    const { data: deletedSummaries, error } = await supabase
      .from('daily_summaries')
      .delete()
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Cleanup error:', error);
      return NextResponse.json(
        { error: 'Failed to cleanup trash' },
        { status: 500 }
      );
    }

    const deletedCount = deletedSummaries?.length || 0;

    console.log(`Cleaned up ${deletedCount} old trashed summaries`);

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Permanently deleted ${deletedCount} summaries from trash`,
    });
  } catch (error) {
    console.error('Cleanup cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to run cleanup cron job' },
      { status: 500 }
    );
  }
}
