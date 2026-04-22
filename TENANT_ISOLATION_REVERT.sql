-- ============================================================
-- Tenant Isolation Revert
-- The application is single-tenant. The earlier
-- TENANT_ISOLATION_MIGRATION.sql added tenant_id to finance
-- tables. This migration removes those columns, their indexes,
-- and their FK constraints.
--
-- Note: user_profiles.tenant_id (from
-- SUPER_ADMIN_ARCHITECTURE_MIGRATION.sql) was never deployed to
-- production per the pre-refactor audit and is not touched here.
-- ============================================================

BEGIN;

-- 1) Drop indexes that reference tenant_id on finance tables.
DROP INDEX IF EXISTS public.idx_invoices_tenant_id;
DROP INDEX IF EXISTS public.idx_payments_tenant_id;
DROP INDEX IF EXISTS public.idx_expenses_tenant_id;
DROP INDEX IF EXISTS public.idx_quotes_tenant_id;
DROP INDEX IF EXISTS public.idx_payslips_tenant_id;
DROP INDEX IF EXISTS public.idx_operating_funds_tenant_id;
DROP INDEX IF EXISTS public.idx_receipts_tenant_id;
DROP INDEX IF EXISTS public.idx_payment_allocations_tenant_id;

-- 2) Drop tenant_id columns from finance tables.
--    (CASCADE cleans up any FK constraints that were attached.)
ALTER TABLE IF EXISTS public.invoices            DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.payments            DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.expenses            DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.quotes              DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.payslips            DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.operating_funds     DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.receipts            DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE IF EXISTS public.payment_allocations DROP COLUMN IF EXISTS tenant_id CASCADE;

-- Note: the tenants table itself is left in place. Dropping it
-- would require removing references from SUPER_ADMIN_ARCHITECTURE_MIGRATION
-- (user_profiles.tenant_id, invites.tenant_id, registration_requests.tenant_id).
-- Those are out of scope for this revert and are no longer read by the app.

COMMIT;
