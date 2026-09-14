CREATE OR REPLACE FUNCTION match_school_claims(
  p_school_id uuid,
  p_query text,
  p_max_distance double precision DEFAULT 0.35,
  p_limit integer DEFAULT 12
)
RETURNS TABLE(
  claim_id uuid,
  claim_group_id uuid,
  claim_text text,
  category text,
  confidence_label text,
  reconciliation_note text,
  distance double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    m.claim_group_id,
    c.claim_text,
    c.category,
    g.confidence_label,
    g.reconciliation_note,
    (c.embedding <=> p_query::vector) AS distance
  FROM claims c
  INNER JOIN claim_group_members m ON m.claim_id = c.id
  INNER JOIN claim_groups g ON g.id = m.claim_group_id
  WHERE c.school_id = p_school_id
    AND c.embedding IS NOT NULL
    AND (c.embedding <=> p_query::vector) < p_max_distance
  ORDER BY c.embedding <=> p_query::vector
  LIMIT p_limit
$$;

REVOKE ALL ON FUNCTION match_school_claims(uuid, text, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_school_claims(uuid, text, double precision, integer) TO service_role;
