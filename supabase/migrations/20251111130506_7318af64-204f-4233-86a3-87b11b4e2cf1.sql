-- Remover coluna demanda da tabela profiles
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS demanda;

-- Adicionar coluna demanda na tabela projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS demanda TEXT;