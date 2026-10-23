'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { AgeBandScope } from '@/components/design-system'
import { TeacherLessonReader } from '@/components/learn/teacher-lesson-reader'
import { Button } from '@/components/ui/button'
import { bandFromApi } from '@/lib/api/learn'
import type { LessonVariant } from '@/lib/api/teaching/lessons'
import { bandAudience, bandLabel, lessonBands, type LessonBand } from '@/lib/api/teaching/lesson-schema'
import { teachingErrorText } from '@/lib/api/teaching/plans'
import { cn } from '@/lib/utils'
import { InlineAlert, LoadingBlock } from './fields'
import { useTeachingApis } from './use-teaching-apis'

/**
 * F-T3-06: preview as a student in each of the three school bands. The view is what the server says a learner receives
 * (answer key already stripped) and it is drawn by the SAME reader component the learner uses. The fit notes come from the
 * server's deterministic check. The adult band is a later release.
 */
export function LessonPreviewPane({ planId, topicId, version, variant = 'STANDARD', defaultBand, label, refreshKey = 0 }: {
  planId: string; topicId: string; version: number; variant?: LessonVariant; defaultBand: LessonBand; label?: string; refreshKey?: number
}) {
  const apis = useTeachingApis()
  const [band, setBand] = useState<LessonBand>(defaultBand)
  const query = useQuery({
    queryKey: ['teaching', apis.schoolId, 'lesson-preview', planId, topicId, variant, version, band, refreshKey],
    queryFn: () => apis.lessons.preview(planId, topicId, version, band, variant), retry: false, staleTime: 0, gcTime: 0,
  })
  const fit = (target: LessonBand) => query.data?.bandFit.find(entry => entry.band === target)
  return <section aria-label={label ?? 'Preview as student'} className="space-y-4" data-testid="lesson-preview">
    <div className="flex flex-wrap items-center gap-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><Eye aria-hidden="true" className="size-4" />Preview as</p>
      <div role="radiogroup" aria-label="Preview as" className="flex flex-wrap gap-1">
        {lessonBands.map(entry => <button key={entry} type="button" role="radio" aria-checked={band === entry} onClick={() => setBand(entry)} data-testid={`preview-band-${entry}`}
          className={cn('min-h-10 rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', band === entry ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
          {bandAudience[entry]} <span className="text-xs text-muted-foreground">{entry}</span></button>)}
      </div>
    </div>
    {query.isPending && <LoadingBlock label="Loading the preview" />}
    {query.error && <div data-testid="preview-error" className="space-y-2"><InlineAlert>{teachingErrorText(query.error)}</InlineAlert><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>}
    {query.data && <>
      <ul className="flex flex-wrap gap-2 text-xs" aria-label="Reading level by band" data-testid="band-fit">
        {lessonBands.map(entry => { const result = fit(entry); return <li key={entry} className={cn('rounded-full border px-2 py-0.5', result?.ok ? 'border-border' : 'border-amber-500/60 bg-amber-500/10')} data-band={entry} data-ok={result?.ok}>
          {bandLabel[entry]}: {result ? (result.ok ? 'fits' : `${result.issues.length} ${result.issues.length === 1 ? 'note' : 'notes'}`) : 'not checked'}</li> })}
      </ul>
      {(fit(band)?.issues.length ?? 0) > 0 && <InlineAlert tone="warning" testId="band-fit-issues">
        <p className="font-semibold">For {bandLabel[band]}:</p>
        <ul className="list-disc ps-5">{fit(band)!.issues.slice(0, 6).map(issue => <li key={`${issue.path}:${issue.rule}`}>{issue.message}</li>)}</ul>
      </InlineAlert>}
      <div className="rounded-xl border border-dashed border-border p-3" data-testid="preview-frame">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exactly what a student sees · {bandAudience[band]} · checks do not give feedback in a preview</p>
        <AgeBandScope band={bandFromApi(band)} aria-label={`Student view, ${bandAudience[band]}`} className="p-3 sm:p-5">
          <TeacherLessonReader key={`${version}:${variant}:${band}:${refreshKey}`} view={query.data.view} band={bandFromApi(band)} mode="preview" sourceHref={() => null} />
        </AgeBandScope>
      </div>
    </>}
  </section>
}
