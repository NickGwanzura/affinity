-- ============================================================
-- SUPERSEDED on 2026-04-22 by TENANT_ISOLATION_REVERT.sql.
-- The app is single-tenant. The tenants table, tenant_id columns,
-- and related FKs/constraints/indexes created here have been
-- dropped. DO NOT RE-RUN this file — doing so will recreate the
-- schema the revert just removed.
--
-- Original migration below is kept for historical reference only.
-- ============================================================

-- ============================================================
-- Super Admin Architecture Migration
-- Super Admin is platform-level and must not belong to tenant
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_status_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_status_check
      CHECK (LOWER(status) IN ('pending', 'active', 'suspended'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON public.tenants(created_at DESC);

-- 2) Add access_role + tenant_id to users
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS access_role TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- 3) Seed default tenant from company_details, or fallback
INSERT INTO public.tenants (name, slug, status)
SELECT
  COALESCE(NULLIF(TRIM(cd.name), ''), 'Default Tenant') AS name,
  CONCAT(
    LOWER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(cd.name), ''), 'default-tenant'), '[^a-zA-Z0-9]+', '-', 'g')),
    '-',
    SUBSTRING(COALESCE(cd.id::text, gen_random_uuid()::text), 1, 8)
  ) AS slug,
  'active'
FROM public.company_details cd
WHERE NOT EXISTS (SELECT 1 FROM public.tenants)
LIMIT 1;

INSERT INTO public.tenants (name, slug, status)
SELECT 'Default Tenant', 'default-tenant', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.tenants);

-- 4) Backfill access roles using legacy role semantics
UPDATE public.user_profiles
SET access_role = CASE WHEN role = 'Admin' THEN 'tenant_admin' ELSE 'user' END
WHERE access_role IS NULL
   OR LOWER(access_role) NOT IN ('super_admin', 'tenant_admin', 'user');

-- 5) Assign all tenant users to a tenant by default
WITH base_tenant AS (
  SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1
)
UPDATE public.user_profiles u
SET tenant_id = bt.id
FROM base_tenant bt
WHERE (u.tenant_id IS NULL)
  AND LOWER(COALESCE(u.access_role, '')) <> 'super_admin';

-- 6) Promote oldest Admin to platform super_admin (if none exists)
DO $$
DECLARE
  existing_super_admin_count INTEGER := 0;
  first_admin_id UUID;
BEGIN
  SELECT COUNT(*)
  INTO existing_super_admin_count
  FROM public.user_profiles
  WHERE LOWER(COALESCE(access_role, '')) = 'super_admin';

  IF existing_super_admin_count = 0 THEN
    SELECT id
    INTO first_admin_id
    FROM public.user_profiles
    WHERE role = 'Admin'
    ORDER BY created_at ASC
    LIMIT 1;

    IF first_admin_id IS NOT NULL THEN
      UPDATE public.user_profiles
      SET access_role = 'super_admin',
          tenant_id = NULL
      WHERE id = first_admin_id;
    END IF;
  END IF;
END
$$;

-- 7) Enforce access_role semantics + tenant linkage
ALTER TABLE public.user_profiles
  ALTER COLUMN access_role SET DEFAULT 'user';

UPDATE public.user_profiles
SET access_role = 'user'
WHERE access_role IS NULL;

ALTER TABLE public.user_profiles
  ALTER COLUMN access_role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_access_role_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_access_role_check
      CHECK (LOWER(access_role) IN ('super_admin', 'tenant_admin', 'user'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_tenant_link_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_tenant_link_check
      CHECK (
        (LOWER(access_role) = 'super_admin' AND tenant_id IS NULL) OR
        (LOWER(access_role) <> 'super_admin' AND tenant_id IS NOT NULL)
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_access_role ON public.user_profiles(access_role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON public.user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON public.user_profiles(status);

-- 8) Link invites to tenant scope
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

WITH base_tenant AS (
  SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1
)
UPDATE public.invites i
SET tenant_id = bt.id
FROM base_tenant bt
WHERE i.tenant_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invites_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.invites
      ADD CONSTRAINT invites_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_invites_tenant_id ON public.invites(tenant_id);

-- 9) Optional tenant linkage for registration requests
ALTER TABLE public.registration_requests
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

CREATE INDEX IF NOT EXISTS idx_registration_requests_tenant_id
  ON public.registration_requests(tenant_id);

COMMIT;
