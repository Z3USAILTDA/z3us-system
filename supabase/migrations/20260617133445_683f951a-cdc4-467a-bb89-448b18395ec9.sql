CREATE OR REPLACE FUNCTION public.email_has_account(_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(_email))
$$;

REVOKE ALL ON FUNCTION public.email_has_account(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_has_account(text) TO authenticated;