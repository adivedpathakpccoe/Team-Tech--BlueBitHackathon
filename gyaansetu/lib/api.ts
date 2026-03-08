/**
 * Typed API client for the GYAANSETU FastAPI backend.
 * Base URL is configured via NEXT_PUBLIC_API_URL env var.
 */

const IS_SERVER = typeof window === 'undefined'

// On the server (Server Components/Actions), we hit the backend directly.
// Use API_BASE_URL env var if set (for custom deployments), else default to
// 127.0.0.1 (NOT localhost — avoids IPv6 resolution delay on macOS/Node.js 17+).
// On the client (useEffect/Event Handlers), we hit the /backend rewrite so Next.js proxies it for us.
const BASE_URL = IS_SERVER
    ? (process.env.API_BASE_URL ?? 'https://dwain-unmystic-addyson.ngrok-free.dev')
    : '/backend'

const EXTRACTOR_URL = IS_SERVER
    ? (process.env.EXTRACTOR_BASE_URL ?? 'http://127.0.0.1:8001')
    : '/extractor'

// ─── Response types ──────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
    ok: boolean
    message: string | null
    data?: T
}

export interface AuthUser {
    id: string
    email: string
    name: string | null
    role: string | null
}

export interface SignInData {
    access_token: string
    refresh_token: string
    user: AuthUser
}

export interface SignUpData {
    user_id: string
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function apiFetch<T>(
    path: string,
    options: RequestInit = {},
    token?: string,
    timeoutMs = 45_000,
): Promise<ApiResponse<T>> {
    console.log(`[API] ${options.method || 'GET'} ${path}`)
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    // Normalize URL: remove trailing slash from base and leading slash from path to join cleanly
    const normalizedBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const fullUrl = `${normalizedBase}${normalizedPath}`

    let res: Response
    try {
        res = await fetch(fullUrl, {
            ...options,
            headers,
            signal: controller.signal,
        })
    } catch (err: unknown) {
        console.error(`[API ERROR] ${options.method || 'GET'} ${path}:`, err)
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error(`Request timed out. Please check the backend is running at ${BASE_URL}.`)
        }
        throw err
    } finally {
        clearTimeout(timer)
    }

    const json = await res.json()

    if (!res.ok) {
        const detail = json?.detail ?? json?.message ?? 'An error occurred'
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
    }

    return json as ApiResponse<T>
}

// ─── Auth endpoints ───────────────────────────────────────────────────────────

export const authApi = {
    /** Register a new user */
    signup: (email: string, password: string, name: string, role: string) =>
        apiFetch<SignUpData>('/api/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password, name, role }),
        }),

    /** Authenticate and get session tokens */
    signin: (email: string, password: string) =>
        apiFetch<SignInData>('/api/auth/signin', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    /** Refresh the access token */
    refresh: (refresh_token: string) =>
        apiFetch<SignInData>('/api/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refresh_token }),
        }),

    /** Get current user's profile (requires token) */
    me: (token: string) =>
        apiFetch<AuthUser>('/api/auth/me', {}, token),

    /** Sign out the current session */
    signout: (token?: string) =>
        apiFetch('/api/auth/signout', { method: 'POST' }, token),

    /** Send forgot password email */
    forgotPassword: (email: string) =>
        apiFetch('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),
}

// ─── Assignments endpoints ────────────────────────────────────────────────────

export interface Assignment {
    id: string
    topic: string
    description: string | null
    difficulty: 'easy' | 'medium' | 'hard'
    mode: 'proactive' | 'reactive'
    enable_behavioral: boolean
    enable_socratic: boolean
    honeypot_hidden_instruction: boolean
    honeypot_zero_width: boolean
    honeypot_fake_fact: boolean
    honeypot_sentiment_contradiction: boolean
    created_at?: string
    classroom_id?: string
    batch_ids?: string[]
    submitted?: boolean
}

export interface AssignmentCreate {
    topic: string
    description?: string
    difficulty: 'easy' | 'medium' | 'hard'
    mode: 'proactive' | 'reactive'
    enable_behavioral: boolean
    enable_socratic: boolean
    honeypot_hidden_instruction: boolean
    honeypot_zero_width: boolean
    honeypot_fake_fact: boolean
    honeypot_sentiment_contradiction: boolean
    batch_ids?: string[]
}

export interface AssignmentGenerateRequest {
    topic: string
    difficulty: 'easy' | 'medium' | 'hard'
}

export const assignmentsApi = {
    /** Generate assignment content using AI (returns topic, description, etc.) */
    generateData: (payload: AssignmentGenerateRequest, token: string) =>
        apiFetch<Partial<Assignment>>('/api/assignments/ai-generate', {
            method: 'POST',
            body: JSON.stringify(payload),
        }, token, 60_000),

    /** Create a new assignment for a classroom */
    create: (classroom_id: string, payload: AssignmentCreate, token: string) =>
        apiFetch<Assignment>(`/api/classrooms/${classroom_id}/assignments`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }, token),

    /** List assignments in a classroom */
    list: (classroom_id: string, token: string) =>
        apiFetch<Assignment[]>(`/api/classrooms/${classroom_id}/assignments`, {}, token),

    /** Update an existing classroom assignment */
    update: (classroom_id: string, assignment_id: string, payload: Partial<AssignmentCreate>, token: string) =>
        apiFetch<Assignment>(`/api/classrooms/${classroom_id}/assignments/${assignment_id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }, token),

    /** Distribute an assignment to all students in a batch (generates unique honeypot variants) */
    distribute: (classroom_id: string, assignment_id: string, batch_id: string, token: string) =>
        apiFetch<{ distributed_to: number; assignments: Assignment[] }>(
            `/api/classrooms/${classroom_id}/assignments/${assignment_id}/distribute`,
            { method: 'POST', body: JSON.stringify({ batch_id }) },
            token,
            120_000, // Gemini calls per student — allow up to 2 min
        ),

    /** Get latest assignment for a student */
    getForStudent: (student_id: string, token: string) =>
        apiFetch(`/api/assignments/${student_id}`, {}, token),
}

// ─── Classrooms endpoints ─────────────────────────────────────────────────────

export interface ClassroomCreate {
    name: string
    description?: string
}

export interface BatchCreate {
    name: string
    description?: string
}

export interface EnrolledBatch {
    batch_id: string
    batch_name: string
    classroom_id: string
    classroom_name: string
}


export const classroomsApi = {
    /** List all classrooms owned by the teacher */
    list: (token: string) =>
        apiFetch('/api/classrooms', {}, token),

    /** Create a new classroom */
    create: (payload: ClassroomCreate, token: string) =>
        apiFetch('/api/classrooms', {
            method: 'POST',
            body: JSON.stringify(payload),
        }, token),

    /** Get a specific classroom */
    get: (classroom_id: string, token: string) =>
        apiFetch(`/api/classrooms/${classroom_id}`, {}, token),

    /** Create a batch within a classroom */
    createBatch: (classroom_id: string, payload: BatchCreate, token: string) =>
        apiFetch(`/api/classrooms/${classroom_id}/batches`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }, token),

    /** List batches in a classroom */
    listBatches: (classroom_id: string, token: string) =>
        apiFetch(`/api/classrooms/${classroom_id}/batches`, {}, token),

    /** Join a batch (student) */
    joinBatch: (join_code: string, token: string) =>
        apiFetch('/api/classrooms/batches/join', {
            method: 'POST',
            body: JSON.stringify({ join_code }),
        }, token),

    /** List members of a batch (teacher) */
    batchMembers: (batch_id: string, token: string) =>
        apiFetch(`/api/classrooms/batches/${batch_id}/members`, {}, token),

    /** Delete a classroom */
    delete: (classroom_id: string, token: string) =>
        apiFetch(`/api/classrooms/${classroom_id}`, { method: 'DELETE' }, token),
}

// ─── Student endpoints ────────────────────────────────────────────────────────

export interface StudentAssignment {
    id: string
    classroom_assignment_id: string
    student_id: string
    assignment_text: string
    honeypot_phrase: string | null
    hidden_trigger_phrase: string | null
    wrong_fact_signal: string | null
    mode: 'proactive' | 'reactive'
    topic?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    enable_behavioral?: boolean
    enable_socratic?: boolean
    created_at?: string
    submitted?: boolean
}

export const studentApi = {
    /** Get all batches the student is enrolled in */
    getMyBatches: (token: string) =>
        apiFetch<EnrolledBatch[]>('/api/student/batches', {}, token),

    /** Get classroom assignments for a classroom the student is enrolled in */
    getAssignmentsForClassroom: (classroom_id: string, token: string) =>
        apiFetch<Assignment[]>(`/api/student/classrooms/${classroom_id}/assignments`, {}, token),

    /** Get the student's unique distributed variant for a classroom assignment (auto-generates on first access) */
    getMyAssignmentVariant: (classroom_assignment_id: string, token: string) =>
        apiFetch<StudentAssignment>(`/api/student/assignments/${classroom_assignment_id}`, {}, token, 90_000),
}

// ─── Submissions endpoints ────────────────────────────────────────────────────

export interface SubmissionResult {
    id: string
    student_id: string
    assignment_id: string
    essay_text: string
    honeypot_score: number | null
}

export interface BehaviorLog {
    submission_id: string
    typing_events: Array<{ t: number; type: string }>
    paste_events: Array<{ t: number; len: number }>
    largest_paste: number
    tab_switches: number
    idle_time: number
}

export const submissionsApi = {
    /** Submit an essay for an assignment */
    create: (payload: { assignment_id: string; essay_text: string; replay_log?: string }, token: string) =>
        apiFetch<SubmissionResult>('/api/submissions/', {
            method: 'POST',
            body: JSON.stringify(payload),
        }, token),

    /** Log behavioral telemetry for a submission */
    logBehavior: (payload: BehaviorLog, token: string) =>
        apiFetch('/api/behavior/log', {
            method: 'POST',
            body: JSON.stringify(payload),
        }, token),

    /** List all submissions for an assignment (teacher view) */
    listByAssignment: (assignment_id: string, token: string) =>
        apiFetch<any[]>(`/api/submissions/assignment/${assignment_id}`, {}, token),
}

// ─── Replay endpoints ──────────────────────────────────────────────────────────

export const replayApi = {
    /** Fetch the WritingDNA replay log for a submission (teacher view) */
    getLog: (submission_id: string, token: string) =>
        apiFetch<import('./replayEngine').ReplayLog>(`/api/submissions/${submission_id}/replay`, {}, token),
}

// ─── Snapshot endpoints ────────────────────────────────────────────────────────

export interface SnapshotEntry {
    t: number
    code: string
}

export const snapshotsApi = {
    /** Periodically push new in-memory snapshots to the server for safe-keeping */
    push: (assignment_id: string, snapshots: SnapshotEntry[], token: string) =>
        apiFetch('/api/snapshots', {
            method: 'POST',
            body: JSON.stringify({ assignment_id, snapshots }),
        }, token),

    /** After submission is created, link the saved snapshots to the submission ID */
    link: (assignment_id: string, submission_id: string, token: string) =>
        apiFetch(`/api/snapshots/link?assignment_id=${assignment_id}&submission_id=${submission_id}`, {
            method: 'PATCH',
        }, token),
}

// ─── Socratic endpoints ───────────────────────────────────────────────────────

export interface SocraticChallenge {
    submission_id: string
    challenge: string
    started_at: string
    time_limit: number
}

export interface SocraticScoreResult {
    socratic_score: number
    ownership_score: number
    analysis: string
    followup: string | null
    followup_started_at: string | null
    question_just_answered: number
}

export const socraticApi = {
    /** Generate a Socratic challenge question from a submission */
    getChallenge: (submission_id: string, token: string) =>
        apiFetch<SocraticChallenge>(`/api/socratic/challenge?submission_id=${submission_id}`, {
            method: 'POST',
        }, token, 60_000),

    /** Score the student's Socratic response */
    scoreResponse: (payload: { submission_id: string; student_response: string }, token: string) =>
        apiFetch<SocraticScoreResult>('/api/socratic/score', {
            method: 'POST',
            body: JSON.stringify(payload),
        }, token, 60_000),

    /** Record a paste violation during the Socratic challenge */
    pasteViolation: (submission_id: string, token: string) =>
        apiFetch<{ paste_violations: number; paste_penalty: number }>(
            `/api/socratic/paste-violation?submission_id=${submission_id}`,
            { method: 'POST' },
            token,
        ),
}

// ─── Extractor endpoints ──────────────────────────────────────────────────────

export interface ExtractionResponse {
    filename: string
    content: string
    success: boolean
    error?: string
}

export const extractorApi = {
    /** Extract text content from an uploaded file */
    extract: async (file: File): Promise<ExtractionResponse> => {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`${EXTRACTOR_URL}/extract`, {
            method: 'POST',
            body: formData,
        })

        if (!res.ok) {
            throw new Error('Failed to connect to extraction service')
        }

        return await res.json()
    }
}

// ─── Reactive mode endpoints ──────────────────────────────────────────────────

export interface ReactiveUploadResult {
    submission_id: string
    filename: string
    text_length: number
    challenge: string | null
    started_at: string | null
    time_limit: number
}

export interface ReactiveSocraticResult {
    socratic_score: number
    analysis: string
    followup: string | null
    followup_started_at: string | null
    question_just_answered: number
}

export interface ReactiveAnalysisResult {
    total_submissions: number
    flagged_pairs: Array<{
        student_a: string
        student_b: string
        submission_a: string
        submission_b: string
        similarity: number
        method_signal: 'lexical' | 'semantic'
    }>
    results: Array<{
        submission_id: string
        student_id: string
        filename: string
        max_similarity: number
        most_similar_to: string | null
        similarity_method: 'lexical' | 'semantic'
        tfidf_originality: number
        socratic_score: number
        ownership_score: number
    }>
}

export interface ReactiveResultEntry {
    submission_id: string
    student_id: string
    student_name: string
    student_email: string | null
    filename: string
    submitted_at: string
    scores: {
        similarity_score: number
        similarity_method: 'lexical' | 'semantic'
        tfidf_originality: number
        socratic_score: number
        ownership_score: number
    } | null
}

export interface ReactiveSubmissionStatus {
    submission: {
        id: string
        classroom_assignment_id: string
        student_id: string
        filename: string
        extracted_text: string
        created_at: string
    }
    socratic: {
        challenge: string
        student_response: string | null
        socratic_score: number | null
        analysis: string | null
        followup: string | null
        followup_started_at: string | null
        followup_response: string | null
        followup2: string | null
        followup2_started_at: string | null
        followup2_response: string | null
        paste_violations: number | null
        started_at: string | null
        time_limit: number | null
    } | null
    scores: {
        similarity_score: number
        similarity_method: 'lexical' | 'semantic'
        tfidf_originality: number
        socratic_score: number
        ownership_score: number
    } | null
}

export const reactiveApi = {
    /** Get classroom assignment info for reactive mode */
    getAssignment: (assignmentId: string, token: string) =>
        apiFetch<Assignment>(`/api/reactive/assignments/${assignmentId}`, {}, token),

    /** Check if student already submitted for this reactive assignment */
    getMySubmission: (assignmentId: string, token: string) =>
        apiFetch<ReactiveSubmissionStatus | null>(`/api/reactive/my-submission/${assignmentId}`, {}, token),

    /** Upload a file for reactive analysis (multipart/form-data) */
    upload: async (assignmentId: string, file: File, token: string): Promise<ApiResponse<ReactiveUploadResult>> => {
        const formData = new FormData()
        formData.append('classroom_assignment_id', assignmentId)
        formData.append('file', file)
        const res = await fetch(`${BASE_URL}/api/reactive/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        })
        const json = await res.json()
        if (!res.ok) {
            throw new Error(json?.detail ?? 'Upload failed')
        }
        return json
    },

    /** Submit student's Socratic answer */
    socraticAnswer: (submissionId: string, studentResponse: string, token: string) =>
        apiFetch<ReactiveSocraticResult>('/api/reactive/socratic-answer', {
            method: 'POST',
            body: JSON.stringify({ submission_id: submissionId, student_response: studentResponse }),
        }, token, 60_000),

    /** Get submission status + socratic state */
    getStatus: (submission_id: string, token: string) =>
        apiFetch<ReactiveSubmissionStatus>(`/api/reactive/submission/${submission_id}`, {}, token),

    /** Teacher: Close assignment & run inter-student TF-IDF analysis */
    analyze: (assignmentId: string, token: string) =>
        apiFetch<ReactiveAnalysisResult>(`/api/reactive/${assignmentId}/analyze`, {
            method: 'POST',
        }, token, 120_000),

    /** Teacher: Get analysis results */
    getResults: (assignmentId: string, token: string) =>
        apiFetch<ReactiveResultEntry[]>(`/api/reactive/${assignmentId}/results`, {}, token),
}
