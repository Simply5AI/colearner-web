import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { revokeInviteCode } from '@/lib/teacher/enrollments-dev-store'

export async function POST(
  _req: Request,
  context: { params: Promise<{ planId: string; inviteId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { inviteId } = await context.params
  const invite = revokeInviteCode(inviteId)
  if (!invite) {
    return NextResponse.json({ message: 'Invite code not found' }, { status: 404 })
  }
  return NextResponse.json(invite)
}