'use client'

import { cn } from '@/lib/utils'
import type { TeacherAnswerValue, TeacherQuestion } from '@/lib/types/teacher'

interface MultiSelectQuestionTypeProps {
  question: TeacherQuestion
  mode: 'preview' | 'attempt' | 'review'
  answer?: TeacherAnswerValue
  onAnswer?: (answer: TeacherAnswerValue) => void
  showExplanation?: boolean
}

export function MultiSelectQuestionType({
  question,
  mode,
  answer,
  onAnswer,
  showExplanation,
}: MultiSelectQuestionTypeProps) {
  const options = question.options ?? []
  const selectedIds =
    answer?.type === 'MULTI_SELECT' ? answer.optionIds : []
  const correctIds =
    question.correctAnswer && 'optionIds' in question.correctAnswer
      ? question.correctAnswer.optionIds
      : []

  function toggle(optionId: string) {
    if (mode !== 'attempt') return
    const next = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId]
    onAnswer?.({ type: 'MULTI_SELECT', optionIds: next })
  }

  return (
    <div className="space-y-3">
      <p className="text-base font-medium">{question.prompt}</p>
      <p className="text-xs text-muted-foreground">Select all that apply</p>
      <div className="space-y-2">
        {options.map((option) => {
          const isSelected = selectedIds.includes(option.id)
          const isCorrect = mode === 'review' && correctIds.includes(option.id)
          const isWrong =
            mode === 'review' && isSelected && !correctIds.includes(option.id)

          return (
            <button
              key={option.id}
              type="button"
              disabled={mode !== 'attempt'}
              aria-pressed={isSelected}
              onClick={() => toggle(option.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
                mode === 'attempt' && 'cursor-pointer hover:border-muted-foreground/30',
                isSelected && mode === 'attempt' && 'border-brand-teal bg-brand-teal/5 ring-1 ring-brand-teal',
                isCorrect && 'border-emerald-500 bg-emerald-50',
                isWrong && 'border-rose-500 bg-rose-50',
                mode !== 'attempt' && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs',
                  isSelected ? 'border-brand-teal bg-brand-teal text-white' : 'bg-background',
                )}
              >
                {isSelected ? '✓' : ''}
              </span>
              <span>{option.label}</span>
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