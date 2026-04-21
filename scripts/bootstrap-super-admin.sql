-- ============================================================
-- Bootstrap Super Admin
-- One-shot promotion of an existing user to super_admin.
--
-- Usage:
--   psql "$NEON_DATABASE_URL" \
--     -v target_email="'person@example.com'" \
--     -f scripts/bootstrap-super-admin.sql
--
-- The script is idempotent: rerunning it on a user that is
-- already super_admin is a no-op.
-- ============================================================

BEGIN;

-- Fail loudly if the target email doesn't exist.
DO $$
DECLARE
  target_email_value TEXT := LOWER(TRIM(:target_email));
  target_user_id UUID;
  updated INTEGER;
BEGIN
  IF target_email_value IS NULL OR target_email_value = '' THEN
    RAISE EXCEPTION 'target_email is required (pass with -v target_email="''you@example.com''")';
  END IF;

  SELECT id INTO target_user_id
  FROM public.user_profiles
  WHERE LOWER(email) = target_email_value
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user_profiles row for email %', target_email_value;
  END IF;

  UPDATE public.user_profiles
  SET access_role = 'super_admin',
      status = CASE
                 WHEN LOWER(COALESCE(status, '')) IN ('active', 'approved') THEN status
                 ELSE 'Active'
               END,
      updated_at = NOW()
  WHERE id = target_user_id;

  GET DIAGNOSTICS updated = ROW_COUNT;
  RAISE NOTICE 'Promoted % (id=%) to super_admin (% row updated)', target_email_value, target_user_id, updated;
END
$$;

COMMIT;
