'use client';

import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '@/types/database';
import { formatTimeAgo } from '@/lib/utils/dates';

interface MessageListProps {
  messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex items-start space-x-3 ${
            message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
          }`}
        >
          {/* Avatar */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.role === 'user' ? 'bg-dark-hover' : 'bg-alfred-primary'
            }`}
          >
            {message.role === 'user' ? (
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ) : (
              <span className="text-xs font-bold text-white">A</span>
            )}
          </div>

          {/* Message bubble */}
          <div className={`max-w-[85%] md:max-w-[80%] min-w-0 ${message.role === 'user' ? 'text-right' : ''}`}>
            <div
              className={
                message.role === 'user'
                  ? 'chat-bubble-user'
                  : 'chat-bubble-assistant'
              }
            >
              {message.role === 'assistant' ? (
                <div className="markdown-content prose prose-invert prose-sm max-w-none break-words overflow-hidden">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formatTimeAgo(message.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
