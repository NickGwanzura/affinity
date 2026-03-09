-- ============================================
-- Update Password for gwanzuranicholas@gmail.com
-- New Password: Nh@modzepasi9
-- ============================================

UPDATE user_profiles
SET 
  password_hash = '42a612cc7d9e8dbb938393b33a921614dc521afbe56976a922c2727e1a9fcfe7',
  password_salt = '2deebf7d5427682a58d56089015972a3'
WHERE email = 'gwanzuranicholas@gmail.com';

-- Verify the update
SELECT id, name, email, role, status, created_at
FROM user_profiles
WHERE email = 'gwanzuranicholas@gmail.com';
