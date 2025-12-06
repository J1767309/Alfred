'use client';

import { useState, useRef, useEffect } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 md:p-4 border-t border-dark-border bg-dark-card">
      <div className="flex items-end space-x-2 md:space-x-3">
        <div className="flex-1 relative min-w-0">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Alfred anything..."
            disabled={disabled}
            rows={1}
            className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-dark-bg border border-dark-border rounded-xl focus:ring-2 focus:ring-alfred-primary focus:border-transparent outline-none transition resize-none disabled:opacity-50 text-sm md:text-base"
          />
        </div>
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="p-2.5 md:p-3 bg-alfred-primary hover:bg-alfred-secondary text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2 hidden sm:block">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}
