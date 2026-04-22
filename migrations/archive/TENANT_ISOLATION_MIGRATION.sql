-- ============================================================
-- ARCHIVED: REVERTED by TENANT_ISOLATION_REVERT.sql on 2026-04-21
-- This migration is no longer valid. The application is
-- single-tenant, so tenant_id columns are being removed from
-- finance tables. Do NOT re-apply this migration.
-- See: TENANT_ISOLATION_REVERT.sql
-- ============================================================

-- ============================================================
-- Tenant Isolation Migration (ORIGINAL, FOR HISTORICAL REFERENCE)
-- Add tenant_id to all finance tables for multi-tenant isolation
-- ============================================================

-- Add tenant_id to finance tables if not already present
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE operating_funds ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE payment_allocations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_id ON quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payslips_tenant_id ON payslips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_operating_funds_tenant_id ON operating_funds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant_id ON receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_tenant_id ON payment_allocations(tenant_id);

-- Backfill existing records with the default tenant
WITH base_tenant AS (
  SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1
)
UPDATE invoices SET tenant_id = (SELECT id FROM base_tenant) WHERE tenant_id IS NULL;

WITH base_tenant AS (
  SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1
)
UPDATE payments SET tenant_id = (SELECT id FROM base_tenant) WHERE tenant_id IS NULL;

WITH base_tenant AS (
  SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1
)
UPDATE expenses SET tenant_id = (SELECT id FROM base_tenant) WHERE tenant_id IS NULL;

WITH base_tenant AS (
  SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1
)
UPDATE quotes SET tenant_id = (SELECT id FROM base_tenant) WHERE tenant_id IS NULL;

WITH base_tenant AS (
  SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1
)
UPDATE payslips SET tenant_id = (SELECT id FROM base_tenant) WHERE tenant_id IS NULL;

WITH base_tenant AS (
  SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1
)
UPDATE operating_funds SET tenant_id = (SELECT id FROM base_tenant) WHERE tenant_id IS NULL;

WITH base_tenant AS (
  SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1
)
UPDATE receipts SET tenant_id = (SELECT id FROM base_tenant) WHERE tenant_id IS NULL;

WITH base_tenant AS (
  SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1
)
UPDATE payment_allocations SET tenant_id = (SELECT id FROM base_tenant) WHERE tenant_id IS NULL;
