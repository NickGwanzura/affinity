-- ============================================
-- ADD MISSING TIMESTAMPS TO USER_PROFILES
-- ============================================
-- Adds created_at and updated_at columns if they don't exist
-- Run this in Supabase SQL Editor

-- Add created_at column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_at column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing rows to have timestamps
UPDATE public.user_profiles 
SET created_at = NOW(), updated_at = NOW()
WHERE created_at IS NULL;

-- Add trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verification
SELECT 
  id,
  name,
  email,
  role,
  status,
  created_at,
  updated_at
FROM public.user_profiles
ORDER BY created_at DESC;

-- All users should now have timestamps
