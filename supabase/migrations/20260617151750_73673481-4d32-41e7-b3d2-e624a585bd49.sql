CREATE OR REPLACE FUNCTION public.update_client_observation(_project_id uuid, _observation text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id uuid;
  _allowed boolean;
BEGIN
  SELECT client_id INTO _client_id FROM public.projects WHERE id = _project_id;
  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.client_users
    WHERE client_id = _client_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = _client_id AND user_id = auth.uid()
  ) INTO _allowed;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.projects
  SET client_observation = _observation,
      updated_at = now()
  WHERE id = _project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_client_observation(uuid, text) TO authenticated;