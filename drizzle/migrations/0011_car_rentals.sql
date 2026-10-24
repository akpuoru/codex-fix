BEGIN;

CREATE OR REPLACE FUNCTION public.set_car_bookings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.car_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duffel_booking_id text NOT NULL UNIQUE,
  booking_reference text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'needs_review')),
  payment_type text NOT NULL DEFAULT 'postpaid' CHECK (payment_type = 'postpaid'),
  pickup_date date NOT NULL,
  pickup_time text NOT NULL,
  dropoff_date date NOT NULL,
  dropoff_time text NOT NULL,
  pickup_location jsonb NOT NULL DEFAULT '{}'::jsonb,
  dropoff_location jsonb NOT NULL DEFAULT '{}'::jsonb,
  car jsonb NOT NULL DEFAULT '{}'::jsonb,
  supplier jsonb NOT NULL DEFAULT '{}'::jsonb,
  driver jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  charges jsonb NOT NULL DEFAULT '[]'::jsonb,
  privacy_policies jsonb NOT NULL DEFAULT '[]'::jsonb,
  mileage jsonb,
  total_amount numeric(14, 4) NOT NULL,
  total_currency text NOT NULL,
  confirmed_at timestamptz,
  booking_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS car_bookings_user_created_idx
  ON public.car_bookings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS car_bookings_status_created_idx
  ON public.car_bookings (status, created_at DESC);

ALTER TABLE public.car_bookings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.car_bookings TO authenticated;
GRANT ALL ON public.car_bookings TO service_role;

DROP POLICY IF EXISTS "customers read their own car bookings" ON public.car_bookings;
CREATE POLICY "customers read their own car bookings"
  ON public.car_bookings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS car_bookings_touch ON public.car_bookings;
CREATE TRIGGER car_bookings_touch
  BEFORE UPDATE ON public.car_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_car_bookings_updated_at();

COMMIT;
