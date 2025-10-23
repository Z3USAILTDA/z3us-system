-- Adiciona coluna de observação para o cliente na tabela projects
ALTER TABLE public.projects
ADD COLUMN client_observation text;