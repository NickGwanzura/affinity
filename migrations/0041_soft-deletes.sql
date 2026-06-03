-- 0041: Add soft-delete support to critical tables
--
-- Adds deleted_at TIMESTAMPTZ columns to tables that currently hard-delete
-- records. All existing rows remain visible (deleted_at IS NULL). The GET
-- queries in the API layer already filter for deleted_at IS NULL in clients;
-- the other APIs will be updated in a follow-up pass.

-- Expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON expenses(deleted_at);

-- Payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON payments(deleted_at);

-- Invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices(deleted_at);

-- Quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON quotes(deleted_at);

-- Employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_employees_deleted_at ON employees(deleted_at);

-- Note: Child tables (quote_items, invoice_items, payment_allocations) are
-- still hard-deleted because they are cleaned up during parent updates and
-- their data is snapshotted in the parent record's items column.
