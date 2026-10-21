'use client'

import Link from 'next/link'
import { Button, CoCharacter, EmptyState, ErrorState } from '@/components/design-system'
import { LearnFrame, LearnLoadError } from '@/components/learn/learn-common'
import { SeeWhatsNeededLink } from '@/components/learn/see-whats-needed'
import type { LearnBand } from '@/lib/api/learn'
import { needsLinkHelp } from '@/lib/api/learn-link'
import { lessonErrorCode, lessonErrorMessage, lessonFailureText, type LessonSummary } from '@/lib/api/lesson'
import { AiOriginTag } from './lesson-parts'

const libraryHref = '/learn/library'

/** Co is making the lesson. The page polls the server, so leaving and coming back (or refreshing) is safe. */
export function LessonGenerating({ band, status, onCancel, cancelling, error }: { band: LearnBand; status: 'QUEUED' | 'RUNNING'; onCancel?: () => void; cancelling?: boolean; error?: Error | null }) {
  const kids = band === 'kids'
  return <LearnFrame band={band} label="Making your lesson">
    <div data-state="generating" className="ds-state">
      <CoCharacter band={band} state={status === 'RUNNING' ? 'reading' : 'thinking'} decorative />
      <div role="status" aria-live="polite" className="space-y-2">
        <h1 className="font-extrabold">{kids ? 'Co is making your lesson!' : 'Co is making your lesson'}</h1>
        <p>{status === 'QUEUED' ? 'Your lesson is waiting its turn.' : 'Co is reading your material and writing five short steps.'}</p>
        <p className="text-muted-foreground">{kids ? 'This can take a minute. You can wait here.' : 'This can take about a minute. You can leave this page and come back; it keeps going.'}</p>
      </div>
      <AiOriginTag band={band} />
      {error && <p role="alert" className="ds-field-error">{lessonErrorMessage(error)}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        {onCancel && <Button variant="secondary" onClick={onCancel} loading={cancelling}>{kids ? 'Stop' : 'Stop making this lesson'}</Button>}
        <Link href={libraryHref} className="ds-button ds-button-ghost">{kids ? 'My pages' : 'Back to my library'}</Link>
      </div>
    </div>
  </LearnFrame>
}

/**
 * A FAILED lesson. Only a retryable failure offers Try again; a retry is one request and the button locks while it runs.
 * Starting again is offered only after `authorization_changed`: the lesson is keyed to the consent and policy it was made under,
 * so only a change there gives a new lesson. After any other final failure the server answers with the same failed lesson.
 */
export function LessonFailed({ band, failure, onRetry, retrying, error, startHref }: { band: LearnBand; failure: LessonSummary['failure']; onRetry: () => void; retrying: boolean; error?: Error | null; startHref?: string | null }) {
  return <LearnFrame band={band} label="Lesson could not be made">
    <div data-state="failed"><ErrorState band={band} title="Co could not make this lesson" description={lessonFailureText(failure)} action={<div className="flex flex-wrap justify-center gap-3">
      {error && <p role="alert" className="ds-field-error w-full justify-center">{lessonErrorMessage(error)}</p>}
      {failure?.retryable && <Button onClick={onRetry} loading={retrying}>Try again</Button>}
      {!failure?.retryable && failure?.code === 'authorization_changed' && startHref && <Link href={startHref} className="ds-button ds-button-primary">Start again</Link>}
      <Link href={libraryHref} className="ds-button ds-button-secondary">Back to my library</Link>
    </div>} /></div>
  </LearnFrame>
}

export function LessonCancelled({ band, startHref }: { band: LearnBand; startHref: string | null }) {
  return <LearnFrame band={band} label="Lesson stopped">
    <div data-state="cancelled"><EmptyState band={band} title="This lesson was stopped" description="Nothing was kept. You can ask Co to make it again from your material." action={<div className="flex flex-wrap justify-center gap-3">
      {startHref && <Link href={startHref} className="ds-button ds-button-primary">Make it again</Link>}
      <Link href={libraryHref} className="ds-button ds-button-secondary">Back to my library</Link>
    </div>} /></div>
  </LearnFrame>
}

/** LESSON_ACCESS_CHANGED: consent, policy or the source changed, so the lesson text is hidden again. Nothing is cached or shown. */
export function LessonAccessChanged({ band }: { band: LearnBand }) {
  return <LearnFrame band={band} label="Lesson hidden">
    <div data-state="access-changed"><ErrorState band={band} title="This lesson is hidden for now" description="Access to the material behind this lesson changed, so Co is keeping it closed. Ask a grown-up or your school if you think this is a mistake." action={<div className="flex flex-wrap justify-center gap-3">
      <SeeWhatsNeededLink />
      <Link href={libraryHref} className="ds-button ds-button-secondary">Back to my library</Link>
    </div>} /></div>
  </LearnFrame>
}

const startTitles: Record<string, string> = {
  MATERIAL_NOT_READY: 'This material is not ready yet',
  LESSONS_UNAVAILABLE: 'Lessons are not ready yet',
  DAILY_LESSON_LIMIT: 'That is enough lessons for today',
  LESSON_LIMIT_REACHED: 'That is enough lessons for today',
  POLICY_BLOCKED: 'Not right now',
  CONSENT_REQUIRED: 'A grown-up needs to help first',
  CHILD_PROFILE_REQUIRED: 'Your profile needs finishing first',
}
const noRetry = new Set(['MATERIAL_NOT_READY', 'CONSENT_REQUIRED', 'CHILD_PROFILE_REQUIRED', 'LESSONS_UNAVAILABLE'])

/** The typed failures of "start a lesson". Server reasons are shown only for POLICY_BLOCKED, which the contract calls safe. */
export function LessonStartError({ error, retry, band }: { error: Error; retry: () => void; band: LearnBand }) {
  const code = lessonErrorCode(error)
  const status = (error as { status?: number }).status
  const title = code ? startTitles[code] : status === 429 ? startTitles.LESSON_LIMIT_REACHED : undefined
  if (!title) return <LearnLoadError error={error} retry={retry} band={band} backHref={libraryHref} backLabel="Back to my library" />
  return <LearnFrame band={band} label="Lesson could not start">
    <div data-state="start-blocked" data-code={code}><ErrorState band={band} title={title} description={lessonErrorMessage(error)} action={<div className="flex flex-wrap justify-center gap-3">
      {needsLinkHelp(error) && <SeeWhatsNeededLink />}
      {!(code && noRetry.has(code)) && <Button onClick={retry}>Try again</Button>}
      <Link href={libraryHref} className="ds-button ds-button-secondary">Back to my library</Link>
    </div>} /></div>
  </LearnFrame>
}

export function LessonNoMaterial({ band }: { band: LearnBand }) {
  return <LearnFrame band={band} label="Choose a material">
    <div data-state="no-material"><EmptyState band={band} title="Choose something to learn from" description="A lesson is made from one of your own materials. Pick one from your library and press Start lesson." action={<Link href={libraryHref} className="ds-button ds-button-primary">Open my library</Link>} /></div>
  </LearnFrame>
}
