'use client'

import Link from 'next/link'
import { Button, CoCharacter, EmptyState, ErrorState } from '@/components/design-system'
import { LearnFrame, LearnLoadError } from '@/components/learn/learn-common'
import { SeeWhatsNeededLink } from '@/components/learn/see-whats-needed'
import { needsLinkHelp } from '@/lib/api/learn-link'
import type { LearnBand } from '@/lib/api/learn'
import { practiceErrorCode, practiceErrorMessage, practiceFailureText, practiceRoutes, type PracticeSetSummary } from '@/lib/api/practice'

const backLabel = (band: LearnBand) => band === 'kids' ? 'Back to Play' : 'Back to practice'

/** Co is making the questions. The page polls the server, so leaving and coming back (or refreshing) is safe. */
export function PracticeGenerating({ band, status, onCancel, cancelling, error }: { band: LearnBand; status: 'QUEUED' | 'RUNNING'; onCancel?: () => void; cancelling?: boolean; error?: Error | null }) {
  const kids = band === 'kids'
  return <LearnFrame band={band} label="Making your questions">
    <div data-state="generating" className="ds-state">
      <CoCharacter band={band} state={status === 'RUNNING' ? 'reading' : 'thinking'} decorative />
      <div role="status" aria-live="polite" className="space-y-2">
        <h1 className="font-extrabold">{kids ? 'Co is making your game!' : 'Co is making your questions'}</h1>
        <p>{status === 'QUEUED' ? 'Your questions are waiting their turn.' : 'Co is reading your material and writing questions.'}</p>
        <p className="text-muted-foreground">{kids ? 'This can take a minute. You can wait here.' : 'This can take about a minute. You can leave this page and come back; it keeps going.'}</p>
      </div>
      {error && <p role="alert" className="ds-field-error">{practiceErrorMessage(error)}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        {onCancel && <Button variant="secondary" onClick={onCancel} loading={cancelling}>{kids ? 'Stop' : 'Stop making these'}</Button>}
        <Link href={practiceRoutes.hub} className="ds-button ds-button-ghost">{backLabel(band)}</Link>
      </div>
    </div>
  </LearnFrame>
}

/** A FAILED question set. Only a retryable failure offers Try again; a retry is one request and the button locks while it runs. */
export function PracticeSetFailed({ band, failure, onRetry, retrying, error }: { band: LearnBand; failure: PracticeSetSummary['failure']; onRetry: () => void; retrying: boolean; error?: Error | null }) {
  return <LearnFrame band={band} label="Questions could not be made">
    <div data-state="failed"><ErrorState band={band} title="Co could not make these questions" description={practiceFailureText(failure)} action={<div className="flex flex-wrap justify-center gap-3">
      {error && <p role="alert" className="ds-field-error w-full justify-center">{practiceErrorMessage(error)}</p>}
      {failure?.retryable && <Button onClick={onRetry} loading={retrying}>Try again</Button>}
      <Link href={practiceRoutes.hub} className="ds-button ds-button-secondary">{backLabel(band)}</Link>
    </div>} /></div>
  </LearnFrame>
}

export function PracticeSetCancelled({ band, onAgain, again }: { band: LearnBand; onAgain?: () => void; again?: boolean }) {
  return <LearnFrame band={band} label="Questions stopped">
    <div data-state="cancelled"><EmptyState band={band} title="These questions were stopped" description="Nothing was kept. You can ask Co to make them again from your material." action={<div className="flex flex-wrap justify-center gap-3">
      {onAgain && <Button onClick={onAgain} loading={again}>Make them again</Button>}
      <Link href={practiceRoutes.hub} className="ds-button ds-button-secondary">{backLabel(band)}</Link>
    </div>} /></div>
  </LearnFrame>
}

const startTitles: Record<string, string> = {
  NO_QUESTIONS_AVAILABLE: 'Nothing to practise right now',
  MATERIAL_NOT_READY: 'This material is not ready yet',
  LESSON_NOT_READY: 'This lesson is not ready yet',
  PRACTICE_UNAVAILABLE: 'Practice is not ready yet',
  DAILY_PRACTICE_SET_LIMIT: 'That is enough question sets for today',
  DAILY_PRACTICE_LIMIT: 'That is enough question sets for today',
  PRACTICE_LIMIT_REACHED: 'That is enough question sets for today',
  POLICY_BLOCKED: 'Not right now',
  CONSENT_REQUIRED: 'A grown-up needs to help first',
  CHILD_PROFILE_REQUIRED: 'Your profile needs finishing first',
  SESSION_NOT_FOUND: 'We could not find that practice',
  SET_NOT_FOUND: 'We could not find those questions',
  TOPIC_NOT_FOUND: 'We could not find that topic',
  EXAM_NOT_AVAILABLE: 'No mock test is ready yet',
  PRACTICE_ACCESS_CHANGED: 'This practice is hidden for now',
}
const noRetry = new Set(['TOPIC_NOT_FOUND', 'EXAM_NOT_AVAILABLE', 'PRACTICE_ACCESS_CHANGED','NO_QUESTIONS_AVAILABLE', 'MATERIAL_NOT_READY', 'LESSON_NOT_READY', 'CONSENT_REQUIRED', 'CHILD_PROFILE_REQUIRED', 'PRACTICE_UNAVAILABLE', 'SESSION_NOT_FOUND', 'SET_NOT_FOUND'])

/** The typed failures of "start a practice". Server reasons are shown only for POLICY_BLOCKED, which the contract calls safe. */
export function PracticeStartError({ error, retry, band }: { error: Error; retry: () => void; band: LearnBand }) {
  const code = practiceErrorCode(error)
  const status = (error as { status?: number }).status
  const title = code ? startTitles[code] : status === 429 ? startTitles.DAILY_PRACTICE_SET_LIMIT : undefined
  if (!title) return <LearnLoadError error={error} retry={retry} band={band} backHref={practiceRoutes.hub} backLabel={backLabel(band)} />
  return <LearnFrame band={band} label="Practice could not start">
    <div data-state="start-blocked" data-code={code}><ErrorState band={band} title={title} description={practiceErrorMessage(error)} action={<div className="flex flex-wrap justify-center gap-3">
      {needsLinkHelp(error) && <SeeWhatsNeededLink />}
      {!(code && noRetry.has(code)) && <Button onClick={retry}>Try again</Button>}
      <Link href={practiceRoutes.hub} className="ds-button ds-button-secondary">{backLabel(band)}</Link>
    </div>} /></div>
  </LearnFrame>
}

/** The start page was opened without something to practise (or with an address that is not a real one). */
export function PracticeNoTarget({ band }: { band: LearnBand }) {
  return <LearnFrame band={band} label="Choose what to practise">
    <div data-state="no-target"><EmptyState band={band} title="Choose what to practise" description="Pick something from the practice page and press its start button." action={<Link href={practiceRoutes.hub} className="ds-button ds-button-primary">{band === 'kids' ? 'Open Play' : 'Open practice'}</Link>} /></div>
  </LearnFrame>
}
