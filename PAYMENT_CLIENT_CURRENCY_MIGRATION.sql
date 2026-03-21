ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_currency_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_currency_check
  CHECK (currency IN ('USD', 'GBP'));

CREATE INDEX IF NOT EXISTS idx_payments_client_name ON public.payments(client_name);
CREATE INDEX IF NOT EXISTS idx_payments_currency ON public.payments(currency);
