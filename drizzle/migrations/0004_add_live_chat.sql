CREATE TABLE public.chat_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
 customer_name text NOT NULL DEFAULT 'Customer',
 customer_email text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own chat or admin" ON public.chat_threads FOR SELECT TO authenticated USING(user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages chats" ON public.chat_threads FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.chat_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL,
 is_staff boolean NOT NULL DEFAULT false,
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 3000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read allowed chat messages" ON public.chat_messages FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.chat_threads t WHERE t.id=thread_id AND (t.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE INDEX chat_messages_thread_time ON public.chat_messages(thread_id,created_at);
CREATE OR REPLACE FUNCTION public.start_live_chat() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tid uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to start a chat.'; END IF;
 INSERT INTO public.chat_threads(user_id,customer_name,customer_email) SELECT auth.uid(),coalesce(nullif(full_name,''),'Customer'),coalesce(email,'') FROM public.profiles WHERE id=auth.uid() ON CONFLICT(user_id) DO NOTHING;
 SELECT id INTO tid FROM public.chat_threads WHERE user_id=auth.uid();
 RETURN tid;
END; $$;
REVOKE ALL ON FUNCTION public.start_live_chat() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_live_chat() TO authenticated;
CREATE OR REPLACE FUNCTION public.send_live_message(_thread uuid,_body text,_staff boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.chat_threads; mid uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in.'; END IF;
 SELECT * INTO t FROM public.chat_threads WHERE id=_thread FOR UPDATE;
 IF t.id IS NULL OR (_staff AND NOT public.has_role(auth.uid(),'admin')) OR (NOT _staff AND t.user_id<>auth.uid()) THEN RAISE EXCEPTION 'Chat access denied.'; END IF;
 IF char_length(trim(_body)) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Message must be 1–3000 characters.'; END IF;
 IF (SELECT count(*) FROM public.chat_messages WHERE sender_id=auth.uid() AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'Please wait a moment before sending another message.'; END IF;
 INSERT INTO public.chat_messages(thread_id,sender_id,is_staff,body) VALUES(_thread,auth.uid(),_staff,trim(_body)) RETURNING id INTO mid;
 UPDATE public.chat_threads SET updated_at=now(),status='open' WHERE id=_thread;
 RETURN mid;
END; $$;
REVOKE ALL ON FUNCTION public.send_live_message(uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_live_message(uuid,text,boolean) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads,public.chat_messages;