-- Section 5.3 demo accounts. Run in the Supabase SQL Editor (browser),
-- not via the Node seed script, if Node times out reaching Cloudflare.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.seed_demo_auth_user(
  p_email text,
  p_password text,
  p_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  user_id uuid;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = p_email;
  IF user_id IS NULL THEN
    user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change_token_current,
      email_change,
      phone_change,
      phone_change_token,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      user_id,
      'authenticated',
      'authenticated',
      p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      user_id,
      user_id::text,
      jsonb_build_object('sub', user_id::text, 'email', p_email),
      'email',
      now(),
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = user_id;
  END IF;

  INSERT INTO public.users (id, role, "phone/email", created_at)
  VALUES (user_id, p_role, p_email, now())
  ON CONFLICT (id) DO UPDATE
    SET role = excluded.role,
        "phone/email" = excluded."phone/email";

  RETURN user_id;
END;
$$;

DO $$
DECLARE
  admin_id uuid;
  demo_school_id uuid;
BEGIN
  PERFORM public.seed_demo_auth_user('demo.parent@schoollens.demo', 'demo-mode-only', 'parent');
  admin_id := public.seed_demo_auth_user('demo.school_admin@schoollens.demo', 'demo-mode-only', 'school_admin');
  PERFORM public.seed_demo_auth_user('demo.moderator@schoollens.demo', 'demo-mode-only', 'moderator');
  PERFORM public.seed_demo_auth_user('demo.platform_operator@schoollens.demo', 'demo-mode-only', 'platform_operator');

  SELECT id INTO demo_school_id FROM public.schools WHERE name ILIKE '%ILBC%' LIMIT 1;
  IF demo_school_id IS NULL THEN
    SELECT id INTO demo_school_id FROM public.schools LIMIT 1;
  END IF;
  IF demo_school_id IS NULL THEN
    INSERT INTO public.schools (name, address)
    VALUES ('ILBC International School', 'Yangon, Myanmar')
    RETURNING id INTO demo_school_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.school_claim_requests
    WHERE requested_by = admin_id
      AND school_id = demo_school_id
      AND status = 'approved'
  ) THEN
    INSERT INTO public.school_claim_requests (
      school_id,
      requested_by,
      proof_type,
      proof_detail,
      status
    ) VALUES (
      demo_school_id,
      admin_id,
      'email_domain',
      'demo seed — pre-approved',
      'approved'
    );
  END IF;
END;
$$;
