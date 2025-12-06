'use client';

import { useState } from 'react';
import { Entity, EntityType } from '@/types/database';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import Select from '@/components/ui/Select';

interface EntityFormProps {
  entity?: Entity;
  onSubmit: (data: {
    name: string;
    type: EntityType;
    relationship: string;
    notes: string;
    context: string;
  }) => Promise<void>;
  onCancel: () => void;
}

const entityTypes: { value: EntityType; label: string }[] = [
  { value: 'person', label: 'Person' },
  { value: 'organization', label: 'Organization' },
  { value: 'place', label: 'Place' },
  { value: 'other', label: 'Other' },
];

export default function EntityForm({ entity, onSubmit, onCancel }: EntityFormProps) {
  const [name, setName] = useState(entity?.name || '');
  const [type, setType] = useState<EntityType>(entity?.type || 'person');
  const [relationship, setRelationship] = useState(entity?.relationship || '');
  const [notes, setNotes] = useState(entity?.notes || '');
  const [context, setContext] = useState(entity?.context || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI mode state
  const [mode, setMode] = useState<'manual' | 'ai'>(entity ? 'manual' : 'ai');
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleAiParse = async () => {
    if (!aiDescription.trim()) {
      setError('Please enter a description');
      return;
    }

    setAiLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/entities/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiDescription }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to parse description');
      }

      const { entity: parsed } = await response.json();

      // Populate the form fields
      setName(parsed.name);
      setType(parsed.type);
      setRelationship(parsed.relationship);
      setNotes(parsed.notes);
      setContext(parsed.context);

      // Switch to manual mode so user can review/edit
      setMode('manual');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse description');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        type,
        relationship: relationship.trim(),
        notes: notes.trim(),
        context: context.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entity');
      setLoading(false);
    }
  };

  const getRelationshipPlaceholder = () => {
    switch (type) {
      case 'person':
        return 'e.g., Partner, Son, Colleague, Friend';
      case 'organization':
        return 'e.g., Employer, Client, Vendor';
      case 'place':
        return 'e.g., Home, Office, Favorite Restaurant';
      default:
        return 'Describe the relationship';
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle - only show for new entities */}
      {!entity && (
        <div className="flex bg-dark-hover rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition ${
              mode === 'ai'
                ? 'bg-alfred-primary text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Assist
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition ${
              mode === 'manual'
                ? 'bg-alfred-primary text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Manual
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* AI Mode */}
      {mode === 'ai' && !entity && (
        <div className="space-y-4">
          <div className="bg-dark-hover/50 rounded-lg p-4 border border-dark-border">
            <p className="text-sm text-gray-400 mb-3">
              Describe the entity in natural language and AI will extract the details for you.
            </p>
            <TextArea
              label=""
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder="e.g., My partner Misa is a dancer who performs at Asian Mall and Mall of America. She also runs a press-on nail business."
              rows={4}
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAiParse}
              loading={aiLoading}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Extract Entity
            </Button>
          </div>
        </div>
      )}

      {/* Manual Mode / Edit Mode */}
      {(mode === 'manual' || entity) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'manual' && !entity && name && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              AI extracted the entity details. Review and edit as needed.
            </div>
          )}

          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Misa, Noble Investment Group"
            required
          />

          <Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as EntityType)}
            options={entityTypes}
          />

          <Input
            label="Relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder={getRelationshipPlaceholder()}
          />

          <TextArea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Quick notes about this entity"
            rows={3}
          />

          <TextArea
            label="Context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Additional context that helps Alfred understand this entity better"
            rows={4}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {entity ? 'Update' : 'Add'} Entity
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
