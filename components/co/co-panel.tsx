'use client'

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type MutableRefObject } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import Link from 'next/link'
import { MicOff, Send, X } from 'lucide-react'
import { Button, CoCharacter } from '@/components/design-system'
import { AiOriginTag } from '@/components/lesson/lesson-parts'
import { linkHref, type LearnBand } from '@/lib/api/learn'
import { cn } from '@/lib/utils'
import { useCoChat, useCoContext, type UseCoChatOptions } from './co-hooks'
import {
  announcementFor, coPoseFor, coSizeFor, emptyLine, GROUNDING_FOOTER, inputLabel, messageLimit, parentVisibilityNote, pendingLabel,
  phaseOf, problemFor, sendLabel, VOICE_NOTE_TITLE,
} from './co-model'
import { CoReplyCard, FailedCard, LearnerBubble, PendingCard, StoppedCard, SuggestionChips } from './co-reply'
import { CoLoading, CoProblemState, CoUnavailableState } from './co-states'
import type { CoContextRef, CoContextView, CoStyle } from './co-types'

const LIBRARY = '/learn/library'

export interface AskCoPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: CoContextRef
  band: LearnBand
  /** Nonsecret cache scope of the learner (never a credential). */
  actor: string
  /** Where source chips go when a source carries no link of its own. Defaults to the context material in the library. */
  materialHref?: string | null
  pollBaseMs?: UseCoChatOptions['pollBaseMs']
  slowAfterMs?: UseCoChatOptions['slowAfterMs']
  storage?: UseCoChatOptions['storage']
}

/**
 * The Ask Co panel (F-L8-01..04, 07, 08). A modal dialog: a large overlay for kids, a side panel at the inline end for
 * tweens and teens. Esc closes it (after a confirmation only when an unsent question exists), focus is trapped and returns
 * to whatever opened it, and the chat is announced through one polite live region.
 */
export function AskCoPanel(props: AskCoPanelProps) {
  const { open, onOpenChange, band } = props
  const draftRef = useRef(false)
  const [confirm, setConfirm] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const close = useCallback(() => { setConfirm(false); onOpenChange(false) }, [onOpenChange])
  const requestClose = useCallback(() => { if (draftRef.current) setConfirm(true); else close() }, [close])
  const handleOpenChange = useCallback((next: boolean, details: { cancel: () => void }) => {
    if (next) { onOpenChange(true); return }
    // A question that was typed but not sent is never lost to a stray Esc or click outside: ask first.
    if (confirm) { details.cancel(); setConfirm(false); return }
    if (draftRef.current) { details.cancel(); setConfirm(true); return }
    close()
  }, [close, confirm, onOpenChange])

  const kids = band === 'kids'
  return <Dialog.Root open={open} onOpenChange={handleOpenChange}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-[70] bg-foreground/40" />
      <Dialog.Popup data-age-band={band} data-testid="ask-co-panel" initialFocus={() => (band !== 'kids' && input.current) || title.current || true} finalFocus={true}
        className={cn('ds-age-scope fixed z-[70] flex min-h-0 flex-col overflow-hidden bg-background text-foreground shadow-xl outline-none [&_h2]:font-bold [&_h3]:font-bold',
          kids ? 'inset-0 sm:inset-6 sm:mx-auto sm:max-w-3xl sm:rounded-[var(--radius)] sm:border sm:border-border'
            : 'inset-y-0 end-0 w-full border-s border-border sm:w-[28rem] lg:w-[32rem]')}>
        <PanelBody {...props} titleRef={title} inputRef={input} draftRef={draftRef} confirm={confirm} onKeepWriting={() => setConfirm(false)} onCloseAnyway={close} onRequestClose={requestClose} />
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

interface BodyProps extends AskCoPanelProps {
  titleRef: React.RefObject<HTMLHeadingElement | null>
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  draftRef: MutableRefObject<boolean>
  confirm: boolean
  onKeepWriting: () => void
  onCloseAnyway: () => void
  onRequestClose: () => void
}

function PanelBody(props: BodyProps) {
  const { band, context, actor, titleRef, inputRef, onRequestClose } = props
  const query = useCoContext(actor, context)
  const view = query.data
  const ready = view?.available === true

  // Focus starts where the dialog puts it (the field for tweens and teens when the chat is already there, else the heading, so a
  // screen reader says where it is). When the chat appears later, tweens and teens move on to the field unless the learner already
  // moved. Nothing is focused on mount here: the dialog must first remember what to return focus to.
  const wasReady = useRef(ready)
  useEffect(() => {
    if (wasReady.current === ready) return
    wasReady.current = ready
    if (!ready || band === 'kids') return
    // After the dialog's own first focus (it lands a frame after opening), so that one cannot take focus back from the field.
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement
      const inside = active instanceof HTMLElement && !!active.closest('[role="dialog"]')
      const dialogItself = active instanceof HTMLElement && active.getAttribute('role') === 'dialog'
      if (!inside || dialogItself || active === titleRef.current) inputRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [band, inputRef, ready, titleRef])

  const libraryHref = view?.source ? linkHref(view.source.link) ?? linkHref({ route: 'LIBRARY_ITEM', id: view.source.materialId }) : null
  return <>
    <header className="flex shrink-0 items-start gap-3 border-b border-border p-3 sm:p-4">
      <CoCharacter band={band} state="idle" size={band === 'kids' ? 64 : 44} decorative className="shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <Dialog.Title ref={titleRef} tabIndex={-1} className="text-[length:var(--ds-h2)] font-extrabold leading-tight outline-none">Ask Co</Dialog.Title>
        <Dialog.Description className="sr-only">Co is an AI helper that answers questions from your own material and labels anything beyond it.</Dialog.Description>
        <AiOriginTag band={band} variant="helper" />
        {view?.source && <p className="min-w-0 text-[length:var(--ds-small)] text-muted-foreground" data-testid="co-source">About <span className="font-bold text-foreground">{view.source.title}</span>
          {libraryHref && <> · <Link href={libraryHref} className="font-bold text-primary underline">Open in library</Link></>}</p>}
      </div>
      <Button variant="ghost" aria-label="Close Ask Co" onClick={onRequestClose}><X size={22} aria-hidden="true" /></Button>
    </header>
    {query.isPending && <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"><CoLoading band={band} /></div>}
    {query.error && !query.isPending && <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"><CoProblemState problem={problemFor(query.error)} band={band} onRetry={() => void query.refetch()} backHref={LIBRARY} /></div>}
    {view && !view.available && <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"><CoUnavailableState reason={view.reason} band={band} hasMaterial={view.source !== null} libraryHref={LIBRARY} /></div>}
    {view?.available && <CoChatView {...props} view={view} materialHref={props.materialHref ?? libraryHref} />}
  </>
}

/* ---------- the conversation ---------- */

const STYLE_OPTIONS: { value: CoStyle; label: string }[] = [{ value: 'SIMPLE', label: 'Simple' }, { value: 'EXAM', label: 'Exam-style' }]

function CoChatView({ band, context, actor, view, materialHref, inputRef: input, draftRef, confirm, onKeepWriting, onCloseAnyway, pollBaseMs, slowAfterMs, storage }: BodyProps & { view: CoContextView }) {
  const chat = useCoChat({ actor, context, view, pollBaseMs, slowAfterMs, storage })
  const [draft, setDraft] = useState('')
  const [style, setStyle] = useState<CoStyle>('SIMPLE')
  const [announcement, setAnnouncement] = useState('')
  const region = useRef<HTMLDivElement>(null)
  const errorId = useId()
  const hintId = useId()
  const kids = band === 'kids'
  const limit = messageLimit[band]
  const locked = chat.unconfirmed !== null
  const busy = chat.sending || chat.pending !== null
  const canAsk = !busy && !locked
  const text = locked ? chat.unconfirmed!.text : draft
  const canSend = (locked || draft.trim().length > 0) && !busy
  const empty = chat.turns.length === 0 && !chat.sending && !chat.historyLoading
  const phase = phaseOf(chat.turns, chat.sending)
  draftRef.current = draft.trim().length > 0 || locked

  // One polite sentence per finished or pending turn of THIS visit; earlier history is never read out.
  const last = chat.turns[chat.turns.length - 1]
  const lastKey = last ? `${last.id}:${last.status}` : ''
  useEffect(() => {
    if (last && chat.isFresh(last.id)) setAnnouncement(announcementFor(last, band))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey, band])
  // Follow the conversation: the newest turn comes into view (from its top when it is taller than the panel, so a long reply is read from
  // the start). The empty state is never scrolled, so Co and the first suggestions stay in sight.
  useEffect(() => {
    const scroller = region.current
    const newest = scroller?.querySelector<HTMLElement>('[data-testid="co-turn"]:last-child')
    if (!scroller || !newest) return
    newest.scrollIntoView?.({ block: newest.offsetHeight > scroller.clientHeight ? 'start' : 'end' })
  }, [chat.turns.length, last?.status, chat.sending])

  const submit = async () => {
    if (locked) { await chat.resend(); return }
    if (!canSend) return
    if (await chat.send(draft, band === 'teens' ? style : null)) { setDraft(''); input.current?.focus() }
  }
  const onSubmit = (event: FormEvent) => { event.preventDefault(); void submit() }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() }
  }
  const ask = (suggestion: string) => { if (canAsk) void chat.send(suggestion, band === 'teens' ? style : null) }
  const contextSuggestions = view.suggestions.slice(0, kids ? 3 : 5)
  const voiceUnavailable = !view.voice.available

  return <>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="co-announcer">{announcement}</div>
    <div ref={region} role="region" aria-label="Chat with Co" data-phase={phase} tabIndex={0} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 outline-none focus-visible:outline-2 focus-visible:outline-ring sm:p-4">
      {chat.historyLoading && <p role="status" data-testid="co-history-loading" className="text-muted-foreground">Loading your earlier questions…</p>}
      {chat.historyProblem && <CoProblemState problem={chat.historyProblem} band={band} onRetry={chat.reloadHistory} />}
      {empty && !chat.historyProblem && <div className={cn('space-y-4', kids && 'text-center')} data-testid="co-empty">
        <div className={cn('flex gap-4', kids ? 'flex-col items-center' : 'items-center')}>
          <CoCharacter band={band} state={coPoseFor('idle')} size={coSizeFor(band, true)} decorative className="shrink-0" />
          <p className={cn('ds-speech-bubble !block font-bold', kids && 'text-[length:var(--ds-h3)]')}>{emptyLine(band, view.source?.title ?? null)}</p>
        </div>
        <SuggestionChips suggestions={contextSuggestions} band={band} onPick={ask} disabled={!canAsk} label="Things you could ask" />
      </div>}
      {chat.turns.length > 0 && <ol aria-label="Your chat with Co" className="space-y-5">
        {chat.turns.map(turn => <li key={turn.id} data-testid="co-turn" data-status={turn.status} className="space-y-3">
          <LearnerBubble text={turn.learnerText} band={band} />
          {turn.status === 'READY' && <CoReplyCard turn={turn} band={band} materialHref={materialHref ?? null} onSuggestion={ask} suggestions={turn.id === last?.id} canAsk={canAsk} />}
          {(turn.status === 'QUEUED' || turn.status === 'RUNNING') && <PendingCard band={band} slow={chat.slow} onStop={() => void chat.stopTurn(turn)} stopping={false} />}
          {turn.status === 'FAILED' && <FailedCard turn={turn} band={band} onRetry={() => void chat.retryTurn(turn)} retrying={false} />}
          {turn.status === 'CANCELLED' && <StoppedCard band={band} />}
        </li>)}
        {chat.sending && chat.sendingText && <li data-testid="co-turn" data-status="SENDING" className="space-y-3">
          <LearnerBubble text={chat.sendingText} band={band} />
          <PendingCard band={band} slow={false} onStop={() => undefined} stopping={false} />
        </li>}
      </ol>}
      {chat.pollProblem && <div role="alert" data-testid="co-poll-problem" className="space-y-2 rounded-[var(--radius)] border border-destructive/50 bg-card p-3">
        <p className="font-bold">We cannot reach Co right now.</p>
        <p className="text-muted-foreground">{chat.pollProblem.message}</p>
        {chat.pollProblem.kind !== 'denied' && chat.pollProblem.kind !== 'ended' && <Button variant="secondary" onClick={chat.resumePolling}>Check again</Button>}
      </div>}
    </div>

    <footer className="shrink-0 space-y-2 border-t border-border bg-background p-3 sm:p-4">
      {confirm && <div role="alert" data-testid="co-confirm-close" className="space-y-2 rounded-[var(--radius)] border border-primary/50 bg-secondary p-3">
        <p className="font-bold">Close without sending?</p>
        <p className="text-[length:var(--ds-small)]">Your question has not been sent yet.</p>
        <div className="flex flex-wrap gap-2">
          <Button autoFocus onClick={onKeepWriting}>Keep writing</Button>
          <Button variant="secondary" onClick={onCloseAnyway}>Close</Button>
        </div>
      </div>}
      {(chat.error || chat.unconfirmed) && <p role="alert" id={errorId} data-testid="co-error" className="text-destructive">{chat.error ?? 'We could not send that. Your message is kept, so try again.'}</p>}
      {band === 'teens' && <fieldset className="flex flex-wrap items-center gap-2" data-testid="co-style">
        <legend className="sr-only">Answer style</legend>
        <span aria-hidden="true" className="text-[length:var(--ds-small)] font-bold text-muted-foreground">Answer style</span>
        {STYLE_OPTIONS.map(option => <label key={option.value} className="ds-pill min-h-[2.75rem] cursor-pointer border border-border has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:outline-2">
          <input type="radio" name="co-style" value={option.value} checked={style === option.value} onChange={() => setStyle(option.value)} className="size-4 accent-primary" />{option.label}
        </label>)}
      </fieldset>}
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <div className="ds-field min-w-0 flex-1">
          <label htmlFor={`${hintId}-input`} className="sr-only">{inputLabel(band)}</label>
          <textarea id={`${hintId}-input`} ref={input} rows={1} maxLength={limit} value={text} readOnly={locked} onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown}
            placeholder={kids ? 'Type your question…' : 'Ask about your material…'} aria-describedby={chat.error || locked ? `${hintId} ${errorId}` : hintId}
            className="ds-input field-sizing-content max-h-40 resize-none read-only:bg-muted" data-testid="co-input" />
        </div>
        <Button type="submit" disabled={!canSend} loading={chat.sending} aria-label={locked ? 'Send again' : sendLabel(band)} className={cn(kids && 'min-w-[4rem] text-[length:var(--ds-h3)]')}>
          <Send size={kids ? 26 : 18} aria-hidden="true" className="rtl:-scale-x-100" />{kids ? sendLabel(band) : <span className="hidden sm:inline">{locked ? 'Send again' : sendLabel(band)}</span>}
        </Button>
      </form>
      <p id={hintId} className={cn('text-[length:var(--ds-caption)] text-muted-foreground', (kids || !chat.pending) && 'sr-only sm:not-sr-only', kids && 'sm:sr-only')} data-testid="co-hint">
        {chat.pending ? `${pendingLabel(band)}. You can write your next question while you wait.` : draft.length >= limit * 0.8 ? `${draft.length} of ${limit} letters` : `Press Enter to send. Shift and Enter makes a new line.`}
      </p>
      <ul className="space-y-0.5 text-[length:var(--ds-caption)] leading-snug text-muted-foreground" data-testid="co-notes">
        {voiceUnavailable && <li data-testid="co-voice-note" className="flex items-start gap-2"><MicOff size={16} aria-hidden="true" className="mt-0.5 shrink-0" /><span><span className="font-bold">{VOICE_NOTE_TITLE}</span>{view.voice.reason ? ` ${view.voice.reason}` : ''}</span></li>}
        <li data-testid="co-parent-note">{parentVisibilityNote(band, view.parentVisibility.mode)}</li>
        <li data-testid="co-grounding-note">{GROUNDING_FOOTER}</li>
      </ul>
    </footer>
  </>
}
