# Alfred PWA - Implementation Plan

## Overview

Build a Progressive Web App called "Alfred" that serves as a personal AI assistant for analyzing transcription data. The app will be built with Next.js 14, hosted on Vercel, and integrate with the existing Supabase database.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel Hosting                          │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 14 App (App Router)                                    │
│  ├── /app                                                       │
│  │   ├── (auth)/login/page.tsx         # Login page             │
│  │   ├── (dashboard)/                  # Protected routes       │
│  │   │   ├── chat/page.tsx             # Chat with Alfred       │
│  │   │   ├── daily-summaries/page.tsx  # Daily summaries list   │
│  │   │   ├── conversations/page.tsx    # Conversation summaries │
│  │   │   ├── todos/page.tsx            # To-do lists            │
│  │   │   ├── reminders/page.tsx        # Special reminders      │
│  │   │   ├── about-me/page.tsx         # About me section       │
│  │   │   └── entities/page.tsx         # Entities management    │
│  │   └── api/                                                   │
│  │       ├── chat/route.ts             # Claude API integration │
│  │       ├── summaries/                                         │
│  │       │   ├── daily/route.ts        # Generate daily summary │
│  │       │   └── conversation/route.ts # Conversation summaries │
│  │       ├── cron/daily-summary/route.ts # 10pm cron job        │
│  │       └── push/route.ts             # Push notifications     │
│  └── Service Worker + PWA manifest                              │
├─────────────────────────────────────────────────────────────────┤
│                        Supabase                                 │
│  ├── Auth (email/password)                                      │
│  ├── Database                                                   │
│  │   ├── transcriptions (existing)                              │
│  │   ├── entities (new)                                         │
│  │   ├── user_profiles (new - about me)                         │
│  │   ├── chat_history (new)                                     │
│  │   ├── daily_summaries (new)                                  │
│  │   ├── conversation_summaries (new)                           │
│  │   ├── todos (new)                                            │
│  │   ├── reminders (new)                                        │
│  │   └── push_subscriptions (new)                               │
│  └── Realtime subscriptions                                     │
├─────────────────────────────────────────────────────────────────┤
│                      Claude API                                 │
│  └── claude-sonnet-4-20250514 for chat & summaries                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Updates

### New Tables to Create

```sql
-- 1. Entities table (family, organizations, etc.)
CREATE TABLE entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'person', 'organization', 'place', etc.
  relationship TEXT, -- 'partner', 'son', 'employer', etc.
  notes TEXT,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User profiles (About Me section)
CREATE TABLE user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  about_me TEXT, -- Free-form text about the user
  preferences JSONB DEFAULT '{}', -- Additional preferences
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Chat history
CREATE TABLE chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL, -- Group messages by session
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Daily summaries
CREATE TABLE daily_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  content TEXT NOT NULL, -- Markdown content
  raw_analysis JSONB, -- Structured data from Claude
  transcription_ids UUID[], -- References to source transcriptions
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, summary_date)
);

-- 5. Conversation summaries
CREATE TABLE conversation_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transcription_id UUID REFERENCES transcriptions(id) ON DELETE CASCADE,
  title TEXT,
  participants TEXT[], -- Detected speakers
  summary TEXT NOT NULL,
  key_points JSONB, -- Bullet points
  action_items JSONB, -- Extracted action items
  conversation_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. To-do lists
CREATE TABLE todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
  due_date TIMESTAMPTZ,
  source TEXT, -- 'manual', 'alfred', 'daily_summary'
  source_id UUID, -- Reference to source (transcription, summary, etc.)
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Reminders
CREATE TABLE reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT DEFAULT 'one_time', -- 'one_time', 'recurring'
  remind_at TIMESTAMPTZ NOT NULL,
  recurrence_rule TEXT, -- RRULE format for recurring
  entity_id UUID REFERENCES entities(id), -- Optional link to entity
  is_triggered BOOLEAN DEFAULT FALSE,
  source TEXT, -- 'manual', 'alfred'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Push subscriptions
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update existing transcriptions table to link to user
ALTER TABLE transcriptions ADD COLUMN user_id UUID REFERENCES auth.users(id);
```

---

## Implementation Phases

### Phase 1: Project Setup & Authentication
1. Create Next.js 14 project with TypeScript in `/alfred-pwa` directory
2. Configure Tailwind CSS for styling
3. Set up Supabase client with auth
4. Implement email/password authentication
5. Create protected route middleware
6. Set up basic layout with navigation sidebar

### Phase 2: Database Schema & Core Infrastructure
1. Run SQL migrations to create new tables
2. Create TypeScript types for all database tables
3. Set up Supabase Row Level Security policies
4. Create database utility functions

### Phase 3: About Me & Entities
1. Build About Me page with text editor
2. Build Entities CRUD interface
3. Create entity type selector (person, organization, place)

### Phase 4: Chat with Alfred
1. Implement chat UI component
2. Create Claude API integration endpoint
3. Build context assembly (About Me + Entities + Transcriptions)
4. Implement chat history storage and retrieval
5. Add session management and delete functionality
6. Implement "Alfred, remember..." detection for reminders/todos

### Phase 5: Conversation Summaries
1. Create conversation detection algorithm
2. Build summary generation with Claude
3. Create conversation list view (grouped by day)
4. Build individual conversation detail view

### Phase 6: Daily Summaries
1. Implement daily summary generation endpoint
2. Create Vercel cron job for 10pm Central
3. Build daily summary list view
4. Build individual summary detail view
5. Add manual "Generate Summary" button

### Phase 7: To-dos & Reminders
1. Build to-do list CRUD interface
2. Implement reminder system
3. Create reminder notification scheduling
4. Link todos/reminders to sources

### Phase 8: PWA & Offline Support
1. Configure next-pwa plugin
2. Create service worker for offline caching
3. Implement push notification subscription
4. Set up Web Push with VAPID keys
5. Create notification handlers

### Phase 9: Deployment & Testing
1. Configure Vercel project
2. Set up environment variables
3. Configure cron job in vercel.json
4. Test all features end-to-end
5. Set up error monitoring

---

## File Structure

```
/alfred-pwa/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # Main dashboard layout with sidebar
│   │   ├── page.tsx                   # Dashboard home (redirects to chat)
│   │   ├── chat/
│   │   │   └── page.tsx
│   │   ├── daily-summaries/
│   │   │   ├── page.tsx               # List of all daily summaries
│   │   │   └── [date]/page.tsx        # Individual summary view
│   │   ├── conversations/
│   │   │   ├── page.tsx               # List grouped by day
│   │   │   └── [id]/page.tsx          # Individual conversation
│   │   ├── todos/
│   │   │   └── page.tsx
│   │   ├── reminders/
│   │   │   └── page.tsx
│   │   ├── about-me/
│   │   │   └── page.tsx
│   │   └── entities/
│   │       └── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── callback/route.ts
│   │   ├── chat/
│   │   │   └── route.ts               # Claude chat endpoint
│   │   ├── summaries/
│   │   │   ├── daily/route.ts         # Generate daily summary
│   │   │   └── conversation/route.ts  # Generate conversation summary
│   │   └── cron/
│   │       └── daily-summary/route.ts # Vercel cron endpoint
│   ├── manifest.json                  # PWA manifest
│   └── layout.tsx                     # Root layout
├── components/
│   ├── ui/                            # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── ...
│   ├── chat/
│   │   ├── ChatContainer.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageInput.tsx
│   │   └── ChatHistory.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Navigation.tsx
│   ├── entities/
│   │   ├── EntityList.tsx
│   │   ├── EntityForm.tsx
│   │   └── EntityCard.tsx
│   ├── summaries/
│   │   ├── DailySummaryCard.tsx
│   │   ├── ConversationCard.tsx
│   │   └── SummaryContent.tsx
│   └── todos/
│       ├── TodoList.tsx
│       ├── TodoItem.tsx
│       └── TodoForm.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # Browser client
│   │   ├── server.ts                  # Server client
│   │   └── middleware.ts              # Auth middleware
│   ├── claude/
│   │   ├── client.ts                  # Claude API client
│   │   ├── prompts.ts                 # System prompts
│   │   └── context.ts                 # Context assembly
│   ├── utils/
│   │   ├── dates.ts
│   │   └── formatting.ts
│   └── hooks/
│       ├── useChat.ts
│       ├── useEntities.ts
│       └── useSummaries.ts
├── types/
│   └── database.ts                    # TypeScript types
├── public/
│   ├── icons/                         # PWA icons
│   └── sw.js                          # Service worker
├── next.config.js
├── tailwind.config.js
├── vercel.json                        # Cron configuration
└── package.json
```

---

## Key Implementation Details

### Alfred Context Assembly

When Alfred responds, it will have access to:
1. **About Me**: User's personal context
2. **Entities**: All defined entities with relationships
3. **Relevant Transcriptions**: Based on date/entity mentions in query
4. **Chat History**: Previous messages in current session

```typescript
async function buildAlfredContext(userId: string, query: string) {
  const [aboutMe, entities, relevantTranscriptions] = await Promise.all([
    getAboutMe(userId),
    getEntities(userId),
    searchTranscriptions(userId, query) // Vector search or keyword
  ]);

  return `
## About the User
${aboutMe}

## Known Entities
${entities.map(e => `- ${e.name} (${e.type}): ${e.relationship}. ${e.notes}`).join('\n')}

## Relevant Transcriptions
${relevantTranscriptions.map(t => `[${t.date}]: ${t.transcription}`).join('\n\n')}
`;
}
```

### Alfred Command Detection

Alfred will detect special commands in transcriptions:
- "Alfred, remember..." → Creates a reminder
- "Alfred, add to my to-do..." → Creates a todo
- "Alfred, remember this about [Entity]..." → Updates entity notes

### Daily Summary Cron

Vercel cron configuration:
```json
{
  "crons": [{
    "path": "/api/cron/daily-summary",
    "schedule": "0 4 * * *"  // 4 AM UTC = 10 PM Central
  }]
}
```

### Push Notifications

Using Web Push API with VAPID keys for:
- Daily summary completion notification
- Reminder notifications
- Optional: New transcription received

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# App
NEXT_PUBLIC_APP_URL=
CRON_SECRET=  # Secure cron endpoint
```

---

## UI Design Decisions

1. **Color Scheme**: Dark mode by default (easier on eyes for evening use)
2. **Font**: Inter for UI, monospace for transcriptions
3. **Layout**: Fixed sidebar, scrollable main content
4. **Chat**: WhatsApp-style message bubbles
5. **Navigation**: Collapsible sidebar with icons

---

## Security Considerations

1. Row Level Security on all tables (user can only access own data)
2. API routes protected with Supabase auth
3. Cron endpoint secured with secret header
4. Claude API key server-side only
5. Push subscription validation

---

## Estimated File Count

- ~25 React components
- ~10 API routes
- ~8 database utility files
- ~5 custom hooks
- ~15 pages/routes
- Configuration files

**Total: ~65-75 files**

---

## Questions Addressed

1. **Authentication**: Email/password via Supabase Auth
2. **Alfred Identity**: AI assistant named Alfred, detects when addressed
3. **Daily Summaries**: 10pm Central auto-generation + manual button
4. **Conversation Summaries**: Individual summaries grouped by day
5. **Entities**: Name, type, relationship, notes, context fields
6. **About Me**: Free-form text editor
7. **Offline**: Service worker caching for summaries/chat history
8. **Push Notifications**: For summary completion and reminders
9. **To-dos & Reminders**: Separate sections with Alfred integration

---

## Ready to Implement

Once approved, I will:
1. Create the `/alfred-pwa` directory with Next.js project
2. Implement all phases sequentially
3. Provide the updated SQL schema for Supabase
4. Configure Vercel deployment
5. Set up all environment variables

Please review and approve this plan, or let me know if you'd like any changes.
