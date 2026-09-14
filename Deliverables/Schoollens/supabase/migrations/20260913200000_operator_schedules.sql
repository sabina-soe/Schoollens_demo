-- Operator schedule persistence (Section 8 / 11). Apply in the SQL Editor.

CREATE TABLE IF NOT EXISTS operator_schedules (
  pipeline text PRIMARY KEY CHECK (pipeline IN ('website', 'fb_page', 'fb_group')),
  cron_expr text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Yangon',
  updated_at timestamptz
);

INSERT INTO operator_schedules (pipeline, cron_expr, timezone, updated_at)
VALUES
  ('website', '0 9 1 * *', 'Asia/Yangon', now()),
  ('fb_page', '0 9 * * 1', 'Asia/Yangon', now()),
  ('fb_group', '0 10 * * 1', 'Asia/Yangon', now())
ON CONFLICT (pipeline) DO NOTHING;

ALTER TABLE operator_schedules ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON operator_schedules TO authenticated;

CREATE POLICY operator_schedules_all ON operator_schedules
  FOR ALL TO authenticated
  USING (public.current_app_role() = 'platform_operator')
  WITH CHECK (public.current_app_role() = 'platform_operator');

GRANT INSERT ON sync_jobs TO authenticated;

CREATE POLICY sync_jobs_insert_operator ON sync_jobs
  FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() = 'platform_operator');
