import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { callBackend } from '@/lib/api/admin-bff'

interface SetupResult {
  otpauthUrl: string
  qrDataUrl: string
}

export async function POST() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const result = await callBackend<SetupResult>('/api/admin/auth/totp/setup', {
    method: 'POST',
    bearer: session.accessToken,
  })

  if (!result.ok || !result.data) {
    return NextResponse.json(
      { message: result.message ?? 'Could not start TOTP setup' },
      { status: result.status || 400 }
    )
  }

  return NextResponse.json(result.data)
}
