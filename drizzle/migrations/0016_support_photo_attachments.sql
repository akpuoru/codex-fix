-- Private image attachments for numeric-reference support conversations.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachments text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.support_reference_exists(_reference text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_requests r
    WHERE _reference ~ '^[0-9]{16}$'
      AND r.public_reference = _reference
  )
$$;
REVOKE ALL ON FUNCTION private.support_reference_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.support_reference_exists(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.support_attachment_is_unattached(_reference text, _path text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT private.support_reference_exists(_reference)
    AND _path ~ (
      '^' || _reference || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.support_requests r
      JOIN public.support_messages m ON m.request_id = r.id
      WHERE r.public_reference = _reference
        AND _path = ANY(m.attachments)
    )
$$;
REVOKE ALL ON FUNCTION private.support_attachment_is_unattached(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.support_attachment_is_unattached(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.support_attachment_is_attached(_reference text, _path text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT private.support_reference_exists(_reference)
    AND _path ~ (
      '^' || _reference || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
    )
    AND EXISTS (
      SELECT 1
      FROM public.support_requests r
      JOIN public.support_messages m ON m.request_id = r.id
      WHERE r.public_reference = _reference
        AND _path = ANY(m.attachments)
    )
$$;
REVOKE ALL ON FUNCTION private.support_attachment_is_attached(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.support_attachment_is_attached(text, text) TO anon, authenticated;

GRANT SELECT, INSERT, DELETE ON storage.objects TO anon, authenticated;

DROP POLICY IF EXISTS "support attachments read by case reference" ON storage.objects;
CREATE POLICY "support attachments read by case reference"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'support-attachments'
    AND private.support_attachment_is_attached((storage.foldername(name))[1], name)
  );

DROP POLICY IF EXISTS "support attachments upload by case reference" ON storage.objects;
CREATE POLICY "support attachments upload by case reference"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND private.support_reference_exists((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "support attachments remove by case reference" ON storage.objects;
CREATE POLICY "support attachments remove by case reference"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (
    bucket_id = 'support-attachments'
    AND private.support_attachment_is_unattached((storage.foldername(name))[1], name)
  );

DROP FUNCTION IF EXISTS public.get_support_conversation(text);
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
  message_created_at timestamptz,
  attachments text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.public_reference, r.name, r.topic, r.tracking_number, r.status,
         r.created_at, m.sender_type, m.message, m.created_at,
         coalesce(m.attachments, ARRAY[]::text[])
  FROM public.support_requests r
  LEFT JOIN public.support_messages m ON m.request_id = r.id
  WHERE r.public_reference = _reference
  ORDER BY m.created_at ASC NULLS FIRST, m.id ASC
$$;

DROP FUNCTION IF EXISTS public.reply_support_conversation(text, text);
CREATE FUNCTION public.reply_support_conversation(
  _reference text,
  _message text,
  _attachments text[] DEFAULT ARRAY[]::text[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_request_id uuid;
  v_message_id uuid;
  v_attachments text[] := coalesce(_attachments, ARRAY[]::text[]);
BEGIN
  IF _reference !~ '^[0-9]{16}$' THEN
    RAISE EXCEPTION 'Support reference not found.';
  END IF;
  IF char_length(trim(_message)) NOT BETWEEN 1 AND 3000 THEN
    RAISE EXCEPTION 'Please enter a message of 1 to 3000 characters.';
  END IF;
  IF cardinality(v_attachments) > 3 OR EXISTS (
    SELECT 1
    FROM unnest(v_attachments) AS attachment(path)
    WHERE attachment.path !~ (
      '^' || _reference || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
    )
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects object
      WHERE object.bucket_id = 'support-attachments'
        AND object.name = attachment.path
    )
  ) THEN
    RAISE EXCEPTION 'One or more photo attachments are invalid.';
  END IF;

  SELECT id INTO v_request_id
  FROM public.support_requests
  WHERE public_reference = _reference
  FOR UPDATE;
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Support reference not found.';
  END IF;
  IF (
    SELECT count(*) FROM public.support_messages
    WHERE request_id = v_request_id AND sender_type = 'customer'
      AND created_at > now() - interval '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION 'Too many replies. Please try again later.';
  END IF;

  INSERT INTO public.support_messages (request_id, sender_type, message, attachments)
  VALUES (v_request_id, 'customer', trim(_message), v_attachments)
  RETURNING id INTO v_message_id;
  UPDATE public.support_requests SET status = 'new' WHERE id = v_request_id;
  RETURN v_message_id;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_reply_support_conversation(uuid, text);
CREATE FUNCTION public.admin_reply_support_conversation(
  _request uuid,
  _message text,
  _attachments text[] DEFAULT ARRAY[]::text[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_reference text;
  v_message_id uuid;
  v_attachments text[] := coalesce(_attachments, ARRAY[]::text[]);
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;
  IF char_length(trim(_message)) NOT BETWEEN 1 AND 3000 THEN
    RAISE EXCEPTION 'Please enter a message of 1 to 3000 characters.';
  END IF;

  SELECT public_reference INTO v_reference
  FROM public.support_requests WHERE id = _request;
  IF v_reference IS NULL THEN
    RAISE EXCEPTION 'Support request not found.';
  END IF;
  IF cardinality(v_attachments) > 3 OR EXISTS (
    SELECT 1
    FROM unnest(v_attachments) AS attachment(path)
    WHERE attachment.path !~ (
      '^' || v_reference || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
    )
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects object
      WHERE object.bucket_id = 'support-attachments'
        AND object.name = attachment.path
    )
  ) THEN
    RAISE EXCEPTION 'One or more photo attachments are invalid.';
  END IF;

  INSERT INTO public.support_messages (request_id, sender_type, message, attachments)
  VALUES (_request, 'staff', trim(_message), v_attachments)
  RETURNING id INTO v_message_id;
  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_support_conversation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reply_support_conversation(text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reply_support_conversation(uuid, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_support_conversation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reply_support_conversation(text, text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reply_support_conversation(uuid, text, text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
