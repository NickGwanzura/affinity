-- Freezit breakages table + WiFi monthly cost seed
-- The freezit_stock, freezit_sales, freezit_restock, wifi_token_sales,
-- and wifi_monthly_costs tables already exist in the deployed DB.
-- This migration only adds the new freezit_breakages table and seeds
-- the $110 internet package cost for the current month.

CREATE TABLE IF NOT EXISTS public.freezit_breakages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id       UUID REFERENCES public.freezit_stock(id) ON DELETE SET NULL,
  product_name   TEXT NOT NULL,
  quantity       NUMERIC NOT NULL CHECK (quantity > 0),
  unit_cost      NUMERIC NOT NULL DEFAULT 0,
  estimated_loss NUMERIC NOT NULL DEFAULT 0,
  reason         TEXT,
  breakage_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  agent_id       UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freezit_breakages_breakage_date ON public.freezit_breakages(breakage_date);
CREATE INDEX IF NOT EXISTS idx_freezit_breakages_stock_id ON public.freezit_breakages(stock_id);

-- Seed current month's $110 internet package cost
INSERT INTO public.wifi_monthly_costs (month, year, amount_usd, description)
VALUES (
  EXTRACT(MONTH FROM NOW())::INTEGER,
  EXTRACT(YEAR  FROM NOW())::INTEGER,
  110.00,
  'Internet Package'
)
ON CONFLICT (month, year) DO NOTHING;
