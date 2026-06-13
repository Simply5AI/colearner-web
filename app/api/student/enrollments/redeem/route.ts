import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { redeemInviteCode } from '@/lib/teacher/enrollments-dev-store'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const body = await req.json()
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) {
    return NextResponse.json({ message: 'Invite code is required' }, { status: 400 })
  }

  const result = redeemInviteCode(code)
  if (!result) {
    return NextResponse.json({ message: 'Invalid, expired, or exhausted invite code' }, { status: 400 })
  }

  return NextResponse.json(result)
}