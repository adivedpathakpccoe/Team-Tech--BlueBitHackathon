-- Reactive mode tables: submissions + scores
-- Run this in your Supabase SQL Editor

-- ── Reactive submissions (file uploads for reactive assignments) ──────────────

CREATE TABLE IF NOT EXISTS public.reactive_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_assignment_id UUID NOT NULL REFERENCES public.classroom_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(classroom_assignment_id, student_id)
);

ALTER TABLE public.reactive_submissions ENABLE ROW LEVEL SECURITY;

-- Students can read their own submissions
CREATE POLICY "Students can read own reactive submissions"
ON public.reactive_submissions FOR SELECT
USING (student_id = auth.uid());

-- Students can insert their own submissions
CREATE POLICY "Students can insert own reactive submissions"
ON public.reactive_submissions FOR INSERT
WITH CHECK (student_id = auth.uid());

-- Teachers can read submissions in their classrooms
CREATE POLICY "Teachers can read reactive submissions"
ON public.reactive_submissions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.classroom_assignments ca
        JOIN public.classrooms c ON c.id = ca.classroom_id
        WHERE ca.id = reactive_submissions.classroom_assignment_id
        AND c.teacher_id = auth.uid()
    )
);


-- ── Reactive scores ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reactive_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.reactive_submissions(id) ON DELETE CASCADE UNIQUE,
    similarity_score FLOAT DEFAULT 0.0,
    similarity_method TEXT DEFAULT 'lexical',
    tfidf_originality FLOAT DEFAULT 100.0,
    socratic_score FLOAT DEFAULT 0.0,
    ownership_score FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reactive_scores ENABLE ROW LEVEL SECURITY;

-- Students can read their own scores
CREATE POLICY "Students can read own reactive scores"
ON public.reactive_scores FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.reactive_submissions rs
        WHERE rs.id = reactive_scores.submission_id
        AND rs.student_id = auth.uid()
    )
);

-- Teachers can manage reactive scores
CREATE POLICY "Teachers can manage reactive scores"
ON public.reactive_scores FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.reactive_submissions rs
        JOIN public.classroom_assignments ca ON ca.id = rs.classroom_assignment_id
        JOIN public.classrooms c ON c.id = ca.classroom_id
        WHERE rs.id = reactive_scores.submission_id
        AND c.teacher_id = auth.uid()
    )
);

-- Allow service role to insert/upsert reactive scores (for the analyze endpoint)
CREATE POLICY "Service can manage reactive scores"
ON public.reactive_scores FOR ALL
USING (true)
WITH CHECK (true);

-- Allow service role to manage reactive submissions
CREATE POLICY "Service can manage reactive submissions"
ON public.reactive_submissions FOR ALL
USING (true)
WITH CHECK (true);
