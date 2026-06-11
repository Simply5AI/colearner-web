import { NextRequest, NextResponse } from 'next/server'
import { callBackend } from '@/lib/api/admin-bff'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
} from '@/lib/admin/session-cookie'

/**
 * Lightweight admin-session probe for client components (idle guard, login page
 * redirect). Returns `{ authenticated }` without exposing session internals.
 * Touching the backend also slides its Redis TTL; we re-issue the web cookie with
 * a fresh max-age so both stay in lockstep for active sessions.
 */
export async function GET(req: NextRequest) {
  const sid = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!sid) {
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }

  const result = await callBackend<{ user: { email: string } }>('/api/admin/auth/me', {
    method: 'GET',
    cookie: `${ADMIN_SESSION_COOKIE}=${sid}`,
  })

  const res = NextResponse.json({
    authenticated: result.ok,
    email: result.data?.user?.email ?? null,
  })

  if (result.ok) {
    res.cookies.set(ADMIN_SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    })
  } else {
    res.cookies.set(ADMIN_SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  }

  return res
}
