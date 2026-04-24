-- UNALLOCATED PAYMENTS MIGRATION
-- Allows payments to be recorded without requiring an invoice allocation
-- This supports advance payments, on-account credits, and overpayments

-- ============================================
-- 1. MODIFY PAYMENT_ALLOCATIONS TABLE
-- ============================================

-- Make invoice_id nullable to support unallocated payments
ALTER TABLE public.payment_allocations 
  ALTER COLUMN invoice_id DROP NOT NULL;

-- Add status column to track allocation type
ALTER TABLE public.payment_allocations 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'allocated' 
  CHECK (status IN ('allocated', 'unallocated', 'credit'));

-- Add client_id column to support client-level balance tracking
-- for unallocated payments
ALTER TABLE public.payment_allocations 
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Add index for faster client balance queries
CREATE INDEX IF NOT EXISTS idx_payment_allocations_client_id 
  ON public.payment_allocations(client_id) 
  WHERE client_id IS NOT NULL;

-- Add index for unallocated payments lookup
CREATE INDEX IF NOT EXISTS idx_payment_allocations_status 
  ON public.payment_allocations(status);

-- ============================================
-- 2. UPDATE PAYMENTS TABLE
-- ============================================

-- Add client_id to payments table for direct client linkage
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Add status column to payments
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'allocated' 
  CHECK (status IN ('allocated', 'unallocated', 'credit'));

-- Create index for client payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_client_id 
  ON public.payments(client_id) 
  WHERE client_id IS NOT NULL;

-- ============================================
-- 3. CREATE CLIENT BALANCE VIEW
-- ============================================

-- Create a view for easy client balance calculation
CREATE OR REPLACE VIEW public.client_balances AS
WITH client_invoices AS (
  SELECT 
    client_name,
    COALESCE(SUM(amount_usd), 0) as total_invoiced
  FROM public.invoices
  WHERE status != 'Cancelled'
  GROUP BY client_name
),
client_payments AS (
  SELECT 
    COALESCE(p.client_name, c.name) as client_name,
    COALESCE(SUM(p.amount_usd), 0) as total_paid
  FROM public.payments p
  LEFT JOIN public.clients c ON p.client_id = c.id
  WHERE p.type = 'Inbound'
  GROUP BY COALESCE(p.client_name, c.name)
)
SELECT 
  COALESCE(i.client_name, p.client_name) as client_name,
  COALESCE(i.total_invoiced, 0) as total_invoiced,
  COALESCE(p.total_paid, 0) as total_paid,
  COALESCE(i.total_invoiced, 0) - COALESCE(p.total_paid, 0) as balance
FROM client_invoices i
FULL OUTER JOIN client_payments p ON i.client_name = p.client_name;

-- ============================================
-- 4. CREATE FUNCTION TO GET CLIENT BALANCE
-- ============================================

CREATE OR REPLACE FUNCTION public.get_client_balance(client_name_param TEXT)
RETURNS NUMERIC AS $$
DECLARE
  total_invoiced NUMERIC;
  total_paid NUMERIC;
  balance NUMERIC;
BEGIN
  -- Get total invoiced amount (excluding cancelled invoices)
  SELECT COALESCE(SUM(amount_usd), 0)
  INTO total_invoiced
  FROM public.invoices
  WHERE client_name = client_name_param
    AND status != 'Cancelled';
  
  -- Get total paid amount (all inbound payments for this client)
  -- Including unallocated payments
  SELECT COALESCE(SUM(amount_usd), 0)
  INTO total_paid
  FROM public.payments
  WHERE client_name = client_name_param
    AND type = 'Inbound';
  
  balance := total_invoiced - total_paid;
  
  RETURN balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. CREATE TRIGGER TO AUTO-SET CLIENT_ID
-- ============================================

-- Function to auto-populate client_id from client_name
CREATE OR REPLACE FUNCTION public.set_payment_client_id()
RETURNS TRIGGER AS $$
DECLARE
  matching_client_id UUID;
BEGIN
  -- Try to find matching client by name
  SELECT id INTO matching_client_id
  FROM public.clients
  WHERE name = NEW.client_name
  LIMIT 1;
  
  -- Set client_id if found
  IF matching_client_id IS NOT NULL THEN
    NEW.client_id := matching_client_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop if exists)
DROP TRIGGER IF EXISTS set_payment_client_id_trigger ON public.payments;

CREATE TRIGGER set_payment_client_id_trigger
  BEFORE INSERT OR UPDATE OF client_name ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payment_client_id();

-- ============================================
-- 6. RLS POLICY UPDATES
-- ============================================

-- Ensure proper RLS policies for payment_allocations
DROP POLICY IF EXISTS "Users can view payment allocations" ON public.payment_allocations;
CREATE POLICY "Users can view payment allocations"
  ON public.payment_allocations FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins and Accountants can create payment allocations" ON public.payment_allocations;
CREATE POLICY "Admins and Accountants can create payment allocations"
  ON public.payment_allocations FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check the updated schema
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'payment_allocations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check payments table schema
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'payments' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
/*
-- Uncomment to rollback:

-- Restore NOT NULL constraint
ALTER TABLE public.payment_allocations 
  ALTER COLUMN invoice_id SET NOT NULL;

-- Drop new columns
ALTER TABLE public.payment_allocations 
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS client_id;

ALTER TABLE public.payments 
  DROP COLUMN IF EXISTS client_id,
  DROP COLUMN IF EXISTS status;

-- Drop indexes
DROP INDEX IF EXISTS idx_payment_allocations_client_id;
DROP INDEX IF EXISTS idx_payment_allocations_status;
DROP INDEX IF EXISTS idx_payments_client_id;

-- Drop view
DROP VIEW IF EXISTS public.client_balances;

-- Drop functions
DROP FUNCTION IF EXISTS public.get_client_balance(TEXT);
DROP FUNCTION IF EXISTS public.set_payment_client_id();

-- Drop trigger
DROP TRIGGER IF EXISTS set_payment_client_id_trigger ON public.payments;
*/
