-- ============================================
-- Neon Auth Migration - Add Password Support
-- Users are already in user_profiles table
-- ============================================

-- 1. Add password columns to existing user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS password_salt TEXT,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- 2. Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- 3. Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token 
ON password_reset_tokens(token);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id 
ON password_reset_tokens(user_id);

-- 4. Create index on email for faster auth lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email_auth 
ON user_profiles(email);

-- ============================================
-- SETUP INSTRUCTIONS:
-- ============================================
-- 
-- 1. Run this migration in your Neon SQL Editor
--
-- 2. Add to your .env file:
--    VITE_JWT_SECRET=your-super-secret-jwt-key-min-32-chars
--
-- 3. For existing users without passwords:
--    - They must use "Forgot Password" to set their initial password
--    - Or you can set a default password manually
--
-- 4. The app will now use Neon for authentication only
--
-- ============================================

-- Optional: Check which users need to set passwords
-- SELECT id, name, email FROM user_profiles WHERE password_hash IS NULL;
