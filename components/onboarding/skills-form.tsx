'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { useCompleteOnboarding, useTopics } from '@/lib/hooks/use-onboarding'
import { TopicSelector } from '@/components/shared/TopicSelector'
import { Button } from '@/components/ui/button'

export function SkillsForm() {
  const router = useRouter()
  const { selectedSkills, toggleSkill, removeSkill, displayName, bio, goal, goalTitle, dailyGoalMinutes } =
    useOnboardingStore()
  const completeMutation = useCompleteOnboarding()
  const { data: fetchedTopics } = useTopics()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedSkills.length < 3) {
      toast.error('Please select at least 3 topics')
      return
    }

    try {
      // Save profile, goal, and skills via the multi-step API
      await completeMutation.mutateAsync({
        name: displayName,
        bio: bio || undefined,
        goals: goal ? [goal] : ['build_knowledge'],
        goalTitle: goalTitle || undefined,
        dailyGoalMinutes,
        skillsInterests: selectedSkills,
      })
      // Navigate to education step instead of welcome
      router.push('/onboarding/education')
    } catch {
      toast.error('Something went wrong', {
        description: 'Failed to save your preferences. Please try again.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TopicSelector
        topics={fetchedTopics}
        selectedSlugs={selectedSkills}
        onToggle={toggleSkill}
        onRemove={removeSkill}
        minRequired={3}
        showSearch
        showChips
      />

      {/* Submit */}
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
