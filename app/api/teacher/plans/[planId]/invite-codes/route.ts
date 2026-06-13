import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { createInviteCode, listPlanInviteCodes } from '@/lib/teacher/enrollments-dev-store'

export async function GET(
  _req: Request,
  context: { params: Promise<{ planId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { planId } = await context.params
  return NextResponse.json(listPlanInviteCodes(planId))
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { planId } = await context.params
  const body = await req.json()
  const maxUses = Number(body.maxUses) || 10
  const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : null

  const invite = createInviteCode({
    planId,
    maxUses,
    expiresAt,
    createdBy: session.user?.email ?? 'teacher',
  })

  return NextResponse.json(invite, { status: 201 })
}