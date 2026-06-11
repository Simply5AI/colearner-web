import { NextRequest, NextResponse } from 'next/server'
import { callBackend } from '@/lib/api/admin-bff'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin/session-cookie'

export async function POST(req: NextRequest) {
  const sid = req.cookies.get(ADMIN_SESSION_COOKIE)?.value

  if (sid) {
    // Best-effort backend session teardown; ignore failures.
    await callBackend('/api/admin/auth/logout', {
      method: 'POST',
      cookie: `${ADMIN_SESSION_COOKIE}=${sid}`,
    }).catch(() => undefined)
  }

  const res = NextResponse.json({ status: 'logged_out' })
  res.cookies.set(ADMIN_SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
