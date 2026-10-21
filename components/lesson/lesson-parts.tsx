'use client'

import Link from 'next/link'
import { BookOpen, Bookmark, Sparkles } from 'lucide-react'
import { Button, CoCharacter, type CoState } from '@/components/design-system'
import type { LearnBand } from '@/lib/api/learn'
import type { LessonBlock, LessonContentView, LessonSource } from '@/lib/api/lesson'
import { cn } from '@/lib/utils'
import { coSizeFor, sourceChipText, termIndexFor, uniqueSources } from './lesson-model'
import { Spoken } from './lesson-speech'

/** Visible, plain statement of where the lesson came from. The model is Co; the facts come from the learner's material. */
export function AiOriginTag({ band, packVersion, promptRelease, variant = 'lesson' }: { band: LearnBand; packVersion?: string; promptRelease?: string; /** B10: 'helper' labels an Ask Co reply ("Co is an AI helper") instead of a made lesson. */ variant?: 'lesson' | 'helper' }) {
  const helper = variant === 'helper'
  return <p data-kind="ai-origin" className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--ds-small)] font-bold text-muted-foreground">
    <span className="ds-pill text-[var(--brand-orange,#cf5d0b)]"><Sparkles size={16} aria-hidden="true" />{helper ? 'Co is an AI helper' : band === 'kids' ? 'Co made this' : 'Made by Co with AI'}</span>
    {!helper && <span>{band === 'kids' ? 'from your pages' : 'from your material'}</span>}
    {band !== 'kids' && packVersion && promptRelease && <span className="sr-only">AI pack {packVersion}, prompt release {promptRelease}</span>}
  </p>
}

/** Source chips: where in the learner's own material this step comes from. They link back to the reader. */
export function SourceChips({ sources, materialHref, band, showQuotes = band !== 'kids' }: { sources: readonly LessonSource[]; materialHref: string | null; band: LearnBand; showQuotes?: boolean }) {
  const chips = uniqueSources(sources)
  if (chips.length === 0) return null
  return <section aria-label="Where this comes from" data-testid="source-chips" className="space-y-2">
    <ul className="flex flex-wrap gap-2">
      {chips.map(source => <li key={`${source.anchorRef}:${source.label}`}>
        {materialHref
          ? <Link href={materialHref} className="ds-pill border border-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"><BookOpen size={16} aria-hidden="true" />{sourceChipText(source)}</Link>
          : <span className="ds-pill border border-border"><BookOpen size={16} aria-hidden="true" />{sourceChipText(source)}</span>}
      </li>)}
    </ul>
    {showQuotes && chips.some(source => source.quote.trim()) && <details className="text-[length:var(--ds-small)]">
      <summary className="cursor-pointer font-semibold text-muted-foreground">See the words from your material</summary>
      <div className="mt-2 space-y-2">{chips.filter(source => source.quote.trim()).map(source => <blockquote key={`${source.anchorRef}:${source.label}`} className="border-s-4 border-primary ps-3 text-muted-foreground"><span className="font-semibold">{sourceChipText(source)}: </span>&ldquo;{source.quote}&rdquo;</blockquote>)}</div>
    </details>}
  </section>
}

export interface BlocksProps {
  blocks: readonly LessonBlock[]
  band: LearnBand
  content: Pick<LessonContentView, 'keyTerms'>
  stepIndex: number
  /** Tweens and teens may save a key term to their private notes. */
  onSaveTerm?: (termIndex: number) => void
  savingTerm?: boolean
}

/** Renders only the blocks the lesson provides: text, list, table and key terms. No image is ever requested. */
export function LessonBlocks({ blocks, band, content, onSaveTerm, savingTerm }: BlocksProps) {
  const kids = band === 'kids'
  return <div className={cn('space-y-5', kids && 'space-y-6')}>{blocks.map((block, index) => {
    if (block.type === 'TEXT') return <p key={index} className={cn('max-w-prose leading-relaxed', kids && 'text-[length:var(--ds-h3)] font-semibold leading-snug')}><Spoken id={`b${index}`} text={block.text} /></p>
    if (block.type === 'LIST') return kids
      ? <ul key={index} className="grid gap-3 sm:grid-cols-2">{block.items.map((item, item_) => <li key={item_} className="rounded-[var(--radius)] border-2 border-primary/40 bg-secondary p-4 text-[length:var(--ds-h3)] font-bold"><Spoken id={`b${index}i${item_}`} text={item} /></li>)}</ul>
      : <ul key={index} className="max-w-prose list-disc space-y-2 ps-6">{block.items.map((item, item_) => <li key={item_}><Spoken id={`b${index}i${item_}`} text={item} /></li>)}</ul>
    if (block.type === 'TABLE') return <div key={index} role="region" aria-label="Table" tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-border focus-visible:outline-2 focus-visible:outline-ring">
      <table className="w-full min-w-max border-collapse text-start text-[length:var(--ds-small)]">
        <thead className="bg-muted"><tr>{block.headers.map((header, column) => <th key={column} scope="col" className="px-3 py-2 text-start font-bold">{header}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-border">{row.map((cell, column) => column === 0 ? <th key={column} scope="row" className="px-3 py-2 text-start font-semibold">{cell}</th> : <td key={column} className="px-3 py-2">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
    return <dl key={index} aria-label="Key terms" className={cn('grid gap-3', !kids && 'sm:grid-cols-2')}>{block.terms.map((term, item_) => {
      const termIndex = termIndexFor(content, term.term)
      return <div key={item_} className="rounded-[var(--radius)] border border-border bg-card p-4">
        <dt className="font-extrabold text-primary"><Spoken id={`b${index}t${item_}`} text={`${term.term}.`} /></dt>
        <dd className="mt-1"><Spoken id={`b${index}t${item_}d`} text={term.definition} /></dd>
        {onSaveTerm && termIndex >= 0 && <Button variant="ghost" className="mt-2" disabled={savingTerm} onClick={() => onSaveTerm(termIndex)} aria-label={`${band === 'teens' ? 'Save to revision notes' : 'Save to my notes'}: ${term.term}`}><Bookmark size={16} aria-hidden="true" />{band === 'teens' ? 'Save to revision notes' : 'Save to my notes'}</Button>}
      </div>
    })}</dl>
  })}</div>
}

/** Co beside the step: big with a speech bubble for kids, half-body for tweens, a small avatar for teens. */
export function CoPanel({ band, pose, line, children }: { band: LearnBand; pose: CoState; line: string; children?: React.ReactNode }) {
  if (band === 'teens') {
    return <aside aria-label="Co helper" data-testid="co-dock" className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-border bg-card p-3">
      <CoCharacter band="teens" state={pose} size={coSizeFor('teens')} decorative />
      <p className="min-w-0 flex-1 basis-48 font-medium"><Spoken id="coLine" text={line} /></p>
      {children}
    </aside>
  }
  const kids = band === 'kids'
  return <aside aria-label="Co helper" data-testid="co-panel" className={cn('flex gap-4', kids ? 'flex-col items-center text-center lg:sticky lg:top-24' : 'items-start lg:flex-col lg:items-center lg:text-center')}>
    {/* Smaller on a phone so the step is not pushed off the first screen; the full size from the tablet width up. */}
    <CoCharacter band={band} state={pose} size={coSizeFor(band)} decorative className={kids ? 'size-36 sm:size-52' : 'size-24 sm:size-36'} />
    <div className="min-w-0 flex-1 space-y-3 lg:flex-none">
      <p className={cn('ds-speech-bubble !block font-bold', kids && 'text-[length:var(--ds-h3)]')} data-testid="co-line"><Spoken id="coLine" text={line} /></p>
      {children}
    </div>
  </aside>
}
