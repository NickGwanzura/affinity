-- USER MANAGEMENT DIAGNOSTIC QUERY
-- Run this to diagnose why users aren't showing up

-- 1. Check if user_profiles table exists and has data
SELECT 
  'user_profiles table check' AS test,
  COUNT(*) AS total_users,
  COUNT(CASE WHEN status = 'Active' THEN 1 END) AS active_users,
  COUNT(CASE WHEN status = 'Inactive' THEN 1 END) AS inactive_users
FROM user_profiles;

-- 2. Check the schema of user_profiles
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 3. Check RLS policies on user_profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles';

-- 4. Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_profiles';

-- 5. Sample a few users (if any exist)
SELECT id, name, email, role, status, created_at
FROM user_profiles
LIMIT 5;
