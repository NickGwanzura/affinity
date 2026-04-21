-- ============================================
-- Update Password for MAXMOS MAGEDE
-- Email: maxmosmagede@gmail.com
-- New Password: M@xmos_2026
-- Hash: bcrypt, cost 12
-- ============================================

UPDATE user_profiles
SET
  password_hash = '$2b$12$rB3vtDYTKzxOJrcu29BFU.2b7H0ThuG/Ze6yctjgMHglXdyHIZEGi',
  password_salt = NULL,
  force_password_change = false,
  updated_at = NOW()
WHERE email = 'maxmosmagede@gmail.com';

-- Verify the update
SELECT id, name, email, role, status, updated_at
FROM user_profiles
WHERE email = 'maxmosmagede@gmail.com';
