'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { resolveIcon } from '@/lib/utils/topic-icons'
import type { TopicItem } from '@/lib/types'

// Fallback topics if dynamic fetch fails
const FALLBACK_TOPICS: TopicItem[] = [
  { id: 'programming', name: 'Programming', slug: 'programming', icon: 'code' },
  { id: 'ai-ml', name: 'AI & ML', slug: 'ai-ml', icon: 'brain' },
  { id: 'data-science', name: 'Data Science', slug: 'data-science', icon: 'chart-bar' },
  { id: 'design', name: 'Design', slug: 'design', icon: 'palette' },
  { id: 'business', name: 'Business', slug: 'business', icon: 'briefcase' },
  { id: 'science', name: 'Science', slug: 'science', icon: 'flask' },
  { id: 'literature', name: 'Literature', slug: 'literature', icon: 'book-open' },
  { id: 'history', name: 'History', slug: 'history', icon: 'landmark' },
  { id: 'mathematics', name: 'Mathematics', slug: 'mathematics', icon: 'calculator' },
  { id: 'languages', name: 'Languages', slug: 'languages', icon: 'globe' },
  { id: 'music', name: 'Music', slug: 'music', icon: 'music' },
  { id: 'health', name: 'Health', slug: 'health', icon: 'heart-pulse' },
]

interface TopicSelectorProps {
  topics?: TopicItem[]
  selectedSlugs: string[]
  onToggle: (slug: string) => void
  onRemove?: (slug: string) => void
  minRequired?: number
  showSearch?: boolean
  showChips?: boolean
  className?: string
}

export function TopicSelector({
  topics,
  selectedSlugs,
  onToggle,
  onRemove,
  minRequired = 0,
  showSearch = true,
  showChips = true,
  className,
}: TopicSelectorProps) {
  const [search, setSearch] = useState('')
  const allTopics = topics && topics.length > 0 ? topics : FALLBACK_TOPICS

  const filteredTopics = allTopics.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Selected chips */}
      {showChips && selectedSlugs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedSlugs.map((slug) => {
            const topic = allTopics.find((t) => t.slug === slug)
            if (!topic) return null
            return (
              <span
                key={slug}
                className="flex items-center gap-1.5 rounded-full bg-brand-orange/10 px-3 py-1.5 text-[11px] font-semibold text-brand-orange"
              >
                {resolveIcon(topic.icon)} {topic.name}
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(slug)}
                    className="opacity-50 transition-opacity hover:opacity-100"
                    aria-label={`Remove ${topic.name}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {/* Search */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topics..."
            className="h-11 pl-11"
          />
        </div>
      )}

      {/* Topic grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {filteredTopics.map((topic) => {
          const isSelected = selectedSlugs.includes(topic.slug)
          return (
            <button
              key={topic.slug}
              type="button"
              onClick={() => onToggle(topic.slug)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border-2 px-3 py-3 text-left text-sm font-medium transition-all min-w-0',
                isSelected
                  ? 'border-brand-orange bg-brand-orange/5 text-brand-orange shadow-[0_0_0_1px_rgba(196,98,26,0.1)]'
                  : 'border-border bg-background text-foreground hover:border-brand-orange/40 hover:bg-muted/50'
              )}
            >
              <span className="text-lg shrink-0">{resolveIcon(topic.icon)}</span>
              <span className="truncate">{topic.name}</span>
            </button>
          )
        })}
      </div>

      {/* Counter */}
      {minRequired > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          <strong
            className={cn(
              'font-bold',
              selectedSlugs.length >= minRequired && 'text-brand-orange'
            )}
          >
            {selectedSlugs.length}
          </strong>{' '}
          of {minRequired}+ topics selected
          {selectedSlugs.length >= minRequired && ' \u2014 Great variety!'}
        </p>
      )}
    </div>
  )
}
