/**
 * Typed API client for the GYAANSETU FastAPI backend.
 * Base URL is configured via NEXT_PUBLIC_API_URL env var.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://rg89c906-8000.inc1.devtunnels.ms'

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
    timeoutMs = 15_000,
): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let res: Response
    try {
        res = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers,
            signal: controller.signal,
        })
    } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.')
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
    mode: 'proactive' | 'reactive'
    topic?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    enable_behavioral?: boolean
    enable_socratic?: boolean
    created_at?: string
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
    create: (payload: { assignment_id: string; essay_text: string }, token: string) =>
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
}

// ─── Socratic endpoints ───────────────────────────────────────────────────────

export interface SocraticChallenge {
    submission_id: string
    challenge: string
}

export interface SocraticScoreResult {
    socratic_score: number
    ownership_score: number
    analysis: string
    followup: string | null
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
}
