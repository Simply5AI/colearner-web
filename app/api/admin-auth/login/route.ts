import { NextRequest, NextResponse } from 'next/server'
import { callBackend } from '@/lib/api/admin-bff'
import { ADMIN_PREAUTH_COOKIE, ADMIN_PREAUTH_MAX_AGE } from '@/lib/admin/session-cookie'

interface LoginResult {
  status: 'TOTP_SETUP_REQUIRED' | 'TOTP_CHALLENGE_REQUIRED'
  preAuthToken: string
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 })
  }

  const result = await callBackend<LoginResult>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (!result.ok || !result.data) {
    return NextResponse.json(
      { message: result.message ?? 'Login failed' },
      { status: result.status || 401 }
    )
  }

  // Stash the single-use pre-auth token in an httpOnly cookie so it never lives
  // in client JS. The challenge route reads it back.
  const res = NextResponse.json({ status: result.data.status })
  res.cookies.set(ADMIN_PREAUTH_COOKIE, result.data.preAuthToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_PREAUTH_MAX_AGE,
  })
  return res
}
