-- Create generation_presets table
CREATE TABLE IF NOT EXISTS generation_presets (
  grid_size    integer PRIMARY KEY,
  min_density  real NOT NULL DEFAULT 0.18,
  max_density  real NOT NULL DEFAULT 0.28,
  min_span     integer NOT NULL DEFAULT 3,
  max_candidates integer NOT NULL DEFAULT 50,
  pattern_attempts integer NOT NULL DEFAULT 20,
  max_attempts integer NOT NULL DEFAULT 50,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed default rows
INSERT INTO generation_presets (grid_size, min_density, max_density, min_span, max_candidates, pattern_attempts, max_attempts)
VALUES
  (7,  0.18, 0.28, 3, 50, 20, 50),
  (13, 0.18, 0.28, 3, 50, 20, 50)
ON CONFLICT (grid_size) DO NOTHING;

-- RLS: public read, admin-only write
ALTER TABLE generation_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read presets"
  ON generation_presets FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies for anon — only service role can write.
-- The admin API route uses the service role key.
