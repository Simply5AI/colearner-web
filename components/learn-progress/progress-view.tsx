'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { CoCharacter } from '@/components/design-system'
import { CoSuggestionTag, LearnFrame, LearnLoadError, LearnSkeleton, MeasuredTag, useLearnIdentity } from '@/components/learn/learn-common'
import { AiOriginTag } from '@/components/lesson/lesson-parts'
import { useQuery } from '@tanstack/react-query'
import { bandFromApi, linkHref, type LearnBand } from '@/lib/api/learn'
import { progressApi, progressRoutes, type LearnProgress, type ProgressConcept, type ProgressSubject } from '@/lib/api/learn-progress'
import { cn } from '@/lib/utils'
import { REWARDS_LATER, masteryFace, masteryIcon } from './progress-model'

function MasteryMark({ mastery, text, large = false }: { mastery: ProgressSubject['mastery']; text: string; large?: boolean }) {
  const face = masteryFace[mastery]
  const Icon = masteryIcon[mastery]
  return <span data-mastery={mastery} className={cn('ds-pill', face.className, large && 'text-[length:var(--ds-h3)]')}>
    <Icon aria-hidden="true" size={large ? 22 : 16} />{text}
  </span>
}

function Garden({ subjects }: { subjects: ProgressSubject[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))]" aria-label="My learning garden">
    {subjects.map(subject => {
      const face = masteryFace[subject.mastery]
      const Icon = face.icon
      const expanded = open === subject.subjectId
      return <li key={subject.subjectId} className="ds-card space-y-3" data-testid="garden-plant" data-stage={face.stage}>
        <button type="button" className="flex w-full flex-col items-start gap-3 text-start" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : subject.subjectId)}>
          <Icon aria-hidden="true" size={48} className={face.className} />
          <span className="text-[length:var(--ds-h2)] font-extrabold">{subject.name}</span>
          <MasteryMark mastery={subject.mastery} text={face.stage} large />
        </button>
        {expanded && <ul aria-label={`${subject.name} ideas`} className="flex flex-wrap gap-2">
          {subject.concepts.length === 0 ? <li>Nothing growing here yet.</li> : subject.concepts.map(concept => <li key={concept.conceptRef} className="ds-pill" data-testid="garden-idea">{concept.label}</li>)}
        </ul>}
      </li>
    })}
  </ul>
}

function Week({ week }: { week: LearnProgress['week'] }) {
  const peak = Math.max(1, ...week.map(day => day.completedSessions))
  return <section aria-labelledby="week-title" data-testid="week-activity" className="ds-card space-y-3">
    <h2 id="week-title">This week</h2>
    <p className="text-[length:var(--ds-small)] text-muted-foreground">Completed practice sessions. This is not a score.</p>
    <ul className="grid grid-cols-7 gap-2">
      {week.map(day => <li key={day.date} className="flex flex-col items-center gap-2">
        <span className="flex h-24 w-full items-end" aria-hidden="true"><span className="block w-full rounded-t-[var(--radius)] bg-primary" style={{ height: `${Math.max(8, Math.round(day.completedSessions / peak * 100))}%` }} /></span>
        <span className="text-center text-[length:var(--ds-small)] font-bold">{day.completedSessions} {day.completedSessions === 1 ? 'session' : 'sessions'}</span>
        <span className="sr-only">{day.date}</span>
      </li>)}
    </ul>
  </section>
}

function SubjectCards({ subjects }: { subjects: ProgressSubject[] }) {
  return <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
    {subjects.map(subject => <li key={subject.subjectId} className="ds-card space-y-3" data-testid="subject-card">
      <h2>{subject.name}</h2>
      <MeasuredTag>Measured mastery</MeasuredTag>
      <MasteryMark mastery={subject.mastery} text={masteryFace[subject.mastery].label} />
    </li>)}
  </ul>
}

function ConceptCell({ concept }: { concept: ProgressConcept }) {
  const face = masteryFace[concept.mastery]
  const Icon = masteryIcon[concept.mastery]
  return <li data-testid="mastery-cell" data-mastery={concept.mastery} className={cn('ds-card flex items-center gap-2', face.className)}>
    <Icon aria-hidden="true" size={18} /><span className="font-bold">{concept.label}</span><span className="ds-pill">{face.label}</span>
  </li>
}

function TeenSubjects({ subjects }: { subjects: ProgressSubject[] }) {
  const weak = subjects.flatMap(subject => subject.concepts.filter(concept => concept.mastery === 'PRACTICING').map(concept => ({ concept, subject }))).sort((a, b) => (a.concept.rate ?? 1) - (b.concept.rate ?? 1)).slice(0, 6)
  return <>
    <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
      {subjects.map(subject => <li key={subject.subjectId} className="ds-card space-y-3" data-testid="subject-card">
        <h2>{subject.name}</h2>
        <MeasuredTag>Measured readiness</MeasuredTag>
        {typeof subject.readiness === 'number'
          ? <p data-testid="readiness" className="text-[length:var(--ds-h2)] font-extrabold">{subject.readiness}% ready</p>
          : <p data-testid="readiness-pending">Not enough practice yet for a readiness number.</p>}
        <MasteryMark mastery={subject.mastery} text={masteryFace[subject.mastery].label} />
        <ul aria-label={`${subject.name} concepts`} className="space-y-2">{subject.concepts.map(concept => <ConceptCell key={concept.conceptRef} concept={concept} />)}</ul>
      </li>)}
    </ul>
    <section aria-labelledby="weak-title" data-testid="weak-spots" className="space-y-3">
      <h2 id="weak-title">Weak spots</h2>
      {weak.length === 0 ? <p>No concept is in practicing right now.</p> : <ul className="space-y-2">{weak.map(({ concept, subject }) => {
        const href = linkHref(concept.practice)
        return <li key={concept.conceptRef} className="ds-card flex flex-wrap items-center gap-3">
          <span className="font-bold">{concept.label}</span><span className="text-muted-foreground">{subject.name}</span>
          <MasteryMark mastery={concept.mastery} text={masteryFace[concept.mastery].label} />
          {href && <Link href={href} className="ds-button ds-button-secondary">Practice</Link>}
        </li>
      })}</ul>}
    </section>
  </>
}

function FocusCard({ focus, band }: { focus: LearnProgress['focusNext']; band: LearnBand }) {
  return <section aria-labelledby="suggest-title" data-testid="co-suggests" className="ds-card space-y-3">
    <div className="flex flex-wrap items-center gap-2"><h2 id="suggest-title">Co suggests</h2><CoSuggestionTag /></div>
    {focus.kind === 'AI' && <>
      <AiOriginTag band={band} variant="helper" />
      {focus.suggestions.length === 0 ? <p>Co has nothing further to suggest.</p> : <ul className="space-y-2">{focus.suggestions.map(item => <li key={item.candidateRef}><p className="font-bold">{item.label}</p><p>{item.reason}</p></li>)}</ul>}
    </>}
    {focus.kind === 'UNAVAILABLE' && <p>{focus.reason}</p>}
    {focus.kind === 'NONE' && <p>Nothing to suggest yet.</p>}
    <p className="text-[length:var(--ds-small)] text-muted-foreground">A suggestion from Co. It is separate from measured mastery.</p>
  </section>
}

function ProgressBody({ progress }: { progress: LearnProgress }) {
  const band = bandFromApi(progress.band)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const download = async () => {
    setExporting(true); setExportError(null)
    try {
      const blob = await progressApi.exportCsv()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'progress.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : 'A progress download is not available for this learner.')
    } finally { setExporting(false) }
  }
  if (progress.subjects.length === 0) {
    return <LearnFrame band={band} label="Progress">
      <div className="ds-state" data-state="empty">
        <CoCharacter band={band} state="curious" decorative />
        <h1>{band === 'kids' ? 'Plant your first seed' : 'Your progress grows here'}</h1>
        <p>{band === 'kids' ? 'Snap a page and plant your first seed.' : 'Learn something first, and your progress grows here.'}</p>
        <Link href={progressRoutes.library} className="ds-button ds-button-primary">{band === 'kids' ? 'Go to my pages' : 'Go to the library'}</Link>
      </div>
    </LearnFrame>
  }
  return <LearnFrame band={band} label={band === 'kids' ? 'My learning garden' : 'Progress'} className={cn(band === 'kids' && 'max-w-3xl')}>
    <header className="space-y-2">
      <h1>{band === 'kids' ? 'My learning garden' : 'Progress'}</h1>
      {band !== 'kids' && <MeasuredTag>Measured from your practice</MeasuredTag>}
    </header>
    {band === 'kids' ? <Garden subjects={progress.subjects} /> : band === 'tweens' ? <>
      <SubjectCards subjects={progress.subjects} />
      <Week week={progress.week} />
      <section data-testid="rewards-unavailable" className="ds-card space-y-2" aria-labelledby="rewards-title">
        <h2 id="rewards-title">Levels and badges</h2>
        <p><Sparkles aria-hidden="true" className="me-2 inline" />{REWARDS_LATER}</p>
      </section>
    </> : <TeenSubjects subjects={progress.subjects} />}
    <FocusCard focus={progress.focusNext} band={band} />
    {band === 'teens' && progress.export.available && <button type="button" className="ds-button ds-button-secondary" data-testid="export-csv" onClick={() => void download()} disabled={exporting}>{exporting ? 'Preparing the CSV' : 'Download CSV'}</button>}
    {exportError && <p role="alert">{exportError}</p>}
  </LearnFrame>
}

/** L13. The band and every number come from the server payload. */
export function ProgressScreen() {
  const { actor, band: identityBand } = useLearnIdentity()
  const fallback: LearnBand = identityBand ?? 'teens'
  const query = useQuery({
    queryKey: ['learn', actor, 'progress'],
    queryFn: () => progressApi.get(),
    enabled: !!actor,
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false,
  })
  if (query.isPending) return <LearnSkeleton band={fallback} label={fallback === 'kids' ? 'Looking at your garden' : 'Loading your progress'} />
  if (query.error) return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={fallback} backHref={progressRoutes.library} backLabel="Library" />
  return <ProgressBody progress={query.data} />
}
