import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { callBackend } from '@/lib/api/admin-bff'

interface VerifyResult {
  backupCodes: string[]
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) {
    return NextResponse.json({ message: 'Authentication code is required' }, { status: 400 })
  }

  const result = await callBackend<VerifyResult>('/api/admin/auth/totp/verify', {
    method: 'POST',
    bearer: session.accessToken,
    body: JSON.stringify({ code }),
  })

  if (!result.ok || !result.data) {
    return NextResponse.json(
      { message: result.message ?? 'Invalid code' },
      { status: result.status || 401 }
    )
  }

  return NextResponse.json(result.data)
}
