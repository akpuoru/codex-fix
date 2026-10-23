CREATE TABLE public.flight_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duffel_order_id text NOT NULL UNIQUE,
  booking_reference text,
  booking_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'expired', 'ticketed', 'cancelled', 'needs_review')),
  itinerary jsonb NOT NULL DEFAULT '[]'::jsonb,
  passengers jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric(12, 2) NOT NULL,
  total_currency text NOT NULL,
  payment_required_by timestamptz,
  price_guarantee_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX flight_bookings_user_created_idx
  ON public.flight_bookings (user_id, created_at DESC);

ALTER TABLE public.flight_bookings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.flight_bookings TO authenticated;
GRANT ALL ON public.flight_bookings TO service_role;

CREATE POLICY "customers read their own flight bookings"
  ON public.flight_bookings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER flight_bookings_touch
  BEFORE UPDATE ON public.flight_bookings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
