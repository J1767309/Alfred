import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSummary } from '@/lib/claude/client';
import { EXTRACT_ITEMS_PROMPT } from '@/lib/claude/prompts';
import crypto from 'crypto';

interface ExtractedReminder {
  title: string;
  description: string;
  remind_at: string | null;
}

interface ExtractedTodo {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface ExtractedItems {
  reminders: ExtractedReminder[];
  todos: ExtractedTodo[];
}

function generateContentHash(type: string, title: string): string {
  const content = `${type}:${title.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, days = 7 } = await request.json();

    if (!type || !['reminders', 'todos', 'both'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Use "reminders", "todos", or "both"' }, { status: 400 });
    }

    // Get recent transcriptions (last N days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: transcriptions, error: fetchError } = await supabase
      .from('transcriptions')
      .select('id, date, transcription')
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString())
      .order('date', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    if (!transcriptions || transcriptions.length === 0) {
      return NextResponse.json({
        message: 'No transcriptions found in the specified time period',
        added: { reminders: 0, todos: 0 },
        skipped: { reminders: 0, todos: 0 },
      });
    }

    // Get already extracted items to avoid duplicates
    const { data: existingExtracted } = await supabase
      .from('extracted_items')
      .select('content_hash, item_type')
      .eq('user_id', user.id);

    const existingHashes = new Set(
      (existingExtracted || []).map(item => `${item.item_type}:${item.content_hash}`)
    );

    // Combine all transcriptions for analysis
    const combinedText = transcriptions
      .map(t => `[${new Date(t.date).toLocaleDateString()}]\n${t.transcription}`)
      .join('\n\n---\n\n');

    // Generate extraction using Claude
    const extractionResult = await generateSummary(
      EXTRACT_ITEMS_PROMPT,
      combinedText
    );

    // Parse the JSON response
    let extracted: ExtractedItems;
    try {
      const jsonMatch = extractionResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      return NextResponse.json({
        message: 'Failed to parse extraction results',
        added: { reminders: 0, todos: 0 },
        skipped: { reminders: 0, todos: 0 },
      });
    }

    const results = {
      added: { reminders: 0, todos: 0 },
      skipped: { reminders: 0, todos: 0 },
      items: { reminders: [] as ExtractedReminder[], todos: [] as ExtractedTodo[] },
    };

    // Process reminders
    if ((type === 'reminders' || type === 'both') && extracted.reminders) {
      for (const reminder of extracted.reminders) {
        const hash = generateContentHash('reminder', reminder.title);

        if (existingHashes.has(`reminder:${hash}`)) {
          results.skipped.reminders++;
          continue;
        }

        // Default remind_at to 24 hours from now if not specified
        const remindAt = reminder.remind_at
          ? new Date(reminder.remind_at).toISOString()
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // Insert the reminder
        const { error: insertError } = await supabase
          .from('reminders')
          .insert({
            user_id: user.id,
            title: reminder.title,
            description: reminder.description,
            remind_at: remindAt,
            source: 'alfred',
          });

        if (!insertError) {
          // Track the extraction
          await supabase.from('extracted_items').insert({
            user_id: user.id,
            item_type: 'reminder',
            content_hash: hash,
            transcription_id: transcriptions[0]?.id || null,
          });

          results.added.reminders++;
          results.items.reminders.push(reminder);
        }
      }
    }

    // Process todos
    if ((type === 'todos' || type === 'both') && extracted.todos) {
      for (const todo of extracted.todos) {
        const hash = generateContentHash('todo', todo.title);

        if (existingHashes.has(`todo:${hash}`)) {
          results.skipped.todos++;
          continue;
        }

        // Insert the todo
        const { error: insertError } = await supabase
          .from('todos')
          .insert({
            user_id: user.id,
            title: todo.title,
            description: todo.description,
            priority: todo.priority || 'medium',
            source: 'alfred',
          });

        if (!insertError) {
          // Track the extraction
          await supabase.from('extracted_items').insert({
            user_id: user.id,
            item_type: 'todo',
            content_hash: hash,
            transcription_id: transcriptions[0]?.id || null,
          });

          results.added.todos++;
          results.items.todos.push(todo);
        }
      }
    }

    return NextResponse.json({
      message: `Scan complete. Added ${results.added.reminders} reminders and ${results.added.todos} todos.`,
      added: results.added,
      skipped: results.skipped,
      items: results.items,
    });
  } catch (error) {
    console.error('Extract items error:', error);
    return NextResponse.json(
      { error: 'Failed to extract items from transcriptions' },
      { status: 500 }
    );
  }
}
