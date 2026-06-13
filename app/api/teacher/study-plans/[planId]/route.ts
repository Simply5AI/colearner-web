import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getTeacherPlan, updateTeacherPlan } from '@/lib/teacher/plans-dev-store'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ planId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { planId } = await context.params
  const plan = getTeacherPlan(planId)
  if (!plan) {
    return NextResponse.json({ message: 'Study plan not found' }, { status: 404 })
  }

  return NextResponse.json(plan)
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { planId } = await context.params
  const body = await req.json()

  const patch: Parameters<typeof updateTeacherPlan>[1] = {}
  if (typeof body.title === 'string') patch.title = body.title.trim()
  if (typeof body.description === 'string') patch.description = body.description.trim()
  if (Array.isArray(body.subjectTags)) {
    patch.subjectTags = body.subjectTags
      .filter((tag: unknown) => typeof tag === 'string')
      .map((tag: string) => tag.trim())
      .filter(Boolean)
  }
  if (Array.isArray(body.tree)) patch.tree = body.tree

  const plan = updateTeacherPlan(planId, patch)
  if (!plan) {
    return NextResponse.json({ message: 'Study plan not found' }, { status: 404 })
  }

  return NextResponse.json(plan)
}