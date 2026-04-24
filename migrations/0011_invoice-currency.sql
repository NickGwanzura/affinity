ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_currency_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_currency_check
  CHECK (currency IN ('USD', 'GBP'));
