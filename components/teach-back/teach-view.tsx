'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Check, Circle, GraduationCap, MicOff } from 'lucide-react'
import { CoCharacter } from '@/components/design-system'
import { LearnFrame, LearnLoadError, LearnSkeleton, useLearnIdentity } from '@/components/learn/learn-common'
import { AiOriginTag } from '@/components/lesson/lesson-parts'
import { bandFromApi, linkHref, type LearnBand } from '@/lib/api/learn'
import { newClientId } from '@/lib/api/co'
import { isTerminalTeachTurn, teachApi, teachRoutes, type TeachContext, type TeachDetail, type TeachReply, type TeachResult, type TeachSession, type TeachTurn } from '@/lib/api/teach-back'
import { cn } from '@/lib/utils'
import { useTeachContext, useTeachSession } from './teach-hooks'
import { browserTeachStorage, TeachSender } from './teach-sender'
import { TAUGHT_IT_LABEL, VOICE_TITLE, coveredTicks, followUpQuestion, isTeachSafety, latestReady, teachPendingLabel } from './teach-model'

const library = '/learn/library'

function VoiceNote({ reason }: { reason: string }) {
  return <p data-testid="teach-voice-note" className="flex items-start gap-2 text-muted-foreground">
    <MicOff aria-hidden="true" className="mt-1 shrink-0" />
    <span><span className="font-bold text-foreground">{VOICE_TITLE}</span> {reason}</span>
  </p>
}

function PromptBox({ band, value, onChange, prompts, disabled, onSubmit, pending, unconfirmed }: {
  band: LearnBand
  value: string
  onChange: (value: string) => void
  prompts: readonly string[]
  disabled: boolean
  onSubmit: () => void
  pending: boolean
  unconfirmed: boolean
}) {
  const fieldId = useId()
  const kids = band === 'kids'
  const tap = (prompt: string) => {
    if (disabled) return
    onChange(value.includes(prompt) ? value : `${value.trim()} ${prompt}`.trim())
  }
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); onSubmit() }}>
    {prompts.length > 0 && <div className="flex flex-wrap gap-2" data-testid="teach-prompts">
      {prompts.map(prompt => <button key={prompt} type="button" className={cn('ds-button ds-button-secondary', kids && 'min-h-16 text-[length:var(--ds-h3)]')} onClick={() => tap(prompt)} disabled={disabled}>{prompt}</button>)}
    </div>}
    <div className="ds-field">
      <label htmlFor={fieldId} className={cn(kids && 'text-[length:var(--ds-h3)]')}>{kids ? 'Teach Co in your own words' : 'Your explanation'}</label>
      <textarea id={fieldId} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} maxLength={1000} rows={kids ? 6 : 5} className={cn('ds-input min-h-32 w-full', kids && 'text-[length:var(--ds-h3)]')} />
    </div>
    <button type="submit" className={cn('ds-button ds-button-primary', kids && 'min-h-16 text-[length:var(--ds-h3)]')} disabled={disabled || value.trim().length === 0}>
      {pending ? 'Co is working' : unconfirmed ? 'Send again' : kids ? 'Teach Co' : 'Send explanation'}
    </button>
  </form>
}

function SafetyCard({ reply, band }: { reply: TeachReply; band: LearnBand }) {
  const text = reply.safety.guidance || reply.text
  return <section role="status" data-testid="teach-safety" data-state="safety" className="ds-card space-y-3" aria-labelledby="teach-safety-title">
    <h2 id="teach-safety-title">Safety check</h2>
    <CoCharacter band={band} state="encouraging" decorative />
    <p>{reply.generatedBy.kind === 'CODE' ? 'Safety message from CoLearner' : null}</p>
    <p className="whitespace-pre-line break-words">{text}</p>
  </section>
}

function ReadyReply({ turn, band }: { turn: TeachTurn; band: LearnBand }) {
  if (turn.status !== 'READY' || !turn.reply) return null
  if (isTeachSafety(turn.reply)) return <SafetyCard reply={turn.reply} band={band} />
  return <section data-testid="teach-reply" className="ds-card space-y-3" aria-label="Co">
    <CoCharacter band={band} state="asking" decorative />
    {turn.reply.generatedBy.kind === 'AI' && <AiOriginTag band={band} variant="helper" />}
    <p data-testid="teach-reply-text" className="whitespace-pre-line break-words">{turn.reply.text}</p>
    {turn.reply.citations.length > 0 && <details data-testid="teach-sources" className="space-y-2">
      <summary className="cursor-pointer font-bold">{band === 'kids' ? 'From your page' : 'Sources from your material'}</summary>
      <ul className="space-y-3 pt-2">{turn.reply.citations.map((citation, index) => {
        const href = linkHref(citation.link)
        return <li key={`${citation.anchorRef}:${index}`} className="space-y-2">
          {href ? <Link href={href} className="ds-pill border border-border">{citation.label}</Link> : <span className="font-bold">{citation.label}</span>}
          {citation.quote.trim() && <blockquote className="border-s-4 border-primary ps-3 text-muted-foreground">{citation.quote}</blockquote>}
        </li>
      })}</ul>
    </details>}
  </section>
}

function Feedback({ result, session, band }: { result: TeachResult; session: TeachSession; band: LearnBand }) {
  const ticks = coveredTicks(result)
  const practiceHref = band === 'teens' && result.missing.length > 0 ? linkHref(result.practice) : null
  return <section data-testid="teach-feedback" data-state="feedback" className="space-y-4" aria-labelledby="feedback-title">
    <div className="flex flex-wrap items-center gap-4">
      <CoCharacter band={band} state={result.effortLabel === 'TAUGHT_IT' ? 'celebrating' : 'encouraging'} decorative />
      <h2 id="feedback-title">{band === 'kids' ? 'Look what you taught Co' : 'What you covered'}</h2>
    </div>
    <AiOriginTag band={band} variant="helper" />
    <ul data-testid="covered-points" className="space-y-2">
      {ticks.map(tick => <li key={tick.label} className="ds-card flex items-center gap-3 text-[length:var(--ds-h3)] font-bold"><Check aria-hidden="true" className="text-[var(--mastery-mastered)]" />{tick.label}</li>)}
    </ul>
    {band === 'teens' && <ul data-testid="missed-points" className="space-y-2" aria-label="Still to say">
      {result.missing.map(point => <li key={point} className="ds-card flex items-center gap-3"><Circle aria-hidden="true" />{point}<span className="ds-pill">Missed</span></li>)}
    </ul>}
    {band === 'teens' && result.examTip && <p data-testid="exam-tip" className="ds-card"><span className="font-bold">Exam tip. </span>{result.examTip}</p>}
    {band === 'teens' && result.misconceptions.length > 0 && <section aria-label="Check this" className="space-y-2">
      {result.misconceptions.map(item => <p key={item.text} className="ds-card"><span className="font-bold">{item.sourceLabel}. </span>{item.text}</p>)}
    </section>}
    {result.effortLabel === 'TAUGHT_IT' && <p data-testid="taught-it" className="ds-pill text-[length:var(--ds-h3)] font-extrabold">{TAUGHT_IT_LABEL}</p>}
    {practiceHref && <Link href={practiceHref} className="ds-button ds-button-secondary"><GraduationCap aria-hidden="true" size={18} />Practice the missed points</Link>}
    <p className="text-[length:var(--ds-small)] text-muted-foreground">About {session.conceptTitle}</p>
  </section>
}

function SessionBody({ detail, band, pollBaseMs }: { detail: TeachDetail; band: LearnBand; pollBaseMs?: number }) {
  const live = useTeachSession(detail.session.id, { pollBaseMs })
  const [draft, setDraft] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const session = live.session.data?.session ?? detail.session
  const result = live.session.data?.result ?? detail.result
  const seeded = detail.pending ? [...detail.turns, detail.pending] : detail.turns
  const turns = live.turns.length > 0 ? live.turns : seeded
  const pending = live.pending ?? seeded.find(turn => !isTerminalTeachTurn(turn)) ?? null
  const phase = session.phase
  const question = followUpQuestion(turns)
  const safety = latestReady(turns)
  const showSafety = safety && isTeachSafety(safety.reply)
  const asking = phase === 'FOLLOW_UP' && !pending && !showSafety
  const prompting = phase === 'PROMPT' && !pending
  const prompts = session.keyPoints
  useEffect(() => { heading.current?.focus() }, [])
  const locked = live.unconfirmed?.text
  const value = locked ?? draft
  const submit = () => { void live.send(value).then(ok => { if (ok) setDraft('') }) }

  return <LearnFrame band={band} label="Teach it back" className={cn(band === 'kids' && 'max-w-3xl')}>
    <section className="ds-card space-y-3" data-state={phase.toLowerCase()}>
      <CoCharacter band={band} state={pending ? 'thinking' : asking ? 'asking' : 'explaining'} decorative className={band === 'kids' ? 'size-36' : undefined} />
      <h1 ref={heading} tabIndex={-1} className="outline-none">{band === 'kids' ? `Teach Co about ${session.conceptTitle}` : session.conceptTitle}</h1>
      {session.source && <p className="text-muted-foreground">From {session.source.title}</p>}
      <VoiceNote reason={session.voiceReason} />
    </section>
    <div role="status" aria-live="polite" className="sr-only">{pending ? teachPendingLabel(band) : phase === 'FEEDBACK' ? 'Co finished checking your explanation.' : ''}</div>
    {turns.filter(turn => turn.learnerText).map(turn => <section key={turn.id} className="space-y-3">
      <p className="ds-card font-semibold" data-testid="learner-text">{turn.learnerText}</p>
      {turn.status === 'FAILED' && <p role="alert">{turn.failure?.retryable ? 'Co could not check that. Your words are still here, so try again.' : 'Co could not check that explanation.'}</p>}
      <ReadyReply turn={turn} band={band} />
    </section>)}
    {pending && <section data-testid="teach-pending" data-state="thinking" className="ds-card flex items-center gap-4" aria-busy="true">
      <CoCharacter band={band} state="thinking" decorative />
      <p className="font-bold">{teachPendingLabel(band)}</p>
    </section>}
    {live.pollProblem && <p role="alert">{live.pollProblem} <button type="button" className="ds-button ds-button-secondary" onClick={live.resumePolling}>Check again</button></p>}
    {live.error && <p role="alert">{live.error}</p>}
    {showSafety ? null : phase === 'FEEDBACK' && result ? <Feedback result={result} session={session} band={band} /> : null}
    {(prompting || asking) && !showSafety && <>
      {asking && question && band !== 'kids' && <p className="text-[length:var(--ds-h3)] font-bold" data-testid="follow-up-prompt">{question}</p>}
      {asking && band === 'kids' && question && <p className="text-[length:var(--ds-h2)] font-bold">{question}</p>}
      <PromptBox band={band} value={value} onChange={value => { if (!locked) setDraft(value) }} prompts={band === 'teens' ? [] : prompts} disabled={live.sending || !!pending} onSubmit={submit} pending={!!pending || live.sending} unconfirmed={!!live.unconfirmed} />
    </>}
  </LearnFrame>
}

/** L12 session: prompt, one follow-up, then feedback. Pending turns show Co thinking and never partial text. */
export function TeachSessionScreen({ sessionId, pollBaseMs, initial }: { sessionId: string; pollBaseMs?: number; /** Harness-only seed so the first paint matches the fixture before the refetch. */ initial?: TeachDetail }) {
  const { actor, band: identityBand } = useLearnIdentity()
  const query = useQuery({
    queryKey: ['learn', actor, 'teach-session', sessionId],
    queryFn: () => teachApi.session(sessionId),
    enabled: !!actor && !!sessionId,
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false,
  })
  const fallback: LearnBand = identityBand ?? 'teens'
  if (query.isPending && !initial) return <LearnSkeleton band={fallback} label={fallback === 'kids' ? 'Getting ready to learn from you' : 'Opening teach-back'} />
  if (query.error && !initial) return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={fallback} backHref={library} backLabel="Library" />
  const detail = query.data ?? initial
  if (!detail) return null
  const band = bandFromApi(detail.session.band)
  return <SessionBody detail={detail} band={band} pollBaseMs={pollBaseMs} />
}

function clientKey(practiceSessionId?: string | null, materialId?: string | null) {
  return `colearner:teach:client:${practiceSessionId ?? ''}:${materialId ?? ''}`
}

/** L12 entry: concept card, then an idempotent session. The explanation itself is written on the session page. */
export function TeachEntryScreen({ practiceSessionId, materialId, onStarted }: { practiceSessionId?: string | null; materialId?: string | null; onStarted?: (sessionId: string) => void }) {
  const router = useRouter()
  const { actor, band: identityBand } = useLearnIdentity()
  const startLock = useRef(false)
  const createId = useRef(newClientId())
  const query = useTeachContext({ practiceSessionId, materialId })
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [draft, setDraft] = useState('')
  const fallback: LearnBand = identityBand ?? 'teens'
  if (!practiceSessionId && !materialId) {
    return <LearnFrame band={fallback} label="Teach it back">
      <div className="ds-state" data-state="empty"><CoCharacter band={fallback} state="curious" decorative /><h1>Choose something to teach</h1><p>Open a page from your library first.</p><Link href={library} className="ds-button ds-button-primary">Go to the library</Link></div>
    </LearnFrame>
  }
  if (query.isPending) return <LearnSkeleton band={fallback} label="Finding the idea to teach" />
  if (query.error) return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={fallback} backHref={library} backLabel="Library" />
  const context: TeachContext = query.data
  const band = bandFromApi(context.band)
  const go = (id: string) => {
    // Creation has been confirmed. A future completed teach-back needs a fresh session id.
    try { window.sessionStorage.removeItem(`${clientKey(practiceSessionId, materialId)}:${actor}`) } catch { /* in-memory creation id is reset too */ }
    createId.current = newClientId()
    if (onStarted) onStarted(id); else router.push(teachRoutes.session(id))
  }
  const start = async () => {
    if (startLock.current) return
    if (context.openSessionId) { go(context.openSessionId); return }
    startLock.current = true
    setStarting(true); setError(null)
    try {
      const storageKey = `${clientKey(practiceSessionId, materialId)}:${actor}`
      let clientSessionId = createId.current
      try {
        const existing = window.sessionStorage.getItem(storageKey)
        clientSessionId = existing && existing.length >= 8 ? existing : clientSessionId
        window.sessionStorage.setItem(storageKey, clientSessionId)
      } catch { /* a fresh id still creates one session for this press */ }
      const created = await teachApi.create({ clientSessionId, ...(practiceSessionId ? { practiceSessionId } : {}), ...(materialId ? { materialId } : {}) })
      const text = draft.trim()
      if (text) {
        const sender = new TeachSender(body => teachApi.sendTurn(created.id, body), {
          key: `colearner:teach:turn:${actor}:${created.id}`, storage: browserTeachStorage(),
        })
        sender.restore()
        const outcome = await sender.send(text)
        if (outcome.status === 'refused') throw outcome.error
        // If the response was lost, the session page restores and retries the exact body and id.
      }
      go(created.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Teaching it back is not available right now.')
    } finally { startLock.current = false; setStarting(false) }
  }
  if (!context.available || !context.concept) {
    return <LearnFrame band={band} label="Teach it back">
      <div data-state="unavailable" className="ds-state"><CoCharacter band={band} state="encouraging" decorative /><h1>Not right now</h1><p>{context.reason ?? 'Teaching it back is not available right now.'}</p><Link href={library} className="ds-button ds-button-secondary">Library</Link></div>
    </LearnFrame>
  }
  const concept = context.concept
  return <LearnFrame band={band} label="Teach it back" className={cn(band === 'kids' && 'max-w-3xl')}>
    <section className="ds-card space-y-3" data-state="prompt">
      <CoCharacter band={band} state="asking" decorative className={band === 'kids' ? 'size-36' : undefined} />
      <h1 className={cn(band === 'kids' && 'text-[length:var(--ds-h1)]')}>{band === 'kids' ? `Teach Co about ${concept.title}` : concept.title}</h1>
      <p>From {concept.source.title}</p>
      <VoiceNote reason={context.voice.reason} />
      <AiOriginTag band={band} variant="helper" />
    </section>
    {error && <p role="alert">{error}</p>}
    {context.openSessionId
      ? <button type="button" className={cn('ds-button ds-button-primary', band === 'kids' && 'min-h-16 text-[length:var(--ds-h3)]')} onClick={() => void start()}>Continue</button>
      : <PromptBox band={band} value={draft} onChange={setDraft} prompts={context.prompts.length > 0 ? context.prompts : concept.keyPoints} disabled={starting} onSubmit={() => void start()} pending={starting} unconfirmed={false} />}
  </LearnFrame>
}
