import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { deleteTeacherQuestion, getTeacherQuestion, updateTeacherQuestion } from '@/lib/teacher/questions-dev-store'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ questionId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { questionId } = await context.params
  const question = getTeacherQuestion(questionId)
  if (!question) {
    return NextResponse.json({ message: 'Question not found' }, { status: 404 })
  }
  return NextResponse.json(question)
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ questionId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { questionId } = await context.params
  const body = await req.json()
  const question = updateTeacherQuestion(questionId, body)
  if (!question) {
    return NextResponse.json({ message: 'Question not found' }, { status: 404 })
  }
  return NextResponse.json(question)
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ questionId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { questionId } = await context.params
  if (!deleteTeacherQuestion(questionId)) {
    return NextResponse.json({ message: 'Question not found' }, { status: 404 })
  }
  return new NextResponse(null, { status: 204 })
}