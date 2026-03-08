import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware: reads the gs_access_token cookie set by our backend auth.
 * Protected routes require a valid token cookie.
 */
export async function updateSession(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // ── Public routes (no auth needed) ─────────────────────────────────────
    const publicRoutes = ['/', '/auth/login', '/auth/signup', '/auth/signout']
    const isPublicRoute = publicRoutes.some(
        (r) => pathname === r || pathname.startsWith('/auth/forgot-password')
    )

    const token = request.cookies.get('gs_access_token')?.value

    // ── Unauthenticated on protected route → redirect to login ──────────────
    if (!token && !isPublicRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
    }

    // ── Authenticated user hitting auth pages → redirect to dashboard ───────
    if (token && (pathname === '/auth/login' || pathname === '/auth/signup')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    return NextResponse.next({ request })
}
