'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useCaptureStats } from '@/lib/hooks/use-capture'
import { CaptureStatsBar } from '@/components/capture/capture-stats-bar'
import { CaptureSourceAccordion } from '@/components/capture/capture-source-accordion'
import { ExtractionProgress } from '@/components/capture/extraction-progress'
import { StudyPlanCapturePicker } from '@/components/capture/study-plan-capture-picker'
import { SubjectCapturePicker } from '@/components/capture/subject-capture-picker'
import { CaptureLearningIntro } from '@/components/capture/capture-learning-intro'
import { useCaptureStore } from '@/lib/stores/capture-store'

export function CapturePageClient() {
  const { data: stats, isLoading } = useCaptureStats()
  const searchParams = useSearchParams()
  const setSelectedSubjectId = useCaptureStore((s) => s.setSelectedSubjectId)

  useEffect(() => {
    const subjectId = searchParams.get('subject')
    if (subjectId === 'all' || subjectId === 'none' || subjectId === '__none__') {
      setSelectedSubjectId(null)
    } else if (subjectId) {
      setSelectedSubjectId(subjectId)
    }
  }, [searchParams, setSelectedSubjectId])

  return (
    <div className="mx-auto max-w-[1320px] space-y-6 p-5 md:p-7">
      <CaptureLearningIntro />
      {isLoading || !stats ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading stats...
        </div>
      ) : (
        <CaptureStatsBar stats={stats} />
      )}
      <StudyPlanCapturePicker />
      <SubjectCapturePicker />
      <ExtractionProgress />
      <CaptureSourceAccordion />
    </div>
  )
}
