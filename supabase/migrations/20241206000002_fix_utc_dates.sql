-- Fix existing transcription dates from UTC to Central Time
-- This converts UTC timestamps to Central Time (America/Chicago)
-- Run this once to fix historical data

-- Central Standard Time is UTC-6, Central Daylight Time is UTC-5
-- In December, we're in CST (UTC-6)

UPDATE transcriptions
SET date = date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'
WHERE date IS NOT NULL;

-- Verify the update worked
-- SELECT id, date, transcription FROM transcriptions ORDER BY date DESC LIMIT 10;
