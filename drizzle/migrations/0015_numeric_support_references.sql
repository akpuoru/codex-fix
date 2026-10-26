-- Replace UUID-based public support references with private numeric case codes.
ALTER TABLE public.support_requests
  ADD COLUMN public_reference text;

CREATE UNIQUE INDEX support_requests_public_reference_partial_idx
  ON public.support_requests (public_reference)
  WHERE public_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.next_support_reference()
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_reference text;
BEGIN
  LOOP
    -- Keep this as text: leading zeroes are part of the reference.
    v_reference := lpad(floor(random() * 10000000000000000)::bigint::text, 16, '0');
    PERFORM pg_advisory_xact_lock(hashtext(v_reference));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.support_requests WHERE public_reference = v_reference
    );
  END LOOP;
  RETURN v_reference;
END;
$$;
REVOKE ALL ON FUNCTION public.next_support_reference() FROM PUBLIC;

-- Assign a unique numeric case code to every earlier enquiry.
DO $$
DECLARE
  old_request record;
BEGIN
  FOR old_request IN
    SELECT id FROM public.support_requests WHERE public_reference IS NULL
  LOOP
    UPDATE public.support_requests
    SET public_reference = public.next_support_reference()
    WHERE id = old_request.id;
  END LOOP;
END;
$$;

ALTER TABLE public.support_requests
  ALTER COLUMN public_reference SET NOT NULL;
DROP INDEX public.support_requests_public_reference_partial_idx;
ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_public_reference_key UNIQUE (public_reference);

-- Remove the earlier UUID-reference RPC signatures so PostgREST has one
-- unambiguous function for each public conversation action.
DROP FUNCTION IF EXISTS public.get_support_conversation(uuid);
DROP FUNCTION IF EXISTS public.reply_support_conversation(uuid, text);
DROP FUNCTION IF EXISTS public.submit_support_request(text, text, text, text, text, text);

CREATE FUNCTION public.submit_support_request(
  _name text, _email text, _topic text, _tracking text, _message text, _channel text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_request_id uuid;
  v_reference text;
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
  IF (
    SELECT count(*)
    FROM public.support_requests
    WHERE email = lower(trim(_email))
      AND created_at > now() - interval '1 hour'
  ) >= 5 THEN
    RAISE EXCEPTION 'Too many messages. Please try again later.';
  END IF;

  v_reference := public.next_support_reference();
  INSERT INTO public.support_requests (
    public_reference, name, email, topic, tracking_number, message, channel
  )
  VALUES (
    v_reference, trim(_name), lower(trim(_email)), _topic,
    nullif(trim(_tracking), ''), trim(_message), _channel
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.support_messages (request_id, sender_type, message)
  VALUES (v_request_id, 'customer', trim(_message));

  RETURN v_reference;
END;
$$;

CREATE FUNCTION public.get_support_conversation(_reference text)
RETURNS TABLE (
  reference text,
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
  SELECT r.public_reference, r.name, r.topic, r.tracking_number, r.status,
         r.created_at, m.sender_type, m.message, m.created_at
  FROM public.support_requests r
  LEFT JOIN public.support_messages m ON m.request_id = r.id
  WHERE r.public_reference = _reference
  ORDER BY m.created_at ASC NULLS FIRST, m.id ASC
$$;

CREATE FUNCTION public.reply_support_conversation(_reference text, _message text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_request_id uuid;
  v_message_id uuid;
BEGIN
  IF _reference !~ '^[0-9]{16}$' THEN
    RAISE EXCEPTION 'Support reference not found.';
  END IF;
  IF char_length(trim(_message)) NOT BETWEEN 1 AND 3000 THEN
    RAISE EXCEPTION 'Please enter a message of 1 to 3000 characters.';
  END IF;

  SELECT id INTO v_request_id
  FROM public.support_requests
  WHERE public_reference = _reference
  FOR UPDATE;
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Support reference not found.';
  END IF;

  IF (
    SELECT count(*)
    FROM public.support_messages
    WHERE request_id = v_request_id
      AND sender_type = 'customer'
      AND created_at > now() - interval '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION 'Too many replies. Please try again later.';
  END IF;

  INSERT INTO public.support_messages (request_id, sender_type, message)
  VALUES (v_request_id, 'customer', trim(_message))
  RETURNING id INTO v_message_id;

  UPDATE public.support_requests SET status = 'new' WHERE id = v_request_id;
  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_support_conversation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reply_support_conversation(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_support_request(text, text, text, text, text, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_support_conversation(text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reply_support_conversation(text, text)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
