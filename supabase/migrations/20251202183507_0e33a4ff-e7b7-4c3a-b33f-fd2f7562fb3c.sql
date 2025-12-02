-- Criar tabela para emails adicionais de contato do cliente
CREATE TABLE public.client_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id, email)
);

-- Habilitar RLS
ALTER TABLE public.client_emails ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage client_emails"
ON public.client_emails
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Atualizar função handle_new_user para vincular por emails adicionais também
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  found_client_id uuid;
BEGIN
  -- Insere o perfil do usuário
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client')
  );
  
  -- Insere a role do usuário
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client')
  );
  
  -- Se for um cliente, tenta vincular
  IF COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client') = 'client' THEN
    -- Primeiro tenta pelo email principal do cliente
    SELECT id INTO found_client_id
    FROM public.clients
    WHERE email = NEW.email
    LIMIT 1;
    
    -- Se não encontrou, tenta pelos emails adicionais
    IF found_client_id IS NULL THEN
      SELECT client_id INTO found_client_id
      FROM public.client_emails
      WHERE email = NEW.email
      LIMIT 1;
    END IF;
    
    -- Se encontrou um cliente, vincula o usuário
    IF found_client_id IS NOT NULL THEN
      -- Atualiza o user_id no cliente (mantém compatibilidade)
      UPDATE public.clients
      SET user_id = NEW.id
      WHERE id = found_client_id
        AND user_id IS NULL;
      
      -- Insere na tabela de vinculação
      INSERT INTO public.client_users (client_id, user_id)
      VALUES (found_client_id, NEW.id)
      ON CONFLICT (client_id, user_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;