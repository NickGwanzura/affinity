-- Trip planner migration
-- Adds a dedicated trips domain with driver assignment, route planning, ETAs,
-- and calendar-friendly timestamps for the operations workspace.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Planned',
  assigned_driver_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assigned_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  route_origin TEXT NOT NULL,
  route_destination TEXT NOT NULL,
  route_waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  departure_date TIMESTAMPTZ NOT NULL,
  eta_date TIMESTAMPTZ NOT NULL,
  actual_departure_at TIMESTAMPTZ,
  actual_arrival_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trips_status_check CHECK (status IN ('Planned', 'Assigned', 'In Transit', 'Delayed', 'Completed', 'Cancelled')),
  CONSTRAINT trips_eta_after_departure_check CHECK (eta_date >= departure_date)
);

CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON public.trips (assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON public.trips (assigned_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_departure_date ON public.trips (departure_date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips (status);

CREATE SEQUENCE IF NOT EXISTS public.trip_number_seq START WITH 1 INCREMENT BY 1;

DO $$
DECLARE
  trip_max BIGINT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(trip_number, '^TRP-\d{4}-(\d+)$'))[1]::BIGINT), 0)
  INTO trip_max
  FROM public.trips;

  IF trip_max > 0 THEN
    PERFORM setval('public.trip_number_seq', trip_max, true);
  ELSE
    PERFORM setval('public.trip_number_seq', 1, false);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_trips_updated_at ON public.trips;
CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
