'use client'
import { useId, useState } from 'react'
import { ChevronDown, ShieldAlert } from 'lucide-react'
import {
  conversationKindLabel, flagCount, homeworkPhaseLabel, safetyClassificationLabel,
  type FamilySafetyAlert, type FullConversationItem, type SummaryConversationItem,
} from '@/lib/api/family-conversations'
import { ConversationTranscript } from './conversation-transcript'

export const formatWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

function Facts({ item }: { item: FullConversationItem | SummaryConversationItem }) {
  const flags = flagCount(item)
  const homework = item.homework
  return <ul aria-label="Conversation details" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
    <li className="rounded-full border px-2 py-1 font-semibold text-foreground">{conversationKindLabel(item.kind)}</li>
    <li><time dateTime={item.startedAt}>{formatWhen(item.startedAt)}</time></li>
    <li>{plural(item.turnCount, 'turn', 'turns')}</li>
    {homework && <li>{homeworkPhaseLabel[homework.phase]} · {plural(homework.hintsUsed, 'hint', 'hints')} used</li>}
    {flags > 0 && <li className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-2 py-1 font-semibold text-foreground"><ShieldAlert size={14} aria-hidden="true" />{plural(flags, 'safety flag', 'safety flags')}</li>}
  </ul>
}

/** Under 14 or an audited grant: each conversation expands to a read-only transcript. */
export function FullConversationList({ items }: { items: FullConversationItem[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const base = useId()
  const toggle = (id: string) => setOpen(old => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next })
  return <ul aria-label="Conversations with Co" className="space-y-3">{items.map(item => {
    const expanded = open.has(item.id)
    const panel = `${base}-${item.id}`
    return <li key={item.id} className="space-y-3 rounded-2xl border p-4">
      <h4 className="text-base font-bold"><button type="button" aria-expanded={expanded} aria-controls={panel} onClick={() => toggle(item.id)} className="flex min-h-11 w-full items-center justify-between gap-3 text-start">
        <span className="min-w-0 break-words">{item.title}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">{expanded ? 'Hide transcript' : 'Show transcript'}<ChevronDown size={18} aria-hidden="true" className={expanded ? 'rotate-180' : ''} /></span>
      </button></h4>
      <Facts item={item} />
      <div id={panel} role="region" aria-label={`Transcript: ${item.title}`} hidden={!expanded}>{expanded && <ConversationTranscript turns={item.turns} title={item.title} truncated={item.truncated === true} />}</div>
    </li>
  })}</ul>
}

/** Ages 14-17 without a grant: a row per conversation, no text and nothing to expand. */
export function SummaryConversationList({ items }: { items: SummaryConversationItem[] }) {
  return <ul aria-label="Conversation summaries" className="space-y-3">{items.map(item => <li key={item.id} className="space-y-2 rounded-2xl border p-4">
    <h4 className="break-words text-base font-bold">{item.title}</h4>
    <Facts item={item} />
  </li>)}</ul>
}

export function SafetyAlertList({ alerts }: { alerts: FamilySafetyAlert[] }) {
  return <section aria-labelledby="family-safety-alerts" className="space-y-3">
    <h3 id="family-safety-alerts" className="font-bold">Safety alerts</h3>
    {alerts.length === 0
      ? <p className="text-sm text-muted-foreground">No safety alerts.</p>
      : <ul aria-label="Safety alerts" className="space-y-2">{alerts.map(alert => <li key={alert.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
        <ShieldAlert size={18} aria-hidden="true" /><span className="font-semibold">{safetyClassificationLabel(alert.classification)}</span><time dateTime={alert.createdAt} className="text-sm text-muted-foreground">{formatWhen(alert.createdAt)}</time>
      </li>)}</ul>}
  </section>
}
