-- Exchange rates table
-- Replaces hard-coded rates in constants.ts, api/expenses.ts, and dataService.ts

CREATE TABLE IF NOT EXISTS exchange_rates (
  currency    TEXT PRIMARY KEY,
  rate_to_usd NUMERIC(10,6) NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with current default rates
INSERT INTO exchange_rates (currency, rate_to_usd) VALUES
  ('USD', 1.0),
  ('GBP', 1.25),
  ('NAD', 0.055),
  ('BWP', 0.073),
  ('ZAR', 0.055)
ON CONFLICT (currency) DO NOTHING;
