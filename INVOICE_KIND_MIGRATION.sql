ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_kind TEXT NOT NULL DEFAULT 'Standard';

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_invoice_kind_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_invoice_kind_check
  CHECK (invoice_kind IN ('Standard', 'Deposit', 'Final'));
