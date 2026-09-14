-- Stored school overview from POST /rag/summarize (after reconciliation, not on profile load).

CREATE TABLE IF NOT EXISTS school_summaries (
  school_id uuid PRIMARY KEY,
  summary_text text,
  key_stats jsonb,
  things_to_verify jsonb,
  generated_at timestamptz
);

ALTER TABLE school_summaries ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON school_summaries TO anon, authenticated;

CREATE POLICY school_summaries_select_public ON school_summaries
  FOR SELECT TO anon, authenticated
  USING (true);
