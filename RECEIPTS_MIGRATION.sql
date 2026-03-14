-- Receipts Table Migration for Affinity CRM
-- This migration creates the receipts table for payment receipts
-- Run this in Supabase SQL Editor

-- Create receipts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  amount_received NUMERIC(12, 2) NOT NULL CHECK (amount_received > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  payment_date DATE NOT NULL,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON public.receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_id ON public.receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON public.receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_client_name ON public.receipts(client_name);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_date ON public.receipts(payment_date DESC);

-- Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view receipts" ON public.receipts;
CREATE POLICY "Users can view receipts"
  ON public.receipts FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins and Accountants can create receipts" ON public.receipts;
CREATE POLICY "Admins and Accountants can create receipts"
  ON public.receipts FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

DROP POLICY IF EXISTS "Admins and Accountants can update receipts" ON public.receipts;
CREATE POLICY "Admins and Accountants can update receipts"
  ON public.receipts FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Accountant')
    )
  );

DROP POLICY IF EXISTS "Admins can delete receipts" ON public.receipts;
CREATE POLICY "Admins can delete receipts"
  ON public.receipts FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );
