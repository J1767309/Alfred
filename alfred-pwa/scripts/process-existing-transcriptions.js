import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

async function processExistingTranscriptions() {
  // Get user_id from command line argument or environment variable
  const userId = process.argv[2] || process.env.DEFAULT_USER_ID;

  if (!userId) {
    console.log('Usage: node scripts/process-existing-transcriptions.js <user_id>');
    console.log('Or set DEFAULT_USER_ID environment variable.');
    console.log('\nTo find your user_id, check Supabase Dashboard > Authentication > Users');
    return;
  }

  console.log('Processing for user:', userId);

  // Fetch all transcriptions
  console.log('Fetching transcriptions...');
  const { data: transcriptions, error } = await supabase
    .from('transcriptions')
    .select('id, transcription, date')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching transcriptions:', error);
    return;
  }

  console.log(`Found ${transcriptions.length} transcriptions to process.\n`);

  let remindersCreated = 0;
  let todosCreated = 0;

  for (const t of transcriptions) {
    const lowerTranscription = t.transcription.toLowerCase();

    // Check for reminder triggers: "Alfred" + "remember" (but not "remember to do")
    if (lowerTranscription.includes('alfred') && lowerTranscription.includes('remember') && !lowerTranscription.includes('remember to do')) {
      const match = t.transcription.match(/alfred[,.]?\s*(?:i want you to\s+)?remember(?:\s+this|\s+that)?[:\s]+(.+)/i);
      if (match) {
        const reminderContent = match[1].trim();

        // Check if reminder already exists
        const { data: existing } = await supabase
          .from('reminders')
          .select('id')
          .eq('user_id', userId)
          .eq('description', reminderContent)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`[SKIP] Reminder already exists: "${reminderContent.slice(0, 50)}..."`);
          continue;
        }

        const { error: insertError } = await supabase.from('reminders').insert({
          user_id: userId,
          title: reminderContent.slice(0, 100),
          description: reminderContent,
          remind_at: t.date,
          reminder_type: 'one_time',
          source: 'alfred',
        });

        if (insertError) {
          console.error(`[ERROR] Creating reminder: ${insertError.message}`);
        } else {
          console.log(`[CREATED] Reminder: "${reminderContent.slice(0, 60)}..."`);
          remindersCreated++;
        }
      }
    }

    // Check for todo triggers: "Alfred" + "remember to do"
    if (lowerTranscription.includes('alfred') && lowerTranscription.includes('remember to do')) {
      const match = t.transcription.match(/alfred[,.]?\s*(?:help me(?:\s+to)?\s+)?remember to do[:\s]+(.+)/i);
      if (match) {
        const todoContent = match[1].trim();

        // Check if todo already exists
        const { data: existing } = await supabase
          .from('todos')
          .select('id')
          .eq('user_id', userId)
          .eq('description', todoContent)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`[SKIP] Todo already exists: "${todoContent.slice(0, 50)}..."`);
          continue;
        }

        const { error: insertError } = await supabase.from('todos').insert({
          user_id: userId,
          title: todoContent.slice(0, 100),
          description: todoContent,
          priority: 'medium',
          status: 'pending',
          source: 'alfred',
        });

        if (insertError) {
          console.error(`[ERROR] Creating todo: ${insertError.message}`);
        } else {
          console.log(`[CREATED] Todo: "${todoContent.slice(0, 60)}..."`);
          todosCreated++;
        }
      }
    }
  }

  console.log('\n========================================');
  console.log(`Processing complete!`);
  console.log(`Reminders created: ${remindersCreated}`);
  console.log(`Todos created: ${todosCreated}`);
}

processExistingTranscriptions().catch(console.error);
