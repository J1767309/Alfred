'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '@/types/database';
import { formatTimeAgo } from '@/lib/utils/dates';

interface MessageListProps {
  messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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
            <div className={`flex items-center gap-2 mt-1 ${message.role === 'user' ? 'justify-end' : ''}`}>
              <p className="text-xs text-gray-500">
                {formatTimeAgo(message.created_at)}
              </p>
              {message.role === 'assistant' && (
                <button
                  onClick={() => handleCopy(message.id, message.content)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
                  title="Copy response"
                >
                  {copiedId === message.id ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-500">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
