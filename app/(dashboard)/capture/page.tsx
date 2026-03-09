import type { Metadata } from 'next'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getCaptureStats } from '@/lib/api/capture'
import { TopBar } from '@/components/shared/TopBar'
import { CaptureStatsBar } from '@/components/capture/capture-stats-bar'
import { CaptureSourceAccordion } from '@/components/capture/capture-source-accordion'
import { ExtractionProgress } from '@/components/capture/extraction-progress'

export const metadata: Metadata = {
  title: 'Capture',
}

export default async function CapturePage() {
  const headers = await getAuthHeaders()
  const stats = await getCaptureStats(headers)

  return (
    <>
      <TopBar
        title="Capture Knowledge"
        subtitle="Choose a source to extract concepts from. We'll generate recall questions automatically."
      />
      <div className="space-y-6 p-7">
        <CaptureStatsBar stats={stats} />
        <ExtractionProgress />
        <CaptureSourceAccordion />
      </div>
    </>
  )
}
