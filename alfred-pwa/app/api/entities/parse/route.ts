import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSummary } from '@/lib/claude/client';

export const maxDuration = 30;

const ENTITY_PARSE_PROMPT = `You are an assistant that extracts structured entity information from natural language descriptions.

Given a description of a person, organization, place, or other entity, extract the following fields:
- name: The name of the entity
- type: One of "person", "organization", "place", or "other"
- relationship: How this entity relates to the user (e.g., "Partner", "Employer", "Home")
- notes: Key facts or details about the entity
- context: Broader context about when/how this entity is relevant

Respond ONLY with valid JSON in this exact format:
{
  "name": "string",
  "type": "person" | "organization" | "place" | "other",
  "relationship": "string",
  "notes": "string",
  "context": "string"
}

If multiple entities are described, extract only the primary/first one.
Be concise but capture the essential information.`;

interface ParsedEntity {
  name: string;
  type: 'person' | 'organization' | 'place' | 'other';
  relationship: string;
  notes: string;
  context: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { description } = await request.json();

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const response = await generateSummary(
      ENTITY_PARSE_PROMPT,
      description,
      1024
    );

    // Parse the JSON response
    let parsed: ParsedEntity;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('Failed to parse Claude response:', response);
      return NextResponse.json(
        { error: 'Failed to parse entity from description' },
        { status: 500 }
      );
    }

    // Validate the parsed response
    const validTypes = ['person', 'organization', 'place', 'other'];
    if (!parsed.name || !validTypes.includes(parsed.type)) {
      return NextResponse.json(
        { error: 'Invalid entity data extracted' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      entity: {
        name: parsed.name || '',
        type: parsed.type || 'other',
        relationship: parsed.relationship || '',
        notes: parsed.notes || '',
        context: parsed.context || '',
      }
    });
  } catch (error) {
    console.error('Entity parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse entity description' },
      { status: 500 }
    );
  }
}
