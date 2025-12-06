# Alfred PWA

A Progressive Web App for analyzing transcription data with AI-powered insights.

## Features

- **Chat with Alfred**: Ask questions about your transcriptions using Claude AI
- **Daily Summaries**: Automated daily reflections generated at 10pm Central
- **Conversation Summaries**: Individual summaries for each transcription
- **To-dos & Reminders**: Task management with Alfred integration
- **Entities**: Define people, organizations, and places for context
- **About Me**: Personal profile for better AI understanding
- **Offline Support**: Access summaries and chat history offline
- **Push Notifications**: Get notified when summaries are ready

## Setup

### 1. Install Dependencies

```bash
cd alfred-pwa
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for cron)
- `ANTHROPIC_API_KEY` - Your Claude API key

### 3. Set Up Database

Run the SQL schema in your Supabase SQL Editor:

```bash
# Copy contents of supabase-schema.sql and run in Supabase SQL Editor
```

### 4. Generate VAPID Keys (for Push Notifications)

```bash
npm run generate-vapid
```

Add the generated keys to your environment variables.

### 5. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Add environment variables in project settings
4. Deploy

### 3. Configure Cron Job

The `vercel.json` file includes a cron job that runs at 4 AM UTC (10 PM Central) daily.

Make sure to add `CRON_SECRET` to your Vercel environment variables for security.

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `ANTHROPIC_API_KEY` | Claude API key | Yes |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key | For push |
| `VAPID_PRIVATE_KEY` | VAPID private key | For push |
| `NEXT_PUBLIC_APP_URL` | Your app URL | Optional |
| `CRON_SECRET` | Secret for cron endpoint | Recommended |

## Architecture

```
alfred-pwa/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Protected dashboard pages
│   └── api/               # API routes
├── components/            # React components
├── lib/                   # Utilities and integrations
│   ├── supabase/         # Supabase clients
│   ├── claude/           # Claude API integration
│   └── utils/            # Helper functions
├── types/                 # TypeScript types
└── public/               # Static assets & PWA files
```

## PWA Icons

You'll need to create icons for the PWA manifest. Required sizes:
- 72x72
- 96x96
- 128x128
- 144x144
- 152x152
- 192x192
- 384x384
- 512x512

Place them in `public/icons/` with names like `icon-192.png`.

## Security Notes

- Never commit `.env.local` or any file containing API keys
- The Claude API key should only be used server-side
- Row Level Security is enabled on all tables
- The cron endpoint is protected with a secret header
