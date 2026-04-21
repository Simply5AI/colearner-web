'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SessionQuestionResult } from '@/lib/types'

interface QuestionBreakdownTableProps {
  results: SessionQuestionResult[]
}

export function QuestionBreakdownTable({ results }: QuestionBreakdownTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const allExpanded = results.length > 0 && expandedIds.size === results.length

  function toggleQuestion(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll() {
    if (allExpanded) {
      setExpandedIds(new Set())
    } else {
      setExpandedIds(new Set(results.map((r) => r.questionId)))
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <h2 className="text-lg font-semibold">Question Breakdown</h2>
        <button
          onClick={toggleAll}
          className="text-xs font-medium text-primary hover:underline"
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="w-8 px-4 py-2" />
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">#</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Concept</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Score</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Result</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Next In</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const isExpanded = expandedIds.has(r.questionId)
              return (
                <QuestionRow
                  key={r.questionId}
                  result={r}
                  index={i}
                  isExpanded={isExpanded}
                  onToggle={() => toggleQuestion(r.questionId)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QuestionRow({
  result: r,
  index,
  isExpanded,
  onToggle,
}: {
  result: SessionQuestionResult
  index: number
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className={cn(
          'cursor-pointer transition-colors hover:bg-accent/50',
          isExpanded ? 'bg-accent/30' : '',
          !isExpanded && 'border-b last:border-0',
        )}
        onClick={onToggle}
      >
        <td className="px-4 py-2.5 text-muted-foreground">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </td>
        <td className="px-4 py-2.5 text-muted-foreground">{index + 1}</td>
        <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">
          {r.conceptTitle}
        </td>
        <td className="px-4 py-2.5">
          <TypeBadge type={r.questionType} />
        </td>
        <td className="px-4 py-2.5 text-center font-medium">
          {r.skipped ? '—' : `${r.score}/10`}
        </td>
        <td className="px-4 py-2.5 text-center">
          {r.skipped ? (
            <MinusCircle className="inline h-4 w-4 text-muted-foreground" />
          ) : r.isCorrect ? (
            <CheckCircle2 className="inline h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="inline h-4 w-4 text-red-500" />
          )}
        </td>
        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
          {r.currentInterval === 0 ? 'new' : `${r.currentInterval}d`}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b last:border-0">
          <td colSpan={7} className="px-5 pb-4 pt-1">
            <ExpandedDetail result={r} />
          </td>
        </tr>
      )}
    </>
  )
}

function ExpandedDetail({ result: r }: { result: SessionQuestionResult }) {
  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-4">
      {/* Question */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          Question
        </p>
        <p className="text-sm text-foreground">{r.questionText}</p>
      </div>

      {/* Answer details by type */}
      {r.questionType === 'MULTIPLE_CHOICE' && <MCQDetail result={r} />}
      {r.questionType === 'TRUE_FALSE' && <TrueFalseDetail result={r} />}
      {r.questionType === 'FREE_TEXT' && <FreeTextDetail result={r} />}
      {r.questionType === 'CLOZE' && <ClozeDetail result={r} />}

      {/* Explanation */}
      {r.explanation && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Explanation
          </p>
          <p className="text-sm text-muted-foreground">{r.explanation}</p>
        </div>
      )}

      {/* Feedback */}
      {r.feedback && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Feedback
          </p>
          <p className="text-sm text-muted-foreground">{r.feedback}</p>
        </div>
      )}
    </div>
  )
}

function MCQDetail({ result: r }: { result: SessionQuestionResult }) {
  const options = (r.options as string[] | null) ?? []
  const correctIdx = r.correctIndex ?? -1
  const userAnswer = r.userAnswer

  // Find user's selected index
  let userIdx = -1
  if (userAnswer != null) {
    const parsed = parseInt(userAnswer, 10)
    if (!isNaN(parsed)) {
      userIdx = parsed
    } else {
      // User answer might be the text of the option
      userIdx = options.findIndex(
        (opt) => opt.toLowerCase().trim() === userAnswer.toLowerCase().trim(),
      )
    }
  }

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Options
      </p>
      <div className="space-y-1.5">
        {options.map((opt, idx) => {
          const isCorrect = idx === correctIdx
          const isUserChoice = idx === userIdx
          const isWrongChoice = isUserChoice && !isCorrect

          return (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm',
                isCorrect
                  ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                  : isWrongChoice
                    ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                    : 'border-border/50 bg-card',
              )}
            >
              <span className="mt-0.5 shrink-0 text-xs font-bold text-muted-foreground">
                {String.fromCharCode(65 + idx)}.
              </span>
              <span className="flex-1">{opt}</span>
              {isCorrect && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              )}
              {isWrongChoice && (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              )}
              {isUserChoice && !isWrongChoice && (
                <span className="mt-0.5 text-[10px] font-bold text-green-600">Your answer</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrueFalseDetail({ result: r }: { result: SessionQuestionResult }) {
  const correctAnswer = r.correctIndex === 0 ? 'True' : 'False'
  const userAnswer = r.userAnswer ?? 'Not answered'

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          Your Answer
        </p>
        <p
          className={cn(
            'text-sm font-medium rounded-md border px-3 py-2',
            r.isCorrect
              ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400'
              : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400',
          )}
        >
          {userAnswer}
        </p>
      </div>
      {!r.isCorrect && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Correct Answer
          </p>
          <p className="text-sm font-medium rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
            {correctAnswer}
          </p>
        </div>
      )}
    </div>
  )
}

function FreeTextDetail({ result: r }: { result: SessionQuestionResult }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          Your Answer
        </p>
        <p
          className={cn(
            'text-sm rounded-md border px-3 py-2',
            r.isCorrect
              ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
              : 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
          )}
        >
          {r.userAnswer || 'Not answered'}
        </p>
      </div>
    </div>
  )
}

function ClozeDetail({ result: r }: { result: SessionQuestionResult }) {
  const clozeAnswers = (r.clozeAnswers as string[] | null) ?? []
  const userAnswer = r.userAnswer ?? ''

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          Your Answer
        </p>
        <p
          className={cn(
            'text-sm rounded-md border px-3 py-2',
            r.isCorrect
              ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
              : 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
          )}
        >
          {userAnswer || 'Not answered'}
        </p>
      </div>
      {!r.isCorrect && clozeAnswers.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Correct Answer{clozeAnswers.length > 1 ? 's' : ''}
          </p>
          <p className="text-sm font-medium rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
            {clozeAnswers.join(', ')}
          </p>
        </div>
      )}
      {r.clozeTemplate && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Template
          </p>
          <p className="text-sm text-muted-foreground italic">{r.clozeTemplate}</p>
        </div>
      )}
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    MULTIPLE_CHOICE: 'MCQ',
    FREE_TEXT: 'Open',
    TRUE_FALSE: 'T/F',
    CLOZE: 'Fill',
  }

  return (
    <span className="inline-flex rounded px-1.5 py-0.5 text-xs bg-muted">
      {labels[type] || type}
    </span>
  )
}
