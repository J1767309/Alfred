# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fieldly Webhook Listener - An Express.js server that receives transcription webhooks from Fieldly and stores them in Supabase.

## Commands

```bash
npm start        # Start the server
npm run dev      # Start with watch mode (auto-restart on changes)
```

## Architecture

Single-file Express server (`src/server.js`) with two endpoints:
- `GET /health` - Health check
- `POST /webhook/fieldly` - Receives Fieldly transcription payloads, validates required fields (`date`, `transcription`), and inserts into Supabase `transcriptions` table

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `PORT` - Server port (default: 3000)

## Database

Schema defined in `supabase-schema.sql`. The `transcriptions` table stores:
- `date` - Transcription timestamp
- `transcription` - Main transcription text
- `transcriptions` - JSONB array of additional transcriptions
- `raw_payload` - Complete webhook payload for debugging

## Tech Stack

- Node.js with ES Modules (`"type": "module"`)
- Express.js for HTTP server
- Supabase JS client for database operations
