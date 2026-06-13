import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { createTeacherQuestion, listTeacherQuestions } from '@/lib/teacher/questions-dev-store'
import type { TeacherQuestionStatus } from '@/lib/types/teacher'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const planId = req.nextUrl.searchParams.get('planId')
  const topicId = req.nextUrl.searchParams.get('topicId') ?? undefined
  const status = req.nextUrl.searchParams.get('status') as TeacherQuestionStatus | null
  if (!planId) {
    return NextResponse.json({ message: 'planId is required' }, { status: 400 })
  }

  return NextResponse.json(listTeacherQuestions({ planId, topicId, status: status ?? undefined }))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const body = await req.json()
  if (!body.planId || !body.topicId || !body.type || !body.prompt) {
    return NextResponse.json({ message: 'planId, topicId, type, and prompt are required' }, { status: 400 })
  }

  const question = createTeacherQuestion({
    planId: body.planId,
    topicId: body.topicId,
    type: body.type,
    prompt: String(body.prompt).trim(),
    options: body.options,
    correctAnswer: body.correctAnswer,
    explanation: String(body.explanation ?? '').trim(),
    status: body.status,
  })

  return NextResponse.json(question, { status: 201 })
}