-- supabase/migrations/001_initial.sql

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Puzzles table
CREATE TABLE puzzles (
  id TEXT PRIMARY KEY,
  share_slug TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  grid_data JSONB NOT NULL,
  solution_hash TEXT NOT NULL,
  entries_data JSONB NOT NULL,
  pattern_data JSONB NOT NULL,
  size INTEGER NOT NULL DEFAULT 13,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_puzzles_share_slug ON puzzles(share_slug);
CREATE INDEX idx_puzzles_created_by ON puzzles(created_by);

-- RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read shared puzzles"
  ON puzzles FOR SELECT
  USING (is_shared = true);

CREATE POLICY "Auth users create puzzles"
  ON puzzles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users read own data"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users insert own data"
  ON users FOR INSERT
  WITH CHECK (true);
