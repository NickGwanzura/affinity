-- Batch code field for invoices and receipts
-- Run this in your Neon SQL editor

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS batch TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS batch TEXT;

-- Optional index for fast batch lookups / grouping
CREATE INDEX IF NOT EXISTS idx_invoices_batch ON public.invoices (batch);
CREATE INDEX IF NOT EXISTS idx_receipts_batch ON public.receipts (batch);
