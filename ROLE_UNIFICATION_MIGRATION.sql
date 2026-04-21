-- ============================================================
-- Role Unification Migration
-- Make access_role (super_admin/admin/user) the canonical role.
-- The legacy `role` column (Admin/Manager/Accountant/Driver) is
-- DEMOTED to a display-only job-title label. It MUST NOT be used
-- for authorization checks.
--
-- Authorization uses user_profiles.access_role only.
-- Display labels (Manager, Accountant, Driver, etc.) continue
-- to live in user_profiles.role.
-- ============================================================

BEGIN;

-- 1) Ensure access_role column exists (no-op if already added by
--    SUPER_ADMIN_ARCHITECTURE_MIGRATION.sql).
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS access_role TEXT;

-- 2) Backfill access_role from legacy role for any NULLs or from
--    the intermediate `tenant_admin` value used in the earlier
--    super-admin architecture migration.
--    Mapping (single-tenant app, tenant_id is being removed):
--      Admin        -> admin
--      Manager      -> user
--      Accountant   -> user
--      Driver       -> user
--      tenant_admin -> admin   (from legacy intermediate value)
UPDATE public.user_profiles
SET access_role = CASE
  WHEN LOWER(COALESCE(access_role, '')) = 'tenant_admin' THEN 'admin'
  WHEN role = 'Admin' THEN 'admin'
  ELSE 'user'
END
WHERE access_role IS NULL
   OR LOWER(access_role) NOT IN ('super_admin', 'admin', 'user');

-- 3) Enforce check constraint on access_role values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_access_role_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_access_role_check
      CHECK (access_role IN ('super_admin', 'admin', 'user'));
  END IF;
END
$$;

-- 4) Make access_role NOT NULL after backfill.
ALTER TABLE public.user_profiles
  ALTER COLUMN access_role SET NOT NULL;

-- 5) Helpful index for role-based queries.
CREATE INDEX IF NOT EXISTS idx_user_profiles_access_role
  ON public.user_profiles(access_role);

-- 6) Document the legacy `role` column as display-only.
--    We deliberately KEEP the column because the Settings UI
--    surfaces Admin/Manager/Accountant/Driver labels and they
--    are stored there. DO NOT read it for authorization.
COMMENT ON COLUMN public.user_profiles.role IS
  'Display-only job title label (e.g. Admin, Manager, Accountant, Driver). '
  'Authorization MUST use access_role, not this column.';

COMMENT ON COLUMN public.user_profiles.access_role IS
  'Canonical authorization role: super_admin | admin | user.';

-- 7) Password-reset hardening: per-token attempt counter used by
--    /api/auth?action=reset-password to invalidate tokens that
--    are brute-forced.
ALTER TABLE public.password_resets
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

COMMIT;
