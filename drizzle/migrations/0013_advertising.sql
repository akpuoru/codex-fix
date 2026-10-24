BEGIN;

CREATE OR REPLACE FUNCTION public.set_advert_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.advert_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL CHECK (char_length(brand_name) BETWEEN 2 AND 120),
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 2 AND 120),
  email text NOT NULL CHECK (char_length(email) <= 255),
  brand_url text,
  headline text NOT NULL CHECK (char_length(headline) BETWEEN 4 AND 100),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 300),
  landing_url text NOT NULL,
  creative_url text,
  campaign_start date NOT NULL,
  campaign_end date NOT NULL,
  budget text NOT NULL CHECK (char_length(budget) BETWEEN 2 AND 100),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'approved', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (campaign_end >= campaign_start)
);

CREATE INDEX IF NOT EXISTS advert_requests_status_created_idx
  ON public.advert_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS advert_requests_campaign_dates_idx
  ON public.advert_requests (campaign_start, campaign_end)
  WHERE status = 'approved';

ALTER TABLE public.advert_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.advert_requests TO authenticated;
GRANT ALL ON public.advert_requests TO service_role;

DROP POLICY IF EXISTS "admins read advert requests" ON public.advert_requests;
CREATE POLICY "admins read advert requests"
  ON public.advert_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins update advert requests" ON public.advert_requests;
CREATE POLICY "admins update advert requests"
  ON public.advert_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS advert_requests_touch ON public.advert_requests;
CREATE TRIGGER advert_requests_touch
  BEFORE UPDATE ON public.advert_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_advert_requests_updated_at();

CREATE OR REPLACE FUNCTION public.submit_advert_request(
  _brand_name text,
  _contact_name text,
  _email text,
  _brand_url text,
  _headline text,
  _description text,
  _landing_url text,
  _creative_url text,
  _campaign_start date,
  _campaign_end date,
  _budget text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id uuid;
  normalized_email text := lower(trim(_email));
BEGIN
  IF char_length(trim(_brand_name)) NOT BETWEEN 2 AND 120
    OR char_length(trim(_contact_name)) NOT BETWEEN 2 AND 120
    OR char_length(normalized_email) > 255
    OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR char_length(trim(_headline)) NOT BETWEEN 4 AND 100
    OR char_length(trim(_description)) NOT BETWEEN 10 AND 300
    OR char_length(trim(_landing_url)) > 500
    OR trim(_landing_url) !~ '^https://'
    OR char_length(coalesce(trim(_brand_url), '')) > 500
    OR (nullif(trim(_brand_url), '') IS NOT NULL AND trim(_brand_url) !~ '^https://')
    OR char_length(coalesce(trim(_creative_url), '')) > 1000
    OR (nullif(trim(_creative_url), '') IS NOT NULL AND trim(_creative_url) !~ '^https://')
    OR char_length(trim(_budget)) NOT BETWEEN 2 AND 100
    OR _campaign_start < current_date
    OR _campaign_end < _campaign_start
    OR _campaign_end > _campaign_start + 366 THEN
    RAISE EXCEPTION 'Please check your campaign details.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(normalized_email));
  IF (SELECT count(*) FROM public.advert_requests
      WHERE email = normalized_email AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'Too many advertising requests. Please try again later.';
  END IF;

  INSERT INTO public.advert_requests (
    brand_name, contact_name, email, brand_url, headline, description,
    landing_url, creative_url, campaign_start, campaign_end, budget
  ) VALUES (
    trim(_brand_name), trim(_contact_name), normalized_email,
    nullif(trim(_brand_url), ''), trim(_headline), trim(_description),
    trim(_landing_url), nullif(trim(_creative_url), ''),
    _campaign_start, _campaign_end, trim(_budget)
  ) RETURNING id INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_advert_request(text, text, text, text, text, text, text, text, date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_advert_request(text, text, text, text, text, text, text, text, date, date, text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_active_advertisements()
RETURNS TABLE (
  id uuid,
  brand_name text,
  headline text,
  description text,
  landing_url text,
  creative_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.brand_name, a.headline, a.description, a.landing_url, a.creative_url
  FROM public.advert_requests AS a
  WHERE a.status = 'approved'
    AND current_date BETWEEN a.campaign_start AND a.campaign_end
  ORDER BY a.created_at DESC
  LIMIT 8;
$$;

REVOKE ALL ON FUNCTION public.get_active_advertisements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_advertisements() TO anon, authenticated;

COMMIT;
