CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  found_client_id uuid;
BEGIN
  -- Papel vindo de metadata é IGNORADO: todo cadastro novo é 'client'.
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'client');

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT id INTO found_client_id FROM public.clients WHERE email = NEW.email LIMIT 1;
  IF found_client_id IS NULL THEN
    SELECT client_id INTO found_client_id FROM public.client_emails WHERE email = NEW.email LIMIT 1;
  END IF;
  IF found_client_id IS NOT NULL THEN
    UPDATE public.clients SET user_id = NEW.id WHERE id = found_client_id AND user_id IS NULL;
    INSERT INTO public.client_users (client_id, user_id) VALUES (found_client_id, NEW.id)
    ON CONFLICT (client_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.project_documents
  ADD COLUMN visibility text NOT NULL DEFAULT 'client'
  CHECK (visibility IN ('client','internal'));

DROP POLICY IF EXISTS "Clients can view documents of their projects" ON public.project_documents;
CREATE POLICY "Clients can view client-visible documents of their projects"
ON public.project_documents FOR SELECT TO authenticated
USING (
  visibility = 'client' AND EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.client_users cu ON cu.client_id = p.client_id
    WHERE p.id = project_documents.project_id AND cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
CREATE POLICY "Admins can view documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Linked clients can view client-visible documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents' AND EXISTS (
    SELECT 1 FROM public.project_documents d
    JOIN public.projects p ON p.id = d.project_id
    JOIN public.client_users cu ON cu.client_id = p.client_id
    WHERE d.file_url = storage.objects.name
      AND d.visibility = 'client'
      AND cu.user_id = auth.uid()
  )
);

COMMENT ON COLUMN public.projects.observation IS 'Visível ao cliente vinculado (lido pela API e exibido no portal).';