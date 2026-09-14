CREATE OR REPLACE FUNCTION claim_similarity_pairs(
  p_school_id uuid,
  p_max_distance double precision DEFAULT 0.18
)
RETURNS TABLE(claim_id_a uuid, claim_id_b uuid, category text)
LANGUAGE sql
STABLE
AS $$
  SELECT a.id, b.id, a.category
  FROM claims a
  INNER JOIN claims b
    ON a.school_id = b.school_id
   AND a.category = b.category
   AND a.id < b.id
   AND a.embedding IS NOT NULL
   AND b.embedding IS NOT NULL
   AND (a.embedding <=> b.embedding) < p_max_distance
  WHERE a.school_id = p_school_id
$$;

REVOKE ALL ON FUNCTION claim_similarity_pairs(uuid, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_similarity_pairs(uuid, double precision) TO service_role;
