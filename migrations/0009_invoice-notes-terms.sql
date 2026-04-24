-- Add invoice presentation fields for customer-facing PDFs.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
