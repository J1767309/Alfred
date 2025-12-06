'use client';

import { Todo, Priority, TodoStatus } from '@/types/database';
import { formatDate } from '@/lib/utils/dates';

interface TodoItemProps {
  todo: Todo;
  onStatusChange: (id: string, status: TodoStatus) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
}

const priorityColors: Record<Priority, string> = {
  high: 'border-red-500',
  medium: 'border-yellow-500',
  low: 'border-green-500',
};

const priorityBadges: Record<Priority, { bg: string; text: string }> = {
  high: { bg: 'bg-red-500/20', text: 'text-red-400' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  low: { bg: 'bg-green-500/20', text: 'text-green-400' },
};

export default function TodoItem({ todo, onStatusChange, onEdit, onDelete }: TodoItemProps) {
  const isCompleted = todo.status === 'completed';

  const handleToggle = () => {
    onStatusChange(todo.id, isCompleted ? 'pending' : 'completed');
  };

  return (
    <div
      className={`bg-dark-card border-l-4 ${priorityColors[todo.priority]} border border-dark-border rounded-lg p-4 transition ${
        isCompleted ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start space-x-3">
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          className={`flex-shrink-0 w-5 h-5 rounded border-2 mt-0.5 transition ${
            isCompleted
              ? 'bg-alfred-primary border-alfred-primary'
              : 'border-gray-500 hover:border-alfred-primary'
          }`}
        >
          {isCompleted && (
            <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3
                className={`font-medium ${
                  isCompleted ? 'line-through text-gray-500' : 'text-white'
                }`}
              >
                {todo.title}
              </h3>
              {todo.description && (
                <p className="text-sm text-gray-400 mt-1">{todo.description}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-1 ml-2">
              <button
                onClick={() => onEdit(todo)}
                className="p-1 text-gray-500 hover:text-white transition"
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(todo.id)}
                className="p-1 text-gray-500 hover:text-red-400 transition"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex items-center space-x-3 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs ${priorityBadges[todo.priority].bg} ${priorityBadges[todo.priority].text}`}>
              {todo.priority}
            </span>
            {todo.due_date && (
              <span className="text-xs text-gray-500">
                Due: {formatDate(todo.due_date, 'MMM d')}
              </span>
            )}
            {todo.source === 'alfred' && (
              <span className="text-xs text-alfred-secondary">via Alfred</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
