'use client'

import { Loader2 } from 'lucide-react'
import { useCaptureStats } from '@/lib/hooks/use-capture'
import { CaptureStatsBar } from '@/components/capture/capture-stats-bar'
import { CaptureSourceAccordion } from '@/components/capture/capture-source-accordion'
import { ExtractionProgress } from '@/components/capture/extraction-progress'
import { StudyPlanCapturePicker } from '@/components/capture/study-plan-capture-picker'

export function CapturePageClient() {
  const { data: stats, isLoading } = useCaptureStats()

  return (
    <div className="space-y-6 p-7">
      {isLoading || !stats ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading stats...
        </div>
      ) : (
        <CaptureStatsBar stats={stats} />
      )}
      <StudyPlanCapturePicker />
      <ExtractionProgress />
      <CaptureSourceAccordion />
    </div>
  )
}
