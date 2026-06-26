-- Goods Pickup: shareable link support
-- Adds client-facing fields for external pickup requests

ALTER TABLE goods_pickup_requests
  ADD COLUMN IF NOT EXISTS client_email   TEXT,
  ADD COLUMN IF NOT EXISTS share_token    TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_goods_pickup_requests_share_token
  ON goods_pickup_requests(share_token);
