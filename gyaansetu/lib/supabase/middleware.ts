import { NextResponse, type NextRequest } from 'next/server'

const ACCESS_COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
}

const REFRESH_COOKIE_OPTS = {
    ...ACCESS_COOKIE_OPTS,
    maxAge: 60 * 60 * 24 * 30, // 30 days
}

/** Decode JWT payload and check if it expires within the next 30 seconds. */
function isTokenExpired(token: string): boolean {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000) + 30
    } catch {
        return true
    }
}

/**
 * Middleware: reads the gs_access_token cookie set by our backend auth.
 * Protected routes require a valid token cookie.
 * Automatically refreshes the access token when it has expired.
 */
export async function updateSession(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // ── Public routes (no auth needed) ─────────────────────────────────────
    const publicRoutes = ['/', '/auth/login', '/auth/signup', '/auth/signout']
    const isPublicRoute = publicRoutes.some(
        (r) => pathname === r || pathname.startsWith('/auth/forgot-password')
    )

    let token = request.cookies.get('gs_access_token')?.value
    const refreshToken = request.cookies.get('gs_refresh_token')?.value

    // ── Refresh access token if expired ────────────────────────────────────
    if (token && isTokenExpired(token) && refreshToken) {
        try {
            const backendUrl = process.env.API_BASE_URL ?? 'https://dwain-unmystic-addyson.ngrok-free.dev'
            const res = await fetch(`${backendUrl}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            })

            if (res.ok) {
                const json = await res.json()
                const newAccess: string = json.data.access_token
                const newRefresh: string = json.data.refresh_token
                token = newAccess

                // If heading to an auth page after refresh, redirect to dashboard instead
                if (pathname === '/auth/login' || pathname === '/auth/signup') {
                    const url = request.nextUrl.clone()
                    url.pathname = '/dashboard'
                    const redirectResponse = NextResponse.redirect(url)
                    redirectResponse.cookies.set('gs_access_token', newAccess, ACCESS_COOKIE_OPTS)
                    redirectResponse.cookies.set('gs_refresh_token', newRefresh, REFRESH_COOKIE_OPTS)
                    return redirectResponse
                }

                const response = NextResponse.next({ request })
                response.cookies.set('gs_access_token', newAccess, ACCESS_COOKIE_OPTS)
                response.cookies.set('gs_refresh_token', newRefresh, REFRESH_COOKIE_OPTS)
                return response
            } else {
                // Refresh rejected — treat as unauthenticated
                token = undefined
            }
        } catch {
            // Network error during refresh — fall through, treat as no token
            token = undefined
        }
    }

    // ── Unauthenticated on protected route → redirect to login ──────────────
    if (!token && !isPublicRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        const response = NextResponse.redirect(url)
        response.cookies.delete('gs_access_token')
        response.cookies.delete('gs_refresh_token')
        return response
    }

    // ── Authenticated user hitting auth pages → redirect to dashboard ───────
    if (token && (pathname === '/auth/login' || pathname === '/auth/signup')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    return NextResponse.next({ request })
}
