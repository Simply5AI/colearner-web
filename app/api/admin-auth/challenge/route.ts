import { NextRequest, NextResponse } from 'next/server'
import { callBackend } from '@/lib/api/admin-bff'
import { ADMIN_PREAUTH_COOKIE, ADMIN_SESSION_COOKIE } from '@/lib/admin/session-cookie'

interface ChallengeResult {
  status: 'authenticated'
  sessionId: string
  ttl: number
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

  const result = await callBackend<ChallengeResult>('/api/admin/auth/totp/challenge', {
    method: 'POST',
    body: JSON.stringify({ preAuthToken, code }),
  })

  if (!result.ok || !result.data) {
    return NextResponse.json(
      { message: result.message ?? 'Invalid code' },
      { status: result.status || 401 }
    )
  }

  // Re-issue the admin session as an httpOnly cookie on the web origin and clear
  // the spent pre-auth token.
  const res = NextResponse.json({ status: 'authenticated' })
  res.cookies.set(ADMIN_SESSION_COOKIE, result.data.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: result.data.ttl,
  })
  res.cookies.set(ADMIN_PREAUTH_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
