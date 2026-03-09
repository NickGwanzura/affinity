-- ============================================
-- Authentication Migration - Neon PostgreSQL
-- Removes dependency on Supabase Auth
-- ============================================

-- 1. Add password fields to user_profiles table
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

-- 3. Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token 
ON password_reset_tokens(token);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id 
ON password_reset_tokens(user_id);

-- 4. Update existing users to require password setup
-- (They'll need to use password reset to set initial password)
UPDATE user_profiles
SET status = 'Inactive'
WHERE password_hash IS NULL;

-- 5. Function to clean up expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- IMPORTANT SETUP INSTRUCTIONS:
-- ============================================
-- 
-- 1. Add to your .env file:
--    VITE_JWT_SECRET=your-super-secret-jwt-key-min-32-chars
--
-- 2. For existing users, they must use "Forgot Password" 
--    to set their initial password since we're migrating
--
-- 3. Run this migration in your Neon SQL Editor
--
-- 4. After migration, the app will use Neon for auth only
--
-- ============================================
