'use client'

import { cn } from '@/lib/utils'
import { resolveIcon } from '@/lib/utils/topic-icons'
import { useCaptureStore } from '@/lib/stores/capture-store'
import { useProfile } from '@/lib/hooks/use-profile'
import type { TopicItem } from '@/lib/types'

const FALLBACK_TOPICS: TopicItem[] = [
  { id: 'programming', name: 'Programming', slug: 'programming', icon: 'code' },
  { id: 'ai-ml', name: 'AI & ML', slug: 'ai-ml', icon: 'brain' },
  { id: 'data-science', name: 'Data Science', slug: 'data-science', icon: 'chart-bar' },
  { id: 'design', name: 'Design', slug: 'design', icon: 'palette' },
  { id: 'business', name: 'Business', slug: 'business', icon: 'briefcase' },
  { id: 'science', name: 'Science', slug: 'science', icon: 'flask' },
]

export function CaptureTopicChips() {
  const { data: profile } = useProfile()
  const selectedTopicIds = useCaptureStore((s) => s.selectedTopicIds)
  const toggleTopicId = useCaptureStore((s) => s.toggleTopicId)

  const topics =
    profile?.topics && profile.topics.length > 0
      ? profile.topics
      : FALLBACK_TOPICS

  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Topics (optional)
      </div>
      <div className="flex flex-wrap gap-1.5">
        {topics.map((topic) => {
          const isSelected = selectedTopicIds.includes(topic.id)
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => toggleTopicId(topic.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                isSelected
                  ? 'border-brand-orange bg-brand-orange/5 text-brand-orange'
                  : 'border-border text-foreground/70 hover:border-brand-orange/40'
              )}
            >
              <span className="text-xs">{resolveIcon(topic.icon)}</span>
              {topic.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
