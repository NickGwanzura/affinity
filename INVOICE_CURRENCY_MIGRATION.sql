-- Invoice Currency Migration for Affinity CRM
-- This migration creates the invoices table with dual currency support (USD and GBP)
-- Run this in Supabase SQL Editor

-- Create invoices table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  quote_id UUID,
  vehicle_id UUID,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  amount_usd NUMERIC(12, 2) NOT NULL CHECK (amount_usd > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled')),
  description TEXT,
  due_date DATE NOT NULL,
  items JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint to allow only USD and GBP
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_currency_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_currency_check
  CHECK (currency IN ('USD', 'GBP'));

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_vehicle_id ON public.invoices(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON public.invoices(quote_id);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their organization's invoices" ON public.invoices;
CREATE POLICY "Users can view their organization's invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins and Accountants can create invoices" ON public.invoices;
CREATE POLICY "Admins and Accountants can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

DROP POLICY IF EXISTS "Admins and Accountants can update invoices" ON public.invoices;
CREATE POLICY "Admins and Accountants can update invoices"
  ON public.invoices FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;
CREATE POLICY "Admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );
