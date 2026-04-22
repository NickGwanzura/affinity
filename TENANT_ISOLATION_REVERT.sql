-- ============================================================
-- Full Tenant Dump
-- The application is single-tenant. This migration removes ALL
-- tenant-related schema objects created by:
--   - TENANT_ISOLATION_MIGRATION.sql (finance tables)
--   - SUPER_ADMIN_ARCHITECTURE_MIGRATION.sql (tenants table,
--     user_profiles / invites / registration_requests tenant_id)
--
-- Pre-flight confirmed single-tenant data:
--   tenants rows = 1, distinct user tenants = 1
--   all tenant_id values point to the same base tenant.
-- Dropping tenant_id therefore preserves every row intact; it
-- only removes the now-meaningless tenant reference.
-- ============================================================

BEGIN;

-- 1) Drop check constraint on user_profiles that enforced
--    super_admin ↔ NULL tenant_id coupling.
ALTER TABLE IF EXISTS public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_tenant_link_check;
ALTER TABLE IF EXISTS public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_super_admin_tenant_check;

-- 2) Drop FK constraints that reference public.tenants.
ALTER TABLE IF EXISTS public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_tenant_id_fkey;
ALTER TABLE IF EXISTS public.invites
  DROP CONSTRAINT IF EXISTS invites_tenant_id_fkey;

-- 3) Drop every tenant_id index.
DROP INDEX IF EXISTS public.idx_invoices_tenant_id;
DROP INDEX IF EXISTS public.idx_payments_tenant_id;
DROP INDEX IF EXISTS public.idx_expenses_tenant_id;
DROP INDEX IF EXISTS public.idx_quotes_tenant_id;
DROP INDEX IF EXISTS public.idx_payslips_tenant_id;
DROP INDEX IF EXISTS public.idx_operating_funds_tenant_id;
DROP INDEX IF EXISTS public.idx_receipts_tenant_id;
DROP INDEX IF EXISTS public.idx_payment_allocations_tenant_id;
DROP INDEX IF EXISTS public.idx_user_profiles_tenant_id;
DROP INDEX IF EXISTS public.idx_invites_tenant_id;
DROP INDEX IF EXISTS public.idx_registration_requests_tenant_id;
DROP INDEX IF EXISTS public.idx_tenants_status;
DROP INDEX IF EXISTS public.idx_tenants_created_at;

-- 4) Drop tenant_id columns — finance tables.
ALTER TABLE IF EXISTS public.invoices            DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.payments            DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.expenses            DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.quotes              DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.payslips            DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.operating_funds     DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.receipts            DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.payment_allocations DROP COLUMN IF EXISTS tenant_id CASCADE;

-- 5) Drop tenant_id columns — user/auth tables.
ALTER TABLE IF EXISTS public.user_profiles         DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.invites               DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.registration_requests DROP COLUMN IF EXISTS tenant_id CASCADE;

-- 6) Drop the tenants table itself.
DROP TABLE IF EXISTS public.tenants CASCADE;

COMMIT;
