-- Remove budget column and add new fields to projects table
ALTER TABLE public.projects 
DROP COLUMN IF EXISTS budget;

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS observation TEXT,
ADD COLUMN IF NOT EXISTS responsible TEXT,
ADD COLUMN IF NOT EXISTS sprint TEXT,
ADD COLUMN IF NOT EXISTS actual_start_date DATE,
ADD COLUMN IF NOT EXISTS actual_end_date DATE;