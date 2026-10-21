import type { CoState } from '@/components/design-system'
import type { LearnBand, ApiBand } from '@/lib/api/learn'
import type { LessonBlock, LessonContentView, LessonSource, LessonStepKind, LessonStepView } from '@/lib/api/lesson'
import { speechWords } from '@/lib/hooks/use-read-aloud'

/** What each of the five steps is called to the learner. Kids get one plain word. */
export const stepLabels: Record<LessonStepKind, { name: string; kids: string }> = {
  INTRO: { name: 'Intro', kids: 'Hello' },
  EXPLAIN: { name: 'Explain', kids: 'Learn' },
  CHECK: { name: 'Check', kids: 'Try it' },
  EXAMPLE: { name: 'Example', kids: 'See it' },
  RECAP: { name: 'Recap', kids: 'Remember' },
}
export const stepName = (kind: LessonStepKind, band: LearnBand) => band === 'kids' ? stepLabels[kind].kids : stepLabels[kind].name

/** Co's pose per step (B08 contract). A hint being open moves the CHECK pose from asking to hinting. */
export function coPose(kind: LessonStepKind, band: LearnBand, hintOpen = false): CoState {
  switch (kind) {
    case 'INTRO': return band === 'kids' ? 'waving' : 'curious'
    case 'EXPLAIN': return band === 'kids' ? 'explaining' : 'reading'
    case 'CHECK': return hintOpen ? 'hinting' : 'asking'
    case 'EXAMPLE': return band === 'kids' ? 'curious' : 'explaining'
    case 'RECAP': return band === 'teens' ? 'encouraging' : 'celebrating'
  }
}

/** Co's size in the lesson: big beside a speech bubble for kids, half-body for tweens, a small dock avatar for teens. */
export const coSizeFor = (band: LearnBand) => band === 'kids' ? 210 : band === 'tweens' ? 150 : 56
export const speechRate = (band: LearnBand) => band === 'kids' ? 0.85 : 1

export const apiBandOf = (band: LearnBand): ApiBand => band === 'kids' ? '6-9' : band === 'tweens' ? '10-13' : '14-17'

/** "From page 3", "From 2:14", "From section 3.2": the label is derived by the server from the anchor. */
export const sourceChipText = (source: Pick<LessonSource, 'label'>) => `From ${source.label.trim().replace(/^from\s+/i, '')}`

/** One chip per distinct anchor and label. */
export function uniqueSources(sources: readonly LessonSource[]): LessonSource[] {
  const seen = new Set<string>()
  return sources.filter(source => { const key = `${source.anchorRef}\u0000${source.label}`; if (seen.has(key)) return false; seen.add(key); return true })
}

/** Index in the lesson's key terms for a term shown in a block, so "Save to revision notes" can store the exact term. */
export function termIndexFor(content: Pick<LessonContentView, 'keyTerms'>, term: string): number {
  const wanted = term.trim().toLowerCase()
  return content.keyTerms.findIndex(item => item.term.trim().toLowerCase() === wanted)
}

/* ---------- spoken script ---------- */

export interface SpokenSegment { id: string; words: string[]; start: number }
export interface SpokenScript { text: string; segments: SpokenSegment[]; starts: Record<string, number> }

/**
 * The words the browser speaks for a step, in reading order: Co's line, text, list items, key terms, then the question
 * and its options. Tables are not read aloud. Every segment is addressed by an id so the rendered words can highlight
 * the exact word being spoken.
 */
export function buildScript(step: Pick<LessonStepView, 'coLine' | 'blocks' | 'check'>): SpokenScript {
  const raw: { id: string; text: string }[] = [{ id: 'coLine', text: step.coLine }]
  step.blocks.forEach((block, index) => {
    if (block.type === 'TEXT') raw.push({ id: `b${index}`, text: block.text })
    else if (block.type === 'LIST') block.items.forEach((item, item_) => raw.push({ id: `b${index}i${item_}`, text: item }))
    else if (block.type === 'KEY_TERMS') block.terms.forEach((term, item_) => { raw.push({ id: `b${index}t${item_}`, text: `${term.term}.` }, { id: `b${index}t${item_}d`, text: term.definition }) })
  })
  if (step.check) {
    raw.push({ id: 'question', text: step.check.question })
    step.check.options.forEach((option, index) => raw.push({ id: `option${index}`, text: option.text }))
  }
  let start = 0
  const segments: SpokenSegment[] = []
  for (const item of raw) {
    const words = speechWords(item.text)
    if (words.length === 0) continue
    segments.push({ id: item.id, words, start })
    start += words.length
  }
  return { text: segments.flatMap(segment => segment.words).join(' '), segments, starts: Object.fromEntries(segments.map(segment => [segment.id, segment.start])) }
}

export const blockText = (block: LessonBlock): string => block.type === 'TEXT' ? block.text : block.type === 'LIST' ? block.items.join(' ') : block.type === 'KEY_TERMS' ? block.terms.map(term => `${term.term} ${term.definition}`).join(' ') : [...block.headers, ...block.rows.flat()].join(' ')

/** Sentence lengths the band promises (words). Used by tests and the dev harness, never to rewrite server text. */
export const sentenceLimit: Record<ApiBand, number> = { '6-9': 8, '10-13': 20, '14-17': 30 }
