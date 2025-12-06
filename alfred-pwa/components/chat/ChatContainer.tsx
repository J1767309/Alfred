'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage, ChatSession } from '@/types/database';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ChatHistory from './ChatHistory';

export default function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    }
  }, [currentSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get distinct sessions with their latest message
      const { data } = await supabase
        .from('chat_history')
        .select('session_id, content, created_at, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        // Group by session and get first message of each
        const sessionMap = new Map<string, ChatSession>();
        data.forEach(msg => {
          if (!sessionMap.has(msg.session_id)) {
            sessionMap.set(msg.session_id, {
              id: msg.session_id,
              title: msg.role === 'user' ? msg.content.slice(0, 50) : 'New Chat',
              lastMessage: msg.content.slice(0, 100),
              createdAt: msg.created_at,
              messageCount: 1,
            });
          } else {
            const session = sessionMap.get(msg.session_id)!;
            session.messageCount++;
            if (msg.role === 'user' && session.title === 'New Chat') {
              session.title = msg.content.slice(0, 50);
            }
          }
        });

        const sessionsArray = Array.from(sessionMap.values());
        setSessions(sessionsArray);

        // Set current session to most recent or create new
        if (sessionsArray.length > 0 && !currentSessionId) {
          setCurrentSessionId(sessionsArray[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleNewChat = () => {
    const newSessionId = crypto.randomUUID();
    setCurrentSessionId(newSessionId);
    setMessages([]);
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this chat?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('chat_history')
        .delete()
        .eq('user_id', user.id)
        .eq('session_id', sessionId);

      setSessions(prev => prev.filter(s => s.id !== sessionId));

      if (currentSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const sessionId = currentSessionId || crypto.randomUUID();
    if (!currentSessionId) {
      setCurrentSessionId(sessionId);
    }

    // Add user message optimistically
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      user_id: '',
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          sessionId,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        user_id: '',
        session_id: sessionId,
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Update sessions list
      loadSessions();
    } catch (error) {
      console.error('Error sending message:', error);
      // Show error as assistant message
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        user_id: '',
        session_id: sessionId,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Failed to get response'}. Please try again.`,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev.slice(0, -1), prev[prev.length - 1], errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Chat history sidebar */}
      <ChatHistory
        sessions={sessions}
        currentSessionId={currentSessionId}
        loading={loadingHistory}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile history toggle */}
        <div className="md:hidden flex items-center justify-between p-2 border-b border-dark-border bg-dark-card">
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-dark-hover rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>History</span>
          </button>
          <button
            onClick={handleNewChat}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-alfred-primary hover:bg-alfred-secondary text-white rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New</span>
          </button>
        </div>
        {/* Messages */}
        <div className="flex-1 overflow-auto p-3 md:p-4">
          {messages.length === 0 && !loading ? (
            <div className="h-full flex items-center justify-center px-4">
              <div className="text-center max-w-md">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-alfred-primary/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                  <svg className="w-6 h-6 md:w-8 md:h-8 text-alfred-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-lg md:text-xl font-semibold text-white mb-2">Hello! I'm Alfred.</h2>
                <p className="text-sm md:text-base text-gray-400 mb-3 md:mb-4">
                  Your personal AI assistant. I can help you search through your transcriptions,
                  remember important details, and manage your tasks.
                </p>
                <div className="text-xs md:text-sm text-gray-500 space-y-2">
                  <p>Try asking me:</p>
                  <ul className="space-y-1 text-left mx-auto max-w-xs">
                    <li>"What did Misa say about her appointment?"</li>
                    <li>"Summarize yesterday's conversations"</li>
                    <li>"Alfred, remember to call the doctor"</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <>
              <MessageList messages={messages} />
              {loading && (
                <div className="flex items-start space-x-3 mb-4">
                  <div className="w-8 h-8 bg-alfred-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">A</span>
                  </div>
                  <div className="chat-bubble-assistant">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <MessageInput onSend={handleSendMessage} disabled={loading} />
      </div>
    </div>
  );
}
