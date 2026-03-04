-- Create word_clues table for persisting AI-generated and user-edited clues
CREATE TABLE IF NOT EXISTS word_clues (
  id          BIGSERIAL PRIMARY KEY,
  word        TEXT NOT NULL,
  clue        TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'unknown',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(word, clue)
);

CREATE INDEX idx_word_clues_word ON word_clues(word);

-- RLS: public read, service-role-only write
ALTER TABLE word_clues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read word clues"
  ON word_clues FOR SELECT
  USING (true);
