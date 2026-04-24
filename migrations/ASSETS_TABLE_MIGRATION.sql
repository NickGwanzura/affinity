-- Assets + Asset Requests DDL
-- Extracted from api/assets.ts (was being run on every request before the
-- backend-hardening pass). Run this once per environment before deploying
-- the leaner api/assets.ts handler.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── assets ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  serial_number TEXT,
  status TEXT DEFAULT 'Available'
    CHECK (status IN ('Available', 'Borrowed', 'Under Maintenance', 'Retired')),
  location TEXT,
  purchase_date DATE,
  purchase_value NUMERIC(12, 2),
  condition TEXT DEFAULT 'Good',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_status   ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_name     ON public.assets(name);

-- ── asset_requests ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.asset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  requester_email TEXT,
  requester_department TEXT,
  request_date TIMESTAMPTZ DEFAULT NOW(),
  requested_take_date DATE,
  approved_by TEXT,
  approval_date TIMESTAMPTZ,
  actual_take_date TIMESTAMPTZ,
  expected_return_date DATE,
  actual_return_date TIMESTAMPTZ,
  status TEXT DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Taken', 'Returned', 'Overdue')),
  rejection_reason TEXT,
  purpose TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_requests_asset_id          ON public.asset_requests(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_requests_status            ON public.asset_requests(status);
CREATE INDEX IF NOT EXISTS idx_asset_requests_requested_by      ON public.asset_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_asset_requests_actual_take_date  ON public.asset_requests(actual_take_date);
CREATE INDEX IF NOT EXISTS idx_asset_requests_actual_return_date ON public.asset_requests(actual_return_date);
