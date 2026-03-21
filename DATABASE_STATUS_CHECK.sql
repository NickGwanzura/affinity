-- ============================================
-- DATABASE STATUS CHECK
-- ============================================
-- Run this in Supabase SQL Editor to check your database state
-- Copy and paste each section separately

-- ============================================
-- SECTION 1: CHECK WHICH TABLES EXIST
-- ============================================
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN (
    'vehicles', 'expenses', 'user_profiles', 'clients', 
    'employees', 'payslips', 'quotes', 'invoices', 'payments',
    'quote_items', 'invoice_items', 'receipts', 'operating_funds'
  )
ORDER BY table_name;

-- ============================================
-- SECTION 2: CHECK RLS STATUS
-- ============================================
SELECT 
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public' 
  AND tablename IN (
    'vehicles', 'expenses', 'user_profiles', 'clients',
    'employees', 'payslips', 'quotes', 'invoices', 'payments',
    'quote_items', 'invoice_items', 'receipts', 'operating_funds'
  )
ORDER BY tablename;

-- ============================================
-- SECTION 3: COUNT RECORDS IN EACH TABLE
-- ============================================
-- Run each separately:
SELECT 'user_profiles' as table_name, COUNT(*) as count FROM public.user_profiles
UNION ALL SELECT 'vehicles', COUNT(*) FROM public.vehicles
UNION ALL SELECT 'expenses', COUNT(*) FROM public.expenses
UNION ALL SELECT 'clients', COUNT(*) FROM public.clients
UNION ALL SELECT 'employees', COUNT(*) FROM public.employees
UNION ALL SELECT 'payslips', COUNT(*) FROM public.payslips
UNION ALL SELECT 'quotes', COUNT(*) FROM public.quotes
UNION ALL SELECT 'invoices', COUNT(*) FROM public.invoices
UNION ALL SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL SELECT 'quote_items', COUNT(*) FROM public.quote_items
UNION ALL SELECT 'invoice_items', COUNT(*) FROM public.invoice_items
UNION ALL SELECT 'receipts', COUNT(*) FROM public.receipts
UNION ALL SELECT 'operating_funds', COUNT(*) FROM public.operating_funds;

-- ============================================
-- SECTION 4: CHECK CURRENT USER AUTH
-- ============================================
SELECT 
  auth.uid() as current_user_id,
  auth.jwt() ->> 'email' as current_email,
  auth.jwt() ->> 'role' as auth_role;

-- ============================================
-- SECTION 5: CHECK USER PROFILE FOR CURRENT USER
-- ============================================
SELECT id, name, email, role, status
FROM public.user_profiles
WHERE id = auth.uid();

-- ============================================
-- SECTION 6: TEST READ PERMISSIONS
-- ============================================
-- Test vehicles read:
SELECT id, vin_number, make_model FROM public.vehicles LIMIT 3;

-- Test expenses read:
SELECT id, description, amount FROM public.expenses LIMIT 3;

-- Test invoices read:
SELECT id, invoice_number, amount_usd FROM public.invoices LIMIT 3;

-- Test quotes read:
SELECT id, quote_number, amount_usd FROM public.quotes LIMIT 3;
