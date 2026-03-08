import { type NextRequest, NextResponse } from 'next/server'
import { authApi } from '@/lib/api'

export async function GET(request: NextRequest) {
    const token = request.cookies.get('gs_access_token')?.value

    // Best-effort backend signout
    try {
        await authApi.signout(token)
    } catch {
        // Ignore — clear cookies regardless
    }

    const loginUrl = new URL('/auth/login', request.url)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('gs_access_token')
    response.cookies.delete('gs_refresh_token')
    return response
}
