-- Comprehensive Reactive Mode Schema Sync
-- Run this in your Supabase SQL Editor to fix missing columns and tables

-- 1. Fix reactive_scores table
ALTER TABLE public.reactive_scores 
ADD COLUMN IF NOT EXISTS similarity_method TEXT DEFAULT 'lexical';

ALTER TABLE public.reactive_scores 
ADD COLUMN IF NOT EXISTS tfidf_originality FLOAT DEFAULT 100.0;

ALTER TABLE public.reactive_scores 
ADD COLUMN IF NOT EXISTS similarity_score FLOAT DEFAULT 0.0;

-- 2. Ensure socratic_sessions table exists (missing from current migrations)
CREATE TABLE IF NOT EXISTS public.socratic_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL UNIQUE, -- Links to either submissions or reactive_submissions
    challenge TEXT NOT NULL,
    student_response TEXT,
    socratic_score FLOAT DEFAULT 0.0,
    analysis TEXT,
    followup TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS for socratic_sessions
ALTER TABLE public.socratic_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Policies for socratic_sessions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own socratic sessions') THEN
        CREATE POLICY "Users can manage own socratic sessions" ON public.socratic_sessions
        FOR ALL USING (true) WITH CHECK (true); -- Service role usually handles this, or add specific student/teacher logic if needed
    END IF;
END $$;

-- 5. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
