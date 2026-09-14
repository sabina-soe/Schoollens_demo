-- Fix "Database error querying schema" after the SQL seed.
-- GoTrue cannot scan NULL token columns. Run this in the SQL Editor.

UPDATE auth.users
SET
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change = coalesce(email_change, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  email_confirmed_at = coalesce(email_confirmed_at, now())
WHERE email IN (
  'demo.parent@schoollens.demo',
  'demo.school_admin@schoollens.demo',
  'demo.moderator@schoollens.demo',
  'demo.platform_operator@schoollens.demo'
);
