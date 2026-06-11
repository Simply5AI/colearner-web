import { NextRequest, NextResponse } from 'next/server'
import { callBackend } from '@/lib/api/admin-bff'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin/session-cookie'

export async function POST(req: NextRequest) {
  const sid = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!sid) {
    return NextResponse.json({ message: 'Admin session required' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) {
    return NextResponse.json({ message: 'Authentication code is required' }, { status: 400 })
  }

  const result = await callBackend<{ status: string }>('/api/admin/auth/reauth', {
    method: 'POST',
    cookie: `${ADMIN_SESSION_COOKIE}=${sid}`,
    body: JSON.stringify({ code }),
  })

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message ?? 'Re-authentication failed' },
      { status: result.status || 401 }
    )
  }

  return NextResponse.json({ status: 'reauth_ok' })
}
