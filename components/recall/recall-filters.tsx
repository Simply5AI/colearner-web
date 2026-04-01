'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { Youtube, Globe, FileText, Headphones, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveIcon } from '@/lib/utils/topic-icons'
import { getExtractionTopics } from '@/lib/api/extraction'
import type { TopicItem } from '@/lib/types'

const SOURCE_TYPES = [
  { value: 'YOUTUBE', label: 'YouTube', icon: <Youtube className="h-3 w-3" /> },
  { value: 'WEB', label: 'Web', icon: <Globe className="h-3 w-3" /> },
  { value: 'DOCUMENT', label: 'Docs', icon: <FileText className="h-3 w-3" /> },
  { value: 'AUDIO', label: 'Audio', icon: <Headphones className="h-3 w-3" /> },
  { value: 'VIDEO', label: 'Video', icon: <Video className="h-3 w-3" /> },
]

export function RecallFilters() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeTopic = searchParams.get('topic') || ''
  const activeSource = searchParams.get('source') || ''

  const { data: topics = [] } = useQuery<TopicItem[]>({
    queryKey: ['extractions', 'topics'],
    queryFn: async () => {
      if (!session?.accessToken) return []
      return getExtractionTopics({ Authorization: `Bearer ${session.accessToken}` })
    },
    enabled: !!session?.accessToken,
  })

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const hasTopics = topics.length > 0

  return (
    <div className="space-y-2.5 mb-5">
      {/* Topic filters */}
      {hasTopics && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('topic', '')}
            className={cn(
              'rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
              !activeTopic
                ? 'bg-brand-orange text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            All Topics
          </button>
          {topics.map((topic) => (
            <button
              key={topic.slug}
              onClick={() => setFilter('topic', activeTopic === topic.slug ? '' : topic.slug)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                activeTopic === topic.slug
                  ? 'bg-brand-orange text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              <span className="text-xs">{resolveIcon(topic.icon)}</span>
              {topic.name}
            </button>
          ))}
        </div>
      )}

      {/* Source type filters */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter('source', '')}
          className={cn(
            'rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
            !activeSource
              ? 'bg-foreground/10 text-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          All Sources
        </button>
        {SOURCE_TYPES.map((st) => (
          <button
            key={st.value}
            onClick={() => setFilter('source', activeSource === st.value ? '' : st.value)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
              activeSource === st.value
                ? 'bg-foreground/10 text-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {st.icon}
            {st.label}
          </button>
        ))}
      </div>
    </div>
  )
}
