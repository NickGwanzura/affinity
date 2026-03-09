-- ============================================
-- USER MANAGEMENT RLS FIX
-- ============================================
-- Problem: user_profiles RLS policies check auth.users.raw_user_meta_data->>'role'
-- but this is only set during signup, not for existing users
-- Solution: Check user_profiles.role directly instead

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can create user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can delete user profiles" ON public.user_profiles;

-- Create new simplified policies that work with authenticated users
-- All authenticated users can view all profiles
CREATE POLICY "Authenticated users can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins can insert (checked via user_profiles table, not auth metadata)
CREATE POLICY "Admins can create profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Admins can update (checked via user_profiles table)
CREATE POLICY "Admins can update profiles"
  ON public.user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Admins can delete (checked via user_profiles table)
CREATE POLICY "Admins can delete profiles"
  ON public.user_profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- ============================================
-- VERIFY RLS IS ENABLED
-- ============================================
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'user_profiles';

-- ============================================
-- TEST QUERIES
-- ============================================
-- Check current user
SELECT auth.uid() as current_user_id;

-- Check user_profiles data
SELECT id, name, email, role, created_at FROM public.user_profiles ORDER BY created_at DESC;

-- Check auth.users metadata
SELECT id, email, raw_user_meta_data FROM auth.users LIMIT 5;
