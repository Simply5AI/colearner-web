import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { createTeacherPlan, listTeacherPlans } from '@/lib/teacher/plans-dev-store'
import type { PlanStatus } from '@/lib/types/teacher'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const status = req.nextUrl.searchParams.get('status') as PlanStatus | null
  const search = req.nextUrl.searchParams.get('search')

  return NextResponse.json(
    listTeacherPlans({
      status: status ?? undefined,
      search: search ?? undefined,
    }),
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const body = await req.json()
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const subjectTags = Array.isArray(body.subjectTags)
    ? body.subjectTags.filter((tag: unknown) => typeof tag === 'string').map((tag: string) => tag.trim()).filter(Boolean)
    : []

  if (!title) {
    return NextResponse.json({ message: 'Title is required' }, { status: 400 })
  }

  const plan = createTeacherPlan({ title, description, subjectTags })
  return NextResponse.json(plan, { status: 201 })
}