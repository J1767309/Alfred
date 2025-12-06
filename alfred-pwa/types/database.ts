export interface Database {
  public: {
    Tables: {
      transcriptions: {
        Row: {
          id: string;
          user_id: string | null;
          date: string;
          transcription: string;
          transcriptions: TranscriptionItem[] | null;
          raw_payload: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          date: string;
          transcription: string;
          transcriptions?: TranscriptionItem[] | null;
          raw_payload?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          date?: string;
          transcription?: string;
          transcriptions?: TranscriptionItem[] | null;
          raw_payload?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
      entities: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: EntityType;
          relationship: string | null;
          notes: string | null;
          context: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: EntityType;
          relationship?: string | null;
          notes?: string | null;
          context?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: EntityType;
          relationship?: string | null;
          notes?: string | null;
          context?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          about_me: string | null;
          preferences: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          about_me?: string | null;
          preferences?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          about_me?: string | null;
          preferences?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_history: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          created_at?: string;
        };
      };
      daily_summaries: {
        Row: {
          id: string;
          user_id: string;
          summary_date: string;
          content: string;
          raw_analysis: Record<string, unknown> | null;
          transcription_ids: string[] | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          summary_date: string;
          content: string;
          raw_analysis?: Record<string, unknown> | null;
          transcription_ids?: string[] | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          summary_date?: string;
          content?: string;
          raw_analysis?: Record<string, unknown> | null;
          transcription_ids?: string[] | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      conversation_summaries: {
        Row: {
          id: string;
          user_id: string;
          transcription_id: string;
          title: string | null;
          participants: string[] | null;
          summary: string;
          key_points: Record<string, unknown> | null;
          action_items: Record<string, unknown> | null;
          conversation_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          transcription_id: string;
          title?: string | null;
          participants?: string[] | null;
          summary: string;
          key_points?: Record<string, unknown> | null;
          action_items?: Record<string, unknown> | null;
          conversation_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          transcription_id?: string;
          title?: string | null;
          participants?: string[] | null;
          summary?: string;
          key_points?: Record<string, unknown> | null;
          action_items?: Record<string, unknown> | null;
          conversation_date?: string;
          created_at?: string;
        };
      };
      todos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          priority: Priority;
          status: TodoStatus;
          due_date: string | null;
          source: TodoSource | null;
          source_id: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          priority?: Priority;
          status?: TodoStatus;
          due_date?: string | null;
          source?: TodoSource | null;
          source_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          priority?: Priority;
          status?: TodoStatus;
          due_date?: string | null;
          source?: TodoSource | null;
          source_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          reminder_type: ReminderType;
          remind_at: string;
          recurrence_rule: string | null;
          entity_id: string | null;
          is_triggered: boolean;
          source: ReminderSource | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          reminder_type?: ReminderType;
          remind_at: string;
          recurrence_rule?: string | null;
          entity_id?: string | null;
          is_triggered?: boolean;
          source?: ReminderSource | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          reminder_type?: ReminderType;
          remind_at?: string;
          recurrence_rule?: string | null;
          entity_id?: string | null;
          is_triggered?: boolean;
          source?: ReminderSource | null;
          created_at?: string;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          keys: PushKeys;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          keys: PushKeys;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          keys?: PushKeys;
          created_at?: string;
        };
      };
      extracted_items: {
        Row: {
          id: string;
          user_id: string;
          item_type: ExtractedItemType;
          content_hash: string;
          transcription_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_type: ExtractedItemType;
          content_hash: string;
          transcription_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_type?: ExtractedItemType;
          content_hash?: string;
          transcription_id?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

// Enum types
export type EntityType = 'person' | 'organization' | 'place' | 'other';
export type Priority = 'high' | 'medium' | 'low';
export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export type TodoSource = 'manual' | 'alfred' | 'daily_summary';
export type ReminderType = 'one_time' | 'recurring';
export type ReminderSource = 'manual' | 'alfred';
export type ExtractedItemType = 'reminder' | 'todo';

// Helper types
export interface TranscriptionItem {
  speaker?: string;
  text: string;
  timestamp?: string;
}

export interface PushKeys {
  p256dh: string;
  auth: string;
}

// Convenience types
export type Entity = Database['public']['Tables']['entities']['Row'];
export type EntityInsert = Database['public']['Tables']['entities']['Insert'];
export type EntityUpdate = Database['public']['Tables']['entities']['Update'];

export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

export type ChatMessage = Database['public']['Tables']['chat_history']['Row'];
export type ChatMessageInsert = Database['public']['Tables']['chat_history']['Insert'];

export type DailySummary = Database['public']['Tables']['daily_summaries']['Row'];
export type DailySummaryInsert = Database['public']['Tables']['daily_summaries']['Insert'];

export type ConversationSummary = Database['public']['Tables']['conversation_summaries']['Row'];
export type ConversationSummaryInsert = Database['public']['Tables']['conversation_summaries']['Insert'];

export type Todo = Database['public']['Tables']['todos']['Row'];
export type TodoInsert = Database['public']['Tables']['todos']['Insert'];
export type TodoUpdate = Database['public']['Tables']['todos']['Update'];

export type Reminder = Database['public']['Tables']['reminders']['Row'];
export type ReminderInsert = Database['public']['Tables']['reminders']['Insert'];
export type ReminderUpdate = Database['public']['Tables']['reminders']['Update'];

export type Transcription = Database['public']['Tables']['transcriptions']['Row'];

export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row'];
export type PushSubscriptionInsert = Database['public']['Tables']['push_subscriptions']['Insert'];

export type ExtractedItem = Database['public']['Tables']['extracted_items']['Row'];
export type ExtractedItemInsert = Database['public']['Tables']['extracted_items']['Insert'];

// Chat session type
export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  createdAt: string;
  messageCount: number;
}
