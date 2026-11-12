'use client'

import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InlineAlert } from '@/components/teacher/plans/fields'
import { typeLabel } from '@/lib/api/teaching/question-imports'
import { difficultyLabel, type Difficulty } from '@/lib/api/teaching/worksheets'
import type { PlanTopic } from './use-b13-apis'

export interface FillRequest { topicIds: string[]; count: number; mix: Partial<Record<Difficulty, number>> | null; types: string[] | null }
const TYPES = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'LONG_ANSWER', 'CODE', 'PICTURE_CHOICE', 'ORDERING'] as const

/** "Fill for me" is a rule, not AI: the platform picks from PUBLISHED questions in a fixed order and skips ones already on the sheet. */
export function WorksheetFillDialog({ open, onOpenChange, topics, remaining, busy, failure, onFill }: {
  open: boolean; onOpenChange: (open: boolean) => void; topics: PlanTopic[]; remaining: number; busy: boolean; failure: string | null; onFill: (request: FillRequest) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [count, setCount] = useState(5)
  const [mix, setMix] = useState<Record<Difficulty, string>>({ EASY: '', MEDIUM: '', HARD: '' })
  const [types, setTypes] = useState<string[]>([])
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter(entry => entry !== value) : [...list, value])
  const mixNumbers = Object.fromEntries((Object.keys(mix) as Difficulty[]).filter(key => mix[key] !== '' && Number(mix[key]) > 0).map(key => [key, Number(mix[key])])) as Partial<Record<Difficulty, number>>
  const mixTotal = Object.values(mixNumbers).reduce((sum, n) => sum + (n ?? 0), 0)
  const mixMismatch = mixTotal > 0 && mixTotal !== count
  const tooMany = count > remaining
  const problem = picked.length === 0 ? 'Choose at least one topic.' : !Number.isInteger(count) || count < 1 || count > 40 ? 'Choose between 1 and 40 questions.' : tooMany ? `The worksheet has room for ${remaining} more questions.` : mixMismatch ? `The difficulty mix adds up to ${mixTotal}, not ${count}.` : null
  return <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next) }}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" data-testid="ws-fill-dialog">
      <DialogHeader><DialogTitle>Fill for me</DialogTitle><DialogDescription>Picks published questions by topic and difficulty using a fixed rule. It never writes new questions, and it skips ones already on the worksheet.</DialogDescription></DialogHeader>
      <DialogBody className="space-y-4">
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Topics</legend>
          <div className="grid gap-1.5">{topics.map(topic => <label key={topic.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={picked.includes(topic.id)} onChange={() => setPicked(list => toggle(list, topic.id))} data-testid={`fill-topic-${topic.id}`} />{topic.title}</label>)}</div></fieldset>
        <div className="space-y-1.5"><label htmlFor="fill-count" className="block text-sm font-medium">How many questions</label>
          <input id="fill-count" type="number" min={1} max={40} value={count} onChange={event => setCount(Number(event.target.value))} data-testid="fill-count" className="h-9 w-28 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm" /></div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Difficulty mix (optional)</legend>
          <div className="flex flex-wrap gap-3">{(Object.keys(difficultyLabel) as Difficulty[]).map(key => <div key={key} className="space-y-1"><label htmlFor={`fill-mix-${key}`} className="block text-xs">{difficultyLabel[key]}</label>
            <input id={`fill-mix-${key}`} type="number" min={0} max={40} value={mix[key]} onChange={event => setMix(current => ({ ...current, [key]: event.target.value }))} data-testid={`fill-mix-${key}`} className="h-9 w-20 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm" /></div>)}</div>
          <p className="text-xs text-muted-foreground">Leave empty to take any difficulty. If you fill it in, the numbers must add up to the total.</p></fieldset>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Question types (optional)</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">{TYPES.map(type => <label key={type} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={types.includes(type)} onChange={() => setTypes(list => toggle(list, type))} />{typeLabel[type]}</label>)}</div></fieldset>
        {problem && <p className="text-sm text-muted-foreground" data-testid="fill-problem">{problem}</p>}
        {failure && <InlineAlert testId="fill-failure">{failure}</InlineAlert>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
        <Button size="lg" disabled={problem !== null || busy} aria-disabled={problem !== null || busy} data-testid="fill-submit"
          onClick={() => onFill({ topicIds: picked, count, mix: mixTotal > 0 ? mixNumbers : null, types: types.length > 0 ? types : null })}><Wand2 aria-hidden="true" />{busy ? 'Picking' : 'Fill the worksheet'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
