ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS transfer_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS transfer_method text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS transfer_reference text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS transfer_submitted_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_transfer_details()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT CASE WHEN auth.uid() IS NULL THEN '{}'::jsonb ELSE (SELECT transfer_details FROM public.site_settings WHERE id=1) END $$;
REVOKE EXECUTE ON FUNCTION public.get_transfer_details() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_transfer_details() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_transfer(_shipment uuid, _method text, _reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.shipments;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in.'; END IF;
 IF _method NOT IN ('bank','btc','usdt') THEN RAISE EXCEPTION 'Choose bank, Bitcoin or USDT.'; END IF;
 IF char_length(trim(coalesce(_reference,''))) NOT BETWEEN 3 AND 300 THEN RAISE EXCEPTION 'Enter your transfer reference or transaction hash.'; END IF;
 SELECT * INTO s FROM public.shipments WHERE id=_shipment FOR UPDATE;
 IF s.id IS NULL OR s.user_id <> auth.uid() THEN RAISE EXCEPTION 'Shipment not found.'; END IF;
 IF s.paid_at IS NOT NULL THEN RAISE EXCEPTION 'This shipment is already paid.'; END IF;
 UPDATE public.shipments SET transfer_method=_method, transfer_reference=trim(_reference), transfer_submitted_at=now() WHERE id=_shipment;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_transfer(uuid,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_transfer(uuid,text,text) TO authenticated;