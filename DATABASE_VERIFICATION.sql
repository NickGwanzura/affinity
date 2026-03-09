-- ============================================
-- DATABASE VERIFICATION & TROUBLESHOOTING
-- ============================================
-- Run this to diagnose and fix database fetching issues
-- Execute in Supabase SQL Editor

-- ============================================
-- 1. CHECK IF TABLES EXIST
-- ============================================
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('vehicles', 'expenses', 'user_profiles', 'clients', 'employees', 'payslips', 'quotes', 'invoices', 'payments')
ORDER BY table_name;

-- Expected: All 9 tables should appear
-- If missing tables, you need to create them

-- ============================================
-- 1B. CHECK ACTUAL COLUMNS IN EACH TABLE
-- ============================================
-- This shows what columns actually exist (useful for debugging)
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('user_profiles', 'vehicles', 'expenses')
ORDER BY table_name, ordinal_position;

-- ============================================
-- 2. CHECK RLS (Row Level Security) STATUS
-- ============================================
SELECT 
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public' 
  AND tablename IN ('vehicles', 'expenses', 'user_profiles', 'clients', 'employees', 'payslips', 'quotes', 'invoices', 'payments')
ORDER BY tablename;

-- Expected: All tables should have rls_enabled = true and policy_count > 0

-- ============================================
-- 3. CHECK RLS POLICIES FOR USER_PROFILES
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- Expected: Should see policies like:
-- - "Authenticated users can view all profiles" (SELECT)
-- - "Admins can create user profiles" (INSERT)
-- - "Admins can update user profiles" (UPDATE)
-- - "Admins can delete user profiles" (DELETE)

-- ============================================
-- 4. CHECK RLS POLICIES FOR VEHICLES
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'vehicles'
ORDER BY policyname;

-- Expected: Policies allowing authenticated users to read vehicles

-- ============================================
-- 5. CHECK DATA EXISTS
-- ============================================
-- Check user_profiles
SELECT COUNT(*) as user_count FROM public.user_profiles;

-- Check vehicles
SELECT COUNT(*) as vehicle_count FROM public.vehicles;

-- Check expenses  
SELECT COUNT(*) as expense_count FROM public.expenses;

-- Check clients
SELECT COUNT(*) as client_count FROM public.clients;

-- ============================================
-- 6. CHECK CURRENT USER AUTHENTICATION
-- ============================================
SELECT 
  auth.uid() as current_user_id,
  auth.jwt() ->> 'email' as current_email,
  auth.jwt() ->> 'role' as auth_role;

-- Expected: Should return your logged-in user ID and email
-- If NULL, you are not authenticated

-- ============================================
-- 7. CHECK USER PROFILE FOR CURRENT USER
-- ============================================
SELECT 
  id,
  name,
  email,
  role
FROM public.user_profiles
WHERE id = auth.uid();

-- Expected: Should return YOUR user profile
-- If empty, your user_profile record is missing

-- ============================================
-- 8. TEST SELECT PERMISSION ON USER_PROFILES
-- ============================================
SELECT 
  id,
  name,
  email,
  role
FROM public.user_profiles
LIMIT 5;

-- Expected: Should return up to 5 user records
-- If error "permission denied", RLS policies are blocking

-- ============================================
-- 9. TEST SELECT PERMISSION ON VEHICLES
-- ============================================
SELECT 
  id,
  vin_number,
  make_model,
  status
FROM public.vehicles
LIMIT 5;

-- Expected: Should return up to 5 vehicle records
-- If error, RLS policies may be blocking

-- ============================================
-- 10. FIX: ENABLE PUBLIC READ ACCESS (IF NEEDED)
-- ============================================
-- ONLY RUN THIS IF YOU'RE GETTING RLS ERRORS

-- For user_profiles - Allow all authenticated users to read
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.user_profiles;
CREATE POLICY "Authenticated users can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- For vehicles - Allow all authenticated users to read
DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON public.vehicles;
CREATE POLICY "Authenticated users can view vehicles"
  ON public.vehicles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- For expenses - Allow all authenticated users to read
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses;
CREATE POLICY "Authenticated users can view expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- For clients - Allow all authenticated users to read
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
CREATE POLICY "Authenticated users can view clients"
  ON public.clients FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- 11. VERIFICATION SUMMARY
-- ============================================
-- Run this to see a summary of your setup
SELECT 
  'Total Tables' as metric,
  COUNT(*)::text as value
FROM information_schema.tables
WHERE table_schema = 'public'
UNION ALL
SELECT 
  'Tables with RLS',
  COUNT(*)::text
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
UNION ALL
SELECT 
  'Total Policies',
  COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public'
UNION ALL
SELECT 
  'User Profiles',
  COUNT(*)::text
FROM public.user_profiles
UNION ALL
SELECT 
  'Vehicles',
  COUNT(*)::text
FROM public.vehicles
UNION ALL
SELECT 
  'Expenses',
  COUNT(*)::text
FROM public.expenses;

-- ============================================
-- EXPECTED RESULTS:
-- ============================================
-- Total Tables: 9+ (vehicles, expenses, user_profiles, clients, employees, payslips, quotes, invoices, payments)
-- Tables with RLS: 9+ (all main tables should have RLS enabled)
-- Total Policies: 20+ (multiple policies per table)
-- User Profiles: 1+ (at least your admin user)
-- Vehicles: 0+ (may be empty initially)
-- Expenses: 0+ (may be empty initially)

-- If any of these are significantly different, you have a configuration issue!
