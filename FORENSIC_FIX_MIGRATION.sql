-- FORENSIC FIX MIGRATION
-- Client Directory Full CRUD + Payments Audit Trail + Ledger Statements

-- ============================================
-- 1. CLIENTS TABLE ENHANCEMENTS
-- ============================================

-- Add opening_balance for tracking starting balance
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS opening_balance_currency TEXT DEFAULT 'USD' 
  CHECK (opening_balance_currency IN ('USD', 'GBP'));

-- Add soft delete support
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_clients_is_active 
  ON public.clients(is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_clients_deleted_at 
  ON public.clients(deleted_at) 
  WHERE deleted_at IS NULL;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_updated_at_trigger ON public.clients;
CREATE TRIGGER clients_updated_at_trigger
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION update_clients_updated_at();

-- ============================================
-- 2. PAYMENTS TABLE AUDIT TRAIL
-- ============================================

-- Add soft delete support
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Add audit user tracking
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ensure updated_at exists
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Add deleted_at for soft delete
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_payments_is_deleted 
  ON public.payments(is_deleted) 
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_payments_deleted_at 
  ON public.payments(deleted_at) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_created_by 
  ON public.payments(created_by);

-- ============================================
-- 3. CLIENT LEDGER VIEW
-- ============================================

-- Drop existing view if exists
DROP VIEW IF EXISTS public.client_ledger;

-- Create comprehensive client ledger view
CREATE OR REPLACE VIEW public.client_ledger AS
WITH opening_balances AS (
  -- Opening balance entries
  SELECT 
    c.id as client_id,
    c.name as client_name,
    c.created_at as entry_date,
    'opening_balance'::TEXT as entry_type,
    'Opening Balance'::TEXT as reference,
    NULL::UUID as document_id,
    CASE WHEN c.opening_balance > 0 THEN c.opening_balance ELSE 0 END as debit,
    CASE WHEN c.opening_balance < 0 THEN ABS(c.opening_balance) ELSE 0 END as credit,
    c.opening_balance as balance,
    c.opening_balance_currency as currency,
    0 as sort_order
  FROM public.clients c
  WHERE c.opening_balance != 0
    AND c.deleted_at IS NULL
),
invoice_entries AS (
  -- Invoice entries (debits)
  SELECT 
    c.id as client_id,
    c.name as client_name,
    i.created_at as entry_date,
    'invoice'::TEXT as entry_type,
    i.invoice_number as reference,
    i.id as document_id,
    i.amount_usd as debit,
    0 as credit,
    0 as balance, -- calculated later
    i.currency as currency,
    1 as sort_order
  FROM public.invoices i
  JOIN public.clients c ON i.client_name = c.name
  WHERE i.status != 'Cancelled'
    AND c.deleted_at IS NULL
),
payment_entries AS (
  -- Payment entries (credits)
  SELECT 
    c.id as client_id,
    c.name as client_name,
    p.date::TIMESTAMPTZ as entry_date,
    'payment'::TEXT as entry_type,
    p.reference_id as reference,
    p.id as document_id,
    0 as debit,
    p.amount_usd as credit,
    0 as balance, -- calculated later
    p.currency as currency,
    2 as sort_order
  FROM public.payments p
  JOIN public.clients c ON p.client_name = c.name
  WHERE p.type = 'Inbound'
    AND (p.is_deleted = false OR p.is_deleted IS NULL)
    AND p.deleted_at IS NULL
    AND c.deleted_at IS NULL
),
all_entries AS (
  SELECT * FROM opening_balances
  UNION ALL
  SELECT * FROM invoice_entries
  UNION ALL
  SELECT * FROM payment_entries
),
-- Calculate running balance per client
ordered_entries AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (
      PARTITION BY client_id 
      ORDER BY entry_date ASC, sort_order ASC, reference ASC
    ) as row_num
  FROM all_entries
),
calculated_balances AS (
  SELECT 
    oe.*,
    SUM(oe.debit - oe.credit) OVER (
      PARTITION BY oe.client_id 
      ORDER BY oe.entry_date ASC, oe.sort_order ASC, oe.reference ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as running_balance
  FROM ordered_entries oe
)
SELECT 
  client_id,
  client_name,
  entry_date,
  entry_type,
  reference,
  document_id,
  debit,
  credit,
  running_balance as balance,
  currency,
  sort_order,
  row_num as line_number
FROM calculated_balances
ORDER BY client_name, entry_date, sort_order, reference;

-- ============================================
-- 4. CLIENT STATEMENT FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.get_client_statement(
  p_client_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  entry_date TIMESTAMPTZ,
  entry_type TEXT,
  reference TEXT,
  description TEXT,
  debit NUMERIC,
  credit NUMERIC,
  balance NUMERIC,
  currency TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH opening_balances AS (
    SELECT 
      c.id as client_id,
      c.name as client_name,
      c.created_at as entry_date,
      'opening_balance'::TEXT as entry_type,
      'Opening Balance'::TEXT as reference,
      'Starting balance for ' || c.name as description,
      CASE WHEN c.opening_balance > 0 THEN c.opening_balance ELSE 0 END as debit,
      CASE WHEN c.opening_balance < 0 THEN ABS(c.opening_balance) ELSE 0 END as credit,
      c.opening_balance as balance,
      c.opening_balance_currency as currency,
      0 as sort_order
    FROM public.clients c
    WHERE c.id = p_client_id
      AND c.opening_balance != 0
      AND c.deleted_at IS NULL
  ),
  invoice_entries AS (
    SELECT 
      c.id as client_id,
      c.name as client_name,
      i.created_at as entry_date,
      'invoice'::TEXT as entry_type,
      i.invoice_number as reference,
      COALESCE(i.description, 'Invoice ' || i.invoice_number) as description,
      i.amount_usd as debit,
      0 as credit,
      0 as balance,
      COALESCE(i.currency, 'USD') as currency,
      1 as sort_order
    FROM public.invoices i
    JOIN public.clients c ON i.client_name = c.name
    WHERE c.id = p_client_id
      AND i.status != 'Cancelled'
      AND c.deleted_at IS NULL
      AND (p_date_from IS NULL OR i.created_at::DATE >= p_date_from)
      AND (p_date_to IS NULL OR i.created_at::DATE <= p_date_to)
  ),
  payment_entries AS (
    SELECT 
      c.id as client_id,
      c.name as client_name,
      p.date::TIMESTAMPTZ as entry_date,
      'payment'::TEXT as entry_type,
      p.reference_id as reference,
      'Payment via ' || COALESCE(p.method, 'Unknown') as description,
      0 as debit,
      p.amount_usd as credit,
      0 as balance,
      COALESCE(p.currency, 'USD') as currency,
      2 as sort_order
    FROM public.payments p
    JOIN public.clients c ON p.client_name = c.name
    WHERE c.id = p_client_id
      AND p.type = 'Inbound'
      AND (p.is_deleted = false OR p.is_deleted IS NULL)
      AND p.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND (p_date_from IS NULL OR p.date::DATE >= p_date_from)
      AND (p_date_to IS NULL OR p.date::DATE <= p_date_to)
  ),
  all_entries AS (
    SELECT * FROM opening_balances
    UNION ALL
    SELECT * FROM invoice_entries
    UNION ALL
    SELECT * FROM payment_entries
  ),
  calculated AS (
    SELECT 
      ae.*,
      SUM(ae.debit - ae.credit) OVER (
        ORDER BY ae.entry_date ASC, ae.sort_order ASC, ae.reference ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as running_balance
    FROM all_entries ae
  )
  SELECT 
    c.entry_date,
    c.entry_type,
    c.reference,
    c.description,
    c.debit,
    c.credit,
    c.running_balance as balance,
    c.currency
  FROM calculated c
  ORDER BY c.entry_date ASC, c.sort_order ASC, c.reference ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. CLIENT BALANCE SUMMARY FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.get_client_balance_summary(p_client_id UUID)
RETURNS TABLE (
  total_invoiced NUMERIC,
  total_paid NUMERIC,
  opening_balance NUMERIC,
  current_balance NUMERIC,
  currency TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(i.amount_usd), 0) as total_invoiced,
    COALESCE(SUM(p.amount_usd), 0) as total_paid,
    COALESCE(c.opening_balance, 0) as opening_balance,
    COALESCE(c.opening_balance, 0) + COALESCE(SUM(i.amount_usd), 0) - COALESCE(SUM(p.amount_usd), 0) as current_balance,
    COALESCE(c.opening_balance_currency, 'USD') as currency
  FROM public.clients c
  LEFT JOIN public.invoices i ON i.client_name = c.name AND i.status != 'Cancelled'
  LEFT JOIN public.payments p ON p.client_name = c.name 
    AND p.type = 'Inbound' 
    AND (p.is_deleted = false OR p.is_deleted IS NULL)
    AND p.deleted_at IS NULL
  WHERE c.id = p_client_id
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.opening_balance, c.opening_balance_currency;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. SOFT DELETE FUNCTIONS
-- ============================================

-- Soft delete client
CREATE OR REPLACE FUNCTION public.soft_delete_client(
  p_client_id UUID,
  p_deleted_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.clients
  SET 
    is_active = false,
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql;

-- Soft delete payment
CREATE OR REPLACE FUNCTION public.soft_delete_payment(
  p_payment_id UUID,
  p_deleted_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.payments
  SET 
    is_deleted = true,
    deleted_at = NOW(),
    deleted_by = p_deleted_by
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql;

-- Restore deleted client
CREATE OR REPLACE FUNCTION public.restore_client(p_client_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.clients
  SET 
    is_active = true,
    deleted_at = NULL,
    updated_at = NOW()
  WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql;

-- Restore deleted payment
CREATE OR REPLACE FUNCTION public.restore_payment(p_payment_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.payments
  SET 
    is_deleted = false,
    deleted_at = NULL,
    deleted_by = NULL
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. RLS POLICY UPDATES
-- ============================================

-- Update clients RLS to respect soft deletes
DROP POLICY IF EXISTS "Users can view clients" ON public.clients;
CREATE POLICY "Users can view clients"
  ON public.clients FOR SELECT
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

-- Soft delete aware policy for payments
DROP POLICY IF EXISTS "Users can view their organization's payments" ON public.payments;
CREATE POLICY "Users can view their organization's payments"
  ON public.payments FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_deleted = false OR is_deleted IS NULL) AND deleted_at IS NULL);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

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

-- Test client ledger view
SELECT * FROM public.client_ledger LIMIT 10;

-- Test statement function (replace with actual client_id)
-- SELECT * FROM public.get_client_statement('your-client-uuid-here');

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
/*
-- Restore clients table
ALTER TABLE public.clients 
  DROP COLUMN IF EXISTS opening_balance,
  DROP COLUMN IF EXISTS opening_balance_currency,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS deleted_at;

-- Restore payments table
ALTER TABLE public.payments 
  DROP COLUMN IF EXISTS is_deleted,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS deleted_by,
  DROP COLUMN IF EXISTS deleted_at;

-- Drop views and functions
DROP VIEW IF EXISTS public.client_ledger;
DROP FUNCTION IF EXISTS public.get_client_statement(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_client_balance_summary(UUID);
DROP FUNCTION IF EXISTS public.soft_delete_client(UUID, UUID);
DROP FUNCTION IF EXISTS public.soft_delete_payment(UUID, UUID);
DROP FUNCTION IF EXISTS public.restore_client(UUID);
DROP FUNCTION IF EXISTS public.restore_payment(UUID);
*/
