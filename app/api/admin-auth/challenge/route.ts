import { NextRequest, NextResponse } from 'next/server'
import { getApiUrl } from '@/lib/api/client'
import {
  ADMIN_PREAUTH_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
} from '@/lib/admin/session-cookie'

/** Parse the admin session id + max-age out of the backend Set-Cookie header. */
function parseSessionCookie(setCookies: string[]): { sessionId: string; ttl: number } | null {
  const target = setCookies.find((c) => c.startsWith(`${ADMIN_SESSION_COOKIE}=`))
  if (!target) return null
  const pair = target.split(';')[0] ?? ''
  const sessionId = pair.slice(ADMIN_SESSION_COOKIE.length + 1)
  if (!sessionId) return null
  const maxAge = /max-age=(\d+)/i.exec(target)
  return { sessionId, ttl: maxAge ? Number(maxAge[1]) : ADMIN_SESSION_TTL_SECONDS }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const preAuthToken = req.cookies.get(ADMIN_PREAUTH_COOKIE)?.value

  if (!preAuthToken) {
    return NextResponse.json(
      { message: 'Login session expired. Please sign in again.' },
      { status: 440 }
    )
  }
  if (!code) {
    return NextResponse.json({ message: 'Authentication code is required' }, { status: 400 })
  }

  // Call the backend directly (not callBackend) so we can read its Set-Cookie
  // header server-to-server — the session id is never returned in the body.
  const backendRes = await fetch(`${getApiUrl()}/api/admin/auth/totp/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preAuthToken, code }),
    cache: 'no-store',
  })
  const json = await backendRes.json().catch(() => null)

  if (!backendRes.ok) {
    return NextResponse.json(
      { message: (json?.message as string) ?? 'Invalid code' },
      { status: backendRes.status || 401 }
    )
  }

  const setCookies =
    typeof backendRes.headers.getSetCookie === 'function'
      ? backendRes.headers.getSetCookie()
      : ([backendRes.headers.get('set-cookie')].filter(Boolean) as string[])
  const parsed = parseSessionCookie(setCookies)

  if (!parsed) {
    return NextResponse.json(
      { message: 'Authentication failed. Please try again.' },
      { status: 502 }
    )
  }

  // Re-issue the admin session as an httpOnly cookie on the web origin and clear
  // the spent pre-auth token.
  const res = NextResponse.json({ status: 'authenticated' })
  res.cookies.set(ADMIN_SESSION_COOKIE, parsed.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: parsed.ttl,
  })
  res.cookies.set(ADMIN_PREAUTH_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
