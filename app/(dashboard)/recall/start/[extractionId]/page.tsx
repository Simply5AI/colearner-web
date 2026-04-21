import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getConceptMastery } from '@/lib/api/recall'
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
    return { title: `Practice — ${extraction.title || 'Session'}` }
  } catch {
    return { title: 'Start Practice Session' }
  }
}

export default async function ExtractionRecallStartPage({ params }: PageProps) {
  const { extractionId } = await params
  const headers = await getAuthHeaders()

  let extraction
  let concepts
  try {
    ;[extraction, concepts] = await Promise.all([
      getExtraction(headers, extractionId),
      getConceptMastery(headers, extractionId),
    ])
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) redirect('/api/auth/force-signout')
      if (err.status === 404) notFound()
    }
    throw err
  }

  const title = getExtractionTitle(extraction)

  return (
    <>
      <TopBar
        title="Practice Session"
        subtitle="Select concepts and begin your practice session"
      />
      <div className="space-y-6 p-7">
        {extraction.roadmaps && extraction.roadmaps.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>
            {extraction.roadmaps.map((rm, i) => (
              <span key={rm.id} className="flex items-center gap-1">
                {i > 0 && <span className="mx-1">&middot;</span>}
                <Link href={`/roadmaps/${rm.id}`} className="text-brand-orange hover:underline font-medium">
                  {rm.title}
                </Link>
                <span className="text-muted-foreground/60">/ {rm.phaseTitle}</span>
              </span>
            ))}
          </div>
        )}
        <SessionHeroV2
          concepts={concepts}
          extractionTitle={title}
          sessionCount={extraction.sessionCount}
        />
        {extraction.summary && <VideoSummary summary={extraction.summary} />}
        <SessionStartClient
          concepts={concepts}
          extractionId={extractionId}
          extractionTitle={title}
          authHeaders={headers}
        />
      </div>
    </>
  )
}
