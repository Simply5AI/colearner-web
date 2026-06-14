'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { QuestionEditor } from '@/components/questions/QuestionEditor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  createTeacherQuestionClient,
  publishTeacherQuestionClient,
  updateTeacherQuestionClient,
} from '@/lib/api/teacher-questions-client'
import { collectTopicOptions } from '@/lib/teacher/plan-tree-utils'
import type { TeacherQuestion, TreeNode } from '@/lib/types/teacher'

interface QuestionFormProps {
  planId: string
  planTree: TreeNode[]
  topicId?: string
  initialQuestion?: TeacherQuestion
}

export function QuestionForm({
  planId,
  planTree,
  topicId: initialTopicId,
  initialQuestion,
}: QuestionFormProps) {
  const router = useRouter()
  const topicOptions = useMemo(() => collectTopicOptions(planTree), [planTree])
  const [topicId, setTopicId] = useState(
    initialQuestion?.topicId ?? initialTopicId ?? topicOptions[0]?.id ?? '',
  )

  async function handleSave(
    payload: Omit<TeacherQuestion, 'id' | 'planId' | 'topicId' | 'status'>,
    publish: boolean,
  ) {
    if (!topicId) {
      toast.error('Select a topic for this question')
      return
    }

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
    <div className="space-y-5">
      <div className="max-w-sm space-y-2">
        <Label>Topic</Label>
        <Select value={topicId} onValueChange={(value) => value && setTopicId(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select topic" />
          </SelectTrigger>
          <SelectContent>
            {topicOptions.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.kind === 'subtopic' ? `↳ ${topic.title}` : topic.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QuestionEditor
        initialQuestion={initialQuestion}
        onCancel={() => router.push(`/teacher/plans/${planId}/questions`)}
        onSave={(payload) => void handleSave(payload, false)}
      />
    </div>
  )
}