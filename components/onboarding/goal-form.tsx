'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { useCompleteOnboarding } from '@/lib/hooks/use-onboarding'
import { GoalCard } from '@/components/onboarding/goal-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { LearningGoal } from '@/lib/types'

const GOALS: { id: LearningGoal; emoji: string; name: string; description: string }[] = [
  { id: 'build_knowledge', emoji: '\u{1F4DA}', name: 'Build Knowledge', description: 'Deepen understanding' },
  { id: 'retain_more', emoji: '\u{1F9E0}', name: 'Retain More', description: 'Remember everything' },
  { id: 'exam_prep', emoji: '\u{1F3AF}', name: 'Exam Prep', description: 'Ace your tests' },
  { id: 'career_growth', emoji: '\u{1F4BC}', name: 'Career Growth', description: 'Level up professionally' },
]

export function GoalForm() {
  const router = useRouter()
  const { goal, goalTitle, displayName, bio, setGoal, setGoalTitle } = useOnboardingStore()
  const completeMutation = useCompleteOnboarding()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await completeMutation.mutateAsync({
        name: displayName,
        bio: bio || undefined,
        goals: goal ? [goal] : ['build_knowledge'],
        goalTitle: goalTitle || undefined,
      })
      router.push('/onboarding/education')
    } catch {
      toast.error('Something went wrong', {
        description: 'Failed to save your preferences. Please try again.',
      })
    }
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
        <Label htmlFor="goalTitle" className="text-xs font-semibold">
          What specifically do you want to master? (optional)
        </Label>
        <Input
          id="goalTitle"
          placeholder="e.g., Master .NET Core, Learn Docker, Pass AWS Certification"
          value={goalTitle}
          onChange={(e) => setGoalTitle(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        disabled={completeMutation.isPending}
        className="w-full h-12 text-sm font-bold bg-brand-orange hover:bg-brand-orange-dark text-white shadow-[0_2px_8px_rgba(196,98,26,0.2)]"
      >
        {completeMutation.isPending ? 'Saving...' : 'Continue \u2192'}
      </Button>
    </form>
  )
}
