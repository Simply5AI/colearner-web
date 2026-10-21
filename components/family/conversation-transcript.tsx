import { ShieldAlert } from 'lucide-react'
import { dispositionLabel, turnHasSafetyMarker, turnKey, type ConversationTurn } from '@/lib/api/family-conversations'

/**
 * Read-only transcript for a parent, rendered only for access FULL. Message text is shown as plain text (never HTML or
 * markdown) because it was typed by a child or written by AI. Co's replies are always labelled as AI.
 */
export function ConversationTranscript({ turns, title, truncated = false }: { turns: ConversationTurn[]; title: string; truncated?: boolean }) {
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Co is an AI helper. Its replies are written by AI, are checked for safety and may sometimes be wrong. This transcript is read-only.</p>
    {truncated && <p role="note" className="rounded-xl bg-muted p-3 text-sm">This conversation is long, so only the first part is shown here.</p>}
    {turns.length === 0
      ? <p className="rounded-xl bg-muted p-3 text-sm">No messages were saved in this conversation.</p>
      : <ol aria-label={`Transcript of ${title}`} className="space-y-3">{turns.map(turn => <TranscriptTurn key={turnKey(turn)} turn={turn} />)}</ol>}
  </div>
}

function TranscriptTurn({ turn }: { turn: ConversationTurn }) {
  const learner = turn.role === 'learner'
  const safety = turnHasSafetyMarker(turn)
  const guidance = typeof turn.safety === 'object' && turn.safety ? turn.safety.guidance : null
  return <li data-role={turn.role} className={`flex flex-col gap-1 ${learner ? 'items-end' : 'items-start'}`}>
    <span className="text-xs font-bold text-muted-foreground">{learner ? 'Your child' : 'Co · AI helper'}</span>
    <div className={`max-w-[min(100%,34rem)] space-y-2 rounded-2xl border p-3 ${learner ? 'bg-primary/10' : 'bg-accent/40'} ${safety ? 'border-destructive/40' : ''}`}>
      <p className="whitespace-pre-wrap break-words">{turn.text}</p>
      {guidance && <p className="whitespace-pre-wrap break-words text-sm">{guidance}</p>}
      {!learner && <ul aria-label="About this reply" className="flex flex-wrap gap-2 text-xs font-semibold">
        {turn.disposition && <li className="rounded-full border px-2 py-1">{dispositionLabel[turn.disposition]}</li>}
        {turn.beyondMaterial && <li className="rounded-full border px-2 py-1">Beyond your material</li>}
        {safety && <li className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-2 py-1"><ShieldAlert size={14} aria-hidden="true" />Safety check</li>}
      </ul>}
      {learner && (turn.status === 'FAILED' || turn.status === 'CANCELLED') && <p className="text-xs font-semibold text-muted-foreground">{turn.status === 'FAILED' ? 'Co could not answer this message.' : 'This message was stopped before Co answered.'}</p>}
      {learner && safety && <p className="inline-flex items-center gap-1 text-xs font-semibold"><ShieldAlert size={14} aria-hidden="true" />Safety check</p>}
    </div>
  </li>
}
