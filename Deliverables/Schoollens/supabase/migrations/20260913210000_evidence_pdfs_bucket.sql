-- Public PDF evidence bucket (Section 7.1). Apply in the SQL Editor if the Python create script cannot run.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidence-pdfs', 'evidence-pdfs', true, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS evidence_pdfs_select_public ON storage.objects;
CREATE POLICY evidence_pdfs_select_public
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'evidence-pdfs');

DROP POLICY IF EXISTS evidence_pdfs_insert_operator ON storage.objects;
CREATE POLICY evidence_pdfs_insert_operator
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'evidence-pdfs'
    AND public.current_app_role() IN ('platform_operator', 'moderator')
  );
