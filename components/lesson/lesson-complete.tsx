'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button, CoCharacter } from '@/components/design-system'
import { ActionControl, LearnFrame } from '@/components/learn/learn-common'
import { linkHref, type LearnBand } from '@/lib/api/learn'
import type { LessonContentView, LessonDetail } from '@/lib/api/lesson'
import { AiOriginTag } from './lesson-parts'
import { coSizeFor } from './lesson-model'

/**
 * F-L7-08 (partial by design): an honest "Lesson done" card. It records that the lesson was finished and offers the
 * next real steps. No XP, sticker, readiness or review schedule is shown because none exists yet (B09 and B17).
 * "Practice now" comes from the server and is disabled with its reason until practice ships.
 */
export function LessonCompleteCard({ detail, content, band, onReview }: { detail: LessonDetail; content: Pick<LessonContentView, 'title' | 'objectives'>; band: LearnBand; onReview?: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  const kids = band === 'kids'
  const materialHref = linkHref(detail.source.materialLink)
  const homeHref = linkHref(detail.completion.home) ?? '/learn/home'
  return <LearnFrame band={band} label="Lesson done">
    <section data-state="complete" aria-labelledby="lesson-done" className="ds-state">
      <CoCharacter band={band} state="celebrating" size={Math.max(coSizeFor(band), 96)} decorative />
      <div className="space-y-2">
        <h1 id="lesson-done" ref={heading} tabIndex={-1} className="outline-none">Lesson done!</h1>
        <p className="font-semibold">{kids ? `You finished ${content.title}!` : `You finished ${content.title}.`}</p>
        <p className="inline-flex items-center gap-2 text-muted-foreground"><CheckCircle2 size={18} aria-hidden="true" />All 5 steps done</p>
      </div>
      {content.objectives.length > 0 && !kids && <div className="max-w-prose text-start">
        <h2 className="mb-2 text-[length:var(--ds-h3)]">What this lesson covered</h2>
        <ul className="list-disc space-y-1 ps-6">{content.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul>
      </div>}
      <div className="flex flex-wrap items-start justify-center gap-3">
        <ActionControl action={detail.completion.practice} label="Practice now" />
        <Link href={homeHref} className="ds-button ds-button-secondary">Back home</Link>
        {materialHref && <Link href={materialHref} className="ds-button ds-button-ghost">Back to my material</Link>}
        {onReview && <Button variant="ghost" onClick={onReview}>{kids ? 'Look again' : 'Look at the lesson again'}</Button>}
      </div>
      <AiOriginTag band={band} packVersion={detail.generatedBy.packVersion} promptRelease={detail.generatedBy.promptRelease} />
    </section>
  </LearnFrame>
}
