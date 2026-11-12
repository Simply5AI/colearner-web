'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InlineAlert, LoadingBlock, NativeSelect, UnavailableNote } from '@/components/teacher/plans/fields'
import { materialTypeLabel } from '@/lib/api/teaching/materials'
import type { CoDraftInput } from '@/lib/api/teaching/co-drafts'
import { IntentKey } from '@/lib/api/teaching/plans'
import { coDraftTypes, difficultyLabel, difficulties, typeLabel, type QuestionDifficulty, type QuestionType } from '@/lib/api/teaching/question-schema'
import { questionErrorText } from '@/lib/api/teaching/questions'
import { useCoState, usePlanOptions, usePlanTopics, useQuestionApis, useTopicMaterials } from './use-question-apis'

/** "Ask Co to draft": Co reads the material you choose and drafts questions for you to review. Nothing is published by Co. */
export function CoDraftDialog({ open, onOpenChange, defaultPlanId = '', defaultTopicId = '' }: { open: boolean; onOpenChange: (open: boolean) => void; defaultPlanId?: string; defaultTopicId?: string }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" data-testid="co-draft-dialog">
      <DialogHeader><DialogTitle>Ask Co to draft questions</DialogTitle><DialogDescription>Co drafts from the material you pick. You accept, edit or reject every question before learners can see it.</DialogDescription></DialogHeader>
      {open && <CoDraftForm defaultPlanId={defaultPlanId} defaultTopicId={defaultTopicId} />}
    </DialogContent>
  </Dialog>
}

function CoDraftForm({ defaultPlanId, defaultTopicId }: { defaultPlanId: string; defaultTopicId: string }) {
  const router = useRouter()
  const apis = useQuestionApis()
  const [planId, setPlanId] = useState(defaultPlanId)
  const [topicId, setTopicId] = useState(defaultTopicId)
  const [materialIds, setMaterialIds] = useState<string[]>([])
  const [count, setCount] = useState(10)
  const [types, setTypes] = useState<QuestionType[]>(['MCQ', 'SHORT_ANSWER'])
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | ''>('')
  const intent = useRef(new IntentKey())
  const plans = usePlanOptions()
  const topics = usePlanTopics(planId || undefined)
  const materials = useTopicMaterials(planId || undefined, topicId || undefined)
  const state = useCoState(planId || undefined)
  const generate = state.data?.generate

  const input: CoDraftInput = { topicId, materialIds, count, types, difficulty: difficulty || null }
  const problem = !planId ? 'Choose a plan.' : !topicId ? 'Choose a topic.' : materialIds.length < 1 ? 'Choose 1 to 5 materials for Co to read.' : materialIds.length > 5 ? 'Choose at most 5 materials.'
    : !(count >= 1 && count <= 20) ? 'Ask for between 1 and 20 questions.' : types.length === 0 ? 'Choose at least one question type.' : null
  const unavailable = generate?.state === 'UNAVAILABLE'
  const blocked = unavailable || state.isPending && !!planId
  const create = useMutation({
    mutationFn: () => apis.co.create(planId, input, intent.current.keyFor({ planId, ...input })),
    onSuccess: batch => { intent.current.done(); router.push(`/teacher/questions/review/${encodeURIComponent(batch.id)}`) },
  })
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value])

  return <>
    <DialogBody>
      <form id="co-draft-form" className="space-y-4" onSubmit={event => { event.preventDefault(); if (!problem && !blocked && !create.isPending) create.mutate() }}>
        <NativeSelect label="Plan" value={planId} onChange={e => { setPlanId(e.target.value); setTopicId(''); setMaterialIds([]) }} data-testid="co-plan">
          <option value="">Choose a plan</option>{plans.data?.map(plan => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</NativeSelect>
        {planId && state.isPending && <LoadingBlock label="Checking whether Co can draft for this plan" />}
        {unavailable && <UnavailableNote testId="co-unavailable" label="Co drafting is not available for this plan" reason={generate?.reason ?? 'Co is not available right now.'} />}
        <NativeSelect label="Topic" value={topicId} onChange={e => { setTopicId(e.target.value); setMaterialIds([]) }} disabled={!planId} data-testid="co-topic">
          <option value="">Choose a topic</option>{topics.data?.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</NativeSelect>
        <fieldset className="space-y-1.5" disabled={!topicId}>
          <legend className="text-sm font-medium">Material for Co to read (1 to 5)</legend>
          {materials.isPending && !!topicId && <LoadingBlock label="Loading materials" />}
          {materials.data?.length === 0 && <p className="text-sm text-muted-foreground" data-testid="co-no-materials">This topic has no material yet. Add a note or upload a document to the topic first.</p>}
          {materials.data?.map(material => <label key={material.id} className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={materialIds.includes(material.id)} onChange={() => setMaterialIds(list => toggle(list, material.id))} />
            <span className="min-w-0 break-words">{material.title} <span className="text-xs text-muted-foreground">({materialTypeLabel[material.type]})</span></span>
          </label>)}
          <p className="text-xs text-muted-foreground">Co can only read material that has readable text. If a file has none, the draft will say so.</p>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><label htmlFor="co-count" className="block text-sm font-medium">How many questions (1 to 20)</label>
            <Input id="co-count" type="number" min={1} max={20} value={count} onChange={e => setCount(Number(e.target.value))} data-testid="co-count" /></div>
          <NativeSelect label="Difficulty" value={difficulty} onChange={e => setDifficulty(e.target.value as QuestionDifficulty | '')}><option value="">Mixed</option>{difficulties.map(d => <option key={d} value={d}>{difficultyLabel[d]}</option>)}</NativeSelect>
        </div>
        <fieldset className="space-y-1.5"><legend className="text-sm font-medium">Question types</legend>
          <div className="grid gap-1 sm:grid-cols-2">{coDraftTypes.map(type => <label key={type} className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={types.includes(type)} onChange={() => setTypes(list => toggle(list, type))} />{typeLabel[type]}</label>)}</div>
          <p className="text-xs text-muted-foreground">Co does not draft code, picture or ordering questions. You can write those yourself.</p></fieldset>
        {create.error && <InlineAlert testId="co-create-error">{questionErrorText(create.error)} Your choices are still here.</InlineAlert>}
      </form>
    </DialogBody>
    <DialogFooter>
      {problem && !unavailable && <p className="me-auto self-center text-xs text-muted-foreground" data-testid="co-problem">{problem}</p>}
      <Button type="submit" form="co-draft-form" size="lg" aria-disabled={!!problem || blocked || create.isPending || undefined} data-testid="co-submit"
        onClick={event => { if (problem || blocked || create.isPending) event.preventDefault() }}><Sparkles aria-hidden="true" />{create.isPending ? 'Sending…' : 'Ask Co to draft'}</Button>
    </DialogFooter>
  </>
}
