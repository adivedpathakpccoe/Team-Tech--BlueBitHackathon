-- Add replay_log column to submissions table for behavioral keystroke recording

ALTER TABLE public.submissions
    ADD COLUMN IF NOT EXISTS replay_log TEXT;
