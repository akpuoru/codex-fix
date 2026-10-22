CREATE TABLE public.support_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
 email text NOT NULL CHECK (char_length(email) <= 255),
 topic text NOT NULL CHECK (topic IN ('shipment','booking','freight','other')),
 tracking_number text,
 message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 3000),
 channel text NOT NULL DEFAULT 'contact' CHECK (channel IN ('contact','chat')),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','resolved')),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read support" ON public.support_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update support" ON public.support_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX support_requests_email_created ON public.support_requests (email, created_at);
CREATE OR REPLACE FUNCTION public.submit_support_request(_name text, _email text, _topic text, _tracking text, _message text, _channel text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_id uuid;
BEGIN
 IF char_length(trim(_name)) NOT BETWEEN 2 AND 100 OR char_length(trim(_message)) NOT BETWEEN 10 AND 3000 OR char_length(_email) > 255 OR _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR char_length(coalesce(_tracking,'')) > 40 THEN RAISE EXCEPTION 'Please check your contact details and message.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(lower(trim(_email))));
 IF (SELECT count(*) FROM public.support_requests WHERE email = lower(trim(_email)) AND created_at > now() - interval '1 hour') >= 5 THEN RAISE EXCEPTION 'Too many messages. Please try again later.'; END IF;
 INSERT INTO public.support_requests(name,email,topic,tracking_number,message,channel) VALUES(trim(_name),lower(trim(_email)),_topic,nullif(trim(_tracking),''),trim(_message),_channel) RETURNING id INTO request_id;
 RETURN request_id;
END; $$;
REVOKE ALL ON FUNCTION public.submit_support_request(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_support_request(text,text,text,text,text,text) TO anon, authenticated, service_role;