import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getQueueStats, getQueueItems } from '@/lib/api/recall'
import { getExtraction } from '@/lib/api/extraction'
import { ApiError } from '@/lib/api/client'
import { TopBar } from '@/components/shared/TopBar'
import { SessionHeroV2 } from '@/components/recall/session-hero-v2'
import { SessionStartClient } from '@/components/recall/session-start-client'
import { VideoSummary } from '@/components/recall/video-summary'

interface PageProps {
  params: Promise<{ extractionId: string }>
}

function getExtractionTitle(extraction: { title: string | null; videoUrl: string }): string {
  if (extraction.title) return extraction.title
  try {
    const url = new URL(extraction.videoUrl)
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      const videoId = url.searchParams.get('v') || url.pathname.split('/').pop()
      if (videoId) return `YouTube Video (${videoId})`
    }
    const path = url.pathname.replace(/\/$/, '').split('/').pop()
    if (path) return decodeURIComponent(path).replace(/[-_]/g, ' ').replace(/\.\w+$/, '')
    return url.hostname
  } catch {
    return 'Untitled'
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { extractionId } = await params
  const headers = await getAuthHeaders()

  try {
    const extraction = await getExtraction(headers, extractionId)
    return { title: `Recall — ${extraction.title || 'Session'}` }
  } catch {
    return { title: 'Start Recall Session' }
  }
}

export default async function ExtractionRecallStartPage({ params }: PageProps) {
  const { extractionId } = await params
  const headers = await getAuthHeaders()

  let stats
  let extraction
  let items
  try {
    ;[stats, extraction, items] = await Promise.all([
      getQueueStats(headers, extractionId),
      getExtraction(headers, extractionId),
      getQueueItems(headers, extractionId),
    ])
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) redirect('/api/auth/force-signout')
      if (err.status === 404) notFound()
    }
    throw err
  }

  return (
    <>
      <TopBar
        title="Recall Session"
        subtitle="Select items and begin your recall practice"
      />
      <div className="space-y-6 p-7">
        <SessionHeroV2 stats={stats} extractionTitle={getExtractionTitle(extraction)} />
        {extraction.summary && <VideoSummary summary={extraction.summary} />}
        <SessionStartClient
          stats={stats}
          items={items}
          extractionId={extractionId}
          authHeaders={headers}
        />
      </div>
    </>
  )
}
