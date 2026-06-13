'use client'

import { cn } from '@/lib/utils'
import type { TeacherAnswerValue, TeacherQuestion } from '@/lib/types/teacher'

interface TrueFalseQuestionTypeProps {
  question: TeacherQuestion
  mode: 'preview' | 'attempt' | 'review'
  answer?: TeacherAnswerValue
  onAnswer?: (answer: TeacherAnswerValue) => void
  showExplanation?: boolean
}

export function TrueFalseQuestionType({
  question,
  mode,
  answer,
  onAnswer,
  showExplanation,
}: TrueFalseQuestionTypeProps) {
  const selected =
    answer?.type === 'TRUE_FALSE' ? answer.value : undefined
  const correct =
    question.correctAnswer && 'value' in question.correctAnswer
      ? question.correctAnswer.value
      : undefined

  const choices = [
    { label: 'True', value: true },
    { label: 'False', value: false },
  ]

  return (
    <div className="space-y-3">
      <p className="text-base font-medium">{question.prompt}</p>
      <div className="grid grid-cols-2 gap-2">
        {choices.map((choice) => {
          const isSelected = selected === choice.value
          const isCorrect = mode === 'review' && correct === choice.value
          const isWrong = mode === 'review' && isSelected && correct !== choice.value

          return (
            <button
              key={choice.label}
              type="button"
              disabled={mode !== 'attempt'}
              onClick={() =>
                mode === 'attempt' &&
                onAnswer?.({ type: 'TRUE_FALSE', value: choice.value })
              }
              className={cn(
                'rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                mode === 'attempt' && 'cursor-pointer hover:border-muted-foreground/30',
                isSelected && mode === 'attempt' && 'border-brand-teal bg-brand-teal/5',
                isCorrect && 'border-emerald-500 bg-emerald-50',
                isWrong && 'border-rose-500 bg-rose-50',
                mode !== 'attempt' && 'cursor-default',
              )}
            >
              {choice.label}
            </button>
          )
        })}
      </div>
      {showExplanation && question.explanation && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          {question.explanation}
        </p>
      )}
    </div>
  )
}