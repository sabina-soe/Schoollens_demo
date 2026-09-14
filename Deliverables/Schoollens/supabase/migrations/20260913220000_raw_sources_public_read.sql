-- Official website/Facebook dumps are already public source material.
-- Parents need them for the profile photo/video strip.

DROP POLICY IF EXISTS raw_sources_select_public ON raw_sources;
CREATE POLICY raw_sources_select_public ON raw_sources
  FOR SELECT TO anon, authenticated
  USING (true);
