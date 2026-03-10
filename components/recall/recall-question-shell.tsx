'use client'

import { PenLine, CheckSquare, Braces, FileQuestion, Lightbulb } from 'lucide-react'
import type { QuestionType } from '@/lib/types'

interface RecallQuestionShellProps {
  type: QuestionType
  conceptTitle: string
  hint?: string
  hintVisible: boolean
  onToggleHint: () => void
  children: React.ReactNode
}

const typeConfig: Record<QuestionType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  MULTIPLE_CHOICE: {
    label: 'Multiple Choice',
    icon: <CheckSquare className="h-3.5 w-3.5" />,
    color: 'text-brand-blue',
    bg: 'bg-brand-blue/10',
  },
  FREE_TEXT: {
    label: 'Open Answer',
    icon: <PenLine className="h-3.5 w-3.5" />,
    color: 'text-brand-orange',
    bg: 'bg-brand-orange/10',
  },
  TRUE_FALSE: {
    label: 'True / False',
    icon: <FileQuestion className="h-3.5 w-3.5" />,
    color: 'text-brand-purple',
    bg: 'bg-brand-purple/10',
  },
  CLOZE: {
    label: 'Fill in the Blanks',
    icon: <Braces className="h-3.5 w-3.5" />,
    color: 'text-brand-teal',
    bg: 'bg-brand-teal/10',
  },
}

export function RecallQuestionShell({
  type,
  conceptTitle,
  hint,
  hintVisible,
  onToggleHint,
  children,
}: RecallQuestionShellProps) {
  const config = typeConfig[type] || typeConfig.FREE_TEXT

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
            {config.icon}
            {config.label}
          </span>
          <span className="text-sm text-muted-foreground">{conceptTitle}</span>
        </div>

        {hint && (
          <button
            onClick={onToggleHint}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            {hintVisible ? 'Hide hint' : 'Show hint'}
          </button>
        )}
      </div>

      {hintVisible && hint && (
        <div className="mx-5 mt-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <Lightbulb className="inline h-3.5 w-3.5 mr-1" />
            {hint}
          </p>
        </div>
      )}

      <div className="p-5">{children}</div>
    </div>
  )
}
