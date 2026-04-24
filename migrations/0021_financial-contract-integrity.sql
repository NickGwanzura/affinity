-- Financial contract integrity migration
-- Aligns the active API contract with the database schema for vehicles, quotes,
-- invoices, payments, and line-item-backed financial documents.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vin_number TEXT NOT NULL UNIQUE,
  make_model TEXT NOT NULL,
  purchase_price_gbp NUMERIC(12, 2) NOT NULL CHECK (purchase_price_gbp > 0),
  status TEXT NOT NULL DEFAULT 'UK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_status_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_status_check
  CHECK (status IN ('UK', 'Namibia', 'Zimbabwe', 'Botswana', 'Sold'));

CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON public.vehicles (created_at DESC);

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_status_check;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected'));

CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON public.quotes (client_id);

DROP TRIGGER IF EXISTS update_quotes_updated_at ON public.quotes;
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices (client_id);

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

UPDATE public.payments
SET type = CASE
  WHEN type IN ('Invoice Payment', 'Quote Payment', 'Deposit') THEN 'Inbound'
  WHEN type = 'Refund' THEN 'Outbound'
  ELSE type
END
WHERE type IN ('Invoice Payment', 'Quote Payment', 'Deposit', 'Refund');

DO $$
DECLARE
  unresolved_types TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT type ORDER BY type)
  INTO unresolved_types
  FROM public.payments
  WHERE type NOT IN ('Inbound', 'Outbound');

  IF unresolved_types IS NOT NULL THEN
    RAISE EXCEPTION 'Unmapped payment types remain in public.payments: %', unresolved_types;
  END IF;
END $$;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_type_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_type_check
  CHECK (type IN ('Inbound', 'Outbound'));

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_currency_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_currency_check
  CHECK (currency IN ('USD', 'GBP'));

WITH unique_clients AS (
  SELECT LOWER(BTRIM(name)) AS normalized_name, MIN(id) AS client_id
  FROM public.clients
  GROUP BY LOWER(BTRIM(name))
  HAVING COUNT(*) = 1
)
UPDATE public.quotes q
SET client_id = uc.client_id
FROM unique_clients uc
WHERE q.client_id IS NULL
  AND LOWER(BTRIM(q.client_name)) = uc.normalized_name;

WITH unique_clients AS (
  SELECT LOWER(BTRIM(name)) AS normalized_name, MIN(id) AS client_id
  FROM public.clients
  GROUP BY LOWER(BTRIM(name))
  HAVING COUNT(*) = 1
)
UPDATE public.invoices i
SET client_id = uc.client_id
FROM unique_clients uc
WHERE i.client_id IS NULL
  AND LOWER(BTRIM(i.client_name)) = uc.normalized_name;

CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 1 INCREMENT BY 1;

DO $$
DECLARE
  quote_max BIGINT;
  invoice_max BIGINT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(quote_number, '^QT-\d{4}-(\d+)$'))[1]::BIGINT), 0)
  INTO quote_max
  FROM public.quotes;

  IF quote_max > 0 THEN
    PERFORM setval('public.quote_number_seq', quote_max, true);
  ELSE
    PERFORM setval('public.quote_number_seq', 1, false);
  END IF;

  SELECT COALESCE(MAX((regexp_match(invoice_number, '^INV-\d{4}-(\d+)$'))[1]::BIGINT), 0)
  INTO invoice_max
  FROM public.invoices;

  IF invoice_max > 0 THEN
    PERFORM setval('public.invoice_number_seq', invoice_max, true);
  ELSE
    PERFORM setval('public.invoice_number_seq', 1, false);
  END IF;
END $$;
