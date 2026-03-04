-- Search words with grouping, filtering, and pagination (server-side)
CREATE OR REPLACE FUNCTION search_words(
  p_search TEXT DEFAULT NULL,
  p_length INT DEFAULT NULL,
  p_min_clues INT DEFAULT NULL,
  p_max_clues INT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  word TEXT,
  clue_count BIGINT,
  clues JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wc.word,
    COUNT(*)::BIGINT AS clue_count,
    jsonb_agg(
      jsonb_build_object('clue', wc.clue, 'source', wc.source, 'createdAt', wc.created_at)
      ORDER BY wc.created_at DESC
    ) AS clues
  FROM word_clues wc
  WHERE
    (p_search IS NULL OR wc.word ILIKE '%' || p_search || '%')
    AND (p_length IS NULL OR LENGTH(wc.word) = p_length)
  GROUP BY wc.word
  HAVING
    (p_min_clues IS NULL OR COUNT(*) >= p_min_clues)
    AND (p_max_clues IS NULL OR COUNT(*) <= p_max_clues)
  ORDER BY wc.word
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Count matching words (for pagination total)
CREATE OR REPLACE FUNCTION count_words(
  p_search TEXT DEFAULT NULL,
  p_length INT DEFAULT NULL,
  p_min_clues INT DEFAULT NULL,
  p_max_clues INT DEFAULT NULL
)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM (
      SELECT wc.word
      FROM word_clues wc
      WHERE
        (p_search IS NULL OR wc.word ILIKE '%' || p_search || '%')
        AND (p_length IS NULL OR LENGTH(wc.word) = p_length)
      GROUP BY wc.word
      HAVING
        (p_min_clues IS NULL OR COUNT(*) >= p_min_clues)
        AND (p_max_clues IS NULL OR COUNT(*) <= p_max_clues)
    ) sub
  );
END;
$$ LANGUAGE plpgsql;
