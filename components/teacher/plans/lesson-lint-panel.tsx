'use client'

import { useState } from 'react'
import { bandAudience, bandLabel, describePath, lessonBands, lintLesson, type LessonBand, type TeacherLessonContent } from '@/lib/api/teaching/lesson-schema'
import { cn } from '@/lib/utils'
import { normaliseLesson } from './lesson-draft'

/**
 * Band fit (F-T3-06). This is a deterministic reading-level check run in the browser as you write, so you can see where a
 * sentence is long for an age band. It never blocks saving or publishing. The preview tab shows the server's own check.
 */
export function LessonLintPanel({ content, targetBand, onGoTo }: { content: TeacherLessonContent; targetBand: LessonBand; onGoTo: (stepIndex: number) => void }) {
  const [band, setBand] = useState<LessonBand>(targetBand)
  const issues = lintLesson(normaliseLesson(content), band)
  return <section aria-label="Reading level check" className="space-y-2 rounded-xl border border-border p-3" data-testid="lint-panel">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-bold">Reading level</h4>
      <div role="radiogroup" aria-label="Check for age band" className="flex gap-1">
        {lessonBands.map(entry => <button key={entry} type="button" role="radio" aria-checked={band === entry} onClick={() => setBand(entry)} data-testid={`lint-band-${entry}`}
          className={cn('min-h-8 rounded-lg border px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring', band === entry ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>{bandAudience[entry]} {entry}</button>)}
      </div>
    </div>
    {issues.length === 0 ? <p className="text-sm" data-testid="lint-ok">Nothing is too hard to read for {bandLabel[band]}.</p>
      : <ul className="space-y-1 text-sm" data-testid="lint-issues">{issues.map(issue => {
        const step = /^steps\[(\d+)\]/.exec(issue.path)
        return <li key={`${issue.path}:${issue.rule}`} className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{describePath(issue.path, content)}:</span><span>{issue.message}</span>
          {step && <button type="button" className="text-xs underline" onClick={() => onGoTo(Number(step[1]))}>Go to this step</button>}
        </li>
      })}</ul>}
    <p className="text-[11px] text-muted-foreground">These are suggestions. They never stop you saving or publishing.</p>
  </section>
}
