-- Daily Ice Sales Tracking Module
-- Tracks daily ice block/cube sales, revenue, and payment methods.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── ice_sales ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ice_sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_sold   INTEGER NOT NULL CHECK (quantity_sold > 0),
  unit_price      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_sales     NUMERIC(10, 2) GENERATED ALWAYS AS (quantity_sold * unit_price) STORED,
  payment_method  TEXT NOT NULL DEFAULT 'Cash',
  customer_name   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ice_sales_sale_date   ON public.ice_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_ice_sales_created_at  ON public.ice_sales(created_at);
