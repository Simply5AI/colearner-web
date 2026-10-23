'use client'

import { useState } from 'react'
import { Button, Input, LoadingState } from '@/components/design-system'
import { useTeaching, useTeachingResource } from '@/components/teacher/teaching-context'
import { classifyTeachingError } from '@/lib/api/teaching/core'
import {
  addOnboardingMaterial,
  firstTopicOf,
  planForMaterialSchema,
  saveOnboarding,
  validateMaterial,
  type MaterialDraft,
  type TeacherOnboardingState,
} from '@/lib/api/teaching/onboarding'
import { TeachingFailurePanel } from '@/components/teacher/dashboard/failure-panel'

type Mode = 'FILE' | 'LINK'

export function MaterialStep({
  state,
  onAdvanced,
  onRefresh,
}: {
  state: TeacherOnboardingState
  onAdvanced: (state: TeacherOnboardingState) => void
  /** Reload the server state (its revision moves when material is added or a save conflicts). */
  onRefresh: () => void
}) {
  const plan = state.firstPlan
  if (!plan) {
    return <p data-testid="t8-material-needs-plan" className="text-sm text-muted-foreground">Create your first plan first. Material is added to its first topic.</p>
  }
  return <MaterialBody state={state} planId={plan.planId} onAdvanced={onAdvanced} onRefresh={onRefresh} />
}

function MaterialBody({ state, planId, onAdvanced, onRefresh }: { state: TeacherOnboardingState; planId: string; onAdvanced: (state: TeacherOnboardingState) => void; onRefresh: () => void }) {
  const { request } = useTeaching()
  const { resource, reload } = useTeachingResource(`/plans/${encodeURIComponent(planId)}`, (raw) => planForMaterialSchema.parse(raw))
  const [mode, setMode] = useState<Mode>('FILE')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string[]>([])
  const [advancing, setAdvancing] = useState(false)

  if (resource.status === 'loading') return <LoadingState label="Loading your plan…" />
  if (resource.status === 'error') return <TeachingFailurePanel kind={resource.kind} message={resource.message} onRetry={reload} testId="t8-material-failure" />
  const topic = firstTopicOf(resource.data)
  if (!topic) {
    return <p data-testid="t8-material-no-topic" className="rounded-xl border border-dashed border-border p-4 text-sm">Your plan has no topic yet. Add one in the plan editor, then come back, or skip this step.</p>
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const draft: MaterialDraft =
      mode === 'LINK'
        ? { kind: 'LINK', title, url }
        : { kind: 'FILE', title: title || file?.name.replace(/\.[^.]+$/, '') || '', file: file ? { name: file.name, type: file.type, size: file.size } : { name: '', type: '', size: 0 } }
    const problem = mode === 'FILE' && !file ? 'Choose a file or a photo.' : validateMaterial(draft)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      await addOnboardingMaterial(request, topic, draft, file ?? undefined)
      setAdded((list) => [...list, draft.title.trim()])
      setTitle('')
      setUrl('')
      setFile(null)
      onRefresh()
    } catch (caught) {
      // The title, link and chosen file stay in the form.
      setError(`${classifyTeachingError(caught).message} Your entry is kept.`)
    } finally {
      setBusy(false)
    }
  }

  const advance = async () => {
    setAdvancing(true)
    setError(null)
    try {
      onAdvanced(await saveOnboarding(request, state, { step: 'INVITE' }))
    } catch (caught) {
      setError(classifyTeachingError(caught).message)
      onRefresh()
    } finally {
      setAdvancing(false)
    }
  }

  const hasMaterial = state.hasMaterial || added.length > 0
  return (
    <div className="space-y-4" data-testid="t8-material">
      <p className="text-sm text-muted-foreground">Add material to your first topic: <strong className="text-foreground">{topic.title}</strong>.</p>
      <div role="group" aria-label="Material type" className="flex flex-wrap gap-2">
        {([['FILE', 'Upload a file or photo'], ['LINK', 'Add a link']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${mode === value ? 'border-primary bg-primary/10' : 'border-border'}`}>{label}</button>
        ))}
      </div>
      <form onSubmit={submit} noValidate className="space-y-3">
        <Input label="Title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
        {mode === 'LINK' ? (
          <Input label="Link (https)" type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} />
        ) : (
          <div className="space-y-1">
            <label htmlFor="t8-material-file" className="text-sm font-semibold">File or photo</label>
            {/* capture hints phones to open the camera; desktops show the file picker */}
            <input id="t8-material-file" type="file" capture="environment" accept=".pdf,.pptx,.ppt,.docx,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block min-h-11 w-full text-sm" />
            <p className="text-xs text-muted-foreground">PDF, slides or Word up to 50 MB. Photos up to 20 MB. Co does not read or analyse teacher material in this release.</p>
          </div>
        )}
        {error && <p role="alert" data-testid="t8-material-error" className="text-sm font-semibold text-destructive">{error}</p>}
        <Button type="submit" variant="secondary" loading={busy}>Add material</Button>
      </form>
      {added.length > 0 && (
        <ul data-testid="t8-material-added" aria-label="Added this session" className="space-y-1 text-sm">
          {added.map((name, index) => <li key={`${name}:${index}`}>Added: {name}</li>)}
        </ul>
      )}
      <Button onClick={() => void advance()} loading={advancing} disabled={!hasMaterial}>Continue</Button>
      {!hasMaterial && <p className="text-xs text-muted-foreground">Continue unlocks after one item is added. Or use Skip for later.</p>}
    </div>
  )
}
