-- Create the transcriptions table in Supabase
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)

CREATE TABLE transcriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL,
  transcription TEXT NOT NULL,
  transcriptions JSONB DEFAULT '[]'::jsonb,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index on the date column for faster queries
CREATE INDEX idx_transcriptions_date ON transcriptions(date);

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow inserts (for the webhook)
CREATE POLICY "Allow anonymous inserts" ON transcriptions
  FOR INSERT
  WITH CHECK (true);

-- Create a policy to allow reads (adjust as needed)
CREATE POLICY "Allow anonymous reads" ON transcriptions
  FOR SELECT
  USING (true);
