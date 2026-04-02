-- Performance Indexes Migration
-- Based on audit findings for frequently queried columns
-- Run this in your PostgreSQL database to improve query performance

-- Index for client-based invoice filtering (statements, client views)
CREATE INDEX IF NOT EXISTS idx_invoices_client_id 
ON public.invoices(client_id);

-- Index for invoice status filtering (dashboard, overdue reports)
CREATE INDEX IF NOT EXISTS idx_invoices_status 
ON public.invoices(status);

-- Index for invoice due date (overdue calculations, aging reports)
CREATE INDEX IF NOT EXISTS idx_invoices_due_date 
ON public.invoices(due_date);

-- Index for payment date range queries (statements, reports)
CREATE INDEX IF NOT EXISTS idx_payments_date 
ON public.payments(date);

-- Index for payment allocations lookup by invoice
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id 
ON public.payment_allocations(invoice_id);

-- Index for payment allocations lookup by payment
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id 
ON public.payment_allocations(payment_id);

-- Index for quote status filtering
CREATE INDEX IF NOT EXISTS idx_quotes_status 
ON public.quotes(status);

-- Index for quote client lookups
CREATE INDEX IF NOT EXISTS idx_quotes_client_id 
ON public.quotes(client_id);

-- Index for receipt client lookups
CREATE INDEX IF NOT EXISTS idx_receipts_client_name 
ON public.receipts(client_name);

-- Index for receipt payment date (receipts listing)
CREATE INDEX IF NOT EXISTS idx_receipts_payment_date 
ON public.receipts(payment_date DESC);

-- Index for batch filtering on invoices
CREATE INDEX IF NOT EXISTS idx_invoices_batch 
ON public.invoices(batch) 
WHERE batch IS NOT NULL;

-- Composite index for payment currency + type queries
CREATE INDEX IF NOT EXISTS idx_payments_currency_type 
ON public.payments(currency, type);

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
