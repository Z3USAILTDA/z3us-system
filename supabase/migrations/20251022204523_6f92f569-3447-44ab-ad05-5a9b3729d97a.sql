-- Adiciona coluna project_manager_id à tabela projects
ALTER TABLE public.projects 
ADD COLUMN project_manager_id uuid REFERENCES public.profiles(id);