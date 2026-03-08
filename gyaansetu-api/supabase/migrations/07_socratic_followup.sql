-- 07_socratic_followup.sql
-- Add multi-question follow-up support and paste violation tracking

ALTER TABLE public.socratic_sessions
    ADD COLUMN IF NOT EXISTS followup_started_at  TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS followup_response     TEXT,
    ADD COLUMN IF NOT EXISTS followup2             TEXT,
    ADD COLUMN IF NOT EXISTS followup2_started_at  TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS followup2_response    TEXT,
    ADD COLUMN IF NOT EXISTS paste_violations      INTEGER  DEFAULT 0,
    ADD COLUMN IF NOT EXISTS paste_penalty         NUMERIC  DEFAULT 0;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';