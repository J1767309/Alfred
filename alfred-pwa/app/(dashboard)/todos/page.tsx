'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Todo, Priority, TodoStatus } from '@/types/database';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import TodoItem from '@/components/todos/TodoItem';
import TodoForm from '@/components/todos/TodoForm';

type FilterStatus = 'all' | 'pending' | 'completed';

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | undefined>(undefined);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error) {
      console.error('Error loading todos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: {
    title: string;
    description: string;
    priority: Priority;
    due_date: string | null;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (editingTodo) {
      const { error } = await supabase
        .from('todos')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingTodo.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('todos')
        .insert({
          ...data,
          user_id: user.id,
          source: 'manual',
        });

      if (error) throw error;
    }

    setIsModalOpen(false);
    setEditingTodo(undefined);
    loadTodos();
  };

  const handleStatusChange = async (id: string, status: TodoStatus) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      loadTodos();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleEdit = (todo: Todo) => {
    setEditingTodo(todo);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this to-do?')) return;

    try {
      await supabase.from('todos').delete().eq('id', id);
      loadTodos();
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTodo(undefined);
  };

  const handleScanTranscripts = async () => {
    setScanning(true);
    setScanMessage(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'todos', days: 7 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan transcripts');
      }

      setScanMessage(
        data.added.todos > 0
          ? `Added ${data.added.todos} to-do${data.added.todos !== 1 ? 's' : ''}${data.skipped.todos > 0 ? ` (${data.skipped.todos} already existed)` : ''}`
          : data.skipped.todos > 0
          ? `No new to-dos found (${data.skipped.todos} already existed)`
          : 'No to-dos found in recent transcripts'
      );

      loadTodos();
    } catch (error) {
      console.error('Error scanning transcripts:', error);
      setScanMessage('Failed to scan transcripts');
    } finally {
      setScanning(false);
      setTimeout(() => setScanMessage(null), 5000);
    }
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'all') return true;
    if (filter === 'pending') return todo.status !== 'completed';
    return todo.status === 'completed';
  });

  const pendingCount = todos.filter(t => t.status !== 'completed').length;
  const completedCount = todos.filter(t => t.status === 'completed').length;

  return (
    <>
      <Header
        title="To-dos"
        subtitle={`${pendingCount} pending, ${completedCount} completed`}
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
            <Button onClick={() => setIsModalOpen(true)}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add To-do
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Filter tabs */}
        <div className="flex space-x-2 mb-6">
          {(['all', 'pending', 'completed'] as const).map((status) => (
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
                ({status === 'all' ? todos.length : status === 'pending' ? pendingCount : completedCount})
              </span>
            </button>
          ))}
        </div>

        {/* Scan message */}
        {scanMessage && (
          <div className="mb-4 px-4 py-2 bg-dark-card border border-dark-border rounded-lg text-sm text-gray-300 max-w-2xl">
            {scanMessage}
          </div>
        )}

        {loading ? (
          <div className="space-y-3 max-w-2xl">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-dark-card border border-dark-border rounded-lg p-4 animate-pulse">
                <div className="flex items-start space-x-3">
                  <div className="w-5 h-5 bg-dark-hover rounded"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-dark-hover rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-dark-hover rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {filter === 'all' ? 'No to-dos yet' : `No ${filter} to-dos`}
            </h3>
            <p className="text-gray-400 mb-4">
              {filter === 'all'
                ? 'Create your first to-do or let Alfred add them from your conversations'
                : filter === 'pending'
                ? 'All caught up!'
                : 'Complete some to-dos to see them here'}
            </p>
            {filter === 'all' && (
              <Button onClick={() => setIsModalOpen(true)}>Add Your First To-do</Button>
            )}
          </div>
        ) : (
          <div className="max-w-2xl space-y-3">
            {filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onStatusChange={handleStatusChange}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTodo ? 'Edit To-do' : 'Add To-do'}
      >
        <TodoForm
          todo={editingTodo}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
        />
      </Modal>
    </>
  );
}
