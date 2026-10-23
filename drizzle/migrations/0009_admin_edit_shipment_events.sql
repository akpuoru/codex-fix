-- Allow trusted admins to correct a tracking event's status, location, note,
-- and timestamp. Customers retain read-only access to shipment history.
BEGIN;

GRANT UPDATE ON TABLE public.shipment_events TO authenticated;

DROP POLICY IF EXISTS "admins update shipment events" ON public.shipment_events;
CREATE POLICY "admins update shipment events"
  ON public.shipment_events
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMIT;
