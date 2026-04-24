-- ============================================
-- LINE ITEM DISCOUNTS + RECEIPT ITEM SNAPSHOTS
-- ============================================
-- Run this in Supabase SQL Editor before using percentage discounts

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0);

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0);

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS items JSONB;

UPDATE public.quote_items
SET
  discount_percentage = COALESCE(discount_percentage, 0),
  discount_amount = COALESCE(discount_amount, 0)
WHERE discount_percentage IS NULL OR discount_amount IS NULL;

UPDATE public.invoice_items
SET
  discount_percentage = COALESCE(discount_percentage, 0),
  discount_amount = COALESCE(discount_amount, 0)
WHERE discount_percentage IS NULL OR discount_amount IS NULL;
