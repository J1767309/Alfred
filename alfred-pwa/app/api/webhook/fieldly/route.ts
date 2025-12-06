import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Chicago'; // Central Time

// Create a Supabase client for webhook (no cookies needed)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log('Received Fieldly webhook payload:', JSON.stringify(payload, null, 2));

    // Validate payload structure
    if (!payload.date || !payload.transcription) {
      return NextResponse.json(
        { error: 'Invalid payload: missing required fields' },
        { status: 400 }
      );
    }

    // Convert the UTC date to Central Time for storage
    // This ensures the date field shows the correct day in Central Time
    const utcDate = new Date(payload.date);
    const centralTimeDate = formatInTimeZone(utcDate, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

    // Store the transcription in Supabase
    const { data, error } = await supabase
      .from('transcriptions')
      .insert({
        date: centralTimeDate,
        transcription: payload.transcription,
        transcriptions: payload.transcriptions || [],
        raw_payload: payload
      })
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to store transcription' },
        { status: 500 }
      );
    }

    console.log('Stored transcription:', data);
    return NextResponse.json({ success: true, id: data[0]?.id });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check for the webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'fieldly-webhook',
    timestamp: new Date().toISOString()
  });
}
