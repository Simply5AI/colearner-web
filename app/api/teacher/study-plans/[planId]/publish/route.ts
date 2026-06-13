import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { publishTeacherPlan } from '@/lib/teacher/plans-dev-store'

export async function POST(
  _req: Request,
  context: { params: Promise<{ planId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { planId } = await context.params
  const plan = publishTeacherPlan(planId)
  if (!plan) {
    return NextResponse.json({ message: 'Study plan not found' }, { status: 404 })
  }

  return NextResponse.json(plan)
}