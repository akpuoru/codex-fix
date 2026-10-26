-- Add private, reference-based conversations for public support requests.
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'staff')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 3000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_messages_request_created_idx
  ON public.support_messages (request_id, created_at, id);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
CREATE POLICY "admins read support messages"
  ON public.support_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Preserve existing enquiries in the conversation history.
INSERT INTO public.support_messages (request_id, sender_type, message, created_at)
SELECT r.id, 'customer', r.message, r.created_at
FROM public.support_requests r
WHERE NOT EXISTS (
  SELECT 1 FROM public.support_messages m WHERE m.request_id = r.id
);

-- New public enquiries get their first customer message in the same transaction.
CREATE OR REPLACE FUNCTION public.submit_support_request(
  _name text, _email text, _topic text, _tracking text, _message text, _channel text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_request_id uuid;
BEGIN
  IF char_length(trim(_name)) NOT BETWEEN 2 AND 100
     OR char_length(trim(_message)) NOT BETWEEN 10 AND 3000
     OR char_length(_email) > 255
     OR _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR char_length(coalesce(_tracking, '')) > 40
     OR _topic NOT IN ('shipment', 'booking', 'freight', 'other')
     OR _channel NOT IN ('contact', 'chat') THEN
    RAISE EXCEPTION 'Please check your contact details and message.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(lower(trim(_email))));
  IF (SELECT count(*) FROM public.support_requests
      WHERE email = lower(trim(_email)) AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Too many messages. Please try again later.';
  END IF;

  INSERT INTO public.support_requests (name, email, topic, tracking_number, message, channel)
  VALUES (trim(_name), lower(trim(_email)), _topic, nullif(trim(_tracking), ''), trim(_message), _channel)
  RETURNING id INTO v_request_id;

  INSERT INTO public.support_messages (request_id, sender_type, message)
  VALUES (v_request_id, 'customer', trim(_message));

  RETURN v_request_id;
END;
$$;

-- The UUID is a private case reference. Possessing it grants access to that
-- public conversation; these RPCs intentionally return no email or other PII.
CREATE OR REPLACE FUNCTION public.get_support_conversation(_request uuid)
RETURNS TABLE (
  request_id uuid,
  name text,
  topic text,
  tracking_number text,
  status text,
  request_created_at timestamptz,
  sender_type text,
  message text,
  message_created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.id, r.name, r.topic, r.tracking_number, r.status, r.created_at,
         m.sender_type, m.message, m.created_at
  FROM public.support_requests r
  LEFT JOIN public.support_messages m ON m.request_id = r.id
  WHERE r.id = _request
  ORDER BY m.created_at ASC NULLS FIRST, m.id ASC
$$;

CREATE OR REPLACE FUNCTION public.reply_support_conversation(_request uuid, _message text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  message_id uuid;
BEGIN
  IF char_length(trim(_message)) NOT BETWEEN 1 AND 3000 THEN
    RAISE EXCEPTION 'Please enter a message of 1 to 3000 characters.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_request::text));
  IF NOT EXISTS (SELECT 1 FROM public.support_requests WHERE id = _request) THEN
    RAISE EXCEPTION 'Support reference not found.';
  END IF;
  IF (SELECT count(*) FROM public.support_messages
      WHERE request_id = _request AND sender_type = 'customer'
        AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'Too many replies. Please try again later.';
  END IF;

  INSERT INTO public.support_messages (request_id, sender_type, message)
  VALUES (_request, 'customer', trim(_message))
  RETURNING id INTO message_id;
  UPDATE public.support_requests SET status = 'new' WHERE id = _request;
  RETURN message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reply_support_conversation(_request uuid, _message text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  message_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;
  IF char_length(trim(_message)) NOT BETWEEN 1 AND 3000 THEN
    RAISE EXCEPTION 'Please enter a message of 1 to 3000 characters.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.support_requests WHERE id = _request) THEN
    RAISE EXCEPTION 'Support request not found.';
  END IF;

  INSERT INTO public.support_messages (request_id, sender_type, message)
  VALUES (_request, 'staff', trim(_message))
  RETURNING id INTO message_id;
  RETURN message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_support_conversation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reply_support_conversation(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reply_support_conversation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_support_conversation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reply_support_conversation(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reply_support_conversation(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
