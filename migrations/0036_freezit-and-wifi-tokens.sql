-- Freezit Sales + WiFi Token Sales
-- Run once per environment before deploying the new api/freezit.ts
-- and api/wifi-tokens.ts handlers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── freezit_items ────────────────────────────────────────────────────────────
-- Products stocked and sold through Freezit Sales.
CREATE TABLE IF NOT EXISTS public.freezit_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  unit_cost     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_price    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock_qty     INTEGER NOT NULL DEFAULT 0,
  currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freezit_items_name ON public.freezit_items(name);

-- ── freezit_sales ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.freezit_sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID REFERENCES public.freezit_items(id) ON DELETE SET NULL,
  item_name     TEXT NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(12, 2) NOT NULL,
  unit_cost     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount  NUMERIC(12, 2) NOT NULL,
  currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
  sale_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freezit_sales_sale_date  ON public.freezit_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_freezit_sales_item_id    ON public.freezit_sales(item_id);

-- ── freezit_restocks ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.freezit_restocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID REFERENCES public.freezit_items(id) ON DELETE SET NULL,
  item_name     TEXT NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cost    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
  restock_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freezit_restocks_restock_date ON public.freezit_restocks(restock_date);

-- ── freezit_breakages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.freezit_breakages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID REFERENCES public.freezit_items(id) ON DELETE SET NULL,
  item_name      TEXT NOT NULL,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  estimated_loss NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reason         TEXT,
  breakage_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freezit_breakages_breakage_date ON public.freezit_breakages(breakage_date);

-- ── wifi_token_sales ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wifi_token_sales (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_code  TEXT,
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency    VARCHAR(3) NOT NULL DEFAULT 'USD',
  sale_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wifi_token_sales_sale_date ON public.wifi_token_sales(sale_date);

-- ── wifi_monthly_costs ───────────────────────────────────────────────────────
-- Fixed monthly costs (e.g. internet package). Seeded with the $110/month fee.
CREATE TABLE IF NOT EXISTS public.wifi_monthly_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        INTEGER NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL DEFAULT 110.00,
  description TEXT NOT NULL DEFAULT 'Internet Package',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (month, year)
);

-- Seed current month so break-even is visible immediately
INSERT INTO public.wifi_monthly_costs (month, year, amount, description)
VALUES (
  EXTRACT(MONTH FROM NOW())::INTEGER,
  EXTRACT(YEAR  FROM NOW())::INTEGER,
  110.00,
  'Internet Package'
)
ON CONFLICT (month, year) DO NOTHING;
