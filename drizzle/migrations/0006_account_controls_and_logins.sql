CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip text, user_agent text, device text, browser text, os text,
  city text, region text, country text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_events_user_idx ON public.login_events(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read logins" ON public.login_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own login" ON public.login_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.account_status (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','restricted','banned')),
  reason text,
  force_logout_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.account_status TO authenticated;
GRANT ALL ON public.account_status TO service_role;
ALTER TABLE public.account_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own status or admin" ON public.account_status FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins insert status" ON public.account_status FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update status" ON public.account_status FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.is_account_blocked(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.account_status WHERE user_id = _user_id AND status IN ('restricted','banned'))
$$;

CREATE OR REPLACE FUNCTION public.start_live_chat()
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE tid uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to start a chat.'; END IF;
 IF public.is_account_blocked(auth.uid()) THEN RAISE EXCEPTION 'Your account is restricted. Please use the contact form.'; END IF;
 INSERT INTO public.chat_threads(user_id,customer_name,customer_email) SELECT auth.uid(),coalesce(nullif(full_name,''),'Customer'),coalesce(email,'') FROM public.profiles WHERE id=auth.uid() ON CONFLICT(user_id) DO NOTHING;
 SELECT id INTO tid FROM public.chat_threads WHERE user_id=auth.uid();
 RETURN tid;
END; $function$;

DROP POLICY "own shipments insert" ON public.shipments;
CREATE POLICY "own shipments insert" ON public.shipments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT public.is_account_blocked(auth.uid()));