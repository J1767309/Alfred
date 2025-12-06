'use client';

import { ChatSession } from '@/types/database';
import { formatTimeAgo } from '@/lib/utils/dates';

interface ChatHistoryProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  loading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export default function ChatHistory({
  sessions,
  currentSessionId,
  loading,
  isOpen,
  onClose,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: ChatHistoryProps) {
  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    onClose();
  };

  const handleNewChat = () => {
    onNewChat();
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-dark-card border-r border-dark-border flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-dark-border flex items-center justify-between">
          <button
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-alfred-primary hover:bg-alfred-secondary text-white rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Chat</span>
          </button>
          <button
            onClick={onClose}
            className="ml-2 p-2 hover:bg-dark-hover rounded-lg transition md:hidden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-auto p-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-lg animate-pulse">
                  <div className="h-4 bg-dark-hover rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-dark-hover rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              <p>No chat history</p>
              <p className="mt-1">Start a new conversation!</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {sessions.map((session) => (
                <li key={session.id}>
                  <div
                    className={`group p-3 rounded-lg cursor-pointer transition ${
                      currentSessionId === session.id
                        ? 'bg-alfred-primary/20 border border-alfred-primary/30'
                        : 'hover:bg-dark-hover'
                    }`}
                    onClick={() => handleSelectSession(session.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {session.title || 'New Chat'}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-1">
                          {session.lastMessage}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {formatTimeAgo(session.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                        title="Delete chat"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
