-- =============================================================================
-- PERFORMANCE INDEXES MIGRATION
-- 
-- This migration adds indexes for frequently queried columns to improve
-- performance of invoices, quotes, payments, and receipts queries.
-- Run this AFTER all other migrations are complete.
-- =============================================================================

-- =============================================================================
-- 1. INVOICES INDEXES
-- =============================================================================

-- Index for client-based invoice filtering (statements, client views)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_client_id'
    ) THEN
        CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
    END IF;
END $$;

-- Index for invoice status filtering (dashboard, overdue reports)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_status'
    ) THEN
        CREATE INDEX idx_invoices_status ON public.invoices(status);
    END IF;
END $$;

-- Index for invoice due date (overdue calculations, aging reports)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_due_date'
    ) THEN
        CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
    END IF;
END $$;

-- Index for batch filtering on invoices
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_batch'
    ) THEN
        CREATE INDEX idx_invoices_batch ON public.invoices(batch) WHERE batch IS NOT NULL;
    END IF;
END $$;

-- =============================================================================
-- 2. PAYMENTS INDEXES
-- =============================================================================

-- Index for payment date range queries (statements, reports)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_date'
    ) THEN
        CREATE INDEX idx_payments_date ON public.payments(date);
    END IF;
END $$;

-- Composite index for payment currency + type queries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_currency_type'
    ) THEN
        CREATE INDEX idx_payments_currency_type ON public.payments(currency, type);
    END IF;
END $$;

-- =============================================================================
-- 3. PAYMENT ALLOCATIONS INDEXES
-- =============================================================================

-- Index for payment allocations lookup by invoice
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_allocations_invoice_id'
    ) THEN
        CREATE INDEX idx_payment_allocations_invoice_id ON public.payment_allocations(invoice_id);
    END IF;
END $$;

-- Index for payment allocations lookup by payment
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_allocations_payment_id'
    ) THEN
        CREATE INDEX idx_payment_allocations_payment_id ON public.payment_allocations(payment_id);
    END IF;
END $$;

-- =============================================================================
-- 4. QUOTES INDEXES
-- =============================================================================

-- Index for quote status filtering
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_quotes_status'
    ) THEN
        CREATE INDEX idx_quotes_status ON public.quotes(status);
    END IF;
END $$;

-- Index for quote client lookups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_quotes_client_id'
    ) THEN
        CREATE INDEX idx_quotes_client_id ON public.quotes(client_id);
    END IF;
END $$;

-- =============================================================================
-- 5. RECEIPTS INDEXES
-- =============================================================================

-- Index for receipt client lookups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_receipts_client_name'
    ) THEN
        CREATE INDEX idx_receipts_client_name ON public.receipts(client_name);
    END IF;
END $$;

-- Index for receipt payment date (receipts listing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_receipts_payment_date'
    ) THEN
        CREATE INDEX idx_receipts_payment_date ON public.receipts(payment_date DESC);
    END IF;
END $$;

-- =============================================================================
-- 6. VERIFY INDEXES WERE CREATED
-- =============================================================================

SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
