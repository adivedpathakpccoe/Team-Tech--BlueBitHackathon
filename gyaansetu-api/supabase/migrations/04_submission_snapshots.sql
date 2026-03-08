-- Dedicated table for incremental WritingDNA snapshot storage.
-- Snapshots are flushed here every ~30s during an active session so that
-- replay data is preserved even if the student never submits.
-- On submission, the submission_id column is backfilled to link them.

CREATE TABLE IF NOT EXISTS public.submission_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    assignment_id   UUID        NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    submission_id   UUID        REFERENCES public.submissions(id) ON DELETE CASCADE,
    t               INTEGER     NOT NULL,   -- ms since session start
    code            TEXT        NOT NULL,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups by assignment (during session) and by submission (teacher replay)
CREATE INDEX IF NOT EXISTS idx_snapshots_assignment ON public.submission_snapshots (assignment_id, t);
CREATE INDEX IF NOT EXISTS idx_snapshots_submission ON public.submission_snapshots (submission_id, t);
