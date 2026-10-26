-- Allow an admin to remove individual messages or an entire guest support case.
-- Empty the duplicated request message when its original conversation message is deleted.
ALTER TABLE public.support_requests
  DROP CONSTRAINT IF EXISTS support_requests_message_check;

ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_message_check
  CHECK (char_length(message) BETWEEN 0 AND 3000);

CREATE OR REPLACE FUNCTION public.admin_delete_support_message(_message uuid)
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_message public.support_messages%ROWTYPE;
  v_request_id uuid;
  v_request_created_at timestamptz;
  v_request_message text;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  SELECT request_id INTO v_request_id
  FROM public.support_messages
  WHERE id = _message;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support message not found.';
  END IF;

  SELECT created_at, message
  INTO v_request_created_at, v_request_message
  FROM public.support_requests
  WHERE id = v_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support conversation not found.';
  END IF;

  SELECT * INTO v_message
  FROM public.support_messages
  WHERE id = _message AND request_id = v_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support message not found.';
  END IF;

  IF v_message.sender_type = 'customer'
     AND v_message.created_at = v_request_created_at
     AND v_message.message = v_request_message THEN
    UPDATE public.support_requests
    SET message = ''
    WHERE id = v_request_id;
  END IF;

  DELETE FROM public.support_messages WHERE id = _message;
  RETURN coalesce(v_message.attachments, ARRAY[]::text[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_support_conversation(_request uuid)
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_attachments text[];
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  PERFORM 1 FROM public.support_requests WHERE id = _request FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support conversation not found.';
  END IF;

  SELECT coalesce(array_agg(DISTINCT attachment.path), ARRAY[]::text[])
  INTO v_attachments
  FROM public.support_messages AS message
  CROSS JOIN LATERAL unnest(coalesce(message.attachments, ARRAY[]::text[])) AS attachment(path)
  WHERE message.request_id = _request;

  DELETE FROM public.support_requests WHERE id = _request;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support conversation not found.';
  END IF;

  RETURN coalesce(v_attachments, ARRAY[]::text[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_live_chat_message(_message uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  SELECT thread_id INTO v_thread_id
  FROM public.chat_messages
  WHERE id = _message
  FOR UPDATE;
  IF v_thread_id IS NULL THEN
    RAISE EXCEPTION 'Chat message not found.';
  END IF;

  DELETE FROM public.chat_messages WHERE id = _message;
  UPDATE public.chat_threads SET updated_at = now() WHERE id = v_thread_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_support_message(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_support_conversation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_live_chat_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_support_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_support_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_live_chat_message(uuid) TO authenticated;

-- Admin cleanup must still work after a conversation row is removed.
DROP POLICY IF EXISTS "admins remove support attachments" ON storage.objects;
CREATE POLICY "admins remove support attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

NOTIFY pgrst, 'reload schema';
