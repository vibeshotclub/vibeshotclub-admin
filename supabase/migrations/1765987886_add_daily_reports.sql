-- Daily Reports table
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  content_url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'bot')),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_daily_reports_date ON daily_reports(date DESC);
CREATE INDEX idx_daily_reports_is_published ON daily_reports(is_published);
CREATE INDEX idx_daily_reports_source ON daily_reports(source);

-- Auto-update trigger
CREATE TRIGGER daily_reports_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

-- Public can view published reports
CREATE POLICY "Public can view published reports" ON daily_reports
  FOR SELECT USING (is_published = true);
