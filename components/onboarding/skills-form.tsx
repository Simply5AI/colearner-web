'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { toast } from 'sonner'

import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { useCompleteOnboarding } from '@/lib/hooks/use-onboarding'
import { TopicCard } from '@/components/onboarding/topic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const TOPICS = [
  { id: 'programming', emoji: '\u{1F4BB}', name: 'Programming' },
  { id: 'ai_ml', emoji: '\u{1F916}', name: 'AI & ML' },
  { id: 'data_science', emoji: '\u{1F4CA}', name: 'Data Science' },
  { id: 'design', emoji: '\u{1F3A8}', name: 'Design' },
  { id: 'business', emoji: '\u{1F4C8}', name: 'Business' },
  { id: 'science', emoji: '\u{1F9EC}', name: 'Science' },
  { id: 'literature', emoji: '\u{1F4D6}', name: 'Literature' },
  { id: 'history', emoji: '\u{1F30D}', name: 'History' },
  { id: 'mathematics', emoji: '\u{1F9EE}', name: 'Mathematics' },
  { id: 'languages', emoji: '\u{1F5E3}\u{FE0F}', name: 'Languages' },
  { id: 'music', emoji: '\u{1F3B5}', name: 'Music' },
  { id: 'health', emoji: '\u{1F3E5}', name: 'Health' },
] as const

export function SkillsForm() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const { selectedSkills, toggleSkill, removeSkill, displayName, bio, goal, dailyGoalMinutes } =
    useOnboardingStore()
  const completeMutation = useCompleteOnboarding()

  const filteredTopics = TOPICS.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedSkills.length < 3) {
      toast.error('Please select at least 3 topics')
      return
    }

    try {
      await completeMutation.mutateAsync({
        name: displayName,
        bio: bio || undefined,
        goals: goal ? [goal] : ['build_knowledge'],
        dailyGoalMinutes,
        skillsInterests: selectedSkills,
      })
      router.push('/onboarding/welcome')
    } catch {
      toast.error('Something went wrong', {
        description: 'Failed to save your preferences. Please try again.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Selected chips bar */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedSkills.map((skillId) => {
            const topic = TOPICS.find((t) => t.id === skillId)
            if (!topic) return null
            return (
              <span
                key={skillId}
                className="flex items-center gap-1.5 rounded-full bg-brand-orange/10 px-3 py-1.5 text-[11px] font-semibold text-brand-orange"
              >
                {topic.emoji} {topic.name}
                <button
                  type="button"
                  onClick={() => removeSkill(skillId)}
                  className="opacity-50 transition-opacity hover:opacity-100"
                  aria-label={`Remove ${topic.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search topics..."
          className="h-11 pl-11"
        />
      </div>

      {/* Topic grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {filteredTopics.map((topic) => (
          <TopicCard
            key={topic.id}
            emoji={topic.emoji}
            name={topic.name}
            isSelected={selectedSkills.includes(topic.id)}
            onClick={() => toggleSkill(topic.id)}
          />
        ))}
      </div>

      {/* Counter */}
      <p className="text-center text-xs text-muted-foreground">
        <strong className={cn('font-bold', selectedSkills.length >= 3 && 'text-brand-orange')}>
          {selectedSkills.length}
        </strong>{' '}
        of 3+ topics selected
        {selectedSkills.length >= 3 && ' — Great variety!'}
      </p>

      {/* Submit */}
      <Button
        type="submit"
        disabled={completeMutation.isPending}
        className="w-full h-12 text-sm font-bold bg-brand-orange hover:bg-brand-orange-dark text-white shadow-[0_2px_8px_rgba(196,98,26,0.2)]"
      >
        {completeMutation.isPending ? 'Saving...' : 'Complete Setup \u2192'}
      </Button>
    </form>
  )
}
