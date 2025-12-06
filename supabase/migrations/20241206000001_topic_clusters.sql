-- Topic Clusters table for storing AI-generated conversation groupings
-- Run this SQL in your Supabase SQL Editor

-- ============================================
-- Create topic_clusters table
-- ============================================
CREATE TABLE IF NOT EXISTS topic_clusters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cluster_date DATE NOT NULL,
  topics JSONB NOT NULL,
  transcription_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cluster_date)
);

CREATE INDEX IF NOT EXISTS idx_topic_clusters_user_id ON topic_clusters(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_clusters_date ON topic_clusters(cluster_date DESC);

-- ============================================
-- Enable Row Level Security
-- ============================================
ALTER TABLE topic_clusters ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Create RLS Policies
-- ============================================
CREATE POLICY "Users can view own topic clusters" ON topic_clusters
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own topic clusters" ON topic_clusters
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own topic clusters" ON topic_clusters
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own topic clusters" ON topic_clusters
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Add trigger for updated_at
-- ============================================
CREATE TRIGGER update_topic_clusters_updated_at
  BEFORE UPDATE ON topic_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
