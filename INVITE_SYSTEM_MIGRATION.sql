-- INVITE SYSTEM MIGRATION
-- Create the invites table to handle user invitations

-- 1. Create the invites table (Drop existing one to ensure correct schema)
DROP TABLE IF EXISTS invites CASCADE;

CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Manager', 'Driver', 'Accountant')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Expired', 'Cancelled')),
  invited_by UUID REFERENCES auth.users(id),
  invite_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage all invites" 
ON invites 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'Admin'
  )
);

-- Policy: Public/Unauthenticated access to verify invite by token
-- This is needed for the onboarding flow before the user has an account
CREATE POLICY "Public can view invite by token" 
ON invites 
FOR SELECT 
TO public 
USING (status = 'Pending' AND expires_at > NOW());

-- 4. Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(invite_token);
