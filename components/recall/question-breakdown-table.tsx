'use client'

import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import type { SessionQuestionResult } from '@/lib/types'

interface QuestionBreakdownTableProps {
  results: SessionQuestionResult[]
}

export function QuestionBreakdownTable({ results }: QuestionBreakdownTableProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b">
        <h2 className="text-lg font-semibold">Question Breakdown</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">#</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Concept</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Score</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Result</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Interval</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.questionId} className="border-b last:border-0">
                <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
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
            ))}
          </tbody>
        </table>
      </div>
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
