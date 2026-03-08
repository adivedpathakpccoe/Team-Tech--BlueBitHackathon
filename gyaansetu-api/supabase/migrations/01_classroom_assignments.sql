-- Migration for classroom assignments table
-- Run this in your Supabase SQL Editor to support the new feature!

CREATE TABLE IF NOT EXISTS public.classroom_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    description TEXT,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    mode TEXT NOT NULL CHECK (mode IN ('proactive', 'reactive')),
    
    -- Feature Flags (Teacher Control)
    enable_behavioral BOOLEAN NOT NULL DEFAULT TRUE,
    enable_socratic BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Honeypot Controls
    honeypot_hidden_instruction BOOLEAN NOT NULL DEFAULT TRUE,
    honeypot_zero_width BOOLEAN NOT NULL DEFAULT TRUE,
    honeypot_fake_fact BOOLEAN NOT NULL DEFAULT TRUE,
    honeypot_sentiment_contradiction BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure RLS is enabled correctly for teacher access
ALTER TABLE public.classroom_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Teachers can see assignments in classrooms they own
CREATE POLICY "Teachers can manage their own classroom assignments"
ON public.classroom_assignments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.classrooms
        WHERE public.classrooms.id = classroom_assignments.classroom_id
        AND public.classrooms.teacher_id = auth.uid()
    )
);
