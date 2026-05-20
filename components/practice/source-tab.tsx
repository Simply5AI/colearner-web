'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BookOpen, Loader2, Filter, Clock } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { listExtractions, refreshExtractionMetadata } from '@/lib/api/extraction'
import { ExtractionCard } from '@/components/recall/extraction-card'
import { RecallFilters } from '@/components/recall/recall-filters'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDuration } from '@/lib/utils'
import type { Extraction, ExtractionStatus } from '@/lib/types'

const processingStatuses: ExtractionStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED_PASS1']

const processingLabels: Partial<Record<ExtractionStatus, { label: string; color: string }>> = {
  PENDING: { label: 'Queued', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  PROCESSING: { label: 'Extracting...', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  COMPLETED_PASS1: { label: 'Generating questions...', color: 'bg-purple-50 text-purple-700 border-purple-200' },
}

function ProcessingCard({ extraction }: { extraction: Extraction }) {
  const info = processingLabels[extraction.status] || { label: extraction.status, color: '' }
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {extraction.title || 'Processing capture...'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Started {new Date(extraction.createdAt).toLocaleTimeString()}
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${info.color}`}>
          {info.label}
        </Badge>
      </CardContent>
    </Card>
  )
}

export function SourceTab() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()

  const sourceType = searchParams.get('source') || undefined
  const roadmapId = searchParams.get('roadmap') || undefined
  const subjectId = searchParams.get('subject') || undefined

  // Fetch in-progress extractions (poll every 5s while any exist)
  const { data: processingData } = useQuery({
    queryKey: ['extractions', 'processing'],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      const headers = { Authorization: `Bearer ${session.accessToken}` }
      const results = await Promise.all(
        processingStatuses.map((status) =>
          listExtractions(headers, { status, limit: 20 })
        )
      )
      const all = results.flatMap((r) => r.data)
      // Dedupe by source (videoUrl): if two extractions exist for the same
      // source, keep the most recently created one.
      const bySource = new Map<string, Extraction>()
      for (const e of all) {
        const key = e.videoUrl || e.id
        const prev = bySource.get(key)
        if (!prev || new Date(e.createdAt) > new Date(prev.createdAt)) {
          bySource.set(key, e)
        }
      }
      return Array.from(bySource.values())
    },
    enabled: !!session?.accessToken,
    refetchInterval: (query) => {
      const items = query.state.data
      return items && items.length > 0 ? 5000 : false
    },
  })

  // When processing count drops to 0, refresh completed list
  const prevCount = useRef(0)
  useEffect(() => {
    const count = processingData?.length ?? 0
    if (prevCount.current > 0 && count === 0) {
      queryClient.invalidateQueries({ queryKey: ['extractions', 'completed'] })
    }
    prevCount.current = count
  }, [processingData?.length, queryClient])

  const { data, isLoading } = useQuery({
    queryKey: ['extractions', 'completed', { sourceType, roadmapId, subjectId }],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      const headers = { Authorization: `Bearer ${session.accessToken}` }
      const result = await listExtractions(headers, {
        status: 'COMPLETED',
        limit: 50,
        sourceType,
        roadmapId,
        subjectId,
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
      ['extractions', 'completed', { sourceType, roadmapId, subjectId }],
      (old: typeof data) => old?.filter((e) => e.id !== id)
    )
  }

  const extractions = data || []
  const processingExtractions = processingData || []
  const hasFilters = !!sourceType || !!roadmapId || !!subjectId
  const totalRecallTime = extractions.reduce(
    (sum, e) => sum + (e.totalRecallSeconds ?? 0),
    0,
  )

  return (
    <div>
      {/* Stats summary */}
      {!isLoading && extractions.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{extractions.length}</span> sources
          </span>
          {totalRecallTime > 0 && (
            <span>
              <span className="font-semibold text-foreground">{formatDuration(totalRecallTime)}</span> total study time
            </span>
          )}
        </div>
      )}

      <RecallFilters />

      {/* In-progress captures */}
      {processingExtractions.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Processing ({processingExtractions.length})
            </span>
          </div>
          {processingExtractions.map((extraction) => (
            <ProcessingCard key={extraction.id} extraction={extraction} />
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading extractions...
        </div>
      ) : extractions.length === 0 && processingExtractions.length === 0 ? (
        hasFilters ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Filter className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-1">No matches</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              No captures match the current filters. Try adjusting your source type or study plan.
            </p>
            <Link
              href="/practice"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Clear Filters
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-1">No captures yet</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Add content from YouTube videos, web pages, or documents to start building your library.
            </p>
            <Link
              href="/capture"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Go to Library
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
