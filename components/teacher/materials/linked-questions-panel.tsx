'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { LinkedQuestion, TeachingMaterial } from '@/lib/api/teaching/materials'
import { teachingErrorText } from '@/lib/api/teaching/plans'
import { InlineAlert } from '@/components/teacher/plans/fields'
import { useTeachingApis } from '@/components/teacher/plans/use-teaching-apis'

const statusWord = { DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' } as const

/**
 * Linked questions (F-T3-02). Read-only prompts: no answer, option or explanation is ever shown here (the schema is strict, so a
 * payload carrying one fails to parse). The only edit is which of this plan's materials a question points to; writing questions arrives later.
 */
export function LinkedQuestionsPanel({ planId, questions, materials, readOnly, onChanged }: {
  planId: string; questions: LinkedQuestion[]; materials: TeachingMaterial[]; readOnly: boolean; onChanged: () => void
}) {
  const apis = useTeachingApis()
  const [editing, setEditing] = useState<{ id: string; ids: string[] } | null>(null)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const title = (id: string) => materials.find(material => material.id === id)?.title ?? 'Removed material'

  async function save() {
    if (!editing) return
    setPending(true); setFailure(null)
    try { await apis.materials.linkQuestion(planId, editing.id, editing.ids); setEditing(null); onChanged() }
    catch (error) { setFailure(teachingErrorText(error)) } finally { setPending(false) }
  }

  return <section aria-label="Linked questions" className="space-y-3" data-testid="questions-panel">
    <h3 className="text-base font-bold">Linked questions</h3>
    <p className="text-xs text-muted-foreground">Questions are read-only here. You can choose which material each one refers to. Writing and editing questions arrives in a later release.</p>
    {failure && <InlineAlert>{failure}</InlineAlert>}
    {questions.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground" data-testid="questions-empty">No questions are linked to this topic yet.</p>
      : <ul className="space-y-2">{questions.map(question => <li key={question.id} className="rounded-lg border border-border p-3" data-testid="question-row">
        <p className="break-words text-sm">{question.promptPreview}</p>
        <p className="mt-1 text-xs text-muted-foreground">{question.type.replace(/_/g, ' ').toLowerCase()} · {statusWord[question.status]}</p>
        <p className="mt-1 text-xs">{question.materialIds.length === 0 ? 'Not linked to any material.' : <>Refers to: {question.materialIds.map(title).join(', ')}</>}</p>
        {!readOnly && editing?.id !== question.id && materials.length > 0 && <Button className="mt-2" variant="outline" size="lg" onClick={() => setEditing({ id: question.id, ids: question.materialIds })}>Edit linked material</Button>}
        {editing?.id === question.id && <fieldset className="mt-2 space-y-1" disabled={pending}>
          <legend className="text-xs font-semibold">Material this question refers to (up to 10)</legend>
          {materials.map(material => <label key={material.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.ids.includes(material.id)} onChange={e => setEditing({ id: question.id, ids: e.target.checked ? [...editing.ids, material.id].slice(0, 10) : editing.ids.filter(entry => entry !== material.id) })} />{material.title}
          </label>)}
          <div className="flex gap-2 pt-1"><Button size="lg" onClick={() => void save()} disabled={pending}>Save links</Button><Button variant="outline" size="lg" onClick={() => setEditing(null)}>Cancel</Button></div>
        </fieldset>}
      </li>)}</ul>}
  </section>
}
