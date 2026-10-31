'use client'

import { useId, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Lightbulb, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react'
import { Button, CoCharacter, Select } from '@/components/design-system'
import { SaveToNotesButton } from '@/components/notes/save-to-notes-button'
import { analogiesApi, analogyFailureMessage, analogyNoteBody, type AnalogyCard, type AnalogyApiBand } from '@/lib/api/analogies'
import type { LearnBand } from '@/lib/api/learn'
import { cn } from '@/lib/utils'

export interface AnalogyConcept { ref: string; label: string }
export interface AnalogyPanelProps {
  materialId: string
  band: LearnBand
  concepts: AnalogyConcept[]
  className?: string
}

const apiBand: Record<LearnBand, AnalogyApiBand> = { kids: '6-9', tweens: '10-13', teens: '14-17' }
type Shown = { concept: AnalogyConcept; card: AnalogyCard } | { concept: AnalogyConcept; failure: { code: string; retryable: boolean; message: string } }

/**
 * "Explain it with an analogy" for one key idea of a material. Pick an idea, ask Co, read the card: the analogy, how its
 * parts match the idea, where it breaks down, and the exact words from the material it is based on. A friendly,
 * retryable failure never shows raw model or error text. A good card can be saved to "My pages" (ages 10 and up).
 */
export function AnalogyPanel({ materialId, band, concepts, className }: AnalogyPanelProps) {
  const selectId = useId()
  const [conceptRef, setConceptRef] = useState('')
  const [shown, setShown] = useState<Shown | null>(null)
  const requestId = useRef<string | null>(null)
  const kids = band === 'kids'
  const selected = concepts.find(concept => concept.ref === conceptRef) ?? null

  const make = useMutation({
    retry: false,
    mutationFn: async (concept: AnalogyConcept) => ({
      concept,
      outcome: await analogiesApi.create({ materialId, conceptRef: concept.ref, conceptLabel: concept.label, ageBand: apiBand[band], requestId: requestId.current ?? undefined }),
    }),
    onSuccess: ({ concept, outcome }) => {
      setShown(outcome.status === 'READY'
        ? { concept, card: outcome.analogy }
        : { concept, failure: { code: outcome.code, retryable: outcome.retryable, message: analogyFailureMessage(outcome.code) } })
    },
    onError: (error, concept) => setShown({ concept, failure: { code: 'request', retryable: false, message: error instanceof Error && error.message ? error.message : analogyFailureMessage('') } }),
  })
  const ask = (concept: AnalogyConcept | null) => {
    if (!concept || make.isPending) return
    // One id per click; the server treats a repeated id as the same call, a retry gets a fresh one.
    requestId.current = crypto.randomUUID()
    setShown(null)
    make.mutate(concept)
  }

  if (concepts.length === 0) return <section aria-label="Explain it with an analogy" data-testid="analogy-panel" className={cn('space-y-3', className)}>
    <p data-testid="analogy-no-ideas" className="text-muted-foreground">Co will find the key ideas in this material first. Then you can ask for an analogy.</p>
  </section>

  return <section aria-label="Explain it with an analogy" data-testid="analogy-panel" className={cn('space-y-4', className)}>
    <div className="flex items-start gap-3">
      <CoCharacter band={band} state={make.isPending ? 'thinking' : 'explaining'} size={kids ? 72 : 48} decorative />
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-[length:var(--ds-h3)] font-bold"><Lightbulb size={20} aria-hidden="true" />Explain it with an analogy</h3>
        <p className="text-muted-foreground">{kids ? 'Pick an idea. Co will compare it to something you know.' : 'Pick a key idea and Co will compare it to something familiar.'}</p>
      </div>
    </div>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); ask(selected) }}>
      <Select label="Which key idea?" id={selectId} value={conceptRef} onChange={event => { setConceptRef(event.target.value); setShown(null) }} data-testid="analogy-concept">
        <option value="">Choose an idea</option>
        {concepts.map(concept => <option key={concept.ref} value={concept.ref}>{concept.label}</option>)}
      </Select>
      <Button type="submit" disabled={!selected} loading={make.isPending} data-testid="analogy-make" className={cn(kids && 'min-h-14 text-[length:var(--ds-h3)]')}>
        <Sparkles size={18} aria-hidden="true" />Explain with an analogy
      </Button>
    </form>

    {make.isPending && <div role="status" aria-live="polite" data-testid="analogy-loading" className="flex items-center gap-3 rounded-[var(--radius)] border border-dashed border-border p-4">
      <CoCharacter band={band} state="thinking" size={kids ? 72 : 48} decorative />
      <p className="font-bold">{kids ? 'Co is thinking of something you know…' : 'Co is thinking of a good comparison…'}</p>
    </div>}

    {shown && 'failure' in shown && <div role="alert" data-testid="analogy-failed" data-retryable={shown.failure.retryable} className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4">
      <p className="flex items-start gap-2"><TriangleAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{shown.failure.message}</span></p>
      {shown.failure.retryable && <div><Button variant="secondary" onClick={() => ask(shown.concept)} data-testid="analogy-retry"><RefreshCw size={18} aria-hidden="true" />Try again</Button></div>}
    </div>}

    {shown && 'card' in shown && <AnalogyResult materialId={materialId} concept={shown.concept} card={shown.card} band={band} />}
  </section>
}

function AnalogyResult({ materialId, concept, card, band }: { materialId: string; concept: AnalogyConcept; card: AnalogyCard; band: LearnBand }) {
  const kids = band === 'kids'
  return <article aria-label={`Analogy for ${concept.label}`} data-testid="analogy-result" className="space-y-4 rounded-[var(--radius)] border border-border bg-card p-4">
    <header className="space-y-1">
      <p className="ds-pill inline-flex border border-border">{concept.label}</p>
      <h4 className="text-[length:var(--ds-h3)] font-bold" data-testid="analogy-title">{card.title}</h4>
    </header>
    <p className={cn('max-w-prose whitespace-pre-line leading-relaxed', kids && 'text-[length:var(--ds-h3)] font-semibold leading-snug')} data-testid="analogy-text">{card.analogy}</p>
    <section aria-label="How it matches" data-testid="analogy-maps" className="space-y-2">
      <h5 className="font-bold">How it matches</h5>
      <ul className="space-y-2">
        {card.howItMaps.map(row => <li key={`${row.part}:${row.mapsTo}`} className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] bg-secondary/40 px-3 py-2">
          <span className="font-semibold">{row.part}</span><span aria-label="is like" className="text-muted-foreground">→</span><span>{row.mapsTo}</span>
        </li>)}
      </ul>
    </section>
    <section aria-label="Where it breaks" data-testid="analogy-breaks" className="space-y-1 rounded-[var(--radius)] border border-border border-dashed p-3">
      <h5 className="font-bold">Where it breaks</h5>
      <p className="max-w-prose">{card.whereItBreaks}</p>
    </section>
    <blockquote data-testid="analogy-quote" className="border-s-4 border-primary ps-3 text-muted-foreground">
      <span className="font-semibold">From your material: </span>&ldquo;{card.sourceQuote}&rdquo;
    </blockquote>
    <SaveToNotesButton materialId={materialId} kind="ANALOGY" title={card.title} body={analogyNoteBody(card)} conceptRef={concept.ref} sourceAnchorRef={card.sourceAnchorRef} />
  </article>
}
