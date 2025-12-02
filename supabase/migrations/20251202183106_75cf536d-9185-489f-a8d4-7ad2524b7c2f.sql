-- Criar tabela de relacionamento entre clientes e usuários
CREATE TABLE public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);

-- Habilitar RLS
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para client_users
CREATE POLICY "Admins can manage client_users"
ON public.client_users
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own client associations"
ON public.client_users
FOR SELECT
USING (auth.uid() = user_id);

-- Migrar dados existentes: copiar user_id de clients para client_users
INSERT INTO public.client_users (client_id, user_id)
SELECT id, user_id FROM public.clients WHERE user_id IS NOT NULL;

-- Atualizar política de clients para considerar a nova tabela
DROP POLICY IF EXISTS "Clients can view own data" ON public.clients;
CREATE POLICY "Clients can view own data"
ON public.clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.client_users
    WHERE client_users.client_id = clients.id
    AND client_users.user_id = auth.uid()
  )
);

-- Atualizar política de projects para considerar múltiplos usuários
DROP POLICY IF EXISTS "Clients can view own projects" ON public.projects;
CREATE POLICY "Clients can view own projects"
ON public.projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.client_users
    WHERE client_users.client_id = projects.client_id
    AND client_users.user_id = auth.uid()
  )
);

-- Atualizar política de project_updates
DROP POLICY IF EXISTS "Clients can view updates for own projects" ON public.project_updates;
CREATE POLICY "Clients can view updates for own projects"
ON public.project_updates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    JOIN client_users ON client_users.client_id = projects.client_id
    WHERE projects.id = project_updates.project_id
    AND client_users.user_id = auth.uid()
  )
);