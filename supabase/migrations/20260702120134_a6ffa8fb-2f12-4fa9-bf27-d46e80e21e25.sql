
CREATE OR REPLACE FUNCTION public.admin_lookup_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé au super administrateur';
  END IF;
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.admin_lookup_user_id_by_email(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_lookup_user_id_by_email(text) TO authenticated;
