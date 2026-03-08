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
): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
    })

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
        }, token),

    /** Create a new assignment for a classroom */
    create: (classroom_id: string, payload: AssignmentCreate, token: string) =>
        apiFetch<Assignment>(`/api/classrooms/${classroom_id}/assignments`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }, token),

    /** List assignments in a classroom */
    list: (classroom_id: string, token: string) =>
        apiFetch<Assignment[]>(`/api/classrooms/${classroom_id}/assignments`, {}, token),

    /** Get latest assignment for a student */
    getForStudent: (student_id: string) =>
        apiFetch(`/api/assignments/${student_id}`),
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
