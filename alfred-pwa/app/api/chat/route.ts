import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chat } from '@/lib/claude/client';
import { ALFRED_SYSTEM_PROMPT, buildContextPrompt } from '@/lib/claude/prompts';
import { buildFullContext } from '@/lib/claude/context';
import { ChatMessage } from '@/types/database';

// Extend function timeout for Claude API calls (max 60s on Hobby, 300s on Pro)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, sessionId, history } = await request.json();

    if (!message || !sessionId) {
      return NextResponse.json({ error: 'Missing message or sessionId' }, { status: 400 });
    }

    // Build context from user profile, entities, and relevant transcriptions
    console.log('Building context for user:', user.id);
    let context;
    try {
      context = await buildFullContext(user.id, message);
      console.log('Context built successfully:', {
        hasAboutMe: !!context.aboutMe,
        entitiesCount: context.entities.length,
        transcriptionsCount: context.transcriptions.length,
      });
    } catch (contextError) {
      console.error('Context build error:', contextError);
      throw new Error(`Failed to build context: ${contextError instanceof Error ? contextError.message : 'Unknown'}`);
    }

    // Build the context prompt
    const contextPrompt = buildContextPrompt(
      context.aboutMe,
      context.entities.map(e => ({
        name: e.name,
        type: e.type,
        relationship: e.relationship,
        notes: e.notes,
      })),
      context.transcriptions.map(t => ({
        date: new Date(t.date).toLocaleDateString(),
        transcription: t.transcription,
      }))
    );

    // Combine system prompt with context
    const fullSystemPrompt = `${ALFRED_SYSTEM_PROMPT}\n\n${contextPrompt}`;

    // Build message history
    const messages = [
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Get response from Claude
    console.log('Calling Claude API...');
    let response;
    try {
      response = await chat({
        systemPrompt: fullSystemPrompt,
        messages,
      });
      console.log('Claude response received, length:', response.length);
    } catch (claudeError) {
      console.error('Claude API error:', claudeError);
      throw new Error(`Claude API failed: ${claudeError instanceof Error ? claudeError.message : 'Unknown'}`);
    }

    // Save user message
    await supabase.from('chat_history').insert({
      user_id: user.id,
      session_id: sessionId,
      role: 'user',
      content: message,
    });

    // Save assistant response
    await supabase.from('chat_history').insert({
      user_id: user.id,
      session_id: sessionId,
      role: 'assistant',
      content: response,
    });

    // Check for "Alfred, remember" or "Alfred, add to my to-do" patterns
    await handleSpecialCommands(user.id, message, supabase);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to process chat: ${errorMessage}` },
      { status: 500 }
    );
  }
}

async function handleSpecialCommands(
  userId: string,
  message: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const lowerMessage = message.toLowerCase();

  // Check for reminder triggers: "Alfred" + "remember" in any form
  // Skip if this is a "remember to do" (todo trigger)
  if (lowerMessage.includes('alfred') && lowerMessage.includes('remember') && !lowerMessage.includes('remember to do')) {
    // Extract content after various "remember" patterns
    const match = message.match(/alfred[,.]?\s*(?:i want you to\s+)?remember(?:\s+this|\s+that)?[:\s]+(.+)/i);
    if (match) {
      const reminderContent = match[1].trim();
      await supabase.from('reminders').insert({
        user_id: userId,
        title: reminderContent.slice(0, 100),
        description: reminderContent,
        remind_at: new Date().toISOString(),
        reminder_type: 'one_time',
        source: 'alfred',
      });
    }
  }

  // Check for todo triggers: "Alfred" + "remember to do"
  if (lowerMessage.includes('alfred') && lowerMessage.includes('remember to do')) {
    const match = message.match(/alfred[,.]?\s*(?:help me(?:\s+to)?\s+)?remember to do[:\s]+(.+)/i);
    if (match) {
      const todoContent = match[1].trim();
      await supabase.from('todos').insert({
        user_id: userId,
        title: todoContent.slice(0, 100),
        description: todoContent,
        priority: 'medium',
        status: 'pending',
        source: 'alfred',
      });
    }
  }
}
