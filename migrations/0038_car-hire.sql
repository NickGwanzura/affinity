-- Car Hiring Module
-- Tracks vehicle hirings, associated expenses, and monthly P&L.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── car_hire_vehicles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.car_hire_vehicles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make_model    TEXT NOT NULL,
  registration  TEXT NOT NULL,
  year          INTEGER,
  color         TEXT,
  daily_rate    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
  status        TEXT NOT NULL DEFAULT 'Available'
    CHECK (status IN ('Available', 'Hired', 'Maintenance', 'Inactive')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── car_hire_bookings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.car_hire_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID REFERENCES public.car_hire_vehicles(id) ON DELETE SET NULL,
  hirer_name      TEXT NOT NULL,
  hirer_phone     TEXT,
  hirer_id_number TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  daily_rate      NUMERIC(10, 2) NOT NULL,
  total_amount    NUMERIC(10, 2) NOT NULL,
  amount_paid     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_method  TEXT NOT NULL DEFAULT 'Cash',
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'Confirmed'
    CHECK (status IN ('Confirmed', 'Active', 'Completed', 'Cancelled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_car_hire_bookings_vehicle_id ON public.car_hire_bookings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_car_hire_bookings_start_date ON public.car_hire_bookings(start_date);
CREATE INDEX IF NOT EXISTS idx_car_hire_bookings_status     ON public.car_hire_bookings(status);

-- ── car_hire_expenses ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.car_hire_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID REFERENCES public.car_hire_vehicles(id) ON DELETE SET NULL,
  category     TEXT NOT NULL
    CHECK (category IN ('Fuel','Insurance','Maintenance','Tyres','Licensing','Cleaning','Toll','Other')),
  amount       NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  currency     VARCHAR(3) NOT NULL DEFAULT 'USD',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_car_hire_expenses_vehicle_id   ON public.car_hire_expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_car_hire_expenses_expense_date ON public.car_hire_expenses(expense_date);

-- ── Seed: Nissan Note ─────────────────────────────────────────────────────────
INSERT INTO public.car_hire_vehicles (make_model, registration, year, color, daily_rate, currency)
VALUES ('Nissan Note', 'N/A', 2020, 'White', 50.00, 'USD')
ON CONFLICT DO NOTHING;

-- ── Add Car Hire role to user_profiles constraint ────────────────────────────
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('Admin','Manager','Accountant','Driver','Sales','Director','Car Hire'));
