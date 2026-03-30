-- Document number sequence migration
-- Restores quote/invoice numbering sequences for environments that missed the
-- sequence section of the financial integrity migration.

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
