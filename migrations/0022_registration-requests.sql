CREATE TABLE IF NOT EXISTS registration_requests (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  requested_at timestamptz NOT NULL DEFAULT NOW(),
  reviewed_at timestamptz NULL,
  reviewed_by uuid NULL REFERENCES user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_registration_requests_requested_at
ON registration_requests (requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_requests_pending_email
ON registration_requests (LOWER(email))
WHERE status = 'Pending';
