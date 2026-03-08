'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { authApi } from '@/lib/api'

// ─── Cookie helpers ──────────────────────────────────────────────────────────

const COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
}

async function setAuthCookies(access_token: string, refresh_token: string) {
    const cookieStore = await cookies()
    cookieStore.set('gs_access_token', access_token, COOKIE_OPTS)
    cookieStore.set('gs_refresh_token', refresh_token, {
        ...COOKIE_OPTS,
        maxAge: 60 * 60 * 24 * 30, // 30 days for refresh
    })
}

async function clearAuthCookies() {
    const cookieStore = await cookies()
    cookieStore.delete('gs_access_token')
    cookieStore.delete('gs_refresh_token')
}

export async function getAccessToken(): Promise<string | undefined> {
    const cookieStore = await cookies()
    return cookieStore.get('gs_access_token')?.value
}

// ─── Auth actions ────────────────────────────────────────────────────────────

export async function login(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
        const res = await authApi.signin(email, password)
        if (res.data) {
            await setAuthCookies(res.data.access_token, res.data.refresh_token)
        }
    } catch (err: unknown) {
        console.error('[AUTH ACTION] Login failed:', err)
        const message = err instanceof Error ? err.message : 'Login failed'
        return { error: message }
    }

    redirect('/dashboard')
}

export async function signup(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const name = formData.get('name') as string
    const role = formData.get('role') as string

    try {
        // 1. Register the user via backend
        await authApi.signup(email, password, name, role)
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Signup failed'
        return { error: message }
    }

    redirect('/auth/login?signup=success')
}

export async function logout() {
    try {
        const token = await getAccessToken()
        await authApi.signout(token)
    } catch {
        // Best-effort signout — clear cookies regardless
    }

    await clearAuthCookies()
    redirect('/auth/login')
}
