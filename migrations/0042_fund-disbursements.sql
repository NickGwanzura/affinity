-- Fund disbursement cascade
-- Director → Manager (Max) → any role
-- Recipients log usage; all events land in audit_logs

CREATE TABLE IF NOT EXISTS fund_disbursements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency     TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','GBP','NAD','ZAR','BWP')),
  note         TEXT,
  disbursed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fund_usage_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency     TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','GBP','NAD','ZAR','BWP')),
  description  TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'General',
  source       TEXT NOT NULL DEFAULT 'General',
  usage_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_disbursements_to_user   ON fund_disbursements(to_user_id);
CREATE INDEX IF NOT EXISTS idx_fund_disbursements_from_user ON fund_disbursements(from_user_id);
CREATE INDEX IF NOT EXISTS idx_fund_disbursements_date      ON fund_disbursements(disbursed_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_usage_logs_user         ON fund_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_usage_logs_date         ON fund_usage_logs(usage_date DESC);
