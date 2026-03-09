-- Financial Tables Migration for Affinity CRM
-- This migration creates tables for quotes, invoices, payments, user_profiles, clients, and invites
-- Run this in Supabase SQL Editor after backing up your database

-- ============================================
-- 1. QUOTES TABLE
-- ============================================
-- Drop existing table if schema is different
DROP TABLE IF EXISTS public.quotes CASCADE;

CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  amount_usd NUMERIC(12, 2) NOT NULL CHECK (amount_usd > 0),
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected')),
  description TEXT,
  valid_until DATE,
  items JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_created_at ON public.quotes(created_at DESC);
CREATE INDEX idx_quotes_vehicle_id ON public.quotes(vehicle_id);

-- RLS Policies
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's quotes"
  ON public.quotes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Accountants can create quotes"
  ON public.quotes FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins and Accountants can update quotes"
  ON public.quotes FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins can delete quotes"
  ON public.quotes FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

-- ============================================
-- 2. INVOICES TABLE
-- ============================================
-- Drop existing table if schema is different
DROP TABLE IF EXISTS public.invoices CASCADE;

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  amount_usd NUMERIC(12, 2) NOT NULL CHECK (amount_usd > 0),
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled')),
  description TEXT,
  due_date DATE NOT NULL,
  items JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX idx_invoices_vehicle_id ON public.invoices(vehicle_id);
CREATE INDEX idx_invoices_quote_id ON public.invoices(quote_id);

-- RLS Policies
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Accountants can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins and Accountants can update invoices"
  ON public.invoices FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

-- ============================================
-- 3. PAYMENTS TABLE
-- ============================================
-- Drop existing table if schema is different
DROP TABLE IF EXISTS public.payments CASCADE;

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id TEXT NOT NULL, -- Invoice number or quote number
  type TEXT NOT NULL CHECK (type IN ('Invoice Payment', 'Quote Payment', 'Deposit', 'Refund', 'Other')),
  amount_usd NUMERIC(12, 2) NOT NULL CHECK (amount_usd > 0),
  method TEXT, -- Wire, Card, Cash, Check, etc.
  date TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_payments_reference_id ON public.payments(reference_id);
CREATE INDEX idx_payments_date ON public.payments(date DESC);
CREATE INDEX idx_payments_type ON public.payments(type);

-- RLS Policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's payments"
  ON public.payments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Accountants can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins and Accountants can update payments"
  ON public.payments FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins can delete payments"
  ON public.payments FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

-- ============================================
-- 4. USER_PROFILES TABLE
-- ============================================
-- Drop existing table if schema is different
DROP TABLE IF EXISTS public.user_profiles CASCADE;

CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Accountant', 'Driver')),
  phone TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);

-- RLS Policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can create user profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

CREATE POLICY "Admins can update user profiles"
  ON public.user_profiles FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

CREATE POLICY "Admins can delete user profiles"
  ON public.user_profiles FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. CLIENTS TABLE
-- ============================================
-- Drop existing table if schema is different
DROP TABLE IF EXISTS public.clients CASCADE;

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_clients_name ON public.clients(name);
CREATE INDEX idx_clients_email ON public.clients(email);

-- RLS Policies
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clients"
  ON public.clients FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Accountants can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins and Accountants can update clients"
  ON public.clients FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins can delete clients"
  ON public.clients FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. INVITES TABLE
-- ============================================
-- Drop existing table if schema is different
DROP TABLE IF EXISTS public.invites CASCADE;

CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Accountant', 'Driver')),
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Expired', 'Revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_invites_email ON public.invites(email);
CREATE INDEX idx_invites_token ON public.invites(token);
CREATE INDEX idx_invites_status ON public.invites(status);
CREATE INDEX idx_invites_expires_at ON public.invites(expires_at);

-- RLS Policies
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all invites"
  ON public.invites FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

CREATE POLICY "Admins can create invites"
  ON public.invites FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

CREATE POLICY "Admins can update invites"
  ON public.invites FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

CREATE POLICY "Admins can delete invites"
  ON public.invites FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after the migration to verify tables were created:

-- List all new tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('quotes', 'invoices', 'payments', 'user_profiles', 'clients', 'invites');

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('quotes', 'invoices', 'payments', 'user_profiles', 'clients', 'invites');

-- Check indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('quotes', 'invoices', 'payments', 'user_profiles', 'clients', 'invites')
ORDER BY tablename, indexname;

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- Uncomment and run these if you need to rollback:

-- DROP TABLE IF EXISTS public.invites CASCADE;
-- DROP TABLE IF EXISTS public.clients CASCADE;
-- DROP TABLE IF EXISTS public.user_profiles CASCADE;
-- DROP TABLE IF EXISTS public.payments CASCADE;
-- DROP TABLE IF EXISTS public.invoices CASCADE;
-- DROP TABLE IF EXISTS public.quotes CASCADE;
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
