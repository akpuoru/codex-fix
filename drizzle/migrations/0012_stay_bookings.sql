BEGIN;

CREATE OR REPLACE FUNCTION public.set_stay_bookings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.stay_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duffel_quote_id text NOT NULL UNIQUE,
  duffel_booking_id text UNIQUE,
  booking_reference text,
  status text NOT NULL DEFAULT 'booking_pending'
    CHECK (status IN ('booking_pending', 'confirmed', 'cancelled', 'needs_review', 'failed')),
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  rooms integer NOT NULL DEFAULT 1 CHECK (rooms BETWEEN 1 AND 8),
  accommodation jsonb NOT NULL DEFAULT '{}'::jsonb,
  guest_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_amount numeric(12, 2) NOT NULL,
  total_currency text NOT NULL CHECK (char_length(total_currency) = 3),
  deposit_amount numeric(12, 2),
  deposit_currency text CHECK (deposit_currency IS NULL OR char_length(deposit_currency) = 3),
  due_at_accommodation_amount numeric(12, 2),
  due_at_accommodation_currency text CHECK (due_at_accommodation_currency IS NULL OR char_length(due_at_accommodation_currency) = 3),
  confirmed_at timestamptz,
  booking_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  quote_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS stay_bookings_user_created_idx
  ON public.stay_bookings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stay_bookings_status_created_idx
  ON public.stay_bookings (status, created_at DESC);

ALTER TABLE public.stay_bookings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.stay_bookings TO authenticated;
GRANT ALL ON public.stay_bookings TO service_role;

DROP POLICY IF EXISTS "customers read their own stay bookings" ON public.stay_bookings;
CREATE POLICY "customers read their own stay bookings"
  ON public.stay_bookings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS stay_bookings_touch ON public.stay_bookings;
CREATE TRIGGER stay_bookings_touch
  BEFORE UPDATE ON public.stay_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_stay_bookings_updated_at();

COMMIT;
