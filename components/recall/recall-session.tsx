'use client'

import { useEffect, useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useRecallStore } from '@/lib/stores/recall-store'
import { submitRecallAnswer, skipRecallQuestion, completeRecallSession, getSessionQuestions } from '@/lib/api/recall'
import { getExtraction } from '@/lib/api/extraction'
import { RecallProgressBar } from './recall-progress-bar'
import { RecallQuestionShell } from './recall-question-shell'
import { OpenAnswerQuestion } from './open-answer-question'
import { MCQQuestion } from './mcq-question'
import { ClozeQuestion } from './cloze-question'
import { AnswerFeedback } from './answer-feedback'
import { TutoringPanel } from './tutoring-panel'
import { JudgingSpinner } from './judging-spinner'
import { TutorFAB } from '@/components/tutor/tutor-fab'
import { TutorDrawer } from '@/components/tutor/tutor-drawer'
import { useTutorStore } from '@/lib/stores/tutor-store'
import { Loader2, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { QuestionWithMeta } from '@/lib/types'

interface RecallSessionProps {
  sessionId: string
  authHeaders: Record<string, string>
}

export function RecallSession({ sessionId, authHeaders }: RecallSessionProps) {
  const router = useRouter()
  const store = useRecallStore()
  const [tutoringOpen, setTutoringOpen] = useState(false)

  // Load questions on mount
  useEffect(() => {
    async function load() {
      const questions = await getSessionQuestions(authHeaders, sessionId)
      store.startSession(sessionId, questions)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const currentQuestion: QuestionWithMeta | undefined =
    store.questions[store.currentQuestionIndex]

  const isLastQuestion = store.currentQuestionIndex >= store.totalQuestions - 1

  const extractionId = currentQuestion?.extractionId

  const tutorConcepts = useMemo(() => {
    const seen = new Map<string, { id: string; title: string }>()
    for (const q of store.questions as QuestionWithMeta[]) {
      if (q.conceptId && !seen.has(q.conceptId)) {
        seen.set(q.conceptId, { id: q.conceptId, title: q.conceptTitle })
      }
    }
    return Array.from(seen.values())
  }, [store.questions])

  const { data: extractionMeta } = useQuery({
    queryKey: ['extraction', extractionId],
    queryFn: () => getExtraction(authHeaders, extractionId as string),
    enabled: Boolean(extractionId),
    staleTime: 5 * 60_000,
  })

  const extractionTitle = extractionMeta?.title ?? 'Practice Session'

  const setPinned = useTutorStore((s) => s.setPinned)
  useEffect(() => {
    if (currentQuestion?.conceptId) setPinned(currentQuestion.conceptId)
  }, [currentQuestion?.conceptId, setPinned])

  useEffect(() => {
    return () => {
      useTutorStore.getState().close()
      useTutorStore.getState().setPinned(null)
    }
  }, [])

  const handleSubmit = useCallback(
    async (answer: string) => {
      if (!currentQuestion || store.isSubmitting) return
      store.setSubmitting(true)

      const timeSpent = store.timerStartedAt
        ? Math.floor((Date.now() - store.timerStartedAt) / 1000)
        : 0

      try {
        const result = await submitRecallAnswer(authHeaders, sessionId, {
          questionId: currentQuestion.id,
          answer,
          timeSpentSeconds: timeSpent,
        })
        store.setResult(result)
      } catch {
        store.setSubmitting(false)
      }
    },
    [currentQuestion, store, authHeaders, sessionId],
  )

  const handleNext = useCallback(async () => {
    if (isLastQuestion) {
      try {
        await completeRecallSession(authHeaders, sessionId)
      } catch {
        // continue to summary even if complete fails
      }
      router.push(`/recall/summary/${sessionId}`)
    } else {
      store.nextQuestion()
    }
  }, [isLastQuestion, authHeaders, sessionId, router, store])

  const handleSkip = useCallback(async () => {
    if (!currentQuestion) return
    try {
      await skipRecallQuestion(authHeaders, sessionId, currentQuestion.id)
      store.markQuestionSkipped(currentQuestion.id)
    } catch {
      // skip silently
    }

    if (isLastQuestion) {
      try {
        await completeRecallSession(authHeaders, sessionId)
      } catch { /* continue */ }
      router.push(`/recall/summary/${sessionId}`)
    } else {
      store.nextQuestion()
    }
  }, [currentQuestion, authHeaders, sessionId, isLastQuestion, router, store])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        router.push('/recall/start')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault()
        store.toggleHint()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [router, store])

  // Loading state
  if (store.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-teal mb-3" />
        <p className="text-sm text-muted-foreground">Loading questions...</p>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No more questions.</p>
      </div>
    )
  }

  return (
    <div>
      <RecallProgressBar
        current={store.currentQuestionIndex}
        total={store.totalQuestions}
      />

      <RecallQuestionShell
        type={currentQuestion.type}
        intent={currentQuestion.intent}
        conceptTitle={currentQuestion.conceptTitle}
        hint={currentQuestion.hint}
        hintVisible={store.hintVisible}
        onToggleHint={store.toggleHint}
      >
        {store.isSubmitting ? (
          <JudgingSpinner />
        ) : store.showFeedback && store.lastResult ? (
          <>
            <QuestionDisplay question={currentQuestion} disabled />
            <AnswerFeedback
              result={store.lastResult}
              isLastQuestion={isLastQuestion}
              onNext={handleNext}
              onTutoring={() => setTutoringOpen(true)}
            />
            <TutoringPanel
              questionId={currentQuestion.id}
              attemptId={store.lastResult.attemptId}
              isOpen={tutoringOpen}
              onClose={() => setTutoringOpen(false)}
            />
          </>
        ) : (
          <>
            <QuestionDisplay
              question={currentQuestion}
              onSubmit={handleSubmit}
              disabled={false}
            />
            <div className="flex justify-end mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                <SkipForward className="mr-1 h-3.5 w-3.5" />
                Skip
              </Button>
            </div>
          </>
        )}
      </RecallQuestionShell>

      <div className="mt-4 text-center text-xs text-muted-foreground">
        <kbd className="rounded border px-1.5 py-0.5 text-[10px]">Ctrl+H</kbd> hint
        <span className="mx-2">·</span>
        <kbd className="rounded border px-1.5 py-0.5 text-[10px]">Esc</kbd> exit
      </div>

      {extractionId && (
        <>
          <TutorFAB />
          <TutorDrawer
            extractionId={extractionId}
            extractionTitle={extractionTitle}
            concepts={tutorConcepts}
          />
        </>
      )}
    </div>
  )
}

function QuestionDisplay({
  question,
  onSubmit,
  disabled,
}: {
  question: QuestionWithMeta
  onSubmit?: (answer: string) => void
  disabled: boolean
}) {
  const noop = () => {}
  const submit = onSubmit ?? noop

  switch (question.type) {
    case 'MULTIPLE_CHOICE':
    case 'TRUE_FALSE':
      return (
        <MCQQuestion
          questionText={question.text}
          options={(question.options as string[]) || []}
          onSubmit={submit}
          disabled={disabled}
        />
      )
    case 'CLOZE':
      return (
        <ClozeQuestion
          questionText={question.text}
          clozeTemplate={question.clozeTemplate || question.text}
          blankCount={question.clozeBlankCount || 1}
          onSubmit={submit}
          disabled={disabled}
        />
      )
    case 'FREE_TEXT':
    default:
      return (
        <OpenAnswerQuestion
          questionText={question.text}
          onSubmit={submit}
          disabled={disabled}
        />
      )
  }
}
