-- Cash handover system: Robson logs collections, Max confirms receipt

CREATE TABLE IF NOT EXISTS cash_handovers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collected_by    UUID NOT NULL REFERENCES user_profiles(id),
  received_by     UUID REFERENCES user_profiles(id),
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'USD',
  description     TEXT,
  collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Pending', 'Confirmed')),
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_handovers_collected_by ON cash_handovers (collected_by);
CREATE INDEX IF NOT EXISTS idx_cash_handovers_status       ON cash_handovers (status);
