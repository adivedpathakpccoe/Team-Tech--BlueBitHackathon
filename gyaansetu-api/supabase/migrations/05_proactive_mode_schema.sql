-- =============================================================================
-- PROACTIVE MODE SCHEMA (Missing Tables: submissions, scores, behavior_logs)
-- =============================================================================

-- 1. Submissions table (Proactive Mode)
-- Students submit their essays here after receiving a unique variant.
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    essay_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(assignment_id, student_id)
);

-- 2. Scores table (Proactive Mode)
-- High-level integrity results for proactive submissions. 
-- For Reactive, use reactive_scores instead.
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE UNIQUE,
    honeypot_score FLOAT DEFAULT 100.0,
    behavior_score FLOAT DEFAULT 100.0,
    socratic_score FLOAT DEFAULT 0.0,
    ownership_score FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Behavior Logs table (Proactive Mode)
-- Stores the raw telemetry (typing, pasting, etc.) for behavioral analysis.
CREATE TABLE IF NOT EXISTS public.behavior_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE UNIQUE,
    typing_events JSONB DEFAULT '[]',
    paste_events JSONB DEFAULT '[]',
    largest_paste INTEGER DEFAULT 0,
    tab_switches INTEGER DEFAULT 0,
    idle_time INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_logs ENABLE ROW LEVEL SECURITY;

-- Submissions Policies
CREATE POLICY "Students can read their own submissions" ON public.submissions FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students can insert their own submissions" ON public.submissions FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Teachers can read submissions in their classrooms" ON public.submissions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.assignments a
        JOIN public.classroom_assignments ca ON a.classroom_assignment_id = ca.id
        JOIN public.classrooms c ON ca.classroom_id = c.id
        WHERE a.id = submissions.assignment_id AND c.teacher_id = auth.uid()
    )
);

-- Scores Policies
CREATE POLICY "Students can read their own scores" ON public.scores FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = scores.submission_id AND s.student_id = auth.uid())
);
CREATE POLICY "Teachers can read scores in their classrooms" ON public.scores FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.submissions s
        JOIN public.assignments a ON s.assignment_id = a.id
        JOIN public.classroom_assignments ca ON a.classroom_assignment_id = ca.id
        JOIN public.classrooms c ON ca.classroom_id = c.id
        WHERE s.id = scores.submission_id AND c.teacher_id = auth.uid()
    )
);

-- Behavior Logs Policies
CREATE POLICY "Students can manage their own behavior logs" ON public.behavior_logs FOR ALL USING (
    EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = behavior_logs.submission_id AND s.student_id = auth.uid())
);

-- Service Role (Full Access)
CREATE POLICY "Service can manage proactive submissions" ON public.submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage proactive scores" ON public.scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage behavior logs" ON public.behavior_logs FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- FINALIZATION
-- =============================================================================
NOTIFY pgrst, 'reload schema';
