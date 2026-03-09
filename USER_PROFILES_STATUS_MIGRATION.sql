-- USER_PROFILES STATUS COLUMN MIGRATION
-- Add missing 'status' column to user_profiles table

-- 1. Add the status column
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active' 
CHECK (status IN ('Active', 'Inactive'));

-- 2. Update existing users to have 'Active' status
UPDATE user_profiles 
SET status = 'Active' 
WHERE status IS NULL;

-- Success message
SELECT 'user_profiles table updated successfully with status column' AS result;
