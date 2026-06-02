-- Director Dashboard
-- Full audit trail of every fund movement involving the director.

CREATE TABLE IF NOT EXISTS public.director_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN ('Received', 'Disbursed')),
  amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency    VARCHAR(3) NOT NULL DEFAULT 'USD',
  party       TEXT NOT NULL,
  purpose     TEXT NOT NULL,
  description TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by TEXT NOT NULL,
  reference   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_director_tx_type ON public.director_transactions(type);
CREATE INDEX IF NOT EXISTS idx_director_tx_date ON public.director_transactions(date);

-- Add Director to user_profiles role constraint
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('Admin', 'Manager', 'Accountant', 'Driver', 'Sales', 'Director'));
