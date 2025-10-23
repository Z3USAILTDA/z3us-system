
-- Atualiza a função handle_new_user para vincular automaticamente clientes existentes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Se for um cliente, tenta vincular a um registro existente na tabela clients
  IF COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client') = 'client' THEN
    UPDATE public.clients
    SET user_id = NEW.id
    WHERE email = NEW.email
      AND user_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;
