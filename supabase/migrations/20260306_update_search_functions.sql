-- Update search_words and count_words to support status filtering
-- and include id/status in clue JSONB aggregate

CREATE OR REPLACE FUNCTION search_words(
  p_search TEXT DEFAULT NULL,
  p_length INT DEFAULT NULL,
  p_min_clues INT DEFAULT NULL,
  p_max_clues INT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_status TEXT DEFAULT NULL
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
      jsonb_build_object(
        'clue', wc.clue,
        'source', wc.source,
        'createdAt', wc.created_at,
        'status', wc.status,
        'id', wc.id
      )
      ORDER BY wc.created_at DESC
    ) AS clues
  FROM word_clues wc
  WHERE
    (p_search IS NULL OR wc.word ILIKE '%' || p_search || '%')
    AND (p_length IS NULL OR LENGTH(wc.word) = p_length)
    AND (p_status IS NULL OR wc.status = p_status)
  GROUP BY wc.word
  HAVING
    (p_min_clues IS NULL OR COUNT(*) >= p_min_clues)
    AND (p_max_clues IS NULL OR COUNT(*) <= p_max_clues)
  ORDER BY wc.word
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION count_words(
  p_search TEXT DEFAULT NULL,
  p_length INT DEFAULT NULL,
  p_min_clues INT DEFAULT NULL,
  p_max_clues INT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
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
        AND (p_status IS NULL OR wc.status = p_status)
      GROUP BY wc.word
      HAVING
        (p_min_clues IS NULL OR COUNT(*) >= p_min_clues)
        AND (p_max_clues IS NULL OR COUNT(*) <= p_max_clues)
    ) sub
  );
END;
$$ LANGUAGE plpgsql;
