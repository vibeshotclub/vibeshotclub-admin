-- Twitter Creators table
CREATE TABLE twitter_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  avatar_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  last_tweet_id VARCHAR(30),
  fetch_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_twitter_creators_username ON twitter_creators(username);
CREATE INDEX idx_twitter_creators_is_active ON twitter_creators(is_active);
CREATE INDEX idx_twitter_creators_last_fetched ON twitter_creators(last_fetched_at DESC);

-- Auto-update trigger
CREATE TRIGGER twitter_creators_updated_at
  BEFORE UPDATE ON twitter_creators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE twitter_creators ENABLE ROW LEVEL SECURITY;

-- Function to increment creator counts
CREATE OR REPLACE FUNCTION increment_creator_counts(
  p_creator_id UUID,
  p_fetch_count INTEGER DEFAULT 0,
  p_success_count INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  UPDATE twitter_creators
  SET
    fetch_count = fetch_count + p_fetch_count,
    success_count = success_count + p_success_count
  WHERE id = p_creator_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
