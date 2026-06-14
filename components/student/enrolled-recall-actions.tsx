'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BookOpen, ClipboardList, Loader2 } from 'lucide-react'
import { createRecallSession } from '@/lib/api/recall'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface EnrolledRecallActionsProps {
  clonedPlanId: string
  topicId?: string
  questionCount: number
  size?: 'default' | 'sm'
}

export function EnrolledRecallActions({
  clonedPlanId,
  topicId,
  questionCount,
  size = 'default',
}: EnrolledRecallActionsProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState<'practice' | 'exam' | null>(null)
  const [examOpen, setExamOpen] = useState(false)
  const [examQuestionCount, setExamQuestionCount] = useState(Math.min(10, Math.max(questionCount, 1)))
  const [examMinutes, setExamMinutes] = useState(15)

  const authHeaders = session?.accessToken
    ? { Authorization: `Bearer ${session.accessToken}` }
    : null

  const disabled = !authHeaders || questionCount === 0

  async function startPractice() {
    if (!authHeaders || questionCount === 0) return
    setLoading('practice')
    try {
      const created = await createRecallSession(authHeaders, {
        source: 'TEACHER_PLAN',
        mode: 'PRACTICE',
        planId: clonedPlanId,
        topicScope: topicId ? [topicId] : undefined,
        questionCount: Math.min(questionCount, 20),
      })
      router.push(`/learn/enrolled/${clonedPlanId}/recall/${created.id}`)
    } finally {
      setLoading(null)
    }
  }

  async function startExam() {
    if (!authHeaders || questionCount === 0) return
    setLoading('exam')
    try {
      const count = Math.min(examQuestionCount, questionCount)
      const created = await createRecallSession(authHeaders, {
        source: 'TEACHER_PLAN',
        mode: 'EXAM',
        planId: clonedPlanId,
        topicScope: topicId ? [topicId] : undefined,
        questionCount: count,
        timeLimitSec: examMinutes * 60,
      })
      setExamOpen(false)
      router.push(`/learn/enrolled/${clonedPlanId}/recall/${created.id}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        disabled={disabled || loading !== null}
        onClick={startPractice}
      >
        {loading === 'practice' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <BookOpen className="mr-2 h-4 w-4" />
        )}
        {size === 'sm' ? 'Start practice' : 'Practice'}
      </Button>

      <Button
        variant="outline"
        size={size}
        disabled={disabled || loading !== null}
        onClick={() => setExamOpen(true)}
      >
        {loading === 'exam' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ClipboardList className="mr-2 h-4 w-4" />
        )}
        {size === 'sm' ? 'Start exam' : 'Exam'}
      </Button>

      <Dialog open={examOpen} onOpenChange={setExamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start timed exam</DialogTitle>
            <DialogDescription>
              Choose how many questions and how long you have. The timer starts when the session
              begins.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="exam-count">Question count</Label>
              <Input
                id="exam-count"
                type="number"
                min={1}
                max={questionCount}
                value={examQuestionCount}
                onChange={(event) =>
                  setExamQuestionCount(Math.max(1, Number(event.target.value) || 1))
                }
              />
              <p className="text-xs text-muted-foreground">
                Up to {questionCount} published questions available.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exam-minutes">Time limit (minutes)</Label>
              <Input
                id="exam-minutes"
                type="number"
                min={1}
                max={120}
                value={examMinutes}
                onChange={(event) =>
                  setExamMinutes(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setExamOpen(false)}>
              Cancel
            </Button>
            <Button onClick={startExam} disabled={loading === 'exam'}>
              {loading === 'exam' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}