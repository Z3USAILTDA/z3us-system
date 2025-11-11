-- Adicionar coluna demanda na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS demanda TEXT;