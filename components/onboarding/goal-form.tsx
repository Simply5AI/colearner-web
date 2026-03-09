'use client'

import { useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { GoalCard } from '@/components/onboarding/goal-card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { LearningGoal } from '@/lib/types'

const GOALS: { id: LearningGoal; emoji: string; name: string; description: string }[] = [
  { id: 'build_knowledge', emoji: '\u{1F4DA}', name: 'Build Knowledge', description: 'Deepen understanding' },
  { id: 'retain_more', emoji: '\u{1F9E0}', name: 'Retain More', description: 'Remember everything' },
  { id: 'exam_prep', emoji: '\u{1F3AF}', name: 'Exam Prep', description: 'Ace your tests' },
  { id: 'career_growth', emoji: '\u{1F4BC}', name: 'Career Growth', description: 'Level up professionally' },
]

const TIME_OPTIONS = [5, 15, 30, 60] as const

function formatTime(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60} hour` : `${minutes} min`
}

export function GoalForm() {
  const router = useRouter()
  const { goal, dailyGoalMinutes, setGoal, setDailyGoalMinutes } = useOnboardingStore()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push('/onboarding/skills')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GOALS.map((g) => (
          <GoalCard
            key={g.id}
            emoji={g.emoji}
            name={g.name}
            description={g.description}
            isSelected={goal === g.id}
            onClick={() => setGoal(g.id)}
          />
        ))}
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs font-semibold">How much time per day?</Label>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setDailyGoalMinutes(minutes)}
              className={cn(
                'rounded-full border-[1.5px] px-5 py-2.5 text-[13px] font-semibold transition-all duration-200',
                dailyGoalMinutes === minutes
                  ? 'border-brand-orange bg-brand-orange text-white'
                  : 'border-border bg-background text-muted-foreground hover:border-brand-orange/50'
              )}
            >
              {formatTime(minutes)}
            </button>
          ))}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-12 text-sm font-bold bg-brand-orange hover:bg-brand-orange-dark text-white shadow-[0_2px_8px_rgba(196,98,26,0.2)]"
      >
        Continue &rarr;
      </Button>
    </form>
  )
}
