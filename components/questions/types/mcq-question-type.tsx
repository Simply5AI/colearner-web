'use client'

import { cn } from '@/lib/utils'
import type { TeacherAnswerValue, TeacherQuestion } from '@/lib/types/teacher'

interface McqQuestionTypeProps {
  question: TeacherQuestion
  mode: 'preview' | 'attempt' | 'review'
  answer?: TeacherAnswerValue
  onAnswer?: (answer: TeacherAnswerValue) => void
  showExplanation?: boolean
}

const labels = ['A', 'B', 'C', 'D', 'E', 'F']

export function McqQuestionType({
  question,
  mode,
  answer,
  onAnswer,
  showExplanation,
}: McqQuestionTypeProps) {
  const options = question.options ?? []
  const selectedId =
    answer?.type === 'MCQ' ? answer.optionId : undefined
  const correctId =
    question.correctAnswer && 'optionId' in question.correctAnswer
      ? question.correctAnswer.optionId
      : undefined

  return (
    <div className="space-y-3">
      <p className="text-base font-medium">{question.prompt}</p>
      <div className="space-y-2">
        {options.map((option, index) => {
          const isSelected = selectedId === option.id
          const isCorrect = mode === 'review' && option.id === correctId
          const isWrong = mode === 'review' && isSelected && option.id !== correctId

          return (
            <button
              key={option.id}
              type="button"
              disabled={mode !== 'attempt'}
              onClick={() =>
                mode === 'attempt' && onAnswer?.({ type: 'MCQ', optionId: option.id })
              }
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                mode === 'attempt' && 'cursor-pointer hover:border-muted-foreground/30',
                isSelected && mode === 'attempt' && 'border-brand-teal bg-brand-teal/5 ring-1 ring-brand-teal',
                isCorrect && 'border-emerald-500 bg-emerald-50',
                isWrong && 'border-rose-500 bg-rose-50',
                mode !== 'attempt' && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold',
                  isSelected || isCorrect ? 'bg-brand-teal text-white' : 'bg-muted',
                )}
              >
                {labels[index]}
              </span>
              <span className="text-sm">{option.label}</span>
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