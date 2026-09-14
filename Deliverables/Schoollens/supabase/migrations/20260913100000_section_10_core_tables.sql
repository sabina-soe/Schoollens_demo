CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  role text CHECK (role IN ('parent', 'school_admin', 'moderator', 'platform_operator')),
  "phone/email" text,
  created_at timestamptz
);

CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_group_id uuid,
  name text,
  address text,
  moe_approved_from date,
  moe_approved_to date,
  official_website_url text,
  official_facebook_url text,
  location point,
  geocode_confidence text,
  curriculum_type text,
  created_by uuid
);

CREATE TABLE raw_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  source_type text CHECK (source_type IN ('moe', 'website', 'fb_page', 'fb_group')),
  crawl_status text CHECK (crawl_status IN ('success', 'blocked', 'disallowed')),
  raw_json jsonb,
  content_hash text,
  crawled_at timestamptz
);

CREATE TABLE raw_source_school_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_source_id uuid,
  school_id uuid,
  confidence text
);

CREATE TABLE sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text,
  started_at timestamptz,
  finished_at timestamptz,
  status text,
  rows_ingested integer,
  errors jsonb
);

CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  claim_text text,
  category text,
  language text,
  scope text CHECK (scope IN ('network', 'branch')),
  embedding vector,
  source_type text,
  source_trust_tier text,
  created_at timestamptz
);

CREATE TABLE claim_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  category text,
  confidence_label text CHECK (confidence_label IN ('supported', 'likely', 'conflicting', 'outdated', 'unknown')),
  reconciliation_note text,
  last_updated timestamptz
);

CREATE TABLE claim_group_members (
  claim_group_id uuid,
  claim_id uuid,
  PRIMARY KEY (claim_group_id, claim_id)
);

CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid,
  raw_source_id uuid,
  file_url text,
  original_url text,
  evidence_type text CHECK (evidence_type IN ('document', 'photo', 'link', 'embedded_link', 'scraped_excerpt')),
  source_excerpt text,
  uploaded_at timestamptz
);

CREATE TABLE claim_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  claim_group_id uuid,
  change_type text CHECK (change_type IN ('new', 'removed', 'contradicted', 'updated')),
  summary_text text,
  detected_at timestamptz
);

CREATE TABLE claim_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_group_id uuid,
  user_id uuid,
  vote text CHECK (vote IN ('confirm', 'dispute')),
  reason_text text,
  created_at timestamptz
);

CREATE TABLE comment_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_source_id uuid,
  comment_excerpt text,
  sentiment_label text,
  sentiment_confidence text,
  mentioned_claim_category text,
  created_at timestamptz
);

CREATE TABLE school_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  requested_by uuid,
  proof_type text,
  proof_detail text,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz
);

CREATE TABLE link_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  requested_by uuid,
  field text CHECK (field IN ('website', 'facebook')),
  proposed_value text,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz
);

CREATE TABLE qa_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  user_id uuid,
  question text,
  answer text,
  cited_claim_group_ids uuid[],
  created_at timestamptz
);

CREATE TABLE questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  budget_range text,
  location text,
  priorities jsonb,
  child_age text,
  child_needs text,
  created_at timestamptz
);
