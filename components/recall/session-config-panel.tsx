'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings2,
  Play,
  RotateCcw,
  Loader2,
  Compass,
  Flag,
  Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createRecallSession } from '@/lib/api/recall'
import type { SessionQuestionTypeFilter, SessionOrder, DifficultyLevel } from '@/lib/types'

interface SessionConfigPanelProps {
  extractionId: string
  authHeaders: Record<string, string>
  selectedConceptIds: string[]
  conceptCount: number
}

const questionTypeOptions: { value: SessionQuestionTypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All Types (Mixed)' },
  { value: 'FREE_TEXT', label: 'Open Answer Only' },
  { value: 'MULTIPLE_CHOICE', label: 'MCQ Only' },
  { value: 'CLOZE', label: 'Cloze Only' },
  { value: 'TRUE_FALSE', label: 'True/False Only' },
]

const orderOptions: { value: SessionOrder; label: string }[] = [
  { value: 'sm2', label: 'Smart Order (Due First)' },
  { value: 'failed_first', label: 'Failed Items First' },
  { value: 'random', label: 'Random Shuffle' },
  { value: 'newest', label: 'Newest Concepts First' },
]

const timerOptions: { value: number; label: string }[] = [
  { value: 0, label: 'No Timer' },
  { value: 30, label: '30s per question' },
  { value: 60, label: '60s per question' },
  { value: 90, label: '90s per question' },
]

const questionCountOptions = [5, 10, 15, 20]

const difficultyLevels: Array<{
  id: DifficultyLevel
  label: string
  icon: typeof Compass
  activeClass: string
  questionsPerConcept: number
}> = [
  { id: 'beginner', label: 'Beginner', icon: Compass, activeClass: 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400', questionsPerConcept: 2 },
  { id: 'intermediate', label: 'Intermediate', icon: Flag, activeClass: 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400', questionsPerConcept: 2 },
  { id: 'master', label: 'Master', icon: Trophy, activeClass: 'border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', questionsPerConcept: 3 },
]

export function SessionConfigPanel({ extractionId, authHeaders, selectedConceptIds, conceptCount }: SessionConfigPanelProps) {
  const router = useRouter()
  const [questionType, setQuestionType] = useState<SessionQuestionTypeFilter>('ALL')
  const [order, setOrder] = useState<SessionOrder>('sm2')
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('beginner')
  const [questionCount, setQuestionCount] = useState(10)
  const [isStarting, setIsStarting] = useState(false)

  const selectedCount = selectedConceptIds.length
  const currentDifficulty = difficultyLevels.find((d) => d.id === difficultyLevel)!
  const maxQuestions = selectedCount * currentDifficulty.questionsPerConcept
  const effectiveQuestionCount = Math.min(questionCount, maxQuestions)

  const questionTypeLabel = questionTypeOptions.find((o) => o.value === questionType)?.label ?? 'Mixed'
  const difficultyLabel = currentDifficulty.label

  function handleReset() {
    setQuestionType('ALL')
    setOrder('sm2')
    setTimerSeconds(0)
    setDifficultyLevel('beginner')
    setQuestionCount(10)
  }

  async function handleStart() {
    if (isStarting || selectedCount === 0) return
    setIsStarting(true)

    try {
      const session = await createRecallSession(authHeaders, {
        extractionId,
        questionCount: effectiveQuestionCount,
        questionType: questionType === 'ALL' ? undefined : questionType,
        order,
        timerSeconds: timerSeconds || undefined,
        difficultyLevel,
        conceptIds: selectedConceptIds,
      })
      router.push(`/recall/${session.id}`)
    } catch {
      setIsStarting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-2 text-sm font-extrabold text-foreground">
        <Settings2 className="h-[18px] w-[18px] text-brand-orange" />
        Session Configuration
      </div>

      {/* Config dropdowns */}
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <ConfigSelect
          label="Question Types"
          value={questionType}
          onChange={(v) => setQuestionType(v as SessionQuestionTypeFilter)}
          options={questionTypeOptions}
        />
        <ConfigSelect
          label="Questions"
          value={String(questionCount)}
          onChange={(v) => setQuestionCount(Number(v))}
          options={questionCountOptions.map((n) => ({ value: String(n), label: `${n} questions` }))}
        />
        <ConfigSelect
          label="Order"
          value={order}
          onChange={(v) => setOrder(v as SessionOrder)}
          options={orderOptions}
        />
        <ConfigSelect
          label="Timer"
          value={String(timerSeconds)}
          onChange={(v) => setTimerSeconds(Number(v))}
          options={timerOptions.map((o) => ({ value: String(o.value), label: o.label }))}
        />
      </div>

      {/* Difficulty Level Pills */}
      <div className="mb-5">
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Difficulty Level
        </label>
        <div className="flex flex-wrap gap-2">
          {difficultyLevels.map((level) => {
            const Icon = level.icon
            const isActive = difficultyLevel === level.id
            return (
              <button
                key={level.id}
                onClick={() => setDifficultyLevel(level.id)}
                className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-4 py-2 text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? level.activeClass
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {level.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">{selectedCount}/{conceptCount} concepts</strong> selected
          {' '}&middot; {effectiveQuestionCount} questions will be generated
          {' '}&middot; {difficultyLabel}
        </p>
        <div className="flex gap-2.5">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            className="bg-brand-orange hover:bg-brand-orange/90 text-white shadow-md"
            onClick={handleStart}
            disabled={isStarting || selectedCount === 0}
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Generating questions...
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-4 w-4" />
                Start Practice Session
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConfigSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border-[1.5px] border-border bg-card px-3.5 py-2.5 text-[13px] font-medium text-foreground outline-none transition-colors focus:border-brand-orange bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23A8A29E%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center] pr-8"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
