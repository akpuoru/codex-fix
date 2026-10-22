CREATE TABLE public.tracking_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  ip text, user_agent text, device text, browser text, os text,
  city text, region text, country text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracking_lookups_shipment_idx ON public.tracking_lookups(shipment_id, created_at DESC);
GRANT SELECT ON public.tracking_lookups TO authenticated;
GRANT ALL ON public.tracking_lookups TO service_role;
ALTER TABLE public.tracking_lookups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read lookups" ON public.tracking_lookups FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.shipments ADD COLUMN customs_instructions text;

CREATE OR REPLACE FUNCTION public.track_shipment_notice(_tracking text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.customs_instructions FROM public.shipments s WHERE upper(s.tracking_number)=upper(trim(_tracking)) LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.track_shipment_notice(text) TO anon, authenticated;