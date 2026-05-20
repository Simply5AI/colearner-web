'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { Youtube, Globe, FileText, Headphones, Video, Map, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getExtractionRoadmaps } from '@/lib/api/extraction'
import { useProfile } from '@/lib/hooks/use-profile'

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

  const activeSource = searchParams.get('source') || ''
  const activeRoadmap = searchParams.get('roadmap') || ''
  const activeSubject = searchParams.get('subject') || ''
  const { data: profile } = useProfile()
  const isStudent = profile?.learnerType === 'STUDENT'
  const subjects = profile?.subjects ?? []

  const { data: roadmaps = [] } = useQuery<{ id: string; title: string; status: string }[]>({
    queryKey: ['extractions', 'roadmaps'],
    queryFn: async () => {
      if (!session?.accessToken) return []
      return getExtractionRoadmaps({ Authorization: `Bearer ${session.accessToken}` })
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

  return (
    <div className="space-y-2.5 mb-5">
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

      {/* Study plan filters */}
      {!isStudent && roadmaps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('roadmap', '')}
            className={cn(
              'rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
              !activeRoadmap
                ? 'bg-brand-orange/15 text-brand-orange'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            All Study Plans
          </button>
          {roadmaps.map((rm) => (
            <button
              key={rm.id}
              onClick={() => setFilter('roadmap', activeRoadmap === rm.id ? '' : rm.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                activeRoadmap === rm.id
                  ? 'bg-brand-orange/15 text-brand-orange'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              <Map className="h-3 w-3" />
              {rm.title}
            </button>
          ))}
        </div>
      )}

      {isStudent && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('subject', '')}
            className={cn(
              'rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
              !activeSubject
                ? 'bg-brand-orange/15 text-brand-orange'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            All Captures
          </button>
          {subjects.map((subject) => (
            <button
              key={subject.id}
              onClick={() => setFilter('subject', activeSubject === subject.id ? '' : subject.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                activeSubject === subject.id
                  ? 'bg-brand-orange/15 text-brand-orange'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              <BookOpen className="h-3 w-3" />
              {subject.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
