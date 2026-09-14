-- Section 14: RLS on every table.
-- Section 5.1: public read for browse/evidence/confidence/What's Changed;
-- writes follow parent / school_admin / moderator / platform_operator.

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin_for(_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    INNER JOIN public.school_claim_requests r ON r.requested_by = u.id
    INNER JOIN public.schools claimed ON claimed.id = r.school_id
    INNER JOIN public.schools target ON target.id = _school_id
    WHERE u.id = auth.uid()
      AND u.role = 'school_admin'
      AND r.status = 'approved'
      AND (
        r.school_id = _school_id
        OR (
          claimed.school_group_id IS NOT NULL
          AND claimed.school_group_id = target.school_group_id
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_school_admin_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin_for(uuid) TO anon, authenticated;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_source_school_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_claim_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON schools, claims, claim_groups, claim_group_members, evidence, claim_changes, claim_verifications, comment_analysis TO anon, authenticated;
GRANT INSERT ON qa_interactions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON questionnaires TO authenticated;
GRANT SELECT ON qa_interactions TO authenticated;
GRANT INSERT ON claim_verifications TO authenticated;
GRANT SELECT, INSERT ON school_claim_requests TO authenticated;
GRANT UPDATE ON school_claim_requests TO authenticated;
GRANT SELECT, INSERT ON link_change_requests TO authenticated;
GRANT UPDATE ON link_change_requests TO authenticated;
GRANT INSERT ON claims TO authenticated;
GRANT UPDATE ON claim_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON schools TO authenticated;
GRANT SELECT ON raw_sources TO authenticated;
GRANT SELECT, UPDATE ON raw_source_school_mentions TO authenticated;
GRANT SELECT ON sync_jobs TO authenticated;

-- users: own row; moderators/operators can read for dashboards; signup is parent
CREATE POLICY users_select_own ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY users_select_staff ON users
  FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('moderator', 'platform_operator'));

CREATE POLICY users_insert_own_parent ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'parent');

CREATE POLICY users_update_own ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = public.current_app_role());

-- schools: public read; operator manages crawl targets/geocode; moderator applies approved link changes
CREATE POLICY schools_select_public ON schools
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY schools_insert_operator ON schools
  FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() = 'platform_operator');

CREATE POLICY schools_update_staff ON schools
  FOR UPDATE TO authenticated
  USING (public.current_app_role() IN ('moderator', 'platform_operator'))
  WITH CHECK (public.current_app_role() IN ('moderator', 'platform_operator'));

-- claims: public read; school admin submits claims/corrections for their school(s)
CREATE POLICY claims_select_public ON claims
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY claims_insert_school_admin ON claims
  FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin_for(school_id));

-- claim_groups: public read; moderator reviews disputed/low-confidence groups
CREATE POLICY claim_groups_select_public ON claim_groups
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY claim_groups_update_moderator ON claim_groups
  FOR UPDATE TO authenticated
  USING (public.current_app_role() = 'moderator')
  WITH CHECK (public.current_app_role() = 'moderator');

-- claim_group_members: public read (needed with claim_groups/claims)
CREATE POLICY claim_group_members_select_public ON claim_group_members
  FOR SELECT TO anon, authenticated
  USING (true);

-- evidence: public read
CREATE POLICY evidence_select_public ON evidence
  FOR SELECT TO anon, authenticated
  USING (true);

-- claim_changes: public read ("What's Changed")
CREATE POLICY claim_changes_select_public ON claim_changes
  FOR SELECT TO anon, authenticated
  USING (true);

-- claim_verifications: public read; parent/contributor confirm/dispute
CREATE POLICY claim_verifications_select_public ON claim_verifications
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY claim_verifications_insert_parent ON claim_verifications
  FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() = 'parent' AND user_id = auth.uid());

-- comment_analysis: public read (parent sentiment on profile)
CREATE POLICY comment_analysis_select_public ON comment_analysis
  FOR SELECT TO anon, authenticated
  USING (true);

-- questionnaires: parent owns their row
CREATE POLICY questionnaires_select_own ON questionnaires
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY questionnaires_insert_own ON questionnaires
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.current_app_role() = 'parent');

CREATE POLICY questionnaires_update_own ON questionnaires
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.current_app_role() = 'parent');

-- qa_interactions: public may ask; only the asker can read their rows
CREATE POLICY qa_interactions_insert_public ON qa_interactions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR user_id = auth.uid()
  );

CREATE POLICY qa_interactions_select_own ON qa_interactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- school_claim_requests: parent submits; requester or moderator reads; moderator reviews
CREATE POLICY school_claim_requests_insert_authenticated ON school_claim_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.current_app_role() IN ('parent', 'school_admin')
  );

CREATE POLICY school_claim_requests_select_own_or_moderator ON school_claim_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.current_app_role() = 'moderator'
  );

CREATE POLICY school_claim_requests_update_moderator ON school_claim_requests
  FOR UPDATE TO authenticated
  USING (public.current_app_role() = 'moderator')
  WITH CHECK (public.current_app_role() = 'moderator');

-- link_change_requests: school admin proposes for their school(s); moderator reviews
CREATE POLICY link_change_requests_insert_school_admin ON link_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.is_school_admin_for(school_id)
  );

CREATE POLICY link_change_requests_select_own_or_moderator ON link_change_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.current_app_role() = 'moderator'
  );

CREATE POLICY link_change_requests_update_moderator ON link_change_requests
  FOR UPDATE TO authenticated
  USING (public.current_app_role() = 'moderator')
  WITH CHECK (public.current_app_role() = 'moderator');

-- raw_sources: append-only via service role; operator can read crawl status
CREATE POLICY raw_sources_select_operator ON raw_sources
  FOR SELECT TO authenticated
  USING (public.current_app_role() = 'platform_operator');

-- raw_source_school_mentions: operator review queue
CREATE POLICY raw_source_school_mentions_select_operator ON raw_source_school_mentions
  FOR SELECT TO authenticated
  USING (public.current_app_role() = 'platform_operator');

CREATE POLICY raw_source_school_mentions_update_operator ON raw_source_school_mentions
  FOR UPDATE TO authenticated
  USING (public.current_app_role() = 'platform_operator')
  WITH CHECK (public.current_app_role() = 'platform_operator');

-- sync_jobs: operator run history
CREATE POLICY sync_jobs_select_operator ON sync_jobs
  FOR SELECT TO authenticated
  USING (public.current_app_role() = 'platform_operator');
