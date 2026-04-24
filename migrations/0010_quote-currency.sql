ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_currency_check;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_currency_check
  CHECK (currency IN ('USD', 'GBP'));
