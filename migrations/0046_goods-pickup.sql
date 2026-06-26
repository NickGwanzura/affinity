-- Goods Pickup Requests
-- Tracks requests for goods pickup in the UK

CREATE TABLE IF NOT EXISTS goods_pickup_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number  TEXT UNIQUE NOT NULL,
  requested_by    UUID NOT NULL REFERENCES user_profiles(id),
  pickup_date     DATE NOT NULL,
  pickup_address  TEXT NOT NULL,
  contact_name    TEXT NOT NULL,
  contact_phone   TEXT,
  status          TEXT NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Pending','Confirmed','Collected','Cancelled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goods_pickup_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID NOT NULL REFERENCES goods_pickup_requests(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  weight_kg       NUMERIC(8,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goods_pickup_requests_status ON goods_pickup_requests(status);
CREATE INDEX IF NOT EXISTS idx_goods_pickup_requests_date ON goods_pickup_requests(pickup_date);
CREATE INDEX IF NOT EXISTS idx_goods_pickup_items_request_id ON goods_pickup_items(request_id);

-- Sequence for auto-generating request numbers
CREATE SEQUENCE IF NOT EXISTS goods_pickup_request_number_seq START 1;

-- Extend role check to include Goods Pickup
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('Admin','Manager','Accountant','Driver','Sales','Director','Car Hire','CEO','Goods Pickup'));
