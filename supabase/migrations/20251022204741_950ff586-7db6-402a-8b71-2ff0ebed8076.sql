-- Permite que usuários autenticados vejam perfis de administradores
CREATE POLICY "Users can view admin profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (role = 'admin');