-- Operating Funds table
-- Tracks money received from office and disbursements to drivers/operations

CREATE TABLE IF NOT EXISTS public.operating_funds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN ('Received', 'Disbursed')),
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency    TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'GBP')),
  description TEXT NOT NULL,
  reference   TEXT,          -- e.g. "Office Transfer #123"
  recipient   TEXT,          -- driver name or source for Received
  approved_by TEXT,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operating_funds_date
  ON public.operating_funds(date DESC);

CREATE INDEX IF NOT EXISTS idx_operating_funds_type
  ON public.operating_funds(type);
