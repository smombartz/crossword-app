-- Add user tracking and approval status to word_clues
ALTER TABLE word_clues
  ADD COLUMN created_by TEXT REFERENCES users(id),
  ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';

CREATE INDEX idx_word_clues_status ON word_clues(status);
CREATE INDEX idx_word_clues_created_by ON word_clues(created_by);

ALTER TABLE word_clues
  ADD CONSTRAINT word_clues_status_check
  CHECK (status IN ('approved', 'pending', 'rejected'));
