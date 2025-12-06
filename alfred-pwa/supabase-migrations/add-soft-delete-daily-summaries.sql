-- Migration: Add soft delete to daily_summaries table
-- Run this in Supabase SQL Editor

-- Add deleted_at column for soft delete
ALTER TABLE daily_summaries
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient filtering of non-deleted items
CREATE INDEX IF NOT EXISTS idx_daily_summaries_deleted_at
ON daily_summaries(deleted_at)
WHERE deleted_at IS NULL;

-- Function to permanently delete old soft-deleted summaries (15+ days)
CREATE OR REPLACE FUNCTION cleanup_deleted_summaries()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM daily_summaries
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '15 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (for cron jobs)
GRANT EXECUTE ON FUNCTION cleanup_deleted_summaries() TO authenticated;
