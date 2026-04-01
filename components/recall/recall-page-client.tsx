'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BookOpen, Loader2, Filter } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { listExtractions, refreshExtractionMetadata } from '@/lib/api/extraction'
import { ExtractionCard } from '@/components/recall/extraction-card'
import { RecallFilters } from '@/components/recall/recall-filters'
import { formatDuration } from '@/lib/utils'

function RecallPageInner() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()

  const topicSlug = searchParams.get('topic') || undefined
  const sourceType = searchParams.get('source') || undefined

  const { data, isLoading } = useQuery({
    queryKey: ['extractions', 'completed', { topicSlug, sourceType }],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      const headers = { Authorization: `Bearer ${session.accessToken}` }
      const result = await listExtractions(headers, {
        status: 'COMPLETED',
        limit: 50,
        topicSlug,
        sourceType,
      })

      // Auto-refresh metadata for extractions missing titles
      const needsRefresh = result.data.filter((e) => !e.title)
      if (needsRefresh.length > 0) {
        const refreshed = await Promise.allSettled(
          needsRefresh.map((e) => refreshExtractionMetadata(headers, e.id))
        )
        refreshed.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            const target = needsRefresh[i]
            if (target) {
              const idx = result.data.findIndex((e) => e.id === target.id)
              if (idx !== -1) result.data[idx] = r.value
            }
          }
        })
      }

      return result.data
    },
    enabled: !!session?.accessToken,
  })

  function handleDeleted(id: string) {
    queryClient.setQueryData(
      ['extractions', 'completed', { topicSlug, sourceType }],
      (old: typeof data) => old?.filter((e) => e.id !== id)
    )
  }

  const extractions = data || []
  const hasFilters = !!topicSlug || !!sourceType
  const totalRecallTime = extractions.reduce(
    (sum, e) => sum + (e.totalRecallSeconds ?? 0),
    0,
  )
  const topicCount = new Set(
    extractions.flatMap((e) => e.topics?.map((t) => t.topic.slug) ?? []),
  ).size

  return (
    <div className="p-7">
      {/* Stats summary */}
      {!isLoading && extractions.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{extractions.length}</span> sources
          </span>
          {topicCount > 0 && (
            <span>
              <span className="font-semibold text-foreground">{topicCount}</span> topics
            </span>
          )}
          {totalRecallTime > 0 && (
            <span>
              <span className="font-semibold text-foreground">{formatDuration(totalRecallTime)}</span> total study time
            </span>
          )}
        </div>
      )}

      <RecallFilters />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading extractions...
        </div>
      ) : extractions.length === 0 ? (
        hasFilters ? (
          // No results for current filter
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Filter className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-1">No matches</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              No captures match the current filters. Try adjusting your topic or source type selection.
            </p>
            <Link
              href="/recall"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Clear Filters
            </Link>
          </div>
        ) : (
          // No captures at all
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-1">No captures yet</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Capture content from YouTube videos, web pages, or documents to start building your recall library.
            </p>
            <Link
              href="/capture"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Go to Capture
            </Link>
          </div>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {extractions.map((extraction) => (
            <ExtractionCard
              key={extraction.id}
              extraction={extraction}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function RecallPageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      }
    >
      <RecallPageInner />
    </Suspense>
  )
}
