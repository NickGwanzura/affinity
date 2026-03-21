CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_allocated NUMERIC(12, 2) NOT NULL CHECK (amount_allocated > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_allocations_currency_check CHECK (currency IN ('USD', 'GBP'))
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id
  ON public.payment_allocations(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id
  ON public.payment_allocations(invoice_id);
