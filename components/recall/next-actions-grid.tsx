'use client'

import { useRouter } from 'next/navigation'
import { RotateCcw, RefreshCw, BookOpen, BarChart3 } from 'lucide-react'

interface NextActionsGridProps {
  sessionId: string
  hasFailedQuestions: boolean
}

export function NextActionsGrid({ sessionId: _sessionId, hasFailedQuestions }: NextActionsGridProps) {
  const router = useRouter()

  return (
    <div className="grid grid-cols-2 gap-3">
      <ActionCard
        icon={<RotateCcw className="h-5 w-5 text-brand-blue" />}
        label="Start Another"
        description="New practice session"
        onClick={() => router.push('/recall/start')}
      />
      <ActionCard
        icon={<RefreshCw className="h-5 w-5 text-red-500" />}
        label="Retry Failed"
        description="Practice missed items"
        disabled={!hasFailedQuestions}
        onClick={() => router.push('/recall/start?filter=failed')}
      />
      <ActionCard
        icon={<BookOpen className="h-5 w-5 text-green-500" />}
        label="Capture More"
        description="Add new content"
        onClick={() => router.push('/capture')}
      />
      <ActionCard
        icon={<BarChart3 className="h-5 w-5 text-brand-orange" />}
        label="View Mastery"
        description="See your progress"
        onClick={() => router.push('/mastery')}
      />
    </div>
  )
}

function ActionCard({
  icon,
  label,
  description,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}
