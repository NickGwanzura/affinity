-- Add phone number support for login and create Mazvita Soko's account

-- 1. Add phone column to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Unique index only on non-null phone values
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_phone_unique
  ON user_profiles (phone)
  WHERE phone IS NOT NULL;

-- 2. Add Mazvita Soko with phone login and force password change on first login
INSERT INTO user_profiles (name, email, phone, role, access_role, status, password_hash, force_password_change, created_at, updated_at)
VALUES (
  'Mazvita Soko',
  'mazvita.soko@affinity.internal',
  '078478447',
  'Driver',
  'user',
  'Active',
  '$2b$12$anQ2ZCBqDzodIQvJZRPTZe5q8sJVUUD0lsSfLzdW70l4NpeahFRY6',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  phone              = EXCLUDED.phone,
  force_password_change = TRUE,
  updated_at         = NOW();
