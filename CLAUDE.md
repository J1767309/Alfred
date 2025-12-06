# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alfred - A Next.js PWA for managing Fieldly voice transcriptions with AI-powered features including chat, daily summaries, todos, and reminders.

## Commands

```bash
cd alfred-pwa
npm install      # Install dependencies
npm run dev      # Start development server
npm run build    # Build for production
```

## Architecture

Consolidated Next.js application in `alfred-pwa/` with:

### API Routes
- `GET /api/health` - Health check
- `POST /api/webhook/fieldly` - Receives Fieldly transcription webhooks
- `POST /api/chat` - Claude AI chat endpoint
- `POST /api/summaries/daily` - Generate daily summaries
- `GET/POST /api/cron/*` - Scheduled tasks

### Pages
- `/login` - Authentication
- `/conversations` - View transcriptions
- `/daily-summaries` - AI-generated daily summaries
- `/chat` - Chat with Claude about your transcriptions
- `/todos` - Task management
- `/reminders` - Reminders extracted from transcriptions
- `/entities` - People, places, things mentioned
- `/about-me` - Personal context for AI

## Environment Variables

Copy `alfred-pwa/.env.example` to `alfred-pwa/.env` and configure:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `ANTHROPIC_API_KEY` - Claude API key
- `CRON_SECRET` - Secret for cron job authentication

## Database

Schema in `supabase/migrations/`. Key tables:
- `transcriptions` - Voice transcriptions from Fieldly
- `daily_summaries` - AI-generated daily summaries
- `todos` - Tasks extracted or manually created
- `reminders` - Reminders from transcriptions
- `entities` - People, places, things
- `chat_conversations` / `chat_messages` - Chat history

## Deployment

Single Vercel project with Root Directory set to `alfred-pwa`.

Webhook URL: `https://alfred-pwa.vercel.app/api/webhook/fieldly`

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + Database)
- Claude AI (Anthropic)
- Vercel (Hosting + Cron)
