-- =============================================================================
-- FORENSIC FIX MIGRATION v2
-- Comprehensive fix for client balance, ledger system, and data integrity
-- 
-- Fixes:
-- 1. Adds opening_balance columns to clients table
-- 2. Creates unified client balance calculation using client_id
-- 3. Creates ledger_entries view for transaction history
-- 4. Updates all balance functions to use client_id joins
-- 5. Adds audit columns to payments table
-- 6. Creates single source of truth for client balances
-- =============================================================================

-- =============================================================================
-- 1. UPDATE CLIENTS TABLE - Add Opening Balance Columns
-- =============================================================================

-- Add opening_balance column if not exists
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_currency TEXT DEFAULT 'USD' CHECK (opening_balance_currency IN ('USD', 'GBP')),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for active clients
CREATE INDEX IF NOT EXISTS idx_clients_is_active 
  ON public.clients(is_active) 
  WHERE is_active = true;

-- =============================================================================
-- 2. UPDATE PAYMENTS TABLE - Add Audit Columns
-- =============================================================================

-- Add audit tracking columns
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add type constraint update (if needed)
ALTER TABLE public.payments 
  DROP CONSTRAINT IF EXISTS payments_type_check;

ALTER TABLE public.payments 
  ADD CONSTRAINT payments_type_check 
  CHECK (type IN ('Inbound', 'Outbound', 'Invoice Payment', 'Quote Payment', 'Deposit', 'Refund', 'Other'));

-- Create index for soft delete filtering
CREATE INDEX IF NOT EXISTS idx_payments_is_deleted 
  ON public.payments(is_deleted) 
  WHERE is_deleted = false;

-- Create index for payment date range queries
CREATE INDEX IF NOT EXISTS idx_payments_date_client 
  ON public.payments(date DESC, client_id) 
  WHERE client_id IS NOT NULL;

-- =============================================================================
-- 3. UPDATE INVOICES TABLE - Add client_id consistency
-- =============================================================================

-- Ensure client_id is properly indexed
CREATE INDEX IF NOT EXISTS idx_invoices_client_id 
  ON public.invoices(client_id) 
  WHERE client_id IS NOT NULL;

-- Create index for invoice status + client lookups
CREATE INDEX IF NOT EXISTS idx_invoices_status_client 
  ON public.invoices(status, client_id) 
  WHERE client_id IS NOT NULL;

-- =============================================================================
-- 4. DROP OLD NAME-BASED BALANCE FUNCTIONS/VIEWS
-- =============================================================================

DROP VIEW IF EXISTS public.client_balances CASCADE;
DROP FUNCTION IF EXISTS public.get_client_balance(TEXT) CASCADE;

-- =============================================================================
-- 5. CREATE UNIFIED CLIENT BALANCE FUNCTION (Using client_id)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_client_balance_v2(p_client_id UUID)
RETURNS TABLE (
  current_balance NUMERIC,
  total_invoiced NUMERIC,
  total_paid NUMERIC,
  opening_balance NUMERIC,
  currency TEXT,
  credit_balance NUMERIC
) AS $$
DECLARE
  v_opening_balance NUMERIC := 0;
  v_opening_currency TEXT := 'USD';
  v_total_invoiced NUMERIC := 0;
  v_total_paid NUMERIC := 0;
  v_current_balance NUMERIC := 0;
  v_credit_balance NUMERIC := 0;
BEGIN
  -- Get client's opening balance and currency
  SELECT 
    COALESCE(c.opening_balance, 0),
    COALESCE(c.opening_balance_currency, 'USD')
  INTO v_opening_balance, v_opening_currency
  FROM public.clients c
  WHERE c.id = p_client_id
    AND c.is_active = true
    AND c.deleted_at IS NULL;
  
  -- If client not found, return zeros
  IF v_opening_balance IS NULL THEN
    v_opening_balance := 0;
  END IF;

  -- Calculate total invoiced (from invoices linked by client_id OR client_name)
  SELECT COALESCE(SUM(i.amount_usd), 0)
  INTO v_total_invoiced
  FROM public.invoices i
  WHERE (i.client_id = p_client_id 
         OR i.client_name = (SELECT name FROM public.clients WHERE id = p_client_id))
    AND i.status != 'Cancelled';

  -- Calculate total paid (from payments linked by client_id OR client_name)
  -- Include only non-deleted payments
  SELECT COALESCE(SUM(p.amount_usd), 0)
  INTO v_total_paid
  FROM public.payments p
  WHERE (p.client_id = p_client_id 
         OR p.client_name = (SELECT name FROM public.clients WHERE id = p_client_id))
    AND p.type = 'Inbound'
    AND (p.is_deleted = false OR p.is_deleted IS NULL);

  -- Calculate current balance: opening + invoiced - paid
  v_current_balance := v_opening_balance + v_total_invoiced - v_total_paid;
  
  -- Calculate credit balance (if overpaid)
  IF v_current_balance < 0 THEN
    v_credit_balance := ABS(v_current_balance);
    v_current_balance := 0;
  END IF;

  RETURN QUERY SELECT 
    v_current_balance,
    v_total_invoiced,
    v_total_paid,
    v_opening_balance,
    v_opening_currency,
    v_credit_balance;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 6. CREATE CLIENT BALANCES VIEW (Using client_id)
-- =============================================================================

CREATE OR REPLACE VIEW public.client_balances_v2 AS
SELECT 
  c.id as client_id,
  c.name as client_name,
  c.email,
  c.company,
  c.opening_balance,
  c.opening_balance_currency as currency,
  COALESCE(inv.total_invoiced, 0) as total_invoiced,
  COALESCE(pay.total_paid, 0) as total_paid,
  c.opening_balance + COALESCE(inv.total_invoiced, 0) - COALESCE(pay.total_paid, 0) as balance_due,
  CASE 
    WHEN c.opening_balance + COALESCE(inv.total_invoiced, 0) - COALESCE(pay.total_paid, 0) < 0 
    THEN ABS(c.opening_balance + COALESCE(inv.total_invoiced, 0) - COALESCE(pay.total_paid, 0))
    ELSE 0 
  END as credit_balance,
  c.is_active,
  c.created_at
FROM public.clients c
LEFT JOIN (
  SELECT 
    COALESCE(i.client_id, (SELECT id FROM public.clients WHERE name = i.client_name LIMIT 1)) as client_id,
    SUM(i.amount_usd) as total_invoiced
  FROM public.invoices i
  WHERE i.status != 'Cancelled'
  GROUP BY COALESCE(i.client_id, (SELECT id FROM public.clients WHERE name = i.client_name LIMIT 1))
) inv ON c.id = inv.client_id
LEFT JOIN (
  SELECT 
    COALESCE(p.client_id, (SELECT id FROM public.clients WHERE name = p.client_name LIMIT 1)) as client_id,
    SUM(p.amount_usd) as total_paid
  FROM public.payments p
  WHERE p.type = 'Inbound'
    AND (p.is_deleted = false OR p.is_deleted IS NULL)
  GROUP BY COALESCE(p.client_id, (SELECT id FROM public.clients WHERE name = p.client_name LIMIT 1))
) pay ON c.id = pay.client_id
WHERE c.is_active = true 
  AND c.deleted_at IS NULL;

-- =============================================================================
-- 7. CREATE LEDGER ENTRIES VIEW
-- =============================================================================

CREATE OR REPLACE VIEW public.client_ledger AS
-- Opening Balance Entry
SELECT 
  c.id as client_id,
  c.name as client_name,
  c.created_at as entry_date,
  'opening_balance'::TEXT as entry_type,
  'Opening Balance'::TEXT as reference,
  NULL::UUID as document_id,
  c.opening_balance as debit,
  0::NUMERIC as credit,
  c.opening_balance_currency as currency,
  1 as sort_order
FROM public.clients c
WHERE c.opening_balance != 0
  AND c.is_active = true
  AND c.deleted_at IS NULL

UNION ALL

-- Invoice Entries
SELECT 
  COALESCE(i.client_id, c.id) as client_id,
  i.client_name,
  i.created_at as entry_date,
  'invoice'::TEXT as entry_type,
  i.invoice_number as reference,
  i.id as document_id,
  i.amount_usd as debit,
  0::NUMERIC as credit,
  i.currency as currency,
  2 as sort_order
FROM public.invoices i
LEFT JOIN public.clients c ON i.client_id = c.id OR i.client_name = c.name
WHERE i.status != 'Cancelled'

UNION ALL

-- Payment Entries
SELECT 
  COALESCE(p.client_id, c.id) as client_id,
  COALESCE(p.client_name, c.name) as client_name,
  p.date::TIMESTAMPTZ as entry_date,
  'payment'::TEXT as entry_type,
  COALESCE(p.reference_id, 'Payment') as reference,
  p.id as document_id,
  0::NUMERIC as debit,
  p.amount_usd as credit,
  p.currency as currency,
  3 as sort_order
FROM public.payments p
LEFT JOIN public.clients c ON p.client_id = c.id OR p.client_name = c.name
WHERE p.type = 'Inbound'
  AND (p.is_deleted = false OR p.is_deleted IS NULL)

UNION ALL

-- Adjustment Entries (placeholder for future adjustments)
-- This allows manual balance adjustments to be tracked
SELECT 
  c.id as client_id,
  c.name as client_name,
  NOW() as entry_date,
  'adjustment'::TEXT as entry_type,
  'Manual Adjustment'::TEXT as reference,
  NULL::UUID as document_id,
  0::NUMERIC as debit,
  0::NUMERIC as credit,
  c.opening_balance_currency as currency,
  4 as sort_order
FROM public.clients c
WHERE 1 = 0; -- No actual rows, just schema definition

-- =============================================================================
-- 8. CREATE FUNCTION TO GET CLIENT LEDGER WITH RUNNING BALANCE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_client_ledger(p_client_id UUID)
RETURNS TABLE (
  entry_date TIMESTAMPTZ,
  entry_type TEXT,
  reference TEXT,
  document_id UUID,
  debit NUMERIC,
  credit NUMERIC,
  currency TEXT,
  running_balance NUMERIC
) AS $$
DECLARE
  v_running_balance NUMERIC := 0;
  v_currency TEXT := 'USD';
  r RECORD;
BEGIN
  -- Get client's currency preference
  SELECT opening_balance_currency INTO v_currency
  FROM public.clients
  WHERE id = p_client_id;
  
  IF v_currency IS NULL THEN
    v_currency := 'USD';
  END IF;

  -- Set initial running balance from opening balance
  SELECT COALESCE(opening_balance, 0) INTO v_running_balance
  FROM public.clients
  WHERE id = p_client_id;

  -- Return opening balance first
  IF v_running_balance != 0 THEN
    RETURN QUERY SELECT 
      (SELECT created_at FROM public.clients WHERE id = p_client_id) as entry_date,
      'opening_balance'::TEXT as entry_type,
      'Opening Balance'::TEXT as reference,
      NULL::UUID as document_id,
      CASE WHEN v_running_balance > 0 THEN v_running_balance ELSE 0 END as debit,
      CASE WHEN v_running_balance < 0 THEN ABS(v_running_balance) ELSE 0 END as credit,
      v_currency as currency,
      v_running_balance as running_balance;
  END IF;

  -- Process invoices and payments in chronological order
  FOR r IN 
    SELECT * FROM (
      -- Invoices
      SELECT 
        i.created_at as entry_date,
        'invoice'::TEXT as entry_type,
        i.invoice_number as reference,
        i.id as document_id,
        i.amount_usd as debit,
        0::NUMERIC as credit,
        i.currency as currency
      FROM public.invoices i
      WHERE (i.client_id = p_client_id 
             OR i.client_name = (SELECT name FROM public.clients WHERE id = p_client_id))
        AND i.status != 'Cancelled'
      
      UNION ALL
      
      -- Payments
      SELECT 
        p.date::TIMESTAMPTZ as entry_date,
        'payment'::TEXT as entry_type,
        COALESCE(p.reference_id, 'Payment') as reference,
        p.id as document_id,
        0::NUMERIC as debit,
        p.amount_usd as credit,
        p.currency as currency
      FROM public.payments p
      WHERE (p.client_id = p_client_id 
             OR p.client_name = (SELECT name FROM public.clients WHERE id = p_client_id))
        AND p.type = 'Inbound'
        AND (p.is_deleted = false OR p.is_deleted IS NULL)
    ) combined
    ORDER BY entry_date ASC
  LOOP
    v_running_balance := v_running_balance + r.debit - r.credit;
    
    RETURN QUERY SELECT 
      r.entry_date,
      r.entry_type,
      r.reference,
      r.document_id,
      r.debit,
      r.credit,
      COALESCE(r.currency, v_currency),
      v_running_balance;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. CREATE PAYMENT SOFT DELETE FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_payment(
  p_payment_id UUID,
  p_deleted_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.payments
  SET 
    is_deleted = true,
    deleted_by = p_deleted_by,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 10. CREATE TRIGGER TO AUTO-UPDATE CLIENT_ID ON PAYMENT INSERT/UPDATE
-- =============================================================================

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS payment_auto_client_id ON public.payments;

CREATE OR REPLACE FUNCTION public.payment_auto_set_client_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If client_name is provided but client_id is not, look up the client_id
  IF NEW.client_name IS NOT NULL AND NEW.client_id IS NULL THEN
    SELECT id INTO NEW.client_id
    FROM public.clients
    WHERE name = NEW.client_name
      AND is_active = true
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;
  
  -- If client_id is provided but client_name is not, look up the client_name
  IF NEW.client_id IS NOT NULL AND NEW.client_name IS NULL THEN
    SELECT name INTO NEW.client_name
    FROM public.clients
    WHERE id = NEW.client_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_auto_client_id
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payment_auto_set_client_id();

-- =============================================================================
-- 11. CREATE INVOICE CLIENT ID SYNC TRIGGER
-- =============================================================================

DROP TRIGGER IF EXISTS invoice_auto_client_id ON public.invoices;

CREATE OR REPLACE FUNCTION public.invoice_auto_set_client_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If client_name is provided but client_id is not, look up the client_id
  IF NEW.client_name IS NOT NULL AND NEW.client_id IS NULL THEN
    SELECT id INTO NEW.client_id
    FROM public.clients
    WHERE name = NEW.client_name
      AND is_active = true
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;
  
  -- If client_id is provided but client_name is not, look up the client_name
  IF NEW.client_id IS NOT NULL AND NEW.client_name IS NULL THEN
    SELECT name INTO NEW.client_name
    FROM public.clients
    WHERE id = NEW.client_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_auto_client_id
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.invoice_auto_set_client_id();

-- =============================================================================
-- 12. CREATE CLIENT SOFT DELETE FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_client(
  p_client_id UUID,
  p_deleted_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_invoice_count INTEGER;
  v_payment_count INTEGER;
BEGIN
  -- Check for related records (only active ones)
  SELECT COUNT(*) INTO v_invoice_count
  FROM public.invoices
  WHERE client_id = p_client_id
    AND status != 'Cancelled';
  
  SELECT COUNT(*) INTO v_payment_count
  FROM public.payments
  WHERE client_id = p_client_id
    AND (is_deleted = false OR is_deleted IS NULL);
  
  -- Don't delete if has financial history
  IF v_invoice_count > 0 OR v_payment_count > 0 THEN
    RETURN false;
  END IF;
  
  -- Soft delete the client
  UPDATE public.clients
  SET 
    is_active = false,
    deleted_at = NOW()
  WHERE id = p_client_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 13. UPDATE RLS POLICIES
-- =============================================================================

-- Update clients policies to filter deleted records
DROP POLICY IF EXISTS "Users can view clients" ON public.clients;
CREATE POLICY "Users can view clients"
  ON public.clients FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_active = true OR is_active IS NULL) AND deleted_at IS NULL);

-- Update payments policies to filter deleted records
DROP POLICY IF EXISTS "Users can view their organization's payments" ON public.payments;
CREATE POLICY "Users can view their organization's payments"
  ON public.payments FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_deleted = false OR is_deleted IS NULL));

-- =============================================================================
-- 14. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index for balance calculations
CREATE INDEX IF NOT EXISTS idx_clients_balance_calc 
  ON public.clients(id, opening_balance, opening_balance_currency, is_active) 
  WHERE is_active = true AND deleted_at IS NULL;

-- Index for payment date range + client queries
CREATE INDEX IF NOT EXISTS idx_payments_client_date 
  ON public.payments(client_id, date DESC) 
  WHERE is_deleted = false OR is_deleted IS NULL;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check clients table schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'clients' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check payments table schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'payments' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test the balance function (replace with actual client_id)
-- SELECT * FROM public.get_client_balance_v2('YOUR_CLIENT_UUID_HERE'::UUID);

-- View all active clients with balances
-- SELECT * FROM public.client_balances_v2 ORDER BY balance_due DESC;

-- =============================================================================
-- ROLLBACK (Uncomment and run if needed)
-- =============================================================================
/*
-- Drop new columns from clients
ALTER TABLE public.clients 
  DROP COLUMN IF EXISTS opening_balance,
  DROP COLUMN IF EXISTS opening_balance_currency,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS deleted_at;

-- Drop new columns from payments
ALTER TABLE public.payments 
  DROP COLUMN IF EXISTS is_deleted,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS deleted_by,
  DROP COLUMN IF EXISTS updated_at;

-- Drop triggers
DROP TRIGGER IF EXISTS payment_auto_client_id ON public.payments;
DROP TRIGGER IF EXISTS invoice_auto_client_id ON public.invoices;

-- Drop functions
DROP FUNCTION IF EXISTS public.get_client_balance_v2(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_client_ledger(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.soft_delete_payment(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.soft_delete_client(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.payment_auto_set_client_id() CASCADE;
DROP FUNCTION IF EXISTS public.invoice_auto_set_client_id() CASCADE;

-- Drop views
DROP VIEW IF EXISTS public.client_balances_v2 CASCADE;
DROP VIEW IF EXISTS public.client_ledger CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_clients_is_active;
DROP INDEX IF EXISTS idx_payments_is_deleted;
DROP INDEX IF EXISTS idx_payments_date_client;
DROP INDEX IF EXISTS idx_invoices_client_id;
DROP INDEX IF EXISTS idx_invoices_status_client;
DROP INDEX IF EXISTS idx_clients_balance_calc;
DROP INDEX IF EXISTS idx_payments_client_date;
*/
