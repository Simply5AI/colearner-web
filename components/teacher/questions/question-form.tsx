'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { QuestionEditor } from '@/components/questions/QuestionEditor'
import {
  createTeacherQuestionClient,
  publishTeacherQuestionClient,
  updateTeacherQuestionClient,
} from '@/lib/api/teacher-questions-client'
import type { TeacherQuestion } from '@/lib/types/teacher'

interface QuestionFormProps {
  planId: string
  topicId?: string
  initialQuestion?: TeacherQuestion
}

export function QuestionForm({ planId, topicId = 'topic-1', initialQuestion }: QuestionFormProps) {
  const router = useRouter()

  async function handleSave(
    payload: Omit<TeacherQuestion, 'id' | 'planId' | 'topicId' | 'status'>,
    publish: boolean,
  ) {
    try {
      if (initialQuestion) {
        await updateTeacherQuestionClient(initialQuestion.id, payload)
        if (publish) await publishTeacherQuestionClient(initialQuestion.id)
        toast.success(publish ? 'Question published' : 'Question saved')
        router.push(`/teacher/plans/${planId}/questions`)
        router.refresh()
        return
      }

      const created = await createTeacherQuestionClient({
        planId,
        topicId,
        ...payload,
        status: publish ? 'PUBLISHED' : 'DRAFT',
      })
      if (publish && created.status !== 'PUBLISHED') {
        await publishTeacherQuestionClient(created.id)
      }
      toast.success(publish ? 'Question published' : 'Draft saved')
      router.push(`/teacher/plans/${planId}/questions`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save question')
    }
  }

  return (
    <QuestionEditor
      initialQuestion={initialQuestion}
      onCancel={() => router.push(`/teacher/plans/${planId}/questions`)}
      onSave={(payload) => void handleSave(payload, false)}
    />
  )
}