'use client'

import { useState } from 'react'
import { BookOpen, Check, Lightbulb, RotateCcw, Save, Volume2 } from 'lucide-react'
import {
  formatReasonCodes,
  type TutorActionTarget,
  type TutorCheckQuestion,
  type TutorObjectiveAnswer,
  type TutorProposalCard,
  type TutorSourceCitation,
  type TutorTurnResult,
} from '@/lib/api/tutor-loop/co'
import type { Exchange } from './use-tutor-chat'
import { coArtSrc, replyPlainText, type TutorArtState } from './tutor-types'

export interface ReplyActions {
  coName: string
  coIcon: 'BUDDY' | 'CLOUD' | 'SPARK' | 'SPROUT'
  readAloud: boolean
  onOpenCitation: (citation: TutorSourceCitation) => void
  onAnswerCheck: (exchange: Exchange, question: TutorCheckQuestion, answer: TutorObjectiveAnswer, label: string) => void
  onStillStuck: () => void
  onShorter: () => void
  onMoreDetail: () => void
  onSave: (exchange: Exchange) => Promise<void>
  onNextHint: () => void
  onAcceptProposal: (proposal: TutorProposalCard) => Promise<void>
  onSpeak: (text: string) => void
  onRetry: (exchange: Exchange) => void
  onCancel: (exchange: Exchange) => void
  answered: Record<string, string>
  busy: boolean
}

function artFor(result: TutorTurnResult | null): TutorArtState {
  if (!result) return 'idle'
  if (result.disposition === 'CLARIFY' || result.move === 'DIAGNOSE') return 'asking'
  if (result.move === 'ENCOURAGE') return 'celebrating'
  return 'speaking'
}

export function TutorExchange({ exchange, actions }: { exchange: Exchange; actions: ReplyActions }) {
  return (
    <div className="flex flex-col gap-3" data-testid="tutor-exchange">
      {exchange.learnerText && (
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-2xl bg-primary/10 px-4 py-2.5 text-sm whitespace-pre-wrap">
            {exchange.learnerText}
          </p>
        </div>
      )}
      {(exchange.status === 'sending' || exchange.status === 'queued') && (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <img src={coArtSrc(actions.coIcon, 'thinking')} alt="" width={32} height={32} />
          <span>{actions.coName} is thinking…</span>
          <button
            type="button"
            onClick={() => actions.onCancel(exchange)}
            className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold"
          >
            Stop
          </button>
        </div>
      )}
      {exchange.status === 'cancelled' && (
        <p className="text-sm text-muted-foreground">You stopped this answer.</p>
      )}
      {exchange.status === 'failed' && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 text-sm">
          <p>{exchange.errorMessage ?? `${actions.coName} could not answer that. You can try again.`}</p>
          {exchange.retryable && (
            <button
              type="button"
              onClick={() => actions.onRetry(exchange)}
              className="ds-button ds-button-secondary self-start"
            >
              <RotateCcw size={14} aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      )}
      {exchange.status === 'ready' && exchange.result && (
        <TutorReply exchange={exchange} result={exchange.result} actions={actions} />
      )}
    </div>
  )
}

function TutorReply({
  exchange,
  result,
  actions,
}: {
  exchange: Exchange
  result: TutorTurnResult
  actions: ReplyActions
}) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [shortAnswer, setShortAnswer] = useState('')
  const citations = result.segments.flatMap(s => (s.source === 'MATERIAL' ? [s.citation] : []))
  const chosen = exchange.turnId ? actions.answered[exchange.turnId] : undefined
  const hint = result.hintRung ?? null
  const maxHint = result.maxHintRungs ?? null

  return (
    <div className="flex items-start gap-2.5">
      <img src={coArtSrc(actions.coIcon, artFor(result))} alt="" width={36} height={36} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {result.segments.map((segment, index) => {
          if (segment.source === 'GENERAL') {
            return (
              <div key={index} className="rounded-2xl border border-dashed border-border bg-muted/40 p-3 text-sm">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
                  <Lightbulb size={13} aria-hidden="true" /> Not from your material
                </span>
                <span className="whitespace-pre-wrap">{segment.text}</span>
              </div>
            )
          }
          return (
            <div key={index} className="flex flex-col items-start gap-1.5">
              <p className="rounded-2xl bg-card px-4 py-2.5 text-sm whitespace-pre-wrap">{segment.text}</p>
              {segment.source === 'MATERIAL' && (
                <button
                  type="button"
                  onClick={() => actions.onOpenCitation(segment.citation)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-bold text-primary"
                >
                  <BookOpen size={13} aria-hidden="true" />
                  {segment.citation.label || 'From your material'}
                </button>
              )}
            </div>
          )
        })}

        {result.brief && (
          <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-label={result.brief.title}>
            <h3 className="text-base font-extrabold">{result.brief.title}</h3>
            {result.brief.sections.map(section => (
              <div key={section.heading}>
                <b className="text-sm">{section.heading}</b>
                <ul className="ms-5 list-disc text-sm">
                  {section.points.map(point => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
            {result.brief.workedExample && (
              <div>
                <b className="text-sm">Worked example</b>
                <p className="text-sm">{result.brief.workedExample}</p>
              </div>
            )}
            {result.brief.selfChecks.length > 0 && (
              <div>
                <b className="text-sm">Check yourself</b>
                <ul className="text-sm">
                  {result.brief.selfChecks.map(check => (
                    <li key={check} className="flex gap-2">
                      <span aria-hidden="true">☐</span>
                      {check}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {result.brief.citations.map((citation, i) => (
                <button
                  key={`${citation.passageRef}-${i}`}
                  type="button"
                  onClick={() => actions.onOpenCitation(citation)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-bold text-primary"
                >
                  <BookOpen size={13} aria-hidden="true" /> {citation.label || 'From your material'}
                </button>
              ))}
            </div>
          </article>
        )}

        {result.question && (
          <CheckQuestionCard
            question={result.question}
            chosen={chosen}
            disabled={actions.busy}
            shortAnswer={shortAnswer}
            onShortAnswer={setShortAnswer}
            onAnswer={(answer, label) => actions.onAnswerCheck(exchange, result.question!, answer, label)}
          />
        )}

        {hint !== null && maxHint !== null && (
          <div className="flex flex-wrap items-center gap-3 text-sm" aria-label="Hint ladder">
            <span className="font-bold">
              Hint {hint} of {maxHint}
            </span>
            <button
              type="button"
              disabled={hint >= maxHint || actions.busy}
              onClick={actions.onNextHint}
              className="ds-button ds-button-secondary"
            >
              {hint >= maxHint ? 'No more hints. Try it yourself' : 'Another hint'}
            </button>
          </div>
        )}

        {result.proposals.map(proposal => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            accepting={acceptingId === proposal.id}
            onAccept={async () => {
              setAcceptingId(proposal.id)
              try {
                await actions.onAcceptProposal(proposal)
              } finally {
                setAcceptingId(null)
              }
            }}
          />
        ))}

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Reply tools">
          <ToolButton onClick={actions.onShorter}>Shorter</ToolButton>
          <ToolButton onClick={actions.onMoreDetail}>More detail</ToolButton>
          <ToolButton onClick={actions.onStillStuck}>I still don’t get it</ToolButton>
          <ToolButton
            onClick={async () => {
              setSaveState('saving')
              try {
                await actions.onSave(exchange)
                setSaveState('saved')
              } catch {
                setSaveState('error')
              }
            }}
            disabled={saveState === 'saving' || saveState === 'saved'}
          >
            {saveState === 'saved' ? <Check size={13} aria-hidden="true" /> : <Save size={13} aria-hidden="true" />}
            {saveState === 'saved' ? 'Saved to Notes' : 'Save to Notes'}
          </ToolButton>
          {actions.readAloud && (
            <ToolButton onClick={() => actions.onSpeak(replyPlainText(result))}>
              <Volume2 size={13} aria-hidden="true" /> Read aloud
            </ToolButton>
          )}
          <span role="status" className="text-xs text-muted-foreground">
            {saveState === 'error' ? 'Could not save. Try again.' : ''}
          </span>
        </div>
        {citations.length === 0 && result.segments.every(s => s.source !== 'GENERAL') && null}
      </div>
    </div>
  )
}

function ToolButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-border px-3 text-xs font-bold hover:bg-muted/60 disabled:opacity-60"
    >
      {children}
    </button>
  )
}

function CheckQuestionCard({
  question,
  chosen,
  disabled,
  shortAnswer,
  onShortAnswer,
  onAnswer,
}: {
  question: TutorCheckQuestion
  chosen: string | undefined
  disabled: boolean
  shortAnswer: string
  onShortAnswer: (value: string) => void
  onAnswer: (answer: TutorObjectiveAnswer, label: string) => void
}) {
  const kind = question.kind ?? (question.options?.length ? 'MCQ' : 'SHORT_ANSWER')
  const done = chosen !== undefined
  return (
    <section aria-label="Quick check" className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <span className="text-xs font-extrabold tracking-wider text-primary uppercase">Quick check</span>
      {question.prompt && <b className="text-sm">{question.prompt}</b>}
      {kind === 'MCQ' &&
        (question.options ?? []).map(option => (
          <button
            key={option.id}
            type="button"
            disabled={done || disabled}
            onClick={() => onAnswer({ kind: 'MCQ', optionId: option.id }, option.text)}
            className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl border px-3 text-start text-sm ${
              chosen === option.text ? 'border-primary bg-primary/10' : 'border-border bg-background'
            }`}
          >
            <span>{option.text}</span>
            {chosen === option.text && <span className="text-xs font-bold text-primary">Your answer</span>}
          </button>
        ))}
      {kind === 'TRUE_FALSE' &&
        [true, false].map(value => {
          const label = value ? 'True' : 'False'
          return (
            <button
              key={label}
              type="button"
              disabled={done || disabled}
              onClick={() => onAnswer({ kind: 'TRUE_FALSE', value }, label)}
              className={`min-h-[44px] rounded-xl border px-3 text-start text-sm ${
                chosen === label ? 'border-primary bg-primary/10' : 'border-border bg-background'
              }`}
            >
              {label}
            </button>
          )
        })}
      {kind === 'SHORT_ANSWER' && !done && (
        <form
          className="flex gap-2"
          onSubmit={event => {
            event.preventDefault()
            const text = shortAnswer.trim()
            if (text) onAnswer({ kind: 'SHORT_ANSWER', text }, text)
          }}
        >
          <input
            value={shortAnswer}
            onChange={event => onShortAnswer(event.target.value)}
            aria-label="Your answer"
            maxLength={400}
            className="ds-input min-w-0 flex-1"
          />
          <button type="submit" disabled={disabled || !shortAnswer.trim()} className="ds-button ds-button-primary">
            Check
          </button>
        </form>
      )}
      {(kind === 'ORDERING' || kind === 'CLOZE') && !done && (
        <p className="text-xs text-muted-foreground">Type your answer in the message box below.</p>
      )}
      {done && kind === 'SHORT_ANSWER' && <span className="text-sm">Your answer: {chosen}</span>}
    </section>
  )
}

function ProposalCard({
  proposal,
  accepting,
  onAccept,
}: {
  proposal: TutorProposalCard
  accepting: boolean
  onAccept: () => Promise<void>
}) {
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (dismissed) return <p className="text-sm text-muted-foreground">Okay. Nothing changes.</p>
  const target: TutorActionTarget = proposal.target
  return (
    <section aria-label="Suggested next step" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <span className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Co suggests</span>
      <b className="text-sm">{target.label}</b>
      <span className="text-xs text-muted-foreground">
        {formatReasonCodes(target.reasonCodes)}
        {target.minutes > 0 ? ` · ${target.minutes} min` : ''}
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={accepting}
          onClick={async () => {
            setError(null)
            try {
              await onAccept()
            } catch (e) {
              setError((e as { message?: string }).message ?? 'Could not do that. Try again.')
            }
          }}
          className="ds-button ds-button-primary"
        >
          {accepting ? 'Adding…' : 'Do this'}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="ds-button ds-button-secondary">
          {proposal.alternative?.label ?? 'Not now'}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
