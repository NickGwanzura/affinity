-- 0035_idempotency-keys.sql
-- Cache successful responses for money-mutating POST handlers so that a
-- client retry with the same Idempotency-Key returns the original payload
-- instead of double-charging or double-creating records.
--
-- Header is optional. Clients without it get original behavior.

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  response_body JSONB NOT NULL,
  response_status INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON public.idempotency_keys(created_at DESC);
