-- SYNC AUTH USERS TO USER_PROFILES
-- This will copy all users from auth.users to user_profiles

-- Insert users from auth.users into user_profiles
INSERT INTO user_profiles (id, name, email, role, status)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', au.email) AS name,
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'Driver') AS role,
  'Active' AS status
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.id = au.id
);

-- Verify the sync
SELECT 
  COUNT(*) AS total_synced_users,
  COUNT(CASE WHEN role = 'Admin' THEN 1 END) AS admins,
  COUNT(CASE WHEN role = 'Driver' THEN 1 END) AS drivers,
  COUNT(CASE WHEN role = 'Manager' THEN 1 END) AS managers,
  COUNT(CASE WHEN role = 'Accountant' THEN 1 END) AS accountants
FROM user_profiles;
