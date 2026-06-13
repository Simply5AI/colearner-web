import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { publishTeacherQuestion } from '@/lib/teacher/questions-dev-store'

export async function POST(
  _req: Request,
  context: { params: Promise<{ questionId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { questionId } = await context.params
  const question = publishTeacherQuestion(questionId)
  if (!question) {
    return NextResponse.json({ message: 'Question not found' }, { status: 404 })
  }
  return NextResponse.json(question)
}