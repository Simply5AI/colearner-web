'use client'

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { flagLabel, reviewLabel, statusLabel, typeLabel, type QuestionFlag, type QuestionListItem } from '@/lib/api/teaching/question-schema'
import { questionErrorText } from '@/lib/api/teaching/questions'
import { MeasuredTag } from '@/components/teacher/plans/fields'
import { useQuestionApis } from './use-question-apis'

/**
 * A flag is a suggestion, never a gate (F-T4-08). A Co flag says "Co suggests"; the rule-based duplicate check says
 * "Duplicate". Both can be dismissed when the server gave the flag an id.
 */
export function FlagChip({ flag, onDismiss, busy, disabledReason }: { flag: QuestionFlag; onDismiss?: () => void; busy?: boolean; disabledReason?: string | null }) {
  const co = flag.source === 'CO'
  const label = co ? `Co suggests: ${flagLabel[flag.kind].toLowerCase()}` : flag.kind === 'DUPLICATE' ? 'Duplicate' : flagLabel[flag.kind]
  return <span data-testid="flag-chip" data-source={flag.source} data-kind={flag.kind} title={flag.note || undefined}
    className={cn('inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', co ? 'border-primary/40 bg-primary/5 text-primary' : 'border-amber-500/50 bg-amber-500/10')}>
    {co && <Sparkles aria-hidden="true" className="size-3 shrink-0" />}
    <span className="truncate">{label}</span>
    {onDismiss && (flag.id
      ? <button type="button" onClick={onDismiss} disabled={busy} aria-label={`Dismiss: ${label}`} data-testid="flag-dismiss" className="-me-1 rounded-full p-0.5 hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-ring"><X aria-hidden="true" className="size-3" /></button>
      : <button type="button" aria-disabled="true" aria-label={`Dismiss: ${label} (${disabledReason ?? 'not available'})`} data-testid="flag-dismiss" title={disabledReason ?? 'This suggestion cannot be dismissed yet.'} className="-me-1 cursor-not-allowed rounded-full p-0.5 opacity-50"><X aria-hidden="true" className="size-3" /></button>)}
  </span>
}

/** Flag chips for one question with dismiss wired to the server. A dismissed flag disappears; it never blocks publishing. */
export function QuestionFlags({ question, onChanged, showNotes = false }: { question: Pick<QuestionListItem, 'id' | 'flags'>; onChanged: () => void; showNotes?: boolean }) {
  const apis = useQuestionApis()
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState<string[]>([])
  const dismiss = useMutation({
    mutationFn: async (flag: QuestionFlag) => { await apis.questions.dismissFlag(question.id, flag.id!); return flag.id! },
    onSuccess: id => { setHidden(list => [...list, id]); setError(null); onChanged() },
    onError: e => setError(questionErrorText(e)),
  })
  const visible = question.flags.filter(flag => !flag.id || !hidden.includes(flag.id))
  if (visible.length === 0) return null
  return <div className="space-y-1.5">
    <div className="flex flex-wrap gap-1.5">{visible.map((flag, index) => <FlagChip key={flag.id ?? `${flag.kind}-${flag.source}-${index}`} flag={flag} busy={dismiss.isPending} onDismiss={() => flag.id && dismiss.mutate(flag)} disabledReason="The server did not send an id for this suggestion." />)}</div>
    {showNotes && <ul className="space-y-1 text-xs text-muted-foreground">{visible.filter(flag => flag.note).map((flag, index) => <li key={index}><span className="font-medium text-foreground">{flag.source === 'CO' ? 'Co suggests' : 'Rule check'}:</span> {flag.note}</li>)}</ul>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}

export function SuccessRate({ rate }: { rate: QuestionListItem['successRate'] }) {
  if (!rate) return <span data-testid="success-rate" data-empty="true" title="Fewer than 5 attempts from learners who share progress, so no rate is shown." className="text-muted-foreground"><span aria-hidden="true">–</span><span className="sr-only">No success rate yet: fewer than 5 attempts</span></span>
  return <span data-testid="success-rate" className="inline-flex flex-wrap items-center gap-1"><MeasuredTag /> <span className="font-semibold">{Math.round(rate.value * 100)}%</span> <span className="text-xs text-muted-foreground">of {rate.attempts} attempts</span></span>
}

export function AuthorOnlyBadge() {
  return <span data-testid="author-only" title="Learners do not see this type yet. You can write it, publish it and print it on a worksheet." className="inline-flex h-5 items-center rounded-full border border-border bg-muted px-2 text-xs font-semibold text-muted-foreground">Author-only</span>
}

export function StatusChips({ question }: { question: Pick<QuestionListItem, 'status' | 'hasDraftRevision' | 'reviewState' | 'version'> }) {
  return <div className="flex flex-wrap gap-1">
    <span data-testid="status-chip" data-status={question.status} className={cn('inline-flex h-5 items-center rounded-full border px-2 text-xs font-semibold', question.status === 'PUBLISHED' ? 'border-primary/40 bg-primary/10 text-primary' : question.status === 'DRAFT' ? 'border-border bg-background' : 'border-border bg-muted text-muted-foreground')}>{statusLabel[question.status]}{question.status === 'PUBLISHED' ? ` v${question.version}` : ''}</span>
    {question.hasDraftRevision && <span data-testid="draft-revision-chip" className="inline-flex h-5 items-center rounded-full border border-amber-500/50 bg-amber-500/10 px-2 text-xs font-semibold">Unpublished edits</span>}
    {question.reviewState === 'PENDING_REVIEW' && <span data-testid="review-chip" className="inline-flex h-5 items-center rounded-full border border-primary/40 bg-primary/5 px-2 text-xs font-semibold text-primary">{reviewLabel.PENDING_REVIEW}</span>}
  </div>
}

export const typeText = (type: keyof typeof typeLabel) => typeLabel[type]
