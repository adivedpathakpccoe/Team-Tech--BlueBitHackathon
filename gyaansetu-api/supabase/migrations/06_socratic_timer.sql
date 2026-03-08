-- 06_socratic_timer.sql
-- Add hard timer support to Socratic sessions

ALTER TABLE public.socratic_sessions 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.socratic_sessions 
ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 180; -- 3 minutes in seconds

-- Update existing sessions to have a started_at if they were already created 
-- (optional, but good for data consistency)
UPDATE public.socratic_sessions 
SET started_at = created_at 
WHERE started_at IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
