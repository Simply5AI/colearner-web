import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { listExtractions, refreshExtractionMetadata } from '@/lib/api/extraction'
import { ApiError } from '@/lib/api/client'
import { TopBar } from '@/components/shared/TopBar'
import { ExtractionCard } from '@/components/recall/extraction-card'

export const metadata: Metadata = {
  title: 'Recall',
}

export default async function RecallPage() {
  const headers = await getAuthHeaders()

  let extractions
  try {
    extractions = await listExtractions(headers, { status: 'COMPLETED', limit: 50 })
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/api/auth/force-signout')
    }
    throw err
  }

  // Auto-refresh metadata for extractions missing titles (backfill from YouTube oEmbed)
  const needsRefresh = extractions.data.filter((e) => !e.title)
  if (needsRefresh.length > 0) {
    const refreshed = await Promise.allSettled(
      needsRefresh.map((e) => refreshExtractionMetadata(headers, e.id))
    )
    refreshed.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        const target = needsRefresh[i]
        if (target) {
          const idx = extractions.data.findIndex((e) => e.id === target.id)
          if (idx !== -1) extractions.data[idx] = result.value
        }
      }
    })
  }

  return (
    <>
      <TopBar title="Recall" subtitle="Choose a source to start your recall session" />
      <div className="p-7">
        {extractions.data.length === 0 ? (
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
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extractions.data.map((extraction) => (
              <ExtractionCard key={extraction.id} extraction={extraction} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
