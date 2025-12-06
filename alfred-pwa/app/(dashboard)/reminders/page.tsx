'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Reminder, Entity } from '@/types/database';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import { formatDate, formatRelative } from '@/lib/utils/dates';

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | undefined>(undefined);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const supabase = createClient();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [entityId, setEntityId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [remindersResult, entitiesResult] = await Promise.all([
        supabase
          .from('reminders')
          .select('*')
          .eq('user_id', user.id)
          .order('remind_at', { ascending: true }),
        supabase
          .from('entities')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),
      ]);

      setReminders(remindersResult.data || []);
      setEntities(entitiesResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (reminder?: Reminder) => {
    if (reminder) {
      setEditingReminder(reminder);
      setTitle(reminder.title);
      setDescription(reminder.description || '');
      setRemindAt(new Date(reminder.remind_at).toISOString().slice(0, 16));
      setEntityId(reminder.entity_id || '');
    } else {
      setEditingReminder(undefined);
      setTitle('');
      setDescription('');
      setRemindAt('');
      setEntityId('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingReminder(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !remindAt) return;

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const data = {
        title: title.trim(),
        description: description.trim() || null,
        remind_at: new Date(remindAt).toISOString(),
        entity_id: entityId || null,
      };

      if (editingReminder) {
        await supabase.from('reminders').update(data).eq('id', editingReminder.id);
      } else {
        await supabase.from('reminders').insert({
          ...data,
          user_id: user.id,
          source: 'manual',
        });
      }

      handleCloseModal();
      loadData();
    } catch (error) {
      console.error('Error saving reminder:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;

    try {
      await supabase.from('reminders').delete().eq('id', id);
      loadData();
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await supabase.from('reminders').update({ is_triggered: true }).eq('id', id);
      loadData();
    } catch (error) {
      console.error('Error dismissing reminder:', error);
    }
  };

  const handleScanTranscripts = async () => {
    setScanning(true);
    setScanMessage(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reminders', days: 7 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan transcripts');
      }

      setScanMessage(
        data.added.reminders > 0
          ? `Added ${data.added.reminders} reminder${data.added.reminders !== 1 ? 's' : ''}${data.skipped.reminders > 0 ? ` (${data.skipped.reminders} already existed)` : ''}`
          : data.skipped.reminders > 0
          ? `No new reminders found (${data.skipped.reminders} already existed)`
          : 'No reminders found in recent transcripts'
      );

      loadData();
    } catch (error) {
      console.error('Error scanning transcripts:', error);
      setScanMessage('Failed to scan transcripts');
    } finally {
      setScanning(false);
      setTimeout(() => setScanMessage(null), 5000);
    }
  };

  const now = new Date();
  const filteredReminders = reminders.filter(r => {
    const reminderDate = new Date(r.remind_at);
    if (filter === 'upcoming') return reminderDate >= now && !r.is_triggered;
    if (filter === 'past') return reminderDate < now || r.is_triggered;
    return true;
  });

  const upcomingCount = reminders.filter(r => new Date(r.remind_at) >= now && !r.is_triggered).length;
  const pastCount = reminders.filter(r => new Date(r.remind_at) < now || r.is_triggered).length;

  const getEntityName = (entityId: string | null) => {
    if (!entityId) return null;
    return entities.find(e => e.id === entityId)?.name || null;
  };

  return (
    <>
      <Header
        title="Reminders"
        subtitle={`${upcomingCount} upcoming`}
        actions={
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              onClick={handleScanTranscripts}
              disabled={scanning}
            >
              {scanning ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Scan Transcripts
                </>
              )}
            </Button>
            <Button onClick={() => handleOpenModal()}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Reminder
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Filter tabs */}
        <div className="flex space-x-2 mb-6">
          {(['upcoming', 'past', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === status
                  ? 'bg-alfred-primary text-white'
                  : 'bg-dark-card text-gray-400 hover:text-white'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-2 text-xs opacity-70">
                ({status === 'all' ? reminders.length : status === 'upcoming' ? upcomingCount : pastCount})
              </span>
            </button>
          ))}
        </div>

        {/* Scan message */}
        {scanMessage && (
          <div className="mb-4 px-4 py-2 bg-dark-card border border-dark-border rounded-lg text-sm text-gray-300">
            {scanMessage}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-dark-card border border-dark-border rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-dark-hover rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-dark-hover rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No reminders</h3>
            <p className="text-gray-400 mb-4">
              Create reminders or let Alfred add them from your conversations
            </p>
            <Button onClick={() => handleOpenModal()}>Add Your First Reminder</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReminders.map((reminder) => {
              const isPast = new Date(reminder.remind_at) < now;
              const entityName = getEntityName(reminder.entity_id);

              return (
                <Card key={reminder.id} className={`p-4 ${isPast || reminder.is_triggered ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-white">{reminder.title}</h3>
                      {reminder.description && (
                        <p className="text-sm text-gray-400 mt-1">{reminder.description}</p>
                      )}
                      <div className="flex items-center space-x-2 mt-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-gray-400">
                          {formatRelative(reminder.remind_at)}
                        </span>
                      </div>
                      {entityName && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-dark-hover rounded text-xs text-gray-400">
                          {entityName}
                        </span>
                      )}
                      {reminder.source === 'alfred' && (
                        <span className="inline-block mt-2 ml-2 text-xs text-alfred-secondary">
                          via Alfred
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col space-y-1">
                      {!reminder.is_triggered && !isPast && (
                        <button
                          onClick={() => handleDismiss(reminder.id)}
                          className="p-1 text-gray-500 hover:text-green-400 transition"
                          title="Mark as done"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenModal(reminder)}
                        className="p-1 text-gray-500 hover:text-white transition"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(reminder.id)}
                        className="p-1 text-gray-500 hover:text-red-400 transition"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingReminder ? 'Edit Reminder' : 'Add Reminder'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to remember?"
            required
          />

          <TextArea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more details..."
            rows={3}
          />

          <Input
            label="Remind At"
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            required
          />

          <Select
            label="Related To (optional)"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            options={[
              { value: '', label: 'None' },
              ...entities.map(e => ({ value: e.id, label: `${e.name} (${e.type})` })),
            ]}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingReminder ? 'Update' : 'Add'} Reminder
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
